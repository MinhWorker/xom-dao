/** Ranking a round and the Match. */
import type { State } from './model.js';

/**
 * A round's points: the best of `order` gets one less than the number of players, the last gets
 * 0 (4 players: 3, 2, 1, 0).
 */
export function roundPoints(order: number[], seats: number): number[] {
  const points = Array<number>(seats).fill(0);
  order.forEach((seat, place) => {
    points[seat] = order.length - 1 - place;
  });
  return points;
}

/** The Match's ranking, best first: by points, then rounds won, then seat. */
export function standings({ points, firsts }: Pick<State, 'points' | 'firsts'>) {
  return points
    .map((_, seat) => seat)
    .sort(
      (a, b) => (points[b] ?? 0) - (points[a] ?? 0) || (firsts[b] ?? 0) - (firsts[a] ?? 0) || a - b,
    );
}
