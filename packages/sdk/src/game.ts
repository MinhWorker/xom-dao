/**
 * A Turn-based game's server part: a class with lifecycle hooks.
 *
 *   class CounterGame extends Game<State> {
 *     events = { press: z.object({}) };                         // what players can send
 *     onStart(ctx) { return { count: 0 }; }                     // the Match's first state
 *     onPress(ctx) {                                            // event "press" → onPress
 *       if (ctx.state.count === 9) ctx.finish([1, 2]);          // a place for every seat
 *       return { count: ctx.state.count + 1 };
 *     }
 *   }
 *
 * The server checks a player's event against `events`, runs its hook for the next state, and
 * sends every member what `view(ctx, viewer)` shows them. Hooks are pure: they never change
 * `ctx.state` and take randomness only from `ctx.rng`. `ctx.finish(places)` ends the Match with
 * its Match result; the shared backend settles it. `ctx.stat` counts things a player did.
 */
import { z } from 'zod';
import type { GameManifest } from './manifest.js';
import { type Rng, seededRng } from './rng.js';

/** A player's id in a Room (their account id; `bot:<n>` for a computer seat). */
export type PlayerId = string;

/** Someone seated in the Match. `seat` is their place at the table (0, 1, …) and never changes. */
export interface Seat {
  id: PlayerId;
  name: string;
  seat: number;
  bot: boolean;
  /** The account's picture; missing for bots and in tests. */
  avatar?: string;
  /** They left during this Match (only games with `onLeave` go on without them). */
  left: boolean;
}

/** One seat's outcome: `place` 1 is best, tied seats share a place. */
export interface SeatResult {
  player: PlayerId;
  place: number;
  score?: number;
}

/** One `ctx.stat(player, name, amount)`. */
export interface Stat {
  player: PlayerId;
  name: string;
  amount: number;
}

/** How a Match ended, handed to the shared backend: every seat in seat order. */
export interface MatchResult {
  seats: SeatResult[];
  /** What the game counted with `ctx.stat` (absent when nothing). */
  stats?: Stat[];
}

/** What every hook gets. */
export interface GameContext<State, Options = undefined> {
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
  /**
   * Ends the Match: `places[i]` is seat i's place. 1 is best; tied seats share a place and
   * the next one skips (`[1, 1, 3]`). `scores`, also in seat order, are shown next to the
   * places. The backend puts players who left last, whatever the game gives them.
   */
  finish(places: readonly number[], extra?: { scores?: readonly number[] }): void;
  /**
   * Counts `amount` (a whole number above 0, default 1) of `name` (lowercase-dash, e.g.
   * `chop`) for a seated player. Bots' counts are dropped by the backend.
   */
  stat(player: PlayerId, name: string, amount?: number): void;
  /**
   * In `ms`, runs the hook of `event` (`'turn-over'` → `onTurnOver(ctx)`, which gets `payload`).
   * One timer per Match: setting it again replaces it; it stops when it fires, with
   * `clearTimer()` or when the Match ends. Players can't send timer events.
   */
  setTimer(ms: number, event: string, payload?: unknown): void;
  clearTimer(): void;
}

/** The first state has no `state` yet. */
export type StartContext<Options = undefined> = Omit<GameContext<never, Options>, 'state'>;

/** What an event hook (`onPress`, …) gets on top: who sent it, with what data. */
export interface EventContext<State, Payload = Record<string, never>, Options = undefined>
  extends GameContext<State, Options> {
  player: Seat;
  /** The event's data, already checked against its schema in `events`. */
  payload: Payload;
  /** Refuses the event: the player sees `message` (Vietnamese) and nothing changes. */
  reject(message: string): never;
}

/** What a timer's hook gets (see `setTimer`). */
export interface TimerContext<State, Payload = undefined, Options = undefined>
  extends GameContext<State, Options> {
  payload: Payload;
}

/** What `onLeave` gets: who left (already marked `left`). */
export interface LeaveContext<State, Options = undefined> extends GameContext<State, Options> {
  player: Seat;
}

/** What `bot` gets: which computer seat is asked. */
export interface BotContext<State, Options = undefined> extends GameContext<State, Options> {
  player: Seat;
}

