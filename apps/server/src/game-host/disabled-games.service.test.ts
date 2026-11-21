import { afterEach, describe, expect, it, vi } from 'vitest';
import { DISABLED_GAMES_CACHE_MS, DisabledGamesService } from './disabled-games.service.js';
import { MemoryDisabledGamesStore } from './disabled-games.store.js';

describe('DisabledGamesService', () => {
  afterEach(() => vi.useRealTimers());

  it('hides a disabled Game until it is enabled again', async () => {
    const games = new DisabledGamesService(new MemoryDisabledGamesStore());

    await games.disable('caro');
    expect(await games.isDisabled('caro')).toBe(true);
    expect(await games.enabled(['caro', 'tien-len'])).toEqual(['tien-len']);
    await games.enable('caro');

    expect(await games.enabled(['caro', 'tien-len'])).toEqual(['caro', 'tien-len']);
  });

  it('sees a switch made by the CLI within a few seconds', async () => {
    vi.useFakeTimers();
    const store = new MemoryDisabledGamesStore();
    const server = new DisabledGamesService(store);
    expect(await server.isDisabled('caro')).toBe(false);

    await store.disable('caro');
    expect(await server.isDisabled('caro')).toBe(false);
    vi.advanceTimersByTime(DISABLED_GAMES_CACHE_MS);

    expect(await server.isDisabled('caro')).toBe(true);
  });
});
