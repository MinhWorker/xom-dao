// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { BACKGROUNDS, CHARACTERS, type HarbourArt } from '../harbour-art/arts.js';
import { createHarbourLook, HARBOUR_KEY } from './harbour.js';

function memory(initial?: string) {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(HARBOUR_KEY, initial);
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

const art = (id: string): HarbourArt => ({ id, name: id, src: `/${id}.webp` });
const catalog = {
  characters: [art('x'), art('y')] as [HarbourArt, ...HarbourArt[]],
  backgrounds: [art('a'), art('b')] as [HarbourArt, ...HarbourArt[]],
};

describe('harbour look', () => {
  it('starts with the first character and backdrop', () => {
    expect(createHarbourLook(memory()).getState()).toEqual({
      character: CHARACTERS[0].id,
      background: BACKGROUNDS[0].id,
    });
  });

  it('keeps a choice, saves it and announces it once', () => {
    const storage = memory();
    const look = createHarbourLook(storage, catalog);
    const listener = vi.fn();
    look.subscribe(listener);
    look.set({ background: 'b' });
    look.set({ background: 'b' });
    expect(look.getState()).toEqual({ character: 'x', background: 'b' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.store.get(HARBOUR_KEY) ?? '{}')).toEqual({
      character: 'x',
      background: 'b',
    });
  });

  it('ignores an id that is not in the catalog', () => {
    const look = createHarbourLook(memory(), catalog);
    const listener = vi.fn();
    look.subscribe(listener);
    look.set({ character: 'nope' });
    expect(look.getState().character).toBe('x');
    expect(listener).not.toHaveBeenCalled();
  });

  it('reads what was saved and drops ids that no longer exist', () => {
    const saved = JSON.stringify({ character: CHARACTERS[0].id, background: 'gone' });
    expect(createHarbourLook(memory(saved)).getState()).toEqual({
      character: CHARACTERS[0].id,
      background: BACKGROUNDS[0].id,
    });
    expect(createHarbourLook(memory('not json')).getState().character).toBe(CHARACTERS[0].id);
  });

  it('works without storage', () => {
    expect(createHarbourLook(undefined).getState().background).toBe(BACKGROUNDS[0].id);
  });
});
