/** What to play between two views of a Match: the shots and scans to animate, one by one. */
import type { PlayerId } from '@xomdao/sdk';
import type { View } from '../server/game/model.js';

export type Beat =
  | { kind: 'battle'; first: PlayerId }
  | {
      kind: 'shot';
      by: PlayerId;
      /** Whose sea was hit. */
      target: PlayerId;
      x: number;
      y: number;
      result: 'miss' | 'hit' | 'sunk';
      ship?: number;
    }
  | { kind: 'scan'; by: PlayerId; target: PlayerId; x: number; y: number; count: number }
  | { kind: 'over'; winner: PlayerId | null };

const other = (view: View, id: PlayerId) => (view.players[0] === id ? view.players[1] : view.players[0]);
const scans = (view: View) =>
  view.players.reduce((sum, id) => sum + (view.seas[id]?.scans.length ?? 0), 0);

/** The beats from `before` to `after`, in order; none when nothing worth a pause happened. */
export function beats(before: View | null, after: View): Beat[] {
  if (!before) return [];
  const out: Beat[] = [];
  if (before.phase === 'setup' && after.phase === 'battle') out.push({ kind: 'battle', first: after.turn });
  const last = after.last;
  if (last?.kind === 'shot' && after.shots > before.shots) {
    out.push({
      kind: 'shot',
      by: last.by,
      target: other(after, last.by),
      x: last.x,
      y: last.y,
      result: last.result,
      ...(last.ship !== undefined && { ship: last.ship }),
    });
  }
  if (last?.kind === 'scan' && scans(after) > scans(before)) {
    out.push({ kind: 'scan', by: last.by, target: other(after, last.by), x: last.x, y: last.y, count: last.count });
  }
  if (before.phase !== 'over' && after.phase === 'over') out.push({ kind: 'over', winner: after.winner });
  return out;
}
