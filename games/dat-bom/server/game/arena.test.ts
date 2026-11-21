import { seededRng } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import {
  blastCells,
  burn,
  cellOf,
  explosionTimes,
  newArena,
  placeBomb,
  placesOf,
  walk,
} from './arena.js';
import {
  BLAST_TICKS,
  BOMB_DAMAGE,
  COLS,
  FUSE_TICKS,
  GUARD_TICKS,
  MAX_HP,
  type Player,
  ROWS,
  STEP,
  type State,
} from './model.js';

/** An arena with pillars and no crates, two players in the top-left and bottom-right corners. */
function blank(): State {
  const state = newArena(2, () => 1);
  state.rows = state.rows.map((row) => row.replaceAll('c', '.'));
  return state;
}

const player = (state: State, seat = 0) => state.players[seat] as Player;

/** Puts a player in the middle of a cell. */
function stand(p: Player, x: number, y: number) {
  p.x = x + 0.5;
  p.y = y + 0.5;
}

function setFuse(state: State, bomb: number, fuse: number) {
  const target = state.bombs[bomb];
  if (!target) throw new Error(`no bomb ${bomb}`);
  target.fuse = fuse;
}

function walkFor(state: State, p: Player, move: Player['move'], ticks: number) {
  p.move = move;
  for (let i = 0; i < ticks; i++) walk(state, p);
}

describe('the arena', () => {
  it('has a pillar on every odd column and row, and the corners are open', () => {
    const { rows } = newArena(4, seededRng(3));
    expect(rows).toHaveLength(ROWS);
    expect(rows.every((row) => row.length === COLS)).toBe(true);
    expect(rows[1]?.[1]).toBe('#');
    expect(rows[3]?.[5]).toBe('#');
    expect(rows[0]?.[1]).not.toBe('#');
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [2, 0],
      [0, 2],
      [COLS - 1, ROWS - 1],
      [COLS - 2, ROWS - 1],
      [COLS - 1, ROWS - 2],
    ] as const) {
      expect(rows[y]?.[x]).toBe('.');
    }
    expect(rows.join('').includes('c')).toBe(true);
  });

  it('puts two players in opposite corners, and builds the same arena from the same seed', () => {
    const one = newArena(2, seededRng(9));
    expect(one.players.map(cellOf)).toEqual([
      { x: 0, y: 0 },
      { x: COLS - 1, y: ROWS - 1 },
    ]);
    expect(one.players.every((p) => p.hp === MAX_HP && p.out === null)).toBe(true);
    expect(newArena(2, seededRng(9))).toEqual(one);
    expect(newArena(2, seededRng(10)).rows).not.toEqual(one.rows);
  });
});

describe('walking', () => {
  it('crosses 3.2 cells in a second', () => {
    const state = blank();
    const p = player(state);
    walkFor(state, p, 'right', 20);
    expect(p.x).toBeCloseTo(0.5 + 3.2);
    expect(p.y).toBe(0.5);
    expect(STEP * 20).toBeCloseTo(3.2);
  });

  it('stops in the middle of the cell before a pillar', () => {
    const state = blank();
    const p = player(state);
    stand(p, 0, 1);
    walkFor(state, p, 'right', 10);
    expect(p).toMatchObject({ x: 0.5, y: 1.5 });
  });

  it('stops before a crate, and the arena edge', () => {
    const state = blank();
    state.rows[0] = `..c${'.'.repeat(COLS - 3)}`;
    const p = player(state);
    walkFor(state, p, 'right', 40);
    expect(p.x).toBeCloseTo(1.5);
    walkFor(state, p, 'left', 40);
    expect(p.x).toBeCloseTo(0.5);
    walkFor(state, p, 'up', 5);
    expect(p.y).toBeCloseTo(0.5);
  });

  it('slides onto the lane before it turns', () => {
    const state = blank();
    const p = player(state);
    p.x = 2.5;
    p.y = 4.7;
    walkFor(state, p, 'right', 1);
    expect(p.y).toBeCloseTo(4.54);
    expect(p.x).toBe(2.5);
    walkFor(state, p, 'right', 1);
    expect(p.y).toBeCloseTo(4.5);
    expect(p.x).toBeCloseTo(2.5 + STEP - 0.04);
  });

  it('walks left and up as well as right and down', () => {
    const state = blank();
    const p = player(state);
    stand(p, 4, 4);
    walkFor(state, p, 'left', 10);
    expect(p.x).toBeCloseTo(4.5 - 10 * STEP);
    walkFor(state, p, 'up', 5);
    expect(p).toMatchObject({ x: 2.5, y: expect.closeTo(4.5 - 0.4) });
  });

  it('stops where a player holds nothing', () => {
    const state = blank();
    const p = player(state);
    walkFor(state, p, 'none', 10);
    expect(p).toMatchObject({ x: 0.5, y: 0.5 });
  });
});

