import {
  AVATARS,
  type Avatar,
  CARD_BACKS,
  DEFAULT_CARD_BACK,
  DEFAULT_FRAME,
  FRAMES,
  type Frame,
  type User,
} from '@xomdao/shared';
import { count, desc, eq, ilike, or } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { sessions, users } from '../db/schema.js';

export interface NewUser {
  username: string;
  passwordHash: string;
  name: string;
  avatar: Avatar;
  frame: Frame;
}

/** What a player may change about themselves; a missing `frame` keeps the current one. */
export interface ProfileChange {
  name: string;
  avatar: Avatar;
  frame?: Frame;
}

/** How a player shows to others, as equipped from Túi đồ (each field left out stays). */
export interface Looks {
  avatar?: Avatar;
  frame?: Frame;
  cardBack?: string;
}

/** An account as the console lists it. */
export interface AccountRow extends User {
  /** ISO time. */
  createdAt: string;
}

/** A page of accounts, newest first, and how many match in all. */
export interface AccountPage {
  users: AccountRow[];
  total: number;
}

/** What the console may change on an account (each field left out stays). */
export interface AccountChange {
  name?: string;
  passwordHash?: string;
}

/** Where accounts are kept: Postgres in real use, memory when there is no DATABASE_URL. */
export interface AccountsStore {
  /** `null` when the username is taken. */
  createUser(user: NewUser): Promise<User | null>;
  findLogin(username: string): Promise<{ user: User; passwordHash: string } | null>;
  createSession(tokenHash: string, userId: string): Promise<void>;
  userBySession(tokenHash: string): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;
  updateProfile(userId: string, profile: ProfileChange): Promise<User | null>;
  userById(userId: string): Promise<User | null>;
  setLooks(userId: string, looks: Looks): Promise<User | null>;
  /** Accounts whose username or name contains `query` (any case), newest first. */
  listUsers(query: string, limit: number, offset: number): Promise<AccountPage>;
  updateAccount(userId: string, change: AccountChange): Promise<User | null>;
  /** Removes the account with its sessions; whether it existed. */
  deleteUser(userId: string): Promise<boolean>;
  /** Logs the account out of every browser. */
  deleteSessionsOf(userId: string): Promise<void>;
}

