import type { Friend } from '@xomdao/shared/client';

export interface FriendGroups {
  /** Asked you; waiting for your answer. */
  incoming: Friend[];
  friends: Friend[];
  /** You asked; waiting for theirs. */
  outgoing: Friend[];
}

/** Splits the server's list by where each person stands with you; the server's order is kept. */
export function groupFriends(list: readonly Friend[]): FriendGroups {
  return {
    incoming: list.filter((f) => f.state === 'incoming'),
    friends: list.filter((f) => f.state === 'friend'),
    outgoing: list.filter((f) => f.state === 'outgoing'),
  };
}

/** What a friend is doing: in a Room (of this Game), online, or away. */
export function presenceLabel(friend: Friend, gameName?: string): string {
  if (friend.roomCode) return gameName ? `Trong phòng ${gameName}` : 'Trong phòng';
  return friend.online ? 'Trực tuyến' : 'Ngoại tuyến';
}

/** Whether a friend can be asked to a Room now: online, and not already in that Room. */
export function canInvite(friend: Friend, roomCode: string): boolean {
  return friend.state === 'friend' && friend.online && friend.roomCode !== roomCode;
}

/** Lowercase and without Vietnamese marks, so "hai" finds "Hải" and "duc" finds "Đức". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase();
}

/** The people whose name or username contains the query; a blank query keeps the whole list. */
export function filterFriends<T extends { name: string; username: string }>(
  list: readonly T[],
  query: string,
): readonly T[] {
  const needle = fold(query.trim());
  if (!needle) return list;
  return list.filter((p) => fold(p.name).includes(needle) || fold(p.username).includes(needle));
}
