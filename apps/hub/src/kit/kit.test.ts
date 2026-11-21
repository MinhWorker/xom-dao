import { describe, expect, it, vi } from 'vitest';
import { nextIndex } from './roving.js';
import { createToastStore, MAX_TOASTS } from './toasts.js';

describe('nextIndex', () => {
  it('wraps around at both ends', () => {
    expect(nextIndex('ArrowRight', 2, 3)).toBe(0);
    expect(nextIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(nextIndex('ArrowDown', 0, 3)).toBe(1);
    expect(nextIndex('ArrowUp', 1, 3)).toBe(0);
  });

  it('jumps to the ends and ignores other keys', () => {
    expect(nextIndex('Home', 2, 4)).toBe(0);
    expect(nextIndex('End', 0, 4)).toBe(3);
    expect(nextIndex('Enter', 0, 4)).toBeNull();
  });
});

describe('toast store', () => {
  it('queues toasts and notifies subscribers', () => {
    const store = createToastStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const id = store.push('Xong');
    expect(store.snapshot()).toEqual([{ id, message: 'Xong', tone: 'info' }]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps only the newest toasts', () => {
    const store = createToastStore();
    for (let i = 0; i < MAX_TOASTS + 2; i++) store.push(`tin ${i}`);
    const messages = store.snapshot().map((t) => t.message);
    expect(messages).toHaveLength(MAX_TOASTS);
    expect(messages.at(-1)).toBe(`tin ${MAX_TOASTS + 1}`);
  });

  it('dismisses one toast and ignores unknown ids', () => {
    const store = createToastStore();
    const a = store.push('a');
    store.push('b', 'danger');
    const listener = vi.fn();
    store.subscribe(listener);
    store.dismiss(999);
    expect(listener).not.toHaveBeenCalled();
    store.dismiss(a);
    expect(store.snapshot().map((t) => t.message)).toEqual(['b']);
  });
});
