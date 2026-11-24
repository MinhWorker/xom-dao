/**
 * What the screen plays between two views, in order: the dice, each token's walk or jump, the
 * Card drawn, the Lots and marks that changed, then the money that moved and who went bankrupt.
 * The board is then redrawn from the new view.
 */
import { BOARD, JAIL_TILE } from '../server/game/board.js';
import { type CardId, cardOf } from '../server/game/cards.js';
import { DOUBLES_TO_JAIL, type Lot, type View } from '../server/game/model.js';
import { TUNING } from '../server/game/tuning.js';

export type Change =
  | { kind: 'dice'; dice: number[] }
  /** Forward along the board, `steps` Tiles from `from`. */
  | { kind: 'walk'; seat: number; from: number; steps: number }
  /** Straight to `to`: into jail, a flight from Sân bay, or a Card's move. */
  | { kind: 'jump'; seat: number; to: number; how: 'jail' | 'flight' | 'move' }
  /** Out of jail: the fine, a jail-free Card or the roll. */
  | { kind: 'release'; seat: number }
  | { kind: 'card'; seat: number; id: CardId }
  | { kind: 'lot'; tile: number; before: Lot | null; after: Lot | null }
  | { kind: 'festival'; tile: number | null }
  | { kind: 'blackout'; tile: number | null }
  | { kind: 'quiz'; seat: number; right: boolean }
  | { kind: 'cash'; seat: number; delta: number }
  | { kind: 'bankrupt'; seat: number };

const TILES = BOARD.length;
const ahead = (from: number, to: number) => (to - from + TILES) % TILES;

/** Cards that send their drawer ahead along the board rather than straight there. */
const forward = (id: CardId) => {
  const { action } = cardOf(TUNING, id);
  return (
    action.kind === 'nearest' ||
    (action.kind === 'go' && action.to === 'start') ||
    action.kind === 'cash-or-start'
  );
};

/** How fast the moves into `view` play (1 is normal): 2× under Nhanh, faster while more wait. */
export const pace = (view: View, waiting: number) =>
  (view.speed === 'fast' ? 0.5 : 1) * (waiting > 2 ? 0.4 : 1);

export function changes(before: View, after: View): Change[] {
  const out: Change[] = [];
  const rolled = after.rolls > before.rolls && after.dice !== null;
  const drawn = after.card && after.card.draw !== (before.card?.draw ?? 0) ? after.card : null;
  const roller = before.turn;
  /** Where each seat's token is when the Card (if any) is shown. */
  const at = before.players.map((p) => p.tile);
  const released = after.players.flatMap((p, seat): Change[] =>
    before.players[seat]?.jailed && !p.jailed && !p.bankrupt ? [{ kind: 'release', seat }] : [],
  );

  if (rolled && after.dice) out.push({ kind: 'dice', dice: after.dice });
  out.push(...released);
  if (rolled && after.dice) {
    const was = before.players[roller];
    const sum = after.dice.reduce((a, b) => a + b, 0);
    const double = after.dice.length === 2 && after.dice[0] === after.dice[1];
    const tripled = double && before.doubles === DOUBLES_TO_JAIL - 1 && !was?.jailed;
    const stuck = was?.jailed && after.players[roller]?.jailed;
    if (was && !tripled && !stuck) {
      out.push({ kind: 'walk', seat: roller, from: was.tile, steps: sum });
      at[roller] = (was.tile + sum) % TILES;
    }
  }
  if (drawn) out.push({ kind: 'card', seat: drawn.seat, id: drawn.id });
  after.players.forEach((p, seat) => {
    const from = at[seat] as number;
    if (p.tile === from) return;
    if (drawn && drawn.seat === seat && forward(drawn.id) && p.tile !== JAIL_TILE)
      out.push({ kind: 'walk', seat, from, steps: ahead(from, p.tile) || TILES });
    else {
      const flew = before.phase === 'fly' && seat === before.turn;
      out.push({
        kind: 'jump',
        seat,
        to: p.tile,
        how: p.jailed ? 'jail' : flew ? 'flight' : 'move',
      });
    }
  });

  after.lots.forEach((lot, tile) => {
    const was = before.lots[tile] ?? null;
    if (JSON.stringify(was) !== JSON.stringify(lot))
      out.push({ kind: 'lot', tile, before: was, after: lot });
  });
  if (after.festival !== before.festival) out.push({ kind: 'festival', tile: after.festival });
  if (after.blackout?.tile !== before.blackout?.tile)
    out.push({ kind: 'blackout', tile: after.blackout?.tile ?? null });
  const quiz = after.quiz;
  if (quiz && quiz.answer !== null && before.quiz?.answer === null)
    out.push({ kind: 'quiz', seat: quiz.seat, right: quiz.picked === quiz.answer });

  after.players.forEach((p, seat) => {
    const delta = p.cash - (before.players[seat]?.cash ?? p.cash);
    if (delta !== 0) out.push({ kind: 'cash', seat, delta });
  });
  for (const seat of after.bankrupt)
    if (!before.bankrupt.includes(seat)) out.push({ kind: 'bankrupt', seat });
  return out;
}
