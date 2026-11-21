import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Seat } from './game.js';
import {
  type InitContext,
  type InputContext,
  isRealtimeGame,
  type RealtimeBotContext,
  type RealtimeContext,
  RealtimeGame,
  type RealtimeLeaveContext,
  type RealtimeOutcome,
  realtimeRules,
} from './realtime.js';
import { testRealtimeGame } from './testing.js';

interface State {
  x: number[];
  hidden: number[];
}

/** Each seat runs right at 1 unit per second per input pressed; first past 2 wins. */
class RunGame extends RealtimeGame<State, { dir: 'left' | 'right' }> {
  readonly tickRate = 20;
  readonly snapshotRate = 10;
  readonly inputSchema = z.object({ dir: z.enum(['left', 'right']) });

  init(ctx: InitContext) {
    return { x: ctx.players.map(() => 0), hidden: ctx.players.map(() => ctx.rng()) };
  }

  input(ctx: InputContext<State, { dir: 'left' | 'right' }>) {
    const step = ctx.input.dir === 'right' ? 1 : -1;
    return { ...ctx.state, x: ctx.state.x.map((x, i) => (i === ctx.player.seat ? x + step : x)) };
  }

  tick(ctx: RealtimeContext<State>) {
    return { ...ctx.state, x: ctx.state.x.map((x) => x + ctx.dt) };
  }

  result(ctx: RealtimeContext<State>): RealtimeOutcome | null {
    const best = Math.max(...ctx.state.x);
    if (best < 2) return null;
    const places = ctx.state.x.map((x) => 1 + ctx.state.x.filter((o) => o > x).length);
    return {
      places,
      scores: ctx.state.x,
      stats: [{ player: ctx.players[0]?.id ?? '', name: 'won', amount: 1 }],
    };
  }

  view(ctx: RealtimeContext<State>, viewer: Seat | null) {
    return { x: ctx.state.x, tick: ctx.tick, me: viewer?.seat ?? null };
  }

  onLeave(ctx: RealtimeLeaveContext<State>) {
    return { ...ctx.state, x: ctx.state.x.map((x, i) => (i === ctx.player.seat ? -100 : x)) };
  }
}

describe('a Realtime Game', () => {
  it('advances on ticks by a fixed dt, with or without input', () => {
    const game = testRealtimeGame(new RunGame(), ['a', 'b']);
    expect(game.state.x).toEqual([0, 0]);
    game.tick(10);
    expect(game.ticks).toBe(10);
    expect(game.state.x[0]).toBeCloseTo(0.5);
    expect(game.result).toBeNull();
  });

  it('runs queued inputs before the next tick, in arrival order', () => {
    const game = testRealtimeGame(new RunGame(), ['a', 'b']);
    game
      .input('a', 0, { dir: 'right' })
      .input('a', 1, { dir: 'right' })
      .input('b', 0, { dir: 'left' });
    expect(game.state.x).toEqual([0, 0]);
    game.tick();
    expect(game.state.x[0]).toBeCloseTo(2.05);
    expect(game.state.x[1]).toBeCloseTo(-0.95);
    expect(game.ack('a')).toBe(1);
    expect(game.ack('b')).toBe(0);
  });

  it('drops an input whose seq is not above the last applied', () => {
    const game = testRealtimeGame(new RunGame(), ['a', 'b']);
    game.input('a', 5, { dir: 'right' }).tick();
    game.input('a', 5, { dir: 'right' }).input('a', 3, { dir: 'right' }).tick();
    expect(game.state.x[0]).toBeCloseTo(1.1);
    expect(game.ack('a')).toBe(5);
  });

  it('refuses malformed input before any game code runs', () => {
    const game = testRealtimeGame(new RunGame(), ['a', 'b']);
    expect(game.error({ seq: 0, input: { dir: 'up' } })).toBe('Nước đi không hợp lệ');
    expect(game.error({ seq: -1, input: { dir: 'left' } })).toBe('Nước đi không hợp lệ');
    expect(game.error({ seq: 0.5, input: { dir: 'left' } })).toBe('Nước đi không hợp lệ');
    expect(game.error({ input: { dir: 'left' } })).toBe('Nước đi không hợp lệ');
    expect(game.error('left')).toBe('Nước đi không hợp lệ');
    expect(game.error({ seq: 0, input: { dir: 'left' } })).toBeNull();
    expect(() => game.input('a', 0, { dir: 'up' })).toThrow('rejected');
  });

  it('ignores input from a seat that is not at the table', () => {
    const game = testRealtimeGame(new RunGame(), ['a', 'b']);
    game.input('z', 0, { dir: 'right' }).tick();
    expect(game.state.x.every((x) => x < 0.1)).toBe(true);
    expect(game.ack('z')).toBeUndefined();
  });

  it('ends with places, scores and stats, then stops ticking', () => {
    const game = testRealtimeGame(new RunGame(), ['a', 'b']);
    game.input('a', 0, { dir: 'right' }).input('a', 1, { dir: 'right' }).tick();
    expect(game.result).toEqual({
      seats: [
        { player: 'a', place: 1, score: expect.closeTo(2.05) },
        { player: 'b', place: 2, score: expect.closeTo(0.05) },
      ],
      stats: [{ player: 'a', name: 'won', amount: 1 }],
    });
    const ticks = game.ticks;
    game.tick(5);
    expect(game.ticks).toBe(ticks);
  });

  it('shows each seat its own view and spectators another', () => {
    const game = testRealtimeGame(new RunGame(), ['a', 'b']);
    game.tick(3);
    expect(game.view('b')).toMatchObject({ me: 1, tick: 3 });
    expect(game.view(null)).toMatchObject({ me: null });
  });

  it('keeps a seed repeatable', () => {
    const one = testRealtimeGame(new RunGame(), ['a', 'b'], { seed: 7 });
    const two = testRealtimeGame(new RunGame(), ['a', 'b'], { seed: 7 });
    expect(one.state.hidden).toEqual(two.state.hidden);
  });

  it('lets onLeave handle a player leaving', () => {
    const game = testRealtimeGame(new RunGame(), ['a', 'b']);
    game.leave('b');
    expect(game.state.x[1]).toBe(-100);
    game.input('b', 0, { dir: 'right' }).tick();
    expect(game.state.x[1]).toBeCloseTo(-99.95);
  });

  it('starts the next Match with the last result', () => {
    class Echo extends RunGame {
      override init(ctx: InitContext) {
        return { x: [ctx.lastResult ? 1 : 0, 0], hidden: [] };
      }
    }
    const game = testRealtimeGame(new Echo(), ['a', 'b']);
    expect(game.state.x[0]).toBe(0);
    game.input('a', 0, { dir: 'right' }).input('a', 1, { dir: 'right' }).tick();
    game.newMatch();
    expect(game.state.x[0]).toBe(1);
  });

  it('can be told apart from a Turn-based game', () => {
    expect(isRealtimeGame(new RunGame())).toBe(true);
    expect(isRealtimeGame({ events: {} })).toBe(false);
    expect(isRealtimeGame(null)).toBe(false);
  });
});

