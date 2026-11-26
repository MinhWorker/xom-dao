/** A staged Match for `?demo` (and the splash art): a battle well under way, nothing live. */
import {
  cellsOf,
  clearAround,
  emptySea,
  index,
  isSunk,
  randomFleet,
} from '../server/game/fleet.js';
import { FLEET, Hit, type Mark, Miss, type Sea, type View } from '../server/game/model.js';

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** A sea with `hits` of its ships' cells hit, ship `sunk` sunk, and `misses` misses. */
function sea(seed: number, sunk: number[], hits: number, misses: number): Sea {
  const rng = lcg(seed);
  const s: Sea = { ...emptySea(1), ships: randomFleet(rng), ready: true };
  let marks: Mark[] = [...s.marks];
  for (const id of sunk) {
    for (const c of cellsOf(id, s.ships[id] as never)) marks[index(c)] = Hit;
    marks = clearAround(marks, s.ships, id);
  }
  const shipCells = s.ships.flatMap((at, id) => (sunk.includes(id) ? [] : cellsOf(id, at)));
  for (let i = 0; i < hits; i++) {
    const c = shipCells[Math.floor(rng() * shipCells.length)];
    if (c) marks[index(c)] = Hit;
  }
  for (let i = 0; i < misses; i++) {
    const c = Math.floor(rng() * 100);
    if (marks[c] === 0 && !shipCells.some((p) => index(p) === c)) marks[c] = Miss;
  }
  return { ...s, marks };
}

export function demoView(): View {
  const home = sea(7, [4], 2, 14);
  const enemy = sea(11, [1, 4], 2, 16);
  enemy.scans = [{ x: 6, y: 7, count: 2 }];
  const view = (s: Sea, mine: boolean) => ({
    ...s,
    ships: s.ships.map((at, id) => (mine || isSunk(s, id) ? at : null)),
    sunk: FLEET.map((_, id) => isSunk(s, id)),
  });
  return {
    phase: 'battle',
    players: ['me', 'them'],
    seas: { me: view(home, true), them: view(enemy, false) },
    turn: 'me',
    shots: 30,
    last: null,
    winner: null,
    wins: { me: 2, them: 1 },
  };
}
