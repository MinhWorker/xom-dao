/**
 * A Realtime game's server part: a class whose Match state advances on a fixed server tick,
 * whatever the players do.
 *
 *   class DriftGame extends RealtimeGame<State, Input> {
 *     readonly tickRate = 20;                                   // ticks per second (up to 60)
 *     readonly snapshotRate = 10;                               // views per second (10–20)
 *     readonly inputSchema = z.object({ dir: z.enum(['left', 'right']) });
 *     init(ctx) { return { x: ctx.players.map(() => 0) }; }     // the Match's first state
 *     input(ctx) {                                              // a player's input, at the next tick
 *       return { x: ctx.state.x.map((x, i) => (i === ctx.player.seat ? x + 1 : x)) };
 *     }
 *     tick(ctx) { return { x: ctx.state.x.map((x) => x + ctx.dt) }; }   // ctx.dt: seconds a tick lasts
 *     result(ctx) {                                             // null while the Match goes on
 *       return ctx.state.x[0]! > 100 ? { places: ctx.players.map((_, i) => i + 1) } : null;
 *     }
 *   }
 *
 * The server runs `tick` every 1 / `tickRate` s. A player's input (`seq` counts up from 0 in each
 * client) waits for the next tick, where `input` runs for each of them in arrival order before
 * `tick`; an input whose `seq` is not above the last one applied for that seat is dropped. Every
 * `tickRate / snapshotRate` ticks the server sends each member `view(ctx, viewer)` as a
 * snapshot, with the tick it is from and, for the viewer, the last `seq` applied (`ack`): the
 * client may replay its unacknowledged inputs on top of the snapshot. Clients always
 * interpolate what other players do and draw about 100 ms late.
 *
 * Hooks are pure like a Turn-based game's: they never change `ctx.state` and take randomness only
 * from `ctx.rng`. `result(ctx)` runs after `init` and after every tick: places like
 * `ctx.finish`'s (tied seats share a place), with `scores` and `stats` (what `ctx.stat` counts)
 * optional. The platform's limits (`MATCH_LIMITS`: hook time, view size, inputs per second and
 * their size) apply as to a Turn-based game, and a hook that throws aborts only that Match.
 *
 * Optional hooks, written in the subclass (not declared here, so no `override`):
 *   bot(ctx: RealtimeBotContext)        the computer's input for seat ctx.player, or null to
 *                                       keep what it last sent. Asked every tick for each
 *                                       computer seat (and for a person who left), after the
 *                                       people's inputs and before `tick`, so it is a pure
 *                                       function of the state; keep its memory in the state.
 *                                       A Game with it says `bots: true` in its manifest.
 *   onLeave(ctx: RealtimeLeaveContext)  a player left; the Match goes on without them
 *                                       (without it, a player leaving aborts the Match; with
 *                                       `bot`, the computer takes their seat instead)
 *   view(ctx, viewer: Seat | null)      what a seat (null = spectator) sees. Default: the state.
 *
 * Its clients send an input as the Match move `input` with data `{ seq, input }`.
 */
import { z } from 'zod';
import {
  type MatchResult,
  type MatchStart,
  type PlayerId,
  type RoomSeat,
  type Seat,
  STAT_NAME,
  type Stat,
  seatResults,
} from './game.js';
import type { GameManifest } from './manifest.js';
import { type Rng, seededRng } from './rng.js';

/** The Match move a client sends an input with. */
export const REALTIME_INPUT_EVENT = 'input';

/** Snapshots per second a Realtime game may send. */
export const SNAPSHOT_RATE = { min: 10, max: 20 } as const;
/** The most ticks per second a Realtime game may ask for. */
export const MAX_TICK_RATE = 60;

