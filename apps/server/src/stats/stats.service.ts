import { Inject, Injectable } from '@nestjs/common';
import {
  CORE_BOARD,
  getGame,
  levelOf,
  type PlayerStats,
  RANKING_LIMIT,
  type RankInfo,
  type Ranking,
  type RankingEntry,
  XP_PER_GAME,
} from '@xomdao/shared';
import { AccountsService } from '../accounts/accounts.service.js';
import type { FinishedGame } from '../matches/finished-game.js';
import type { StatCount, StatRow, StatsStore } from './stats.store.js';

export const STATS_STORE = Symbol('STATS_STORE');

export class StatsError extends Error {}

/** A board's stat: experience on `core`, wins on a game's. */
const boardStat = (board: string) =>
  board === CORE_BOARD ? { gameId: CORE_BOARD, name: 'xp' } : { gameId: board, name: 'won' };

/**
 * Thống kê, xếp hạng. It owns `player_stats` and `stat_matches`.
 *
 * Every finished game (`recordMatch`; no caller until Match results are settled) counts, once per
 * game and for people only: `played`, `won` for its winners, the game's own `ctx.stat` counts,
 * and `XP_PER_GAME` experience.
 *
 * Rankings read the counts: `core` by experience, a game's board by its wins.
 */
@Injectable()
export class StatsService {
  constructor(
    @Inject(STATS_STORE) private readonly store: StatsStore,
    private readonly accounts: AccountsService,
  ) {}

  /** Counts a finished game for the people at the table. */
  async recordMatch({ gameId, matchId, seats, result }: FinishedGame): Promise<void> {
    for (const seat of seats) {
      if (seat.bot) continue;
      const counts: StatCount[] = [
        { gameId, name: 'played', amount: 1 },
        { gameId: CORE_BOARD, name: 'xp', amount: XP_PER_GAME },
      ];
      if (result.winners.includes(seat.id)) counts.push({ gameId, name: 'won', amount: 1 });
      for (const stat of result.stats ?? []) {
        if (stat.player === seat.id) counts.push({ gameId, name: stat.name, amount: stat.amount });
      }
      await this.store.addMatch(seat.id, matchId, counts);
    }
  }

  /** Someone's level, totals and ranks. */
  async playerStats(userId: string): Promise<PlayerStats> {
    if (!(await this.accounts.userById(userId))) throw new StatsError('Không tìm thấy người chơi');
    const rows = await this.store.counts(userId);
    const xp = countOf(rows, CORE_BOARD, 'xp');
    const ranks: RankInfo[] = [];
    for (const board of [CORE_BOARD, ...boardsOf(rows)]) {
      const { gameId, name } = boardStat(board);
      const value = countOf(rows, gameId, name);
      if (value > 0) {
        ranks.push({ board, value, rank: (await this.store.above(gameId, name, value)) + 1 });
      }
    }
    // Everyone's board first, then games by wins.
    ranks.sort(
      (a, b) =>
        Number(b.board === CORE_BOARD) - Number(a.board === CORE_BOARD) || b.value - a.value,
    );
    return {
      userId,
      xp,
      ...levelOf(xp),
      played: total(rows, 'played'),
      won: total(rows, 'won'),
      ranks,
    };
  }

  /** The top of a board, and `me`'s row when they are on it. */
  async ranking(board: string, me: string): Promise<Ranking> {
    if (board !== CORE_BOARD && !getGame(board)) throw new StatsError('Không có bảng xếp hạng này');
    const { gameId, name } = boardStat(board);
    const top = await this.store.top(gameId, name, RANKING_LIMIT);
    const entries: RankingEntry[] = [];
    for (const [i, row] of top.entries()) {
      // Ties share the rank of the first of them.
      const rank =
        i > 0 && top[i - 1]?.value === row.value ? (entries[i - 1]?.rank ?? i + 1) : i + 1;
      entries.push(await this.entry(row.userId, row.value, rank));
    }
    let mine = entries.find((e) => e.id === me) ?? null;
    if (!mine) {
      const value = countOf(await this.store.counts(me), gameId, name);
      if (value > 0) {
        mine = await this.entry(me, value, (await this.store.above(gameId, name, value)) + 1);
      }
    }
    return { board, entries, me: mine };
  }

  private async entry(userId: string, value: number, rank: number): Promise<RankingEntry> {
    const user = await this.accounts.userById(userId);
    return {
      rank,
      id: userId,
      name: user?.name ?? 'Người chơi',
      avatar: user?.avatar ?? '',
      frame: user?.frame ?? '',
      value,
    };
  }
}

const countOf = (rows: StatRow[], gameId: string, name: string) =>
  rows.find((r) => r.gameId === gameId && r.name === name)?.value ?? 0;

/** A stat summed over every game (the core board's experience aside). */
const total = (rows: StatRow[], name: string) =>
  rows.filter((r) => r.gameId !== CORE_BOARD && r.name === name).reduce((n, r) => n + r.value, 0);

/** The games the account has played. */
const boardsOf = (rows: StatRow[]) =>
  rows.filter((r) => r.gameId !== CORE_BOARD && r.name === 'played').map((r) => r.gameId);
