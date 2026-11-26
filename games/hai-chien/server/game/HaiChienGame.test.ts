import { optionsSchema, seededRng, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { cellsOf, layoutProblem, randomFleet } from './fleet.js';
import { HaiChienGame } from './HaiChienGame.js';
import {
  Clear,
  FLEET,
  Hit,
  Miss,
  type Options,
  type Placement,
  Unknown,
  type View,
} from './model.js';

/** Every ship along its own row, from x = 0, on even rows: 0, 2, 4, 6, 8. */
const ROWS: Placement[] = FLEET.map((_, id) => ({ x: 0, y: id * 2, v: false }));

function match(options: Partial<Options> = {}, bots: string[] = [], seed = 1) {
  return testGame(new HaiChienGame(), ['a', 'b'], {
    options: optionsSchema(manifest).parse(options),
    bots,
    seed,
  });
}

/** Both fleets in ROWS; a fires first (the first seed whose coin says so). */
function battle(options: Partial<Options> = {}) {
  for (let seed = 1; ; seed++) {
    const game = match(options, [], seed);
    if (game.state.turn !== 'a') continue;
    return game.send('a', 'fleet', { ships: ROWS }).send('b', 'fleet', { ships: ROWS });
  }
}

/** Fires every cell of b's fleet as a. */
/** What `viewer` sees. */
const see = (game: ReturnType<typeof match>, viewer: string | null) => game.view(viewer) as View;

const sinkAll = (game: ReturnType<typeof match>) => {
  for (const [id, at] of ROWS.entries()) for (const c of cellsOf(id, at)) game.send('a', 'fire', c);
};

describe('hai-chien', () => {
  it('checks fleet layouts: all five ships, on the sea, never touching', () => {
    expect(layoutProblem(ROWS)).toBeNull();
    expect(layoutProblem(ROWS.slice(1))).toBe('Hạm đội chưa đủ tàu');
    expect(layoutProblem([{ x: 6, y: 0, v: false }, ...ROWS.slice(1)])).toBe(
      'Có tàu nằm ngoài biển',
    );
    const touching = [...ROWS];
    touching[1] = { x: 0, y: 1, v: false };
    expect(layoutProblem(touching)).toBe('Hai tàu không được nằm sát nhau');
    const corner = [...ROWS];
    corner[4] = { x: 3, y: 7, v: false };
    expect(layoutProblem(corner)).toBe('Hai tàu không được nằm sát nhau');
    const rng = seededRng(3);
    for (let i = 0; i < 50; i++) expect(layoutProblem(randomFleet(rng))).toBeNull();
  });

  it('starts in setup and the battle begins once both fleets are ready', () => {
    const game = match();
    expect(game.state.phase).toBe('setup');
    expect(game.error('a', 'fire', { x: 0, y: 0 })).toBe('Hai bên chưa xếp xong hạm đội');
    game.send('a', 'fleet', { ships: ROWS });
    expect(game.state.seas.a?.ready).toBe(true);
    game.send('a', 'unready', {});
    expect(game.state.seas.a?.ready).toBe(false);
    game.send('a', 'fleet', { ships: ROWS });
    expect(game.state.phase).toBe('setup');
    game.send('b', 'fleet', { ships: ROWS });
    expect(game.state.phase).toBe('battle');
    expect(game.error('a', 'unready', {})).toBe('Trận đánh đã bắt đầu');
  });

  it('hides the other fleet until a ship sinks', () => {
    const game = battle();
    expect(see(game, 'a').seas.b?.ships).toEqual([null, null, null, null, null]);
    expect(see(game, 'a').seas.a?.ships).toEqual(ROWS);
    expect(see(game, null).seas.a?.ships.every((s) => s === null)).toBe(true);
    game.send('a', 'fire', { x: 0, y: 8 }).send('a', 'fire', { x: 1, y: 8 });
    expect(see(game, 'a').seas.b?.ships[4]).toEqual(ROWS[4]);
    expect(see(game, 'a').seas.b?.sunk).toEqual([false, false, false, false, true]);
  });

  it('a hit fires again, a miss hands over; sinking clears the water around', () => {
    const game = battle();
    game.send('a', 'fire', { x: 0, y: 8 });
    expect(game.state.last).toMatchObject({ result: 'hit', ship: 4 });
    expect(game.state.turn).toBe('a');
    expect(game.error('a', 'fire', { x: 0, y: 8 })).toBe('Ô này đã bắn rồi');
    game.send('a', 'fire', { x: 1, y: 8 });
    expect(game.state.last).toMatchObject({ result: 'sunk', ship: 4 });
    const marks = game.state.seas.b?.marks ?? [];
    expect(marks[7 * 10 + 0]).toBe(Clear);
    expect(marks[9 * 10 + 2]).toBe(Clear);
    expect(game.error('a', 'fire', { x: 2, y: 9 })).toBe('Ô này chắc chắn không có tàu');
    game.send('a', 'fire', { x: 9, y: 9 });
    expect(game.state.seas.b?.marks[99]).toBe(Miss);
    expect(game.state.turn).toBe('b');
    expect(game.error('a', 'fire', { x: 9, y: 8 })).toBe('Chưa tới lượt bạn');
  });

  it('without chain fire, every shot hands over', () => {
    const game = battle({ chain: false });
    game.send('a', 'fire', { x: 0, y: 0 });
    expect(game.state.seas.b?.marks[0]).toBe(Hit);
    expect(game.state.turn).toBe('b');
  });

  it('sinking the whole fleet wins, and the loser fires first next Match', () => {
    const game = battle();
    sinkAll(game);
    expect(game.state.phase).toBe('over');
    expect(game.result).toMatchObject({
      seats: [
        { player: 'a', place: 1, score: 1 },
        { player: 'b', place: 2, score: 0 },
      ],
    });
    expect(game.result?.stats?.filter((s) => s.name === 'sunk')).toHaveLength(5);
    expect(see(game, 'b').seas.a?.ships).toEqual(ROWS);
    game.newMatch();
    expect(game.state.turn).toBe('b');
    expect(game.state.wins).toEqual({ a: 1, b: 0 });
  });

  it('radar counts ship cells in a 3×3 area, once, and clears an empty one', () => {
    const game = battle();
    game.send('a', 'scan', { x: 1, y: 1 });
    expect(game.state.last).toMatchObject({ kind: 'scan', count: 6 });
    expect(game.state.turn).toBe('b');
    expect(game.state.seas.a?.radar).toBe(0);
    game.send('b', 'scan', { x: 8, y: 8 });
    expect(game.state.seas.a?.marks[9 * 10 + 9]).toBe(Clear);
    expect(game.state.seas.a?.marks[8 * 10 + 8]).toBe(Clear);
    expect(game.state.seas.a?.marks[8 * 10 + 1]).toBe(Unknown);
    game.send('a', 'fire', { x: 9, y: 9 });
    expect(game.error('b', 'scan', { x: 4, y: 4 })).toBe('Bạn đã dùng hết ra-đa');
    expect(battle({ radar: false }).error('a', 'scan', { x: 4, y: 4 })).toBe(
      'Bạn đã dùng hết ra-đa',
    );
  });

  it('a player leaving hands the Match to the other', () => {
    const game = battle();
    game.leave('b');
    expect(game.result?.seats.map((s) => s.place)).toEqual([1, 2]);
  });

  it('the computer places its fleet and plays a Match out', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const game = match({ level }, ['b']);
      game.send('a', 'fleet', { ships: ROWS });
      const move = game.bot('b');
      expect(move?.event).toBe('fleet');
      game.send('b', move?.event ?? '', move?.payload as object);
      expect(game.state.phase).toBe('battle');
      let guard = 0;
      while (game.state.phase === 'battle' && guard++ < 400) {
        if (game.state.turn === 'b') {
          const m = game.bot('b');
          game.send('b', m?.event ?? '', m?.payload as object);
        } else {
          const free = game.state.seas.b?.marks.indexOf(Unknown) ?? 0;
          game.send('a', 'fire', { x: free % 10, y: Math.floor(free / 10) });
        }
      }
      expect(game.state.phase).toBe('over');
    }
  });
});
