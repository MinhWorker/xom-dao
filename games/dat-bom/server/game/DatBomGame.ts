import {
  type InitContext,
  type InputContext,
  type RealtimeBotContext,
  type RealtimeContext,
  RealtimeGame,
  type RealtimeOutcome,
} from '@xomdao/sdk';
import { burn, copyState, newArena, placeBomb, placesOf, walk } from './arena.js';
import { botInput } from './bot.js';
import {
  COUNTDOWN_TICKS,
  type Input,
  inputSchema,
  MATCH_TICKS,
  type Options,
  SNAPSHOT_RATE,
  type State,
  TICK_RATE,
} from './model.js';

export class DatBomGame extends RealtimeGame<State, Input, Options> {
  readonly tickRate = TICK_RATE;
  readonly snapshotRate = SNAPSHOT_RATE;
  readonly inputSchema = inputSchema;

  init({ players, rng }: InitContext<Options>): State {
    return newArena(players.length, rng);
  }

  /** Holds the direction the player sends and puts a bomb down on request; nothing counts before the fight starts. */
  input(ctx: InputContext<State, Input, Options>): State {
    const { player, input, tick } = ctx;
    const me = ctx.state.players[player.seat];
    if (tick < COUNTDOWN_TICKS || !me || me.out !== null) return ctx.state;
    const state = copyState(ctx.state);
    const mine = state.players[player.seat] as State['players'][number];
    mine.move = input.move;
    if (input.bomb) placeBomb(state, mine);
    return state;
  }

  /** Everyone standing walks one step; then bombs burn down and explosions hurt. */
  tick(ctx: RealtimeContext<State, Options>): State {
    if (ctx.tick < COUNTDOWN_TICKS) return ctx.state;
    const state = copyState(ctx.state);
    for (const p of state.players) if (p.out === null) walk(state, p);
    burn(state, ctx.tick + 1);
    return state;
  }

  /** The Match ends when one or none is left standing, or when the time is up. */
  result(ctx: RealtimeContext<State, Options>): RealtimeOutcome | null {
    const { players } = ctx.state;
    const standing = players.filter((p) => p.out === null).length;
    const lastOne = standing <= (players.length > 1 ? 1 : 0);
    if (!lastOne && ctx.tick < COUNTDOWN_TICKS + MATCH_TICKS) return null;
    return { places: placesOf(players), scores: players.map((p) => p.hp) };
  }

  /** The computer's input for its seat, at the Room's level (see bot.ts). */
  bot(ctx: RealtimeBotContext<State, Options>): Input | null {
    return botInput(ctx);
  }
}
