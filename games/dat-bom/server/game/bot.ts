/**
 * The computer player. It plans on whole cells: it flees any cell an explosion will reach (in
 * time, counting chain reactions), places a bomb only when a way out exists, and otherwise walks
 * to the nearest cell where a bomb would break a crate or catch someone. Levels differ in how
 * often it thinks, how often it slips and whether it hunts people.
 */
import type { RealtimeBotContext } from '@xomdao/sdk';
import { blastCells, cellOf, explosionTimes, tileAt } from './arena.js';
import {
  BLAST_TICKS,
  type Bomb,
  type BotLevel,
  type Cell,
  COLS,
  COUNTDOWN_TICKS,
  DIRS,
  type Dir,
  FUSE_TICKS,
  type Input,
  MAX_BOMBS,
  type Options,
  type Player,
  type State,
} from './model.js';

/** Ticks it takes to cross a cell, rounded up: the planner's time step. */
const STEP_TICKS = 7;
/** Steps it plans ahead (84 ticks, past every fuse plus the explosion). */
const HORIZON = 12;

interface Level {
  /** Ticks between two decisions. */
  think: number;
  /** Chance a decision is a random direction instead. */
  slip: number;
  /** Whether it goes after people and bombs them, not only crates. */
  hunts: boolean;
}

const LEVELS: Record<BotLevel, Level> = {
  easy: { think: 6, slip: 0.25, hunts: true },
  normal: { think: 3, slip: 0.05, hunts: true },
  hard: { think: 1, slip: 0, hunts: true },
};

const MOVES: readonly { dir: Dir; dx: number; dy: number }[] = [
  { dir: 'up', dx: 0, dy: -1 },
  { dir: 'down', dx: 0, dy: 1 },
  { dir: 'left', dx: -1, dy: 0 },
  { dir: 'right', dx: 1, dy: 0 },
];

/** Cell index → when explosions fill it: `[from, to)` in ticks from now. */
type Danger = Map<number, [number, number][]>;

const index = (x: number, y: number) => y * COLS + x;

/** The input for one computer seat now, or `null` while it keeps what it last sent. */
export function botInput(ctx: RealtimeBotContext<State, Options>): Input | null {
  const { state, player, tick, rng } = ctx;
  const me = state.players[player.seat];
  const level = LEVELS[ctx.options.level];
  if (!me || me.out !== null || tick < COUNTDOWN_TICKS) return null;
  if ((tick + player.seat) % level.think !== 0) return null;
  if (rng() < level.slip) return { move: DIRS[Math.floor(rng() * DIRS.length)] ?? 'none' };

  const here = cellOf(me);
  const danger = dangers(state);
  if (danger.has(index(here.x, here.y))) {
    return { move: findEscape(state, danger, here, state.bombs) ?? 'none' };
  }

  if (bombValue(state, me, here, level) > 0 && canBomb(state, me)) {
    const bomb = newBomb(me.seat, here);
    const bombs = [...state.bombs, bomb];
    const way = findEscape(state, dangers(state, bomb), here, bombs);
    if (way !== null) return { move: way, bomb: true };
  }

  const crates = (cell: Cell) => bombValue(state, me, cell, { ...level, hunts: false }) > 0;
  const people = (cell: Cell) => bombValue(state, me, cell, level) > crateCount(state, cell);
  const way =
    (level.hunts ? walkTo(state, danger, here, people) : null) ??
    walkTo(state, danger, here, crates);
  return { move: way ?? 'none' };
}

function newBomb(owner: number, at: Cell): Bomb {
  return { id: -1, owner, x: at.x, y: at.y, fuse: FUSE_TICKS, free: [owner] };
}

function canBomb(state: State, me: Player) {
  const { x, y } = cellOf(me);
  return (
    state.bombs.filter((b) => b.owner === me.seat).length < MAX_BOMBS &&
    !state.bombs.some((b) => b.x === x && b.y === y)
  );
}

