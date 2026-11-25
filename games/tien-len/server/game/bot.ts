/**
 * The computer's quick rules, which the look-ahead (search.ts) plays rounds out with. It splits
 * its hand into the sets it means to play (`plan`): straights, runs of pairs, quads, triples,
 * pairs, singles, with the 2s and bombs kept apart as control. Leading, it sheds its weakest set;
 * following, it plays the weakest set of the table's shape without breaking another one, and
 * spends a 2 only on a high card, or when someone is about to go out.
 */
import { beats, type Card, type Combo, comboOf, rankOf, TWO } from './cards.js';
import type { State } from './model.js';

/** Every combination this hand can make (enough variety, not every subset). */
export function combosOf(hand: readonly Card[]): Card[][] {
  const byRank = groupByRank(hand);
  const out: Card[][] = hand.map((c) => [c]);
  for (const cards of byRank.values()) {
    for (const size of [2, 3, 4]) out.push(...choose(cards, size));
  }
  // Straights and runs of pairs: lowest suits below, every suit choice for the top.
  for (let start = 0; start < TWO; start++) {
    for (const width of [1, 2]) {
      const run: Card[] = [];
      for (let rank = start; rank < TWO; rank++) {
        const cards = byRank.get(rank) ?? [];
        if (cards.length < width) break;
        const length = rank - start + 1;
        if (length >= 3) {
          for (const top of choose(cards, width)) out.push([...run, ...top]);
        }
        run.push(...cards.slice(0, width));
      }
    }
  }
  return out;
}

function groupByRank(hand: readonly Card[]) {
  const byRank = new Map<number, Card[]>();
  for (const card of [...hand].sort((a, b) => a - b)) {
    byRank.set(rankOf(card), [...(byRank.get(rankOf(card)) ?? []), card]);
  }
  return byRank;
}

function choose(cards: Card[], size: number): Card[][] {
  if (size === 0) return [[]];
  return cards.flatMap((card, i) =>
    choose(cards.slice(i + 1), size - 1).map((rest) => [card, ...rest]),
  );
}

const top = (cards: readonly Card[]) => Math.max(...cards);
const sorted = (cards: readonly Card[]) => [...cards].sort((a, b) => a - b);

/** 2s and bombs: the sets a hand keeps to win a trick back. */
export function isControl(cards: readonly Card[]) {
  const combo = comboOf(cards);
  if (!combo) return false;
  return rankOf(combo.top) === TWO || combo.kind === 'quad' || combo.kind === 'pairs';
}

/** Takes the longest run of `width` cards per rank (3+ ranks) starting lowest, or null. */
function takeRun(byRank: Map<number, Card[]>, width: number): Card[] | null {
  let best: Card[] | null = null;
  for (let start = 0; start < TWO; start++) {
    const run: Card[] = [];
    for (let rank = start; rank < TWO; rank++) {
      const cards = byRank.get(rank) ?? [];
      if (cards.length < width) break;
      run.push(...cards.slice(-width));
    }
    if (run.length >= 3 * width && (!best || run.length > best.length)) best = run;
  }
  if (!best) return null;
  for (const card of best) {
    const rank = rankOf(card);
    const left = (byRank.get(rank) ?? []).filter((c) => c !== card);
    if (left.length) byRank.set(rank, left);
    else byRank.delete(rank);
  }
  return sorted(best);
}

/**
 * The sets this hand means to play, weakest first. Several ways of splitting are tried and the
 * one that needs the fewest plays of ordinary sets wins, then the one with fewer singles.
 */
export function plan(hand: readonly Card[]): Card[][] {
  let best: Card[][] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const pairsFirst of [false, true]) {
    for (const straights of [true, false]) {
      const sets = split(hand, pairsFirst, straights);
      const plain = sets.filter((s) => !isControl(s));
      const singles = plain.filter((s) => s.length === 1).length;
      const lowSingles = plain.filter((s) => s.length === 1 && rankOf(s[0] as Card) < 8).length;
      const score = plain.length * 10 + singles * 2 + lowSingles;
      if (score < bestScore) {
        best = sets;
        bestScore = score;
      }
    }
  }
  return (best ?? []).sort((a, b) => top(a) - top(b));
}

function split(hand: readonly Card[], pairsFirst: boolean, straights: boolean): Card[][] {
  const byRank = groupByRank(hand);
  const sets: Card[][] = [];
  const twos = byRank.get(TWO);
  if (twos) {
    sets.push(twos);
    byRank.delete(TWO);
  }
  for (const [rank, cards] of byRank) {
    if (cards.length === 4) {
      sets.push(cards);
      byRank.delete(rank);
    }
  }
  if (pairsFirst) {
    for (let run = takeRun(byRank, 2); run; run = takeRun(byRank, 2)) sets.push(run);
  }
  if (straights) {
    for (let run = takeRun(byRank, 1); run; run = takeRun(byRank, 1)) sets.push(run);
  }
  for (const cards of byRank.values()) sets.push(cards);
  return sets;
}

/** Cards still held by each other seat that is in the round. */
function rivals(state: State, seat: number) {
  return state.hands.flatMap((h, s) => (s !== seat && h.length > 0 ? [h.length] : []));
}

