// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  applyGraphics,
  createGraphics,
  GRAPHICS_KEY,
  HUD_SCALE,
  MARGIN,
  watchGraphics,
} from './graphics.js';

function memory(initial?: string) {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(GRAPHICS_KEY, initial);
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

describe('graphics', () => {
  it('starts with everything on', () => {
    expect(createGraphics(memory()).getState()).toEqual({
      loopVideo: true,
      transitions: true,
      hudScale: 100,
      margin: 0,
    });
  });

  it('changes one choice, keeps it and announces it once', () => {
    const storage = memory();
    const graphics = createGraphics(storage);
    const listener = vi.fn();
    graphics.subscribe(listener);
    graphics.set({ loopVideo: false });
    graphics.set({ loopVideo: false });
    expect(graphics.getState().loopVideo).toBe(false);
    expect(graphics.getState().transitions).toBe(true);
    expect(JSON.parse(storage.store.get(GRAPHICS_KEY) ?? '')).toMatchObject({ loopVideo: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reads what was kept, and ignores what is not a choice', () => {
    expect(
      createGraphics(memory('{"loopVideo":false,"transitions":"yes"}')).getState(),
    ).toMatchObject({ loopVideo: false, transitions: true });
    expect(createGraphics(memory('not json')).getState().loopVideo).toBe(true);
    expect(createGraphics(memory('null')).getState().transitions).toBe(true);
  });

  it('survives storage that throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const graphics = createGraphics(blocked);
    expect(() => graphics.set({ transitions: false })).not.toThrow();
    expect(graphics.getState().transitions).toBe(false);
  });

  it('keeps the HUD scale and the margin inside their ranges', () => {
    const graphics = createGraphics(memory());
    graphics.set({ hudScale: 400, margin: -5 });
    expect(graphics.getState().hudScale).toBe(HUD_SCALE.max);
    expect(graphics.getState().margin).toBe(MARGIN.min);
    graphics.set({ hudScale: 10, margin: 999 });
    expect(graphics.getState().hudScale).toBe(HUD_SCALE.min);
    expect(graphics.getState().margin).toBe(MARGIN.max);
    expect(createGraphics(memory('{"hudScale":"big","margin":12.4}')).getState()).toMatchObject({
      hudScale: 100,
      margin: 16,
    });
    expect(createGraphics(memory('{"hudScale":104,"margin":7}')).getState()).toMatchObject({
      hudScale: 100,
      margin: 0,
    });
  });

  it('puts the scale and the margin on the page as CSS variables, and follows changes', () => {
    const root = document.createElement('div');
    const graphics = createGraphics(memory());
    const stop = watchGraphics(root, graphics);
    expect(root.style.getPropertyValue('--hud-scale')).toBe('1');
    expect(root.style.getPropertyValue('--margin')).toBe('0px');
    graphics.set({ hudScale: 120, margin: 16 });
    expect(root.style.getPropertyValue('--hud-scale')).toBe('1.2');
    expect(root.style.getPropertyValue('--margin')).toBe('16px');
    stop();
    graphics.set({ margin: 32 });
    expect(root.style.getPropertyValue('--margin')).toBe('16px');
    applyGraphics(root, graphics.getState());
    expect(root.style.getPropertyValue('--margin')).toBe('32px');
  });
});
