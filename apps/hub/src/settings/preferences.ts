import { type ChoiceValue, type GameManifest, preferenceValues } from '@xomdao/sdk';
import { useSyncExternalStore } from 'react';

export const PREFERENCES_KEY = 'xomdao.preferences';

type Saved = Record<string, Record<string, ChoiceValue | boolean>>;

export interface PreferencesStore {
  /** Every Game's saved picks, by Game id: a new object after each change. */
  getState(): Saved;
  /** A Game's preferences as it gets them: the saved picks, its defaults for the rest. */
  of(manifest: Pick<GameManifest, 'id' | 'preferences'>): Record<string, ChoiceValue | boolean>;
  set(gameId: string, key: string, value: ChoiceValue | boolean): void;
  subscribe(listener: () => void): () => void;
}

function read(storage: Pick<Storage, 'getItem'> | undefined): Saved {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(PREFERENCES_KEY) ?? '{}');
    return typeof saved === 'object' && saved !== null ? (saved as Saved) : {};
  } catch {
    return {};
  }
}

/** Each player's own choices for the Games (their manifests' `preferences`), kept in storage. */
export function createPreferences(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): PreferencesStore {
  const listeners = new Set<() => void>();
  let state = read(storage);
  return {
    getState: () => state,
    of: (manifest) => preferenceValues(manifest, state[manifest.id]),
    set(gameId, key, value) {
      if (state[gameId]?.[key] === value) return;
      state = { ...state, [gameId]: { ...state[gameId], [key]: value } };
      try {
        storage?.setItem(PREFERENCES_KEY, JSON.stringify(state));
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

/** The page's one set of preferences. */
export const preferences = createPreferences(pageStorage());

/** A Game's preferences, redrawn when the player changes one. */
export function usePreferences(manifest: Pick<GameManifest, 'id' | 'preferences'>) {
  useSyncExternalStore(preferences.subscribe, preferences.getState);
  return preferences.of(manifest);
}
