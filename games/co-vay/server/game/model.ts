/** The game's data: what a Match remembers (State) and the Room's options. */
import type { ManifestOptions, PlayerId } from '@xomdao/sdk';
import type manifest from '../../manifest.js';

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export type Stone = typeof BLACK | typeof WHITE;
export type Cell = typeof EMPTY | Stone;

/** Lines each way: only the standard 19×19 board. */
export const SIZE = 19;

/** Points White gets for moving second (area scoring: the half point rules out a draw). */
export const KOMI = 7.5;

export interface Point {
  x: number;
  y: number;
}

/** The last move, for the board to mark: a stone, a pass, or nothing yet. */
export type Last = (Point & { stone: Stone; captured: number }) | { pass: Stone } | null;

/**
 * `play`: stones go down in turn. Two passes in a row lead to `score`: the players agree which
 * stones are dead (both press Đồng ý), or play on. `over` once the Match has ended.
 */
export type Phase = 'play' | 'score' | 'over';

/** The count at the end: area (stones and the empty points each side surrounds) plus komi. */
export interface Count {
  black: number;
  white: number;
  /** The empty points that belong to each side, by index. */
  territory: number[];
}

/** One Match of Cờ Vây, the same for every viewer (nothing is hidden). */
export interface State {
  size: number;
  /** size × size points, row by row from the top. */
  board: Cell[];
  /** players[0] plays Black (moves first), players[1] White. */
  players: [PlayerId, PlayerId];
  turn: PlayerId;
  phase: Phase;
  last: Last;
  /** Passes in a row. */
  passes: number;
  /** Stones each player has captured. */
  captures: Record<PlayerId, number>;
  /** Moves made, passes included. */
  moves: number;
  /** Hashes of every position so far: a move may not repeat one (superko). */
  seen: number[];
  /** While scoring: points whose stones are taken off as dead. */
  dead: number[];
  /** While scoring: who agreed to `dead` as it is. */
  agreed: PlayerId[];
  /** Set once the Match ends by counting. */
  count: Count | null;
  winner: PlayerId | null;
  /** How it ended: counted, or one side resigned or left. */
  ending: 'count' | 'resign' | 'leave' | null;
  /** Matches each player won in this Room since the seats last changed, this one included. */
  wins: Record<PlayerId, number>;
}

export type Options = ManifestOptions<typeof manifest>;
export type BotLevel = Options['level'];
