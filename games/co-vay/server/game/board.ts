/** The rules on a board: groups, liberties, captures, repeats and the count. */
import {
  BLACK,
  type Cell,
  type Count,
  EMPTY,
  KOMI,
  type Point,
  type Stone,
  WHITE,
} from './model.js';

export const other = (stone: Stone): Stone => (stone === BLACK ? WHITE : BLACK);
export const indexOf = (size: number, p: Point) => p.y * size + p.x;
export const pointOf = (size: number, i: number): Point => ({
  x: i % size,
  y: Math.floor(i / size),
});

/** The points next to `i` (2 to 4). */
export function neighbours(size: number, i: number): number[] {
  const x = i % size;
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < size - 1) out.push(i + 1);
  if (i >= size) out.push(i - size);
  if (i < size * size - size) out.push(i + size);
  return out;
}

/** The stones connected to `i` and their empty neighbours. */
export function group(board: readonly Cell[], size: number, i: number) {
  const colour = board[i];
  const stones: number[] = [];
  const liberties = new Set<number>();
  const seen = new Set([i]);
  const stack = [i];
  while (stack.length) {
    const p = stack.pop() as number;
    stones.push(p);
    for (const n of neighbours(size, p)) {
      if (board[n] === EMPTY) liberties.add(n);
      else if (board[n] === colour && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return { stones, liberties };
}

/** A position's hash, with whose turn it is not included (positional superko). */
export function hash(board: readonly Cell[]): number {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < board.length; i++) {
    const c = board[i] as number;
    a = Math.imul(a ^ (c + 1), 0x01000193) >>> 0;
    b = Math.imul(b ^ (c * 7 + i), 0x5bd1e995) >>> 0;
  }
  return a * 2 ** 21 + (b & 0x1fffff);
}

export type PlayResult = { board: Cell[]; captured: number[] } | { error: 'occupied' | 'suicide' };

/** `stone` played on `i`: the board after captures, or why it is not allowed. */
export function play(board: readonly Cell[], size: number, i: number, stone: Stone): PlayResult {
  if (board[i] !== EMPTY) return { error: 'occupied' };
  const next = [...board];
  next[i] = stone;
  const captured: number[] = [];
  for (const n of neighbours(size, i)) {
    if (next[n] !== other(stone)) continue;
    const g = group(next, size, n);
    if (g.liberties.size === 0) {
      for (const s of g.stones) {
        next[s] = EMPTY;
        captured.push(s);
      }
    }
  }
  if (!captured.length && group(next, size, i).liberties.size === 0) return { error: 'suicide' };
  return { board: next, captured };
}

/**
 * The empty regions and who owns each: a region bordered only by one colour (dead stones
 * counted as empty points of the other side) is that colour's.
 */
export function territory(board: readonly Cell[], size: number, dead: ReadonlySet<number>) {
  const live = board.map((c, i) => (dead.has(i) ? EMPTY : c));
  const owner = new Array<Cell>(board.length).fill(EMPTY);
  const seen = new Set<number>();
  for (let i = 0; i < live.length; i++) {
    if (live[i] !== EMPTY || seen.has(i)) continue;
    const region: number[] = [];
    const borders = new Set<Cell>();
    const stack = [i];
    seen.add(i);
    while (stack.length) {
      const p = stack.pop() as number;
      region.push(p);
      for (const n of neighbours(size, p)) {
        const c = live[n] as Cell;
        if (c === EMPTY) {
          if (!seen.has(n)) {
            seen.add(n);
            stack.push(n);
          }
        } else borders.add(c);
      }
    }
    if (borders.size === 1) {
      const c = [...borders][0] as Cell;
      for (const p of region) owner[p] = c;
    }
  }
  return { live, owner };
}

/** Area count: each side's live stones and surrounded empty points; White adds komi. */
export function count(board: readonly Cell[], size: number, dead: ReadonlySet<number>): Count {
  const { live, owner } = territory(board, size, dead);
  let black = 0;
  let white = KOMI;
  const land: number[] = [];
  for (let i = 0; i < live.length; i++) {
    const c = live[i] === EMPTY ? owner[i] : live[i];
    if (c === BLACK) black++;
    else if (c === WHITE) white++;
    if (live[i] === EMPTY && owner[i] !== EMPTY) land.push(i);
  }
  return { black, white, territory: land };
}

/** The star points drawn on a board of `size` (hoshi). */
export function starPoints(size: number): number[] {
  const edge = size < 13 ? 2 : 3;
  const far = size - 1 - edge;
  const mid = (size - 1) / 2;
  const points: Point[] = [
    { x: edge, y: edge },
    { x: far, y: edge },
    { x: edge, y: far },
    { x: far, y: far },
    { x: mid, y: mid },
  ];
  if (size >= 19) {
    points.push({ x: mid, y: edge }, { x: mid, y: far }, { x: edge, y: mid }, { x: far, y: mid });
  }
  return points.map((p) => indexOf(size, p));
}

/** A point's name as Go players write it: columns A–T without I, rows counted from the bottom. */
export function pointName(size: number, p: Point) {
  const letters = 'ABCDEFGHJKLMNOPQRST';
  return `${letters[p.x]}${size - p.y}`;
}
