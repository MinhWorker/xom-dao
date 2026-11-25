import { describe, expect, it } from 'vitest';
import { report, simulate } from './simulate.js';

describe('the simulator', () => {
  it('plays computer rounds to their end and sums them up', () => {
    const summary = simulate(3, 3);
    expect(summary).toMatchObject({ seats: 3, games: 3 });
    expect(summary.moves).toBeGreaterThan(0);
    expect(report([summary]).split('\n')).toHaveLength(3);
  });
});
