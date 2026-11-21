import { defineManifest, type EventContext, Game, type StartContext } from '@xomdao/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { GameHostService, LOADING_TIMEOUT_MS } from './game-host.service.js';

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

const matchStart = {
  matchId: 'match-1',
  roomCode: 'ABCD',
  gameId: manifest.id,
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
    const host = new GameHostService([{ manifest, game: new FakeGame(start) }]);
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
    const host = new GameHostService([{ manifest, game: new FakeGame() }]);
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

  it('marks a Match aborted when a Game fails during startup', () => {
    const updates: { status: string; outcome?: string }[] = [];
    const host = new GameHostService([
      {
        manifest,
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
    const host = new GameHostService([{ manifest, game }]);
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
    const host = new GameHostService([{ manifest, game: new FakeGame() }]);
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
});