/** `%` and `_` typed into a search mean themselves. */
const likePattern = (query: string) => `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

type UserRow = typeof users.$inferSelect;

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  name: row.name,
  avatar: (AVATARS as readonly string[]).includes(row.avatar) ? (row.avatar as Avatar) : 'boy',
  frame: (FRAMES as readonly string[]).includes(row.frame) ? (row.frame as Frame) : DEFAULT_FRAME,
  cardBack: (CARD_BACKS as readonly string[]).includes(row.cardBack)
    ? row.cardBack
    : DEFAULT_CARD_BACK,
});

export class PgAccountsStore implements AccountsStore {
  constructor(private readonly db: Db) {}

  async createUser(user: NewUser) {
    const [row] = await this.db
      .insert(users)
      .values(user)
      .onConflictDoNothing({ target: users.username })
      .returning();
    return row ? toUser(row) : null;
  }

  async findLogin(username: string) {
    const [row] = await this.db.select().from(users).where(eq(users.username, username));
    return row ? { user: toUser(row), passwordHash: row.passwordHash } : null;
  }

  async createSession(tokenHash: string, userId: string) {
    await this.db.insert(sessions).values({ tokenHash, userId });
  }

  async userBySession(tokenHash: string) {
    const [row] = await this.db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.tokenHash, tokenHash));
    return row ? toUser(row.user) : null;
  }

  async deleteSession(tokenHash: string) {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async updateProfile(userId: string, profile: ProfileChange) {
    const [row] = await this.db.update(users).set(profile).where(eq(users.id, userId)).returning();
    return row ? toUser(row) : null;
  }

  async userById(userId: string) {
    const [row] = await this.db.select().from(users).where(eq(users.id, userId));
    return row ? toUser(row) : null;
  }

  async setLooks(userId: string, looks: Looks) {
    if (!looks.avatar && !looks.frame && !looks.cardBack) return this.userById(userId);
    const [row] = await this.db.update(users).set(looks).where(eq(users.id, userId)).returning();
    return row ? toUser(row) : null;
  }

  async listUsers(query: string, limit: number, offset: number) {
    const where = query
      ? or(ilike(users.username, likePattern(query)), ilike(users.name, likePattern(query)))
      : undefined;
    const rows = await this.db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    const [total] = await this.db.select({ n: count() }).from(users).where(where);
    return {
      users: rows.map((row) => ({ ...toUser(row), createdAt: row.createdAt.toISOString() })),
      total: total?.n ?? 0,
    };
  }

  async updateAccount(userId: string, change: AccountChange) {
    if (!change.name && !change.passwordHash) return this.userById(userId);
    const [row] = await this.db.update(users).set(change).where(eq(users.id, userId)).returning();
    return row ? toUser(row) : null;
  }

  async deleteUser(userId: string) {
    const rows = await this.db
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return rows.length > 0;
  }

  async deleteSessionsOf(userId: string) {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

/** Used by tests and when the server runs without a database (accounts vanish on restart). */
export class MemoryAccountsStore implements AccountsStore {
  private readonly users = new Map<
    string,
    { user: User; passwordHash: string; createdAt: string }
  >();
  private readonly sessions = new Map<string, string>();

  async createUser({ passwordHash, ...rest }: NewUser) {
    if ([...this.users.values()].some((u) => u.user.username === rest.username)) return null;
    const user: User = { id: crypto.randomUUID(), cardBack: DEFAULT_CARD_BACK, ...rest };
    this.users.set(user.id, { user, passwordHash, createdAt: new Date().toISOString() });
    return { ...user };
  }

  async findLogin(username: string) {
    const found = [...this.users.values()].find((u) => u.user.username === username);
    return found ? { user: { ...found.user }, passwordHash: found.passwordHash } : null;
  }

  async createSession(tokenHash: string, userId: string) {
    this.sessions.set(tokenHash, userId);
  }

  async userBySession(tokenHash: string) {
    const userId = this.sessions.get(tokenHash);
    const found = userId ? this.users.get(userId) : undefined;
    return found ? { ...found.user } : null;
  }

  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async updateProfile(userId: string, profile: ProfileChange) {
    const found = this.users.get(userId);
    if (!found) return null;
    const { frame, ...rest } = profile;
    Object.assign(found.user, rest, frame && { frame });
    return { ...found.user };
  }

  async userById(userId: string) {
    const found = this.users.get(userId);
    return found ? { ...found.user } : null;
  }

  async setLooks(userId: string, { avatar, frame, cardBack }: Looks) {
    const found = this.users.get(userId);
    if (!found) return null;
    Object.assign(found.user, avatar && { avatar }, frame && { frame }, cardBack && { cardBack });
    return { ...found.user };
  }

  async listUsers(query: string, limit: number, offset: number) {
    const q = query.toLowerCase();
    const found = [...this.users.values()]
      .filter(
        ({ user }) =>
          !q || user.username.toLowerCase().includes(q) || user.name.toLowerCase().includes(q),
      )
      .reverse();
    return {
      users: found
        .slice(offset, offset + limit)
        .map(({ user, createdAt }) => ({ ...user, createdAt })),
      total: found.length,
    };
  }

  async updateAccount(userId: string, { name, passwordHash }: AccountChange) {
    const found = this.users.get(userId);
    if (!found) return null;
    if (name) found.user.name = name;
    if (passwordHash) found.passwordHash = passwordHash;
    return { ...found.user };
  }

  async deleteUser(userId: string) {
    await this.deleteSessionsOf(userId);
    return this.users.delete(userId);
  }

  async deleteSessionsOf(userId: string) {
    for (const [hash, owner] of this.sessions) if (owner === userId) this.sessions.delete(hash);
  }
}
