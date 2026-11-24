/**
 * What Cờ Tỷ Phú remembers. Read this first; the turn's logic is CoTyPhuGame.ts and the money
 * in economy.ts. Words follow games/co-ty-phu/GLOSSARY.md.
 *
 * A turn is a roll, the move, then what the Tile offers. An offer the player may take (buy,
 * upgrade, Takeover, a flight) is a decision with a clock; everything else (rent, tax, jail)
 * happens at once, unless the payer's cash is short: then it is a Debt, settled by Selling
 * (selling.ts) or ending in Bankruptcy. Doubles roll again; the Match goes on until one player
 * is not bankrupt.
 */
import type { ManifestOptions } from '@xomdao/sdk';
import type manifest from '../../manifest.js';

/** The decision clock per "Tốc độ" (ms). */
export const CLOCK_MS = { normal: 15_000, fast: 10_000 } as const;

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
 * debt: the debtor picks what to Sell.
 */
export type Phase = 'roll' | 'buy' | 'upgrade' | 'takeover' | 'fly' | 'debt';

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
  players: Player[];
  /** Per Tile: its owner and Level, `null` while nobody owns it (or it is no Lot). */
  lots: (Lot | null)[];
  turn: number;
  phase: Phase;
  /** The last roll. */
  dice: [number, number] | null;
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
}

/** Picked in the waiting room: "Tốc độ". */
export type Options = ManifestOptions<typeof manifest>;
