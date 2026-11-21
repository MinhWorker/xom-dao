import { randomInt, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type GameManifest, type MatchResult, optionsSchema, type PlayerId } from '@xomdao/sdk';
import type { RoomMember, RoomOptions, RoomState } from '@xomdao/shared';
import type { MatchStart } from '../game-host/game-host.types.js';
import { GAME_MANIFESTS } from './manifests.js';

export type { MatchStart } from '../game-host/game-host.types.js';

export class RoomError extends Error {}

/** The account entering a Room (from the logged-in socket). */
export interface Account {
  id: string;
  name: string;
  avatar?: string;
  frame?: string;
}

export interface Room {
  code: string;
  manifest: GameManifest;
  options: RoomOptions;
  hostId: PlayerId;
  /** `manifest.maxPlayers` seats in order; `null` is an empty one. */
  seats: (RoomMember | null)[];
  /** The running Match's id, `null` while waiting. */
  matchId: string | null;
  /** A Match was started here before: playing again needs no Sẵn sàng. */
  played: boolean;
  /** The last settled result, passed to a rematch while the seats stay the same. */
  lastResult: MatchResult | null;
  /** Seat order when the current Match started; guards results after a mid-Match leave. */
  matchPlayers: string[] | null;
}

/** Four characters with no 0/O/1/I, so a code is easy to read aloud and type. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A Room code as typed (any case, stray spaces) in the form Rooms are kept under. */
export const normalizeCode = (code: unknown) =>
  String(code ?? '')
    .replace(/\s/g, '')
    .toUpperCase();

/**
 * Session state: which Rooms exist, who sits where and with which options. Rooms live in
 * memory, so a restart wipes them. It knows nothing about sockets or a Game's rules: the gateway
 * turns requests into these calls, and GameHostModule runs the Match `start` hands over.
 * An account sits in at most one Room; the gateway makes it leave the old one first (`roomOf`).
 */
