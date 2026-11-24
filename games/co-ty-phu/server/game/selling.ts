/** Selling to the bank: what Lots and Levels fetch, and the sale the server suggests. */
import { BOARD } from './board.js';
import { isFullSet, landPrice, levelCost } from './economy.js';
import type { Player, Sale, State } from './model.js';
import type { Tuning } from './tuning.js';

/** What one Level of a City fetches: half what it cost. */
const levelValue = (t: Tuning, tile: number) => Math.floor(levelCost(t, tile) / 2);

/** What a whole Lot fetches with its Levels: half its land price and what was built on it. */
function lotValue(t: Tuning, state: State, tile: number) {
  const lot = state.lots[tile];
  return lot ? Math.floor((landPrice(t, tile) + lot.built) / 2) : 0;
}

/** Why `seat` cannot make `sale`, or `null`. */
export function saleProblem(state: State, seat: number, sale: readonly Sale[]): string | null {
  const seen = new Set<number>();
  for (const { tile, levels } of sale) {
    const lot = state.lots[tile];
    if (lot?.owner !== seat) return 'Bạn không có đất này';
    if (seen.has(tile)) return 'Mỗi ô chỉ bán một lần';
    seen.add(tile);
    if (levels !== undefined && levels > lot.level - 1) return 'Không bán được chừng ấy cấp';
  }
  return null;
}

/** `seat` Sells `sale` (checked with `saleProblem`) to the bank. */
export function sell(t: Tuning, state: State, seat: number, sale: readonly Sale[]): State {
  let raised = 0;
  const lots = [...state.lots];
  for (const { tile, levels } of sale) {
    const lot = lots[tile];
    if (!lot) continue;
    if (levels === undefined) {
      raised += lotValue(t, { ...state, lots }, tile);
      lots[tile] = null;
    } else {
      raised += levels * levelValue(t, tile);
      const built = Math.max(0, lot.built - levels * levelCost(t, tile));
      lots[tile] = { ...lot, level: lot.level - levels, built };
    }
  }
  const players = state.players.map((p, s) =>
    s === seat ? { ...p, cash: p.cash + raised } : p,
  ) as Player[];
  return { ...state, players, lots };
}

/** Every Lot `seat` owns, sold whole. */
export const wholeLots = (state: State, seat: number): Sale[] =>
  state.lots.flatMap((l, tile) => (l?.owner === seat ? [{ tile }] : []));

/** One Level, or a whole Lot, in a sale being chosen. */
interface Part {
  tile: number;
  lot: boolean;
}

/**
 * The sale that raises `short` and loses the least. Levels go before their Lots, and what is
 * not in a Full set before what is; within each, the cheapest part that covers what is left,
 * else the dearest and go on. Parts that turn out not to be needed are left out again.
 * Everything when even that is not enough.
 */
export function suggestSale(t: Tuning, state: State, seat: number, short: number): Sale[] {
  const owned = wholeLots(state, seat).map(({ tile }) => tile);
  const raised = (parts: readonly Part[]) =>
    cashOf(sell(t, state, seat, toSale(parts)), seat) - cashOf(state, seat);
  const levels = (tile: number): Part[] =>
    BOARD[tile]?.kind === 'city'
      ? Array.from({ length: (state.lots[tile]?.level ?? 1) - 1 }, () => ({ tile, lot: false }))
      : [];

  let parts: Part[] = [];
  for (const full of [false, true]) {
    const tiles = owned.filter((tile) => isFullSet(state, tile) === full);
    for (const group of [tiles.flatMap(levels), tiles.map((tile) => ({ tile, lot: true }))]) {
      const left = [...group];
      while (raised(parts) < short && left.length > 0) {
        const need = short - raised(parts);
        const gain = (p: Part) => raised([...parts, p]) - raised(parts);
        const covers = left.filter((p) => gain(p) >= need);
        const next = covers.length
          ? covers.reduce((a, b) => (gain(b) < gain(a) ? b : a))
          : left.reduce((a, b) => (gain(b) > gain(a) ? b : a));
        left.splice(left.indexOf(next), 1);
        parts.push(next);
      }
    }
  }
  for (const part of [...parts]) {
    const without = parts.filter((p) => p !== part);
    if (raised(without) >= short) parts = without;
  }
  return toSale(parts);
}

const cashOf = (state: State, seat: number) => (state.players[seat] as Player).cash;

/** Parts as a sale, in board order: a Lot whole when one of its parts is the Lot. */
function toSale(parts: readonly Part[]): Sale[] {
  const tiles = [...new Set(parts.map((p) => p.tile))].sort((a, b) => a - b);
  return tiles.map((tile) => {
    const mine = parts.filter((p) => p.tile === tile);
    return mine.some((p) => p.lot) ? { tile } : { tile, levels: mine.length };
  });
}
