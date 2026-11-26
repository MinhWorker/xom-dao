/**
 * The computer's play: material and piece-square tables (with the king's table moving to the
 * centre as pieces come off), then an alpha-beta search deepened step by step until it has
 * spent its node budget. Work is counted in nodes, not time, so it is repeatable.
 */
import type { Rng } from '@xomdao/sdk';
import {
  BISHOP,
  BLACK_BIT,
  fromOf,
  KING,
  KNIGHT,
  PAWN,
  type Position,
  promoOf,
  QUEEN,
  ROOK,
  toOf,
} from './chess.js';

const VALUE = [0, 100, 320, 330, 500, 900, 0];

/* biome-ignore format: tables read as boards */
const PST: number[][] = [
  [],
  [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
];

/* biome-ignore format: a table reads as a board */
const KING_END = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

const MATE = 100_000;
const INF = 1_000_000;

/** The position's worth for the side to move, in centipawns. */
export function evaluate(pos: Position): number {
  const b = pos.board;
  let mid = 0;
  let end = 0;
  let phase = 0;
  for (let s = 0; s < 120; s++) {
    if (s & 0x88) {
      s += 7;
      continue;
    }
    const piece = b[s] as number;
    if (!piece) continue;
    const type = piece & 7;
    const black = piece & BLACK_BIT;
    const i = black ? (7 - (s >> 4)) * 8 + (s & 15) : (s >> 4) * 8 + (s & 15);
    const sign = black ? -1 : 1;
    if (type === KING) {
      mid += sign * ((PST[KING] as number[])[i] as number);
      end += sign * (KING_END[i] as number);
      continue;
    }
    const v = (VALUE[type] as number) + ((PST[type] as number[])[i] as number);
    mid += sign * v;
    end += sign * v;
    if (type === KNIGHT || type === BISHOP) phase += 1;
    else if (type === ROOK) phase += 2;
    else if (type === QUEEN) phase += 4;
  }
  const t = Math.min(phase, 24) / 24;
  const score = Math.round(mid * t + end * (1 - t));
  return pos.side ? -score : score;
}

/** Most valuable victim first, least valuable attacker first. */
function captureOrder(pos: Position, m: number) {
  const victim = (pos.board[toOf(m)] as number) & 7;
  const attacker = (pos.board[fromOf(m)] as number) & 7;
  return (
    (victim ? (VALUE[victim] as number) * 10 - (VALUE[attacker] as number) / 10 : 0) +
    (promoOf(m) ? 8000 : 0)
  );
}

export interface SearchResult {
  move: number;
  score: number;
  depth: number;
  nodes: number;
  /** Root moves with their scores from the last full depth (best first). */
  scored: { move: number; score: number }[];
}

/**
 * Searches `pos` (changed during the search, restored at the end) until `budget` nodes.
 * `history` holds the repetition keys of positions already played: going back to one scores a
 * draw.
 */
export function search(
  pos: Position,
  budget: number,
  history: readonly number[],
  maxDepth = 64,
  margin = 0,
): SearchResult {
  let nodes = 0;
  let stopped = false;
  const seen = new Map<number, number>();
  for (const k of history) seen.set(k, (seen.get(k) ?? 0) + 1);
  const path: number[] = [];
  const killers: number[][] = Array.from({ length: 128 }, () => [0, 0]);
  const historyScore = new Int32Array(128 * 128);
  const tt = new Map<number, { depth: number; score: number; flag: number; move: number }>();

  const order = (moves: number[], ply: number, best: number) => {
    const k = killers[ply] as number[];
    const score = (m: number) => {
      if (m === best) return 1e9;
      const c = captureOrder(pos, m);
      if (c) return 1e7 + c;
      if (m === k[0]) return 9e6;
      if (m === k[1]) return 8e6;
      return historyScore[fromOf(m) * 128 + toOf(m)] as number;
    };
    const keyed = moves.map((m) => [score(m), m] as const);
    keyed.sort((a, b) => b[0] - a[0]);
    return keyed.map((x) => x[1]);
  };

  const quiesce = (alpha: number, beta: number, ply: number): number => {
    nodes++;
    if ((nodes & 1023) === 0 && nodes > budget) stopped = true;
    const stand = evaluate(pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 40) return stand;
    const moves = pos.pseudo([], true);
    moves.sort((a, b) => captureOrder(pos, b) - captureOrder(pos, a));
    for (const m of moves) {
      if (!pos.make(m)) continue;
      const score = -quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (stopped) return alpha;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  const negamax = (
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
    nullOk: boolean,
  ): number => {
    if (ply > 0) {
      const key = pos.key();
      if (pos.half >= 100 || (seen.get(key) ?? 0) >= 1 || path.includes(key)) return 0;
    }
    const check = pos.inCheck();
    if (check) depth++;
    if (depth <= 0) return quiesce(alpha, beta, ply);
    nodes++;
    if ((nodes & 1023) === 0 && nodes > budget) stopped = true;
    const hash = pos.key();
    const entry = tt.get(hash);
    let best = entry?.move ?? 0;
    if (entry && entry.depth >= depth && ply > 0) {
      if (entry.flag === 0) return entry.score;
      if (entry.flag === 1 && entry.score >= beta) return entry.score;
      if (entry.flag === 2 && entry.score <= alpha) return entry.score;
    }
    if (nullOk && !check && depth >= 3 && ply > 0 && evaluate(pos) >= beta && hasPieces(pos)) {
      pos.makeNull();
      const score = -negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (stopped) return 0;
      if (score >= beta) return beta;
    }
    const moves = order(pos.pseudo([]), ply, best);
    let legal = 0;
    let top = -INF;
    const start = alpha;
    path.push(hash);
    for (const m of moves) {
      const quiet = !captureOrder(pos, m);
      if (!pos.make(m)) continue;
      legal++;
      let score: number;
      if (legal > 4 && depth >= 3 && quiet && !check) {
        score = -negamax(depth - 2, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha) score = -negamax(depth - 1, -beta, -alpha, ply + 1, true);
      } else score = -negamax(depth - 1, -beta, -alpha, ply + 1, true);
      pos.unmake();
      if (stopped) break;
      if (score > top) {
        top = score;
        best = m;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!captureOrder(pos, m)) {
          const k = killers[ply] as number[];
          if (k[0] !== m) {
            k[1] = k[0] as number;
            k[0] = m;
          }
          historyScore[fromOf(m) * 128 + toOf(m)] =
            (historyScore[fromOf(m) * 128 + toOf(m)] as number) + depth * depth;
        }
        break;
      }
    }
    path.pop();
    if (stopped) return 0;
    if (!legal) return check ? -MATE + ply : 0;
    tt.set(hash, { depth, score: top, flag: top <= start ? 2 : top >= beta ? 1 : 0, move: best });
    return top;
  };

  const rootMoves = pos.legal();
  let result: SearchResult = { move: rootMoves[0] ?? 0, score: 0, depth: 0, nodes: 0, scored: [] };
  if (rootMoves.length <= 1)
    return { ...result, scored: rootMoves.map((move) => ({ move, score: 0 })) };
  for (let depth = 1; depth <= maxDepth; depth++) {
    const scored: { move: number; score: number }[] = [];
    let alpha = -INF;
    const ordered = order(rootMoves, 0, result.move);
    path.push(pos.key());
    for (const m of ordered) {
      pos.make(m);
      const score = -negamax(depth - 1, -INF, -(alpha - margin), 1, true);
      pos.unmake();
      if (stopped) break;
      scored.push({ move: m, score });
      if (score > alpha) alpha = score;
    }
    path.pop();
    if (stopped && scored.length === 0) break;
    scored.sort((a, b) => b.score - a.score);
    if (!stopped || (scored[0] && scored[0].score > result.score)) {
      const best = scored[0] as { move: number; score: number };
      result = {
        move: best.move,
        score: best.score,
        depth,
        nodes,
        scored: stopped ? result.scored : scored,
      };
    }
    if (stopped || Math.abs(alpha) > MATE - 200) break;
  }
  return { ...result, nodes };
}

function hasPieces(pos: Position) {
  const mine = pos.side ? BLACK_BIT : 0;
  for (let s = 0; s < 120; s++) {
    if (s & 0x88) continue;
    const p = pos.board[s] as number;
    if (p && (p & BLACK_BIT) === mine && (p & 7) !== PAWN && (p & 7) !== KING) return true;
  }
  return false;
}

export type Level = 'easy' | 'normal' | 'hard';

const BUDGET: Record<Level, number> = { easy: 1_500, normal: 9_000, hard: 30_000 };

/** The computer's move at `level`. Dễ often settles for a worse move; Vừa varies its opening. */
export function chooseMove(
  pos: Position,
  level: Level,
  history: readonly number[],
  rng: Rng,
): number {
  const margin =
    level === 'easy'
      ? 120
      : level === 'normal' && pos.full <= 6
        ? 25
        : level === 'hard' && pos.full <= 4
          ? 10
          : 0;
  const result = search(pos, BUDGET[level], history, level === 'easy' ? 2 : 64, margin);
  const scored = result.scored.length ? result.scored : [{ move: result.move, score: 0 }];
  const best = scored[0] as { move: number; score: number };
  if (level === 'easy' && rng() < 0.18)
    return (scored[Math.floor(rng() * scored.length)] as { move: number }).move;
  if (!margin) return best.move;
  const fair = scored.filter((s) => s.score > best.score - margin);
  return (
    (fair.length ? fair : scored)[Math.floor(rng() * Math.max(1, fair.length))] as { move: number }
  ).move;
}

/** The computer's view of the position for the side to move, in centipawns (to answer a draw
 * offer). */
export function judge(pos: Position, history: readonly number[]) {
  return search(pos, 4_000, history).score;
}
