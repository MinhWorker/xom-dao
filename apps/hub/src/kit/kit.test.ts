import { describe, expect, it, vi } from 'vitest';
import { closeAnimated } from './modal.js';
import { nextIndex } from './roving.js';
import { createToastStore, MAX_TOASTS } from './toasts.js';
import { createWaitStore, WAIT_DELAY_MS } from './wait.js';

vi.mock('../sound/index.js', () => ({ playSound: () => {} }));

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
  const live = (store: ReturnType<typeof createToastStore>) =>
    store.snapshot().filter((t) => !t.leaving);

  it('queues toasts and notifies subscribers', () => {
    const store = createToastStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const id = store.push('Xong', 'success');
    expect(store.snapshot()).toEqual([{ id, message: 'Xong', tone: 'success' }]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('sends the oldest out once too many are showing', () => {
    const store = createToastStore();
    for (let i = 0; i < MAX_TOASTS + 2; i++) store.push(`tin ${i}`);
    const messages = live(store).map((t) => t.message);
    expect(messages).toHaveLength(MAX_TOASTS);
    expect(messages.at(-1)).toBe(`tin ${MAX_TOASTS + 1}`);
    expect(
      store
        .snapshot()
        .filter((t) => t.leaving)
        .map((t) => t.message),
    ).toEqual(['tin 0', 'tin 1']);
  });

  it('lets a dismissed toast leave, then drops it; unknown ids do nothing', () => {
    const store = createToastStore();
    const a = store.push('a');
    store.push('b', 'danger');
    const listener = vi.fn();
    store.subscribe(listener);
    store.dismiss(999);
    store.remove(999);
    expect(listener).not.toHaveBeenCalled();
    store.dismiss(a);
    store.dismiss(a);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(live(store).map((t) => t.message)).toEqual(['b']);
    expect(store.snapshot()).toHaveLength(2);
    store.remove(a);
    expect(store.snapshot().map((t) => t.message)).toEqual(['b']);
  });
});

describe('closeAnimated', () => {
  function fakeDialog(animations: { endTime: number; finished: Promise<unknown> }[]) {
    const attrs = new Set<string>();
    const dialog = {
      seenClosing: false,
      closed: false,
      setAttribute: (name: string) => attrs.add(name),
      removeAttribute: (name: string) => attrs.delete(name),
      getAnimations() {
        dialog.seenClosing = attrs.has('data-closing');
        return animations.map(({ endTime, finished }) => ({
          effect: { getComputedTiming: () => ({ endTime }) },
          finished,
        }));
      },
      close() {
        dialog.closed = true;
      },
      attrs,
    };
    return dialog;
  }

  it('waits for the exit but not for looping animations, then closes', async () => {
    let finish = () => {};
    const exit = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const loop = new Promise<never>(() => {});
    const dialog = fakeDialog([
      { endTime: 220, finished: exit },
      { endTime: Infinity, finished: loop },
    ]);
    const done = closeAnimated(dialog as unknown as HTMLDialogElement);
    expect(dialog.seenClosing).toBe(true);
    await Promise.resolve();
    expect(dialog.closed).toBe(false);
    finish();
    await done;
    expect(dialog.closed).toBe(true);
    expect(dialog.attrs.has('data-closing')).toBe(false);
  });

  it('stays open when wanted open again by the end of the exit', async () => {
    const dialog = fakeDialog([]);
    await closeAnimated(dialog as unknown as HTMLDialogElement, () => true);
    expect(dialog.closed).toBe(false);
    expect(dialog.attrs.has('data-closing')).toBe(false);
  });
});

describe('wait store', () => {
  const later = () => {
    let settle!: (fail?: boolean) => void;
    const promise = new Promise<void>((resolve, reject) => {
      settle = (fail) => (fail ? reject(new Error('x')) : resolve());
    });
    return { promise, settle };
  };

  it('never shows the badge for a quick request', async () => {
    vi.useFakeTimers();
    const store = createWaitStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const r = later();
    store.track(r.promise);
    await vi.advanceTimersByTimeAsync(WAIT_DELAY_MS - 50);
    r.settle();
    await vi.advanceTimersByTimeAsync(WAIT_DELAY_MS);
    expect(store.snapshot()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('shows the badge past the delay until a slow request settles, even when it fails', async () => {
    vi.useFakeTimers();
    const store = createWaitStore();
    const r = later();
    const tracked = store.track(r.promise);
    await vi.advanceTimersByTimeAsync(WAIT_DELAY_MS);
    expect(store.snapshot()).toBe('badge');
    r.settle(true);
    await expect(tracked).rejects.toThrow('x');
    expect(store.snapshot()).toBeNull();
    vi.useRealTimers();
  });

  it('blocks while any slow blocking request is pending', async () => {
    vi.useFakeTimers();
    const store = createWaitStore();
    const background = later();
    const join = later();
    store.track(background.promise);
    store.track(join.promise, true);
    await vi.advanceTimersByTimeAsync(WAIT_DELAY_MS);
    expect(store.snapshot()).toBe('block');
    join.settle();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot()).toBe('badge');
    background.settle();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot()).toBeNull();
    vi.useRealTimers();
  });
});
