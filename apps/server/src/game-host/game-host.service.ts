import { randomInt } from 'node:crypto';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
  type AnyGameServer,
  type Game,
  type GameEvent,
  isRealtimeGame,
  type MatchResult,
  REALTIME_INPUT_EVENT,
  type RealtimeGame,
  type RealtimeInput,
  type RealtimeStored,
  type Rng,
  type RoomSeat,
  realtimeRules,
  type Stored,
  seededRng,
  turnRules,
} from '@xomdao/sdk';
import {
  GAME_UPDATING,
  type MatchResultNotice,
  type MatchTimer,
  type RoomOptions,
} from '@xomdao/shared';
import { ResultsService } from '../results/results.service.js';
import type { HostedGame, MatchStart, MatchState, MatchStatus } from './game-host.types.js';
import { GAME_SERVERS } from './games.js';

export const LOADING_TIMEOUT_MS = 30_000;

/** The platform's limits for every Match; a Game does not declare its own. */
export const MATCH_LIMITS = {
  hookWarnMs: 50,
  hookMs: 250,
  viewBytes: 64 * 1024,
  movesPerSecond: 10,
  /** A seat's inputs per second in a Realtime Match, and the most JSON bytes of one. */
  inputsPerSecond: 60,
  inputBytes: 2 * 1024,
  /** Ticks run at once to catch up after a delay; a longer delay is dropped, not replayed. */
  catchUpTicks: 5,
  matchMs: 2 * 60 * 60 * 1000,
  idleMs: 5 * 60 * 1000,
  seatHoldMs: 60 * 1000,
} as const;

interface ActiveMatch {
  start: MatchStart;
  startedAt: number;
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
  /** A Realtime Match runs these instead of `rules` and `stored`. */
  realtime?: RealtimeRuntime;
  realtimeStored?: RealtimeStored<unknown, unknown>;
  /** Inputs that arrived since the last tick, by seat. */
  inputs: Map<string, RealtimeInput[]>;
  tickTimer?: NodeJS.Timeout;
  nextTickAt: number;
  /** What the last snapshot was from: its tick and each seat's last applied `seq`. */
  sync?: { tick: number; acks: Record<string, number> };
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

interface RealtimeRuntime {
  tickRate: number;
  snapshotEvery: number;
  parseInput(payload: unknown): RealtimeInput | null;
  setup(
    start: { players: RoomSeat[]; options: RoomOptions; lastResult: MatchResult | null },
    rng: Rng,
  ): RealtimeStored<unknown, unknown>;
  applyInput(
    stored: RealtimeStored<unknown, unknown>,
    playerId: string,
    input: RealtimeInput,
    rng: Rng,
  ): RealtimeStored<unknown, unknown>;
  tick(stored: RealtimeStored<unknown, unknown>, rng: Rng): RealtimeStored<unknown, unknown>;
  leave?(
    stored: RealtimeStored<unknown, unknown>,
    playerId: string,
    rng: Rng,
  ): RealtimeStored<unknown, unknown>;
  bot?(stored: RealtimeStored<unknown, unknown>, playerId: string, rng: Rng): RealtimeInput | null;
  view(stored: RealtimeStored<unknown, unknown>, playerId: string): unknown;
  result(stored: RealtimeStored<unknown, unknown>): MatchResult | null;
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
  private readonly resultListeners = new Set<(notice: MatchResultNotice) => void>();

