import { COIN } from '@xomdao/shared';
import { describe, expect, it } from 'vitest';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore } from '../accounts/accounts.store.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { MemoryInventoryStore } from '../inventory/inventory.store.js';
import { ItemsService } from '../items/items.service.js';
import { MemoryItemsStore } from '../items/items.store.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MemoryLedgerStore } from '../ledger/ledger.store.js';
import { ShopService } from './shop.service.js';

async function setup(coins: number) {
  const accounts = new AccountsService(new MemoryAccountsStore());
  const ledger = new LedgerService(new MemoryLedgerStore());
  const items = new ItemsService(new MemoryItemsStore());
  const inventory = new InventoryService(new MemoryInventoryStore(), accounts, items);
  const shop = new ShopService(ledger, inventory, items);
  const { user } = await accounts.guest('Minh');
  if (coins)
    await ledger.apply({
      userId: user.id,
      resource: COIN,
      amount: coins,
      reason: 'test',
      key: 'seed',
    });
  return { accounts, ledger, inventory, shop, user };
}

describe('Chợ and Túi đồ', () => {
  it('sells a frame for coins, and it can be worn', async () => {
    const { ledger, inventory, shop, user } = await setup(500);
    expect((await shop.list(user.id)).find((i) => i.id === 'core:frame-jade')).toMatchObject({
      price: 180,
      owned: false,
    });
    const { item, balances } = await shop.buy(user.id, 'core:frame-jade');
    expect(item.owned).toBe(true);
    expect(balances[COIN]).toBe(320);
    expect(await ledger.balances(user.id)).toEqual({ [COIN]: 320 });
    const worn = await inventory.equip(user.id, 'core:frame-jade');
    expect(worn.frame).toBe('jade');
    expect((await inventory.profile(user.id)).owned).toContain('core:frame-jade');
  });

  it('sells old Phaser avatars as shop items and equips them', async () => {
    const { accounts, ledger, inventory, shop, user } = await setup(500);
    const stock = (await shop.list(user.id)).find((item) => item.id === 'core:avatar-fox');
    expect(stock).toMatchObject({ slot: 'avatar', look: 'fox', price: 150, owned: false });
    const { item, balances } = await shop.buy(user.id, 'core:avatar-fox');
    expect(item.owned).toBe(true);
    expect(balances[COIN]).toBe(350);
    expect((await inventory.equip(user.id, item.id)).avatar).toBe('fox');

    // The selected avatar remains available after equipping a different one.
    await inventory.equip(user.id, 'core:avatar-cat');
    expect((await inventory.equip(user.id, 'core:avatar-fox')).avatar).toBe('fox');
    expect((await inventory.profile(user.id)).owned).toContain('core:avatar-fox');
    expect(await ledger.balances(user.id)).toEqual({ [COIN]: 350 });
    expect(await accounts.userById(user.id)).toMatchObject({ avatar: 'fox' });
  });

  it('keeps a previously equipped avatar when avatars become shop items', async () => {
    const { accounts, inventory, shop, user } = await setup(0);
    await accounts.updateProfile(user.id, { name: user.name, avatar: 'unicorn' });
    const profile = await inventory.profile(user.id);
    expect(profile.owned).toContain('core:avatar-unicorn');
    await accounts.updateProfile(user.id, { name: user.name, avatar: 'boy' });
    expect((await inventory.equip(user.id, 'core:avatar-unicorn')).avatar).toBe('unicorn');
    expect(
      (await shop.list(user.id)).find((item) => item.id === 'core:avatar-unicorn')?.owned,
    ).toBe(true);
  });

  it('sells emote items but does not equip them', async () => {
    const { inventory, shop, user, ledger } = await setup(100);
    expect(await inventory.owns(user.id, 'core:emote-happy')).toBe(true);
    expect((await shop.list(user.id)).find((item) => item.id === 'core:emote-love')).toMatchObject({
      slot: 'emote',
      look: 'love',
      price: 80,
      owned: false,
    });

    const { item, balances } = await shop.buy(user.id, 'core:emote-love');
    expect(item.owned).toBe(true);
    expect(balances[COIN]).toBe(20);
    expect(await inventory.owns(user.id, item.id)).toBe(true);
    await expect(inventory.equip(user.id, item.id)).rejects.toThrow('Biểu cảm không thể trang bị');
    expect(await ledger.balances(user.id)).toEqual({ [COIN]: 20 });
  });

  it('refuses without enough coins and charges nothing', async () => {
    const { ledger, inventory, shop, user } = await setup(100);
    await expect(shop.buy(user.id, 'core:frame-jade')).rejects.toThrow('Không đủ xu');
    expect(await ledger.balances(user.id)).toEqual({ [COIN]: 100 });
    expect(await inventory.owns(user.id, 'core:frame-jade')).toBe(false);
  });

  it('charges once for two buys at the same time', async () => {
    const { ledger, inventory, shop, user } = await setup(1000);
    const results = await Promise.allSettled([
      shop.buy(user.id, 'core:card-back-lotus'),
      shop.buy(user.id, 'core:card-back-lotus'),
    ]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(await ledger.balances(user.id)).toEqual({ [COIN]: 730 });
    expect(await inventory.owns(user.id, 'core:card-back-lotus')).toBe(true);
    await expect(shop.buy(user.id, 'core:card-back-lotus')).rejects.toThrow('Bạn đã có món này');
  });

  it("only wears what you own; free items are everyone's", async () => {
    const { inventory, user } = await setup(0);
    await expect(inventory.equip(user.id, 'core:frame-rose')).rejects.toThrow(
      'Bạn chưa có món này',
    );
    expect((await inventory.equip(user.id, 'core:frame-silver')).frame).toBe('silver');
    expect((await inventory.equip(user.id, 'core:avatar-girl')).avatar).toBe('girl');
    await expect(inventory.equip(user.id, 'core:avatar-fox')).rejects.toThrow(
      'Bạn chưa có món này',
    );
    await expect(inventory.equip(user.id, 'core:nothing')).rejects.toThrow('Không có món này');
    expect(await inventory.ownsLook(user.id, 'frame', 'bronze')).toBe(true);
    expect(await inventory.ownsLook(user.id, 'frame', 'ruby')).toBe(false);
  });
});