describe('bombs', () => {
  it('blocks others, and lets who stood on it walk off but not back', () => {
    const state = blank();
    const [a, b] = [player(state, 0), player(state, 1)];
    stand(a, 4, 0);
    stand(b, 4, 0);
    placeBomb(state, a);
    expect(state.bombs[0]).toMatchObject({ x: 4, y: 0, free: [0, 1], fuse: FUSE_TICKS });

    walkFor(state, a, 'right', 8);
    burn(state, 1);
    expect(a.x).toBeGreaterThan(5);
    expect(state.bombs[0]?.free).toEqual([1]);
    walkFor(state, a, 'left', 20);
    expect(a.x).toBeCloseTo(5.5);
    stand(b, 3, 0);
    burn(state, 2);
    expect(state.bombs[0]?.free).toEqual([]);
    walkFor(state, b, 'right', 20);
    expect(b.x).toBeCloseTo(3.5);
  });

  it('puts one bomb to a cell and two to a player', () => {
    const state = blank();
    const a = player(state);
    placeBomb(state, a);
    placeBomb(state, a);
    expect(state.bombs).toHaveLength(1);
    stand(a, 2, 0);
    placeBomb(state, a);
    stand(a, 4, 0);
    placeBomb(state, a);
    expect(state.bombs).toHaveLength(2);
  });

  it('fills a cross of range 2, stopped by pillars, and by crates it includes', () => {
    const state = blank();
    expect(blastCells(state.rows, 4, 4)).toHaveLength(9);
    expect(
      blastCells(state.rows, 0, 0)
        .map(({ x, y }) => `${x},${y}`)
        .sort(),
    ).toEqual(['0,0', '0,1', '0,2', '1,0', '2,0']);
    expect(blastCells(state.rows, 1, 0).map(({ x, y }) => `${x},${y}`)).not.toContain('1,2');
    state.rows[0] = `.c${'.'.repeat(COLS - 2)}`;
    expect(blastCells(state.rows, 0, 0).map(({ x, y }) => `${x},${y}`)).toContain('1,0');
    expect(blastCells(state.rows, 0, 0).map(({ x, y }) => `${x},${y}`)).not.toContain('2,0');
  });

  it('sets each bomb off when an explosion reaches it first', () => {
    const state = blank();
    stand(player(state), 0, 0);
    placeBomb(state, player(state));
    stand(player(state), 2, 0);
    placeBomb(state, player(state));
    setFuse(state, 1, 10);
    expect(explosionTimes(state.rows, state.bombs)).toEqual([10, 10]);
  });
});

describe('explosions', () => {
  /** Bomb of player 0 at the cell (4, 4), with player 1 standing at `at`. */
  function bombed(at: [number, number]) {
    const state = blank();
    stand(player(state), 4, 4);
    placeBomb(state, player(state));
    stand(player(state, 1), ...at);
    setFuse(state, 0, 1);
    return state;
  }

  it('hurts whoever stands in the cross once, and spares the rest', () => {
    const state = bombed([4, 5]);
    stand(player(state), 0, 0);
    burn(state, 1);
    expect(state.bombs).toHaveLength(0);
    expect(state.blasts).toHaveLength(1);
    expect(player(state, 1).hp).toBe(MAX_HP - BOMB_DAMAGE);
    expect(player(state, 0).hp).toBe(MAX_HP);
    for (let i = 0; i < BLAST_TICKS; i++) burn(state, 2 + i);
    expect(player(state, 1).hp).toBe(MAX_HP - BOMB_DAMAGE);
    expect(state.blasts).toHaveLength(0);
  });

  it('hurts the one who put the bomb down, and guards for a while after a hit', () => {
    const state = bombed([0, 8]);
    burn(state, 1);
    expect(player(state, 0)).toMatchObject({ hp: MAX_HP - BOMB_DAMAGE, guard: GUARD_TICKS });
    for (let i = 0; i < GUARD_TICKS; i++) burn(state, 2 + i);
    expect(player(state, 0).guard).toBe(0);
  });

  it('knocks out a player whose health runs out', () => {
    const state = bombed([4, 5]);
    stand(player(state), 0, 0);
    player(state, 1).hp = BOMB_DAMAGE;
    player(state, 1).move = 'left';
    burn(state, 7);
    expect(player(state, 1)).toMatchObject({ hp: 0, out: 7, move: 'none' });
  });

  it('breaks the crate in the way and stops there', () => {
    const state = bombed([0, 8]);
    state.rows[4] = `${'.'.repeat(5)}c${'.'.repeat(COLS - 6)}`;
    burn(state, 1);
    expect(state.rows[4]?.[5]).toBe('.');
    expect(state.blasts[0]?.cells.map(({ x, y }) => `${x},${y}`)).toContain('5,4');
    expect(state.blasts[0]?.cells.map(({ x, y }) => `${x},${y}`)).not.toContain('6,4');
  });

  it('sets off a bomb in the cross at once', () => {
    const state = bombed([0, 8]);
    stand(player(state, 1), 4, 2);
    placeBomb(state, player(state, 1));
    setFuse(state, 1, 40);
    stand(player(state, 1), 10, 8);
    burn(state, 1);
    expect(state.bombs).toHaveLength(0);
    expect(state.blasts).toHaveLength(2);
  });
});

describe('placesOf', () => {
  const p = (hp: number, out: number | null) => ({ hp, out }) as Player;

  it('puts the standing above the knocked out', () => {
    expect(placesOf([p(0, 100), p(20, null), p(0, 300)])).toEqual([3, 1, 2]);
  });

  it('orders the standing by health, the others by who lasted', () => {
    expect(placesOf([p(30, null), p(65, null), p(0, 50), p(0, 90)])).toEqual([2, 1, 4, 3]);
  });

  it('shares a place between equals', () => {
    expect(placesOf([p(30, null), p(30, null), p(0, 9)])).toEqual([1, 1, 3]);
    expect(placesOf([p(0, 9), p(0, 9)])).toEqual([1, 1]);
  });
});
