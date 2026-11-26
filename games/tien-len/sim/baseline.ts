/**
 * The computer player before the smarter one (#392), kept so the simulator can measure the new
 * one against it: following, it plays the weakest play that works; leading, it sheds its lowest
 * card in the longest set.
 */
import { combosOf } from '../server/game/bot.js';
import { beats, type Card, comboOf } from '../server/game/cards.js';
import type { State } from '../server/game/model.js';

const strength = (cards: Card[]) => Math.max(...cards);

export function baselinePlay(state: State, seat: number): Card[] | null {
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
