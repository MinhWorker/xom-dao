/**
 * Every number the balance can be tuned with: prices, rents, fees, Card amounts and how careful
 * the computer is. The legacy Classic table was the starting point; the simulator
 * (sim/simulate.ts) measures a change. City land prices are in board.ts and scaled by
 * `cityPrice`. A Card's text is written from these numbers (cards.ts).
 */
import type { EffectId } from './model.js';

export interface Tuning {
  /** Each player's cash when the Match starts. */
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
  /** What a bến xe costs. */
  stationPrice: number;
  /** A station's rent per station its owner has. */
  stationRent: number;
  /** What Điện lực or Cấp nước costs. */
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
  /** Rent multiplier of the Lot holding the Festival. */
  festivalRent: number;
  /** Rent multiplier of what the holder of Thần tài collects. */
  luckyRent: number;
  /** Under Khởi nghiệp a Level costs this share of its price. */
  startupCost: number;
  quiz: {
    /** The safe reward of a Quiz Card. */
    safe: number;
    /** A right answer pays the safe reward this many times. */
    times: number;
    /** How often the computer answers right, from 0 to 1. */
    botRight: number;
  };
  /** The amounts on the Cards, all positive; the Card says whether it pays or charges. */
  cards: {
    /** Lãi tiết kiệm: share of the drawer's cash they get. */
    interest: number;
    /** Mất ví: share of the drawer's cash they lose. */
    wallet: number;
    /** Phí bảo trì: paid per Lot the drawer owns. */
    upkeep: number;
    /** Được mùa: got per Lot the drawer owns. */
    harvest: number;
    /** Sửa nhà: paid per Level the drawer has built. */
    repairs: number;
    /** Du lịch: got per Level the drawer has built. */
    tourism: number;
    /** Từ thiện: the richest player pays the poorest this much. */
    charity: number;
    /** San sẻ: the richest player pays the poorest this much. */
    share: number;
    /** Thuế Khách sạn: whoever has the most Hotels pays this per Hotel. */
    hotelTax: number;
    /** Thưởng nóng: the cash it offers instead of a roll. */
    bonus: number;
    /** Quà quê: the cash it offers instead of going to Xuất phát. */
    gift: number;
    /** Quên đồ: how many Tiles back the drawer goes. */
    back: number;
  };
  /** How careful the computer is with its cash. */
  bot: {
    /** The least cash it keeps after buying, building or a flight. */
    reserve: number;
    /** It keeps at least this share of the dearest rent one of the others' Lots charges now. */
    rentShare: number;
  };
}

export const TUNING: Tuning = {
  startingCash: 1000,
  startBonus: 200,
  cityPrice: 1,
  levelRent: [0.25, 0.9, 2.6, 4, 5],
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
  cards: {
    interest: 0.1,
    wallet: 0.1,
    upkeep: 25,
    harvest: 30,
    repairs: 20,
    tourism: 15,
    charity: 150,
    share: 100,
    hotelTax: 100,
    bonus: 150,
    gift: 250,
    back: 3,
  },
  bot: { reserve: 150, rentShare: 0.5 },
};
