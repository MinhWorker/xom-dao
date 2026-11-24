import { defineManifest } from '@xomdao/sdk';
import { describe, expect, it, vi } from 'vitest';
import { createPreferences, PREFERENCES_KEY } from './preferences.js';

function memory(initial?: string) {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(PREFERENCES_KEY, initial);
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

const manifest = defineManifest({
  id: 'co-ty-phu',
  name: 'Cờ Tỷ Phú',
  tagline: 'Mua đất.',
  island: 'xuc-xac',
  minPlayers: 2,
  maxPlayers: 4,
  duration: { min: 25, max: 35 },
  status: 'wip',
  bots: true,
  focus: { x: 50, y: 50 },
  preferences: { follow: { type: 'toggle', label: 'Máy quay bám theo', default: true } },
});

describe('a player’s preferences', () => {
  it('starts at the Game’s defaults', () => {
    expect(createPreferences(memory()).of(manifest)).toEqual({ follow: true });
  });

  it('keeps a change per Game and announces it', () => {
    const storage = memory();
    const prefs = createPreferences(storage);
    const listener = vi.fn();
    prefs.subscribe(listener);
    prefs.set('co-ty-phu', 'follow', false);

    expect(prefs.of(manifest)).toEqual({ follow: false });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(createPreferences(storage).of(manifest)).toEqual({ follow: false });
    expect(createPreferences(storage).of({ ...manifest, id: 'other' })).toEqual({ follow: true });
  });

  it('falls back to the defaults when storage is unreadable or blocked', () => {
    expect(createPreferences(memory('{oops')).of(manifest)).toEqual({ follow: true });
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const prefs = createPreferences(blocked);
    expect(() => prefs.set('co-ty-phu', 'follow', false)).not.toThrow();
    expect(prefs.of(manifest)).toEqual({ follow: false });
  });
});
