/** The game's data: what a Match remembers (State) and the Room's options. */
import type { ManifestOptions, PlayerId } from '@xomdao/sdk';
import type manifest from '../../manifest.js';

/** The last move, for the board to mark and the sounds to play. */
export interface LastMove {
  /** Squares 0..63, row by row from the top (a8 is 0, h1 is 63). */
  from: number;
  to: number;
  san: string;
  capture: boolean;
  check: boolean;
  /** For castling: where the rook went. */
  rook?: { from: number; to: number };
}

export type Ending =
  | 'checkmate'
  | 'stalemate'
  | 'repetition'
  | 'fifty'
  | 'material'
  | 'agreement'
  | 'resign'
  | 'leave';

/** One Match of Cờ Vua, the same for every viewer (nothing is hidden). */
export interface State {
  /** 64 characters, row by row from the top: `.` empty, `PNBRQK` White, `pnbrqk` Black. */
  board: string;
  /** players[0] plays White (moves first), players[1] Black. */
  players: [PlayerId, PlayerId];
  turn: PlayerId;
  castling: string;
  /** The en passant square (0..63), or -1. */
  ep: number;
  /** Half-moves since the last capture or pawn move (the fifty-move rule). */
  half: number;
  full: number;
  /** Repetition keys of every position so far. */
  keys: number[];
  /** The moves so far in standard notation. */
  sans: string[];
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