/**
 * Base class of a Turn-based game. Declare `events`, implement `onStart` and one `on<Event>`
 * hook per event (`press` → `onPress`, `play-card` → `onPlayCard`).
 *
 * Optional hooks, written in the subclass (not declared here, so no `override`):
 *   on<Timer>(ctx: TimerContext)   a timer set with ctx.setTimer(ms, '<timer>') went off
 *   onLeave(ctx: LeaveContext)     a player left; the Match goes on without them
 *                                  (without it, a player leaving aborts the Match)
 *   bot(ctx: BotContext)           the computer's event for seat ctx.player, or null
 *   view(ctx, viewer: Seat | null) what a seat (null = spectator) sees. Default: the state.
 */
export abstract class Game<State, Options = undefined, View = State> {
  /** Events players can send, each with the schema of its data (`z.object({})` for none). */
  abstract readonly events: Record<string, z.ZodType>;
  /** Events whose data other players must not see (e.g. a card passed face down). */
  readonly secretEvents: readonly string[] = [];

  /** A new Match begins: return its first state. */
  abstract onStart(ctx: StartContext<Options>): State;
}

/** A Game server pairs its static Hub manifest with the pure rules the host runs. */
export interface GameServer<State, Options = undefined, View = State> {
  manifest: GameManifest;
  game: Game<State, Options, View>;
}

/** The heterogeneous server registry after each Game's type has been checked at its entry. */
export type AnyGameServer = { manifest: GameManifest; game: object };

/** The optional hooks, as the runner looks them up. */
interface OptionalHooks<State, Options, View> {
  onLeave?(ctx: LeaveContext<State, Options>): State;
  bot?(ctx: BotContext<State, Options>): GameEvent | null;
  view?(ctx: GameContext<State, Options>, viewer: Seat | null): View;
}

/** `press` → `onPress`, `play-card` → `onPlayCard`. */
export const hookName = (event: string) =>
  `on${event.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())}`;

/** A move as it travels: the event's name and its data. */
export interface GameEvent {
  event: string;
  payload?: unknown;
}

/** The pending timer: `id` changes every time one is set. */
export interface PendingTimer {
  id: number;
  ms: number;
  event: string;
  payload?: unknown;
}

/** Who sits in a Room when a Match starts, as the server knows them. */
export interface RoomSeat {
  id: PlayerId;
  name: string;
  bot: boolean;
  avatar?: string;
}

/** What the server keeps of a Match: its state plus bookkeeping the game doesn't see. */
export interface Stored<State, Options> {
  state: State;
  players: RoomSeat[];
  options: Options;
  lastResult: MatchResult | null;
  result: MatchResult | null;
  /** Players who left during the Match. */
  left: PlayerId[];
  timer: PendingTimer | null;
  /** Timers set so far (the next timer's id). */
  timers: number;
  stats: Stat[];
}

/** How a Match starts: the seats in order, the Room's options and its previous result. */
export interface MatchStart<Options> {
  players: RoomSeat[];
  options: Options;
  lastResult?: MatchResult | null;
}

/**
 * A `Game` as plain functions over its stored Match, for the server's GameHostModule (to
 * come). Built with `turnRules(game)`; games don't write it.
 */
export interface TurnRules<State, Options, View> {
  events: Record<string, z.ZodType>;
  /** The shape of an incoming move, checked before any game code runs. */
  moveSchema: z.ZodType<GameEvent>;
  setup(start: MatchStart<Options>, rng: Rng): Stored<State, Options>;
  /**
   * The message (Vietnamese) the move would be refused with, or `null`. Runs the hook on the
   * side, which hooks allow since they never change their input.
   */
  validateMove(stored: Stored<State, Options>, move: GameEvent, player: PlayerId): string | null;
  /** The next stored Match. Call only after `validateMove` returned `null`. */
  applyMove(
    stored: Stored<State, Options>,
    move: GameEvent,
    player: PlayerId,
    rng: Rng,
  ): Stored<State, Options>;
  /** What `player` sees (`null` = a spectator). */
  view(stored: Stored<State, Options>, player: PlayerId | null): View;
  /** What `viewer` may see of a move `player` made: the whole move, or only its event name. */
  moveView(move: GameEvent, player: PlayerId, viewer: PlayerId | null): GameEvent;
  seats(stored: Stored<State, Options>): Seat[];
  timer(stored: Stored<State, Options>): PendingTimer | null;
  fireTimer(stored: Stored<State, Options>, rng: Rng): Stored<State, Options>;
  /** Missing when the game has no `onLeave`: then a player leaving aborts the Match. */
  leave?(stored: Stored<State, Options>, player: PlayerId, rng: Rng): Stored<State, Options>;
  /** Missing when the game has no `bot`. `null` when the seat has nothing to play now. */
  bot?(stored: Stored<State, Options>, player: PlayerId, rng: Rng): GameEvent | null;
  /** `null` while the Match is being played. */
  result(stored: Stored<State, Options>): MatchResult | null;
}