describe('a Realtime Game with a bot', () => {
  /** The computer runs right until it is past 1, then waits (null). */
  class BotGame extends RunGame {
    bot(ctx: RealtimeBotContext<State>) {
      return (ctx.state.x[ctx.player.seat] ?? 0) < 1 ? { dir: 'right' as const } : null;
    }
  }

  it('asks the bot for each computer seat every tick, with the next seq', () => {
    const game = testRealtimeGame(new BotGame(), ['a', 'b'], { bots: ['b'] });
    expect(game.bot('b')).toEqual({ seq: 0, input: { dir: 'right' } });
    game.tick(2);
    expect(game.ack('b')).toBe(0);
    expect(game.ack('a')).toBeUndefined();
    expect(game.state.x[0]).toBeCloseTo(0.1);
    expect(game.state.x[1]).toBeCloseTo(1.1);
  });

  it('keeps what the bot last sent when it answers null', () => {
    const game = testRealtimeGame(new BotGame(), ['a', 'b'], { bots: ['b'] });
    game.tick(3);
    expect(game.bot('b')).toBeNull();
  });

  it('plays a Match of bots to its end', () => {
    const game = testRealtimeGame(new BotGame(), ['a', 'b'], { bots: ['a', 'b'] });
    game.tick(100);
    expect(game.result?.seats.map((seat) => seat.place)).toEqual([1, 1]);
  });

  it('refuses a bot input its inputSchema does not take', () => {
    class Bad extends BotGame {
      override bot() {
        return { dir: 'up' } as never;
      }
    }
    const game = testRealtimeGame(new Bad(), ['a', 'b'], { bots: ['b'] });
    expect(() => game.tick()).toThrow('inputSchema');
  });

  it('has no bot when the game declares none', () => {
    const game = testRealtimeGame(new RunGame(), ['a', 'b'], { bots: ['b'] });
    expect(game.bot('b')).toBeNull();
    game.tick(3);
    expect(game.ack('b')).toBeUndefined();
  });
});

describe('realtimeRules', () => {
  const withRates = (tickRate: number, snapshotRate: number) =>
    realtimeRules(Object.assign(new RunGame(), { tickRate, snapshotRate }));

  it('snapshots every tickRate / snapshotRate ticks', () => {
    expect(withRates(20, 10).snapshotEvery).toBe(2);
    expect(withRates(60, 20).snapshotEvery).toBe(3);
    expect(withRates(10, 10).snapshotEvery).toBe(1);
  });

  it('refuses rates outside what the platform sends', () => {
    expect(() => withRates(20, 5)).toThrow('snapshotRate');
    expect(() => withRates(60, 30)).toThrow('snapshotRate');
    expect(() => withRates(61, 10)).toThrow('tickRate');
    expect(() => withRates(0, 10)).toThrow('tickRate');
    expect(() => withRates(25, 10)).toThrow('multiple');
    expect(() => withRates(10.5, 10)).toThrow('tickRate');
  });

  it('refuses a result that breaks the places rules', () => {
    class Bad extends RunGame {
      override result() {
        return { places: [1, 3] };
      }
    }
    expect(() => testRealtimeGame(new Bad(), ['a', 'b'])).toThrow('places must be');
  });

  it('refuses a stat for someone not seated', () => {
    class Bad extends RunGame {
      override result() {
        return { places: [1, 2], stats: [{ player: 'z', name: 'won', amount: 1 }] };
      }
    }
    expect(() => testRealtimeGame(new Bad(), ['a', 'b'])).toThrow('not seated');
  });
});
