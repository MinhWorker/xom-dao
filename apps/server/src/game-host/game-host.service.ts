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
import { GAME_UPDATING, type MatchTimer, type RoomOptions } from '@xomdao/shared';
import type { HostedGame, MatchStart, MatchState, MatchStatus } from './game-host.types.js';
import { GAME_SERVERS } from './games.js';

export const LOADING_TIMEOUT_MS = 30_000;

/** The platform's limits for every Match; a Game does not declare its own. */
export const MATCH_LIMITS = {
  hookWarnMs: 50,
  hookMs: 250,
  viewBytes: 64 * 1024,
  movesPerSecond: 10,
  matchMs: 2 * 60 * 60 * 1000,
  idleMs: 5 * 60 * 1000,
  seatHoldMs: 60 * 1000,
} as const;

interface ActiveMatch {
  start: MatchStart;
  status: MatchStatus;
  readyPlayerIds: Set<string>;
  disconnectedPlayerIds: string[];
  timer?: NodeJS.Timeout;
  /** Ends the Match at `MATCH_LIMITS.matchMs`. */
  lifeTimer?: NodeJS.Timeout;
  /** Ends the Match after `MATCH_LIMITS.idleMs` without a person's message. */
  idleTimer?: NodeJS.Timeout;
  gameTimer?: NodeJS.Timeout;
  gameTimerId?: number;
  gameTimerDeadline?: number;
  botTurn?: NodeJS.Immediate;
  rules?: GameRuntime;
  stored?: Stored<unknown, unknown>;
  rng?: Rng;
  views?: Map<string, unknown>;
  /** When each seat's moves of the last second arrived. */
  recentMoves: Map<string, number[]>;
  /** Seats kept for disconnected players, until `MATCH_LIMITS.seatHoldMs`. */
  holds: Map<string, NodeJS.Timeout>;
  /** People who left the Match: they place last and the computer may play their seat. */
  forfeited: Set<string>;
}

interface GameRuntime {
  setup(
    start: { players: RoomSeat[]; options: RoomOptions; lastResult: MatchResult | null },
    rng: Rng,
  ): Stored<unknown, unknown>;
  validateMove(stored: Stored<unknown, unknown>, move: GameEvent, playerId: string): string | null;
  applyMove(
    stored: Stored<unknown, unknown>,
    move: GameEvent,
    playerId: string,
    rng: Rng,
  ): Stored<unknown, unknown>;
  timer(stored: Stored<unknown, unknown>): PendingGameTimer | null;
  fireTimer(stored: Stored<unknown, unknown>, rng: Rng): Stored<unknown, unknown>;
  leave?(stored: Stored<unknown, unknown>, playerId: string, rng: Rng): Stored<unknown, unknown>;
  bot?(stored: Stored<unknown, unknown>, playerId: string, rng: Rng): GameEvent | null;
  view(stored: Stored<unknown, unknown>, playerId: string): unknown;
  result(stored: Stored<unknown, unknown>): MatchResult | null;
}

type PendingGameTimer = Pick<NonNullable<Stored<unknown, unknown>['timer']>, 'id' | 'event' | 'ms'>;

export class GameHostError extends Error {}

/** A Match broke one of `MATCH_LIMITS`: it is aborted. */
class LimitError extends Error {}

/** Loads Game servers and owns each Match's loading, playing and over transitions. */
@Injectable()
export class GameHostService implements OnModuleDestroy {
  private readonly servers: readonly HostedGame[];
  private readonly matches = new Map<string, ActiveMatch>();
  private readonly listeners = new Set<(match: MatchState) => void>();

  constructor(@Inject(GAME_SERVERS) gameServers: readonly HostedGame[]) {
    this.servers = gameServers;
    const ids = new Set<string>();
    for (const server of gameServers) {
      const id = server.manifest.id;
      if (ids.has(id)) throw new Error(`Duplicate Game server: ${id}`);
      ids.add(id);
    }
  }

  onModuleDestroy() {
    for (const match of this.matches.values()) this.clearMatchTimers(match);
    this.matches.clear();
  }

  /** The IDs of Game servers loaded in this process. */
  gameIds() {
    return this.servers.map(({ manifest }) => manifest.id).sort();
  }

  /** Refuses a Hub whose Game bundle was built from other Game server code. */
  checkVersion(gameId: string, version: unknown) {
    const server = this.server(gameId);
    if (server && server.version !== version) throw new GameHostError(GAME_UPDATING);
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
      recentMoves: new Map(),
      holds: new Map(),
      forfeited: new Set(),
    };
    this.matches.set(start.matchId, match);
    this.publish(match);

