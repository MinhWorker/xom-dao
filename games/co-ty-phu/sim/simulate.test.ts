import { describe, expect, it } from 'vitest';
import { TUNING } from '../server/game/tuning.js';
import { report, simulate } from './simulate.js';

describe('the simulator', () => {
  it('plays computer Matches to their end and sums them up', () => {
    const summary = simulate(TUNING, 3, 4);
    expect(summary).toMatchObject({ seats: 3, games: 4, unfinished: 0 });
    expect(summary.turns).toBeGreaterThan(0);
    expect(report([summary]).split('\n')).toHaveLength(3);
  });
});
