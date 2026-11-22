import { useSyncExternalStore } from 'react';

export interface Graphics {
  /** The short video behind the lobby. */
  loopVideo: boolean;
  /** View Transitions between screens and Games. */
  transitions: boolean;
  /** The Hub's size in percent, between `HUD_SCALE.min` and `HUD_SCALE.max`. */
  hudScale: number;
  /** Extra space around the screen in px: one of the three stops from `MARGIN.min` to `MARGIN.max`. */
  margin: number;
}

export const HUD_SCALE = { min: 80, max: 130, step: 10 } as const;
export const MARGIN = { min: 0, max: 32, step: 16 } as const;

export const GRAPHICS_KEY = 'xomdao.graphics';

const DEFAULTS: Graphics = { loopVideo: true, transitions: true, hudScale: 100, margin: 0 };

export interface GraphicsStore {
  getState(): Graphics;
  set(patch: Partial<Graphics>): void;
  subscribe(listener: () => void): () => void;
}

/** A number held to a range and to its nearest stop, or `fallback` when it is not a number. */
function inRange(
  value: unknown,
  { min, max, step }: { min: number; max: number; step: number },
  fallback: number,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const stop = min + Math.round((value - min) / step) * step;
  return Math.min(max, Math.max(min, stop));
}

function read(storage: Pick<Storage, 'getItem'> | undefined): Graphics {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(GRAPHICS_KEY) ?? '{}');
    if (typeof saved !== 'object' || saved === null) return DEFAULTS;
    const { loopVideo, transitions, hudScale, margin } = saved as Partial<
      Record<keyof Graphics, unknown>
    >;
    return {
      loopVideo: typeof loopVideo === 'boolean' ? loopVideo : DEFAULTS.loopVideo,
      transitions: typeof transitions === 'boolean' ? transitions : DEFAULTS.transitions,
      hudScale: inRange(hudScale, HUD_SCALE, DEFAULTS.hudScale),
      margin: inRange(margin, MARGIN, DEFAULTS.margin),
    };
  } catch {
    return DEFAULTS;
  }
}

/** The player's graphics choices, kept in storage; unreadable storage means the defaults. */
export function createGraphics(storage?: Pick<Storage, 'getItem' | 'setItem'>): GraphicsStore {
  const listeners = new Set<() => void>();
  let state = read(storage);
  return {
    getState: () => state,
    set(patch) {
      const next = {
        ...state,
        ...patch,
        hudScale: inRange(patch.hudScale ?? state.hudScale, HUD_SCALE, DEFAULTS.hudScale),
        margin: inRange(patch.margin ?? state.margin, MARGIN, DEFAULTS.margin),
      };
      if ((Object.keys(next) as (keyof Graphics)[]).every((key) => next[key] === state[key]))
        return;
      state = next;
      try {
        storage?.setItem(GRAPHICS_KEY, JSON.stringify(state));
      } catch {
        // Storage can be blocked; the choice then lasts until the page closes.
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function pageStorage() {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

/** The page's one set of graphics choices. */
export const graphics = createGraphics(pageStorage());

/** Puts the HUD scale and margin on the page as the CSS variables `tokens.css` reads. */
export function applyGraphics(root: HTMLElement, { hudScale, margin }: Graphics) {
  root.style.setProperty('--hud-scale', String(hudScale / 100));
  root.style.setProperty('--margin', `${margin}px`);
}

/** Keeps the page in step with the choices, now and whenever they change. */
export function watchGraphics(root: HTMLElement, store: GraphicsStore = graphics) {
  applyGraphics(root, store.getState());
  return store.subscribe(() => applyGraphics(root, store.getState()));
}

/** Whether the browser has CSS `zoom`, which the HUD scale needs. */
export const canScaleHud = () => typeof CSS !== 'undefined' && CSS.supports('zoom', '1.1');

export const useGraphics = () => useSyncExternalStore(graphics.subscribe, graphics.getState);

/** Whether the OS asks for less motion. */
export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** View Transitions run only when the player allows them and the OS does not ask for less motion. */
export const transitionsAllowed = () => graphics.getState().transitions && !prefersReducedMotion();
