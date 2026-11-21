import { randomInt } from 'node:crypto';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
  type AnyGameServer,
  type Game,
  type GameEvent,
  type MatchResult,
  type Rng,
  type RoomSeat,
  type Stored,
  seededRng,
  turnRules,
} from '@xomdao/sdk';
import type { RoomOptions } from '@xomdao/shared';
import type { MatchStart, MatchState, MatchStatus } from './game-host.types.js';
import { GAME_SERVERS } from './games.js';

export const LOADING_TIMEOUT_MS = 30_000;

interface ActiveMatch {
  start: MatchStart;
  status: MatchStatus;
  readyPlayerIds: Set<string>;
  disconnectedPlayerIds: string[];
  timer?: NodeJS.Timeout;
  rules?: GameRuntime;
  stored?: Stored<unknown, unknown>;
  rng?: Rng;
  views?: Map<string, unknown>;
}

interface GameRuntime {
  setup(start: { players: RoomSeat[]; options: RoomOptions }, rng: Rng): Stored<unknown, unknown>;
  validateMove(stored: Stored<unknown, unknown>, move: GameEvent, playerId: string): string | null;
  applyMove(
    stored: Stored<unknown, unknown>,
    move: GameEvent,
    playerId: string,
    rng: Rng,
  ): Stored<unknown, unknown>;
  view(stored: Stored<unknown, unknown>, playerId: string): unknown;
  result(stored: Stored<unknown, unknown>): MatchResult | null;
}

export class GameHostError extends Error {}

/** Loads Game servers and owns each Match's loading, playing and over transitions. */
@Injectable()
export class GameHostService implements OnModuleDestroy {
  private readonly servers: readonly AnyGameServer[];
  private readonly matches = new Map<string, ActiveMatch>();
  private readonly listeners = new Set<(match: MatchState) => void>();

  constructor(@Inject(GAME_SERVERS) gameServers: readonly AnyGameServer[]) {
    this.servers = gameServers;
    const ids = new Set<string>();
    for (const server of gameServers) {
      const id = server.manifest.id;
      if (ids.has(id)) throw new Error(`Duplicate Game server: ${id}`);
      ids.add(id);
    }
  }

  onModuleDestroy() {
    for (const match of this.matches.values()) clearTimeout(match.timer);
    this.matches.clear();
  }

  /** The IDs of Game servers loaded in this process. */
  gameIds() {
    return this.servers.map(({ manifest }) => manifest.id).sort();
  }

