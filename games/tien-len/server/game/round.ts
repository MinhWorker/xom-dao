/**
 * How a round moves on after a play or a pass, with no timers or Match bookkeeping: shared by
 * the Game (TienLenGame.ts) and the computer's look-ahead (search.ts).
 */
import { type Card, comboOf } from './cards.js';
import type { Play, State } from './model.js';

/** Still in this round with cards in hand. */
export const isPlaying = (state: State, seat: number) => (state.hands[seat]?.length ?? 0) > 0;

/** The first seat after `seat` still holding cards. */
export function nextPlaying(state: State, seat: number) {
  const n = state.hands.length;
  for (let k = 1; k <= n; k++) {
    const next = (seat + k) % n;
    if (isPlaying(state, next)) return next;
  }
  return null;
}

/** `seat` puts `cards` (already checked) on the table; the turn moves on. */
export function afterPlay(state: State, seat: number, cards: Card[]): State {
  const sorted = [...cards].sort((a, b) => a - b);
  const hand = (state.hands[seat] ?? []).filter((c) => !sorted.includes(c));
  const played: Play = {
    seat,
    cards: sorted,
    kind: comboOf(sorted)?.kind ?? 'single',
    trick: state.trick,
  };
  return advance({
    ...state,
    hands: state.hands.map((h, s) => (s === seat ? hand : h)),
    table: played,
    played: [...state.played, played],
    mustPlay: null,
    out: hand.length === 0 ? [...state.out, seat] : state.out,
  });
}

/** `seat` passes: out of this trick; the turn moves on. */
export function afterPass(state: State, seat: number): State {
  return advance({ ...state, passed: state.passed.map((p, s) => p || s === seat) });
}

/**
 * The turn moves on to the next seat still in the trick. When it comes back to whoever played
 * last, everyone else passed: they start a new trick. If they have no cards left, the first
 * player after them leads instead.
 */
function advance(state: State): State {
  const n = state.hands.length;
  const owner = state.table?.seat;
  for (let k = 1; k <= n; k++) {
    const seat = (state.turn + k) % n;
    if (seat === owner && isPlaying(state, seat)) return newTrick(state, seat);
    if (seat !== owner && isPlaying(state, seat) && !state.passed[seat]) {
      return { ...state, turn: seat };
    }
  }
  const lead = nextPlaying(state, owner ?? state.turn);
  return lead === null ? state : newTrick(state, lead);
}

const newTrick = (state: State, lead: number): State => ({
  ...state,
  turn: lead,
  table: null,
  trick: state.trick + 1,
  passed: state.passed.map(() => false),
});

/** The round is over when one player (or none) still holds cards. */
export const roundOver = (state: State) => state.hands.filter((h) => h.length > 0).length <= 1;
