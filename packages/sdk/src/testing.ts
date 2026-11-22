import { type Game, type GameEvent, type MatchResult, type PlayerId, turnRules } from './game.js';
import { type RealtimeGame, type RealtimeInput, realtimeRules } from './realtime.js';
import { seededRng } from './rng.js';

/**
 * Plays a `Game` the way the server does, one event at a time, so a test reads like a script:
 *
 *   const game = testGame(new CaroGame(), ['a', 'b'], { options: { swap: true } });
 *   game.send('a', 'place', { x: 4, y: 4 });          // throws if the game refuses it
 *   expect(game.error('b', 'place', { x: 4, y: 4 })).toBe('Ô này đã có quân');
 *   game.fireTimer();                                  // a ctx.setTimer went off
 *   game.leave('b');                                   // b left mid-Match (onLeave)
 *   expect(game.result?.seats.map((s) => s.place)).toEqual([1, 2]);
 *
 * `bots` lists the players the computer plays (`ctx.players[i].bot`). `options` are passed as
 * given: parse them with the manifest's `optionsSchema` to fill defaults.
 */
export function testGame<State, Options, View>(
  game: Game<State, Options, View>,
  players: PlayerId[],
  { options, seed = 1, bots = [] }: { options?: Options; seed?: number; bots?: PlayerId[] } = {},
) {
  const rules = turnRules(game);
  const rng = seededRng(seed);
  const start = () => ({
    players: players.map((id) => ({ id, name: id, bot: bots.includes(id) })),
    options: options as Options,
  });
  let stored = rules.setup(start(), rng);
  const move = (event: string, payload?: object): GameEvent => ({ event, payload });
  const session = {
    /** The Match state now. */
    get state(): State {
      return stored.state;
    },
    /** `null` while playing, then the Match result. */
    get result(): MatchResult | null {
      return rules.result(stored);
    },
    /** What `player` sees (`null` = a spectator). */
    view(player: PlayerId | null): View {
      return rules.view(stored, player);
    },
    /** Plays an event; throws with the game's message if it is refused. */
    send(player: PlayerId, event: string, payload?: object) {
      const error = rules.validateMove(stored, move(event, payload), player);
      if (error) throw new Error(`${player} ${event} was rejected: ${error}`);
      stored = rules.applyMove(stored, move(event, payload), player, rng);
      return session;
    },
    /** The message the game would refuse this event with, or `null` if it is fine. */
    error(player: PlayerId, event: string, payload?: object) {
      return rules.validateMove(stored, move(event, payload), player);
    },
    /** The Room plays again: a new Match whose `ctx.lastResult` is this one's result. */
    newMatch() {
      stored = rules.setup({ ...start(), lastResult: rules.result(stored) }, rng);
      return session;
    },
    /** The pending timer (`ctx.setTimer`): its event and length, or `null`. */
    get timer() {
      const t = rules.timer(stored);
      return t && { event: t.event, ms: t.ms };
    },
    /** Lets the pending timer go off now (throws if there is none). */
    fireTimer() {
      if (!rules.timer(stored)) throw new Error('No timer is set');
      stored = rules.fireTimer(stored, rng);
      return session;
    },
    /** `player` leaves mid-Match (the game's `onLeave`; throws if it has none). */
    leave(player: PlayerId) {
      if (!rules.leave) throw new Error('This game has no onLeave hook');
      stored = rules.leave(stored, player, rng);
      return session;
    },
    /** What the computer would play for `player` now (`null` = nothing). */
    bot(player: PlayerId) {
      return rules.bot?.(stored, player, rng) ?? null;
    },
    /** How many ms the computer would think before its move for `player` (0 = no `botDelay`). */
    botDelay(player: PlayerId) {
      return rules.botDelay?.(stored, player, rng) ?? 0;
    },
    /** What `viewer` sees of a move `player` sent (secret events lose their payload). */
    moveView(player: PlayerId, viewer: PlayerId | null, event: string, payload?: object) {
      return rules.moveView(move(event, payload), player, viewer);
    },
    /**
     * Throws if any of `secrets` (a card, a hand, a deck order…) appears anywhere in what
     * `viewer` sees. Check every player and `null` (spectators).
     */
    assertHidden(viewer: PlayerId | null, ...secrets: unknown[]) {
      const view = JSON.stringify(rules.view(stored, viewer));
      for (const secret of secrets) {
        if (view.includes(JSON.stringify(secret))) {
          throw new Error(`${viewer ?? 'A spectator'} can see ${JSON.stringify(secret)}`);
        }
      }
      return session;
    },
  };
  return session;
}

