import { describe, expect, it } from 'vitest';
import { directionOf, HeldDirections } from './controls.js';

describe('directionOf', () => {
  it('picks the stronger axis', () => {
    expect(directionOf(0.9, 0.2)).toBe('right');
    expect(directionOf(-0.9, 0.2)).toBe('left');
    expect(directionOf(0.2, 0.9)).toBe('down');
    expect(directionOf(0.2, -0.9)).toBe('up');
  });

  it('holds nothing near the centre', () => {
    expect(directionOf(0.05, -0.1)).toBe('none');
  });
});

describe('HeldDirections', () => {
  it('goes with the last key pressed and falls back when it is let go', () => {
    const held = new HeldDirections();
    expect(held.current).toBe('none');
    held.press('left');
    held.press('up');
    expect(held.current).toBe('up');
    held.release('up');
    expect(held.current).toBe('left');
    held.release('left');
    expect(held.current).toBe('none');
  });

  it('counts a key pressed again as the newest', () => {
    const held = new HeldDirections();
    held.press('left');
    held.press('up');
    held.press('left');
    expect(held.current).toBe('left');
    held.clear();
    expect(held.current).toBe('none');
  });
});
