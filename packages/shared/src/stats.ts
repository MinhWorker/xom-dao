/**
 * Levels and rankings, as data. Experience (`xp`) is what levels go by: `XP_PER_GAME` for each
 * game played. It is kept as earned, so changing these numbers later does not change what
 * players already have.
 */

/** Experience for every finished game (bots excepted). */
export const XP_PER_GAME = 10;

/** The experience a level starts at: 0, 100, 300, 600, 1000… (each level 100 more than the last). */
export function levelStart(level: number): number {
  return 50 * level * (level - 1);
}

/** The level `xp` experience is at (1 and up), and where it started and the next one starts. */
export function levelOf(xp: number): { level: number; levelXp: number; nextXp: number } {
  let level = 1;
  while (levelStart(level + 1) <= xp) level++;
  return { level, levelXp: levelStart(level), nextXp: levelStart(level + 1) };
}

/** How many players a ranking shows. */
export const RANKING_LIMIT = 20;
/** The board of everyone, by experience; every other board is a game's id, by wins. */
export const CORE_BOARD = 'core';