  /** A listener receives every lifecycle transition, including the initial loading state. */
  onState(listener: (match: MatchState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts a Match in `loading`; all human seats must be ready before the Game starts. */
  startMatch(start: MatchStart): MatchState {
    const server = this.server(start.gameId);
    if (!server) throw new GameHostError('Game server không có sẵn');
    if (this.matches.has(start.matchId)) throw new GameHostError('Mã ván đã được sử dụng');

    const match: ActiveMatch = {
      start,
      status: 'loading',
      readyPlayerIds: new Set(start.players.filter((player) => player.bot).map((p) => p.id)),
      disconnectedPlayerIds: [],
    };
    this.matches.set(start.matchId, match);
    this.publish(match);

    if (this.allReady(match)) this.startPlaying(match, server);
    else {
      match.timer = setTimeout(() => {
        match.disconnectedPlayerIds = start.players
          .filter((player) => !match.readyPlayerIds.has(player.id))
          .map((player) => player.id);
        this.startPlaying(match, server);
      }, LOADING_TIMEOUT_MS);
      match.timer.unref();
    }
    return this.snapshot(match);
  }

  /** Marks one seated player ready and starts the Game once every seat has loaded. */
  ready(matchId: string, playerId: string) {
    const match = this.matches.get(matchId);
    if (!match) throw new GameHostError('Ván không còn nữa');
    if (!match.start.players.some((player) => player.id === playerId)) {
      throw new GameHostError('Bạn không ngồi ở ván này');
    }
    if (match.status !== 'loading') return this.snapshot(match);

    match.readyPlayerIds.add(playerId);
    if (this.allReady(match)) {
      const server = this.server(match.start.gameId);
      if (!server) throw new Error(`Game server unloaded during Match: ${match.start.gameId}`);
      this.startPlaying(match, server);
    }
    return this.snapshot(match);
  }

  /** The current lifecycle state of a Match, or `undefined` once it is over. */
  match(matchId: string) {
    const match = this.matches.get(matchId);
    return match && this.snapshot(match);
  }

  /** The Game's viewer-specific snapshot while a Match is playing. */
  view(matchId: string, playerId: string) {
    const match = this.matches.get(matchId);
    if (match?.status !== 'playing') return undefined;
    return match.views?.get(playerId);
  }

  /** Applies one validated Game move and settles or aborts the Match when its rules end. */
  move(matchId: string, playerId: string, move: GameEvent) {
    const match = this.matches.get(matchId);
    if (match?.status !== 'playing' || !match.rules || !match.stored || !match.rng) {
      throw new GameHostError('Ván chưa bắt đầu');
    }

    try {
      const refusal = match.rules.validateMove(match.stored, move, playerId);
      if (refusal) throw new GameHostError(refusal);
      match.stored = match.rules.applyMove(match.stored, move, playerId, match.rng);
      const result = match.rules.result(match.stored);
      if (result) {
        this.end(match, 'settled', result);
        return;
      }
      this.refreshViews(match);
      this.publish(match);
    } catch (error) {
      if (error instanceof GameHostError) throw error;
      console.error(`Game ${match.start.gameId} aborted Match ${match.start.matchId}`, error);
      this.end(match, 'aborted');
    }
  }

  private allReady(match: ActiveMatch) {
    return match.start.players.every((player) => match.readyPlayerIds.has(player.id));
  }

  private startPlaying(match: ActiveMatch, server: AnyGameServer) {
    clearTimeout(match.timer);
    try {
      const rules = createRuntime(server);
      const rng = seededRng(randomInt(0, 0x1_0000_0000));
      const stored = rules.setup(
        {
          players: match.start.players,
          options: match.start.options,
        },
        rng,
      );
      const result = rules.result(stored);
      if (result) {
        this.end(match, 'settled', result);
        return;
      }
      match.rules = rules;
      match.stored = stored;
      match.rng = rng;
      this.refreshViews(match);
      match.status = 'playing';
      this.publish(match);
    } catch (error) {
      console.error(`Game ${match.start.gameId} aborted Match ${match.start.matchId}`, error);
      this.end(match, 'aborted');
    }
  }

  private end(match: ActiveMatch, outcome: 'settled' | 'aborted', result?: MatchResult) {
    clearTimeout(match.timer);
    this.publish({ ...match, status: 'over', outcome, ...(result && { result }) });
    this.matches.delete(match.start.matchId);
  }

  private refreshViews(match: ActiveMatch) {
    const { rules, stored } = match;
    if (!rules || !stored) throw new Error('Match has no Game state');
    match.views = new Map(match.start.players.map(({ id }) => [id, rules.view(stored, id)]));
  }

  private server(gameId: string) {
    return this.servers.find(({ manifest }) => manifest.id === gameId);
  }

  private snapshot(match: ActiveMatch): MatchState {
    return {
      matchId: match.start.matchId,
      roomCode: match.start.roomCode,
      gameId: match.start.gameId,
      status: match.status,
      disconnectedPlayerIds: [...match.disconnectedPlayerIds],
    };
  }

  private publish(match: ActiveMatch & { outcome?: 'settled' | 'aborted'; result?: MatchResult }) {
    const snapshot = {
      ...this.snapshot(match),
      ...(match.outcome && { outcome: match.outcome }),
      ...(match.result && { result: match.result }),
    };
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('GameHostModule listener failed', error);
      }
    }
  }
}

function createRuntime(server: AnyGameServer): GameRuntime {
  const game = server.game as unknown as Game<unknown, unknown, unknown>;
  const rules = turnRules(game);
  return {
    setup(start, rng) {
      return rules.setup({ ...start, lastResult: null }, rng);
    },
    validateMove: (stored, move, playerId) => rules.validateMove(stored, move, playerId),
    applyMove: (stored, move, playerId, rng) => rules.applyMove(stored, move, playerId, rng),
    view: (stored, playerId) => rules.view(stored, playerId),
    result: (stored) => rules.result(stored),
  };
}
