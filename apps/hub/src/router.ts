import { useSyncExternalStore } from 'react';
import { transitionsAllowed } from './settings/graphics.js';

export type Route =
  | { name: 'harbour' }
  | { name: 'room'; code: string }
  /** `/profile` is yours; `/profile/<id>` is someone else's. */
  | { name: 'profile'; userId?: string }
  | { name: 'sea' }
  | { name: 'kit' };

/** The screen a path shows; unknown paths show the Harbour (Bến). */
export function parseRoute(path: string): Route {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'room' && parts[1] && parts.length === 2) {
    return { name: 'room', code: parts[1].toUpperCase() };
  }
  if (parts[0] === 'sea' && parts.length === 1) return { name: 'sea' };
  if (parts[0] === 'profile' && parts.length === 1) return { name: 'profile' };
  if (parts[0] === 'profile' && parts[1] && parts.length === 2) {
    return { name: 'profile', userId: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === 'dev' && parts[1] === 'kit' && parts.length === 2) return { name: 'kit' };
  return { name: 'harbour' };
}

export interface NavigateOptions {
  replace?: boolean;
  /** Leaves even while `block` holds the screen (leaving the Room on purpose). */
  force?: boolean;
}

export interface Router {
  route(): Route;
  subscribe(listener: () => void): () => void;
  navigate(path: string, options?: NavigateOptions): void;
  /**
   * Holds the current screen (a Game is running) until the returned function is called.
   * `onBack` runs when the back button is pressed meanwhile.
   */
  block(onBack?: () => void): () => void;
  dispose(): void;
}

/** History routing for the Hub's screens, with a View Transition on each change. */
export function createRouter(): Router {
  const listeners = new Set<() => void>();
  let path = location.pathname;
  let current = parseRoute(path);
  let blocks = 0;
  const backHandlers: (() => void)[] = [];

  const update = () => {
    const next = location.pathname;
    if (next === path) return;
    path = next;
    const show = () => {
      current = parseRoute(path);
      for (const listener of listeners) listener();
    };
    if (document.startViewTransition && transitionsAllowed()) {
      document.startViewTransition(show).ready.catch(() => {});
    } else show();
  };

  const onPopState = () => {
    if (blocks > 0) {
      history.pushState(null, '', path);
      backHandlers.at(-1)?.();
      return;
    }
    update();
  };
  addEventListener('popstate', onPopState);

  return {
    route: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    navigate(to, { replace = false, force = false } = {}) {
      if (blocks > 0 && !force) return;
      if (force) {
        blocks = 0;
        backHandlers.length = 0;
      }
      if (to === path) return;
      if (replace) history.replaceState(null, '', to);
      else history.pushState(null, '', to);
      update();
    },
    block(onBack) {
      blocks += 1;
      if (onBack) backHandlers.push(onBack);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        blocks = Math.max(0, blocks - 1);
        const at = onBack ? backHandlers.indexOf(onBack) : -1;
        if (at >= 0) backHandlers.splice(at, 1);
      };
    },
    dispose() {
      removeEventListener('popstate', onPopState);
      listeners.clear();
    },
  };
}

export const router = typeof window === 'undefined' ? undefined : createRouter();

export function useRoute(): Route {
  const r = router as Router;
  return useSyncExternalStore(r.subscribe, r.route);
}

export const navigate = (path: string, options?: NavigateOptions) =>
  router?.navigate(path, options);
