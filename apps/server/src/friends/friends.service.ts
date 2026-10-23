import { Inject, Injectable } from '@nestjs/common';
import {
  CHAT_HISTORY,
  CHAT_MAX,
  type ChatHistory,
  type ChatMessage,
  FRIENDS_MAX,
  type Friend,
} from '@xomdao/shared';
import { AccountsService } from '../accounts/accounts.service.js';
import type { FriendsStore } from './friends.store.js';

export const FRIENDS_STORE = Symbol('FRIENDS_STORE');

/** A refusal the player reads (in Vietnamese). */
export class FriendsError extends Error {}

/** Whether an account is connected, and the room it is in (from the rooms gateway). */
export type Presence = (userId: string) => { online: boolean; gameId?: string; roomCode?: string };

/**
 * Bạn bè: friend requests, friendships and chat between friends. It owns `friendships` and
 * `friend_messages`; who is online and in which room comes from the rooms gateway (`Presence`),
 * which also pushes the changes to the people concerned.
 */
@Injectable()
export class FriendsService {
  constructor(
    @Inject(FRIENDS_STORE) private readonly store: FriendsStore,
    private readonly accounts: AccountsService,
  ) {}

  /** Your friends and requests: friends online first, then by name; requests to you first. */
  async list(userId: string, presence: Presence): Promise<Friend[]> {
    const [pairs, unread] = await Promise.all([
      this.store.pairsOf(userId),
      this.store.unread(userId),
    ]);
    const out: Friend[] = [];
    for (const pair of pairs) {
      const otherId = pair.requesterId === userId ? pair.addresseeId : pair.requesterId;
      const other = await this.accounts.userById(otherId);
      if (!other) continue;
      const state =
        pair.acceptedAt !== null ? 'friend' : pair.requesterId === userId ? 'outgoing' : 'incoming';
      const seen = state === 'friend' ? presence(otherId) : { online: false };
      out.push({
        id: other.id,
        username: other.username,
        name: other.name,
        avatar: other.avatar,
        frame: other.frame,
        state,
        online: seen.online,
        ...(seen.gameId && { gameId: seen.gameId }),
        ...(seen.roomCode && { roomCode: seen.roomCode }),
        unread: state === 'friend' ? (unread.get(otherId) ?? 0) : 0,
      });
    }
    const order = { incoming: 0, friend: 1, outgoing: 2 };
    return out.sort(
      (a, b) =>
        order[a.state] - order[b.state] ||
        Number(b.online) - Number(a.online) ||
        a.name.localeCompare(b.name, 'vi'),
    );
  }

  /** The ids of your friends (accepted both ways). */
  async friendIds(userId: string): Promise<string[]> {
    const pairs = await this.store.pairsOf(userId);
    return pairs
      .filter((p) => p.acceptedAt !== null)
      .map((p) => (p.requesterId === userId ? p.addresseeId : p.requesterId));
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    return (await this.store.pair(a, b))?.acceptedAt != null;
  }

  /**
   * Asks someone by username to be friends, or accepts their request if they already asked you.
   * Returns the other account's id.
   */
  async add(userId: string, username: string): Promise<string> {
    const other = await this.accounts.userByUsername(String(username ?? ''));
    if (!other) throw new FriendsError('Không tìm thấy tên đăng nhập này');
    if (other.id === userId) throw new FriendsError('Đó là tên đăng nhập của bạn');
    const pair = await this.store.pair(userId, other.id);
    if (pair?.acceptedAt != null) throw new FriendsError('Hai bạn đã là bạn bè');
    if (pair && pair.requesterId === userId) throw new FriendsError('Bạn đã gửi lời mời rồi');
    if (pair) {
      await this.store.accept(other.id, userId);
      return other.id;
    }
    for (const id of [userId, other.id]) {
      if ((await this.store.pairsOf(id)).length >= FRIENDS_MAX) {
        throw new FriendsError(
          id === userId ? 'Danh sách bạn bè của bạn đã đầy' : 'Danh sách bạn bè của họ đã đầy',
        );
      }
    }
    await this.store.request(userId, other.id);
    return other.id;
  }

  /** Accepts or turns down `otherId`'s request to you. */
  async answer(userId: string, otherId: string, accept: boolean): Promise<void> {
    const pair = await this.store.pair(userId, otherId);
    if (!pair || pair.acceptedAt !== null || pair.addresseeId !== userId) {
      throw new FriendsError('Lời mời này không còn nữa');
    }
    if (accept) await this.store.accept(otherId, userId);
    else await this.store.remove(userId, otherId);
  }

  /** Ends a friendship, or takes back (or turns down) a request. */
  async remove(userId: string, otherId: string): Promise<void> {
    await this.store.remove(userId, otherId);
  }

  async send(userId: string, to: string, text: string): Promise<ChatMessage> {
    const said = String(text ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!said) throw new FriendsError('Tin nhắn trống');
    if ([...said].length > CHAT_MAX) throw new FriendsError(`Tin nhắn dài quá ${CHAT_MAX} ký tự`);
    if (!(await this.areFriends(userId, to))) throw new FriendsError('Chỉ nhắn được cho bạn bè');
    return this.store.addMessage(userId, to, said);
  }

  /** The newest messages with a friend, oldest first; theirs become read. */
  async history(userId: string, otherId: string): Promise<ChatHistory> {
    if (!(await this.areFriends(userId, otherId)))
      throw new FriendsError('Chỉ nhắn được cho bạn bè');
    await this.store.markRead(otherId, userId);
    return { userId: otherId, messages: await this.store.messages(userId, otherId, CHAT_HISTORY) };
  }
}
