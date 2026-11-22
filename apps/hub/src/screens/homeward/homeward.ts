import { navigate } from '../../router.js';

/** `leaving`: the server is letting the player go; `arrived`: the Bến is mounted under the screen; `out`: fading. */
export type HomewardState = 'leaving' | 'arrived' | 'out' | null;

/** The screen's wipe in, which covers the Room before leaving empties it. */
export const ENTER_MS = 320;
/** How long the full bar stays after the Bến is up, so the screen never just flashes. */
export const HOLD_MS = 600;
export const EXIT_MS = 260;

export interface Homeward {
  snapshot(): HomewardState;
  subscribe(listener: () => void): () => void;
  /**
   * Covers the screen with the Hub's loading screen, then runs `leave`, goes to the Bến and uncovers it.
   * If `leave` fails the screen goes away at once and the error is rethrown.
   */
  run(leave: () => Promise<unknown>): Promise<void>;
}

export function createHomeward(
  goHome: () => void,
  { enterMs = ENTER_MS, holdMs = HOLD_MS, exitMs = EXIT_MS } = {},
): Homeward {
  const listeners = new Set<() => void>();
  let state: HomewardState = null;
  let trip = 0;

  const set = (next: HomewardState) => {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  };
  const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  return {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async run(leave) {
      const id = ++trip;
      set('leaving');
      try {
        await later(enterMs);
        await leave();
      } catch (err) {
        if (id === trip) set(null);
        throw err;
      }
      if (id !== trip) return;
      goHome();
      set('arrived');
      await later(holdMs);
      if (id !== trip) return;
      set('out');
      await later(exitMs);
      if (id === trip) set(null);
    },
  };
}

export const homeward = createHomeward(() => navigate('/', { force: true }));
