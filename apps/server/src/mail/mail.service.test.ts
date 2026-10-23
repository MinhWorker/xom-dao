import { COIN, MAIL_TITLE_MAX } from '@xomdao/shared';
import { describe, expect, it } from 'vitest';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore } from '../accounts/accounts.store.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MemoryLedgerStore } from '../ledger/ledger.store.js';
import { MailService } from './mail.service.js';
import { MemoryMailStore } from './mail.store.js';

async function setup() {
  const accounts = new AccountsService(new MemoryAccountsStore());
  const ledger = new LedgerService(new MemoryLedgerStore());
  const mail = new MailService(new MemoryMailStore(), ledger, accounts);
  const make = async (username: string) =>
    (await accounts.register({ username, password: 'secret1', name: username, avatar: 'boy' }))
      .user;
  return { mail, ledger, minh: await make('minh'), lan: await make('lan') };
}

describe('Hộp thư', () => {
  it('delivers a letter to one account, and one to everyone', async () => {
    const { mail, minh, lan } = await setup();
    const sent: (string | null)[] = [];
    mail.onSent((to) => sent.push(to));
    await mail.send({ to: ' MINH ', title: 'Chào Minh', body: 'Riêng bạn' });
    await mail.send({ title: 'Chào cả xóm', body: 'Mọi người', coins: 50 });
    expect(sent).toEqual([minh.id, null]);
    const mine = await mail.mailbox(minh.id);
    expect(mine.letters.map((l) => l.title)).toEqual(['Chào cả xóm', 'Chào Minh']);
    expect(mine.waiting).toBe(2);
    expect((await mail.mailbox(lan.id)).letters.map((l) => l.title)).toEqual(['Chào cả xóm']);
    expect((await mail.sent()).map((l) => l.to)).toEqual(['', 'minh']);
  });

  it('reads a letter and pays its coins once', async () => {
    const { mail, ledger, minh, lan } = await setup();
    const letter = await mail.send({ title: 'Quà', body: 'Xu cho cả xóm', coins: 50 });
    const read = await mail.read(minh.id, letter.id);
    expect(read.letters[0]).toMatchObject({ read: true, claimed: false });
    expect(read.waiting).toBe(1);
    const paid = await mail.claim(minh.id, letter.id);
    expect(paid.balances[COIN]).toBe(50);
    expect(paid.mailbox.waiting).toBe(0);
    await expect(mail.claim(minh.id, letter.id)).rejects.toThrow('Bạn đã nhận rồi');
    // Everyone takes their own share of a letter to everyone.
    await mail.claim(lan.id, letter.id);
    expect((await ledger.balances(lan.id))[COIN]).toBe(50);
  });

  it('refuses what cannot be sent or taken', async () => {
    const { mail, minh, lan } = await setup();
    await expect(mail.send({ to: 'ai', title: 'A', body: 'B' })).rejects.toThrow(
      'Không có ai tên đăng nhập này',
    );
    await expect(mail.send({ title: 'x'.repeat(MAIL_TITLE_MAX + 1), body: 'B' })).rejects.toThrow(
      'Tiêu đề tối đa',
    );
    await expect(mail.send({ title: 'A', body: 'B', coins: -1 })).rejects.toThrow('không được âm');
    const plain = await mail.send({ to: 'minh', title: 'A', body: 'B' });
    await expect(mail.claim(minh.id, plain.id)).rejects.toThrow('Thư này không có quà');
    // Someone else's letter is not there for them.
    await expect(mail.read(lan.id, plain.id)).rejects.toThrow('Không tìm thấy thư');
    await mail.remove(plain.id);
    expect((await mail.mailbox(minh.id)).letters).toEqual([]);
    await expect(mail.remove(plain.id)).rejects.toThrow('Không tìm thấy thư');
  });
});
