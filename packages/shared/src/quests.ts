/**
 * Nhiệm vụ hằng ngày: the day's quests, the same for everyone. Each day (Vietnam time) has
 * Điểm danh (just come by) and three quests drawn from `QUEST_POOL` by the date, so they change
 * every midnight. A quest counts finished games you played (bots never count) and pays its
 * reward in coins once it is done and claimed.
 */

/** What a quest counts. */
export type QuestKind = 'checkin' | 'played' | 'won' | 'genre' | 'people';

export interface QuestDef {
  id: string;
  /** Vietnamese, short: "Chơi 3 ván". */
  title: string;
  goal: number;
  /** Coins (`core:coin`). */
  reward: number;
  kind: QuestKind;
  /** For `genre`: the genre's id (`co`, `bai`). */
  genre?: string;
}

/** Come by once a day. */
export const CHECKIN: QuestDef = {
  id: 'diem-danh',
  title: 'Điểm danh',
  goal: 1,
  reward: 20,
  kind: 'checkin',
};

export const QUEST_POOL: readonly QuestDef[] = [
  { id: 'choi-3', title: 'Chơi 3 ván', goal: 3, reward: 30, kind: 'played' },
  { id: 'choi-5', title: 'Chơi 5 ván', goal: 5, reward: 60, kind: 'played' },
  { id: 'thang-1', title: 'Thắng 1 ván', goal: 1, reward: 40, kind: 'won' },
  { id: 'thang-3', title: 'Thắng 3 ván', goal: 3, reward: 90, kind: 'won' },
  { id: 'bai-2', title: 'Chơi 2 ván bài', goal: 2, reward: 30, kind: 'genre', genre: 'bai' },
  { id: 'co-2', title: 'Chơi 2 ván cờ', goal: 2, reward: 30, kind: 'genre', genre: 'co' },
  { id: 'nguoi-1', title: 'Chơi 1 ván với người thật', goal: 1, reward: 50, kind: 'people' },
];

/** How many quests a day draws from the pool (Điểm danh comes on top). */
export const QUESTS_PER_DAY = 3;

/** Vietnam is UTC+7 all year. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The day `at` (ms) falls on in Vietnam: "2026-10-23". */
export function dayOf(at: number): string {
  return new Date(at + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Milliseconds from `at` to the next midnight in Vietnam. */
export function untilNextDay(at: number): number {
  return DAY_MS - ((at + VN_OFFSET_MS) % DAY_MS);
}

/** The day's quests: Điểm danh, then `QUESTS_PER_DAY` from the pool, picked by the date. */
export function questsOf(day: string): QuestDef[] {
  let seed = 0;
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...QUEST_POOL];
  const picked: QuestDef[] = [];
  while (picked.length < QUESTS_PER_DAY && pool.length) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const [quest] = pool.splice(seed % pool.length, 1);
    // One quest per kind of count a day, so two never finish together.
    if (quest && !picked.some((p) => p.kind === quest.kind && p.genre === quest.genre)) {
      picked.push(quest);
    }
  }
  return [CHECKIN, ...picked];
}
