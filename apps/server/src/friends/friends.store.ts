import type { ChatMessage } from '@xomdao/shared';
import { and, count, desc, eq, isNull, or } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { friendMessages, friendships } from '../db/schema.js';

/** A pair of accounts: `requesterId` asked `addresseeId`; a request until `acceptedAt`. */
export interface Friendship {
  requesterId: string;
  addresseeId: string;
  createdAt: number;
  acceptedAt: number | null;
}

/** Where Bạn bè lives: Postgres in real use, memory when there is no DATABASE_URL. */
export interface FriendsStore {
  /** Every pair the account is in, either way round. */
  pairsOf(userId: string): Promise<Friendship[]>;
  /** The pair of two accounts, either way round, or `null`. */
  pair(a: string, b: string): Promise<Friendship | null>;
  request(from: string, to: string): Promise<void>;
  /** Accepts `requester`'s request to `addressee`; whether there was one. */
  accept(requester: string, addressee: string): Promise<boolean>;
  /** Removes the pair, either way round. */
  remove(a: string, b: string): Promise<void>;
  addMessage(from: string, to: string, text: string): Promise<ChatMessage>;
  /** The newest `limit` messages between two accounts, oldest first. */
  messages(a: string, b: string, limit: number): Promise<ChatMessage[]>;
  /** Marks everything `from` sent `to` as read. */
  markRead(from: string, to: string): Promise<void>;
  /** How many unread messages the account has, by sender. */
  unread(userId: string): Promise<Map<string, number>>;
}

const toMessage = (row: typeof friendMessages.$inferSelect): ChatMessage => ({
  id: row.id,
  from: row.fromId,
  to: row.toId,
  text: row.text,
  at: row.sentAt.getTime(),
});

const toFriendship = (row: typeof friendships.$inferSelect): Friendship => ({
  requesterId: row.requesterId,
  addresseeId: row.addresseeId,
  createdAt: row.createdAt.getTime(),
  acceptedAt: row.acceptedAt?.getTime() ?? null,
});

const either = (a: string, b: string) =>
  or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  );

export class PgFriendsStore implements FriendsStore {
  constructor(private readonly db: Db) {}

  async pairsOf(userId: string) {
    const rows = await this.db
      .select()
      .from(friendships)
      .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
    return rows.map(toFriendship);
  }

  async pair(a: string, b: string) {
    const [row] = await this.db.select().from(friendships).where(either(a, b)).limit(1);
    return row ? toFriendship(row) : null;
  }

  async request(from: string, to: string) {
    await this.db
      .insert(friendships)
      .values({ requesterId: from, addresseeId: to })
      .onConflictDoNothing();
  }

  async accept(requester: string, addressee: string) {
    const rows = await this.db
      .update(friendships)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          eq(friendships.requesterId, requester),
          eq(friendships.addresseeId, addressee),
          isNull(friendships.acceptedAt),
        ),
      )
      .returning({ requesterId: friendships.requesterId });
    return rows.length > 0;
  }

  async remove(a: string, b: string) {
    await this.db.delete(friendships).where(either(a, b));
  }

  async addMessage(from: string, to: string, text: string) {
    const [row] = await this.db
      .insert(friendMessages)
      .values({ fromId: from, toId: to, text })
      .returning();
    if (!row) throw new Error('Could not save a message');
    return toMessage(row);
  }

  async messages(a: string, b: string, limit: number) {
    const rows = await this.db
      .select()
      .from(friendMessages)
      .where(
        or(
          and(eq(friendMessages.fromId, a), eq(friendMessages.toId, b)),
          and(eq(friendMessages.fromId, b), eq(friendMessages.toId, a)),
        ),
      )
      .orderBy(desc(friendMessages.sentAt))
      .limit(limit);
    return rows.reverse().map(toMessage);
  }

  async markRead(from: string, to: string) {
    await this.db
      .update(friendMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(friendMessages.fromId, from),
          eq(friendMessages.toId, to),
          isNull(friendMessages.readAt),
        ),
      );
  }

  async unread(userId: string) {
    const rows = await this.db
      .select({ from: friendMessages.fromId, n: count() })
      .from(friendMessages)
      .where(and(eq(friendMessages.toId, userId), isNull(friendMessages.readAt)))
      .groupBy(friendMessages.fromId);
    return new Map(rows.map((r) => [r.from, Number(r.n)]));
  }
}

/** Used by tests and when the server runs without a database (it all vanishes on restart). */
export class MemoryFriendsStore implements FriendsStore {
  private readonly pairs: Friendship[] = [];
  private readonly chat: (ChatMessage & { read: boolean })[] = [];
  private clock = 0;

  async pairsOf(userId: string) {
    return this.pairs
      .filter((p) => p.requesterId === userId || p.addresseeId === userId)
      .map((p) => ({ ...p }));
  }

  async pair(a: string, b: string) {
    const found = this.pairs.find(
      (p) =>
        (p.requesterId === a && p.addresseeId === b) ||
        (p.requesterId === b && p.addresseeId === a),
    );
    return found ? { ...found } : null;
  }

  async request(from: string, to: string) {
    if (await this.pair(from, to)) return;
    this.pairs.push({
      requesterId: from,
      addresseeId: to,
      createdAt: Date.now(),
      acceptedAt: null,
    });
  }

  async accept(requester: string, addressee: string) {
    const found = this.pairs.find(
      (p) => p.requesterId === requester && p.addresseeId === addressee && p.acceptedAt === null,
    );
    if (found) found.acceptedAt = Date.now();
    return found !== undefined;
  }

  async remove(a: string, b: string) {
    for (let i = this.pairs.length - 1; i >= 0; i--) {
      const p = this.pairs[i] as Friendship;
      if (
        (p.requesterId === a && p.addresseeId === b) ||
        (p.requesterId === b && p.addresseeId === a)
      )
        this.pairs.splice(i, 1);
    }
  }

  async addMessage(from: string, to: string, text: string) {
    // Strictly increasing times, so messages sent in the same millisecond keep their order.
    this.clock = Math.max(Date.now(), this.clock + 1);
    const message = { id: crypto.randomUUID(), from, to, text, at: this.clock };
    this.chat.push({ ...message, read: false });
    return message;
  }

  async messages(a: string, b: string, limit: number) {
    return this.chat
      .filter((m) => (m.from === a && m.to === b) || (m.from === b && m.to === a))
      .slice(-limit)
      .map(({ read: _read, ...m }) => m);
  }

  async markRead(from: string, to: string) {
    for (const m of this.chat) if (m.from === from && m.to === to) m.read = true;
  }

  async unread(userId: string) {
    const out = new Map<string, number>();
    for (const m of this.chat)
      if (m.to === userId && !m.read) out.set(m.from, (out.get(m.from) ?? 0) + 1);
    return out;
  }
}
