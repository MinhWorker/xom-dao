import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { COIN, type JoinedRoom, type ServerToClientEvents, type User } from '@xomdao/shared';
import { AccountError, AccountsService } from '../accounts/accounts.service.js';
import { DEV_MODE } from '../dev/dev-mode.js';
import { FriendsError, FriendsService, type Presence } from '../friends/friends.service.js';
import { GameHostError, GameHostService } from '../game-host/game-host.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { StatsError, StatsService } from '../stats/stats.service.js';
import { type Room, RoomError, RoomsService } from './rooms.service.js';

export interface SocketData {
  /** Set when the client logs in (`WsGateway`); handlers only see logged-in clients. */
  user: User;
  /** The Room this socket shows. Your id in it is `user.id`. */
  roomCode?: string;
}

/**
 * A logged-in client: a WebSocket connection wrapped by `WsGateway`. Handlers only read `data` and
 * `emit` events.
 */
export interface Client {
  data: SocketData;
  emit<E extends keyof ServerToClientEvents>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): boolean;
}
/** A handler's reply, sent back as the request's ack. */
export type Result = { ok: true; [key: string]: unknown } | { ok: false; error: string };

const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

/** The handler method of each client event, filled by `@On`. */
const HANDLERS = new Map<string, string>();

/** Marks a method as the handler of a client event (`room:create`…). */
function On(event: string): MethodDecorator {
  return (_target, name) => {
    HANDLERS.set(event, String(name));
  };
}
const CHAT_COOLDOWN_MS = 400;
/** Friends hear of an account coming online, going or changing rooms this long after. */
const FRIEND_PUSH_MS = 300;

/**
 * Translates client requests into service calls. Each handler's return value is sent back as
 * the request's ack. After every change to a Room, everyone in it gets a fresh `room:state`.
 *
 * Clients come from `WsGateway` (plain WebSocket + JSON): they join `clients()` through `attach`
 * once logged in and leave through `handleDisconnect` + `detach`. Being in a Room belongs to the
 * account, so one account can have several clients (tabs, devices) showing the same seat.
 */
@Injectable()
export class RoomsGateway implements OnModuleInit, OnModuleDestroy {
  /** Per-account cooldowns for chat messages (their expiry time). */
  private readonly chatCooldowns = new Map<string, number>();
  /** Pending "tell my friends" pushes, by account. */
  private readonly friendPushes = new Map<string, NodeJS.Timeout>();
  /** Logged-in clients (`WsGateway`). */
  private readonly connected = new Set<Client>();
  private pruner?: NodeJS.Timeout;
  private stopWatchingMatches?: () => void;

  constructor(
    private readonly rooms: RoomsService,
    private readonly gameHost: GameHostService,
    private readonly accounts: AccountsService,
    private readonly matches: MatchesService,
    private readonly ledger: LedgerService,
    private readonly stats: StatsService,
    private readonly friends: FriendsService,
    @Inject(DEV_MODE) private readonly devEnabled: boolean,
  ) {}

  onModuleInit() {
    this.pruner = setInterval(() => this.rooms.pruneEmptyRooms(), PRUNE_INTERVAL_MS);
    this.pruner.unref();
    this.stopWatchingMatches = this.gameHost.onState((match) => {
      for (const socket of this.clients()) {
        if (socket.data.roomCode !== match.roomCode) continue;
        const view =
          match.status === 'playing'
            ? this.gameHost.view(match.matchId, socket.data.user.id)
            : undefined;
        socket.emit('match:state', { ...match, ...(view !== undefined && { view }) });
      }
      if (match.status === 'playing' && match.disconnectedPlayerIds.length) {
        for (const playerId of match.disconnectedPlayerIds) {
          this.rooms.setConnected(match.roomCode, playerId, false);
        }
        this.broadcastCode(match.roomCode);
      }
      if (match.status === 'over') {
        const result = match.outcome === 'settled' ? match.result : undefined;
        const room = this.rooms.endMatch(match.roomCode, match.matchId, result);
        if (room) this.broadcast(room);
      }
    });
  }

