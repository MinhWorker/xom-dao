import {
  defineManifest,
  type InitContext,
  type InputContext,
  type RealtimeContext,
  RealtimeGame,
  type RealtimeLeaveContext,
  type RealtimeOutcome,
} from '@xomdao/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore } from '../accounts/accounts.store.js';
import { MatchesService } from '../matches/matches.service.js';
import { MemoryMatchesStore } from '../matches/matches.store.js';
import { ResultsService } from '../results/results.service.js';
import { StatsService } from '../stats/stats.service.js';
import { MemoryStatsStore } from '../stats/stats.store.js';
import { GameHostService, MATCH_LIMITS } from './game-host.service.js';
import type { HostedGame, MatchState } from './game-host.types.js';

function memoryResults() {
  const matches = new MatchesService(new MemoryMatchesStore());
  const stats = new StatsService(
    new MemoryStatsStore(),
    new AccountsService(new MemoryAccountsStore()),
  );
  return new ResultsService(null, matches, stats);
}

const manifest = defineManifest({
  id: 'fake-realtime',
  name: 'Game thời gian thực giả',
  tagline: 'Game kiểm tra vòng tick.',
  minPlayers: 2,
  maxPlayers: 2,
  duration: { min: 1, max: 1 },
  status: 'wip',
  bots: false,
  focus: { x: 50, y: 50 },
});

interface State {
  ticks: number;
  /** Total of the inputs each seat sent. */
  sums: number[];
  /** How long, in fake ms, the next tick takes. */
  lag: number;
  /** Extra bytes in every view. */
  padding: number;
}

/** Counts ticks and each seat's inputs; ends after `target` ticks, the seat with more wins. */
class CountGame extends RealtimeGame<State, { n: number }> {
  readonly tickRate = 20;
  readonly snapshotRate = 10;
  readonly inputSchema = z.object({ n: z.number() });

  constructor(
    private readonly target = Number.POSITIVE_INFINITY,
    private readonly padding = 0,
  ) {
    super();
  }

  init(ctx: InitContext) {
    return { ticks: 0, sums: ctx.players.map(() => 0), lag: 0, padding: this.padding };
  }

  input(ctx: InputContext<State, { n: number }>) {
    const sums = ctx.state.sums.map((s, i) => (i === ctx.player.seat ? s + ctx.input.n : s));
    return { ...ctx.state, sums, lag: ctx.input.n === 999 ? 300 : ctx.state.lag };
  }

  tick(ctx: RealtimeContext<State>) {
    if (ctx.state.lag) vi.advanceTimersByTime(ctx.state.lag);
    return { ...ctx.state, ticks: ctx.state.ticks + 1, lag: 0 };
  }

  result(ctx: RealtimeContext<State>): RealtimeOutcome | null {
    if (ctx.state.ticks < this.target) return null;
    const [a = 0, b = 0] = ctx.state.sums;
    return { places: a >= b ? [1, 2] : [2, 1] };
  }

  view(ctx: RealtimeContext<State>) {
    return { ticks: ctx.state.ticks, sums: ctx.state.sums, padding: 'x'.repeat(ctx.state.padding) };
  }
}

