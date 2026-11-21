/**
 * The computer's brain, one level: which cards to play (or `null` to pass). Following, it plays
 * the weakest play that works; leading, it sheds its lowest card in the longest set.
 */
import { beats, type Card, comboOf, rankOf, TWO } from './cards.js';
import type { State } from './model.js';

/** Every combination this hand can make (for the bot; enough variety, not every subset). */
export function combosOf(hand: readonly Card[]): Card[][] {
  const byRank = new Map<number, Card[]>();
  for (const card of [...hand].sort((a, b) => a - b)) {
    byRank.set(rankOf(card), [...(byRank.get(rankOf(card)) ?? []), card]);
  }
  const out: Card[][] = hand.map((c) => [c]);
  // Pairs, triples, quads: every choice of suits (at most 6 pairs of one rank).
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

function choose(cards: Card[], size: number): Card[][] {
  if (size === 0) return [[]];
  return cards.flatMap((card, i) =>
    choose(cards.slice(i + 1), size - 1).map((rest) => [card, ...rest]),
  );
}

const strength = (cards: Card[]) => Math.max(...cards);

export function botPlay(state: State, seat: number): Card[] | null {
  const hand = state.hands[seat] ?? [];
  const table = state.table && comboOf(state.table.cards);
  const legal = combosOf(hand).filter((cards) => {
    const combo = comboOf(cards);
    if (!combo || !beats(combo, table)) return false;
    return state.mustPlay === null || cards.includes(state.mustPlay);
  });
  if (legal.length === 0) return null;

  if (!table) {
    const lowest = Math.min(...hand);
    const withLowest = legal.filter((cards) => cards.includes(lowest));
    const pool = withLowest.length ? withLowest : legal;
    return pool.reduce((best, cards) =>
      cards.length > best.length ||
      (cards.length === best.length && strength(cards) < strength(best))
        ? cards
        : best,
    );
  }
  // Following: the weakest play of the same shape, bombs only when nothing else works.
  const same = legal.filter((cards) => comboOf(cards)?.kind === table.kind);
  const pool = same.length ? same : legal;
  return pool.reduce((best, cards) => (strength(cards) < strength(best) ? cards : best));
}
