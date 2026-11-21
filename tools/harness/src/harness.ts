import type { BridgePort, BridgeSettings } from '@xomdao/bridge';
import type { RoomOptions } from '@xomdao/shared/client';
import { type Connect, ServerError } from './link.js';
import { Log, type LogEntry, type LogFilter } from './log.js';
import { NetSim } from './net.js';
import { Player } from './player.js';

export interface HarnessConfig {
  gameId: string;
  /** The Game bundle's `dist/version.json` hash, which the server checks. */
  version: string;
  connect: Connect;
  /** Where the Harness itself listens, shown in `state`. */
  address?: string;
}

/**
 * The Harness: runs one Game against a real server with no Hub. Each person at the table is a
 * `Player` (an account); the first creates the Room and hosts. A player either has a Game client
 * on the Harness' WebSocket Bridge (an editor, a browser tab) or is headless and moved from the
 * CLI. Computer players are the server's own (`bot`).
 */
export class Harness {
  readonly net = new NetSim();
  readonly log = new Log();
  private players: Player[] = [];

  constructor(private readonly config: HarnessConfig) {}

  get gameId() {
    return this.config.gameId;
  }

  /** The Room's code, once it is created. */
  get roomCode() {
    return this.players.find((p) => p.room)?.room?.code ?? null;
  }

  async create({ options, headless = false }: { options?: RoomOptions; headless?: boolean } = {}) {
    if (this.players.length) throw new ServerError('A Room is open: run reset first');
    return this.seat(headless, async (player) => {
      const joined = await player.request('room:create', {
        gameId: this.config.gameId,
        version: this.config.version,
        ...(options && { options }),
      });
      return { player: player.index, roomCode: String(joined.roomCode) };
    });
  }

  async join({ headless = false }: { headless?: boolean } = {}) {
    const roomCode = this.roomCode;
    if (!roomCode) throw new ServerError('No Room yet: run create first');
    return this.seat(headless, async (player) => {
      await player.request('room:join', { roomCode });
      return { player: player.index, roomCode };
    });
  }

  async bot() {
    await this.host().request('room:add-bot');
  }

  async removeBot(seat: number) {
    await this.host().request('room:remove-bot', { seat });
  }

  async setOptions(options: RoomOptions) {
    await this.host().request('room:options', { options });
  }

  /** Everyone seated says ready, then the host starts a Match; headless players load at once. */
  async start() {
    const host = this.host();
    for (const player of this.players) {
      if (player === host || player.room?.seats.find((s) => s?.id === player.user.id)?.ready)
        continue;
      await player.request('room:ready', { ready: true });
    }
    const started = await host.request('match:start', { version: this.config.version });
    return { matchId: String(started.matchId) };
  }

  /** Sends `event` as the player's Game would, answered by the server. */
  async move(player: number, event: string, payload?: unknown) {
    await this.player(player).move(event, payload);
  }

  /** Sends the Game client a fresh `init` (a replay, or a Game that lost its screen). */
  init(player: number) {
    if (!this.player(player).sendInit()) {
      throw new ServerError(`Player ${player} has no loaded Game client to send init to`);
    }
  }

  reconnect(player: number) {
    return this.player(player).reconnect();
  }

  /** Cuts the player's connection to the server, leaving the seat to the server's hold. */
  disconnect(player: number) {
    this.player(player).disconnect();
  }

  leave(player: number) {
    return this.player(player).leave();
  }

  visibility(player: number, hidden: boolean) {
    this.player(player).setHidden(hidden);
  }

  settings(player: number, settings: Partial<BridgeSettings>) {
    const target = this.player(player);
    target.setSettings({ ...target.settings, ...settings });
  }

  setNet(settings: Partial<{ latency: number; drop: number }>) {
    Object.assign(this.net.settings, settings);
    this.note('net', this.net.settings);
    return this.net.settings;
  }

  /**
   * A Game client connected over the Bridge's WebSocket. It takes player `wanted`, or else the
   * first one without a client. Returns what it took, and how to let go of it.
   */
  attach(port: BridgePort, wanted?: number) {
    const player =
      wanted === undefined
        ? this.players.find((p) => !p.headless && !p.hasClient)
        : this.players[wanted];
    if (!player || player.headless) {
      throw new ServerError(
        wanted === undefined
          ? 'No player waits for a Game client: run create or join first'
          : `Player ${wanted} cannot take a Game client`,
      );
    }
    const host = player.attach(port);
    this.log.add({ player: player.index, source: 'harness', type: 'client-connected' });
    return {
      player: player.index,
      detach: () => {
        player.detach(host);
        this.log.add({ player: player.index, source: 'harness', type: 'client-gone' });
      },
    };
  }

  /** Everyone leaves and the accounts are dropped. */
  async reset() {
    for (const player of this.players) {
      player.detach();
      if (player.room && player.online) await player.leave().catch(() => {});
      player.close();
    }
    this.players = [];
    this.note('reset');
  }

  entries(filter?: LogFilter): LogEntry[] {
    return this.log.list(filter);
  }

  /** The Room, the Match and each player, as an agent needs to read them. */
  state() {
    const host = this.hostOrNull();
    const match = host?.match ?? this.players.find((p) => p.match)?.match ?? null;
    return {
      game: this.config.gameId,
      version: this.config.version,
      address: this.config.address ?? null,
      net: this.net.settings,
      room: host?.room ?? null,
      match: match && { ...match, view: undefined },
      result: this.players.find((p) => p.result)?.result ?? null,
      players: this.players.map((p) => ({
        player: p.index,
        id: p.user.id,
        name: p.user.name,
        headless: p.headless,
        online: p.online,
        client: p.hasClient,
        loaded: p.loaded,
        hidden: p.hidden,
        inits: p.inits,
        doneFor: p.doneFor,
        view: p.match?.view ?? null,
      })),
      log: this.log.last,
    };
  }

  private hostOrNull() {
    const hostId = this.players.find((p) => p.room)?.room?.hostId;
    return this.players.find((p) => p.user.id === hostId) ?? this.players[0];
  }

  private host() {
    const host = this.hostOrNull();
    if (!host) throw new ServerError('No Room yet: run create first');
    return host;
  }

  private player(index: number) {
    const player = this.players[index];
    if (!player) throw new ServerError(`No player ${index}`);
    return player;
  }

  /** Opens an account for a new player and seats it; the account is dropped if `seat` fails. */
  private async seat<T>(headless: boolean, seat: (player: Player) => Promise<T>) {
    const player = await Player.open(this.players.length, headless, this.log, this.config.connect);
    this.players.push(player);
    try {
      return await seat(player);
    } catch (err) {
      this.players.pop();
      player.close();
      throw err;
    }
  }

  private note(type: string, data?: unknown) {
    this.log.add({ player: null, source: 'harness', type, data });
  }
}
