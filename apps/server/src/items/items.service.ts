import { Inject, Injectable } from '@nestjs/common';
import {
  firstIssue,
  ITEM_LOOKS,
  type ItemDef,
  type ItemSlot,
  itemChangeSchema,
  itemSchema,
} from '@xomdao/shared';
import { ItemConflict, type ItemsStore } from './items.store.js';

export const ITEMS_STORE = Symbol('ITEMS_STORE');

/** A console edit that was refused; the message is shown as it is. */
export class ItemError extends Error {}

/**
 * Vật phẩm (docs/adr/0002-modules.md): the list of things a player can own and buy at Chợ. It
 * owns the `items` table; Túi đồ and Chợ read it through this service, and the console edits it.
 * The list is small and only this server writes it, so it is kept in memory after the first read.
 */
@Injectable()
export class ItemsService {
  private cache?: Promise<ItemDef[]>;

  constructor(@Inject(ITEMS_STORE) private readonly store: ItemsStore) {}

  /** Every item, in shop order. */
  async list(): Promise<ItemDef[]> {
    this.cache ??= this.store.all().catch((err) => {
      this.cache = undefined;
      throw err;
    });
    return [...(await this.cache)];
  }

  async get(id: string) {
    return (await this.list()).find((item) => item.id === id);
  }

  /** The item that gives this look in this slot. */
  async forLook(slot: ItemSlot, look: string) {
    return (await this.list()).find((item) => item.slot === slot && item.look === look);
  }

  async create(input: unknown): Promise<ItemDef> {
    const parsed = itemSchema.safeParse(input);
    if (!parsed.success) throw new ItemError(firstIssue(parsed.error));
    const item = parsed.data;
    if (!(await this.store.create(item))) {
      throw new ItemError(
        (await this.get(item.id)) ? 'Mã món này đã có' : 'Đã có món khác dùng hình này',
      );
    }
    this.cache = undefined;
    return item;
  }

  async update(id: string, input: unknown): Promise<ItemDef> {
    const parsed = itemChangeSchema.safeParse(input);
    if (!parsed.success) throw new ItemError(firstIssue(parsed.error));
    const current = await this.get(id);
    if (!current) throw new ItemError('Không có món này');
    const change = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined),
    );
    const next = { ...current, ...change };
    if (!ITEM_LOOKS[next.slot].includes(next.look)) {
      throw new ItemError('Hình này không có cho loại món đã chọn');
    }
    try {
      const item = await this.store.update(id, change);
      if (!item) throw new ItemError('Không có món này');
      return item;
    } catch (err) {
      if (err instanceof ItemConflict) throw new ItemError('Đã có món khác dùng hình này');
      throw err;
    } finally {
      this.cache = undefined;
    }
  }

  /**
   * Takes an item off the list. Accounts that bought it keep their row in Túi đồ but no longer see
   * it; what they wear stays on their account until they change it.
   */
  async remove(id: string) {
    if (!(await this.store.remove(id))) throw new ItemError('Không có món này');
    this.cache = undefined;
  }
}
