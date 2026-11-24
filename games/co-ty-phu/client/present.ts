/**
 * What the screen plays between two views, in order: the dice, each token's walk or jump, the
 * Card drawn, the Lots and marks that changed, then the money that moved and who went bankrupt.
 * The board is then redrawn from the new view.
 */
import { BOARD, JAIL_TILE, setTiles } from '../server/game/board.js';
import { type CardId, cardOf } from '../server/game/cards.js';
import { isFullSet } from '../server/game/economy.js';
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
  /** `seat` now owns the whole Colour set of `tiles`. */
  | { kind: 'fullset'; seat: number; tiles: number[] }
  | { kind: 'festival'; tile: number | null }
  | { kind: 'blackout'; tile: number | null }
  | { kind: 'quiz'; seat: number; right: boolean }
  /** Money from one player to another: rent, a Takeover, a Card or a Debt. */
  | { kind: 'pay'; from: number; to: number; amount: number }
  | { kind: 'cash'; seat: number; delta: number }
  /** `seat` is out, and `lots`, what they owned, go back to the bank with them. */
  | { kind: 'bankrupt'; seat: number; lots: { tile: number; lot: Lot }[] };

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

/** Where a payment gets grander, as shares of the starting cash: a level-1 rent stays below the first. */
const GRAND = [0.15, 0.4, 1] as const;

/**
 * How grand a payment of `amount` looks: 0 is a glimpse, 1 more coins, 2 the amount over the
 * board, 3 the camera shaking too.
 */
export const grandeur = (amount: number) =>
  GRAND.filter((share) => amount >= share * TUNING.startingCash).length;

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
    const jailed = p.jailed && !before.players[seat]?.jailed;
    if (p.tile === from && !jailed) return;
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

  const broke = after.bankrupt.filter((seat) => !before.bankrupt.includes(seat));
  /** A bankrupt player's Lots go with them, after the money. */
  const lost = (tile: number) => {
    const was = before.lots[tile];
    return !!was && !after.lots[tile] && broke.includes(was.owner);
  };
  after.lots.forEach((lot, tile) => {
    const was = before.lots[tile] ?? null;
    if (JSON.stringify(was) !== JSON.stringify(lot) && !lost(tile))
      out.push({ kind: 'lot', tile, before: was, after: lot });
  });
  const sets = new Set(BOARD.flatMap((t) => (t.kind === 'city' ? [t.set] : [])));
  for (const set of sets) {
    const tiles = setTiles(set);
    const [first] = tiles as [number];
    const owner = after.lots[first]?.owner;
    const was = before.lots[first]?.owner;
    if (
      owner !== undefined &&
      isFullSet(after, first) &&
      !(was === owner && isFullSet(before, first))
    )
      out.push({ kind: 'fullset', seat: owner, tiles });
  }
  const unmarked = (tile: number | null | undefined, now: number | null) =>
    now === null && tile !== null && tile !== undefined && lost(tile);
  if (after.festival !== before.festival && !unmarked(before.festival, after.festival))
    out.push({ kind: 'festival', tile: after.festival });
  const blackout = after.blackout?.tile ?? null;
  if (blackout !== (before.blackout?.tile ?? null) && !unmarked(before.blackout?.tile, blackout))
    out.push({ kind: 'blackout', tile: blackout });
  const quiz = after.quiz;
  if (quiz && quiz.answer !== null && before.quiz?.answer === null)
    out.push({ kind: 'quiz', seat: quiz.seat, right: quiz.picked === quiz.answer });

  const paid = payment(before, after);
  if (paid) out.push(paid);
  after.players.forEach((p, seat) => {
    const delta = p.cash - (before.players[seat]?.cash ?? p.cash);
    if (delta !== 0) out.push({ kind: 'cash', seat, delta });
  });
  for (const seat of broke) {
    const lots = before.lots.flatMap((lot, tile) =>
      lot && lost(tile) && lot.owner === seat ? [{ tile, lot }] : [],
    );
    out.push({ kind: 'bankrupt', seat, lots });
  }
  return out;
}

/**
 * The money one player paid another between two views; one move pays at most one player. A Debt
 * paid names both. Otherwise a player besides the turn player who gained was paid, by the one
 * other who lost or else by the turn player; or the turn player gained what one other lost.
 */
function payment(before: View, after: View): Change | null {
  const delta = after.players.map((p, seat) => p.cash - (before.players[seat]?.cash ?? p.cash));
  const gained = (seat: number) => delta[seat] ?? 0;
  const turn = before.turn;
  const debt = before.debt;
  if (debt && debt.to !== null && !after.debt && gained(debt.to) > 0)
    return { kind: 'pay', from: debt.from, to: debt.to, amount: gained(debt.to) };
  const losers = (but: number) => delta.flatMap((d, seat) => (d < 0 && seat !== but ? [seat] : []));
  const to = delta.findIndex((d, seat) => seat !== turn && d > 0);
  if (to >= 0) {
    const from = losers(to);
    return {
      kind: 'pay',
      from: from.length === 1 ? (from[0] as number) : turn,
      to,
      amount: gained(to),
    };
  }
  const from = losers(turn);
  if (gained(turn) <= 0 || from.length !== 1) return null;
  const payer = from[0] as number;
  return { kind: 'pay', from: payer, to: turn, amount: Math.min(-gained(payer), gained(turn)) };
}