/** What every Realtime hook gets. */
export interface RealtimeContext<State, Options = undefined> {
  /** The Match state now. Read it; return a new one from the hook. */
  state: State;
  /** Everyone seated when the Match began, in seat order (`left` set for who has gone). */
  players: Seat[];
  /** The Room's options (from the Game manifest's `options`). */
  options: Options;
  /** How the Room's previous Match ended; `null` for the first or when the seats changed. */
  lastResult: MatchResult | null;
  /** Randomness: a float in [0, 1). Never use Math.random. */
  rng: Rng;
  /** Ticks run so far: 0 in the first tick and in `init`. */
  tick: number;
  /** Seconds one tick lasts, `1 / tickRate`. */
  dt: number;
}

/** The first state has no `state` and no tick yet. */
export type InitContext<Options = undefined> = Omit<
  RealtimeContext<never, Options>,
  'state' | 'tick'
>;

/** What `input` gets on top: who sent it, its `seq` and its data, checked against `inputSchema`. */
export interface InputContext<State, Input, Options = undefined>
  extends RealtimeContext<State, Options> {
  player: Seat;
  seq: number;
  input: Input;
}

/** What `onLeave` gets: who left (already marked `left`). */
export interface RealtimeLeaveContext<State, Options = undefined>
  extends RealtimeContext<State, Options> {
  player: Seat;
}

/** What `bot` gets: which computer seat is asked. */
export interface RealtimeBotContext<State, Options = undefined>
  extends RealtimeContext<State, Options> {
  player: Seat;
}

/** How a Realtime Match ended: `places[i]` is seat i's place, as in `ctx.finish`. */
export interface RealtimeOutcome {
  places: readonly number[];
  scores?: readonly number[];
  stats?: readonly Stat[];
}

/** Base class of a Realtime game. See the header for what to declare and implement. */
export abstract class RealtimeGame<State, Input = unknown, Options = undefined, View = State> {
  /** Tells the server this is a Realtime game. */
  readonly kind = 'realtime' as const;
  /** Ticks per second: a whole number up to `MAX_TICK_RATE`, a multiple of `snapshotRate`. */
  abstract readonly tickRate: number;
  /** Snapshots per second: a whole number within `SNAPSHOT_RATE`. */
  abstract readonly snapshotRate: number;
  /** The shape of one player's input. */
  abstract readonly inputSchema: z.ZodType<Input>;

  /** A new Match begins: return its first state. */
  abstract init(ctx: InitContext<Options>): State;
  /** A player's input, run at the next tick before `tick`. */
  abstract input(ctx: InputContext<State, Input, Options>): State;
  /** One fixed step of `ctx.dt` seconds. */
  abstract tick(ctx: RealtimeContext<State, Options>): State;
  /** `null` while the Match goes on; otherwise how it ended. */
  abstract result(ctx: RealtimeContext<State, Options>): RealtimeOutcome | null;
}

/** A Realtime Game server pairs its static Hub manifest with the pure game the host ticks. */
export interface RealtimeGameServer<State, Input, Options = undefined, View = State> {
  manifest: GameManifest;
  game: RealtimeGame<State, Input, Options, View>;
}

/** Whether a Game server's `game` is a Realtime game. */
export function isRealtimeGame(game: unknown): game is RealtimeGame<unknown, unknown, unknown> {
  return (game as { kind?: unknown } | null)?.kind === 'realtime';
}

/** One input as the server queues it: `seq` and the data, already checked. */
export interface RealtimeInput {
  seq: number;
  input: unknown;
}

/** What the server keeps of a Realtime Match: its state plus bookkeeping the game doesn't see. */
export interface RealtimeStored<State, Options> {
  state: State;
  players: RoomSeat[];
  options: Options;
  lastResult: MatchResult | null;
  result: MatchResult | null;
  /** Players who left during the Match. */
  left: PlayerId[];
  /** Ticks run so far. */
  tick: number;
  /** The last `seq` applied for each seat that sent one. */
  acks: Record<PlayerId, number>;
}

/**
 * A `RealtimeGame` as plain functions over its stored Match, for the server's GameHostModule.
 * Built with `realtimeRules(game)`; games don't write it.
 */
