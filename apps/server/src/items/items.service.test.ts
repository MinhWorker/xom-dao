import { COIN } from '@xomdao/shared';
import { describe, expect, it } from 'vitest';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore } from '../accounts/accounts.store.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { MemoryInventoryStore } from '../inventory/inventory.store.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MemoryLedgerStore } from '../ledger/ledger.store.js';
import { ShopService } from '../shop/shop.service.js';
import { ItemsService } from './items.service.js';
import { MemoryItemsStore } from './items.store.js';

function setup() {
  const accounts = new AccountsService(new MemoryAccountsStore());
  const ledger = new LedgerService(new MemoryLedgerStore());
  const items = new ItemsService(new MemoryItemsStore());
  const inventory = new InventoryService(new MemoryInventoryStore(), accounts, items);
  const shop = new ShopService(ledger, inventory, items);
  return { accounts, ledger, items, inventory, shop };
}

describe('Vật phẩm', () => {
  it('starts with the seed items', async () => {
    const { items } = setup();
    expect(await items.get('core:frame-jade')).toMatchObject({ slot: 'frame', price: 180 });
  });

  it('adds an item that the shop then sells', async () => {
    const { accounts, ledger, items, shop } = setup();
    await items.remove('core:frame-obsidian');
    await items.create({
      id: 'core:frame-obsidian-2',
      slot: 'frame',
      look: 'obsidian',
      name: 'Khung đá đen',
      price: 50,
    });
    const { user } = await accounts.guest('Minh');
    await ledger.apply({ userId: user.id, resource: COIN, amount: 60, reason: 't', key: 'k' });
    const { item, balances } = await shop.buy(user.id, 'core:frame-obsidian-2');
    expect(item).toMatchObject({ name: 'Khung đá đen', owned: true });
    expect(balances[COIN]).toBe(10);
  });

  it('refuses a taken id, a taken look and a look without art', async () => {
    const { items } = setup();
    const jade = { id: 'core:frame-jade', slot: 'frame', look: 'jade', name: 'X', price: 1 };
    await expect(items.create(jade)).rejects.toThrow('Mã món này đã có');
    await expect(items.create({ ...jade, id: 'core:frame-jade-2' })).rejects.toThrow(
      'Đã có món khác dùng hình này',
    );
    await expect(items.create({ ...jade, id: 'core:x', look: 'nope' })).rejects.toThrow(
      'Hình này không có',
    );
    await expect(items.update('core:frame-ruby', { look: 'jade' })).rejects.toThrow(
      'Đã có món khác dùng hình này',
    );
  });

  it('reprices, and a removed item leaves the shop and Túi đồ', async () => {
    const { accounts, inventory, items, shop } = setup();
    const { user } = await accounts.guest('Minh');
    await items.update('core:frame-jade', { price: 0, name: 'Khung ngọc' });
    expect(await inventory.owned(user.id)).toContain('core:frame-jade');
    expect((await shop.list(user.id)).find((i) => i.id === 'core:frame-jade')).toMatchObject({
      name: 'Khung ngọc',
      owned: true,
    });
    await items.remove('core:frame-jade');
    expect(await inventory.owned(user.id)).not.toContain('core:frame-jade');
    await expect(shop.buy(user.id, 'core:frame-jade')).rejects.toThrow('Không có món này');
  });
});