class LeavingGame extends CountGame {
  onLeave(ctx: RealtimeLeaveContext<State>) {
    return { ...ctx.state, sums: ctx.state.sums.map((s, i) => (i === ctx.player.seat ? -1 : s)) };
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

const input = (seq: number, n = 1) => ({ event: 'input', payload: { seq, input: { n } } });

function playing(game: RealtimeGame<State, { n: number }>) {
  vi.useFakeTimers();
  const server: HostedGame = { manifest, version: 'v1', game };
  const host = new GameHostService([server], memoryResults());
  const updates: MatchState[] = [];
  host.onState((match) => updates.push(match));
  host.startMatch(matchStart);
  host.ready('match-1', 'lan');
  host.ready('match-1', 'minh');
  return { host, updates };
}

describe('GameHostService with a Realtime Game', () => {
  afterEach(() => vi.useRealTimers());

  it('ticks at the Game’s fixed rate', () => {
    const { host } = playing(new CountGame());

    vi.advanceTimersByTime(1000);
    host.move('match-1', 'lan', input(0, 0));
    vi.advanceTimersByTime(50);
    host.move('match-1', 'lan', input(1, 0));
    vi.advanceTimersByTime(1000);

    expect(host.match('match-1')).toMatchObject({ status: 'playing', tick: 40 });
    expect(host.view('match-1', 'lan')).toMatchObject({ ticks: 40 });
  });

  it('sends a snapshot at the Game’s snapshot rate, each with its tick', () => {
    const { updates } = playing(new CountGame());
    updates.length = 0;

    vi.advanceTimersByTime(1000);

    expect(updates).toHaveLength(10);
    expect(updates.map((u) => u.tick)).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(updates.every((u) => u.status === 'playing')).toBe(true);
  });

  it('shows a snapshot as soon as the Match starts playing', () => {
    const { host, updates } = playing(new CountGame());

    expect(updates.at(-1)).toMatchObject({ status: 'playing', tick: 0 });
    expect(host.view('match-1', 'minh')).toMatchObject({ ticks: 0 });
  });

  it('applies an input at the next tick and acks it in the next snapshot', () => {
    const { host } = playing(new CountGame());

    host.move('match-1', 'lan', input(0, 5));
    host.move('match-1', 'lan', input(1, 2));
    host.move('match-1', 'minh', input(0, 1));
    expect(host.view('match-1', 'lan')).toMatchObject({ sums: [0, 0] });
    expect(host.ack('match-1', 'lan')).toBeUndefined();

    vi.advanceTimersByTime(50);
    expect(host.view('match-1', 'lan')).toMatchObject({ sums: [0, 0] });
    vi.advanceTimersByTime(50);

    expect(host.view('match-1', 'lan')).toMatchObject({ ticks: 2, sums: [7, 1] });
    expect(host.ack('match-1', 'lan')).toBe(1);
    expect(host.ack('match-1', 'minh')).toBe(0);
  });

  it('drops an input whose seq was already applied', () => {
    const { host } = playing(new CountGame());

    host.move('match-1', 'lan', input(3, 5));
    vi.advanceTimersByTime(100);
    host.move('match-1', 'lan', input(3, 5));
    host.move('match-1', 'lan', input(2, 5));
    vi.advanceTimersByTime(100);

    expect(host.view('match-1', 'lan')).toMatchObject({ sums: [5, 0] });
    expect(host.ack('match-1', 'lan')).toBe(3);
  });

  it('refuses malformed input without ticking differently', () => {
    const { host } = playing(new CountGame());

    expect(() => host.move('match-1', 'lan', { event: 'jump' })).toThrow('Nước đi không hợp lệ');
    expect(() => host.move('match-1', 'lan', { event: 'input', payload: { n: 1 } })).toThrow(
      'Nước đi không hợp lệ',
    );
    expect(() => host.move('match-1', 'lan', { event: 'input', payload: { seq: 0 } })).toThrow(
      'Nước đi không hợp lệ',
    );
    expect(() => host.move('match-1', 'ai', input(0))).toThrow('không ngồi');
    expect(host.match('match-1')).toMatchObject({ status: 'playing' });
  });

  it('settles the Match when the Game’s result is in, and stops ticking', () => {
    const { host, updates } = playing(new CountGame(10));
    host.move('match-1', 'minh', input(0, 3));

    vi.advanceTimersByTime(1000);

    expect(host.match('match-1')).toBeUndefined();
    expect(updates.at(-1)).toMatchObject({
      status: 'over',
      outcome: 'settled',
      result: {
        seats: [
          { player: 'lan', place: 2 },
          { player: 'minh', place: 1 },
        ],
      },
    });
    const count = updates.length;
    vi.advanceTimersByTime(5000);
    expect(updates).toHaveLength(count);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops ticking when the Match is stopped', () => {
    const { host, updates } = playing(new CountGame());

    host.stop('match-1');
    const count = updates.length;
    vi.advanceTimersByTime(1000);

    expect(updates).toHaveLength(count);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives the reconnecting player the latest snapshot', () => {
    const { host, updates } = playing(new CountGame());

    host.disconnect('match-1', 'lan');
    vi.advanceTimersByTime(500);
    host.reconnect('match-1', 'lan');

    expect(updates.at(-1)).toMatchObject({
      status: 'playing',
      tick: 10,
      disconnectedPlayerIds: [],
    });
    expect(host.view('match-1', 'lan')).toMatchObject({ ticks: 10 });
  });

  describe('limits', () => {
    it('refuses a seat’s 61st input within one second', () => {
      const { host } = playing(new CountGame());

      for (let seq = 0; seq < MATCH_LIMITS.inputsPerSecond; seq++) {
        host.move('match-1', 'lan', input(seq));
      }
      expect(() => host.move('match-1', 'lan', input(60))).toThrow('Gửi nhanh quá');
      host.move('match-1', 'minh', input(0));
      vi.advanceTimersByTime(1000);
      host.move('match-1', 'lan', input(61));
      vi.advanceTimersByTime(100);

      expect(host.view('match-1', 'lan')).toMatchObject({ sums: [61, 1] });
    });

    it('refuses an input over its byte limit', () => {
      const { host } = playing(new CountGame());
      const big = { seq: 0, input: { n: 1, padding: 'x'.repeat(MATCH_LIMITS.inputBytes) } };

      expect(() => host.move('match-1', 'lan', { event: 'input', payload: big })).toThrow(
        'Input quá lớn',
      );
    });

    it('aborts a Match whose tick runs longer than 250 ms', () => {
      const { host, updates } = playing(new CountGame());

      host.move('match-1', 'lan', input(0, 999));
      vi.advanceTimersByTime(100);

      expect(host.match('match-1')).toBeUndefined();
      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });

    it('aborts a Match whose view is over 64 KB', () => {
      const { updates } = playing(new CountGame(Number.POSITIVE_INFINITY, MATCH_LIMITS.viewBytes));

      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });

    it('aborts a Match when no person sends anything for 5 minutes', () => {
      const { host, updates } = playing(new CountGame());

      vi.advanceTimersByTime(MATCH_LIMITS.idleMs - 1000);
      host.move('match-1', 'minh', input(0));
      vi.advanceTimersByTime(MATCH_LIMITS.idleMs - 1000);
      expect(host.match('match-1')).toMatchObject({ status: 'playing' });
      vi.advanceTimersByTime(1000);

      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });

    it('aborts a Match after 2 hours', () => {
      const { host, updates } = playing(new CountGame());

      for (let minute = 4; minute < 120; minute += 4) {
        vi.advanceTimersByTime(4 * 60 * 1000);
        host.move('match-1', 'lan', input(minute));
      }
      expect(host.match('match-1')).toMatchObject({ status: 'playing' });
      vi.advanceTimersByTime(4 * 60 * 1000);

      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });

    it('drops the ticks it is too far behind to run instead of replaying them', () => {
      const { host } = playing(new CountGame());

      vi.setSystemTime(Date.now() + 10_000);
      vi.advanceTimersByTime(50);

      const { ticks } = host.view('match-1', 'lan') as { ticks: number };
      expect(ticks).toBeLessThanOrEqual(MATCH_LIMITS.catchUpTicks + 1);
    });
  });

  describe('a player leaving', () => {
    it('lets the Game’s leave hook handle it, and refuses their input', () => {
      const { host, updates } = playing(new LeavingGame());

      host.leave('match-1', 'minh');

      expect(updates.at(-1)).toMatchObject({ status: 'playing' });
      expect(host.view('match-1', 'lan')).toMatchObject({ sums: [0, -1] });
      expect(() => host.move('match-1', 'minh', input(0))).toThrow('Bạn đã rời ván này');
    });

    it('aborts the Match when the Game has no leave hook', () => {
      const { host, updates } = playing(new CountGame());

      host.leave('match-1', 'minh');

      expect(host.match('match-1')).toBeUndefined();
      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });

    it('holds the seat of a dropped player, then forfeits it', () => {
      const { host, updates } = playing(new LeavingGame());

      host.disconnect('match-1', 'minh');
      vi.advanceTimersByTime(MATCH_LIMITS.seatHoldMs - 1);
      expect(host.view('match-1', 'lan')).toMatchObject({ sums: [0, 0] });
      vi.advanceTimersByTime(1);

      expect(host.view('match-1', 'lan')).toMatchObject({ sums: [0, -1] });
      expect(updates.at(-1)).toMatchObject({ status: 'playing' });
    });

    it('aborts when no person is left', () => {
      const { host, updates } = playing(new LeavingGame());

      host.leave('match-1', 'minh');
      host.leave('match-1', 'lan');

      expect(updates.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    });
  });

  it('refuses a Realtime Game whose manifest asks for bots', () => {
    const bots = { ...manifest, bots: true };
    expect(
      () =>
        new GameHostService(
          [{ manifest: bots, version: 'v1', game: new CountGame() }],
          memoryResults(),
        ),
    ).toThrow('no bot hook');
  });
});