  onModuleDestroy() {
    clearInterval(this.pruner);
    this.stopWatchingMatches?.();
  }

  /** A WebSocket client that just logged in. */
  attach(client: Client) {
    const first = this.socketsOf(client.data.user.id).length === 0;
    this.connected.add(client);
    if (first) this.friendsMoved(client.data.user.id);
  }

  /** A WebSocket client that closed (after `handleDisconnect`). */
  detach(client: Client) {
    this.connected.delete(client);
    const userId = client.data.user?.id;
    if (userId && this.socketsOf(userId).length === 0) this.friendsMoved(userId);
  }

  /** The handler of a client event (an `@On` method), for `WsGateway`; `undefined` if unknown. */
  handlerFor(event: string): ((client: Client, req: unknown) => Promise<Result>) | undefined {
    const name = HANDLERS.get(event);
    const method = name && (this as unknown as Record<string, unknown>)[name];
    if (typeof method !== 'function') return undefined;
    return (client, req) => method.call(this, client, req) as Promise<Result>;
  }

  /** The account changed how it shows: its sockets and its Room (pushed to everyone) follow. */
  private changed(user: User) {
    for (const s of this.socketsOf(user.id)) s.data.user = user;
    const room = this.rooms.rename(user.id, user);
    if (room) this.broadcast(room);
    return user;
  }

  /** Offline only when none of the account's sockets still shows the Room. */
  handleDisconnect(socket: Client) {
    const { roomCode, user } = socket.data;
    if (!roomCode || !user) return;
    const stillHere = this.socketsOf(user.id).some(
      (s) => s !== socket && s.data.roomCode === roomCode,
    );
    if (stillHere) return;
    const room = this.rooms.setConnected(roomCode, user.id, false);
    if (room) this.broadcast(room);
  }

  @On('session:resume')
  resume(socket: Client) {
    return this.handle(async () => {
      const balances = await this.ledger.balances(socket.data.user.id);
      const room = this.rooms.roomOf(socket.data.user.id);
      return { user: socket.data.user, room: room ? this.enter(socket, room) : null, balances };
    });
  }

  @On('profile:update')
  updateProfile(socket: Client, req: unknown) {
    return this.handle(async () => {
      const me = socket.data.user;
      return { user: this.changed(await this.accounts.updateProfile(me.id, req)) };
    });
  }

  @On('stats:get')
  statsGet(socket: Client, req: { userId?: unknown } | undefined) {
    return this.handle(() => {
      const userId = typeof req?.userId === 'string' ? req.userId : socket.data.user.id;
      return this.stats.playerStats(userId);
    });
  }

  @On('ranking:get')
  rankingGet(socket: Client, req: { board?: unknown }) {
    return this.handle(() => this.stats.ranking(String(req?.board ?? ''), socket.data.user.id));
  }

  @On('history:recent')
  history(socket: Client) {
    return this.handle(async () => ({ matches: await this.matches.recent(socket.data.user.id) }));
  }

  @On('friends:list')
  friendsList(socket: Client) {
    return this.handle(() => this.friendList(socket.data.user.id));
  }

  @On('friends:add')
  friendsAdd(socket: Client, req: { username?: unknown }) {
    return this.handle(async () => {
      const other = await this.friends.add(socket.data.user.id, String(req?.username ?? ''));
      void this.pushFriends(other);
      return this.friendList(socket.data.user.id);
    });
  }

  @On('friends:answer')
  friendsAnswer(socket: Client, req: { userId?: unknown; accept?: unknown }) {
    return this.handle(async () => {
      const other = String(req?.userId ?? '');
      await this.friends.answer(socket.data.user.id, other, req?.accept === true);
      void this.pushFriends(other);
      return this.friendList(socket.data.user.id);
    });
  }

