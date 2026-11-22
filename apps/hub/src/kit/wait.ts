/** `badge`: something loads behind the screen; `block`: the player must wait for it. */
export type WaitState = 'badge' | 'block' | null;

/** How long a request runs before the badge shows, so quick ones never flash it. */
export const WAIT_DELAY_MS = 300;

export interface WaitStore {
  snapshot(): WaitState;
  subscribe(listener: () => void): () => void;
  /** Resolves or rejects as `promise` does; past the delay it shows the badge until then. */
  track<T>(promise: Promise<T>, block?: boolean): Promise<T>;
}

export function createWaitStore(delayMs = WAIT_DELAY_MS): WaitStore {
  const listeners = new Set<() => void>();
  const late = new Set<{ block: boolean }>();
  let state: WaitState = null;

  const update = () => {
    const next: WaitState =
      late.size === 0 ? null : [...late].some((w) => w.block) ? 'block' : 'badge';
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    track(promise, block = false) {
      const entry = { block };
      const timer = setTimeout(() => {
        late.add(entry);
        update();
      }, delayMs);
      const done = () => {
        clearTimeout(timer);
        if (late.delete(entry)) update();
      };
      promise.then(done, done);
      return promise;
    },
  };
}

export const waits = createWaitStore();

/** Shows the wait badge if `promise` is slow; `block` also dims and blocks the screen. */
export const wait = <T>(promise: Promise<T>, options?: { block?: boolean }) =>
  waits.track(promise, options?.block);
