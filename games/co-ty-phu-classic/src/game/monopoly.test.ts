import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { CHANCE, CHEST } from './cards.js';
import { BOARD, groupSquares, UTILITY_SQUARES } from './model.js';
import { assetValue, deedPrice, mortgageAmount, move, rent, resolveSpecialEvent } from './rules.js';

const game = () => testGame(plugin, ['a', 'b', 'c']);

describe('utilities and monopoly', () => {
  it.each(UTILITY_SQUARES)(
    'buys utility %s, charges actual dice and supports mortgage/trade',
    (square) => {
      const g = game();
      move(g.state, 0, square, false, 7);
      g.send('a', 'buy');
      expect(g.state.players[0]!.cash).toBe(850);
      expect(rent(g.state, square, 7)).toBe(28);
      g.state.properties[UTILITY_SQUARES.find((i) => i !== square)!]!.owner = 0;
      expect(rent(g.state, square, 9)).toBe(90);
      move(g.state, 1, square, false, 6);
      expect(g.state.players[1]!.cash).toBe(940);
      expect(g.state.players[0]!.cash).toBe(910);
      g.state.phase = 'end';
      g.send('a', 'mortgage', { square });
      expect(rent(g.state, square, 6)).toBe(0);
      g.send('a', 'redeem', { square });
      g.send('a', 'offer-trade', { to: 1, give: square, take: -1, giveCash: 0, takeCash: 0 });
      g.send('b', 'accept-trade');
      expect(rent(g.state, square, 6)).toBe(24);
      expect(g.error('a', 'build', { square })).toBeTruthy();
    },
  );

  it('only triples rent for a complete set at every building level', () => {
    const g = game();
    const squares = groupSquares(BOARD[1]!.group!);
    for (const square of squares) g.state.properties[square]!.owner = 0;
    for (let level = 0; level <= 5; level++) {
      g.state.properties[1]!.houses = level;
      const charge = BOARD[1]!.rent![level]! * 3;
      expect(rent(g.state, 1, 7)).toBe(charge);
      g.state.players[1]!.cash = 10000;
      move(g.state, 1, 1, false, 7);
      expect(g.state.players[1]!.cash).toBe(10000 - charge);
    }
    g.state.properties[3]!.owner = 1;
    expect(rent(g.state, 1, 7)).toBe(BOARD[1]!.rent![5]!);
    g.state.players[0]!.jailed = true;
    expect(rent(g.state, 1, 7)).toBe(0);
  });

  it('values deeds, buildings, cards and mortgage liabilities at victory', () => {
    const g = game();
    g.state.properties[1] = { owner: 0, houses: 2, mortgaged: false };
    g.state.players[0]!.freeCards = ['chance'];
    expect(assetValue(g.state, 0)).toBe(1600);
    g.send('a', 'mortgage', { square: 1 });
    expect(assetValue(g.state, 0)).toBe(1580);
  });

  it('uses the winning contribution as a station purchase and mortgage value', () => {
    const g = game();
    g.state.properties[5] = {
      owner: 0,
      houses: 0,
      mortgaged: false,
      acquisitionCost: 400,
    };
    expect(BOARD[5]).not.toHaveProperty('price');
    expect(deedPrice(g.state, 5)).toBe(400);
    expect(mortgageAmount(g.state, 5)).toBe(200);
    expect(assetValue(g.state, 0)).toBe(1400);
  });

  it('applies full-set rent across an intervening chance square, not a pair bonus', () => {
    const g = game();
    for (const square of [6, 8, 9]) g.state.properties[square]!.owner = 0;
    expect([6, 8, 9].map((square) => rent(g.state, square, 7))).toEqual([84, 96, 105]);
    move(g.state, 1, 6, false, 7);
    expect(g.state.players[1]!.cash).toBe(916);
    expect(g.state.transfers.at(-1)).toMatchObject({ to: 0, amount: 84 });
    move(g.state, 1, 7, false, 7);
    expect(g.state.specialEvent?.kind).toBe('card');
    expect(g.state.players[1]!.cash).toBe(916);
    g.state.properties[9]!.owner = 2;
    expect([6, 8, 9].map((square) => rent(g.state, square, 7))).toEqual([28, 32, 35]);
  });

  it('does not charge a utility owner on a doubled nearest-utility card', () => {
    const g = game();
    const nearestUtility = CHANCE.findIndex(
      (card) => card.kind === 'nearest' && card.target === 'utility',
    );
    g.state.properties[12]!.owner = 0;
    g.state.properties[28]!.owner = 0;
    g.state.chance = [nearestUtility];
    move(g.state, 0, 7, false, 6);
    resolveSpecialEvent(g.state, () => 0);
    expect(g.state.players[0]!.position).toBe(12);
    expect(g.state.players[0]!.cash).toBe(1000);
    expect(g.state.transfers).toEqual([]);

    g.state.chance = [nearestUtility];
    g.state.turn = 1;
    move(g.state, 1, 7, false, 6);
    resolveSpecialEvent(g.state, () => 0);
    expect(g.state.transfers.at(-1)).toMatchObject({ from: 1, to: 0, amount: 120 });
  });
});