/** Every cell an explosion will fill, with when: bombs on the floor, chains and burning cells. */
function dangers(state: State, extra?: Bomb): Danger {
  const danger: Danger = new Map();
  const add = (cell: Cell, window: [number, number]) => {
    const key = index(cell.x, cell.y);
    danger.set(key, [...(danger.get(key) ?? []), window]);
  };
  const bombs = extra ? [...state.bombs, extra] : state.bombs;
  const times = explosionTimes(state.rows, bombs);
  bombs.forEach((bomb, i) => {
    const at = times[i] as number;
    for (const cell of blastCells(state.rows, bomb.x, bomb.y)) add(cell, [at, at + BLAST_TICKS]);
  });
  for (const blast of state.blasts) for (const cell of blast.cells) add(cell, [0, blast.left]);
  return danger;
}

/** Crates `bomb` at `cell` would break, plus 3 for each other person it would catch (if it hunts). */
function bombValue(state: State, me: Player, cell: Cell, level: Level) {
  let value = 0;
  for (const c of blastCells(state.rows, cell.x, cell.y)) {
    if (tileAt(state.rows, c.x, c.y) === 'c') value += 1;
    if (!level.hunts) continue;
    const caught = state.players.some(
      (p) => p.seat !== me.seat && p.out === null && cellOf(p).x === c.x && cellOf(p).y === c.y,
    );
    if (caught) value += 3;
  }
  return value;
}

function crateCount(state: State, cell: Cell) {
  return blastCells(state.rows, cell.x, cell.y).filter((c) => tileAt(state.rows, c.x, c.y) === 'c')
    .length;
}

/** Whether a cell can be stepped into: open floor with no bomb. */
function open(state: State, bombs: readonly Bomb[], x: number, y: number) {
  return tileAt(state.rows, x, y) === '.' && !bombs.some((b) => b.x === x && b.y === y);
}

/**
 * The first step of the shortest way, looking ahead in time, to a cell no explosion will touch
 * again without ever standing in one while it burns: a direction (`none` = wait), or `null`
 * when there is no such way.
 */
function findEscape(state: State, danger: Danger, start: Cell, bombs: readonly Bomb[]): Dir | null {
  interface Node {
    x: number;
    y: number;
    k: number;
    first: Dir | null;
  }
  const seen = new Set<string>();
  const queue: Node[] = [{ ...start, k: 0, first: null }];
  while (queue.length) {
    const node = queue.shift() as Node;
    const windows = danger.get(index(node.x, node.y)) ?? [];
    if (windows.every(([, to]) => to <= node.k * STEP_TICKS)) return node.first ?? 'none';
    if (node.k >= HORIZON) continue;
    const from = (node.k + 1) * STEP_TICKS;
    const options = [{ dir: 'none' as Dir, dx: 0, dy: 0 }, ...MOVES];
    for (const { dir, dx, dy } of options) {
      const x = node.x + dx;
      const y = node.y + dy;
      if (dir !== 'none' && !open(state, bombs, x, y)) continue;
      const burns = (danger.get(index(x, y)) ?? []).some(
        ([a, b]) => a < from + STEP_TICKS && b > from,
      );
      const key = `${x},${y},${node.k + 1}`;
      if (burns || seen.has(key)) continue;
      seen.add(key);
      queue.push({ x, y, k: node.k + 1, first: node.first ?? dir });
    }
  }
  return null;
}

/** The first step of the shortest way over cells no explosion will touch to a cell where `wanted`. */
function walkTo(
  state: State,
  danger: Danger,
  start: Cell,
  wanted: (cell: Cell) => boolean,
): Dir | null {
  const seen = new Set<number>([index(start.x, start.y)]);
  const queue: { x: number; y: number; first: Dir | null }[] = [{ ...start, first: null }];
  while (queue.length) {
    const node = queue.shift() as (typeof queue)[number];
    if (node.first !== null && wanted(node)) return node.first;
    for (const { dir, dx, dy } of MOVES) {
      const x = node.x + dx;
      const y = node.y + dy;
      const key = index(x, y);
      if (seen.has(key) || !open(state, state.bombs, x, y) || danger.has(key)) continue;
      seen.add(key);
      queue.push({ x, y, first: node.first ?? dir });
    }
  }
  return null;
}
