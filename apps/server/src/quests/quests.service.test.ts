import { CHECKIN, COIN, dayOf, questsOf, untilNextDay } from '@xomdao/shared';
import { describe, expect, it } from 'vitest';
import { EventClock } from '../events/event-clock.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MemoryLedgerStore } from '../ledger/ledger.store.js';
import type { FinishedGame } from '../rooms/rooms.service.js';
import { QuestsService } from './quests.service.js';
import { MemoryQuestsStore } from './quests.store.js';

function setup(at = '2026-10-23T03:00:00.000Z') {
  const clock = new EventClock();
  clock.set(at);
  const ledger = new LedgerService(new MemoryLedgerStore());
  const quests = new QuestsService(new MemoryQuestsStore(), ledger, clock);
  return { clock, ledger, quests };
}

const game = (
  gameId: string,
  people: string[],
  winners: string[],
  bots = 0,
  matchId = crypto.randomUUID(),
): FinishedGame => ({
  gameId,
  matchId,
  startedAt: 0,
  endedAt: 1,
  seats: [
    ...people.map((id) => ({ id, name: id, bot: false, left: false })),
    ...Array.from({ length: bots }, (_, i) => ({
      id: `bot:${i}`,
      name: 'Máy',
      bot: true,
      left: false,
    })),
  ],
  result: { winners, rewards: [] },
});

describe('Nhiệm vụ hằng ngày', () => {
  it('draws Điểm danh and three quests of different kinds for each Vietnam day', () => {
    expect(dayOf(Date.parse('2026-10-22T17:30:00.000Z'))).toBe('2026-10-23');
    expect(untilNextDay(Date.parse('2026-10-23T16:00:00.000Z'))).toBe(60 * 60 * 1000);
    for (const day of ['2026-10-23', '2026-10-24', '2026-12-31', '2027-01-01']) {
      const quests = questsOf(day);
      expect(quests[0]).toBe(CHECKIN);
      expect(quests).toHaveLength(4);
      const kinds = quests.map((q) => `${q.kind}${q.genre ?? ''}`);
      expect(new Set(kinds).size).toBe(4);
      expect(questsOf(day)).toEqual(quests);
    }
  });

  it('counts finished games for people, pays a done quest once', async () => {
    const { quests, ledger, clock } = setup();
    const day = dayOf(clock.now());
    const today = questsOf(day);
    for (let i = 0; i < 6; i++) {
      await quests.recordMatch(game('tien-len', ['lan', 'minh'], ['lan']));
      await quests.recordMatch(game('xiangqi', ['lan', 'minh'], ['lan']));
    }
    const board = await quests.board('lan');
    expect(board.day).toBe(day);
    for (const quest of board.quests) expect(quest.progress).toBe(quest.goal);
    const checkin = await quests.claim('lan', 'diem-danh');
    expect(checkin.balances[COIN]).toBe(CHECKIN.reward);
    await expect(quests.claim('lan', 'diem-danh')).rejects.toThrow('đã nhận');
    const won = today.find((q) => q.kind === 'won');
    const minh = await quests.board('minh');
    if (won) expect(minh.quests.find((q) => q.id === won.id)?.progress).toBe(0);
    expect(await ledger.balances('minh')).toEqual({});
  });

  it('refuses an unfinished quest and leaves the computer out', async () => {
    const { quests } = setup();
    await quests.recordMatch(game('tien-len', [], [], 3));
    const board = await quests.board('lan');
    const unfinished = board.quests.find((q) => q.progress < q.goal);
    expect(unfinished).toBeDefined();
    await expect(quests.claim('lan', unfinished?.id ?? '')).rejects.toThrow('Chưa xong');
    await expect(quests.claim('lan', 'khong-co')).rejects.toThrow('Không có nhiệm vụ');
  });

  it('starts again the next day', async () => {
    const { quests, clock } = setup('2026-10-23T16:59:00.000Z');
    await quests.recordMatch(game('tien-len', ['lan'], ['lan'], 1));
    const before = await quests.board('lan');
    clock.set('2026-10-23T17:01:00.000Z');
    const after = await quests.board('lan');
    expect(after.day).not.toBe(before.day);
    expect(after.quests.filter((q) => q.id !== CHECKIN.id && q.progress > 0)).toEqual([]);
  });
});
