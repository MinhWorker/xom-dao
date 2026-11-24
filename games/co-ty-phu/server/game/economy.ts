/** What Lots cost and charge. Every amount is a whole number. */
import { BOARD, isLot, setTiles, tilesOf } from './board.js';
import { type BoardState, HOTEL } from './model.js';
import type { Tuning } from './tuning.js';

/** A Lot's listed price, or 0 for a Tile that is no Lot. */
export function landPrice(t: Tuning, tile: number) {
  const lot = BOARD[tile];
  if (lot?.kind === 'city') return Math.round(lot.price * t.cityPrice);
  if (lot?.kind === 'station') return t.stationPrice;
  if (lot?.kind === 'utility') return t.utilityPrice;
  return 0;
}

/** What the next Level of a City costs. */
export const levelCost = (t: Tuning, tile: number) => Math.round(landPrice(t, tile) * t.levelCost);

/** What the next Level of `tile` costs `seat`: less under Khởi nghiệp. */
export function upgradeCost(t: Tuning, state: BoardState, seat: number, tile: number) {
  const startup = state.players[seat]?.effects.some((e) => e.id === 'startup');
  return Math.round(levelCost(t, tile) * (startup ? t.startupCost : 1));
}

/** The owner of a City has all three of its Colour set. */
export function isFullSet(state: BoardState, tile: number) {
  const city = BOARD[tile];
  if (city?.kind !== 'city') return false;
  const owner = state.lots[tile]?.owner;
  return owner !== undefined && setTiles(city.set).every((i) => state.lots[i]?.owner === owner);
}

/**
 * What landing on an owned Lot costs; `diceSum` prices a utility. 0 when nobody owns it or it is
 * in a Blackout; doubled by a Festival and by its owner's Thần tài.
 */
export function rent(t: Tuning, state: BoardState, tile: number, diceSum: number) {
  const lot = state.lots[tile];
  if (!lot || state.blackout?.tile === tile) return 0;
  const owner = state.players[lot.owner];
  const times =
    (state.festival === tile ? t.festivalRent : 1) *
    (owner?.effects.some((e) => e.id === 'lucky') ? t.luckyRent : 1);
  return Math.round(baseRent(t, state, tile, diceSum) * times);
}

function baseRent(t: Tuning, state: BoardState, tile: number, diceSum: number) {
  const lot = state.lots[tile];
  const kind = BOARD[tile]?.kind;
  if (!lot) return 0;
  const owned = (k: 'station' | 'utility') =>
    tilesOf(k).filter((i) => state.lots[i]?.owner === lot.owner).length;
  if (kind === 'station') return t.stationRent * owned('station');
  if (kind === 'utility')
    return diceSum * (owned('utility') >= 2 ? t.utilityRent[1] : t.utilityRent[0]);
  const base = landPrice(t, tile) * (t.levelRent[lot.level - 1] ?? 0);
  return Math.round(base * (isFullSet(state, tile) ? t.fullSet : 1));
}

/** What a Takeover of this Lot costs, or `null` when it cannot be Taken over (a Hotel). */
export function takeoverPrice(t: Tuning, state: BoardState, tile: number) {
  const lot = state.lots[tile];
  if (!lot || !isLot(BOARD[tile]) || lot.level >= HOTEL) return null;
  return Math.floor(t.takeover * (landPrice(t, tile) + lot.built));
}

/** A tax on `cash`. */
export function taxOf(t: Tuning, kind: 'income' | 'luxury', cash: number) {
  const { min, rate } = t.taxes[kind];
  return Math.max(min, Math.floor(rate * Math.max(0, cash)));
}
