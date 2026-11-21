import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore, PgAccountsStore } from '../accounts/accounts.store.js';
import type { Db } from '../db/db.module.js';
import type { FinishedGame } from '../matches/finished-game.js';
import { MatchesService } from '../matches/matches.service.js';
import { MemoryMatchesStore, PgMatchesStore } from '../matches/matches.store.js';
import { StatsService } from '../stats/stats.service.js';
import { MemoryStatsStore, PgStatsStore } from '../stats/stats.store.js';
import { freshDb, TEST_DATABASE_URL } from '../testing/pg.js';
import { ResultsService } from './results.service.js';

function services(db: Db | null) {
  const accounts = new AccountsService(db ? new PgAccountsStore(db) : new MemoryAccountsStore());
  const matches = new MatchesService(db ? new PgMatchesStore(db) : new MemoryMatchesStore());
  const stats = new StatsService(db ? new PgStatsStore(db) : new MemoryStatsStore(), accounts);
  return { accounts, matches, stats, results: new ResultsService(db, matches, stats) };
}

type Services = ReturnType<typeof services>;

async function twoPlayers({ accounts }: Services) {
  const lan = (await accounts.guest('Lan')).user;
  const minh = (await accounts.guest('Minh')).user;
  return { lan: lan.id, minh: minh.id };
}

function finished(
  seats: { id: string; place: number; left?: boolean; bot?: boolean }[],
  matchId = randomUUID(),
): FinishedGame {
  return {
    gameId: 'tic-tac-toe',
    matchId,
    startedAt: 1_000,
    endedAt: 61_000,
    seats: seats.map(({ id, left = false, bot = false }) => ({ id, name: id, bot, left })),
    result: {
      seats: seats.map(({ id, place }) => ({ player: id, place, score: place * 10 })),
      stats: [{ player: seats[0]?.id ?? '', name: 'moves', amount: 3 }],
    },
  };
}

function settleSuite(open: () => Promise<{ db: Db | null; drop?: () => Promise<void> }>) {
  let s: Services;
  let drop: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const opened = await open();
    drop = opened.drop;
    s = services(opened.db);
  });
  afterAll(() => drop?.());

  it('records a Match result once per matchId', async () => {
    const { lan, minh } = await twoPlayers(s);
    const game = finished([
      { id: lan, place: 1 },
      { id: minh, place: 2 },
    ]);

    expect(await s.results.settle(game)).toBe(true);
    expect(await s.results.settle(game)).toBe(false);

    const history = await s.matches.recent(lan);
    expect(history).toHaveLength(1);
    expect(history[0]?.outcome).toBe('win');
    expect((await s.matches.recent(minh))[0]?.outcome).toBe('loss');
    const stats = await s.stats.playerStats(lan);
    expect(stats).toMatchObject({ played: 1, won: 1, xp: 10 });
    expect((await s.stats.playerStats(minh)).won).toBe(0);
  });

  it('records settles of the same matchId at the same time once', async () => {
    const { lan, minh } = await twoPlayers(s);
    const game = finished([
      { id: lan, place: 1 },
      { id: minh, place: 1 },
    ]);

    const settled = await Promise.all([s.results.settle(game), s.results.settle(game)]);

    expect(settled.sort()).toEqual([false, true]);
    expect(await s.matches.recent(lan)).toHaveLength(1);
    expect((await s.matches.recent(lan))[0]?.outcome).toBe('draw');
    expect(await s.stats.playerStats(lan)).toMatchObject({ played: 1, won: 0 });
  });

  it('counts stats for a player who left, with no win', async () => {
    const { lan, minh } = await twoPlayers(s);

    await s.results.settle(
      finished([
        { id: lan, place: 2, left: true },
        { id: minh, place: 1 },
      ]),
    );

    const [record] = await s.matches.recent(lan);
    expect(record?.outcome).toBe('loss');
    expect(record?.players[0]).toMatchObject({ left: true, me: true });
    expect(await s.stats.playerStats(lan)).toMatchObject({ played: 1, won: 0 });
  });
}

describe('ResultsService in memory', () => {
  settleSuite(async () => ({ db: null }));
});

describe.skipIf(!TEST_DATABASE_URL)('ResultsService on Postgres', () => {
  settleSuite(freshDb);

  it('writes nothing when part of the settle fails, so a later settle still records', async () => {
    const { db, drop } = await freshDb();
    try {
      const s = services(db);
      const { lan } = await twoPlayers(s);
      const matchId = randomUUID();
      const ghost = randomUUID();

      await expect(
        s.results.settle(
          finished(
            [
              { id: lan, place: 1 },
              { id: ghost, place: 2 },
            ],
            matchId,
          ),
        ),
      ).rejects.toThrow();
      expect(await s.matches.recent(lan)).toEqual([]);
      expect((await s.stats.playerStats(lan)).played).toBe(0);

      const { minh } = await twoPlayers(s);
      const game = finished(
        [
          { id: lan, place: 1 },
          { id: minh, place: 2 },
        ],
        matchId,
      );
      expect(await s.results.settle(game)).toBe(true);
      expect(await s.matches.recent(lan)).toHaveLength(1);
    } finally {
      await drop();
    }
  });
});
