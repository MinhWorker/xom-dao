/**
 * The computer's choices: its move (a search of a size set by the level), when to pass, and
 * which stones it counts as dead.
 */
import type { Rng } from '@xomdao/sdk';
import { group, hash, play } from './board.js';
import { ownership, think } from './engine.js';
import { BLACK, type BotLevel, type Cell, EMPTY, type Stone } from './model.js';

/** Playout moves the search may spend, per point of the board (so bigger boards think more). */
const BUDGET: Record<BotLevel, number> = { easy: 90, normal: 380, hard: 900 };
/** The most it spends whatever the board, to keep a move under the server's time limit. */
const CAP: Record<BotLevel, number> = { easy: 10_000, normal: 35_000, hard: 75_000 };

/** The board indexes that would repeat a position from `seen` (superko). */
export function repeats(
  board: readonly Cell[],
  size: number,
  stone: Stone,
  seen: readonly number[],
) {
  const known = new Set(seen);
  const out: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY) continue;
    const r = play(board, size, i, stone);
    if ('board' in r && known.has(hash(r.board))) out.push(i);
  }
  return out;
}

/**
 * The computer's move: a board index, or -1 to pass. It passes once the other side passed and
 * it is ahead, or when every move left only fills settled ground.
 */
export function botMove(
  board: readonly Cell[],
  size: number,
  stone: Stone,
  seen: readonly number[],
  otherPassed: boolean,
  level: BotLevel,
  rng: Rng,
): number {
  const budget = Math.min(CAP[level], BUDGET[level] * size * size);
  const thought = think(board, size, stone, repeats(board, size, stone, seen), budget, rng);
  const sign = stone === BLACK ? 1 : -1;
  const passEntry = thought.ranked.find((m) => m.move < 0);
  if (otherPassed && passEntry && passEntry.winrate > 0.5 && aheadOnBoard(thought.owner, sign))
    return -1;
  const candidates = thought.ranked.filter((m) => m.move >= 0);
  if (!candidates.length) return -1;
  const settled = (i: number) => Math.abs(thought.owner[i] ?? 0) > 0.92;
  const useful = candidates.filter((m) => !settled(m.move));
  if (!useful.length) return -1;
  if (level === 'easy') {
    const top = useful.slice(0, 5);
    const weights = top.map((m) => (m.visits + 1) ** 1.5);
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    for (const [i, m] of top.entries()) {
      r -= weights[i] as number;
      if (r <= 0) return m.move;
    }
  }
  return (useful[0] as { move: number }).move;
}

/** Whether `sign`'s side leads on the estimated ownership, komi included. */
function aheadOnBoard(owner: Float64Array, sign: number) {
  let total = 0;
  for (const v of owner) total += Math.sign(Math.round(v * 2) / 2);
  return (total - 7.5) * sign > 0;
}

/**
 * The stones the computer counts as dead at the end: each group most random games from here
 * take off the board.
 */
export function deadStones(
  board: readonly Cell[],
  size: number,
  toMove: Stone,
  rng: Rng,
): number[] {
  const playouts = Math.max(40, Math.floor(20_000 / (size * size)));
  const owner = ownership(board, size, toMove, playouts, rng);
  const dead = new Set<number>();
  const seen = new Set<number>();
  for (let i = 0; i < board.length; i++) {
    const c = board[i];
    if (c === EMPTY || seen.has(i)) continue;
    const { stones } = group(board, size, i);
    for (const s of stones) seen.add(s);
    const sign = c === BLACK ? 1 : -1;
    const average = stones.reduce((sum, s) => sum + (owner[s] ?? 0), 0) / stones.length;
    if (average * sign < -0.2) for (const s of stones) dead.add(s);
  }
  return [...dead].sort((a, b) => a - b);
}
