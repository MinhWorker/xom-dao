import {
  type BotContext,
  defineManifest,
  type EventContext,
  Game,
  type LeaveContext,
  type StartContext,
  type TimerContext,
} from '@xomdao/sdk';
import { GAME_UPDATING, type MatchResultNotice } from '@xomdao/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore } from '../accounts/accounts.store.js';
import { MatchesService } from '../matches/matches.service.js';
import { MemoryMatchesStore } from '../matches/matches.store.js';
import { ResultsService } from '../results/results.service.js';
import { StatsService } from '../stats/stats.service.js';
import { MemoryStatsStore } from '../stats/stats.store.js';
import { GameHostService, LOADING_TIMEOUT_MS, MATCH_LIMITS } from './game-host.service.js';
import type { HostedGame, MatchState } from './game-host.types.js';

/** Results kept in memory, read back through `matches`. */
function memoryResults() {
  const matches = new MatchesService(new MemoryMatchesStore());
  const stats = new StatsService(
    new MemoryStatsStore(),
    new AccountsService(new MemoryAccountsStore()),
  );
  return { matches, results: new ResultsService(null, matches, stats) };
}

const hostOf = (servers: HostedGame[], results = memoryResults().results) =>
  new GameHostService(servers, results);

const manifest = defineManifest({
  id: 'fake-game',
  name: 'Game giả',
  tagline: 'Game kiểm tra vòng đời.',
  minPlayers: 2,
  maxPlayers: 2,
  duration: { min: 1, max: 1 },
  status: 'wip',
  bots: false,
  focus: { x: 50, y: 50 },
});

class FakeGame extends Game<{ started: boolean }> {
  readonly events = { finish: z.object({}) };

  constructor(
    private readonly start: (ctx: StartContext) => { started: boolean } = vi.fn(() => ({
      started: true,
    })),
  ) {
    super();
  }

  onStart(ctx: StartContext) {
    return this.start(ctx);
  }

  onFinish(ctx: EventContext<{ started: boolean }>) {
    ctx.finish([1, 2]);
    return ctx.state;
  }
}

class TimerGame extends Game<{ done: boolean }> {
  readonly events = {};

  onStart(ctx: StartContext) {
    ctx.setTimer(100, 'timeout');
    return { done: false };
  }

  onTimeout(ctx: TimerContext<{ done: boolean }>) {
    ctx.finish([1, 2]);
    return { done: true };
  }
}

class BotGame extends Game<{ turn: number }> {
  readonly events = { take: z.object({}) };

  onStart() {
    return { turn: 1 };
  }

  onTake(_ctx: EventContext<{ turn: number }>) {
    return { turn: 0 };
  }

  bot({ state, player }: BotContext<{ turn: number }>) {
    return state.turn === player.seat ? { event: 'take' } : null;
  }
}

/** BotGame whose computer thinks 800 ms; `poke` changes the state without passing the turn. */
class ThinkingBotGame extends Game<{ turn: number; pokes: number }> {
  readonly events = { take: z.object({}), poke: z.object({}) };

  onStart() {
    return { turn: 1, pokes: 0 };
  }

  onTake(ctx: EventContext<{ turn: number; pokes: number }>) {
    return { ...ctx.state, turn: 0 };
  }

  onPoke(ctx: EventContext<{ turn: number; pokes: number }>) {
    return { ...ctx.state, pokes: ctx.state.pokes + 1 };
  }

  bot({ state, player }: BotContext<{ turn: number; pokes: number }>) {
    return state.turn === player.seat ? { event: 'take' } : null;
  }

  botDelay() {
    return 800;
  }
}

class LeavingGame extends Game<{ started: boolean }> {
  readonly events = {};

  onStart() {
    return { started: true };
  }

  onLeave(ctx: LeaveContext<{ started: boolean }>) {
    ctx.finish([1, 2]);
    return ctx.state;
  }
}

