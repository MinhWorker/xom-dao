import { XP_PER_GAME } from '@xomdao/shared';
import { describe, expect, it } from 'vitest';
import { AccountsService } from '../accounts/accounts.service.js';
import { MemoryAccountsStore } from '../accounts/accounts.store.js';
import type { FinishedGame } from '../rooms/rooms.service.js';
import { StatsService } from './stats.service.js';
import { MemoryStatsStore } from './stats.store.js';

async function setup(names: string[]) {
  const accounts = new AccountsService(new MemoryAccountsStore());
  const stats = new StatsService(new MemoryStatsStore(), accounts);
  const ids: string[] = [];
  for (const name of names) ids.push((await accounts.guest(name)).user.id);
  return { stats, ids };
}

let matches = 0;
/** A finished game of `gameId` between `players` (and a bot), won by `winner`. */
const game = (
  gameId: string,
  players: string[],
  winner: string | null,
  stats: FinishedGame['result']['stats'] = [],
): FinishedGame => ({
  gameId,
  matchId: `m${++matches}`,
  startedAt: 0,
  endedAt: 0,
  seats: [
    ...players.map((id) => ({ id, name: id, bot: false, left: false })),
    { id: 'bot', name: 'Máy', bot: true, left: false },
  ],
  result: { winners: winner ? [winner] : [], stats },
});

describe('Thống kê, xếp hạng', () => {
  it('counts each game once, for people only, with experience', async () => {
    const { stats, ids } = await setup(['Lan']);
    const [lan] = ids as [string];
    const once = game('tic-tac-toe', [lan], lan);
    await stats.recordMatch(once);
    await stats.recordMatch(once);
    await stats.recordMatch(game('tic-tac-toe', [lan], 'bot'));
    const mine = await stats.playerStats(lan);
    expect(mine).toMatchObject({ played: 2, won: 1, level: 1 });
    expect(mine.xp).toBe(2 * XP_PER_GAME);
    await expect(stats.playerStats('bot')).rejects.toThrow('Không tìm thấy');
  });

  it('ranks everyone by experience and each game by wins, after many games', async () => {
    const { stats, ids } = await setup(['An', 'Bình', 'Chi', 'Dũng']);
    const [an, binh, chi, dung] = ids as [string, string, string, string];
    // Caro: Bình wins 3, An and Chi 2, Dũng none.
    const caro: [string, string, string | null][] = [
      [an, binh, binh],
      [binh, chi, binh],
      [an, chi, an],
      [binh, dung, binh],
      [an, dung, an],
      [chi, dung, chi],
      [chi, an, chi],
      [dung, an, null],
    ];
    for (const [a, b, winner] of caro) await stats.recordMatch(game('tic-tac-toe', [a, b], winner));
    // Dũng plays Tiến Lên a lot without winning: the most experience.
    for (let i = 0; i < 6; i++) await stats.recordMatch(game('tien-len', [dung], null));

    const board = await stats.ranking('tic-tac-toe', dung);
    expect(board.entries[0]).toMatchObject({ id: binh, value: 3, rank: 1 });
    // A tie shares its rank, in account id order.
    expect(board.entries.slice(1).map((e) => [e.id, e.value, e.rank])).toEqual(
      [an, chi].sort().map((id) => [id, 2, 2]),
    );
    // Not on the board: no wins.
    expect(board.me).toBeNull();

    const everyone = await stats.ranking('core', chi);
    expect(everyone.entries.map((e) => [e.id, e.value])).toEqual([
      [dung, 10 * XP_PER_GAME],
      [an, 5 * XP_PER_GAME],
      [chi, 4 * XP_PER_GAME],
      [binh, 3 * XP_PER_GAME],
    ]);
    expect(everyone.me).toMatchObject({ id: chi, rank: 3 });

    const mine = await stats.playerStats(an);
    expect(mine.ranks).toEqual([
      { board: 'core', value: 5 * XP_PER_GAME, rank: 2 },
      { board: 'tic-tac-toe', value: 2, rank: 2 },
    ]);
    await expect(stats.ranking('dua-xe', an)).rejects.toThrow('Không có bảng');
  });
});