  constructor(
    @Inject(GAME_SERVERS) gameServers: readonly HostedGame[],
    private readonly results: ResultsService,
  ) {
    this.servers = gameServers;
    const ids = new Set<string>();
    for (const server of gameServers) {
      const id = server.manifest.id;
      if (ids.has(id)) throw new Error(`Duplicate Game server: ${id}`);
      ids.add(id);
      if (
        server.manifest.bots &&
        isRealtimeGame(server.game) &&
        typeof (server.game as { bot?: unknown }).bot !== 'function'
      ) {
        throw new Error(
          `Game server ${id}: its manifest says bots but its Realtime game has no bot`,
        );
      }
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

  /** A listener receives each settled Match's result once `ResultsService` has recorded it. */
  onResult(listener: (notice: MatchResultNotice) => void) {
    this.resultListeners.add(listener);
    return () => this.resultListeners.delete(listener);
  }

  /** Starts a Match in `loading`; all human seats must be ready before the Game starts. */
  startMatch(start: MatchStart): MatchState {
    const server = this.server(start.gameId);
    if (!server) throw new GameHostError('Game server không có sẵn');
    if (this.matches.has(start.matchId)) throw new GameHostError('Mã ván đã được sử dụng');

    const match: ActiveMatch = {
      start,
      startedAt: Date.now(),
      status: 'loading',
      readyPlayerIds: new Set(start.players.filter((player) => player.bot).map((p) => p.id)),
      disconnectedPlayerIds: [],
      inputs: new Map(),
      nextTickAt: 0,
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

  /** The `ack` of a Realtime Match's last snapshot: the last input `seq` applied for the seat. */
  ack(matchId: string, playerId: string) {
    const match = this.matches.get(matchId);
    return match?.status === 'playing' ? match.sync?.acks[playerId] : undefined;
  }

  /**
   * Applies one validated Game move and settles or aborts the Match when its rules end. In a
   * Realtime Match the move is the `input` event: it is queued for the next tick.
   */
  move(matchId: string, playerId: string, move: GameEvent) {
    const match = this.matches.get(matchId);
    if (match?.status !== 'playing') throw new GameHostError('Ván chưa bắt đầu');
    if (match.forfeited.has(playerId)) throw new GameHostError('Bạn đã rời ván này');
    if (match.realtime) {
      this.queueInput(match, match.realtime, playerId, move);
      return;
    }
    if (!match.rules || !match.stored || !match.rng) throw new GameHostError('Ván chưa bắt đầu');
    this.countMove(match, playerId, MATCH_LIMITS.movesPerSecond);
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

  /** Queues a seat's input for the next tick, within `MATCH_LIMITS`' input rate and size. */
  private queueInput(
    match: ActiveMatch,
    realtime: RealtimeRuntime,
    playerId: string,
    move: GameEvent,
  ) {
    if (!match.start.players.some(({ id }) => id === playerId)) {
      throw new GameHostError('Bạn không ngồi ở ván này');
    }
    if (move.event !== REALTIME_INPUT_EVENT) throw new GameHostError('Nước đi không hợp lệ');
    const bytes = Buffer.byteLength(JSON.stringify(move.payload) ?? '');
    if (bytes > MATCH_LIMITS.inputBytes) throw new GameHostError('Input quá lớn');
    this.countMove(match, playerId, MATCH_LIMITS.inputsPerSecond);
    this.heard(match, playerId);
    const input = realtime.parseInput(move.payload);
    if (!input) throw new GameHostError('Nước đi không hợp lệ');
    match.inputs.set(playerId, [...(match.inputs.get(playerId) ?? []), input]);
  }

  /** Refuses a seat's move past `limit` within one second. */
  private countMove(match: ActiveMatch, playerId: string, limit: number) {
    const now = Date.now();
    const recent = (match.recentMoves.get(playerId) ?? []).filter((at) => now - at < 1000);
    if (recent.length >= limit) {
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
    match.inputs.delete(playerId);
    const { rules, stored, rng } = match;
    if (this.people(match).length === 0) {
      this.abort(match, 'no person is left playing');
      return;
    }
    if (match.realtime && match.realtimeStored && rng) {
      if (match.realtime.bot) return;
      this.forfeitRealtime(match, match.realtime, match.realtimeStored, playerId, rng);
      return;
    }
    if (!rules || !stored || !rng) return;
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

  /** A Realtime game without `bot`: the Game's leave hook runs, else the Match is aborted. */
  private forfeitRealtime(
    match: ActiveMatch,
    realtime: RealtimeRuntime,
    stored: RealtimeStored<unknown, unknown>,
    playerId: string,
    rng: Rng,
  ) {
    if (!realtime.leave) {
      this.abort(match, `${playerId} left a Game without a leave hook`);
      return;
    }
    try {
      match.realtimeStored = realtime.leave(stored, playerId, rng);
      const result = realtime.result(match.realtimeStored);
      if (result) this.end(match, 'settled', result);
      else this.snapshotRealtime(match);
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
      const rng = seededRng(randomInt(0, 0x1_0000_0000));
      const first = {
        players: match.start.players,
        options: match.start.options,
        lastResult: match.start.lastResult,
      };
      let result: MatchResult | null;
      if (isRealtimeGame(server.game)) {
        const realtime = createRealtimeRuntime(server, match.start.gameId);
        const stored = realtime.setup(first, rng);
        result = realtime.result(stored);
        match.realtime = realtime;
        match.realtimeStored = stored;
      } else {
        const rules = createRuntime(server, match.start.gameId);
        const stored = rules.setup(first, rng);
        result = rules.result(stored);
        match.rules = rules;
        match.stored = stored;
      }
      if (result) {
        this.end(match, 'settled', result);
        return;
      }
      match.rng = rng;
      match.status = 'playing';
      match.lifeTimer = setTimeout(
        () => this.abort(match, 'Match ran past its time limit'),
        MATCH_LIMITS.matchMs,
      );
      match.lifeTimer.unref();
      for (const playerId of match.disconnectedPlayerIds) this.hold(match, playerId);
      this.restartIdle(match);
      if (match.realtime) {
        this.snapshotRealtime(match);
        this.startTicking(match, match.realtime);
      } else this.updatePlaying(match);
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
    if (ranked) this.settle(match, ranked);
  }

  /** Hands the result to `ResultsService`; the Room hears of it only once it is recorded. */
  private settle(match: ActiveMatch, result: MatchResult) {
    const { matchId, roomCode, gameId, players } = match.start;
    this.results
      .settle({
        gameId,
        matchId,
        startedAt: match.startedAt,
        endedAt: Date.now(),
        seats: players.map(({ id, name, avatar, bot }) => ({
          id,
          name,
          ...(avatar && { avatar }),
          bot,
          left: match.forfeited.has(id),
        })),
        result,
      })
      .then(
        (recorded) => {
          if (!recorded) return;
          const notice = { roomCode, matchId, gameId, seats: result.seats };
          for (const listener of this.resultListeners) {
            try {
              listener(notice);
            } catch (error) {
              console.error('GameHostModule result listener failed', error);
            }
          }
        },
        (error: unknown) => console.error(`Settling Match ${matchId} of ${gameId} failed:`, error),
      );
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

  /** Starts a Realtime Match's fixed tick, one every 1 / `tickRate` s from now. */
  private startTicking(match: ActiveMatch, realtime: RealtimeRuntime) {
    match.nextTickAt = Date.now() + 1000 / realtime.tickRate;
    this.scheduleTick(match);
  }

  private scheduleTick(match: ActiveMatch) {
    const delay = Math.max(0, Math.ceil(match.nextTickAt - Date.now()));
    match.tickTimer = setTimeout(() => this.runDueTicks(match), delay);
    match.tickTimer.unref();
  }

  /**
   * Runs the ticks that are due, at most `MATCH_LIMITS.catchUpTicks` after a delay; a longer
   * delay is dropped so a slow server does not spend its time replaying ticks.
   */
  private runDueTicks(match: ActiveMatch) {
    match.tickTimer = undefined;
    const { realtime } = match;
    if (match.status !== 'playing' || !realtime) return;
    const interval = 1000 / realtime.tickRate;
    const now = Date.now();
    for (let ran = 0; match.nextTickAt <= now && ran < MATCH_LIMITS.catchUpTicks; ran++) {
      match.nextTickAt += interval;
      if (!this.tickOnce(match, realtime)) return;
    }
    if (match.nextTickAt <= now) match.nextTickAt = now + interval;
    this.scheduleTick(match);
  }

  /**
   * One tick: the queued inputs, the computer seats' inputs (and the seats of people who left),
   * then the Game's `tick`. False once the Match is over.
   */
  private tickOnce(match: ActiveMatch, realtime: RealtimeRuntime) {
    const { realtimeStored, rng } = match;
    if (!realtimeStored || !rng) return false;
    try {
      let stored = realtimeStored;
      for (const [playerId, inputs] of match.inputs) {
        for (const input of inputs) stored = realtime.applyInput(stored, playerId, input, rng);
      }
      match.inputs.clear();
      if (realtime.bot) {
        for (const { id, bot } of match.start.players) {
          if (!bot && !match.forfeited.has(id)) continue;
          const move = realtime.bot(stored, id, rng);
          if (move) stored = realtime.applyInput(stored, id, move, rng);
        }
      }
      stored = realtime.tick(stored, rng);
      match.realtimeStored = stored;
      const result = realtime.result(stored);
      if (result) {
        this.end(match, 'settled', result);
        return false;
      }
      if (stored.tick % realtime.snapshotEvery === 0) this.snapshotRealtime(match);
      return true;
    } catch (error) {
      this.abort(match, error);
      return false;
    }
  }

  /** Sends every member the Realtime Match's views as of now, with the tick and their `ack`. */
  private snapshotRealtime(match: ActiveMatch) {
    const stored = match.realtimeStored;
    if (!stored) throw new Error('Match has no Game state');
    this.refreshViews(match);
    match.sync = { tick: stored.tick, acks: { ...stored.acks } };
    this.publish(match);
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
    clearTimeout(match.tickTimer);
    clearImmediate(match.botTurn);
    for (const hold of match.holds.values()) clearTimeout(hold);
    match.holds.clear();
    match.timer = undefined;
    match.lifeTimer = undefined;
    match.idleTimer = undefined;
    match.gameTimer = undefined;
    match.gameTimerId = undefined;
    match.gameTimerDeadline = undefined;
    match.tickTimer = undefined;
    match.botTurn = undefined;
  }

  private refreshViews(match: ActiveMatch) {
    const { rules, stored, realtime, realtimeStored } = match;
    const viewOf = (id: string) =>
      realtime && realtimeStored
        ? realtime.view(realtimeStored, id)
        : rules && stored
          ? rules.view(stored, id)
          : undefined;
    if (!(rules && stored) && !(realtime && realtimeStored)) {
      throw new Error('Match has no Game state');
    }
    match.views = new Map(
      match.start.players.map(({ id }) => {
        const view = viewOf(id);
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
      ...(match.sync && { tick: match.sync.tick }),
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

/** A Realtime Game server's rules with each hook timed against `MATCH_LIMITS`. */
function createRealtimeRuntime(server: AnyGameServer, gameId: string): RealtimeRuntime {
  const game = server.game as unknown as RealtimeGame<unknown, unknown, unknown, unknown>;
  const rules = realtimeRules(game);
  const { leave, bot } = rules;
  return {
    tickRate: rules.tickRate,
    snapshotEvery: rules.snapshotEvery,
    parseInput: (payload) => timed(gameId, 'parseInput', () => rules.parseInput(payload)),
    setup: (start, rng) => timed(gameId, 'init', () => rules.setup(start, rng)),
    applyInput: (stored, playerId, input, rng) =>
      timed(gameId, 'input', () => rules.applyInput(stored, playerId, input, rng)),
    tick: (stored, rng) => timed(gameId, 'tick', () => rules.tick(stored, rng)),
    leave:
      leave &&
      ((stored, playerId, rng) => timed(gameId, 'leave', () => leave(stored, playerId, rng))),
    bot: bot && ((stored, playerId, rng) => timed(gameId, 'bot', () => bot(stored, playerId, rng))),
    view: (stored, playerId) => timed(gameId, 'view', () => rules.view(stored, playerId)),
    result: (stored) => rules.result(stored),
  };
}
