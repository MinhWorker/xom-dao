import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { botMove } from './bot.js';
import { CHANCE, CHEST } from './cards.js';
import { BOARD, isDeed } from './model.js';
import { move, rent, resolveSpecialEvent, utilityMultiplier } from './rules.js';

const stationGame = () => {
  const game = testGame(plugin, ['a', 'b', 'c']);
  game.state.after = 'end';
  move(game.state, 0, 5, false, 7);
  return game;
};

describe('station purchase on landing', () => {
  it('lists each station at 200', () => {
    expect([5, 15, 25, 35].map((square) => BOARD[square]!.price)).toEqual([200, 200, 200, 200]);
  });

  it('offers direct purchase for 200 when landing on an unowned station', () => {
    const game = stationGame();
    expect(game.state.phase).toBe('buy');
    expect(game.state.pending).toBe(5);
    expect(game.error('b', 'buy')).toBeTruthy();

    game.send('a', 'buy');

    expect(game.state.properties[5]!.owner).toBe(0);
    expect(game.state.players[0]!.cash).toBe(800);
    expect(game.state.transfers).toContainEqual({
      from: 0,
      to: null,
      amount: 200,
      reason: 'Mua Bến Bắc',
    });
    expect(game.state.phase).toBe('end');
  });

  it('lets the visitor decline the direct purchase', () => {
    const game = stationGame();
    game.send('a', 'end-turn');

    expect(game.state.properties[5]!.owner).toBeNull();
    expect(game.state.players[0]!.cash).toBe(1000);
    expect(game.state.pending).toBeNull();
    expect(game.state.turn).toBe(1);
  });

  it('rejects a purchase when the visitor cannot afford the posted price', () => {
    const game = stationGame();
    game.state.players[0]!.cash = 199;

    expect(game.error('a', 'buy')).toBe('Không đủ tiền mua đất');
    expect(game.state.phase).toBe('buy');
    expect(game.state.properties[5]!.owner).toBeNull();
    expect(game.state.players[0]!.cash).toBe(199);
  });

  it('lets a bot buy at the posted price while keeping its cash reserve', () => {
    const game = stationGame();
    game.state.players[0]!.cash = 300;
    expect(botMove(game.state, 0)?.event).toBe('buy');
    game.state.players[0]!.cash = 299;
    expect(botMove(game.state, 0)?.event).toBe('end-turn');
  });
});

describe('taxes and table rounds', () => {
  it.each([
    [4, 100],
    [38, 200],
  ])('charges 10%% of cash on square %s with minimum %s', (square, minimum) => {
    const game = testGame(plugin, ['a', 'b']);
    game.state.players[0]!.cash = 3456;
    move(game.state, 0, square, false, 7);
    expect(game.state.specialEvent).toMatchObject({ kind: 'tax', amount: 345 });
    resolveSpecialEvent(game.state, () => 0);
    expect(game.state.players[0]?.cash).toBe(3111);
    game.state.players[0]!.cash = 99;
    move(game.state, 0, square, false, 7);
    resolveSpecialEvent(game.state, () => 0);
    expect(game.state.debt?.amount).toBe(minimum);
  });

  it.each([12, 28])('sells utility %s and doubles rent only in its next table round', (square) => {
    const game = testGame(plugin, ['a', 'b']);
    expect(isDeed(BOARD[square]!)).toBe(true);
    move(game.state, 0, square, false, 7);
    expect(game.state.phase).toBe('buy');
    game.send('a', 'buy');
    expect(game.state.properties[square]!.owner).toBe(0);
    const id = CHANCE.findIndex((card) => card.kind === 'shortage' && card.square === square);
    game.state.chance = [id];
    move(game.state, 0, 7, false, 7);
    resolveSpecialEvent(game.state, () => 0);
    expect(utilityMultiplier(game.state, square)).toBe(4);
    game.state.phase = 'end';
    game.send('a', 'end-turn');
    game.state.phase = 'end';
    game.send('b', 'end-turn');
    expect(game.state.round).toBe(1);
    expect(utilityMultiplier(game.state, square)).toBe(8);
    move(game.state, 1, square, false, 12);
    expect(game.state.players[1]?.cash).toBe(904);
    expect(game.state.players[0]?.cash).toBe(946);
    game.state.phase = 'end';
    game.send('a', 'end-turn');
    game.state.phase = 'end';
    game.send('b', 'end-turn');
    expect(utilityMultiplier(game.state, square)).toBe(4);
    expect(game.state.shortages).toEqual([]);
  });

  it('charges linear station fees while respecting jail and mortgage', () => {
    const game = testGame(plugin, ['a', 'b']);
    for (const square of [5, 15, 25]) game.state.properties[square]!.owner = 0;
    expect(rent(game.state, 5, 7)).toBe(150);
    game.state.properties[35]!.owner = 0;
    expect(rent(game.state, 5, 7, 2)).toBe(400);
    game.state.players[0]!.jailed = true;
    expect(rent(game.state, 5, 7)).toBe(0);
    game.state.players[0]!.jailed = false;
    game.state.properties[5]!.mortgaged = true;
    expect(rent(game.state, 5, 7)).toBe(0);
  });
});

describe('repair card notices', () => {
  it.each([
    [1000, 'Sửa chữa: 40 mỗi nhà, 115 mỗi khách sạn: −40'],
    [0, 'Sửa chữa: 40 mỗi nhà, 115 mỗi khách sạn: cần trả 40. Bán nhà hoặc thế chấp để trả nợ.'],
  ])('joins the charge detail cleanly with %s cash', (cash, notice) => {
    const game = testGame(plugin, ['a', 'b']);
    game.state.chest = [CHEST.findIndex((card) => card.kind === 'repairs')];
    game.state.players[0]!.cash = cash;
    game.state.properties[1]!.owner = 0;
    game.state.properties[1]!.houses = 1;

    move(game.state, 0, 17, false, 7);
    resolveSpecialEvent(game.state, () => 0);

    expect(game.state.notice).toBe(notice);
  });
});

describe('station fee payments', () => {
  it.each([1, 2, 3, 4])('charges 50 times %s owned stations directly to the owner', (count) => {
    const game = testGame(plugin, ['a', 'b']);
    for (const square of [5, 15, 25, 35].slice(0, count)) game.state.properties[square]!.owner = 1;
    move(game.state, 0, 5, false, 7);
    expect(game.state.transfers).toContainEqual({
      from: 0,
      to: 1,
      amount: 50 * count,
      reason: 'Tiền thuê Bến Bắc',
    });
    expect(game.state.players.map((p) => p.cash)).toEqual([1000 - 50 * count, 1000 + 50 * count]);
    const before = game.state.players[1]!.cash;
    move(game.state, 1, 5, false, 7);
    expect(game.state.players[1]!.cash).toBe(before);
  });

  it('doubles nearest-station rent and creates rent debt when cash is short', () => {
    const game = testGame(plugin, ['a', 'b']);
    game.state.properties[25]!.owner = 1;
    game.state.chance = [
      CHANCE.findIndex((card) => card.kind === 'nearest' && card.target === 'station'),
    ];
    move(game.state, 0, 22, false, 7);
    resolveSpecialEvent(game.state, () => 0);
    expect(game.state.transfers.at(-1)).toMatchObject({ from: 0, to: 1, amount: 100 });
    game.state.players[0]!.cash = 49;
    move(game.state, 0, 25, false, 7);
    expect(game.state.debt).toMatchObject({ creditor: 1, amount: 50 });
  });
});
