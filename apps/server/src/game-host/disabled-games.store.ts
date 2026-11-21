import { eq } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { disabledGames } from '../db/schema.js';

/** Where the switched-off Games are kept: Postgres in real use, memory without DATABASE_URL. */
export interface DisabledGamesStore {
  list(): Promise<string[]>;
  disable(gameId: string): Promise<void>;
  enable(gameId: string): Promise<void>;
}

export class PgDisabledGamesStore implements DisabledGamesStore {
  constructor(private readonly db: Db) {}

  async list() {
    const rows = await this.db.select({ gameId: disabledGames.gameId }).from(disabledGames);
    return rows.map(({ gameId }) => gameId).sort();
  }

  async disable(gameId: string) {
    await this.db.insert(disabledGames).values({ gameId }).onConflictDoNothing();
  }

  async enable(gameId: string) {
    await this.db.delete(disabledGames).where(eq(disabledGames.gameId, gameId));
  }
}

export class MemoryDisabledGamesStore implements DisabledGamesStore {
  private readonly ids = new Set<string>();

  async list() {
    return [...this.ids].sort();
  }

  async disable(gameId: string) {
    this.ids.add(gameId);
  }

  async enable(gameId: string) {
    this.ids.delete(gameId);
  }
}
