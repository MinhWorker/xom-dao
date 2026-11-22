// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyFrame, FRAMES, fitFrame, frameRatio } from './frame.js';

const view = (width: number, height: number) => ({ width, height });

describe('fitFrame', () => {
  it('has no frame when the choice fills the screen', () => {
    expect(fitFrame(view(844, 390), null)).toBeNull();
  });

  it('adds dark bars left and right when the screen is wider than the frame', () => {
    expect(fitFrame(view(1000, 400), 16 / 9)).toEqual({ w: 711, h: 400, x: 144, y: 0 });
  });

  it('adds dark bars above and below when the screen is taller than the frame', () => {
    expect(fitFrame(view(1024, 768), 20 / 9)).toEqual({ w: 1024, h: 460, x: 0, y: 154 });
  });

  it('has no frame when the screen already has that ratio, or in portrait', () => {
    expect(fitFrame(view(1280, 720), 16 / 9)).toBeNull();
    expect(fitFrame(view(390, 844), 16 / 9)).toBeNull();
  });

  it('never gives a box bigger than the screen', () => {
    for (const { ratio } of FRAMES) {
      const box = fitFrame(view(932, 430), ratio);
      if (!box) continue;
      expect(box.w + box.x * 2).toBeLessThanOrEqual(932);
      expect(box.h + box.y * 2).toBeLessThanOrEqual(430);
    }
  });
});

describe('frameRatio', () => {
  it('reads a choice, and falls back to filling the screen', () => {
    expect(frameRatio('16:9')).toBeCloseTo(16 / 9);
    expect(frameRatio('auto')).toBeNull();
    expect(frameRatio('7:3')).toBeNull();
  });
});

describe('applyFrame', () => {
  it('puts the box and the viewport units on the page, and takes them off again', () => {
    const root = document.createElement('div');
    applyFrame(root, { w: 800, h: 360, x: 22, y: 0 });
    expect(root.dataset.frame).toBe('');
    expect(root.style.getPropertyValue('--frame-w')).toBe('800px');
    expect(root.style.getPropertyValue('--frame-x')).toBe('22px');
    expect(root.style.getPropertyValue('--frame-vw')).toBe('8px');
    expect(root.style.getPropertyValue('--frame-vh')).toBe('3.6px');
    expect(root.style.getPropertyValue('--frame-vmin')).toBe('3.6px');
    applyFrame(root, null);
    expect(root.dataset.frame).toBeUndefined();
    expect(root.style.getPropertyValue('--frame-w')).toBe('');
    expect(root.style.getPropertyValue('--frame-vw')).toBe('');
  });
});
