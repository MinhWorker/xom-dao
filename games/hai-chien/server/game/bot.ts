/**
 * The computer's play. It places a random fleet, then hunts and finishes ships off from what a
 * player may know of the other sea: Dễ fires at random and tries the cells next to a hit;
 * Vừa hunts on a checkerboard and follows hits along the ship; Khó counts every way the ships
 * still afloat can lie and fires where the most of them cross, and also uses the radar.
 */
import type { Rng } from '@xomdao/sdk';
import { index, onSea, pointOf, randomFleet, scanArea } from './fleet.js';
import {
  type BotLevel,
  Clear,
  Hit,
  type Mark,
  type Placement,
  type Point,
  type Scan,
  SIZE,
  Unknown,
} from './model.js';

/** What the shooter knows of the other sea. */
export interface Knowledge {
  marks: readonly Mark[];
  scans: readonly Scan[];
  /** Cells of ships already sunk (their hits are not worth following). */
  sunkCells: ReadonlySet<number>;
  /** Sizes of the ships still afloat. */
  left: readonly number[];
}

export interface BotMove extends Point {
  scan: boolean;
}

export const botFleet = (rng: Rng, _level: BotLevel): Placement[] => randomFleet(rng);

/** Hits on ships not sunk yet. */
const openHits = (k: Knowledge) =>
  k.marks.flatMap((mark, i) => (mark === Hit && !k.sunkCells.has(i) ? [i] : []));

/**
 * How many ways the ships still afloat can cover each cell. With open hits, only the ways that
 * cover at least one count, the more hits the more.
 */
export function density(k: Knowledge): number[] {
  const hits = new Set(openHits(k));
  const out = new Array<number>(SIZE * SIZE).fill(0);
  for (const size of k.left) {
    for (const v of [false, true]) {
      for (let y = 0; y <= (v ? SIZE - size : SIZE - 1); y++) {
        for (let x = 0; x <= (v ? SIZE - 1 : SIZE - size); x++) {
          const cells: number[] = [];
          let covered = 0;
          let fits = true;
          for (let i = 0; i < size && fits; i++) {
            const c = v ? index({ x, y: y + i }) : index({ x: x + i, y });
            const mark = k.marks[c];
            if (mark === Unknown) cells.push(c);
            else if (hits.has(c)) {
              covered++;
              cells.push(c);
            } else fits = false;
          }
          if (!fits || (hits.size > 0 && covered === 0)) continue;
          if (touchesOtherHit(cells, hits)) continue;
          const weight = covered ? 20 ** covered : 1;
          for (const c of cells) if (k.marks[c] === Unknown) out[c] = (out[c] ?? 0) + weight;
        }
      }
    }
  }
  for (const scan of k.scans) {
    const area = scanArea(scan).map(index);
    const unknown = area.filter((c) => k.marks[c] === Unknown);
    const found = area.filter((c) => k.marks[c] === Hit).length;
    const share = unknown.length ? Math.max(0, scan.count - found) / unknown.length : 0;
    for (const c of unknown) out[c] = (out[c] ?? 0) * (0.4 + share * 3);
  }
  return out;
}

/** A ship lying on `cells` would touch an open hit it does not cover: ships never touch. */
function touchesOtherHit(cells: number[], hits: ReadonlySet<number>) {
  const mine = new Set(cells);
  for (const c of cells) {
    const p = pointOf(c);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (onSea(q) && hits.has(index(q)) && !mine.has(index(q))) return true;
      }
    }
  }
  return false;
}

/** One of the cells with the highest score, picked at random among ties. */
function best(scores: readonly number[], rng: Rng, allowed: (c: number) => boolean): number {
  let top = -1;
  let picks: number[] = [];
  for (const [c, score] of scores.entries()) {
    if (!allowed(c)) continue;
    if (score > top) {
      top = score;
      picks = [c];
    } else if (score === top) picks.push(c);
  }
  return picks[Math.floor(rng() * picks.length)] ?? -1;
}

const unknownCells = (k: Knowledge) => k.marks.flatMap((mark, i) => (mark === Unknown ? [i] : []));

/** The cells next to an open hit, along a line of two hits when there is one. */
function followUps(k: Knowledge): number[] {
  const hits = openHits(k);
  const set = new Set(hits);
  const out = new Set<number>();
  const lined = hits.some((c) => {
    const p = pointOf(c);
    return [
      { x: p.x + 1, y: p.y },
      { x: p.x, y: p.y + 1 },
    ].some((q) => onSea(q) && set.has(index(q)));
  });
  for (const c of hits) {
    const p = pointOf(c);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!onSea(q) || k.marks[index(q)] !== Unknown) continue;
      if (lined) {
        const back = { x: p.x - dx, y: p.y - dy };
        if (!(onSea(back) && set.has(index(back)))) continue;
      }
      out.add(index(q));
    }
  }
  return [...out];
}

/** The computer's next move on `k` at `level`, given the radar scans it has left. */
export function botMove(
  k: Knowledge,
  radar: number,
  rng: Rng,
  level: BotLevel,
  shots: number,
): BotMove {
  const hits = openHits(k);
  const free = unknownCells(k);
  const pick = (c: number): BotMove => ({ ...pointOf(c), scan: false });
  if (level === 'easy') {
    const next = followUps(k);
    if (next.length && rng() < 0.75) return pick(next[Math.floor(rng() * next.length)] as number);
    return pick(free[Math.floor(rng() * free.length)] ?? 0);
  }
  const scores = density(k);
  if (level === 'hard' && radar > 0 && hits.length === 0 && shots >= 6) {
    const centre = bestScan(k, scores, rng);
    if (centre) return { ...centre, scan: true };
  }
  if (hits.length) return pick(best(scores, rng, (c) => k.marks[c] === Unknown));
  if (level === 'normal') {
    if (radar > 0 && shots >= 10 && rng() < 0.5) {
      const centre = bestScan(k, scores, rng);
      if (centre) return { ...centre, scan: true };
    }
    const smallest = Math.min(...k.left);
    const even = free.filter((c) => {
      const p = pointOf(c);
      return (p.x + p.y) % Math.max(2, smallest) === 0;
    });
    const pool = even.length ? even : free;
    return pick(pool[Math.floor(rng() * pool.length)] ?? 0);
  }
  const smallest = Math.min(...k.left);
  const parity = (c: number) => {
    const p = pointOf(c);
    return (p.x + p.y) % Math.max(2, smallest) === 0;
  };
  const anyParity = free.some(parity) && free.filter(parity).some((c) => (scores[c] ?? 0) > 0);
  return pick(best(scores, rng, (c) => k.marks[c] === Unknown && (!anyParity || parity(c))));
}

/** The centre of the 3×3 area the most ways cross, away from the edges; `null` if none helps. */
function bestScan(k: Knowledge, scores: readonly number[], rng: Rng): Point | null {
  const sums = new Array<number>(SIZE * SIZE).fill(-1);
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const area = scanArea({ x, y }).map(index);
      if (area.some((c) => k.marks[c] === Clear || k.marks[c] === Hit)) continue;
      sums[index({ x, y })] = area.reduce((sum, c) => sum + (scores[c] ?? 0), 0);
    }
  }
  const c = best(sums, rng, (i) => (sums[i] ?? -1) >= 0);
  return c < 0 ? null : pointOf(c);
}
