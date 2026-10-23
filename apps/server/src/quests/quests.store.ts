import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { questProgress } from '../db/schema.js';

/** An account's progress with one quest on one day. */
export interface QuestRow {
  questId: string;
  count: number;
  claimed: boolean;
}

/** Where Nhiệm vụ lives: Postgres in real use, memory when there is no DATABASE_URL. */
export interface QuestsStore {
  /** The account's rows for a day. */
  rows(userId: string, day: string): Promise<QuestRow[]>;
  /** Adds `amount` to a quest's count, never past `cap`. */
  add(userId: string, day: string, questId: string, amount: number, cap: number): Promise<void>;
  /** Marks a quest claimed; false when it already was. */
  claim(userId: string, day: string, questId: string): Promise<boolean>;
}

export class PgQuestsStore implements QuestsStore {
  constructor(private readonly db: Db) {}

  async rows(userId: string, day: string) {
    return this.db
      .select({
        questId: questProgress.questId,
        count: questProgress.count,
        claimed: questProgress.claimed,
      })
      .from(questProgress)
      .where(and(eq(questProgress.userId, userId), eq(questProgress.day, day)));
  }

  async add(userId: string, day: string, questId: string, amount: number, cap: number) {
    await this.db
      .insert(questProgress)
      .values({ userId, day, questId, count: Math.min(amount, cap) })
      .onConflictDoUpdate({
        target: [questProgress.userId, questProgress.day, questProgress.questId],
        set: { count: sql`least(${questProgress.count} + ${amount}, ${cap})` },
      });
  }

  async claim(userId: string, day: string, questId: string) {
    const inserted = await this.db
      .insert(questProgress)
      .values({ userId, day, questId, count: 0, claimed: true })
      .onConflictDoUpdate({
        target: [questProgress.userId, questProgress.day, questProgress.questId],
        set: { claimed: true },
        setWhere: eq(questProgress.claimed, false),
      })
      .returning({ claimed: questProgress.claimed });
    return inserted.length > 0;
  }
}

/** Used by tests and when the server runs without a database (it all vanishes on restart). */
export class MemoryQuestsStore implements QuestsStore {
  private readonly data = new Map<string, QuestRow>();

  private key(userId: string, day: string, questId: string) {
    return `${userId}|${day}|${questId}`;
  }

  async rows(userId: string, day: string) {
    const prefix = `${userId}|${day}|`;
    return [...this.data.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, row]) => ({ ...row }));
  }

  async add(userId: string, day: string, questId: string, amount: number, cap: number) {
    const key = this.key(userId, day, questId);
    const row = this.data.get(key) ?? { questId, count: 0, claimed: false };
    row.count = Math.min(row.count + amount, cap);
    this.data.set(key, row);
  }

  async claim(userId: string, day: string, questId: string) {
    const key = this.key(userId, day, questId);
    const row = this.data.get(key) ?? { questId, count: 0, claimed: false };
    if (row.claimed) return false;
    row.claimed = true;
    this.data.set(key, row);
    return true;
  }
}