  @On('friends:remove')
  friendsRemove(socket: Client, req: { userId?: unknown }) {
    return this.handle(async () => {
      const other = String(req?.userId ?? '');
      await this.friends.remove(socket.data.user.id, other);
      void this.pushFriends(other);
      return this.friendList(socket.data.user.id);
    });
  }

  @On('friends:suggest')
  friendsSuggest(socket: Client) {
    return this.handle(async () => {
      const me = socket.data.user.id;
      const online = [...new Set(this.clients().map((s) => s.data.user?.id))].filter(
        (id): id is string => Boolean(id),
      );
      const recent = await this.matches.partners(me);
      return { people: await this.friends.suggest(me, recent, online, this.presence) };
    });
  }

  @On('friends:find')
  friendsFind(socket: Client, req: { username?: unknown }) {
    return this.handle(async () => {
      const me = socket.data.user.id;
      const recent = await this.matches.partners(me);
      const username = String(req?.username ?? '');
      return { people: await this.friends.find(me, username, recent, this.presence) };
    });
  }

  @On('chat:history')
  chatHistory(socket: Client, req: { userId?: unknown }) {
    return this.handle(() => this.friends.history(socket.data.user.id, String(req?.userId ?? '')));
  }

  @On('chat:send')
  chatSend(socket: Client, req: { userId?: unknown; text?: unknown }) {
    return this.handle(async () => {
      const me = socket.data.user.id;
      const now = Date.now();
      if ((this.chatCooldowns.get(me) ?? 0) > now) throw new FriendsError('Gửi chậm lại một chút');
      this.chatCooldowns.set(me, now + CHAT_COOLDOWN_MS);
      const to = String(req?.userId ?? '');
      const message = await this.friends.send(me, to, String(req?.text ?? ''));
      for (const s of this.socketsOf(to)) s.emit('chat:message', message);
      for (const s of this.socketsOf(me)) if (s !== socket) s.emit('chat:message', message);
      return { message };
    });
  }

  @On('friends:invite')
  invite(socket: Client, req: { userId?: unknown }) {
    return this.handle(async () => {
      const me = socket.data.user;
      const room = this.rooms.roomOf(me.id);
      if (!room) throw new RoomError('Bạn chưa ở trong phòng nào');
      const other = String(req?.userId ?? '');
      if (!(await this.friends.areFriends(me.id, other)))
        throw new FriendsError('Chỉ mời được bạn bè');
      const sockets = this.socketsOf(other);
      if (!sockets.length) throw new FriendsError('Bạn ấy đang không online');
      for (const s of sockets) {
        s.emit('room:invite', {
          fromId: me.id,
          fromName: me.name,
          avatar: me.avatar,
          frame: me.frame,
          roomCode: room.code,
          gameId: room.manifest.id,
        });
      }
      return {};
    });
  }

  @On('room:create')
  create(socket: Client, req: { gameId?: unknown; options?: unknown }) {
    return this.handle(() => {
      this.leaveCurrentRoom(socket);
      const room = this.rooms.create(String(req?.gameId ?? ''), socket.data.user, req?.options);
      return this.enter(socket, room);
    });
  }

  @On('room:join')
  join(socket: Client, req: { roomCode?: unknown }) {
    return this.handle(() => {
      const code = String(req?.roomCode ?? '');
      this.leaveCurrentRoom(socket, code);
      return this.enter(socket, this.rooms.join(code, socket.data.user));
    });
  }

  @On('room:leave')
  leave(socket: Client) {
    return this.handle(() => {
      this.leaveRoom(socket, this.requireRoom(socket));
      return {};
    });
  }

  @On('room:options')
  setOptions(socket: Client, req: { options?: unknown }) {
    return this.handle(() => {
      const code = this.requireRoom(socket);
      this.broadcast(this.rooms.setOptions(code, socket.data.user.id, req?.options));
      return {};
    });
  }

