/**
 * The computer's one level of play. It keeps a reserve of cash against the dearest rent it may
 * land on, buys and builds with what is above it, Takes over a City to complete its own Colour
 * set or to break up someone else's, flies where the flight pays, and makes the suggested sale
 * when in Debt.
 */
import { type GameEvent, int, type Rng } from '@xomdao/sdk';
import { AIRPORT_TILE, BOARD, isLot, setTiles } from './board.js';
import { AVERAGE_ROLL, botPick, cardOf, picksOf } from './cards.js';
import { landPrice, rent, takeoverPrice, upgradeCost } from './economy.js';
import { HOTEL, JAIL_TRIES, type Player, type State } from './model.js';
import type { Tuning } from './tuning.js';

/** The least cash the computer keeps after buying or building. */
const MIN_RESERVE = 150;

/** What the computer plays for `seat` now, or `null` when it is not theirs to play. */
export function botMove(t: Tuning, state: State, seat: number, rng: Rng): GameEvent | null {
  if (state.phase === 'debt')
    return state.debt?.from === seat
      ? { event: 'sell', payload: { sale: state.debt.suggested } }
      : null;
  if (state.turn !== seat) return null;
  const me = state.players[seat] as Player;
  const keep = reserve(t, state, seat);
  const affords = (cost: number, floor = keep) => me.cash - cost >= floor;
  switch (state.phase) {
    case 'roll':
      if (me.jailed && me.jailTries < JAIL_TRIES - 1) {
        if (me.jailCards > 0) return { event: 'use-card' };
        if (unowned(state) > LOTS / 2 && affords(t.jailFine)) return { event: 'pay-bail' };
      }
      return { event: 'roll' };
    case 'buy': {
      const price = landPrice(t, me.tile);
      const wanted = completes(state, seat, me.tile) || blocks(state, seat, me.tile);
      return affords(price, wanted ? MIN_RESERVE : keep) ? { event: 'buy' } : { event: 'pass' };
    }
    case 'upgrade':
      return affords(upgradeCost(t, state, seat, me.tile))
        ? { event: 'upgrade' }
        : { event: 'pass' };
    case 'takeover': {
      const price = takeoverPrice(t, state, me.tile) ?? Number.POSITIVE_INFINITY;
      const wanted =
        BOARD[me.tile]?.kind === 'city' &&
        (completes(state, seat, me.tile) || blocks(state, seat, me.tile));
      return wanted && affords(price) ? { event: 'takeover' } : { event: 'pass' };
    }
    case 'fly': {
      const to = flight(t, state, seat);
      return to === null ? { event: 'pass' } : { event: 'fly', payload: { to } };
    }
    case 'card': {
      const { action } = cardOf(state.card?.id as NonNullable<State['card']>['id']);
      return {
        event: 'pick',
        payload: { pick: botPick(t, state, action, picksOf(state, seat, action)) },
      };
    }
    case 'quiz': {
      const answer = state.quiz?.answer ?? 0;
      const right = rng() < t.quiz.botRight;
      return {
        event: 'answer',
        payload: { choice: right ? answer : (answer + int(rng, 1, 3)) % 4 },
      };
    }
  }
}

const LOTS = BOARD.filter(isLot).length;
const unowned = (state: State) => BOARD.filter((tile, i) => isLot(tile) && !state.lots[i]).length;

/** Half the dearest rent one of the others' Lots charges now, and at least `MIN_RESERVE`. */
function reserve(t: Tuning, state: State, seat: number) {
  const dearest = state.lots.reduce(
    (most, lot, tile) =>
      lot && lot.owner !== seat ? Math.max(most, rent(t, state, tile, AVERAGE_ROLL)) : most,
    0,
  );
  return Math.max(MIN_RESERVE, Math.round(dearest / 2));
}

/** The other Cities of the Colour set of `tile`, or `[]` for a Tile that is no City. */
function others(tile: number) {
  const city = BOARD[tile];
  return city?.kind === 'city' ? setTiles(city.set).filter((i) => i !== tile) : [];
}

/** Owning `tile` would give `seat` its whole Colour set. */
const completes = (state: State, seat: number, tile: number) => {
  const rest = others(tile);
  return rest.length > 0 && rest.every((i) => state.lots[i]?.owner === seat);
};

/** Someone else owns the rest of the Colour set of `tile`, or one more of it along with `tile`. */
function blocks(state: State, seat: number, tile: number) {
  const rest = others(tile);
  if (rest.length === 0) return false;
  const owner = state.lots[tile]?.owner;
  const theirs = (who: number) => rest.filter((i) => state.lots[i]?.owner === who).length;
  if (owner !== undefined && owner !== seat) return theirs(owner) >= 1;
  return state.players.some((_, s) => s !== seat && theirs(s) === rest.length);
}

/**
 * Where the flight from Sân bay pays most: an unowned Lot to buy, a City of its own to build on,
 * or Xuất phát for its bonus. `null` when nothing is worth the fee.
 */
function flight(t: Tuning, state: State, seat: number): number | null {
  const me = state.players[seat] as Player;
  const keep = reserve(t, state, seat);
  const cash = me.cash - t.airportFee;
  const worth = (tile: number): number => {
    if (tile === 0) return t.startBonus;
    const lot = state.lots[tile];
    if (!isLot(BOARD[tile])) return 0;
    if (!lot) {
      if (cash - landPrice(t, tile) < keep) return 0;
      const set = completes(state, seat, tile) ? 2 : blocks(state, seat, tile) ? 1.5 : 1;
      return set * landPrice(t, tile);
    }
    if (lot.owner !== seat || BOARD[tile]?.kind !== 'city' || lot.level >= HOTEL) return 0;
    return cash - upgradeCost(t, state, seat, tile) >= keep ? upgradeCost(t, state, seat, tile) : 0;
  };
  let best: number | null = null;
  let most = t.airportFee;
  for (let tile = 0; tile < BOARD.length; tile++) {
    if (tile === AIRPORT_TILE) continue;
    const value = worth(tile);
    if (value > most) [best, most] = [tile, value];
  }
  return cash >= MIN_RESERVE ? best : null;
}