/** What a game's stat names look like: lowercase words with dashes. */
export const STAT_NAME = /^[a-z][a-z0-9-]*$/;

class Rejected extends Error {}

/** Checks `ctx.finish`'s arguments and builds the seats of the Match result. */
function seatResults(
  players: RoomSeat[],
  places: readonly number[],
  scores: readonly number[] | undefined,
): SeatResult[] {
  if (places.length !== players.length) {
    throw new Error(`ctx.finish: ${places.length} places for ${players.length} seats`);
  }
  if (places.some((p) => !Number.isInteger(p) || p < 1 || p > players.length)) {
    throw new Error(`ctx.finish: places must be whole numbers from 1 to ${players.length}`);
  }
  places.forEach((place, seat) => {
    const ahead = places.filter((p) => p < place).length;
    if (place !== ahead + 1) {
      throw new Error(
        `ctx.finish: ${ahead} seats are ahead, so seat ${seat} should place ${ahead + 1}`,
      );
    }
  });
  if (scores && scores.length !== players.length) {
    throw new Error(`ctx.finish: ${scores.length} scores for ${players.length} seats`);
  }
  if (scores?.some((s) => !Number.isFinite(s))) {
    throw new Error('ctx.finish: scores must be finite numbers');
  }
  return players.map(({ id }, i) => ({
    player: id,
    place: places[i]!,
    ...(scores && { score: scores[i]! }),
  }));
}