  @On('room:ready')
  ready(socket: Client, req: { ready?: unknown }) {
    return this.handle(() => {
      const code = this.requireRoom(socket);
      this.broadcast(this.rooms.setReady(code, socket.data.user.id, req?.ready === true));
      return {};
    });
  }

  @On('room:add-bot')
  addBot(socket: Client) {
    return this.handle(() => {
      const code = this.requireRoom(socket);
      this.broadcast(this.rooms.addBot(code, socket.data.user.id));
      return {};
    });
  }

  @On('room:remove-bot')
  removeBot(socket: Client, req: { seat?: unknown }) {
    return this.handle(() => {
      const code = this.requireRoom(socket);
      this.broadcast(this.rooms.removeBot(code, socket.data.user.id, Number(req?.seat)));
      return {};
    });
  }

  @On('match:start')
  start(socket: Client) {
    return this.handle(() => {
      const code = this.requireRoom(socket);
      const start = this.rooms.start(code, socket.data.user.id);
      this.gameHost.startMatch(start);
      this.broadcastCode(code);
      return { matchId: start.matchId };
    });
  }

  @On('match:ready')
  matchReady(socket: Client, req: { matchId?: unknown }) {
    return this.handle(() => {
      const roomCode = this.requireRoom(socket);
      const room = this.rooms.roomOf(socket.data.user.id);
      const matchId = String(req?.matchId ?? '');
      if (!room || room.code !== roomCode || room.matchId !== matchId) {
        throw new GameHostError('Ván không còn nữa');
      }
      this.gameHost.ready(matchId, socket.data.user.id);
      return {};
    });
  }

  @On('match:move')
  matchMove(socket: Client, req: { matchId?: unknown; event?: unknown; payload?: unknown }) {
    return this.handle(() => {
      const roomCode = this.requireRoom(socket);
      const room = this.rooms.roomOf(socket.data.user.id);
      const matchId = String(req?.matchId ?? '');
      if (!room || room.code !== roomCode || room.matchId !== matchId) {
        throw new GameHostError('Ván không còn nữa');
      }
      this.gameHost.move(matchId, socket.data.user.id, {
        event: String(req?.event ?? ''),
        payload: req?.payload,
      });
      return {};
    });
  }

  @On('dev:coins')
  devCoins(socket: Client, req: { amount?: unknown }) {
    return this.handle(async () => {
      if (!this.devEnabled) throw new RoomError('Server không bật chế độ dev');
      const amount = Number(req?.amount);
      if (!Number.isInteger(amount) || amount <= 0) throw new RoomError('Số xu không hợp lệ');
      const userId = socket.data.user.id;
      await this.ledger.apply({
        userId,
        resource: COIN,
        amount,
        reason: 'dev:coins',
        key: `dev:${randomUUID()}`,
      });
      return { balances: await this.ledger.balances(userId) };
    });
  }

  private enter(socket: Client, room: Room): JoinedRoom {
    const userId = socket.data.user.id;
    socket.data.roomCode = room.code;
    this.rooms.setConnected(room.code, userId, true);
    this.broadcast(room);
    this.replayMatchState(socket, room.matchId);
    this.friendsMoved(userId);
    return { roomCode: room.code, playerId: userId };
  }

  /** Resends the active Match and this seat's view when a player rejoins a Room. */
  private replayMatchState(socket: Client, matchId: string | null) {
    if (!matchId) return;
    const match = this.gameHost.match(matchId);
    if (!match) return;
    const view =
      match.status === 'playing' ? this.gameHost.view(matchId, socket.data.user.id) : undefined;
    socket.emit('match:state', { ...match, ...(view !== undefined && { view }) });
  }

  /** Before entering a Room: quit the account's other Room, if any. */
  private leaveCurrentRoom(socket: Client, unlessCode?: string) {
    const current = this.rooms.roomOf(socket.data.user.id);
    const target = String(unlessCode ?? '')
      .replace(/\s/g, '')
      .toUpperCase();
    if (current && current.code !== target) this.leaveRoom(socket, current.code);
  }

