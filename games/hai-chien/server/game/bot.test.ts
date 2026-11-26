import { seededRng } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import { botMove, type Knowledge } from './bot.js';
import {
  cellsOf,
  clearAround,
  emptySea,
  index,
  isSunk,
  randomFleet,
  scanArea,
  shoot,
} from './fleet.js';
import { type BotLevel, Clear, FLEET, type Sea, Unknown } from './model.js';

/** Shots the computer at `level` takes to sink a random fleet (one radar scan allowed). */
function shotsToWin(level: BotLevel, seed: number) {
  const rng = seededRng(seed);
  let sea: Sea = { ...emptySea(1), ships: randomFleet(rng) };
  let radar = 1;
  for (let shots = 1; shots <= 120; shots++) {
    const sunkCells = new Set<number>();
    const left: number[] = FLEET.map((s) => s.size);
    for (const [id, at] of sea.ships.entries()) {
      if (!isSunk(sea, id)) continue;
      left.splice(left.indexOf(FLEET[id]?.size ?? 0), 1);
      for (const c of cellsOf(id, at)) sunkCells.add(index(c));
    }
    if (!left.length) return shots - 1;
    const k: Knowledge = { marks: sea.marks, scans: sea.scans, sunkCells, left };
    const move = botMove(k, radar, rng, level, shots);
    if (move.scan) {
      radar--;
      const area = scanArea(move);
      const count = area.filter((c) =>
        sea.ships.some((at, id) => cellsOf(id, at).some((p) => p.x === c.x && p.y === c.y)),
      ).length;
      const marks = [...sea.marks];
      if (!count) for (const c of area) if (marks[index(c)] === Unknown) marks[index(c)] = Clear;
      sea = { ...sea, marks, scans: [...sea.scans, { ...move, count }] };
      continue;
    }
    expect(sea.marks[index(move)]).toBe(Unknown);
    sea = { ...sea, marks: shoot(sea, move).marks };
  }
  return 120;
}

const average = (level: BotLevel) => {
  let sum = 0;
  for (let seed = 1; seed <= 40; seed++) sum += shotsToWin(level, seed);
  return sum / 40;
};

describe('hai-chien bot', () => {
  it('never fires at a known cell and gets better with its level', () => {
    const easy = average('easy');
    const normal = average('normal');
    const hard = average('hard');
    expect(normal).toBeLessThan(easy);
    expect(hard).toBeLessThan(normal);
    expect(hard).toBeLessThan(42);
  });

  it('clearAround leaves hits and misses as they are', () => {
    const sea = { ...emptySea(0), ships: randomFleet(seededRng(2)) };
    expect(clearAround(sea.marks, sea.ships, 0).filter((m) => m === Clear).length).toBeGreaterThan(
      0,
    );
  });
});
