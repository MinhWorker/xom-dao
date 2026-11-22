import { describe, expect, it } from 'vitest';
import { listPlacement } from './select.js';

const gap = 4;
const margin = 8;

describe('listPlacement', () => {
  it('opens below when the list fits there', () => {
    const p = listPlacement({ top: 100, bottom: 148 }, 700, 240, gap, margin);
    expect(p.above).toBe(false);
    expect(p.space).toBe(700 - 148 - gap - margin);
  });

  it('opens above when it does not fit below but does above', () => {
    const p = listPlacement({ top: 300, bottom: 348 }, 390, 240, gap, margin);
    expect(p.above).toBe(true);
    expect(p.space).toBe(300 - gap - margin);
  });

  it('takes the roomier side and limits the height when it fits on neither', () => {
    const below = listPlacement({ top: 60, bottom: 108 }, 390, 500, gap, margin);
    expect(below.above).toBe(false);
    expect(below.space).toBe(390 - 108 - gap - margin);
    const above = listPlacement({ top: 250, bottom: 298 }, 390, 500, gap, margin);
    expect(above.above).toBe(true);
    expect(above.space).toBe(250 - gap - margin);
  });
});