/** A Game whose `slow` event takes `ms` of (fake) time to run. */
class SlowGame extends Game<{ n: number }> {
  readonly events = { slow: z.object({ ms: z.number() }), big: z.object({}) };

  onStart() {
    return { n: 0 };
  }

  onSlow(ctx: EventContext<{ n: number }, { ms: number }>) {
    vi.advanceTimersByTime(ctx.payload.ms);
    return { n: ctx.state.n + 1 };
  }

  onBig() {
    return { n: -1, padding: 'x'.repeat(MATCH_LIMITS.viewBytes) } as { n: number };
  }
}

/** Each seat plays in turn; the computer's move on its turn wins outright. */
class RaceGame extends Game<{ turn: number }> {
  readonly events = { pass: z.object({}), win: z.object({}) };

  onStart() {
    return { turn: 0 };
  }

  onPass(ctx: EventContext<{ turn: number }>) {
    return { turn: (ctx.state.turn + 1) % ctx.players.length };
  }

  onWin(ctx: EventContext<{ turn: number }>) {
    ctx.finish(ctx.players.map((seat) => (seat.id === ctx.player.id ? 1 : 2)));
    return ctx.state;
  }

  bot({ state, player }: BotContext<{ turn: number }>) {
    return state.turn === player.seat ? { event: 'win' } : null;
  }
}

const matchStart = {
  matchId: 'match-1',
  roomCode: 'ABCD',
  gameId: manifest.id,
  lastResult: null,
  players: [
    { id: 'lan', name: 'Lan', bot: false },
    { id: 'minh', name: 'Minh', bot: false },
  ],
  options: {},
};

