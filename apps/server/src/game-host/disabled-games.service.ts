import { Inject, Injectable } from '@nestjs/common';
import type { DisabledGamesStore } from './disabled-games.store.js';

export const DISABLED_GAMES_STORE = Symbol('DISABLED_GAMES_STORE');
/** How long a read of `disabled_games` is reused; the CLI's switch shows up within it. */
export const DISABLED_GAMES_CACHE_MS = 5_000;

/** The switch that takes a Game out of the lobby and stops new Rooms, without a deploy. */
@Injectable()
export class DisabledGamesService {
  private cached?: { ids: Set<string>; until: number };

  constructor(@Inject(DISABLED_GAMES_STORE) private readonly store: DisabledGamesStore) {}

  async isDisabled(gameId: string) {
    return (await this.ids()).has(gameId);
  }

  /** The given Game ids that are not switched off. */
  async enabled(gameIds: readonly string[]) {
    const disabled = await this.ids();
    return gameIds.filter((id) => !disabled.has(id));
  }

  async disable(gameId: string) {
    await this.store.disable(gameId);
    this.cached = undefined;
  }

  async enable(gameId: string) {
    await this.store.enable(gameId);
    this.cached = undefined;
  }

  private async ids() {
    if (this.cached && Date.now() < this.cached.until) return this.cached.ids;
    const ids = new Set(await this.store.list());
    this.cached = { ids, until: Date.now() + DISABLED_GAMES_CACHE_MS };
    return ids;
  }
}