export function botPlay(state: State, seat: number): Card[] | null {
  const hand = state.hands[seat] ?? [];
  if (hand.length === 0) return null;
  const table = state.table && comboOf(state.table.cards);
  const must = state.mustPlay;
  const allowed = (cards: Card[]) => {
    const combo = comboOf(cards);
    return !!combo && beats(combo, table) && (must === null || cards.includes(must));
  };
  if (allowed([...hand])) return sorted(hand);

  const fewest = Math.min(...rivals(state, seat), 13);
  const sets = plan(hand);
  return table ? follow(hand, sets, table, allowed, fewest) : lead(hand, sets, allowed, fewest);
}

function lead(
  hand: Card[],
  sets: Card[][],
  allowed: (cards: Card[]) => boolean,
  fewest: number,
): Card[] {
  const ok = sets.filter(allowed);
  const plain = ok.filter((s) => !isControl(s));
  // Two sets left and one is control: play the control first and finish on the other.
  if (sets.length === 2 && ok.some(isControl) && plain.length > 0) {
    return ok.find(isControl) as Card[];
  }
  if (fewest === 1) {
    // Someone holds one card: lead anything but a low single, or the highest single.
    const multi = ok.filter((s) => s.length > 1);
    if (multi.length) return multi[0] as Card[];
    return [top(hand)];
  }
  if (fewest === 2) {
    const notPair = plain.filter((s) => s.length !== 2);
    if (notPair.length) return notPair[0] as Card[];
  }
  const pool = plain.length ? plain : ok;
  if (pool.length) return pool[0] as Card[];
  // The card that must go sits in no allowed set (it never happens with a fresh plan): play it.
  return [Math.min(...hand)];
}

function follow(
  hand: Card[],
  sets: Card[][],
  table: Combo,
  allowed: (cards: Card[]) => boolean,
  fewest: number,
): Card[] | null {
  const tableIsTwo = rankOf(table.top) === TWO;
  const urgent = fewest <= 2 || hand.length <= 3;
  const plainSets = sets.filter((s) => !isControl(s));

  // Chop a 2 with a bomb: always worth it.
  if (tableIsTwo) {
    const bomb = sets.filter((s) => isControl(s) && rankOf(top(s)) !== TWO && allowed(s));
    if (bomb.length) return bomb[0] as Card[];
  }

  // A whole set of the same shape, weakest first.
  const same = plainSets.filter((s) => s.length === table.size && allowed(s));
  if (same.length) return same[0] as Card[];

  // A piece of a set that leaves the rest whole: the high end of a long straight, a pair or
  // a single taken from a triple.
  const pieces: Card[][] = [];
  for (const set of plainSets) {
    const combo = comboOf(set);
    if (!combo) continue;
    if (combo.kind === 'straight' && set.length - table.size >= 3) {
      pieces.push(set.slice(set.length - table.size));
    }
    if (combo.kind === 'triple' && table.size < 3) {
      pieces.push(set.slice(3 - table.size));
    }
  }
  const piece = pieces.filter(allowed).sort((a, b) => top(a) - top(b));
  if (piece.length) return piece[0] as Card[];

  // 2s: on a high card, when the hand is nearly done, or someone is.
  const highTable = rankOf(table.top) >= 9 || table.kind !== 'single';
  const twos = hand.filter((c) => rankOf(c) === TWO);
  if (twos.length && (highTable || urgent || plainSets.length <= 2)) {
    const twoPlays = combosOf(twos).filter(allowed);
    if (twoPlays.length) return twoPlays.sort((a, b) => top(a) - top(b))[0] as Card[];
  }

  if (urgent) {
    // Break anything that stops them.
    const any = combosOf(hand).filter(allowed);
    const sameKind = any.filter((c) => comboOf(c)?.kind === table.kind);
    const pool = sameKind.length ? sameKind : any;
    if (pool.length) return pool.sort((a, b) => top(a) - top(b))[0] as Card[];
  }
  return null;
}

/**
 * The moves worth looking ahead at, the quick rules' own choice first: passing, each planned
 * set that may go, and the weakest few plays of the table's shape.
 */
export function candidates(state: State, seat: number): (Card[] | null)[] {
  const hand = state.hands[seat] ?? [];
  if (hand.length === 0) return [];
  const table = state.table && comboOf(state.table.cards);
  const must = state.mustPlay;
  const allowed = (cards: Card[]) => {
    const combo = comboOf(cards);
    return !!combo && beats(combo, table) && (must === null || cards.includes(must));
  };
  const first = botPlay(state, seat);
  if (first && first.length === hand.length) return [first];
  const out: (Card[] | null)[] = [first];
  const key = (cards: Card[] | null) => (cards ? sorted(cards).join(',') : 'pass');
  const seen = new Set([key(first)]);
  const add = (cards: Card[] | null) => {
    if (!seen.has(key(cards))) {
      seen.add(key(cards));
      out.push(cards);
    }
  };
  if (table) add(null);
  for (const set of plan(hand)) if (allowed(set)) add(set);
  const legal = combosOf(hand)
    .filter(allowed)
    .sort((a, b) => top(a) - top(b));
  const shaped = table ? legal.filter((c) => comboOf(c)?.kind === table.kind) : legal;
  for (const cards of shaped.slice(0, 4)) add(cards);
  if (table) for (const cards of legal.filter(isControl).slice(0, 2)) add(cards);
  return out;
}
