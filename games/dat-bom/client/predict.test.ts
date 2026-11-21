import { describe, expect, it } from 'vitest';
import { newArena } from '../server/game/arena.js';
import { COUNTDOWN_TICKS, STEP, type State } from '../server/game/model.js';
import { Predictor } from './predict.js';
import { TICK_MS } from './sync.js';

/** An open arena (no crates) with seat 0 in the middle of cell (1, 0) and seat 1 far away. */
function open(): State {
  const state = newArena(2, () => 1);
  state.rows = state.rows.map((row) => row.replaceAll('c', '.'));
  return state;
}

const FIGHT = COUNTDOWN_TICKS + 10;

/** A predictor that has been given a snapshot at tick FIGHT, arriving at local time 1000. */
function ready() {
  const predictor = new Predictor(0);
  predictor.noteRoundTrip(0);
  for (let i = 0; i < 20; i++) predictor.noteRoundTrip(0);
  predictor.receive(open(), FIGHT, undefined, 1000);
  return predictor;
}

describe('Predictor', () => {
  it('shows the snapshot where it is when nothing is held', () => {
    const predictor = ready();
    expect(predictor.position(1000, 0)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('answers a key press at once, without waiting for the server', () => {
    const predictor = ready();
    predictor.press('right', false, 1000);
    const at = predictor.position(1000 + 4 * TICK_MS, 0.016);
    expect(at?.x).toBeCloseTo(0.5 + 4 * STEP, 3);
    expect(at?.y).toBeCloseTo(0.5);
  });

  it('moves smoothly between ticks, not in steps', () => {
    const predictor = ready();
    predictor.press('right', false, 1000);
    const a = predictor.position(1000 + 2 * TICK_MS, 0.016)?.x ?? 0;
    const b = predictor.position(1000 + 2.5 * TICK_MS, 0.016)?.x ?? 0;
    expect(b - a).toBeCloseTo(0.5 * STEP, 3);
  });

  it('numbers its inputs from 0 and carries on above what the server has applied', () => {
    const predictor = ready();
    expect(predictor.press('left', false, 1000).seq).toBe(0);
    expect(predictor.press('none', true, 1010).seq).toBe(1);
    predictor.receive(open(), FIGHT + 2, 40, 1100);
    expect(predictor.press('up', false, 1200).seq).toBe(41);
  });

  it('does not move before the fight starts', () => {
    const predictor = new Predictor(0);
    predictor.noteRoundTrip(0);
    predictor.receive(open(), 5, undefined, 1000);
    predictor.press('right', false, 1000);
    expect(predictor.position(1000 + 5 * TICK_MS, 0.016)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('stops at a wall like the server does', () => {
    const predictor = ready();
    predictor.press('left', false, 1000);
    expect(predictor.position(1000 + 10 * TICK_MS, 0.016)?.x).toBeCloseTo(0.5);
  });

  it('hides a correction by fading it out instead of jumping', () => {
    const predictor = ready();
    predictor.press('right', false, 1000);
    const before = predictor.position(1000 + 6 * TICK_MS, 0.016);
    // The server says the player is a little further on than predicted.
    const ahead = open();
    const me = ahead.players[0];
    if (me) Object.assign(me, { x: 1.2, move: 'right' });
    predictor.receive(ahead, FIGHT + 6, 0, 1000 + 6 * TICK_MS);
    const after = predictor.position(1000 + 6 * TICK_MS, 0);
    expect(after?.x).toBeCloseTo(before?.x ?? 0, 3);
    const later = predictor.position(1000 + 6 * TICK_MS + 600, 0.6);
    expect(later?.x).toBeGreaterThan(after?.x ?? 0);
  });

  it('shows a ghost bomb until the server has one there', () => {
    const predictor = ready();
    predictor.press('none', true, 1000);
    expect(predictor.ghosts(1100, [])).toEqual([
      { cell: { x: 0, y: 0 }, fuse: expect.any(Number) },
    ]);
    expect(predictor.ghosts(1100, [{ x: 0, y: 0 }])).toEqual([]);
  });

  it('gives up a ghost when the server took the press in and placed nothing', () => {
    const predictor = ready();
    predictor.press('none', true, 1000);
    predictor.receive(open(), FIGHT + 4, 0, 1200);
    expect(predictor.ghosts(1210, [])).toEqual([]);
  });

  it('places no second ghost where one already is', () => {
    const predictor = ready();
    predictor.press('none', true, 1000);
    predictor.press('none', true, 1010);
    expect(predictor.ghosts(1020, [])).toHaveLength(1);
  });
});
