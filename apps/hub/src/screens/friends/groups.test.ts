import type { Friend } from '@xomdao/shared/client';
import { describe, expect, it } from 'vitest';
import { canInvite, groupFriends, presenceLabel } from './groups.js';

const friend = (patch: Partial<Friend>): Friend => ({
  id: 'u1',
  username: 'lan',
  name: 'Lan',
  avatar: 'girl',
  frame: 'gold',
  state: 'friend',
  online: true,
  unread: 0,
  ...patch,
});

describe('groupFriends', () => {
  it('splits by state and keeps the order', () => {
    const list = [
      friend({ id: 'a', state: 'incoming' }),
      friend({ id: 'b' }),
      friend({ id: 'c', state: 'outgoing' }),
      friend({ id: 'd', online: false }),
    ];
    const groups = groupFriends(list);
    expect(groups.incoming.map((f) => f.id)).toEqual(['a']);
    expect(groups.friends.map((f) => f.id)).toEqual(['b', 'd']);
    expect(groups.outgoing.map((f) => f.id)).toEqual(['c']);
  });
});

describe('presenceLabel', () => {
  it('says where a friend is', () => {
    expect(presenceLabel(friend({ roomCode: 'ABCD' }), 'Caro')).toBe('Trong phòng Caro');
    expect(presenceLabel(friend({ roomCode: 'ABCD' }))).toBe('Trong phòng');
    expect(presenceLabel(friend({}))).toBe('Trực tuyến');
    expect(presenceLabel(friend({ online: false }))).toBe('Ngoại tuyến');
  });
});

describe('canInvite', () => {
  it('needs an online friend who is not in this Room yet', () => {
    expect(canInvite(friend({}), 'ABCD')).toBe(true);
    expect(canInvite(friend({ roomCode: 'WXYZ' }), 'ABCD')).toBe(true);
    expect(canInvite(friend({ roomCode: 'ABCD' }), 'ABCD')).toBe(false);
    expect(canInvite(friend({ online: false }), 'ABCD')).toBe(false);
    expect(canInvite(friend({ state: 'incoming' }), 'ABCD')).toBe(false);
  });
});
