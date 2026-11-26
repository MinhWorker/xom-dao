/**
 * The computer's look-ahead. When more than one move makes sense, it deals the cards it cannot
 * see to the other seats in many ways, plays each round out to its end with the quick rules of
 * bot.ts for everyone, and keeps the move that ranks it best on average. It looks only at what
 * a player at the table knows: its own hand, how many cards the others hold, and what was played.
 */
import { botPlay, candidates } from './bot.js';
import { type Card, fullDeck } from './cards.js';
import type { State } from './model.js';
import { afterPass, afterPlay, roundOver } from './round.js';

/** Playouts per decision, shared between the moves: at most a few tens of ms on the server. */
export const PLAYOUTS = 120;
/** Deals tried per move, at most. */
const SAMPLES = 24;
/** A playout longer than this many moves is stopped (it never happens in a real round). */
const MAX_MOVES = 400;

/** A small seeded random source, so the computer plays the same way on the same table. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The other seats' hands, made up from the cards nobody has seen yet. */
function guessHands(state: State, seat: number, rnd: () => number): Card[][] {
  const seen = new Set<Card>([
    ...(state.hands[seat] ?? []),
    ...state.played.flatMap((p) => p.cards),
  ]);
  const unseen = fullDeck().filter((c) => !seen.has(c));
  for (let i = unseen.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [unseen[i], unseen[j]] = [unseen[j] as Card, unseen[i] as Card];
  }
  let next = 0;
  return state.hands.map((hand, s) => {
    if (s === seat) return hand;
    const guess = unseen.slice(next, next + hand.length).sort((a, b) => a - b);
    next += hand.length;
    return guess;
  });
}

/** Plays the round out with the quick rules; how well `seat` ends: 1 first, 0 last. */
function playout(state: State, seat: number): number {
  let s = state;
  for (let moves = 0; moves < MAX_MOVES; moves++) {
    if (s.out.includes(seat) || roundOver(s)) break;
    const cards = botPlay(s, s.turn);
    s = cards ? afterPlay(s, s.turn, cards) : afterPass(s, s.turn);
  }
  const n = s.hands.length;
  const place = s.out.indexOf(seat);
  return place < 0 ? 0 : (n - 1 - place) / (n - 1);
}

/** The cards `seat` plays now, or `null` to pass, from `playouts` played-out rounds (0: the quick rules alone). */
export function bestMove(state: State, seat: number, playouts = PLAYOUTS): Card[] | null {
  if (playouts <= 0) return botPlay(state, seat);
  const moves = candidates(state, seat);
  if (moves.length <= 1) return moves[0] ?? null;
  const samples = Math.min(SAMPLES, Math.ceil(playouts / moves.length));
  const hand = state.hands[seat] ?? [];
  const rnd = random(hand.reduce((h, c) => h * 31 + c, state.played.length * 7 + seat));
  const scores = moves.map(() => 0);
  for (let i = 0; i < samples; i++) {
    const guessed = { ...state, hands: guessHands(state, seat, rnd) };
    moves.forEach((cards, m) => {
      const next = cards ? afterPlay(guessed, seat, cards) : afterPass(guessed, seat);
      scores[m] = (scores[m] ?? 0) + playout(next, seat);
    });
  }
  // The first move is the quick rules' own choice: it wins ties.
  let best = 0;
  scores.forEach((score, m) => {
    if (score > (scores[best] ?? 0)) best = m;
  });
  return moves[best] ?? null;
}
