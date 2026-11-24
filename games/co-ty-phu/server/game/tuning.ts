/**
 * Every number the balance can be tuned with: prices, rents and fees. The legacy Classic table
 * is the starting point; City land prices are in board.ts and scaled by `cityPrice`, Card
 * amounts are in cards.ts.
 */
import type { EffectId } from './model.js';

export interface Tuning {
  startingCash: number;
  /** Paid for passing or landing on Xuất phát. */
  startBonus: number;
  /** Multiplies every City's land price from board.ts. */
  cityPrice: number;
  /** A City's rent at Level 1 to 5, as a share of its land price. */
  levelRent: readonly number[];
  /** What one Level costs to build, as a share of the land price (Level 1 comes with the City). */
  levelCost: number;
  /** Rent multiplier of a City in a Full set. */
  fullSet: number;
  /** A Takeover costs this × (land price + what was paid for its Levels). */
  takeover: number;
  stationPrice: number;
  /** A station's rent per station its owner has. */
  stationRent: number;
  utilityPrice: number;
  /** Rent per point of the dice: owner with one utility, with both. */
  utilityRent: readonly [number, number];
  /** What a flight from Sân bay costs. */
  airportFee: number;
  /** What paying out of jail costs. */
  jailFine: number;
  /** A tax is `max(min, floor(rate × cash))`. */
  taxes: Record<'income' | 'luxury', { min: number; rate: number }>;
  /** How many of the holder's turns each Effect lasts. */
  effects: Record<EffectId, number>;
  /** Rent multiplier of a Festival, and of Thần tài. */
  festivalRent: number;
  luckyRent: number;
  /** Khởi nghiệp's Levels cost this share of the price. */
  startupCost: number;
  /** The safe reward of a Quiz card, what a right answer multiplies it by, and how often the computer is right. */
  quiz: { safe: number; times: number; botRight: number };
}

export const TUNING: Tuning = {
  startingCash: 1000,
  startBonus: 200,
  cityPrice: 1,
  levelRent: [0.4, 1.1, 3, 4, 5],
  levelCost: 0.5,
  fullSet: 2,
  takeover: 1.5,
  stationPrice: 200,
  stationRent: 50,
  utilityPrice: 150,
  utilityRent: [4, 10],
  airportFee: 100,
  jailFine: 50,
  taxes: { income: { min: 100, rate: 0.1 }, luxury: { min: 200, rate: 0.1 } },
  effects: { lucky: 2, traffic: 2, exempt: 1, sick: 1, startup: 3 },
  festivalRent: 2,
  luckyRent: 2,
  startupCost: 0.5,
  quiz: { safe: 100, times: 4, botRight: 0.7 },
};
