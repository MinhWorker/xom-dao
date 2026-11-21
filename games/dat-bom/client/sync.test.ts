import { describe, expect, it } from 'vitest';
import { newArena } from '../server/game/arena.js';
import { FUSE_TICKS, type State } from '../server/game/model.js';
import { INTERP_DELAY_MS, picture, TICK_MS, Timeline } from './sync.js';

/** A blank arena with the players at `xs` (their x in cells) on row 0. */
function at(...xs: number[]): State {
  const state = newArena(xs.length, () => 1);
  xs.forEach((x, i) => {
    const p = state.players[i];
    if (p) Object.assign(p, { x, y: 0.5 });
  });
  return state;
}

/** A timeline that got a snapshot every 2 ticks, each exactly when the server made it. */
function steady(states: State[]) {
  const timeline = new Timeline();
  states.forEach((state, i) => {
    timeline.push(i * 2, state, i * 2 * TICK_MS);
  });
  return timeline;
}

describe('Timeline', () => {
  it('draws other players between two snapshots, a little behind the server', () => {
    const timeline = steady([at(1.5), at(2.5), at(3.5)]);
    // Server tick 4 is reached at 200 ms; the picture is INTERP_DELAY_MS behind that.
    const frame = timeline.frame(200 + INTERP_DELAY_MS - TICK_MS);
    expect(frame?.tick).toBeCloseTo(3);
    expect(frame?.alpha).toBeCloseTo(0.5);
    const shown = picture(frame as NonNullable<typeof frame>);
    expect(shown.players[0]?.x).toBeCloseTo(3);
  });

  it('holds the newest snapshot when the next one is late', () => {
    const timeline = steady([at(1.5), at(2.5)]);
    const frame = timeline.frame(2000);
    expect(frame?.alpha).toBe(0);
    expect(picture(frame as NonNullable<typeof frame>).players[0]?.x).toBe(2.5);
  });

  it('has nothing to draw before the first snapshot', () => {
    expect(new Timeline().frame(100)).toBeNull();
    expect(new Timeline().serverTick(100)).toBeNull();
  });

  it('ignores a snapshot that is not newer than the last', () => {
    const timeline = steady([at(1.5), at(2.5)]);
    timeline.push(2, at(9.5), 400);
    timeline.push(1, at(9.5), 410);
    expect(timeline.latest?.state.players[0]?.x).toBe(2.5);
  });

  it('keeps its clock when one snapshot arrives late', () => {
    const timeline = steady([at(1.5), at(2.5)]);
    const before = timeline.serverTick(500);
    timeline.push(4, at(3.5), 4 * TICK_MS + 300);
    expect(timeline.serverTick(500)).toBe(before);
  });

  it('shifts to a faster path when snapshots start to arrive earlier', () => {
    const timeline = new Timeline();
    timeline.push(0, at(1.5), 300);
    timeline.push(2, at(1.5), 100 + 100);
    expect(timeline.serverTick(200)).toBeCloseTo(2);
  });
});

describe('picture', () => {
  const frameOf = (state: State, snapshotTick: number, tick: number) => {
    const snap = { tick: snapshotTick, state };
    return { tick, from: snap, to: snap, alpha: 0 };
  };

  it('puts a player who jumped far into place instead of sliding them across', () => {
    const timeline = steady([at(1.5), at(8.5)]);
    const frame = timeline.frame(INTERP_DELAY_MS + 0.5 * TICK_MS) as NonNullable<
      ReturnType<Timeline['frame']>
    >;
    expect(frame.alpha).toBeCloseTo(0.25);
    expect(picture(frame).players[0]?.x).toBe(1.5);
  });

  it('counts a bomb fuse down to the tick on screen', () => {
    const state = at(1.5);
    state.bombs.push({ id: 0, owner: 0, x: 3, y: 0, fuse: FUSE_TICKS, free: [] });
    expect(picture(frameOf(state, 10, 10)).bombs[0]?.fuse).toBe(FUSE_TICKS);
    expect(picture(frameOf(state, 10, 12)).bombs[0]?.fuse).toBe(FUSE_TICKS - 2);
  });

  it('gives a burning explosion the same start tick in every snapshot', () => {
    const early = at(1.5);
    early.blasts.push({ cells: [{ x: 3, y: 0 }], left: 10 });
    const late = at(1.5);
    late.blasts.push({ cells: [{ x: 3, y: 0 }], left: 8 });
    const a = picture(frameOf(early, 10, 10)).blasts[0];
    const b = picture(frameOf(late, 12, 12)).blasts[0];
    expect(a?.began).toBe(b?.began);
    expect(b?.left).toBe(8);
  });
});
