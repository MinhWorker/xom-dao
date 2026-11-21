import { Inject, Injectable } from '@nestjs/common';
import { HISTORY_LIMIT, type MatchRecord } from '@xomdao/shared';
import type { DbTx } from '../db/db.module.js';
import { type FinishedGame, placeOf, won } from './finished-game.js';
import type { MatchesStore } from './matches.store.js';

export const MATCHES_STORE = Symbol('MATCHES_STORE');

/**
 * Match history: keeps every settled Match that had an account at the table, and gives a
 * player their most recent ones.
 */
@Injectable()
export class MatchesService {
  constructor(@Inject(MATCHES_STORE) private readonly store: MatchesStore) {}

  /** Keeps the Match once; `false` when its id is already kept or no account sat at it. */
  async record(game: FinishedGame, tx?: DbTx) {
    const { matchId, gameId, startedAt, endedAt, seats } = game;
    if (seats.every((s) => s.bot)) return false;
    return this.store.add(
      {
        id: matchId,
        gameId,
        startedAt,
        endedAt,
        players: seats.map((s) => {
          const seat = placeOf(game, s.id);
          return {
            userId: s.bot ? null : s.id,
            name: s.name,
            ...(s.avatar && { avatar: s.avatar }),
            ...(s.frame && { frame: s.frame }),
            bot: s.bot,
            won: won(game, s.id),
            left: s.left,
            ...(seat && { place: seat.place }),
            ...(seat?.score !== undefined && { score: seat.score }),
          };
        }),
      },
      tx,
    );
  }

  /** The accounts the player sat with in their recent games, most recent first, once each. */
  async partners(userId: string): Promise<string[]> {
    const seen = new Set<string>();
    for (const match of await this.store.recent(userId, HISTORY_LIMIT)) {
      for (const p of match.players) {
        if (p.userId && p.userId !== userId) seen.add(p.userId);
      }
    }
    return [...seen];
  }

  /** The player's most recent games, newest first, as they see them. */
  async recent(userId: string): Promise<MatchRecord[]> {
    const matches = await this.store.recent(userId, HISTORY_LIMIT);
    return matches.map(({ id, gameId, startedAt, endedAt, players }) => {
      const me = players.find((p) => p.userId === userId);
      const draw = players.every((p) => !p.won);
      return {
        id,
        gameId,
        outcome: me?.won ? 'win' : draw ? 'draw' : 'loss',
        startedAt,
        endedAt,
        players: players.map(({ userId: id, ...p }) => ({ ...p, me: id === userId })),
      };
    });
  }
}
