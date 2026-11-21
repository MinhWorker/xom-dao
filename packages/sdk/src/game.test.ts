import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type BotContext, type EventContext, Game, type GameContext, type Seat } from './game.js';
import { defineManifest, type ManifestOptions, optionsSchema } from './manifest.js';
import { testGame } from './testing.js';

interface State {
  counts: number[];
  turn: number;
}

/** First to press 3 times wins; the others place by their count. */
class RaceGame extends Game<State> {
  readonly events = { press: z.object({ times: z.int().min(1).max(2).default(1) }) };

  onStart(ctx: Omit<GameContext<State>, 'state'>): State {
    return { counts: ctx.players.map(() => 0), turn: 0 };
  }

  onPress(ctx: EventContext<State, { times: number }>): State {
    const { state, player } = ctx;
    if (player.seat !== state.turn) ctx.reject('Chưa tới lượt bạn');
    const counts = state.counts.map((c, i) => (i === player.seat ? c + ctx.payload.times : c));
    if (counts[player.seat]! >= 3) {
      const ranked = [...counts].sort((a, b) => b - a);
      ctx.finish(
        counts.map((c) => ranked.indexOf(c) + 1),
        { scores: counts },
      );
    }
    return { counts, turn: (state.turn + 1) % counts.length };
  }
}

describe('a Turn-based Game', () => {
  it('ends with a place for every seat', () => {
    const game = testGame(new RaceGame(), ['a', 'b', 'c']);
    game.send('a', 'press', { times: 2 }).send('b', 'press').send('c', 'press');
    expect(game.result).toBeNull();
    game.send('a', 'press');
    expect(game.result).toEqual({
      seats: [
        { player: 'a', place: 1, score: 3 },
        { player: 'b', place: 2, score: 1 },
        { player: 'c', place: 2, score: 1 },
      ],
    });
  });

  it('refuses out-of-turn, malformed, unseated and after-the-end events', () => {
    const game = testGame(new RaceGame(), ['a', 'b']);
    expect(game.error('b', 'press')).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'press', { times: 5 })).toBe('Nước đi không hợp lệ');
    expect(game.error('a', 'jump')).toBe('Nước đi không hợp lệ');
    expect(game.error('z', 'press')).toBe('Bạn không ngồi ở bàn này');
    game.send('a', 'press', { times: 2 }).send('b', 'press').send('a', 'press');
    expect(game.result?.seats.map((s) => s.place)).toEqual([1, 2]);
    expect(game.error('b', 'press')).toBe('Ván đã kết thúc');
  });

  it('refuses a Game whose event has no hook', () => {
    class Broken extends Game<number> {
      readonly events = { jump: z.object({}) };
      onStart() {
        return 0;
      }
    }
    expect(() => testGame(new Broken(), ['a'])).toThrow('Event "jump" needs a onJump(ctx) method');
  });

  it('refuses a finish without a valid place for every seat', () => {
    const finishing = (places: number[]) =>
      class extends Game<number> {
        readonly events = { end: z.object({}) };
        onStart() {
          return 0;
        }
        onEnd(ctx: GameContext<number>) {
          ctx.finish(places);
          return 1;
        }
      };
    const end = (places: number[]) => () =>
      testGame(new (finishing(places))(), ['a', 'b', 'c']).send('a', 'end');
    expect(end([1, 2])).toThrow('2 places for 3 seats');
    expect(end([1, 2, 4])).toThrow('from 1 to 3');
    expect(end([2, 2, 3])).toThrow('some seat must place 1');
    expect(end([1, 1, 1])).not.toThrow();
  });
});

interface Hidden {
  secrets: number[];
  turn: number;
  guesses: number;
}

const manifest = defineManifest({
  id: 'guess',
  name: 'Đoán số',
  tagline: 'Đoán số bí mật của người kế bên.',
  minPlayers: 2,
  maxPlayers: 4,
  duration: { min: 1, max: 5 },
  status: 'wip',
  bots: true,
  focus: { x: 50, y: 50 },
  options: {
    rounds: {
      type: 'choice',
      label: 'Số lượt',
      choices: [
        { value: 1, label: '1 lượt' },
        { value: 2, label: '2 lượt' },
        { value: 10, label: '10 lượt' },
      ],
      default: 10,
    },
  },
});

type Options = ManifestOptions<typeof manifest>;

/**
 * Each seat holds a secret number; on their turn a player guesses the next seat's. Exercises
 * views, secret events, timers, leaving, bots, stats, options and the previous result.
 */
class GuessGame extends Game<Hidden, Options, { mine: number | null; turn: number }> {
  readonly events = { guess: z.object({ n: z.int() }) };
  override readonly secretEvents = ['guess'];

  onStart(ctx: Omit<GameContext<Hidden, Options>, 'state'>): Hidden {
    const winner = ctx.lastResult?.seats.findIndex((s) => s.place === 1) ?? -1;
    ctx.setTimer(30_000, 'turn-over');
    return {
      secrets: ctx.players.map(() => 100 + Math.floor(ctx.rng() * 900)),
      turn: Math.max(winner, 0),
      guesses: 0,
    };
  }

