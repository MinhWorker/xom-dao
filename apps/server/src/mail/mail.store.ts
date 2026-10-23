import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { letterReceipts, letters } from '../db/schema.js';

/** A letter as sent: `userId` null is to everyone. */
export interface LetterRow {
  id: string;
  userId: string | null;
  title: string;
  body: string;
  coins: number;
  sentAt: Date;
}

/** A letter as one account sees it. */
export interface InboxRow extends LetterRow {
  read: boolean;
  claimed: boolean;
}

export type NewLetter = Omit<LetterRow, 'id' | 'sentAt'>;

/** Where Hộp thư lives: Postgres in real use, memory when there is no DATABASE_URL. */
export interface MailStore {
  send(letter: NewLetter): Promise<LetterRow>;
  /** The account's newest letters (to it or to everyone), newest first. */
  inbox(userId: string, limit: number): Promise<InboxRow[]>;
  /** The newest letters sent, newest first. */
  sent(limit: number): Promise<LetterRow[]>;
  /** Removes a letter (and who read it); false when there was none. */
  remove(id: string): Promise<boolean>;
  markRead(userId: string, letterId: string): Promise<void>;
  /** Marks the coins taken; false when they already were. */
  claim(userId: string, letterId: string): Promise<boolean>;
}

const letterColumns = {
  id: letters.id,
  userId: letters.userId,
  title: letters.title,
  body: letters.body,
  coins: letters.coins,
  sentAt: letters.sentAt,
};

export class PgMailStore implements MailStore {
  constructor(private readonly db: Db) {}

  async send(letter: NewLetter) {
    const [row] = await this.db.insert(letters).values(letter).returning(letterColumns);
    if (!row) throw new Error('Could not save a letter');
    return row;
  }

  async inbox(userId: string, limit: number) {
    const rows = await this.db
      .select({
        ...letterColumns,
        readAt: letterReceipts.readAt,
        claimed: letterReceipts.claimed,
      })
      .from(letters)
      .leftJoin(
        letterReceipts,
        and(eq(letterReceipts.letterId, letters.id), eq(letterReceipts.userId, userId)),
      )
      .where(or(eq(letters.userId, userId), isNull(letters.userId)))
      .orderBy(desc(letters.sentAt))
      .limit(limit);
    return rows.map(({ readAt, claimed, ...row }) => ({
      ...row,
      read: readAt !== null,
      claimed: claimed ?? false,
    }));
  }

  async sent(limit: number) {
    return this.db.select(letterColumns).from(letters).orderBy(desc(letters.sentAt)).limit(limit);
  }

  async remove(id: string) {
    const gone = await this.db
      .delete(letters)
      .where(eq(letters.id, id))
      .returning({ id: letters.id });
    return gone.length > 0;
  }

  async markRead(userId: string, letterId: string) {
    await this.db
      .insert(letterReceipts)
      .values({ letterId, userId, readAt: new Date() })
      .onConflictDoUpdate({
        target: [letterReceipts.letterId, letterReceipts.userId],
        set: { readAt: sql`coalesce(${letterReceipts.readAt}, now())` },
      });
  }

  async claim(userId: string, letterId: string) {
    const won = await this.db
      .insert(letterReceipts)
      .values({ letterId, userId, readAt: new Date(), claimed: true })
      .onConflictDoUpdate({
        target: [letterReceipts.letterId, letterReceipts.userId],
        set: { claimed: true, readAt: sql`coalesce(${letterReceipts.readAt}, now())` },
        setWhere: eq(letterReceipts.claimed, false),
      })
      .returning({ claimed: letterReceipts.claimed });
    return won.length > 0;
  }
}

/** Used by tests and when the server runs without a database (it all vanishes on restart). */
export class MemoryMailStore implements MailStore {
  private readonly letters: LetterRow[] = [];
  private readonly receipts = new Map<string, { read: boolean; claimed: boolean }>();
  private key(userId: string, letterId: string) {
    return `${letterId}|${userId}`;
  }

  async send(letter: NewLetter) {
    // Strictly increasing times keep "newest first" stable within one millisecond.
    const last = this.letters.at(-1)?.sentAt.getTime() ?? 0;
    const row = { ...letter, id: randomUUID(), sentAt: new Date(Math.max(Date.now(), last + 1)) };
    this.letters.push(row);
    return { ...row };
  }

  async inbox(userId: string, limit: number) {
    return this.letters
      .filter((l) => l.userId === userId || l.userId === null)
      .reverse()
      .slice(0, limit)
      .map((l) => {
        const receipt = this.receipts.get(this.key(userId, l.id));
        return { ...l, read: receipt?.read ?? false, claimed: receipt?.claimed ?? false };
      });
  }

  async sent(limit: number) {
    return [...this.letters]
      .reverse()
      .slice(0, limit)
      .map((l) => ({ ...l }));
  }

  async remove(id: string) {
    const at = this.letters.findIndex((l) => l.id === id);
    if (at < 0) return false;
    this.letters.splice(at, 1);
    for (const key of this.receipts.keys()) if (key.startsWith(`${id}|`)) this.receipts.delete(key);
    return true;
  }

  async markRead(userId: string, letterId: string) {
    const key = this.key(userId, letterId);
    this.receipts.set(key, { claimed: false, ...this.receipts.get(key), read: true });
  }

  async claim(userId: string, letterId: string) {
    const key = this.key(userId, letterId);
    if (this.receipts.get(key)?.claimed) return false;
    this.receipts.set(key, { read: true, claimed: true });
    return true;
  }
}
