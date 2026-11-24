/**
 * What Cờ Tỷ Phú remembers. Read this first; the turn's logic is CoTyPhuGame.ts and the money
 * in economy.ts. Words follow games/co-ty-phu/GLOSSARY.md.
 *
 * A turn is a roll, the move, then what the Tile offers. An offer the player may take (buy,
 * upgrade, Takeover, a flight) is a decision with a clock; everything else (rent, tax, jail)
 * happens at once, unless the payer's cash is short: then it is a Debt, settled by Selling
 * (selling.ts) or ending in Bankruptcy. Cơ hội and Khí vận draw a Card (cards.ts), which may
 * ask the drawer to pick, start a Quiz (quiz.ts), mark a Lot or give an Effect. Doubles roll
 * again; the Match goes on until one player is not bankrupt.
 */
import type { ManifestOptions } from '@xomdao/sdk';
import type manifest from '../../manifest.js';
import type { CardId } from './cards.js';
import type { Quiz } from './quiz.js';

/** The decision clock per "Tốc độ" (ms). */
export const CLOCK_MS = { normal: 15_000, fast: 10_000 } as const;
/** How long the drawer has to answer a Quiz (ms). */
export const QUIZ_MS = 20_000;
/** A player holds at most this many Effects; a new one drops the oldest. */
export const MAX_EFFECTS = 2;

/** A jailed player rolls this many times at most; the last roll lets them out anyway. */
export const JAIL_TRIES = 3;
/** Rolling doubles this many times in one turn sends the player to jail. */
export const DOUBLES_TO_JAIL = 3;
export const HOTEL = 5;

export interface Player {
  cash: number;
  tile: number;
  jailed: boolean;
  /** Rolls tried in jail so far. */
  jailTries: number;
  /** Jail-free Cards held. */
  jailCards: number;
  bankrupt: boolean;
  effects: Effect[];
}

/**
 * lucky (Thần tài): rent collected ×2; traffic (Kẹt xe): one die; exempt (Miễn thuê): the next
 * rent is free, once, however long that takes; sick (Ốm): the next turn is skipped; startup (Khởi nghiệp): Levels at a
 * discount.
 */
export type EffectId = 'lucky' | 'traffic' | 'exempt' | 'sick' | 'startup';

export interface Effect {
  id: EffectId;
  /** The holder's turns left, counted down at the end of each (Miễn thuê: always 1). */
  turns: number;
  /** Gained in the holder's current turn, which does not count. */
  fresh: boolean;
}

export type Deck = 'chance' | 'chest';

/** The last Card drawn, by `seat`; `draw` counts the draws of the Match, from 1. */
export interface Drawn {
  id: CardId;
  seat: number;
  draw: number;
}

/** A Quiz `seat` took on; `picked` is their answer, `null` until then or when time ran out. */
export interface QuizState extends Quiz {
  seat: number;
  picked: number | null;
}

/** An owned Lot. A station or utility stays at Level 0. */
export interface Lot {
  owner: number;
  level: number;
  /** What was paid for its Levels after the first (which came with the City). */
  built: number;
}

/**
 * roll: the turn player rolls (or, in jail, pays or uses a Card first);
 * buy / upgrade / takeover / fly: the turn player takes or passes the offer of their Tile;
 * debt: the debtor picks what to Sell;
 * card: the turn player picks for the Card they drew; quiz: they answer the Quiz.
 */
export type Phase = 'roll' | 'buy' | 'upgrade' | 'takeover' | 'fly' | 'debt' | 'card' | 'quiz';

/** One part of a sale to the bank: `levels` Levels off a City, or the whole Lot without it. */
export interface Sale {
  tile: number;
  levels?: number;
}

/** A payment waiting until `from` Sells enough; `to` is the creditor (`null` = the bank). */
export interface Debt {
  from: number;
  to: number | null;
  amount: number;
  /** The sale the server suggests: the least lost that covers `amount`. */
  suggested: Sale[];
}

export interface State {
  /** The Room's "Tốc độ", which the client also plays its moves by. */
  speed: Options['speed'];
  players: Player[];
  /** Per Tile: its owner and Level, `null` while nobody owns it (or it is no Lot). */
  lots: (Lot | null)[];
  turn: number;
  phase: Phase;
  /** The last roll: two dice, or one under Kẹt xe. */
  dice: number[] | null;
  /** Rolls so far in the Match. */
  rolls: number;
  /** Doubles rolled in this turn. */
  doubles: number;
  /** The turn player rolls again once the current offer is settled. */
  again: boolean;
  /** Seats in the order they went bankrupt. */
  bankrupt: number[];
  /** Set while the phase is `debt`. */
  debt: Debt | null;
  /** Each deck's draw pile, top first; a drawn Card goes to the bottom, a kept one leaves. */
  decks: Record<Deck, CardId[]>;
  /** The last Card drawn; the phase is `card` while it waits for a pick. */
  card: Drawn | null;
  /** The last Quiz; the phase is `quiz` while it waits for the answer. */
  quiz: QuizState | null;
  /** The Lot holding the Festival. */
  festival: number | null;
  /** A Lot charging no rent until the turn of `by` comes again. */
  blackout: { tile: number; by: number } | null;
  /** The only person at a table of computers paused: no clock, the computer waits. */
  paused: boolean;
}

/** What prices and rents depend on: a `State` or a `View`. */
export type BoardState = Pick<State, 'players' | 'lots' | 'festival' | 'blackout'>;

/** What a player sees: the piles' sizes, and no answer while the Quiz runs. */
export interface View extends Omit<State, 'decks' | 'quiz'> {
  decks: Record<Deck, number>;
  quiz: (Omit<QuizState, 'answer'> & { answer: number | null }) | null;
}

/** Picked in the waiting room: "Tốc độ". */
export type Options = ManifestOptions<typeof manifest>;