describe('jail ticket exchange', () => {
  it.each(['chance', 'chest'] as const)(
    'sells a %s ticket for 200 and returns it to the right deck on use',
    (deck) => {
      const g = game();
      g.state.players[0]!.freeCards = [deck];
      g.send('a', 'offer-trade', { to: 1, give: -2, take: -1, giveCash: 0, takeCash: 200 });
      expect(g.state.players[0]!.freeCards).toEqual([deck]);
      g.send('b', 'accept-trade');
      expect(g.state.players.map((p) => p.cash)).toEqual([1200, 800, 1000]);
      expect(g.state.players[0]!.freeCards).toEqual([]);
      expect(g.state.players[1]!.freeCards).toEqual([deck]);
      const before = g.state[deck].length;
      g.state.turn = 1;
      g.state.phase = 'roll';
      g.state.players[1]!.jailed = true;
      g.send('b', 'use-card');
      expect(g.state[deck]).toHaveLength(before + 1);
      expect(g.state.players[1]!.jailed).toBe(false);
    },
  );

  it('buys a ticket from another player and leaves rejected offers unchanged', () => {
    const g = game();
    g.state.players[1]!.freeCards = ['chest'];
    const offer = { to: 1, give: -1, take: -2, giveCash: 200, takeCash: 0 };
    g.send('a', 'offer-trade', offer);
    g.send('b', 'decline-trade');
    expect(g.state.players.map((p) => p.cash)).toEqual([1000, 1000, 1000]);
    g.send('a', 'offer-trade', offer);
    g.send('b', 'accept-trade');
    expect(g.state.players[0]!.freeCards).toEqual(['chest']);
    expect(g.state.players.map((p) => p.cash)).toEqual([800, 1200, 1000]);
  });

  it('keeps each get-out-of-jail ticket out of its deck until used', () => {
    const g = game();
    const chanceTicket = CHANCE.findIndex((card) => card.kind === 'free');
    const chestTicket = CHEST.findIndex((card) => card.kind === 'free');

    g.state.chance = [chanceTicket];
    move(g.state, 0, 7, false, 7);
    resolveSpecialEvent(g.state, () => 0);
    g.state.chest = [chestTicket];
    g.state.turn = 1;
    move(g.state, 1, 17, false, 7);
    resolveSpecialEvent(g.state, () => 0);
    expect(g.state.players.flatMap((player) => player.freeCards)).toHaveLength(2);
    expect(g.state.chance).toEqual([]);
    expect(g.state.chest).toEqual([]);

    g.state.players[0]!.cash = 0;
    g.state.debt = { amount: 1, creditor: null, reason: 'Nợ', after: 'end' };
    g.state.phase = 'debt';
    g.send('a', 'bankrupt');
    expect(g.state.players[0]!.freeCards).toEqual([]);
    expect(g.state.chance).toEqual([]);
  });

  it('rejects a missing ticket, wrong price, insufficient cash and stale inventory', () => {
    const g = game();
    const offer = { to: 1, give: -2, take: -1, giveCash: 0, takeCash: 200 };
    expect(g.error('a', 'offer-trade', offer)).toBe('Không có vé ra tù để bán');
    g.state.players[0]!.freeCards = ['chance'];
    expect(g.error('a', 'offer-trade', { ...offer, takeCash: 150 })).toBe(
      'Vé ra tù được bán riêng với giá 200',
    );
    g.state.players[1]!.cash = 199;
    expect(g.error('a', 'offer-trade', offer)).toBe('Một bên không đủ tiền trao đổi');
    g.state.players[1]!.cash = 200;
    g.send('a', 'offer-trade', offer);
    g.state.players[0]!.freeCards = [];
    expect(g.error('b', 'accept-trade')).toBe('Tài sản trao đổi đã thay đổi');
    expect(g.state.players[1]!.cash).toBe(200);
  });
});
