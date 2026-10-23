import { Inject, Injectable } from '@nestjs/common';
import {
  COIN,
  dayOf,
  getGame,
  type QuestBoard,
  type QuestDef,
  questsOf,
  untilNextDay,
} from '@xomdao/shared';
import { EventClock } from '../events/event-clock.js';
import { LedgerService } from '../ledger/ledger.service.js';
import type { FinishedGame } from '../rooms/rooms.service.js';
import type { QuestsStore } from './quests.store.js';

export const QUESTS_STORE = Symbol('QUESTS_STORE');

/** A refusal the player reads (in Vietnamese). */
export class QuestsError extends Error {}

/**
 * Nhiệm vụ hằng ngày (docs/adr/0002-modules.md). It owns `quest_progress`. Finished games
 * (`RoomsService.onFinished`, wired by the rooms gateway) count towards the day's quests
 * (`questsOf`) for the people who played them; a finished quest's reward is paid through the
 * ledger, keyed `quest:<user>:<day>:<quest>` so it pays once. The day goes by `EventClock`, so
 * `dev:clock` moves it too.
 */
@Injectable()
export class QuestsService {
  constructor(
    @Inject(QUESTS_STORE) private readonly store: QuestsStore,
    private readonly ledger: LedgerService,
    private readonly clock: EventClock,
  ) {}

  /** Counts a finished game towards today's quests of everyone (not the computer) who played. */
  async recordMatch({ gameId, seats, result }: FinishedGame): Promise<void> {
    const day = dayOf(this.clock.now());
    const people = seats.filter((s) => !s.bot);
    const genre = getGame(gameId)?.genre;
    for (const seat of people) {
      for (const quest of questsOf(day)) {
        const counts = this.counts(quest, {
          won: result.winners.includes(seat.id),
          genre,
          people: people.length,
        });
        if (counts) await this.store.add(seat.id, day, quest.id, 1, quest.goal);
      }
    }
  }

  private counts(quest: QuestDef, game: { won: boolean; genre?: string; people: number }) {
    switch (quest.kind) {
      case 'played':
        return true;
      case 'won':
        return game.won;
      case 'genre':
        return game.genre === quest.genre;
      case 'people':
        return game.people >= 2;
      default:
        return false;
    }
  }

  /** Today's quests with the account's progress (Điểm danh is done just by coming). */
  async board(userId: string): Promise<QuestBoard> {
    const now = this.clock.now();
    const day = dayOf(now);
    const rows = new Map((await this.store.rows(userId, day)).map((r) => [r.questId, r]));
    return {
      day,
      endsIn: untilNextDay(now),
      quests: questsOf(day).map((quest) => {
        const row = rows.get(quest.id);
        return {
          id: quest.id,
          title: quest.title,
          goal: quest.goal,
          progress: quest.kind === 'checkin' ? quest.goal : Math.min(row?.count ?? 0, quest.goal),
          reward: quest.reward,
          claimed: row?.claimed ?? false,
        };
      }),
    };
  }

  /** Pays a finished quest's reward, once. */
  async claim(userId: string, questId: string) {
    const before = await this.board(userId);
    const quest = before.quests.find((q) => q.id === questId);
    if (!quest) throw new QuestsError('Không có nhiệm vụ này hôm nay');
    if (quest.claimed) throw new QuestsError('Bạn đã nhận rồi');
    if (quest.progress < quest.goal) throw new QuestsError('Chưa xong nhiệm vụ');
    if (!(await this.store.claim(userId, before.day, questId))) {
      throw new QuestsError('Bạn đã nhận rồi');
    }
    await this.ledger.apply({
      userId,
      resource: COIN,
      amount: quest.reward,
      reason: `quest:${questId}`,
      key: `quest:${userId}:${before.day}:${questId}`,
    });
    return { board: await this.board(userId), balances: await this.ledger.balances(userId) };
  }
}
