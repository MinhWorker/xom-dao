/** Pure helpers on seas and fleets: cells of a ship, layout checks, shots and what they reveal. */
import type { Rng } from '@xomdao/sdk';
import {
  Clear,
  FLEET,
  Hit,
  type Mark,
  Miss,
  type Placement,
  type Point,
  RADAR_SPAN,
  type Sea,
  SIZE,
  Unknown,
} from './model.js';

export const index = (p: Point) => p.y * SIZE + p.x;
export const pointOf = (i: number): Point => ({ x: i % SIZE, y: Math.floor(i / SIZE) });
export const onSea = (p: Point) => p.x >= 0 && p.y >= 0 && p.x < SIZE && p.y < SIZE;
/** A cell's name as players say it: A1 is the top-left cell. */
export const cellName = (p: Point) => `${String.fromCharCode(65 + p.x)}${p.y + 1}`;

/** The cells ship `id` covers when it lies at `at`. */
export function cellsOf(id: number, at: Placement): Point[] {
  const size = FLEET[id]?.size ?? 0;
  return Array.from({ length: size }, (_, i) =>
    at.v ? { x: at.x, y: at.y + i } : { x: at.x + i, y: at.y },
  );
}

/** The cells around a set of cells (touching by side or corner), on the sea. */
export function around(cells: Point[]): Point[] {
  const inside = new Set(cells.map(index));
  const out = new Map<number, Point>();
  for (const c of cells) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const p = { x: c.x + dx, y: c.y + dy };
        if (onSea(p) && !inside.has(index(p))) out.set(index(p), p);
      }
    }
  }
  return [...out.values()];
}

/**
 * Why a fleet layout is not allowed, or `null`: every ship on the sea, none overlapping or
 * touching another, even by a corner.
 */
export function layoutProblem(ships: readonly Placement[]): string | null {
  if (ships.length !== FLEET.length) return 'Hạm đội chưa đủ tàu';
  return partialProblem(ships);
}

/** `layoutProblem` for the first ships of the fleet only. */
export function partialProblem(ships: readonly Placement[]): string | null {
  const taken = new Map<number, number>();
  for (const [id, at] of ships.entries()) {
    const cells = cellsOf(id, at);
    if (!cells.every(onSea)) return 'Có tàu nằm ngoài biển';
    for (const c of cells) {
      if (taken.has(index(c))) return 'Hai tàu không được chồng lên nhau';
      taken.set(index(c), id);
    }
  }
  for (const [id, at] of ships.entries()) {
    for (const c of around(cellsOf(id, at))) {
      const other = taken.get(index(c));
      if (other !== undefined && other !== id) return 'Hai tàu không được nằm sát nhau';
    }
  }
  return null;
}

/** A random allowed layout of the whole fleet. */
export function randomFleet(rng: Rng): Placement[] {
  for (;;) {
    const ships: Placement[] = [];
    for (let id = 0; id < FLEET.length; id++) {
      const size = FLEET[id]?.size ?? 1;
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const v = rng() < 0.5;
        const at = {
          v,
          x: Math.floor(rng() * (v ? SIZE : SIZE - size + 1)),
          y: Math.floor(rng() * (v ? SIZE - size + 1 : SIZE)),
        };
        if (!partialProblem([...ships, at])) {
          ships.push(at);
          placed = true;
        }
      }
      if (!placed) break;
    }
    if (ships.length === FLEET.length) return ships;
  }
}

/** Which ship covers a cell, or -1. */
export function shipAt(ships: readonly Placement[], p: Point): number {
  for (const [id, at] of ships.entries()) {
    if (cellsOf(id, at).some((c) => c.x === p.x && c.y === p.y)) return id;
  }
  return -1;
}

/** Whether every cell of ship `id` has been hit. */
export function isSunk(sea: Pick<Sea, 'ships' | 'marks'>, id: number): boolean {
  const at = sea.ships[id];
  return !!at && cellsOf(id, at).every((c) => sea.marks[index(c)] === Hit);
}

/** Every ship of the sea is sunk. */
export const allSunk = (sea: Pick<Sea, 'ships' | 'marks'>) =>
  sea.ships.length === FLEET.length && FLEET.every((_, id) => isSunk(sea, id));

/** The cells a radar scan centred on `p` covers (fewer on an edge). */
export function scanArea(p: Point): Point[] {
  const r = Math.floor(RADAR_SPAN / 2);
  const cells: Point[] = [];
  for (let y = p.y - r; y <= p.y + r; y++) {
    for (let x = p.x - r; x <= p.x + r; x++) if (onSea({ x, y })) cells.push({ x, y });
  }
  return cells;
}

/** The marks with the cells around ship `id` cleared (it is sunk, and ships never touch). */
export function clearAround(marks: readonly Mark[], ships: readonly Placement[], id: number) {
  const next = [...marks];
  const at = ships[id];
  if (!at) return next;
  for (const c of around(cellsOf(id, at))) if (next[index(c)] === Unknown) next[index(c)] = Clear;
  return next;
}

/** The result of a shot at `p` on a sea: the new marks and what it hit. */
export function shoot(sea: Sea, p: Point) {
  const id = shipAt(sea.ships, p);
  let marks = [...sea.marks];
  marks[index(p)] = id < 0 ? Miss : Hit;
  const sunk = id >= 0 && isSunk({ ships: sea.ships, marks }, id);
  if (sunk) marks = clearAround(marks, sea.ships, id);
  return {
    marks,
    ship: id,
    result: id < 0 ? ('miss' as const) : sunk ? ('sunk' as const) : ('hit' as const),
  };
}

/** A new, empty sea. */
export const emptySea = (radar: number): Sea => ({
  ships: [],
  ready: false,
  marks: Array.from({ length: SIZE * SIZE }, () => Unknown as Mark),
  scans: [],
  radar,
});
