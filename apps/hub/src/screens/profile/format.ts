import { CORE_BOARD, type MatchRecord, type PlayerStats } from '@xomdao/shared/client';

/** How far through the current level the experience is, from 0 to 1. */
export function levelProgress(stats: Pick<PlayerStats, 'xp' | 'levelXp' | 'nextXp'>): number {
  const span = stats.nextXp - stats.levelXp;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (stats.xp - stats.levelXp) / span));
}

/** Wins over games played, in whole percent; 0 before the first game. */
export function winPercent(stats: Pick<PlayerStats, 'played' | 'won'>): number {
  return stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
}

export const OUTCOME_LABEL: Record<MatchRecord['outcome'], string> = {
  win: 'Thắng',
  loss: 'Thua',
  draw: 'Hoà',
};

/** The name a ranking board shows: the overall one, or its Game's. */
export function boardLabel(board: string, gameName?: string): string {
  return board === CORE_BOARD ? 'Chung' : (gameName ?? board);
}

/** What a board's number counts: experience overall, wins in a Game. */
export function boardUnit(board: string): string {
  return board === CORE_BOARD ? 'KN' : 'thắng';
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A moment as "5 phút trước"; older than a week is the date. */
export function ago(at: number, now: number): string {
  const diff = Math.max(0, now - at);
  if (diff < MINUTE) return 'Vừa xong';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} phút trước`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} giờ trước`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} ngày trước`;
  return new Date(at).toLocaleDateString('vi-VN');
}