    if (this.allReady(match)) this.startPlaying(match, server);
    else {
      match.timer = setTimeout(() => {
        const missed = start.players
          .filter(
            ({ id }) => !match.readyPlayerIds.has(id) && !match.disconnectedPlayerIds.includes(id),
          )
          .map(({ id }) => id);
        match.disconnectedPlayerIds.push(...missed);
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
    if (match.status !== 'loading') {
      this.reconnect(matchId, playerId);
      this.heard(match, playerId);
      return this.snapshot(match);
    }

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
    if (match.forfeited.has(playerId)) throw new GameHostError('Bạn đã rời ván này');
    this.countMove(match, playerId);
    this.heard(match, playerId);

    try {
      this.applyMove(match, playerId, move);
    } catch (error) {
      if (error instanceof GameHostError) throw error;
      this.abort(match, error);
    }
  }

  /** A player left the Match: aborted while loading, otherwise their seat is forfeited. */
  leave(matchId: string, playerId: string) {
    const match = this.matches.get(matchId);
    if (!match) return;
    if (!match.start.players.some((player) => player.id === playerId)) {
      throw new GameHostError('Bạn không ngồi ở ván này');
    }
    if (match.status === 'loading') this.end(match, 'aborted');
    else if (match.status === 'playing') this.forfeit(match, playerId);
  }

  /**
   * A player lost their connection: their seat is held for `MATCH_LIMITS.seatHoldMs`, from when
   * the Match starts playing if it is still loading.
   */
  disconnect(matchId: string, playerId: string) {
    const match = this.matches.get(matchId);
    if (!match || match.status === 'over' || match.disconnectedPlayerIds.includes(playerId)) return;
    if (!match.start.players.some((player) => player.id === playerId && !player.bot)) return;
    match.disconnectedPlayerIds.push(playerId);
    if (match.status === 'playing') this.hold(match, playerId);
    this.publish(match);
  }

  /** A disconnected player is back: their held seat is theirs again. */
  reconnect(matchId: string, playerId: string) {
    const match = this.matches.get(matchId);
    if (!match?.disconnectedPlayerIds.includes(playerId)) return;
    this.release(match, playerId);
    match.disconnectedPlayerIds = match.disconnectedPlayerIds.filter((id) => id !== playerId);
    if (match.status !== 'playing') return;
    this.heard(match, playerId);
    this.publish(match);
  }

  /** Aborts a Match whose Room is gone, so its timers and bot turns stop. */
  stop(matchId: string) {
    const match = this.matches.get(matchId);
    if (match) this.end(match, 'aborted');
  }

  /** Refuses a seat's move past `MATCH_LIMITS.movesPerSecond`. */
  private countMove(match: ActiveMatch, playerId: string) {
    const now = Date.now();
    const recent = (match.recentMoves.get(playerId) ?? []).filter((at) => now - at < 1000);
    if (recent.length >= MATCH_LIMITS.movesPerSecond) {
      throw new GameHostError('Gửi nhanh quá, chậm lại một chút');
    }
    recent.push(now);
    match.recentMoves.set(playerId, recent);
  }

  /** A person sent something: the idle limit starts again. */
  private heard(match: ActiveMatch, playerId: string) {
    if (this.people(match).some((player) => player.id === playerId)) this.restartIdle(match);
  }

  /** People still playing: not computers and not gone from the Match. */
  private people(match: ActiveMatch) {
    return match.start.players.filter(({ id, bot }) => !bot && !match.forfeited.has(id));
  }

  private hold(match: ActiveMatch, playerId: string) {
    if (match.holds.has(playerId) || match.forfeited.has(playerId)) return;
    const timer = setTimeout(() => this.forfeit(match, playerId), MATCH_LIMITS.seatHoldMs);
    timer.unref();
    match.holds.set(playerId, timer);
  }

  private release(match: ActiveMatch, playerId: string) {
    clearTimeout(match.holds.get(playerId));
    match.holds.delete(playerId);
  }

  /**
   * The player is out of the Match. The computer plays their seat when the Game has one, else
   * the Game's leave hook runs; without either, or with no person left, the Match is aborted.
   */
  private forfeit(match: ActiveMatch, playerId: string) {
    if (match.status !== 'playing' || match.forfeited.has(playerId)) return;
    this.release(match, playerId);
    match.forfeited.add(playerId);
    const { rules, stored, rng } = match;
    if (!rules || !stored || !rng) return;
    if (this.people(match).length === 0) {
      this.abort(match, 'no person is left playing');
      return;
    }
    if (rules.bot) {
      this.scheduleBotTurn(match);
      return;
    }
    if (!rules.leave) {
      this.abort(match, `${playerId} left a Game without a leave hook`);
      return;
    }
    try {
      match.stored = rules.leave(stored, playerId, rng);
      this.updatePlaying(match);
    } catch (error) {
      this.abort(match, error);
    }
  }

  private restartIdle(match: ActiveMatch) {
    clearTimeout(match.idleTimer);
    match.idleTimer = setTimeout(
      () => this.abort(match, 'nobody sent anything for too long'),
      MATCH_LIMITS.idleMs,
    );
    match.idleTimer.unref();
  }

  private allReady(match: ActiveMatch) {
    return match.start.players.every((player) => match.readyPlayerIds.has(player.id));
  }

  private startPlaying(match: ActiveMatch, server: AnyGameServer) {
    clearTimeout(match.timer);
    try {
      const rules = createRuntime(server, match.start.gameId);
      const rng = seededRng(randomInt(0, 0x1_0000_0000));
      const stored = rules.setup(
        {
          players: match.start.players,
          options: match.start.options,
          lastResult: match.start.lastResult,
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
      match.status = 'playing';
      match.lifeTimer = setTimeout(
        () => this.abort(match, 'Match ran past its time limit'),
        MATCH_LIMITS.matchMs,
      );
      match.lifeTimer.unref();
      for (const playerId of match.disconnectedPlayerIds) this.hold(match, playerId);
      this.restartIdle(match);
      this.updatePlaying(match);
    } catch (error) {
      this.abort(match, error);
    }
  }

  private end(match: ActiveMatch, outcome: 'settled' | 'aborted', result?: MatchResult) {
    if (this.matches.get(match.start.matchId) !== match) return;
    this.matches.delete(match.start.matchId);
    this.clearMatchTimers(match);
    match.status = 'over';
    const ranked = result && rankForfeitsLast(result, match.forfeited);
    this.publish({ ...match, outcome, ...(ranked && { result: ranked }) });
  }

  private updatePlaying(match: ActiveMatch) {
    const { rules, stored } = match;
    if (!rules || !stored) throw new Error('Match has no Game state');
    const result = rules.result(stored);
    if (result) {
      this.end(match, 'settled', result);
      return;
    }
    this.refreshViews(match);
    this.scheduleGameTimer(match);
    this.publish(match);
    this.scheduleBotTurn(match);
  }

  private applyMove(match: ActiveMatch, playerId: string, move: GameEvent, fromBot = false) {
    const { rules, stored, rng } = match;
    if (!rules || !stored || !rng) throw new Error('Match has no Game state');
    const refusal = rules.validateMove(stored, move, playerId);
    if (refusal) {
      if (fromBot) throw new Error(`Game bot move was refused: ${refusal}`);
      throw new GameHostError(refusal);
    }
    match.stored = rules.applyMove(stored, move, playerId, rng);
    this.updatePlaying(match);
  }

  private scheduleGameTimer(match: ActiveMatch) {
    const { rules, stored, rng } = match;
    if (!rules || !stored || !rng) return;
    const timer = rules.timer(stored);
    if (timer && match.gameTimer && match.gameTimerId === timer.id) return;
    clearTimeout(match.gameTimer);
    match.gameTimer = undefined;
    match.gameTimerId = undefined;
    match.gameTimerDeadline = undefined;
    if (!timer) return;
    if (!Number.isFinite(timer.ms) || timer.ms < 0)
      throw new Error('Game timer duration is invalid');

    const deadline = Date.now() + timer.ms;
    match.gameTimerId = timer.id;
    match.gameTimerDeadline = deadline;
    match.gameTimer = setTimeout(
      () => {
        if (match.gameTimerId !== timer.id) return;
        match.gameTimer = undefined;
        match.gameTimerId = undefined;
        match.gameTimerDeadline = undefined;
        if (match.status !== 'playing' || !match.rules || !match.stored || !match.rng) return;
        if (match.rules.timer(match.stored)?.id !== timer.id) return;
        try {
          match.stored = match.rules.fireTimer(match.stored, match.rng);
          this.updatePlaying(match);
        } catch (error) {
          this.abort(match, error);
        }
      },
      Math.max(0, deadline - Date.now()),
    );
    match.gameTimer.unref();
  }

  private scheduleBotTurn(match: ActiveMatch) {
    if (match.botTurn || match.status !== 'playing' || !match.rules?.bot) return;
    match.botTurn = setImmediate(() => {
      match.botTurn = undefined;
      if (match.status !== 'playing' || !match.rules?.bot || !match.stored || !match.rng) return;
      try {
        for (const player of match.start.players) {
          if (!player.bot && !match.forfeited.has(player.id)) continue;
          const move = match.rules.bot(match.stored, player.id, match.rng);
          if (move) {
            this.applyMove(match, player.id, move, true);
            return;
          }
        }
      } catch (error) {
        this.abort(match, error);
      }
    });
  }

  /** Logs why the Match is aborted, with the Game's id, and ends it. */
  private abort(match: ActiveMatch, reason: unknown) {
    console.error(`Game ${match.start.gameId} aborted Match ${match.start.matchId}:`, reason);
    this.end(match, 'aborted');
  }

  private clearMatchTimers(match: ActiveMatch) {
    clearTimeout(match.timer);
    clearTimeout(match.lifeTimer);
    clearTimeout(match.idleTimer);
    clearTimeout(match.gameTimer);
    clearImmediate(match.botTurn);
    for (const hold of match.holds.values()) clearTimeout(hold);
    match.holds.clear();
    match.timer = undefined;
    match.lifeTimer = undefined;
    match.idleTimer = undefined;
    match.gameTimer = undefined;
    match.gameTimerId = undefined;
    match.gameTimerDeadline = undefined;
    match.botTurn = undefined;
  }

  private refreshViews(match: ActiveMatch) {
    const { rules, stored } = match;
    if (!rules || !stored) throw new Error('Match has no Game state');
    match.views = new Map(
      match.start.players.map(({ id }) => {
        const view = rules.view(stored, id);
        const bytes = Buffer.byteLength(JSON.stringify(view) ?? '');
        if (bytes > MATCH_LIMITS.viewBytes) throw new LimitError(`view is ${bytes} bytes`);
        return [id, view];
      }),
    );
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
      timer: this.timerSnapshot(match),
    };
  }

  private timerSnapshot(match: ActiveMatch): MatchTimer | null {
    if (match.status !== 'playing' || !match.rules || !match.stored) return null;
    const timer = match.rules.timer(match.stored);
    if (!timer) return null;
    return { ...timer, deadline: match.gameTimerDeadline ?? Date.now() + timer.ms };
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

/**
 * Puts players who left last, whatever place the Game gave them; the others keep their order,
 * tied places sharing a rank (`[1, 1, 3]`).
 */
function rankForfeitsLast(result: MatchResult, forfeited: ReadonlySet<string>): MatchResult {
  if (!result.seats.some(({ player }) => forfeited.has(player))) return result;
  const staying = result.seats.filter(({ player }) => !forfeited.has(player));
  return {
    ...result,
    seats: result.seats.map((seat) => ({
      ...seat,
      place: forfeited.has(seat.player)
        ? staying.length + 1
        : 1 + staying.filter((other) => other.place < seat.place).length,
    })),
  };
}

/** Times one Game hook: slow ones are logged, too slow ones break `MATCH_LIMITS.hookMs`. */
function timed<T>(gameId: string, hook: string, fn: () => T): T {
  const started = performance.now();
  const value = fn();
  const ms = performance.now() - started;
  if (ms > MATCH_LIMITS.hookMs) throw new LimitError(`${hook} took ${Math.round(ms)} ms`);
  if (ms > MATCH_LIMITS.hookWarnMs) {
    console.warn(`Game ${gameId}: ${hook} took ${Math.round(ms)} ms`);
  }
  return value;
}

function createRuntime(server: AnyGameServer, gameId: string): GameRuntime {
  const game = server.game as unknown as Game<unknown, unknown, unknown>;
  const rules = turnRules(game);
  const { leave, bot } = rules;
  return {
    setup: (start, rng) => timed(gameId, 'setup', () => rules.setup(start, rng)),
    validateMove: (stored, move, playerId) =>
      timed(gameId, 'validateMove', () => rules.validateMove(stored, move, playerId)),
    applyMove: (stored, move, playerId, rng) =>
      timed(gameId, move.event, () => rules.applyMove(stored, move, playerId, rng)),
    timer: (stored) => {
      const timer = timed(gameId, 'timer', () => rules.timer(stored));
      return timer && { id: timer.id, event: timer.event, ms: timer.ms };
    },
    fireTimer: (stored, rng) => timed(gameId, 'fireTimer', () => rules.fireTimer(stored, rng)),
    leave:
      leave &&
      ((stored, playerId, rng) => timed(gameId, 'leave', () => leave(stored, playerId, rng))),
    bot: bot && ((stored, playerId, rng) => timed(gameId, 'bot', () => bot(stored, playerId, rng))),
    view: (stored, playerId) => timed(gameId, 'view', () => rules.view(stored, playerId)),
    result: (stored) => timed(gameId, 'result', () => rules.result(stored)),
  };
}