  /**
   * The account quits the Room. Its other sockets still showing the Room are sent out
   * with `room:closed`; `socket` (the one asking) already knows.
   */
  private leaveRoom(socket: Client, roomCode: string) {
    const userId = socket.data.user.id;
    const { room, closed } = this.rooms.leave(roomCode, userId);
    const matchId = room.matchId;
    for (const s of this.socketsOf(userId)) {
      if (s.data.roomCode !== roomCode) continue;
      if (s !== socket) {
        s.emit('room:closed', { gameId: room.manifest.id, reason: 'Bạn đã rời phòng' });
      }
      s.data.roomCode = undefined;
    }
    if (matchId) this.gameHost.leave(matchId, userId);
    if (closed) this.disband(room);
    else this.broadcast(room);
    this.friendsMoved(userId);
  }

  private requireRoom(socket: Client) {
    const { roomCode } = socket.data;
    if (!roomCode) throw new RoomError('Bạn chưa ở trong phòng nào');
    return roomCode;
  }

  /** Whether an account is connected, and the Room it is in (for its friends' lists). */
  private readonly presence: Presence = (userId) => {
    const room = this.rooms.roomOf(userId);
    return {
      online: this.socketsOf(userId).length > 0,
      ...(room && { gameId: room.manifest.id, roomCode: room.code }),
    };
  };

  private async friendList(userId: string) {
    return { friends: await this.friends.list(userId, this.presence) };
  }

  /** Sends an account's sockets its fresh Bạn bè list. */
  private async pushFriends(userId: string) {
    const sockets = this.socketsOf(userId);
    if (!sockets.length) return;
    const list = await this.friendList(userId);
    for (const s of sockets) s.emit('friends:changed', list);
  }

  /**
   * An account came online, went, or changed rooms: a moment later, its friends online get their
   * fresh lists (one push for a burst of changes).
   */
  private friendsMoved(userId: string) {
    clearTimeout(this.friendPushes.get(userId));
    const timer = setTimeout(() => {
      this.friendPushes.delete(userId);
      this.friends
        .friendIds(userId)
        .then((ids) => Promise.all(ids.map((id) => this.pushFriends(id))))
        .catch((err) => console.error('Could not tell friends', err));
    }, FRIEND_PUSH_MS);
    timer.unref();
    this.friendPushes.set(userId, timer);
  }

  private socketsOf(userId: string) {
    return this.clients().filter((s) => s.data.user?.id === userId);
  }

  private clients(): Client[] {
    return [...this.connected];
  }

  /** Sends everyone still showing a deleted Room back out. */
  private disband(room: Room) {
    for (const socket of this.clients()) {
      if (socket.data.roomCode !== room.code) continue;
      socket.emit('room:closed', { gameId: room.manifest.id, reason: 'Phòng đã giải tán' });
      socket.data.roomCode = undefined;
      this.friendsMoved(socket.data.user.id);
    }
  }

  private broadcast(room: Room) {
    this.broadcastCode(room.code);
  }

  /** Sends everyone showing the Room its new state. */
  private broadcastCode(code: string) {
    const state = this.rooms.stateOf(code);
    for (const socket of this.clients()) {
      if (socket.data.roomCode === code) socket.emit('room:state', state);
    }
  }

  private async handle(fn: () => object | Promise<object>): Promise<Result> {
    try {
      return { ok: true, ...(await fn()) };
    } catch (err) {
      if (
        err instanceof GameHostError ||
        err instanceof RoomError ||
        err instanceof AccountError ||
        err instanceof FriendsError ||
        err instanceof StatsError
      ) {
        return { ok: false, error: err.message };
      }
      console.error(err);
      return { ok: false, error: 'Server gặp lỗi, thử lại sau' };
    }
  }
}
