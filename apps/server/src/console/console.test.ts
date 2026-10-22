import { describe, expect, it } from 'vitest';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore } from '../accounts/accounts.store.js';
import { ConsoleAuthService } from './console-auth.service.js';

describe('Console login', () => {
  it('lets in the right answer, in any case and spacing', () => {
    const auth = new ConsoleAuthService();
    expect(() => auth.login('bất khuất nhé', 'ip')).toThrow('Sai rồi');
    const token = auth.login('  BẤT   Khuất ', 'ip');
    expect(auth.check(token)).toBe(true);
    auth.logout(token);
    expect(auth.check(token)).toBe(false);
  });

  it('stops guessing after five wrong answers, per address', () => {
    const auth = new ConsoleAuthService();
    for (let i = 0; i < 5; i++) expect(() => auth.login('x', 'ip', 0)).toThrow('Sai rồi');
    expect(() => auth.login('Bất Khuất', 'ip', 1000)).toThrow('chờ 10 phút');
    expect(auth.login('Bất Khuất', 'other', 1000)).toBeTruthy();
    expect(auth.login('Bất Khuất', 'ip', 11 * 60 * 1000)).toBeTruthy();
  });

  it('expires tokens', () => {
    const auth = new ConsoleAuthService();
    const token = auth.login('Bất Khuất', 'ip', 0);
    expect(auth.check(token, 13 * 60 * 60 * 1000)).toBe(false);
  });
});

describe('Console accounts', () => {
  it('creates, finds, edits and deletes an account', async () => {
    const accounts = new AccountsService(new MemoryAccountsStore());
    const user = await accounts.createAccount({ username: 'Lan', password: '123456', name: 'Lan' });
    expect(user.username).toBe('lan');
    await expect(
      accounts.createAccount({ username: 'lan', password: '123456', name: 'Khác' }),
    ).rejects.toThrow('đã có người dùng');
    await accounts.createAccount({ username: 'minh', password: '123456', name: 'Minh' });

    expect((await accounts.listAccounts('LA', 1)).users.map((u) => u.username)).toEqual(['lan']);
    expect((await accounts.listAccounts('', 1)).total).toBe(2);

    const { token } = await accounts.login({ username: 'lan', password: '123456' });
    await accounts.updateAccount(user.id, { name: 'Lan Anh', password: 'abcdef' });
    expect(await accounts.authenticate(token)).toBeNull();
    const again = await accounts.login({ username: 'lan', password: 'abcdef' });
    expect(again.user.name).toBe('Lan Anh');

    await accounts.deleteAccount(user.id);
    expect(await accounts.userById(user.id)).toBeNull();
    await expect(accounts.deleteAccount(user.id)).rejects.toThrow('Không tìm thấy tài khoản');
  });
});