export interface RealtimeRules<State, Options, View> {
  tickRate: number;
  snapshotRate: number;
  /** Ticks between two snapshots. */
  snapshotEvery: number;
  /** The checked input of a `{ seq, input }` payload, or `null` when it is malformed. */
  parseInput(payload: unknown): RealtimeInput | null;
  setup(start: MatchStart<Options>, rng: Rng): RealtimeStored<State, Options>;
  /** Runs the game's `input` hook now; a stale `seq` (not above the last) or unseated player changes nothing. */
  applyInput(
    stored: RealtimeStored<State, Options>,
    player: PlayerId,
    input: RealtimeInput,
    rng: Rng,
  ): RealtimeStored<State, Options>;
  /** One tick: runs `tick`, then `result`. */
  tick(stored: RealtimeStored<State, Options>, rng: Rng): RealtimeStored<State, Options>;
  /** What `player` sees (`null` = a spectator). */
  view(stored: RealtimeStored<State, Options>, player: PlayerId | null): View;
  seats(stored: RealtimeStored<State, Options>): Seat[];
  /** Missing when the game has no `onLeave`: then a player leaving aborts the Match. */
  leave?(
    stored: RealtimeStored<State, Options>,
    player: PlayerId,
    rng: Rng,
  ): RealtimeStored<State, Options>;
  /**
   * Missing when the game has no `bot`. The input the computer plays for `player` now, with the
   * next `seq` for the seat, or `null` when it keeps what it last sent. Throws if the game's
   * answer fails `inputSchema`.
   */
  bot?(stored: RealtimeStored<State, Options>, player: PlayerId, rng: Rng): RealtimeInput | null;
  /** `null` while the Match is being played. */
  result(stored: RealtimeStored<State, Options>): MatchResult | null;
}

interface OptionalHooks<State, Input, Options, View> {
  bot?(ctx: RealtimeBotContext<State, Options>): Input | null;
  onLeave?(ctx: RealtimeLeaveContext<State, Options>): State;
  view?(ctx: RealtimeContext<State, Options>, viewer: Seat | null): View;
}

const envelope = z.object({ seq: z.int().min(0), input: z.unknown() });