  onGuess(ctx: EventContext<Hidden, { n: number }, Options>): Hidden {
    const { state, player } = ctx;
    if (player.seat !== state.turn) ctx.reject('Chưa tới lượt bạn');
    ctx.stat(player.id, 'guess');
    const target = (state.turn + 1) % state.secrets.length;
    const guesses = state.guesses + 1;
    if (ctx.payload.n === state.secrets[target] || guesses >= ctx.options.rounds) {
      ctx.finish(ctx.players.map((p) => (p.seat === player.seat ? 1 : 2)));
    } else ctx.setTimer(30_000, 'turn-over');
    return { ...state, turn: this.next(ctx, state.turn), guesses };
  }

  onTurnOver(ctx: GameContext<Hidden, Options>): Hidden {
    ctx.setTimer(30_000, 'turn-over');
    return { ...ctx.state, turn: this.next(ctx, ctx.state.turn) };
  }

  onLeave(ctx: GameContext<Hidden, Options>): Hidden {
    const stay = ctx.players.filter((p) => !p.left);
    if (stay.length === 1) ctx.finish(ctx.players.map((p) => (p.left ? 2 : 1)));
    return ctx.state;
  }

  bot(ctx: BotContext<Hidden, Options>) {
    return ctx.player.seat === ctx.state.turn ? { event: 'guess', payload: { n: 0 } } : null;
  }

  view(ctx: GameContext<Hidden, Options>, viewer: Seat | null) {
    return { mine: viewer ? ctx.state.secrets[viewer.seat]! : null, turn: ctx.state.turn };
  }

  private next(ctx: GameContext<Hidden, Options>, turn: number) {
    let next = (turn + 1) % ctx.players.length;
    while (ctx.players[next]?.left) next = (next + 1) % ctx.players.length;
    return next;
  }
}

const guess = (players = ['a', 'b'], rounds?: Options['rounds'], bots: string[] = []) =>
  testGame(new GuessGame(), players, {
    options: optionsSchema(manifest).parse({ rounds }),
    bots,
  });

describe('what each seat sees', () => {
  it('shows a seat its own secret only, and spectators none', () => {
    const game = guess(['a', 'b']);
    const [a, b] = game.state.secrets;
    expect(game.view('a')).toEqual({ mine: a, turn: 0 });
    expect(game.view('b')).toEqual({ mine: b, turn: 0 });
    expect(game.view(null)).toEqual({ mine: null, turn: 0 });
    game.assertHidden(null, ...game.state.secrets);
  });

  it('hides a secret event’s data from everyone but its sender', () => {
    const game = guess();
    expect(game.moveView('a', 'a', 'guess', { n: 4 })).toEqual({
      event: 'guess',
      payload: { n: 4 },
    });
    expect(game.moveView('a', 'b', 'guess', { n: 4 })).toEqual({ event: 'guess' });
    expect(game.moveView('a', null, 'guess', { n: 4 })).toEqual({ event: 'guess' });
  });
});

describe('the rest of a Match', () => {
  it('runs a timer’s hook when it goes off, and stops timers at the end', () => {
    const game = guess(['a', 'b'], 1);
    expect(game.timer).toEqual({ event: 'turn-over', ms: 30_000 });
    game.fireTimer();
    expect(game.state.turn).toBe(1);
    game.send('b', 'guess', { n: -1 });
    expect(game.result).not.toBeNull();
    expect(game.timer).toBeNull();
  });

  it('goes on without a player who left, and ends when one is left', () => {
    const game = guess(['a', 'b', 'c']);
    game.leave('b');
    expect(game.error('b', 'guess', { n: 0 })).toBe('Bạn không ngồi ở bàn này');
    game.send('a', 'guess', { n: -1 });
    expect(game.state.turn).toBe(2);
    game.leave('a');
    expect(game.result?.seats.map((s) => s.place)).toEqual([2, 2, 1]);
  });

  it('asks the computer for its seat’s move on its turn', () => {
    const game = guess(['a', 'bot:1'], undefined, ['bot:1']);
    expect(game.bot('bot:1')).toBeNull();
    game.send('a', 'guess', { n: -1 });
    expect(game.bot('bot:1')).toEqual({ event: 'guess', payload: { n: 0 } });
  });

  it('carries the counted stats and the previous result into the next Match', () => {
    const game = guess(['a', 'b'], 2);
    game.send('a', 'guess', { n: -1 }).send('b', 'guess', { n: -1 });
    expect(game.result).toEqual({
      seats: [
        { player: 'a', place: 2 },
        { player: 'b', place: 1 },
      ],
      stats: [
        { player: 'a', name: 'guess', amount: 1 },
        { player: 'b', name: 'guess', amount: 1 },
      ],
    });
    game.newMatch();
    expect(game.result).toBeNull();
    expect(game.state.turn).toBe(1);
  });
});
