import { Inject, Injectable } from '@nestjs/common';
import {
  type Avatar,
  type Frame,
  getItem,
  ITEMS,
  type ItemSlot,
  itemFor,
  type Profile,
  type User,
} from '@xomdao/shared';
import { AccountsService } from '../accounts/accounts.service.js';
import type { InventoryStore } from './inventory.store.js';

export const INVENTORY_STORE = Symbol('INVENTORY_STORE');

export class InventoryError extends Error {}

/**
 * Túi đồ (docs/adr/0002-modules.md): which items each account owns (`ITEMS` in @xomdao/shared)
 * and wearing them. It owns `inventory_items`; how a player shows (their avatar, frame and card back)
 * stays on the account, set through `AccountsService.setLooks`. Chợ adds what was paid for with
 * `grant`.
 */
@Injectable()
export class InventoryService {
  constructor(
    @Inject(INVENTORY_STORE) private readonly store: InventoryStore,
    private readonly accounts: AccountsService,
  ) {}

  /** Every item the account has, free ones included, in `ITEMS` order. */
  async owned(userId: string): Promise<string[]> {
    const stored = new Set(await this.store.items(userId));
    const user = await this.accounts.userById(userId);
    // Preserve an avatar selected before avatar pictures became shop items.
    const equippedAvatar = user && itemFor('avatar', user.avatar);
    if (equippedAvatar && equippedAvatar.price > 0) {
      await this.store.grant(userId, equippedAvatar.id);
      stored.add(equippedAvatar.id);
    }
    return ITEMS.filter((item) => item.price === 0 || stored.has(item.id)).map((item) => item.id);
  }

  async owns(userId: string, itemId: string) {
    const item = getItem(itemId);
    if (!item) return false;
    return item.price === 0 || (await this.owned(userId)).includes(itemId);
  }

  /** Puts an item in the account's Túi đồ (once; granting it again changes nothing). */
  grant(userId: string, itemId: string) {
    if (!getItem(itemId)) throw new InventoryError('Không có món này');
    return this.store.grant(userId, itemId);
  }

  /** Whether the account may wear a look (it owns the item that gives it). */
  async ownsLook(userId: string, slot: ItemSlot, look: string) {
    const item = itemFor(slot, look);
    return item ? this.owns(userId, item.id) : false;
  }

  /** Wears an owned item; returns the account as it now shows. */
  async equip(userId: string, itemId: string): Promise<User> {
    const item = getItem(itemId);
    if (!item) throw new InventoryError('Không có món này');
    if (!(await this.owns(userId, itemId))) throw new InventoryError('Bạn chưa có món này');
    switch (item.slot) {
      case 'avatar':
        return this.accounts.setLooks(userId, { avatar: item.look as Avatar });
      case 'frame':
        return this.accounts.setLooks(userId, { frame: item.look as Frame });
      case 'card-back':
        return this.accounts.setLooks(userId, { cardBack: item.look });
      case 'emote':
        throw new InventoryError('Biểu cảm không thể trang bị');
    }
  }

  /** Someone's Nhà: who they are, what they wear and own. */
  async profile(userId: string): Promise<Profile> {
    const user = await this.accounts.userById(userId);
    if (!user) throw new InventoryError('Không tìm thấy người chơi');
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      frame: user.frame,
      cardBack: user.cardBack ?? 'lattice',
      owned: await this.owned(userId),
    };
  }
}
