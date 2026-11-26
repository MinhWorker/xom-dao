/**
 * The computer's play: material and point tables, then an alpha-beta search deepened step by step
 * until it has spent its node budget. Work is counted in nodes, not time, so it is repeatable.
 */
import type { Rng } from '@xomdao/sdk';
import {
  ADVISOR,
  BLACK_BIT,
  CANNON,
  ELEPHANT,
  fromOf,
  HORSE,
  KING,
  PAWN,
  type Position,
  ROOK,
  toOf,
} from './xiangqi.js';

const VALUE = [0, 0, 120, 120, 270, 600, 285, 30];

/** Each piece's worth on each point for Red (row 0 is Black's back row); Black's is mirrored. */
const TABLE: number[][] = Array.from({ length: 8 }, (_, type) =>
  Array.from({ length: 90 }, (_, s) => {
    const r = Math.floor(s / 9);
    const c = s % 9;
    const centre = Math.abs(c - 4);
    switch (type) {
      case PAWN:
        if (r >= 5) return 30;
        if (r === 0) return 50;
        return 70 + (r <= 3 && c >= 2 && c <= 6 ? 30 - centre * 4 : 0) + (r <= 2 ? 10 : 0);
      case HORSE:
        return (
          270 - centre * 6 - (c === 0 || c === 8 ? 15 : 0) + (r <= 4 ? 15 : 0) - (r === 9 ? 15 : 0)
        );
      case CANNON:
        return 285 + (c === 4 ? 15 : 0) + (r === 7 || r === 2 ? 5 : 0);
      case ROOK:
        return 600 + (r <= 4 ? 15 : 0) + (r === 9 ? -10 : 0) + (centre <= 1 ? 5 : 0);
      case KING:
        return -(9 - r) * 12 - centre * 4;
      case ADVISOR:
      case ELEPHANT:
        return 120 + (c === 4 ? 5 : 0);
      default:
        return 0;
    }
  }),
);

const MATE = 100_000;
const INF = 1_000_000;

/** The position's worth for the side to move. */
export function evaluate(pos: Position): number {
  const b = pos.board;
  let score = 0;
  let attackers = 0;
  for (let s = 0; s < 90; s++) {
    const piece = b[s] as number;
    if (!piece) continue;
    const type = piece & 7;
    if (type === ROOK) attackers += 2;
    else if (type === HORSE || type === CANNON) attackers += 1;
    if (piece & BLACK_BIT) score -= (TABLE[type] as number[])[89 - s] as number;
    else score += (TABLE[type] as number[])[s] as number;
  }
  if (attackers <= 6) {
    for (let s = 0; s < 90; s++) {
      const piece = b[s] as number;
      const type = piece & 7;
      if (type !== CANNON && type !== HORSE) continue;
      const shift = type === CANNON ? -25 : 20;
      score += piece & BLACK_BIT ? -shift : shift;
    }
  }
  return pos.side ? -score : score;
}

/** Most valuable victim first, least valuable attacker first. */
function captureOrder(pos: Position, m: number) {
  const victim = (pos.board[toOf(m)] as number) & 7;
  if (!victim) return 0;
  const attacker = (pos.board[fromOf(m)] as number) & 7;
  return (
    (victim === KING ? 5000 : (VALUE[victim] as number)) * 10 - (VALUE[attacker] as number) / 10 + 1
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
 * `history` holds the keys of positions already played: going back to one scores a draw.
 * Root moves within `margin` of the best get exact scores, so a level can pick among them.
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
  const seen = new Set(history);
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
    const hash = pos.key();
    if (ply > 0 && (seen.has(hash) || path.includes(hash))) return 0;
    const check = pos.inCheck();
    if (check) depth++;
    if (depth <= 0) return quiesce(alpha, beta, ply);
    nodes++;
    if ((nodes & 1023) === 0 && nodes > budget) stopped = true;
    const entry = tt.get(hash);
    let best = entry?.move ?? 0;
    if (entry && entry.depth >= depth && ply > 0) {
      if (entry.flag === 0) return entry.score;
      if (entry.flag === 1 && entry.score >= beta) return entry.score;
      if (entry.flag === 2 && entry.score <= alpha) return entry.score;
    }
    if (nullOk && !check && depth >= 3 && ply > 0 && evaluate(pos) >= beta && hasAttackers(pos)) {
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
        if (quiet) {
          const k = killers[ply] as number[];
          if (k[0] !== m) {
            k[1] = k[0] as number;
            k[0] = m;
          }
          const i = fromOf(m) * 128 + toOf(m);
          historyScore[i] = (historyScore[i] as number) + depth * depth;
        }
        break;
      }
    }
    path.pop();
    if (stopped) return 0;
    if (!legal) return -MATE + ply;
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

function hasAttackers(pos: Position) {
  const mine = pos.side ? BLACK_BIT : 0;
  for (let s = 0; s < 90; s++) {
    const p = pos.board[s] as number;
    const t = p & 7;
    if (p && (p & BLACK_BIT) === mine && (t === ROOK || t === HORSE || t === CANNON)) return true;
  }
  return false;
}

export type Level = 'easy' | 'normal' | 'hard';

const BUDGET: Record<Level, number> = { easy: 1_500, normal: 8_000, hard: 25_000 };

/** The computer's move at `level`. Dễ often settles for a worse move; Vừa varies its opening. */
export function chooseMove(
  pos: Position,
  level: Level,
  history: readonly number[],
  rng: Rng,
  ply: number,
): number {
  const margin =
    level === 'easy'
      ? 120
      : level === 'normal' && ply < 12
        ? 25
        : level === 'hard' && ply < 8
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

/** The computer's view of the position for the side to move (to answer a draw offer). */
export function judge(pos: Position, history: readonly number[]) {
  return search(pos, 4_000, history).score;
}
