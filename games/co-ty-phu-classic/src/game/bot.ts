import type { GameEvent } from '@xomdao/sdk';
import { BOARD, isDeed, type State } from './model.js';
import { redeemAmount } from './rules.js';

const event = (name: string, payload?: object): GameEvent => ({ event: name, payload });
const deedValue = (square: number | null) => {
  if (square === null) return 0;
  const cell = BOARD[square];
  const price = cell?.price ?? 0;
  return price * 1.1;
};

/** One legal decision per server tick. Every active phase has an exit. */
export function botMove(state: State, seat: number): GameEvent | null {
  const me = state.players[seat];
  if (!me || me.bankrupt || state.winner !== null) return null;

  if (state.phase === 'trade') {
    const trade = state.trade;
    if (trade?.to !== seat) return null;
    const offered = deedValue(trade.give) + trade.giveCash + (trade.giveCard ? 200 : 0);
    const requested = deedValue(trade.take) + trade.takeCash + (trade.takeCard ? 200 : 0);
    return event(offered >= requested ? 'accept-trade' : 'decline-trade');
  }

  if ((state.phase === 'debt' ? (state.debt?.payer ?? state.turn) : state.turn) !== seat)
    return null;
  if (state.phase === 'event') return event('confirm-event');
  if (state.phase === 'buy') {
    const price = BOARD[state.pending ?? -1]?.price ?? Infinity;
    return event(me.cash >= price + 100 ? 'buy' : 'end-turn');
  }
  if (state.phase === 'debt') {
    if (me.cash >= state.debt!.amount) return event('pay-debt');
    const house = state.properties.findIndex(
      (property) => property.owner === seat && !property.mortgaged && property.houses > 0,
    );
    if (house >= 0) return event('sell-house', { square: house });
    const mortgage = state.properties.findIndex(
      (property, square) =>
        property.owner === seat &&
        !property.mortgaged &&
        property.houses === 0 &&
        isDeed(BOARD[square]!),
    );
    return mortgage >= 0 ? event('mortgage', { square: mortgage }) : event('bankrupt');
  }
  if (state.phase === 'end' || state.phase === 'roll') {
    const redeem = state.properties.findIndex(
      (property, square) =>
        property.owner === seat &&
        property.mortgaged &&
        me.cash >= redeemAmount(state, square) + 100,
    );
    if (redeem >= 0) return event('redeem', { square: redeem });
    const build = state.properties.findIndex((property, square) => {
      const cell = BOARD[square]!;
      if (property.owner !== seat || cell.kind !== 'street' || property.houses >= 5) return false;
      if (state.buildable !== square || me.position !== square || property.mortgaged) return false;
      if (me.cash < cell.houseCost! + 200) return false;
      return true;
    });
    if (build >= 0) return event('build', { square: build });
    if (state.phase === 'end') return event('end-turn');
  }
  if (state.phase === 'roll') {
    if (me.jailed && me.freeCards.length) return event('use-card');
    return event('roll');
  }
  return null;
}