/** Turns a `Game` into the functions the server runs. Throws when an event has no hook. */
export function turnRules<State, Options, View>(
  game: Game<State, Options, View>,
): TurnRules<State, Options, View> {
  const hooks = game as Game<State, Options, View> & OptionalHooks<State, Options, View>;
  const hookOf = (event: string) =>
    (game as unknown as Record<string, ((ctx: unknown) => State) | undefined>)[hookName(event)];
  for (const name of Object.keys(game.events)) {
    if (typeof hookOf(name) !== 'function') {
      throw new Error(`Event "${name}" needs a ${hookName(name)}(ctx) method`);
    }
  }

  const seats = (stored: Pick<Stored<State, Options>, 'players' | 'left'>) =>
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

  /** A hook's context, and what the hook did through it. */
  const context = (stored: Omit<Stored<State, Options>, 'result'>, rng: Rng) => {
    const out = {
      result: null as MatchResult | null,
      timer: stored.timer,
      timers: stored.timers,
      stats: [] as Stat[],
    };
    const ctx: GameContext<State, Options> = {
      state: stored.state,
      players: seats(stored),
      options: stored.options,
      lastResult: stored.lastResult,
      rng,
      finish: (places, extra) => {
        out.result = { seats: seatResults(stored.players, places, extra?.scores) };
      },
      stat: (player, name, amount = 1) => {
        if (!stored.players.some((p) => p.id === player)) {
          throw new Error(`ctx.stat: ${player} is not seated in this Match`);
        }
        if (!STAT_NAME.test(name)) {
          throw new Error(`ctx.stat: "${name}" is not a stat name (lowercase-dash, e.g. chop)`);
        }
        if (!Number.isInteger(amount) || amount <= 0) {
          throw new Error(`ctx.stat: ${amount} is not a whole number above 0`);
        }
        out.stats.push({ player, name, amount });
      },
      setTimer: (ms, event, payload) => {
        if (event === 'start' || event in game.events) {
          throw new Error(`Timer "${event}" can't share its name with the start or an event`);
        }
        if (!hookOf(event)) {
          throw new Error(`Timer "${event}" needs a ${hookName(event)}(ctx) method`);
        }
        out.timer = { id: ++out.timers, ms, event, payload };
      },
      clearTimer: () => {
        out.timer = null;
      },
    };
    return { ctx, out };
  };

  /** Runs a hook through `call`; returns the next stored Match. */
  const runHook = (
    stored: Stored<State, Options>,
    rng: Rng,
    call: (ctx: GameContext<State, Options>) => State,
  ): Stored<State, Options> => {
    const { ctx, out } = context(stored, rng);
    const state = call(ctx);
    const stats = [...stored.stats, ...out.stats];
    const result = out.result && { ...out.result, ...(stats.length && { stats }) };
    return {
      ...stored,
      state,
      result,
      timer: result ? null : out.timer,
      timers: out.timers,
      stats,
    };
  };

  const run = (
    stored: Stored<State, Options>,
    move: GameEvent,
    player: PlayerId,
    rng: Rng,
  ): Stored<State, Options> => {
    const reject = (message: string): never => {
      throw new Rejected(message);
    };
    if (stored.result) reject('Ván đã kết thúc');
    const payload = game.events[move.event]?.safeParse(move.payload ?? {});
    if (!payload?.success) reject('Nước đi không hợp lệ');
    const seat = seats(stored).find((p) => p.id === player && !p.left);
    if (!seat) reject('Bạn không ngồi ở bàn này');
    const hook = hookOf(move.event);
    return runHook(
      stored,
      rng,
      (ctx) => hook?.call(game, { ...ctx, player: seat, payload: payload?.data, reject }) as State,
    );
  };

  return {
    events: game.events,
    moveSchema: z.object({ event: z.string(), payload: z.unknown().optional() }),

    setup({ players, options, lastResult = null }, rng) {
      const empty = {
        state: undefined as never,
        players,
        options,
        lastResult,
        left: [],
        timer: null,
        timers: 0,
        stats: [],
      };
      return runHook({ ...empty, result: null }, rng, (ctx) => {
        const { state: _, ...start } = ctx;
        return game.onStart(start);
      });
    },

    validateMove(stored, move, player) {
      try {
        run(stored, move, player, seededRng(1));
        return null;
      } catch (err) {
        if (err instanceof Rejected) return err.message;
        throw err;
      }
    },

    applyMove: run,

    view(stored, player) {
      const { ctx } = context(stored, seededRng(1));
      const viewer = ctx.players.find((p) => p.id === player) ?? null;
      return hooks.view ? hooks.view(ctx, viewer) : (stored.state as unknown as View);
    },

    moveView(move, player, viewer) {
      if (player === viewer || !game.secretEvents.includes(move.event)) return move;
      return { event: move.event };
    },

    seats,

    timer(stored) {
      return stored.result ? null : stored.timer;
    },

    fireTimer(stored, rng) {
      const timer = stored.timer;
      if (!timer || stored.result) return stored;
      const hook = hookOf(timer.event);
      return runHook(
        { ...stored, timer: null },
        rng,
        (ctx) => hook?.call(game, { ...ctx, payload: timer.payload }) as State,
      );
    },

    ...(hooks.onLeave && {
      leave(stored: Stored<State, Options>, player: PlayerId, rng: Rng) {
        if (stored.result || stored.left.includes(player)) return stored;
        const gone = { ...stored, left: [...stored.left, player] };
        const seat = seats(gone).find((p) => p.id === player);
        if (!seat) return stored;
        return runHook(
          gone,
          rng,
          (ctx) => hooks.onLeave?.call(game, { ...ctx, player: seat }) as State,
        );
      },
    }),

    ...(hooks.bot && {
      bot(stored: Stored<State, Options>, player: PlayerId, rng: Rng) {
        if (stored.result) return null;
        const { ctx } = context(stored, rng);
        const seat = ctx.players.find((p) => p.id === player && !p.left);
        return seat ? (hooks.bot?.call(game, { ...ctx, player: seat }) ?? null) : null;
      },
    }),

    result(stored) {
      return stored.result;
    },
  };
}
