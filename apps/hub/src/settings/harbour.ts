import { useSyncExternalStore } from 'react';
import { BACKGROUNDS, CHARACTERS, type HarbourArt, pickArt } from '../harbour-art/arts.js';

/** Which character and backdrop the Bến shows (ids from `harbour-art/arts.ts`). */
export interface HarbourLook {
  character: string;
  background: string;
}

export interface HarbourCatalog {
  characters: [HarbourArt, ...HarbourArt[]];
  backgrounds: [HarbourArt, ...HarbourArt[]];
}

export interface HarbourLookStore {
  getState(): HarbourLook;
  set(patch: Partial<HarbourLook>): void;
  subscribe(listener: () => void): () => void;
}

export const HARBOUR_KEY = 'xomdao.harbour';

const CATALOG: HarbourCatalog = { characters: CHARACTERS, backgrounds: BACKGROUNDS };

/** The player's Bến choices, kept in storage; an unknown id or unreadable storage means the first art. */
export function createHarbourLook(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
  catalog: HarbourCatalog = CATALOG,
): HarbourLookStore {
  const listeners = new Set<() => void>();
  const clean = (value: Partial<Record<keyof HarbourLook, unknown>>): HarbourLook => ({
    character: pickArt(catalog.characters, value.character).id,
    background: pickArt(catalog.backgrounds, value.background).id,
  });
  const read = (): HarbourLook => {
    try {
      const saved: unknown = JSON.parse(storage?.getItem(HARBOUR_KEY) ?? '{}');
      return clean(typeof saved === 'object' && saved !== null ? saved : {});
    } catch {
      return clean({});
    }
  };
  let state = read();
  return {
    getState: () => state,
    set(patch) {
      const next = clean({ ...state, ...patch });
      if (next.character === state.character && next.background === state.background) return;
      state = next;
      try {
        storage?.setItem(HARBOUR_KEY, JSON.stringify(state));
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

/** The page's one Bến look. */
export const harbourLook = createHarbourLook(pageStorage());

export const useHarbourLook = () =>
  useSyncExternalStore(harbourLook.subscribe, harbourLook.getState);
