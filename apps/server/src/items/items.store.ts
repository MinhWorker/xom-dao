import { type ItemDef, type ItemSlot, SEED_ITEMS } from '@xomdao/shared';
import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { items } from '../db/schema.js';

/** What may change on a stored item (its id never does). */
export type ItemChange = Partial<Omit<ItemDef, 'id'>>;

/** Where the item list lives: Postgres in real use, memory when there is no DATABASE_URL. */
export interface ItemsStore {
  /** Every item, in shop order (`position`, then creation). */
  all(): Promise<ItemDef[]>;
  /** Adds an item at the end; `false` when its id or its slot + look is taken. */
  create(item: ItemDef): Promise<boolean>;
  /** `null` when there is no such item; throws `ItemConflict` when the slot + look is taken. */
  update(id: string, change: ItemChange): Promise<ItemDef | null>;
  /** Whether an item was removed. */
  remove(id: string): Promise<boolean>;
}

/** Another item already gives that look in that slot. */
export class ItemConflict extends Error {}

type ItemRow = typeof items.$inferSelect;
const toItem = (row: ItemRow): ItemDef => ({
  id: row.id,
  slot: row.slot as ItemSlot,
  look: row.look,
  name: row.name,
  price: row.price,
});

/** Postgres error code for a unique constraint. */
const UNIQUE_VIOLATION = '23505';
const isUniqueViolation = (err: unknown) =>
  (err as { code?: string; cause?: { code?: string } })?.code === UNIQUE_VIOLATION ||
  (err as { cause?: { code?: string } })?.cause?.code === UNIQUE_VIOLATION;

export class PgItemsStore implements ItemsStore {
  constructor(private readonly db: Db) {}

  async all() {
    const rows = await this.db
      .select()
      .from(items)
      .orderBy(asc(items.position), asc(items.createdAt));
    return rows.map(toItem);
  }

  async create(item: ItemDef) {
    try {
      const rows = await this.db
        .insert(items)
        .values({
          ...item,
          position: sql`(select coalesce(max(${items.position}), -1) + 1 from ${items})`,
        })
        .onConflictDoNothing()
        .returning({ id: items.id });
      return rows.length > 0;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }

  async update(id: string, change: ItemChange) {
    if (!Object.keys(change).length) {
      const [row] = await this.db.select().from(items).where(eq(items.id, id));
      return row ? toItem(row) : null;
    }
    try {
      const [row] = await this.db.update(items).set(change).where(eq(items.id, id)).returning();
      return row ? toItem(row) : null;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ItemConflict();
      throw err;
    }
  }

  async remove(id: string) {
    const rows = await this.db.delete(items).where(eq(items.id, id)).returning({ id: items.id });
    return rows.length > 0;
  }
}

/** Used by tests and when the server runs without a database (starts as `SEED_ITEMS`). */
export class MemoryItemsStore implements ItemsStore {
  private readonly list: ItemDef[];

  constructor(seed: readonly ItemDef[] = SEED_ITEMS) {
    this.list = seed.map((item) => ({ ...item }));
  }

  async all() {
    return this.list.map((item) => ({ ...item }));
  }

  async create(item: ItemDef) {
    if (this.list.some((i) => i.id === item.id || (i.slot === item.slot && i.look === item.look)))
      return false;
    this.list.push({ ...item });
    return true;
  }

  async update(id: string, change: ItemChange) {
    const item = this.list.find((i) => i.id === id);
    if (!item) return null;
    const next = { ...item, ...change };
    if (this.list.some((i) => i.id !== id && i.slot === next.slot && i.look === next.look))
      throw new ItemConflict();
    Object.assign(item, change);
    return { ...item };
  }

  async remove(id: string) {
    const at = this.list.findIndex((i) => i.id === id);
    if (at < 0) return false;
    this.list.splice(at, 1);
    return true;
  }
}
