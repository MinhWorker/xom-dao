import {
  type BridgeAck,
  type BridgePort,
  type BridgeSettings,
  bridgeInit,
  createGameHost,
  type GameHost,
} from '@xomdao/bridge';
import { events, type MatchResultNotice, type RoomState } from '@xomdao/shared/client';
import type { z } from 'zod';
import { type Connect, ServerError, type ServerLink } from './link.js';
import type { Log } from './log.js';

export type MatchPush = z.output<(typeof events)['match:state']>;

/** What the Hub tells a Game that the Match is no longer there. */
const NO_MATCH = 'Ván không còn nữa';

/**
 * One account at the Harness, seated in the Room: the Harness plays the Hub for it. It keeps the
 * Session state the Hub would (Room, Match), answers its Game client's `ready` with `init`,
 * reports `match:ready`, passes every `match:state` on and forwards the Game's moves. A headless
 * player has no Game client: it is moved from the CLI.
 */
export class Player {
  room: RoomState | null = null;
  match: MatchPush | null = null;
  /** The Match's last `view`: the push that ends it has none, and a later `init` redraws it. */
  private lastView: unknown;
  result: MatchResultNotice | null = null;
  settings: BridgeSettings = { volume: 1, muted: false };
  hidden = false;
  /** How many `init`s the Game client was sent. */
  inits = 0;
  /** The Match whose end-of-match animation the Game client reported finished (`done`). */
  doneFor: string | null = null;
  /** The Game client sent `ready` and has not gone since. */
  loaded = false;
  private link!: ServerLink;
  private client: GameHost | null = null;
  private reported: string | null = null;

  private constructor(
    readonly index: number,
    readonly headless: boolean,
    private readonly log: Log,
  ) {}

  static async open(index: number, headless: boolean, log: Log, connect: Connect) {
    const player = new Player(index, headless, log);
    player.link = await connect(`Harness ${index + 1}`, (event, data) => player.push(event, data));
    return player;
  }

  get user() {
    return this.link.user;
  }

  get online() {
    return this.link.online;
  }

  get hasClient() {
    return this.client !== null;
  }

  /** Asks the server; logs the request and a refusal. */
  async request(event: string, data: unknown = {}) {
    this.log.add({ player: this.index, source: 'server', dir: 'out', type: event, data });
    try {
      return await this.link.request(event, data);
    } catch (err) {
      this.log.add({
        player: this.index,
        source: 'server',
        dir: 'in',
        type: event,
        data: { error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
  }

  /** A Game client connected on `port`: from its `ready` on, the Harness is its Hub. */
  attach(port: BridgePort): GameHost {
    this.detach();
    const host = createGameHost({
      port,
      send: (event, data) => this.forward(event, data),
      onReady: () => {
        this.loaded = true;
        this.sendInit();
        this.reportReady();
      },
      onDone: () => {
        this.doneFor = this.match?.matchId ?? null;
        this.note('done', { matchId: this.doneFor });
      },
      onMismatch: (version) => this.note('bridge-version-mismatch', { version }),
    });
    this.client = host;
    if (this.hidden) host.visibility(true);
    return host;
  }

  /** Lets go of the Game client, or of `only` if that is still the one attached. */
  detach(only?: GameHost) {
    if (!this.client || (only && this.client !== only)) return;
    this.client.close();
    this.client = null;
    this.loaded = false;
  }

  /** Sends the Game client a fresh `init`: what a reconnect or a replay does. */
  sendInit() {
    if (!this.client || !this.loaded || !this.room) return false;
    this.client.init(
      bridgeInit({
        user: this.link.user,
        room: this.room,
        match: this.match && { ...this.match, view: this.match.view ?? this.lastView },
        settings: this.settings,
      }),
    );
    this.inits++;
    return true;
  }

  /** One of the Game's moves, as the Hub forwards it: the server's refusal goes back as `ack`. */
  async forward(event: string, data: unknown): Promise<BridgeAck> {
    const match = this.match;
    if (!match) return { ok: false, error: NO_MATCH };
    try {
      await this.request('match:move', { matchId: match.matchId, event, payload: data });
      return { ok: true };
    } catch (err) {
      if (!(err instanceof ServerError) || !this.link.online) throw err;
      return { ok: false, error: err.message };
    }
  }

  /** Moves from the CLI, without a Game client. Throws the server's refusal. */
  async move(event: string, payload: unknown) {
    const ack = await this.forward(event, payload);
    if (!ack.ok) throw new ServerError(ack.error);
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.client?.visibility(hidden);
  }

  setSettings(settings: BridgeSettings) {
    this.settings = settings;
    this.client?.settings(settings);
  }

  /** Logs in again as after a lost connection, then gives the Game client a fresh `init`. */
  async reconnect() {
    await this.link.reconnect();
    this.sync();
  }

  disconnect() {
    this.link.drop();
  }

  async leave() {
    await this.request('room:leave');
    this.room = null;
    this.match = null;
  }

  close() {
    this.detach();
    this.link.close();
  }

  /** The server pushed something. */
  private push(event: string, data: unknown) {
    this.log.add({ player: this.index, source: 'server', dir: 'in', type: event, data });
    switch (event) {
      case 'room:state': {
        const room = events['room:state'].safeParse(data);
        if (room.success) this.room = room.data;
        break;
      }
      case 'match:state': {
        const match = events['match:state'].safeParse(data);
        if (!match.success) break;
        const fresh = match.data.matchId !== this.match?.matchId;
        this.match = match.data;
        if (fresh) this.lastView = undefined;
        if (match.data.view !== undefined) this.lastView = match.data.view;
        if (fresh) {
          this.result = null;
          this.sync();
        }
        this.client?.message('match:state', match.data);
        break;
      }
      case 'match:result': {
        const result = events['match:result'].safeParse(data);
        if (result.success) this.result = result.data;
        break;
      }
      case 'room:closed':
        this.room = null;
        this.match = null;
        break;
    }
  }

  /** A new Match or a new connection: the Game starts again from an `init`. */
  private sync() {
    if (this.headless) this.reportReady();
    else if (this.loaded) {
      this.sendInit();
      this.reportReady();
    }
  }

  /** Tells the server the Game is loaded for the current Match, once per Match. */
  private reportReady() {
    const match = this.match;
    if (!match || match.status === 'over' || this.reported === match.matchId) return;
    this.reported = match.matchId;
    this.request('match:ready', { matchId: match.matchId }).catch(() => {
      this.reported = null;
    });
  }

  private note(type: string, data?: unknown) {
    this.log.add({ player: this.index, source: 'harness', type, data });
  }
}