describe('GameHostService', () => {
  afterEach(() => vi.useRealTimers());

  it('loads game ids and starts the Game only after every player is ready', () => {
    const start = vi.fn(() => ({ started: true }));
    const host = hostOf([{ manifest, version: 'v1', game: new FakeGame(start) }]);
    const updates: string[] = [];
    host.onState((match) => updates.push(match.status));

    expect(host.gameIds()).toEqual(['fake-game']);
    expect(host.startMatch(matchStart)).toMatchObject({ status: 'loading', matchId: 'match-1' });
    expect(start).not.toHaveBeenCalled();

    host.ready('match-1', 'lan');
    expect(host.match('match-1')).toMatchObject({ status: 'loading' });
    expect(start).not.toHaveBeenCalled();

    host.ready('match-1', 'minh');
    expect(host.match('match-1')).toMatchObject({ status: 'playing' });
    expect(host.view('match-1', 'lan')).toEqual({ started: true });
    expect(start).toHaveBeenCalledOnce();
    expect(updates).toEqual(['loading', 'playing']);
  });

  it('starts after 30 seconds and identifies players who did not load', () => {
    vi.useFakeTimers();
    const host = hostOf([{ manifest, version: 'v1', game: new FakeGame() }]);
    const updates: { status: string; disconnectedPlayerIds: string[] }[] = [];
    host.onState((match) => updates.push(match));

    host.startMatch(matchStart);
    vi.advanceTimersByTime(LOADING_TIMEOUT_MS - 1);
    expect(host.match('match-1')).toMatchObject({ status: 'loading' });
    vi.advanceTimersByTime(1);

    expect(host.match('match-1')).toMatchObject({
      status: 'playing',
      disconnectedPlayerIds: ['lan', 'minh'],
    });
    expect(updates.at(-1)).toMatchObject({
      status: 'playing',
      disconnectedPlayerIds: ['lan', 'minh'],
    });
  });

  it('refuses a Hub whose Game bundle was built from other Game server code', () => {
    const host = hostOf([{ manifest, version: 'v1', game: new FakeGame() }]);

    expect(() => host.checkVersion('fake-game', 'v1')).not.toThrow();
    expect(() => host.checkVersion('fake-game', 'v0')).toThrow(GAME_UPDATING);
    expect(() => host.checkVersion('fake-game', undefined)).toThrow(GAME_UPDATING);
  });

  it('marks a Match aborted when a Game fails during startup', () => {
    const updates: { status: string; outcome?: string }[] = [];
    const host = hostOf([
      {
        manifest,
        version: 'v1',
        game: new FakeGame(() => {
          throw new Error('broken game');
        }),
      },
    ]);
    host.onState((match) => updates.push(match));

    host.startMatch(matchStart);
    host.ready('match-1', 'lan');
    host.ready('match-1', 'minh');

    expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    expect(host.match('match-1')).toBeUndefined();
  });

  it('marks a Match settled when the Game ends during startup', () => {
    const updates: { status: string; outcome?: string }[] = [];
    const game = new FakeGame((ctx) => {
      ctx.finish([1, 2]);
      return { started: true };
    });
    const host = hostOf([{ manifest, version: 'v1', game }]);
    host.onState((match) => updates.push(match));

    host.startMatch(matchStart);
    host.ready('match-1', 'lan');
    host.ready('match-1', 'minh');

    expect(updates.at(-1)).toMatchObject({
      status: 'over',
      outcome: 'settled',
      result: {
        seats: [
          { player: 'lan', place: 1 },
          { player: 'minh', place: 2 },
        ],
      },
    });
  });

  it('settles a Match when a move finishes the Game', () => {
    const updates: { status: string; outcome?: string }[] = [];
    const host = hostOf([{ manifest, version: 'v1', game: new FakeGame() }]);
    host.onState((match) => updates.push(match));

    host.startMatch(matchStart);
    host.ready('match-1', 'lan');
    host.ready('match-1', 'minh');
    host.move('match-1', 'lan', { event: 'finish' });

    expect(updates.at(-1)).toMatchObject({
      status: 'over',
      outcome: 'settled',
      result: {
        seats: [
          { player: 'lan', place: 1 },
          { player: 'minh', place: 2 },
        ],
      },
    });
  });

  it('passes the previous Match result into the next Game setup', () => {
    const lastResult = {
      seats: [
        { player: 'lan', place: 2 },
        { player: 'minh', place: 1 },
      ],
    };
    const start = vi.fn(() => ({ started: true }));
    const host = hostOf([{ manifest, version: 'v1', game: new FakeGame(start) }]);

    host.startMatch({ ...matchStart, lastResult });
    host.ready('match-1', 'lan');
    host.ready('match-1', 'minh');

    expect(start).toHaveBeenCalledWith(expect.objectContaining({ lastResult }));
  });

  it('fires a Game timer and settles the Match', () => {
    vi.useFakeTimers();
    const updates: { status: string; outcome?: string }[] = [];
    const host = hostOf([{ manifest, version: 'v1', game: new TimerGame() }]);
    host.onState((match) => updates.push(match));

    host.startMatch(matchStart);
    host.ready('match-1', 'lan');
    host.ready('match-1', 'minh');
    expect(host.match('match-1')).toMatchObject({
      status: 'playing',
      timer: { id: 1, event: 'timeout', ms: 100 },
    });
    const deadline = host.match('match-1')?.timer?.deadline;
    expect(deadline).toBe(Date.now() + 100);
    vi.advanceTimersByTime(40);
    expect(host.match('match-1')?.timer?.deadline).toBe(deadline);
    vi.advanceTimersByTime(60);

    expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'settled', timer: null });
  });

  it('runs a bot move when it is the bot seat’s turn', async () => {
    const host = hostOf([{ manifest, version: 'v1', game: new BotGame() }]);
    const start = {
      ...matchStart,
      players: matchStart.players.map((player) =>
        player.id === 'minh' ? { id: 'bot:2', name: 'Máy', bot: true } : player,
      ),
    };

    host.startMatch(start);
    host.ready('match-1', 'lan');
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(host.view('match-1', 'lan')).toEqual({ turn: 0 });
  });

  describe('a computer that thinks', () => {
    const botStart = {
      ...matchStart,
      players: matchStart.players.map((player) =>
        player.id === 'minh' ? { id: 'bot:2', name: 'Máy', bot: true } : player,
      ),
    };
    function playing() {
      vi.useFakeTimers();
      const host = hostOf([{ manifest, version: 'v1', game: new ThinkingBotGame() }]);
      const updates: { status: string; outcome?: string }[] = [];
      host.onState((match) => updates.push(match));
      host.startMatch(botStart);
      host.ready('match-1', 'lan');
      return { host, updates };
    }

    it('waits the Game’s think time before playing the move', () => {
      const { host } = playing();

      vi.advanceTimersByTime(799);
      expect(host.view('match-1', 'lan')).toMatchObject({ turn: 1 });
      vi.advanceTimersByTime(1);
      expect(host.view('match-1', 'lan')).toMatchObject({ turn: 0 });
    });

    it('thinks again when the state changes while it waits', () => {
      const { host } = playing();

      vi.advanceTimersByTime(500);
      host.move('match-1', 'lan', { event: 'poke' });
      vi.advanceTimersByTime(500);
      expect(host.view('match-1', 'lan')).toMatchObject({ turn: 1, pokes: 1 });
      vi.advanceTimersByTime(300);
      expect(host.view('match-1', 'lan')).toMatchObject({ turn: 0, pokes: 1 });
    });

    it('drops the wait when the Match ends', () => {
      const { host, updates } = playing();

      vi.advanceTimersByTime(400);
      host.stop('match-1');
      vi.advanceTimersByTime(1000);

      expect(updates.map(({ status }) => status)).toEqual(['loading', 'playing', 'over']);
      expect(updates.at(-1)).toMatchObject({ outcome: 'aborted' });
    });
  });

  it('aborts a Match when a player leaves and the Game has no leave hook', () => {
    const updates: { status: string; outcome?: string }[] = [];
    const host = hostOf([{ manifest, version: 'v1', game: new FakeGame() }]);
    host.onState((match) => updates.push(match));
    host.startMatch(matchStart);
    host.ready('match-1', 'lan');
    host.ready('match-1', 'minh');

    host.leave('match-1', 'lan');

    expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    expect(host.match('match-1')).toBeUndefined();
  });

  it('stops a Match once, ending its timers and bot turns', () => {
    vi.useFakeTimers();
    const updates: { status: string; outcome?: string }[] = [];
    const host = hostOf([{ manifest, version: 'v1', game: new TimerGame() }]);
    host.onState((match) => updates.push(match));
    host.startMatch(matchStart);
    host.ready('match-1', 'lan');
    host.ready('match-1', 'minh');

    host.stop('match-1');
    host.stop('match-1');
    vi.advanceTimersByTime(100);

    expect(updates.map(({ status }) => status)).toEqual(['loading', 'playing', 'over']);
    expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    expect(host.match('match-1')).toBeUndefined();
  });

  it('lets a Game handle a player leaving', () => {
    const updates: { status: string; outcome?: string }[] = [];
    const host = hostOf([{ manifest, version: 'v1', game: new LeavingGame() }]);
    host.onState((match) => updates.push(match));
    host.startMatch(matchStart);
    host.ready('match-1', 'lan');
    host.ready('match-1', 'minh');

    host.leave('match-1', 'lan');

    expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'settled' });
  });

  describe('limits', () => {
    function playing(game: Game<never> | Game<{ n: number }>, start = matchStart) {
      const host = hostOf([{ manifest, version: 'v1', game }]);
      const updates: { status: string; outcome?: string }[] = [];
      host.onState((match) => updates.push(match));
      host.startMatch(start);
      for (const player of start.players) if (!player.bot) host.ready('match-1', player.id);
      return { host, updates };
    }

    it('aborts a Match whose hook runs longer than 250 ms', () => {
      vi.useFakeTimers();
      const { host, updates } = playing(new SlowGame());

      host.move('match-1', 'lan', { event: 'slow', payload: { ms: 200 } });
      expect(host.match('match-1')).toMatchObject({ status: 'playing' });
      host.move('match-1', 'lan', { event: 'slow', payload: { ms: 251 } });

      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });

    it('aborts a Match whose view is over 64 KB', () => {
      const { host, updates } = playing(new SlowGame());

      host.move('match-1', 'lan', { event: 'big' });

      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });

    it('refuses a seat’s 11th move within one second of a Turn-based Match', () => {
      vi.useFakeTimers();
      const { host } = playing(new SlowGame());
      const slow = { event: 'slow', payload: { ms: 0 } };

      for (let i = 0; i < 10; i++) host.move('match-1', 'lan', slow);
      expect(() => host.move('match-1', 'lan', slow)).toThrow('Gửi nhanh quá');
      host.move('match-1', 'minh', slow);
      vi.advanceTimersByTime(1000);
      host.move('match-1', 'lan', slow);

      expect(host.view('match-1', 'lan')).toEqual({ n: 12 });
    });

    it('aborts a Match after 2 hours even while people play', () => {
      vi.useFakeTimers();
      const { host, updates } = playing(new SlowGame());

      for (let minute = 4; minute < 120; minute += 4) {
        vi.advanceTimersByTime(4 * 60 * 1000);
        host.move('match-1', 'lan', { event: 'slow', payload: { ms: 0 } });
      }
      expect(host.match('match-1')).toMatchObject({ status: 'playing' });
      vi.advanceTimersByTime(4 * 60 * 1000);

      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });

    it('aborts a Match when no person sends anything for 5 minutes', () => {
      vi.useFakeTimers();
      const { host, updates } = playing(new SlowGame());

      vi.advanceTimersByTime(MATCH_LIMITS.idleMs - 1000);
      host.move('match-1', 'minh', { event: 'slow', payload: { ms: 0 } });
      vi.advanceTimersByTime(MATCH_LIMITS.idleMs - 1000);
      expect(host.match('match-1')).toMatchObject({ status: 'playing' });
      vi.advanceTimersByTime(1000);

      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });
  });

  describe('seat hold', () => {
    function playing(game: Game<{ turn: number }> | Game<{ started: boolean }>) {
      const host = hostOf([{ manifest, version: 'v1', game }]);
      const updates: MatchState[] = [];
      host.onState((match) => updates.push(match));
      host.startMatch(matchStart);
      host.ready('match-1', 'lan');
      host.ready('match-1', 'minh');
      return { host, updates };
    }

    it('keeps the seat of a player who comes back within 60 seconds', () => {
      vi.useFakeTimers();
      const { host, updates } = playing(new RaceGame());

      host.disconnect('match-1', 'lan');
      expect(updates.at(-1)).toMatchObject({ disconnectedPlayerIds: ['lan'] });
      vi.advanceTimersByTime(MATCH_LIMITS.seatHoldMs - 1);
      host.reconnect('match-1', 'lan');
      expect(updates.at(-1)).toMatchObject({ disconnectedPlayerIds: [] });
      vi.advanceTimersByTime(MATCH_LIMITS.seatHoldMs);
      host.move('match-1', 'lan', { event: 'win' });

      expect(updates.at(-1)).toMatchObject({
        outcome: 'settled',
        result: {
          seats: [
            { player: 'lan', place: 1 },
            { player: 'minh', place: 2 },
          ],
        },
      });
    });

    it('lets the computer play a seat gone for 60 seconds and ranks that player last', () => {
      vi.useFakeTimers();
      const { host, updates } = playing(new RaceGame());

      host.disconnect('match-1', 'lan');
      vi.advanceTimersByTime(MATCH_LIMITS.seatHoldMs);
      vi.runOnlyPendingTimers();

      expect(updates.at(-1)).toMatchObject({
        outcome: 'settled',
        result: {
          seats: [
            { player: 'lan', place: 2 },
            { player: 'minh', place: 1 },
          ],
        },
      });
    });

    it('calls the Game’s leave hook for a seat gone 60 seconds when it has no computer', () => {
      vi.useFakeTimers();
      const { host, updates } = playing(new LeavingGame());

      host.disconnect('match-1', 'minh');
      vi.advanceTimersByTime(MATCH_LIMITS.seatHoldMs);

      expect(updates.at(-1)).toMatchObject({
        outcome: 'settled',
        result: {
          seats: [
            { player: 'lan', place: 1 },
            { player: 'minh', place: 2 },
          ],
        },
      });
    });

    it('holds the seat of a player who dropped while the Match was loading', () => {
      vi.useFakeTimers();
      const host = hostOf([{ manifest, version: 'v1', game: new RaceGame() }]);
      const updates: MatchState[] = [];
      host.onState((match) => updates.push(match));
      host.startMatch(matchStart);
      host.ready('match-1', 'lan');
      host.disconnect('match-1', 'lan');
      host.ready('match-1', 'minh');
      expect(host.match('match-1')).toMatchObject({
        status: 'playing',
        disconnectedPlayerIds: ['lan'],
      });

      vi.advanceTimersByTime(MATCH_LIMITS.seatHoldMs);
      vi.runOnlyPendingTimers();

      expect(updates.at(-1)).toMatchObject({
        outcome: 'settled',
        result: {
          seats: [
            { player: 'lan', place: 2 },
            { player: 'minh', place: 1 },
          ],
        },
      });
    });

    it('aborts the Match once no person is left playing', () => {
      vi.useFakeTimers();
      const { host, updates } = playing(new RaceGame());

      host.disconnect('match-1', 'lan');
      host.disconnect('match-1', 'minh');
      vi.advanceTimersByTime(MATCH_LIMITS.seatHoldMs);

      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });
  });

  describe('settling', () => {
    it('settles the Match result with who left, then tells the Room', async () => {
      vi.useFakeTimers();
      const { matches, results } = memoryResults();
      const host = hostOf([{ manifest, version: 'v1', game: new RaceGame() }], results);
      const notices: MatchResultNotice[] = [];
      host.onResult((notice) => notices.push(notice));
      host.startMatch(matchStart);
      host.ready('match-1', 'lan');
      host.ready('match-1', 'minh');

      host.leave('match-1', 'lan');
      await vi.runOnlyPendingTimersAsync();

      expect(notices).toEqual([
        {
          roomCode: 'ABCD',
          matchId: 'match-1',
          gameId: manifest.id,
          seats: [
            { player: 'lan', place: 2 },
            { player: 'minh', place: 1 },
          ],
        },
      ]);
      const [record] = await matches.recent('minh');
      expect(record).toMatchObject({ id: 'match-1', gameId: manifest.id, outcome: 'win' });
      expect(record?.players).toMatchObject([
        { name: 'Lan', left: true, place: 2 },
        { name: 'Minh', left: false, place: 1 },
      ]);
    });

    it('tells the Room nothing when the settle fails', async () => {
      const results = { settle: vi.fn(async () => Promise.reject(new Error('db down'))) };
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const host = hostOf(
        [{ manifest, version: 'v1', game: new FakeGame() }],
        results as unknown as ResultsService,
      );
      const notices: MatchResultNotice[] = [];
      host.onResult((notice) => notices.push(notice));
      host.startMatch(matchStart);
      host.ready('match-1', 'lan');
      host.ready('match-1', 'minh');

      host.move('match-1', 'lan', { event: 'finish' });
      await vi.waitFor(() => expect(error).toHaveBeenCalled());

      expect(results.settle).toHaveBeenCalledOnce();
      expect(notices).toEqual([]);
      error.mockRestore();
    });
  });
});
