/** Selling to the bank: what Lots and Levels fetch, and the sale the server suggests. */
import { BOARD } from './board.js';
import { isFullSet, landPrice, levelCost } from './economy.js';
import type { Player, Sale, State } from './model.js';
import type { Tuning } from './tuning.js';

/** What one Level of a City fetches: half what it cost. */
export const levelValue = (t: Tuning, tile: number) => Math.floor(levelCost(t, tile) / 2);

/** What a whole Lot fetches with its Levels: half its land price and what was built on it. */
export function lotValue(t: Tuning, state: State, tile: number) {
  const lot = state.lots[tile];
  return lot ? Math.floor((landPrice(t, tile) + lot.built) / 2) : 0;
}

/** Why `seat` cannot make `sale`, or `null`. */
export function saleProblem(state: State, seat: number, sale: readonly Sale[]): string | null {
  const seen = new Set<number>();
  for (const { tile, levels } of sale) {
    const lot = state.lots[tile];
    if (lot?.owner !== seat) return 'Bạn không có ô này';
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

/** Every Lot `seat` owns, whole. */
export const everything = (state: State, seat: number): Sale[] =>
  state.lots.flatMap((l, tile) => (l?.owner === seat ? [{ tile }] : []));

/**
 * The sale that raises `short` and loses the least: Levels first, then Lots that are no Full
 * set, Full sets last. Within each, the cheapest part that covers what is left, else the
 * dearest and go on. Everything when even that is not enough.
 */
export function suggestSale(t: Tuning, state: State, seat: number, short: number): Sale[] {
  const owned = everything(state, seat).map(({ tile }) => tile);
  const full = (tile: number) => isFullSet(state, tile);
  let need = short;

  const levelParts = owned.flatMap((tile) =>
    BOARD[tile]?.kind === 'city'
      ? Array.from({ length: (state.lots[tile]?.level ?? 1) - 1 }, () => ({
          tile,
          value: levelValue(t, tile),
        }))
      : [],
  );
  const levels = new Map<number, number>();
  for (const group of [
    levelParts.filter((p) => !full(p.tile)),
    levelParts.filter((p) => full(p.tile)),
  ]) {
    for (const part of pick(group, need)) {
      levels.set(part.tile, (levels.get(part.tile) ?? 0) + 1);
      need -= part.value;
    }
  }

  const after = sell(
    t,
    state,
    seat,
    [...levels].map(([tile, n]) => ({ tile, levels: n })),
  );
  const lotParts = owned.map((tile) => ({
    tile,
    value: lotValue(t, after, tile),
  }));
  const whole = new Set<number>();
  for (const group of [
    lotParts.filter((p) => !full(p.tile)),
    lotParts.filter((p) => full(p.tile)),
  ]) {
    for (const part of pick(group, need)) {
      whole.add(part.tile);
      need -= part.value;
    }
  }

  return owned.flatMap((tile): Sale[] => {
    if (whole.has(tile)) return [{ tile }];
    const n = levels.get(tile);
    return n ? [{ tile, levels: n }] : [];
  });
}

/** Parts raising `need`: the cheapest that covers what is left, else the dearest, and again. */
function pick<P extends { value: number }>(parts: readonly P[], need: number): P[] {
  const left = [...parts];
  const picked: P[] = [];
  while (need > 0 && left.length > 0) {
    const covers = left.filter((p) => p.value >= need);
    const next = covers.length
      ? covers.reduce((a, b) => (b.value < a.value ? b : a))
      : left.reduce((a, b) => (b.value > a.value ? b : a));
    left.splice(left.indexOf(next), 1);
    picked.push(next);
    need -= next.value;
  }
  return picked;
}
