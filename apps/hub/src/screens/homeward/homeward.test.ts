import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHomeward } from './homeward.js';

describe('homeward', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('covers the screen while leaving, goes home, holds the full bar and fades out', async () => {
    const goHome = vi.fn();
    const trip = createHomeward(goHome, { enterMs: 320, holdMs: 600, exitMs: 260 });
    const leave = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));

    const done = trip.run(leave);
    expect(trip.snapshot()).toBe('leaving');
    await vi.advanceTimersByTimeAsync(319);
    expect(leave).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(leave).toHaveBeenCalledOnce();
    expect(goHome).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(goHome).toHaveBeenCalledOnce();
    expect(trip.snapshot()).toBe('arrived');

    await vi.advanceTimersByTimeAsync(600);
    expect(trip.snapshot()).toBe('out');
    await vi.advanceTimersByTimeAsync(260);
    expect(trip.snapshot()).toBeNull();
    await done;
  });

  it('uncovers at once and stays put when leaving fails', async () => {
    const goHome = vi.fn();
    const trip = createHomeward(goHome, { enterMs: 0 });
    const done = trip.run(() => Promise.reject(new Error('Máy chủ gặp lỗi')));
    const failed = expect(done).rejects.toThrow('Máy chủ gặp lỗi');
    await vi.advanceTimersByTimeAsync(0);
    await failed;
    expect(trip.snapshot()).toBeNull();
    expect(goHome).not.toHaveBeenCalled();
  });
});
