/** The game's data: what a Match remembers (State), a player's input and the Room's options. */
import type { ManifestOptions } from '@xomdao/sdk';
import { z } from 'zod';
import type manifest from '../../manifest.js';

export const TICK_RATE = 20;
export const SNAPSHOT_RATE = 10;

/** Cells across and down the arena. */
export const COLS = 11;
export const ROWS = 9;

/** Ticks before anyone may move or place a bomb (3 s). */
export const COUNTDOWN_TICKS = 3 * TICK_RATE;
/** Ticks the fight lasts at most (3 min), counted from the end of the countdown. */
export const MATCH_TICKS = 3 * 60 * TICK_RATE;

/** Cells a player crosses per tick (3.2 per second). */
export const STEP = 3.2 / TICK_RATE;
export const MAX_HP = 100;
export const BOMB_DAMAGE = 35;
/** Ticks a hit player cannot be hurt again (0.7 s). */
export const GUARD_TICKS = 14;
/** Ticks from placing a bomb to its explosion (2.5 s). */
export const FUSE_TICKS = 50;
/** Ticks an explosion stays and hurts (0.65 s). */
export const BLAST_TICKS = 13;
/** Cells a blast reaches in each direction. */
export const RANGE = 2;
/** Bombs one player may have on the arena at once. */
export const MAX_BOMBS = 2;

export const DIRS = ['none', 'up', 'down', 'left', 'right'] as const;
export type Dir = (typeof DIRS)[number];

/** What a player sends: the direction held now, and `bomb` once to place a bomb where they stand. */
export const inputSchema = z.object({ move: z.enum(DIRS), bomb: z.boolean().optional() });
export type Input = z.infer<typeof inputSchema>;

export type Options = ManifestOptions<typeof manifest>;
export type BotLevel = Options['level'];

/** An arena cell: `#` a stone pillar, `c` a crate, `.` empty floor. */
export type Tile = '#' | 'c' | '.';

/** A cell by its column and row; (0, 0) is the top-left cell. */
export interface Cell {
  x: number;
  y: number;
}

/** One player. `x` and `y` are in cells: a cell's centre is at its index + 0.5. */
export interface Player {
  seat: number;
  x: number;
  y: number;
  hp: number;
  /** The direction held now. */
  move: Dir;
  /** Ticks left of the protection after a hit. */
  guard: number;
  /** The tick count at which the player was knocked out; `null` while standing. */
  out: number | null;
}

/** A bomb on the floor. */
export interface Bomb {
  id: number;
  owner: number;
  x: number;
  y: number;
  /** Ticks until it explodes. */
  fuse: number;
  /** Seats still standing on it, who may walk off it; everyone else is blocked. */
  free: number[];
}

/** An explosion still burning. */
export interface Blast {
  cells: Cell[];
  /** Ticks left. */
  left: number;
}

/** One Match of Đặt Bom, the same for every viewer (nothing is hidden). */
export interface State {
  /** ROWS strings of COLS tiles. */
  rows: string[];
  /** In seat order. */
  players: Player[];
  bombs: Bomb[];
  blasts: Blast[];
  nextBombId: number;
}
