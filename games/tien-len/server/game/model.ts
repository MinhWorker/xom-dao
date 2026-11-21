/**
 * What Tiến Lên remembers and what a Room picks. Read this first; the logic is TienLenGame.ts.
 *
 * A Match is several rounds ("vòng"). Each round deals 13 cards to every seat and ends when all
 * of them are ranked; ranks give points, and the most points after the last round wins. A round
 * is played in tricks: a trick ends when everyone else passes on the last play. A seat whose
 * person left is played by the computer, so every seat plays every round.
 */
import type { ManifestOptions } from '@xomdao/sdk';
import type manifest from '../../manifest.js';
import type { Card, Kind } from './cards.js';

/**
 * The deal on screen (ms): the shuffle, then one card every `stepMs`, each flying `flyMs`, then
 * the hand turns face up in `flipMs`. The Game needs it too: play starts after the deal.
 */
export const DEAL = { shuffleMs: 760, stepMs: 28, flyMs: 240, flipMs: 220 };
/** How long dealing `cards` cards takes on screen, start to hands face up. */
export const dealMs = (cards: number) =>
  DEAL.shuffleMs + cards * DEAL.stepMs + DEAL.flyMs + DEAL.flipMs;
/** After the deal: "Vòng 2" in big letters, then "Lan đi trước". */
export const INTRO = { roundMs: 1200, leadMs: 1200 };
/** The round's ranking stays up this long before the next deal. */
export const ROUND_OVER_MS = 5000;
/** The turn clock (ms), when two or more people play (a table with one person has none). */
export const TURN_MS = 20_000;

/** Cards someone put on the table. */
export interface Play {
  seat: number;
  cards: Card[];
  kind: Kind;
  /** The trick it was played in (older tricks lie under the current one). */
  trick: number;
}

/** How a round ended. */
export interface RoundResult {
  /** Seats best first. */
  order: number[];
  /** Points each seat got in this round. */
  points: number[];
  /**
   * Who was still holding cards when the round ended, and those cards: last with 2s in hand is
   * "thối heo".
   */
  holder: number | null;
  leftover: Card[];
}

/**
 * deal: the cards are flying out and the round is announced (no moves yet);
 * play: the round is on; over: its ranking is shown until the next deal (or the Match ends).
 */
export type Phase = 'deal' | 'play' | 'over';

/** Everything about a Match in progress (on the server). */
export interface State {
  /** The round being played, from 1. */
  round: number;
  /** Rounds in the Match (from the options). */
  rounds: number;
  phase: Phase;
  /** Each seat's cards, sorted weakest first. */
  hands: Card[][];
  /** Who leads this round. */
  lead: number;
  /** What must be beaten now; `null` when the turn player starts a new trick. */
  table: Play | null;
  /** Every play of this round in order: the messy pile in the middle. */
  played: Play[];
  /** Tricks so far in this round. */
  trick: number;
  /** Whose turn it is (a seat). */
  turn: number;
  /** Who passed in this trick (they sit out until the next trick). */
  passed: boolean[];
  /** The Match's first play must include this card (the lowest one dealt). */
  mustPlay: Card | null;
  /** Seats that emptied their hand this round, best first. */
  out: number[];
  /** Match points per seat. */
  points: number[];
  /** Rounds won per seat (breaks ties on points). */
  firsts: number[];
  results: RoundResult[];
}

/** What one player sees: their own hand, only the size of the others'. */
export interface View extends Omit<State, 'hands'> {
  /** This player's cards (empty for a spectator). */
  hand: Card[];
  /** How many cards each seat holds. */
  counts: number[];
}

/** Picked in the waiting room: how many rounds. */
export type Options = ManifestOptions<typeof manifest>;
