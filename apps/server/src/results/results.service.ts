import { Inject, Injectable } from '@nestjs/common';
import { DB, type Db, type DbTx } from '../db/db.module.js';
import type { FinishedGame } from '../matches/finished-game.js';
import { MatchesService } from '../matches/matches.service.js';
import { StatsService } from '../stats/stats.service.js';

/**
 * The one door for Match results: writes the history and stats of a settled Match in one
 * transaction, once per `matchId`.
 */
@Injectable()
export class ResultsService {
  constructor(
    @Inject(DB) private readonly db: Db | null,
    private readonly matches: MatchesService,
    private readonly stats: StatsService,
  ) {}

  /** Records the Match; `false` when its `matchId` was already settled (nothing is written). */
  settle(game: FinishedGame): Promise<boolean> {
    const write = async (tx?: DbTx) => {
      if (!(await this.matches.record(game, tx))) return false;
      await this.stats.recordMatch(game, tx);
      return true;
    };
    return this.db ? this.db.transaction(write) : write();
  }
}
