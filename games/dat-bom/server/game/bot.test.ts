import { optionsSchema, type RealtimeBotContext, seededRng, testRealtimeGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { newArena, placeBomb } from './arena.js';
import { botInput } from './bot.js';
import { DatBomGame } from './DatBomGame.js';
import { type BotLevel, COUNTDOWN_TICKS, MATCH_TICKS, type Options, type State } from './model.js';

const levels: BotLevel[] = ['easy', 'normal', 'hard'];

/** A Match of computers only, run for as long as it can last. */
function botMatch(level: BotLevel, seats: number, seed: number) {
  const ids = ['a', 'b', 'c', 'd'].slice(0, seats);
  const options = optionsSchema(manifest).parse({ level });
  const game = testRealtimeGame(new DatBomGame(), ids, { options, seed, bots: ids });
  game.tick(COUNTDOWN_TICKS + MATCH_TICKS);
  return game;
}

/** A hard computer in seat 0 at the corner of an arena with no crates, except where given. */
function corner(crates: [number, number][]) {
  const state = newArena(2, () => 1);
  state.rows = state.rows.map((row) => row.replaceAll('c', '.'));
  for (const [x, y] of crates) {
    state.rows[y] = `${state.rows[y]?.slice(0, x)}c${state.rows[y]?.slice(x + 1)}`;
  }
  return state;
}

function ask(state: State, level: BotLevel = 'hard') {
  const ctx: RealtimeBotContext<State, Options> = {
    state,
    player: { id: 'a', name: 'a', bot: true, seat: 0, left: false },
    players: [],
    options: { level },
    lastResult: null,
    rng: seededRng(1),
    tick: COUNTDOWN_TICKS,
    dt: 0.05,
  };
  return botInput(ctx);
}

describe('the computer player', () => {
  for (const level of levels) {
    it(`plays a Match of four to its end at ${level}`, () => {
      for (const seed of [1, 2, 3]) {
        const game = botMatch(level, 4, seed);
        const places = game.result?.seats.map((s) => s.place) ?? [];
        expect(places, `seed ${seed}`).toHaveLength(4);
        expect(Math.min(...places)).toBe(1);
        expect(game.ticks).toBeLessThanOrEqual(COUNTDOWN_TICKS + MATCH_TICKS);
        expect(game.state.players.filter((p) => p.out !== null).length).toBeGreaterThanOrEqual(2);
      }
    });
  }

  it('finishes a Match of two with a winner before time is up', () => {
    for (const level of ['normal', 'hard'] as const) {
      const game = botMatch(level, 2, 4);
      expect(game.result?.seats.map((s) => s.place).sort()).toEqual([1, 2]);
      expect(game.ticks).toBeLessThan(COUNTDOWN_TICKS + MATCH_TICKS);
    }
  });

  it('does nothing before the fight starts', () => {
    const options = optionsSchema(manifest).parse({});
    const game = testRealtimeGame(new DatBomGame(), ['a', 'b'], { options, bots: ['a', 'b'] });
    expect(game.bot('a')).toBeNull();
    game.tick(COUNTDOWN_TICKS - 1);
    expect(game.ack('a')).toBeUndefined();
  });

  it('places a bomb against a crate when a way out exists, and steps away', () => {
    expect(ask(corner([[0, 1]]))).toEqual({ move: 'right', bomb: true });
  });

  it('keeps its bomb when it would be boxed in', () => {
    const input = ask(
      corner([
        [0, 1],
        [1, 0],
      ]),
    );
    expect(input?.bomb).toBeUndefined();
    expect(input?.move).toBe('none');
  });

  it('runs from a bomb that is about to go off', () => {
    const state = corner([]);
    const other = state.players[1];
    if (!other) throw new Error('no second player');
    Object.assign(other, { x: 1.5, y: 0.5 });
    placeBomb(state, other);
    Object.assign(other, { x: 10.5, y: 8.5 });
    const bomb = state.bombs[0];
    if (bomb) bomb.fuse = 10;
    expect(ask(state)?.move).toBe('down');
  });

  it('thinks only as often as its level allows', () => {
    const state = corner([[0, 1]]);
    const ctx = (tick: number): RealtimeBotContext<State, Options> => ({
      state,
      player: { id: 'a', name: 'a', bot: true, seat: 0, left: false },
      players: [],
      options: { level: 'easy' },
      lastResult: null,
      rng: () => 0.99,
      tick,
      dt: 0.05,
    });
    expect(botInput(ctx(COUNTDOWN_TICKS))).not.toBeNull();
    expect(botInput(ctx(COUNTDOWN_TICKS + 1))).toBeNull();
    expect(botInput(ctx(COUNTDOWN_TICKS + 6))).not.toBeNull();
  });
});
