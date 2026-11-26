/** The game's data: what a Match remembers (State) and the Room's options. */
import type { ManifestOptions, PlayerId } from '@xomdao/sdk';
import type manifest from '../../manifest.js';

/** The last move, for the board to mark and the sounds to play. */
export interface LastMove {
  /** Points 0..89, row by row from the top (Black's back row). */
  from: number;
  to: number;
  /** The piece taken, as its letter. */
  taken: string | null;
  check: boolean;
}

export type Ending =
  | 'checkmate'
  | 'stalemate'
  | 'perpetual'
  | 'repetition'
  | 'quiet'
  | 'material'
  | 'agreement'
  | 'resign'
  | 'leave';

/** One Match of Cờ Tướng, the same for every viewer (nothing is hidden). */
export interface State {
  /** 90 characters, row by row from the top: `.` empty, `KABNRCP` Red, `kabnrcp` Black. */
  board: string;
  /** players[0] plays Red (moves first), players[1] Black. */
  players: [PlayerId, PlayerId];
  turn: PlayerId;
  /** Moves made so far. */
  ply: number;
  /** Moves since the last capture. */
  quiet: number;
  /** Repetition keys of every position so far, and whether the move into it gave check. */
  keys: number[];
  checks: boolean[];
  last: LastMove | null;
  /** Who offered a draw that the other player has not answered yet. */
  offer: PlayerId | null;
  phase: 'play' | 'over';
  /** `null` with an ending: a draw. */
  winner: PlayerId | null;
  ending: Ending | null;
  /** Matches each player won in this Room since the seats last changed, this one included. */
  wins: Record<PlayerId, number>;
}

export type Options = ManifestOptions<typeof manifest>;
export type BotLevel = Options['level'];
