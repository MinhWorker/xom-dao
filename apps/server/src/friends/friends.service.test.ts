import { CHAT_MAX } from '@xomdao/shared';
import { describe, expect, it } from 'vitest';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore } from '../accounts/accounts.store.js';
import { FriendsService, type Presence } from './friends.service.js';
import { MemoryFriendsStore } from './friends.store.js';

async function setup() {
  const accounts = new AccountsService(new MemoryAccountsStore());
  const friends = new FriendsService(new MemoryFriendsStore(), accounts);
  const make = async (username: string, name: string) =>
    (await accounts.register({ username, password: 'secret1', name, avatar: 'boy' })).user;
  const minh = await make('minh', 'Minh');
  const lan = await make('lan', 'Lan');
  const hoa = await make('hoa', 'Hoa');
  return { friends, minh, lan, hoa };
}

const nobody: Presence = () => ({ online: false });

describe('Bạn bè', () => {
  it('asks by username, the other side accepts, and both are friends', async () => {
    const { friends, minh, lan } = await setup();
    expect(await friends.add(minh.id, '  LAN ')).toBe(lan.id);
    expect(await friends.list(minh.id, nobody)).toMatchObject([{ id: lan.id, state: 'outgoing' }]);
    expect(await friends.list(lan.id, nobody)).toMatchObject([{ id: minh.id, state: 'incoming' }]);
    await friends.answer(lan.id, minh.id, true);
    expect(await friends.areFriends(minh.id, lan.id)).toBe(true);
    expect(await friends.friendIds(minh.id)).toEqual([lan.id]);
    await expect(friends.add(minh.id, 'lan')).rejects.toThrow('Hai bạn đã là bạn bè');
  });

  it('asking someone who already asked you makes you friends', async () => {
    const { friends, minh, lan } = await setup();
    await friends.add(lan.id, 'minh');
    await friends.add(minh.id, 'lan');
    expect(await friends.areFriends(minh.id, lan.id)).toBe(true);
  });

  it('refuses unknown names, yourself, a second request and a stale answer', async () => {
    const { friends, minh, lan } = await setup();
    await expect(friends.add(minh.id, 'ai-day')).rejects.toThrow('Không tìm thấy');
    await expect(friends.add(minh.id, 'minh')).rejects.toThrow('của bạn');
    await friends.add(minh.id, 'lan');
    await expect(friends.add(minh.id, 'lan')).rejects.toThrow('đã gửi lời mời');
    await expect(friends.answer(minh.id, lan.id, true)).rejects.toThrow('không còn');
    await friends.answer(lan.id, minh.id, false);
    expect(await friends.list(minh.id, nobody)).toEqual([]);
  });

  it('lists requests to you first, then friends online first, with presence for friends only', async () => {
    const { friends, minh, lan, hoa } = await setup();
    await friends.add(minh.id, 'lan');
    await friends.answer(lan.id, minh.id, true);
    await friends.add(hoa.id, 'minh');
    const presence: Presence = (id) =>
      id === lan.id ? { online: true, gameId: 'tien-len', roomCode: 'K7M2' } : { online: true };
    const list = await friends.list(minh.id, presence);
    expect(list.map((f) => [f.name, f.state, f.online])).toEqual([
      ['Hoa', 'incoming', false],
      ['Lan', 'friend', true],
    ]);
    expect(list[1]).toMatchObject({ gameId: 'tien-len', roomCode: 'K7M2' });
  });

  it('chats only between friends, counts unread and reads them on history', async () => {
    const { friends, minh, lan } = await setup();
    await expect(friends.send(minh.id, lan.id, 'chào')).rejects.toThrow('bạn bè');
    await friends.add(minh.id, 'lan');
    await friends.answer(lan.id, minh.id, true);
    const sent = await friends.send(minh.id, lan.id, '  chơi   Tiến Lên  không? ');
    expect(sent.text).toBe('chơi Tiến Lên không?');
    await friends.send(minh.id, lan.id, 'nhanh lên');
    await expect(friends.send(minh.id, lan.id, '   ')).rejects.toThrow('trống');
    await expect(friends.send(minh.id, lan.id, 'a'.repeat(CHAT_MAX + 1))).rejects.toThrow('dài');
    expect((await friends.list(lan.id, nobody))[0]?.unread).toBe(2);
    const history = await friends.history(lan.id, minh.id);
    expect(history.messages.map((m) => m.text)).toEqual(['chơi Tiến Lên không?', 'nhanh lên']);
    expect((await friends.list(lan.id, nobody))[0]?.unread).toBe(0);
    await friends.remove(lan.id, minh.id);
    await expect(friends.history(lan.id, minh.id)).rejects.toThrow('bạn bè');
  });

  it('suggests people played with lately, then others online, never yourself or friends', async () => {
    const { friends, minh, lan, hoa } = await setup();
    await friends.add(minh.id, 'lan');
    await friends.answer(lan.id, minh.id, true);
    const presence: Presence = (id) => ({ online: id === hoa.id });
    const people = await friends.suggest(minh.id, [lan.id, hoa.id], [minh.id, hoa.id], presence);
    expect(people).toEqual([
      {
        id: hoa.id,
        username: 'hoa',
        name: 'Hoa',
        avatar: 'boy',
        frame: expect.any(String),
        online: true,
        recent: true,
      },
    ]);
    expect(await friends.suggest(lan.id, [], [hoa.id, minh.id], nobody)).toMatchObject([
      { id: hoa.id, recent: false },
    ]);
  });

  it('finds only the exact username, in any case, and never yourself', async () => {
    const { friends, minh, lan } = await setup();
    expect(await friends.find(minh.id, ' LAN ', [], nobody)).toMatchObject([
      { id: lan.id, name: 'Lan', online: false, recent: false },
    ]);
    expect(await friends.find(minh.id, 'la', [], nobody)).toEqual([]);
    expect(await friends.find(minh.id, 'minh', [], nobody)).toEqual([]);
  });
});
