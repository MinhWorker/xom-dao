/** The game's data: what a Match remembers (State) and the Room's options. */
import type { ManifestOptions, PlayerId } from '@xomdao/sdk';
import type manifest from '../../manifest.js';

export type Mark = 'X' | 'O';
export type Cell = Mark | null;

/** Marks in a row that win. */
export const WIN = 5;
/** Cells per side of a new board. */
export const START_SIDE = 9;
/** Rows or columns a mark on an edge adds on that side. */
export const GROW = 3;
/** The board grows no wider and no taller than this (a 15×15 board at most). */
export const MAX_SIDE = 15;

/** A cell by its coordinates: x to the right, y down; (0, 0) is the new board's top-left cell. */
export interface Point {
  x: number;
  y: number;
}

/** The board as it is now: a rectangle of cells that grows as marks reach its edges. */
export interface Board {
  /** Coordinates of the top-left cell: 0, 0 on a new board, negative once it grew left or up. */
  left: number;
  top: number;
  cols: number;
  rows: number;
  /** rows × cols cells, row by row. */
  cells: Cell[];
}

/** One Match of Caro, the same for every viewer (nothing is hidden). */
export interface State {
  board: Board;
  /** players[0] is X (starts), players[1] is O. */
  players: [PlayerId, PlayerId];
  turn: PlayerId;
  /** The cell marked last, `null` before the first move. */
  last: Point | null;
  /** The five that won, `null` while playing or after a draw. */
  line: Point[] | null;
  /** Matches each player won in this Room since the seats last changed, this one included. */
  wins: Record<PlayerId, number>;
}

export type Options = ManifestOptions<typeof manifest>;
export type BotLevel = Options['level'];
