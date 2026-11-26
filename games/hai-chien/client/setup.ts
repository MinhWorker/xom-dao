/** The player's own fleet while it is being placed: moving and turning ships within the rules. */
import { cellsOf, index, layoutProblem, onSea } from '../server/game/fleet.js';
import { FLEET, type Placement, SIZE } from '../server/game/model.js';

/** The fleet with ship `id` at `at`. */
export const withShip = (ships: readonly Placement[], id: number, at: Placement) =>
  ships.map((s, i) => (i === id ? at : s));

/** Whether ship `id` may lie at `at` among the others. */
export const fits = (ships: readonly Placement[], id: number, at: Placement) =>
  layoutProblem(withShip(ships, id, at)) === null;

/** Ship `id` placed so its `grab`-th cell lies on `cell`, kept on the sea. */
export function dragTo(id: number, at: Placement, grab: number, cell: { x: number; y: number }): Placement {
  const size = FLEET[id]?.size ?? 1;
  const x = at.v ? cell.x : cell.x - grab;
  const y = at.v ? cell.y - grab : cell.y;
  return {
    v: at.v,
    x: Math.max(0, Math.min(at.v ? SIZE - 1 : SIZE - size, x)),
    y: Math.max(0, Math.min(at.v ? SIZE - size : SIZE - 1, y)),
  };
}

/**
 * Ship `id` turned about its `grab`-th cell, nudged back onto the sea; then, if that touches
 * another ship, the nearest place along the turned line that fits. `null` when none does.
 */
export function turn(ships: readonly Placement[], id: number, grab: number): Placement | null {
  const at = ships[id];
  if (!at) return null;
  const size = FLEET[id]?.size ?? 1;
  const pivot = at.v ? { x: at.x, y: at.y + grab } : { x: at.x + grab, y: at.y };
  const v = !at.v;
  const tries: Placement[] = [];
  for (let shift = 0; shift < size; shift++) {
    for (const s of shift ? [shift, -shift] : [0]) {
      const start = grab + s;
      tries.push(v ? { v, x: pivot.x, y: pivot.y - start } : { v, x: pivot.x - start, y: pivot.y });
    }
  }
  for (const p of tries) {
    if (!cellsOf(id, p).every(onSea)) continue;
    if (fits(ships, id, p)) return p;
  }
  return null;
}

/** The cell indexes ship `id` takes at `at` (off-sea cells as -1). */
export const cellIndexes = (id: number, at: Placement) =>
  cellsOf(id, at).map((c) => (onSea(c) ? index(c) : -1));
