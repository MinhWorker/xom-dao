import { describe, expect, it } from 'vitest';
import { ago, boardLabel, boardUnit, levelProgress, winPercent } from './format.js';

describe('levelProgress', () => {
  it('measures experience inside the level', () => {
    expect(levelProgress({ xp: 150, levelXp: 100, nextXp: 300 })).toBe(0.25);
    expect(levelProgress({ xp: 0, levelXp: 0, nextXp: 100 })).toBe(0);
    expect(levelProgress({ xp: 500, levelXp: 100, nextXp: 300 })).toBe(1);
    expect(levelProgress({ xp: 5, levelXp: 5, nextXp: 5 })).toBe(1);
  });
});

describe('winPercent', () => {
  it('rounds and survives no games', () => {
    expect(winPercent({ played: 3, won: 1 })).toBe(33);
    expect(winPercent({ played: 0, won: 0 })).toBe(0);
  });
});

describe('boards', () => {
  it('names the overall board and each Game', () => {
    expect(boardLabel('core')).toBe('Chung');
    expect(boardLabel('tien-len', 'Tiến Lên')).toBe('Tiến Lên');
    expect(boardLabel('tien-len')).toBe('tien-len');
    expect(boardUnit('core')).toBe('KN');
    expect(boardUnit('tien-len')).toBe('thắng');
  });
});

describe('ago', () => {
  const now = Date.UTC(2026, 10, 21, 12, 0, 0);
  it('counts back in the largest whole unit', () => {
    expect(ago(now - 5_000, now)).toBe('Vừa xong');
    expect(ago(now + 5_000, now)).toBe('Vừa xong');
    expect(ago(now - 5 * 60_000, now)).toBe('5 phút trước');
    expect(ago(now - 3 * 3_600_000, now)).toBe('3 giờ trước');
    expect(ago(now - 2 * 86_400_000, now)).toBe('2 ngày trước');
  });

  it('falls back to the date after a week', () => {
    expect(ago(now - 10 * 86_400_000, now)).toMatch(/2026/);
  });
});