/** Turns a `RealtimeGame` into the functions the server runs. Throws when its rates are invalid. */
export function realtimeRules<State, Input, Options, View>(
  game: RealtimeGame<State, Input, Options, View>,
): RealtimeRules<State, Options, View> {
  const { tickRate, snapshotRate } = game;
  if (!Number.isInteger(tickRate) || tickRate < 1 || tickRate > MAX_TICK_RATE) {
    throw new Error(`tickRate must be a whole number from 1 to ${MAX_TICK_RATE}, not ${tickRate}`);
  }
  if (
    !Number.isInteger(snapshotRate) ||
    snapshotRate < SNAPSHOT_RATE.min ||
    snapshotRate > SNAPSHOT_RATE.max
  ) {
    throw new Error(
      `snapshotRate must be a whole number from ${SNAPSHOT_RATE.min} to ${SNAPSHOT_RATE.max}, not ${snapshotRate}`,
    );
  }
  if (tickRate % snapshotRate !== 0) {
    throw new Error(`tickRate ${tickRate} must be a multiple of snapshotRate ${snapshotRate}`);
  }
  const hooks = game as RealtimeGame<State, Input, Options, View> &
    OptionalHooks<State, Input, Options, View>;
  const dt = 1 / tickRate;

  const seats = (stored: Pick<RealtimeStored<State, Options>, 'players' | 'left'>) =>
    stored.players.map(
      ({ id, name, bot, avatar }, seat): Seat => ({
        id,
        name,
        bot,
        ...(avatar !== undefined && { avatar }),
        seat,
        left: stored.left.includes(id),
      }),
    );

  const context = (
    stored: Omit<RealtimeStored<State, Options>, 'result' | 'acks'>,
    rng: Rng,
  ): RealtimeContext<State, Options> => ({
    state: stored.state,
    players: seats(stored),
    options: stored.options,
    lastResult: stored.lastResult,
    rng,
    tick: stored.tick,
    dt,
  });

  /** Asks the game whether the Match is over and checks its answer. */
  const outcome = (stored: RealtimeStored<State, Options>, rng: Rng): MatchResult | null => {
    const done = game.result(context(stored, rng));
    if (!done) return null;
    const stats = [...(done.stats ?? [])];
    for (const { player, name, amount } of stats) {
      if (!stored.players.some((p) => p.id === player)) {
        throw new Error(`result: ${player} is not seated in this Match`);
      }
      if (!STAT_NAME.test(name)) {
        throw new Error(`result: "${name}" is not a stat name (lowercase-dash, e.g. chop)`);
      }
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error(`result: ${amount} is not a whole number above 0`);
      }
    }
    return {
      seats: seatResults(stored.players, done.places, done.scores),
      ...(stats.length && { stats }),
    };
  };

  const settled = (stored: RealtimeStored<State, Options>, rng: Rng) => ({
    ...stored,
    result: outcome(stored, rng),
  });

  return {
    tickRate,
    snapshotRate,
    snapshotEvery: tickRate / snapshotRate,

    parseInput(payload) {
      const sent = envelope.safeParse(payload);
      if (!sent.success) return null;
      const input = game.inputSchema.safeParse(sent.data.input);
      return input.success ? { seq: sent.data.seq, input: input.data } : null;
    },

    setup({ players, options, lastResult = null }, rng) {
      const base = { players, options, lastResult, left: [], tick: 0, acks: {} };
      const state = game.init({ players: seats(base), options, lastResult, rng, dt });
      return settled({ ...base, state, result: null }, rng);
    },

    applyInput(stored, player, { seq, input }, rng) {
      const seat = seats(stored).find((p) => p.id === player && !p.left);
      if (stored.result || !seat || seq <= (stored.acks[player] ?? -1)) return stored;
      const state = game.input({
        ...context(stored, rng),
        player: seat,
        seq,
        input: input as Input,
      });
      return { ...stored, state, acks: { ...stored.acks, [player]: seq } };
    },

    tick(stored, rng) {
      if (stored.result) return stored;
      const state = game.tick(context(stored, rng));
      return settled({ ...stored, state, tick: stored.tick + 1 }, rng);
    },

    view(stored, player) {
      const ctx = context(stored, seededRng(1));
      const viewer = ctx.players.find((p) => p.id === player) ?? null;
      return hooks.view ? hooks.view(ctx, viewer) : (stored.state as unknown as View);
    },

    seats,

    ...(hooks.onLeave && {
      leave(stored: RealtimeStored<State, Options>, player: PlayerId, rng: Rng) {
        if (stored.result || stored.left.includes(player)) return stored;
        const gone = { ...stored, left: [...stored.left, player] };
        const seat = seats(gone).find((p) => p.id === player);
        if (!seat) return stored;
        const state = hooks.onLeave?.call(game, { ...context(gone, rng), player: seat }) as State;
        return settled({ ...gone, state }, rng);
      },
    }),

    ...(hooks.bot && {
      bot(stored: RealtimeStored<State, Options>, player: PlayerId, rng: Rng) {
        const seat = seats(stored).find((p) => p.id === player && !p.left);
        if (stored.result || !seat) return null;
        const answer = hooks.bot?.call(game, { ...context(stored, rng), player: seat });
        if (answer === null || answer === undefined) return null;
        const input = game.inputSchema.safeParse(answer);
        if (!input.success) throw new Error(`bot input of ${player} was refused by inputSchema`);
        return { seq: (stored.acks[player] ?? -1) + 1, input: input.data };
      },
    }),

    result(stored) {
      return stored.result;
    },
  };
}
