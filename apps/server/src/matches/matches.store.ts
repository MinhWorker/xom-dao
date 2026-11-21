import { desc, eq, inArray } from 'drizzle-orm';
import type { Db, DbTx } from '../db/db.module.js';
import { matches, matchPlayers } from '../db/schema.js';

export interface StoredPlayer {
  /** The account, `null` for a bot. */
  userId: string | null;
  name: string;
  avatar?: string;
  frame?: string;
  bot: boolean;
  won: boolean;
  left: boolean;
  place?: number;
  score?: number;
}

export interface StoredMatch {
  id: string;
  gameId: string;
  startedAt: number;
  endedAt: number;
  /** In seat order. */
  players: StoredPlayer[];
}

/** Where finished games are kept: Postgres in real use, memory when there is no DATABASE_URL. */
export interface MatchesStore {
  /** Keeps the Match under its id; `false` when that id is already kept. */
  add(match: StoredMatch, tx?: DbTx): Promise<boolean>;
  /** The account's `limit` most recent games, newest first. */
  recent(userId: string, limit: number): Promise<StoredMatch[]>;
}

export class PgMatchesStore implements MatchesStore {
  constructor(private readonly db: Db) {}

  add(match: StoredMatch, tx?: DbTx) {
    return tx ? this.write(tx, match) : this.db.transaction((t) => this.write(t, match));
  }

  private async write(tx: DbTx, { id, gameId, startedAt, endedAt, players }: StoredMatch) {
    const [row] = await tx
      .insert(matches)
      .values({ id, gameId, startedAt: new Date(startedAt), endedAt: new Date(endedAt) })
      .onConflictDoNothing()
      .returning({ id: matches.id });
    if (!row) return false;
    await tx.insert(matchPlayers).values(
      players.map((p, seat) => ({
        matchId: row.id,
        seat,
        userId: p.userId,
        name: p.name,
        avatar: p.avatar ?? null,
        frame: p.frame ?? null,
        bot: p.bot,
        won: p.won,
        left: p.left,
        place: p.place ?? null,
        score: p.score ?? null,
      })),
    );
    return true;
  }

  async recent(userId: string, limit: number) {
    const rows = await this.db
      .select({ match: matches })
      .from(matchPlayers)
      .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
      .where(eq(matchPlayers.userId, userId))
      .orderBy(desc(matches.endedAt))
      .limit(limit);
    if (!rows.length) return [];
    const seats = await this.db
      .select()
      .from(matchPlayers)
      .where(
        inArray(
          matchPlayers.matchId,
          rows.map((r) => r.match.id),
        ),
      )
      .orderBy(matchPlayers.seat);
    return rows.map(({ match }) => ({
      id: match.id,
      gameId: match.gameId,
      startedAt: match.startedAt.getTime(),
      endedAt: match.endedAt.getTime(),
      players: seats
        .filter((s) => s.matchId === match.id)
        .map((s) => ({
          userId: s.userId,
          name: s.name,
          ...(s.avatar && { avatar: s.avatar }),
          ...(s.frame && { frame: s.frame }),
          bot: s.bot,
          won: s.won,
          left: s.left,
          ...(s.place !== null && { place: s.place }),
          ...(s.score !== null && { score: s.score }),
        })),
    }));
  }
}

/** Used by tests and when the server runs without a database (history vanishes on restart). */
export class MemoryMatchesStore implements MatchesStore {
  private readonly matches: StoredMatch[] = [];

  async add(match: StoredMatch) {
    if (this.matches.some(({ id }) => id === match.id)) return false;
    this.matches.push(structuredClone(match));
    return true;
  }

  async recent(userId: string, limit: number) {
    return this.matches
      .filter((m) => m.players.some((p) => p.userId === userId))
      .sort((a, b) => b.endedAt - a.endedAt)
      .slice(0, limit)
      .map((m) => structuredClone(m));
  }
}