@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();

  constructor(@Inject(GAME_MANIFESTS) private readonly manifests: readonly GameManifest[]) {}

  /** A new Room of `gameId` with `account` as host in the first seat. */
  create(gameId: string, account: Account, rawOptions?: unknown) {
    const manifest = this.manifests.find((m) => m.id === gameId);
    if (!manifest) throw new RoomError(`Không có game: ${gameId}`);
    const seats: Room['seats'] = Array(manifest.maxPlayers).fill(null);
    seats[0] = member(account);
    const room: Room = {
      code: this.newCode(),
      manifest,
      options: parseOptions(manifest, rawOptions),
      hostId: account.id,
      seats,
      matchId: null,
      played: false,
      lastResult: null,
      matchPlayers: null,
    };
    this.rooms.set(room.code, room);
    return room;
  }

  /** Takes the first empty seat; joining a Room you sit in just reconnects you. */
  join(code: string, account: Account) {
    const room = this.get(code);
    const mine = room.seats.find((s) => s?.id === account.id);
    if (mine) {
      mine.connected = true;
      return room;
    }
    if (room.matchId) throw new RoomError('Ván đang chơi, chờ hết ván nhé');
    const free = room.seats.indexOf(null);
    if (free < 0) throw new RoomError('Phòng đã đủ người');
    room.seats[free] = member(account);
    room.lastResult = null;
    return room;
  }

  /**
   * Frees the account's seat, also mid-Match (GameHostModule decides what that means for the
   * Match). The next person seated becomes host; with nobody left the Room is gone (`closed`).
   */
  leave(code: string, userId: PlayerId) {
    const room = this.get(code);
    const seat = room.seats.findIndex((s) => s?.id === userId);
    if (seat < 0) throw new RoomError('Bạn chưa ở trong phòng này');
    room.seats[seat] = null;
    room.lastResult = null;
    const people = room.seats.filter((s): s is RoomMember => s !== null && !s.bot);
    const closed = people.length === 0;
    if (closed) this.rooms.delete(room.code);
    else if (room.hostId === userId) room.hostId = people[0]!.id;
    return { room, closed };
  }

  /** The Room this account sits in, if any. */
  roomOf(userId: string) {
    for (const room of this.rooms.values()) {
      if (room.seats.some((s) => s?.id === userId)) return room;
    }
    return undefined;
  }

  /** The account changed its name or picture: its seat follows. Returns its Room, if any. */
  rename(userId: string, { name, avatar, frame }: Omit<Account, 'id'>) {
    const room = this.roomOf(userId);
    const seat = room?.seats.find((s) => s?.id === userId);
    if (seat) Object.assign(seat, member({ id: userId, name, avatar, frame }));
    return room;
  }

  /** A dropped connection keeps the seat; returns the Room when there is one. */
  setConnected(code: string, userId: PlayerId, connected: boolean) {
    const room = this.rooms.get(code);
    const seat = room?.seats.find((s) => s?.id === userId);
    if (seat) seat.connected = connected;
    return room;
  }

  setOptions(code: string, userId: PlayerId, rawOptions: unknown) {
    const room = this.hostBetweenMatches(code, userId);
    room.options = parseOptions(room.manifest, rawOptions);
    return room;
  }

  setReady(code: string, userId: PlayerId, ready: boolean) {
    const room = this.get(code);
    const seat = room.seats.find((s) => s?.id === userId);
    if (!seat) throw new RoomError('Bạn chưa ở trong phòng này');
    if (room.matchId) throw new RoomError('Ván đã bắt đầu');
    seat.ready = ready;
    return room;
  }

  addBot(code: string, userId: PlayerId) {
    const room = this.hostBetweenMatches(code, userId);
    if (!room.manifest.bots) throw new RoomError('Game này không chơi với máy');
    const free = room.seats.indexOf(null);
    if (free < 0) throw new RoomError('Phòng đã đủ người');
    room.seats[free] = { id: `bot:${free + 1}`, name: 'Máy', bot: true, connected: true };
    room.lastResult = null;
    return room;
  }

  removeBot(code: string, userId: PlayerId, seat: number) {
    const room = this.hostBetweenMatches(code, userId);
    if (!room.seats[seat]?.bot) throw new RoomError('Ghế này không có máy');
    room.seats[seat] = null;
    room.lastResult = null;
    return room;
  }

  /**
   * The host starts a Match with everyone seated. Before the Room's first Match, every other
   * person seated must have said Sẵn sàng; after it, playing again needs no second yes.
   */
  start(code: string, userId: PlayerId): MatchStart {
    const room = this.hostBetweenMatches(code, userId);
    const seated = room.seats.filter((s): s is RoomMember => s !== null);
    if (seated.length < room.manifest.minPlayers) {
      throw new RoomError(`Cần ít nhất ${room.manifest.minPlayers} người chơi`);
    }
    if (!room.played && seated.some((s) => !s.bot && s.id !== room.hostId && !s.ready)) {
      throw new RoomError('Chờ mọi người sẵn sàng đã');
    }
    room.matchPlayers = seated.map(({ id }) => id);
    room.matchId = randomUUID();
    room.played = true;
    for (const seat of seated) seat.ready = undefined;
    return {
      matchId: room.matchId,
      roomCode: room.code,
      gameId: room.manifest.id,
      lastResult: room.lastResult,
      players: seated.map(({ id, name, bot, avatar }) => ({
        id,
        name,
        bot: Boolean(bot),
        ...(avatar !== undefined && { avatar }),
      })),
      options: room.options,
    };
  }

  /** The Match is over (settled or aborted): the Room waits to play again. */
  endMatch(code: string, matchId: string, result?: MatchResult) {
    const room = this.rooms.get(code);
    if (!room || room.matchId !== matchId) return undefined;
    const currentPlayers = room.seats.filter((seat) => seat !== null).map(({ id }) => id);
    const matchPlayers = room.matchPlayers;
    const samePlayers =
      matchPlayers !== null &&
      matchPlayers.length === currentPlayers.length &&
      matchPlayers.every((id, seat) => currentPlayers[seat] === id);
    room.matchId = null;
    room.lastResult = samePlayers ? (result ?? null) : null;
    room.matchPlayers = null;
    return room;
  }

  /** What everyone in the Room sees of it. */
  stateOf(code: string): RoomState {
    const room = this.get(code);
    return {
      code: room.code,
      gameId: room.manifest.id,
      hostId: room.hostId,
      seats: room.seats.map((s) => s && { ...s }),
      options: room.options,
      status: room.matchId ? 'playing' : 'waiting',
      matchId: room.matchId,
    };
  }

  /** Deletes and returns Rooms where nobody is connected. Called periodically by the gateway. */
  pruneEmptyRooms() {
    const pruned: Room[] = [];
    for (const [code, room] of this.rooms) {
      if (room.seats.some((s) => s && !s.bot && s.connected)) continue;
      this.rooms.delete(code);
      pruned.push(room);
    }
    return pruned;
  }

  private hostBetweenMatches(code: string, userId: PlayerId) {
    const room = this.get(code);
    if (room.hostId !== userId) throw new RoomError('Chỉ chủ phòng mới làm được');
    if (room.matchId) throw new RoomError('Đợi hết ván đã');
    return room;
  }

  private get(code: string) {
    const room = this.rooms.get(
      String(code ?? '')
        .replace(/\s/g, '')
        .toUpperCase(),
    );
    if (!room) throw new RoomError('Phòng không còn nữa');
    return room;
  }

  private newCode() {
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(
        '',
      );
    } while (this.rooms.has(code));
    return code;
  }
}

function member({ id, name, avatar, frame }: Account): RoomMember {
  return {
    id,
    name,
    ...(avatar !== undefined && { avatar }),
    ...(frame !== undefined && { frame }),
    connected: true,
  };
}

function parseOptions(manifest: GameManifest, raw: unknown): RoomOptions {
  const parsed = optionsSchema(manifest).safeParse(raw ?? {});
  if (!parsed.success) throw new RoomError('Tuỳ chọn phòng không hợp lệ');
  return parsed.data as RoomOptions;
}