/**
 * Plays a `RealtimeGame` the way the server does, a tick at a time, so a test reads like a script:
 *
 *   const game = testRealtimeGame(new DriftGame(), ['a', 'b']);
 *   game.input('a', 0, { dir: 'right' });             // queued for the next tick
 *   game.tick(20);                                    // one second of ticks; inputs run first
 *   expect(game.ack('a')).toBe(0);
 *   expect(game.error({ seq: 1, input: { dir: 'up' } })).toBe('Nước đi không hợp lệ');
 *
 * `bots` lists the players the computer plays (`ctx.players[i].bot`): each tick asks the game's
 * `bot` hook for them, after the queued inputs, as the server does; `options` are passed as given.
 */
export function testRealtimeGame<State, Input, Options, View>(
  game: RealtimeGame<State, Input, Options, View>,
  players: PlayerId[],
  { options, seed = 1, bots = [] }: { options?: Options; seed?: number; bots?: PlayerId[] } = {},
) {
  const rules = realtimeRules(game);
  const rng = seededRng(seed);
  const start = () => ({
    players: players.map((id) => ({ id, name: id, bot: bots.includes(id) })),
    options: options as Options,
  });
  let stored = rules.setup(start(), rng);
  let queue: { player: PlayerId; input: RealtimeInput }[] = [];
  const session = {
    /** The Match state now. */
    get state(): State {
      return stored.state;
    },
    /** Ticks run so far. */
    get ticks() {
      return stored.tick;
    },
    /** `null` while playing, then the Match result. */
    get result(): MatchResult | null {
      return rules.result(stored);
    },
    /** What `player` sees (`null` = a spectator). */
    view(player: PlayerId | null): View {
      return rules.view(stored, player);
    },
    /** The last `seq` applied for `player`, or `undefined`. */
    ack(player: PlayerId) {
      return stored.acks[player];
    },
    /** Queues an input for the next tick; throws if its shape is refused. */
    input(player: PlayerId, seq: number, input?: object) {
      const parsed = rules.parseInput({ seq, input });
      if (!parsed)
        throw new Error(`${player} input was rejected: ${session.error({ seq, input })}`);
      queue.push({ player, input: parsed });
      return session;
    },
    /** The message the server would refuse this `{ seq, input }` payload with, or `null`. */
    error(payload: unknown) {
      return rules.parseInput(payload) ? null : 'Nước đi không hợp lệ';
    },
    /** What the computer would play for `player` now: the next `seq` and input, or `null`. */
    bot(player: PlayerId) {
      return rules.bot?.(stored, player, rng) ?? null;
    },
    /**
     * Runs `count` ticks: the queued inputs first, then the computer seats' inputs, then the
     * game's `tick` (stops when it ends).
     */
    tick(count = 1) {
      for (let i = 0; i < count && !stored.result; i++) {
        for (const { player, input } of queue) {
          stored = rules.applyInput(stored, player, input, rng);
        }
        queue = [];
        for (const player of bots) {
          const input = rules.bot?.(stored, player, rng);
          if (input) stored = rules.applyInput(stored, player, input, rng);
        }
        stored = rules.tick(stored, rng);
      }
      return session;
    },
    /** The Room plays again: a new Match whose `ctx.lastResult` is this one's result. */
    newMatch() {
      stored = rules.setup({ ...start(), lastResult: rules.result(stored) }, rng);
      queue = [];
      return session;
    },
    /** `player` leaves mid-Match (the game's `onLeave`; throws if it has none). */
    leave(player: PlayerId) {
      if (!rules.leave) throw new Error('This game has no onLeave hook');
      stored = rules.leave(stored, player, rng);
      return session;
    },
  };
  return session;
}
