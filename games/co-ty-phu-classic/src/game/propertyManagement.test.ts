import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { botMove } from './bot.js';
import { copy, mortgageStatus, move } from './rules.js';

const ids = ['a', 'b', 'c', 'd'];
const fixture = () => testGame(plugin, ids);
const end = (game: ReturnType<typeof fixture>) => {
  game.state.phase = 'end';
  game.send(ids[game.state.turn]!, 'end-turn');
};
const returnToBorrower = (game: ReturnType<typeof fixture>) => {
  end(game);
  while (game.state.turn !== 0) end(game);
};

describe('declining an unowned street', () => {
  it.each([0, 1000])('lets a buyer with %s cash skip an unowned property', (cash) => {
    const game = fixture();
    game.state.players[0]!.cash = cash;
    move(game.state, 0, 3, false, 3);
    expect(game.error('b', 'end-turn')).toBeTruthy();
    expect(game.error('a', 'auction', { square: 3 })).toBeTruthy();
    game.send('a', 'end-turn');
    expect(game.state.turn).toBe(1);
    expect(game.state.pending).toBeNull();
    expect(game.state.properties[3]!.owner).toBeNull();
    expect(game.state.players[0]!.cash).toBe(cash);
    expect(game.state.phase).toBe('roll');
  });

  it('preserves the extra roll if the declined landing followed doubles', () => {
    const game = fixture();
    game.state.after = 'roll';
    game.state.doubles = 1;
    move(game.state, 0, 3, false, 2);
    game.send('a', 'end-turn');
    expect(game.state.turn).toBe(0);
    expect(game.state.phase).toBe('roll');
    expect(game.state.pending).toBeNull();
    expect(game.state.doubles).toBe(1);
    expect(game.state.after).toBe('roll');
  });

  it('lets a cash-poor bot end the purchase decision', () => {
    const game = fixture();
    game.state.players[0]!.cash = 10;
    move(game.state, 0, 3, false, 3);
    expect(botMove(game.state, 0)?.event).toBe('end-turn');
  });
});

describe('personal asset auctions are unavailable', () => {
  it.each([1, 5, 12])('rejects auctioning owned square %s without changing its owner', (square) => {
    const game = fixture();
    game.state.properties[square]!.owner = 0;
    expect(game.error('a', 'auction', { square })).toBeTruthy();
    expect(game.state.properties[square]!.owner).toBe(0);
    expect(game.state.phase).toBe('roll');
  });
});

describe('three personal turns to redeem a mortgage', () => {
  it('permits remote management in the owner’s turn and rejects other seats', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.state.properties[3]!.owner = 1;
    expect(game.error('b', 'mortgage', { square: 3 })).toBe('Chưa tới lượt bạn');
    game.send('a', 'mortgage', { square: 1 });
    expect(game.state.properties[1]!.mortgage).toEqual({
      borrower: 0,
      deadline: 4,
      principal: 100,
    });
    const previous = game.state;
    expect(copy(previous).properties[1]!.mortgage).not.toBe(previous.properties[1]!.mortgage);
    end(game);
    expect(game.error('a', 'redeem', { square: 1 })).toBe('Chưa tới lượt bạn');
    expect(previous.playerTurns).toEqual([1, 0, 0, 0]);
  });

  it('forecloses only at the end of the third subsequent turn, including jailed turns', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    game.leave('c');
    for (let turn = 1; turn <= 3; turn++) {
      returnToBorrower(game);
      expect(game.state.properties[1]!.owner).toBe(0);
      expect(game.state.playerTurns[0]).toBe(turn + 1);
      expect(mortgageStatus(game.state, game.state.properties[1]!)).toBe(
        turn === 3 ? 'Chuộc: hết lượt này' : `Chuộc: còn ${4 - turn} lượt`,
      );
      game.state.players[0]!.jailed = true;
    }
    end(game);
    expect(game.state.properties[1]).toMatchObject({ owner: null, houses: 0, mortgaged: false });
    expect(game.state.properties[1]!.mortgage).toBeUndefined();
    expect(game.state.notice).toContain('Thu hồi Phú Quốc');
    expect(game.error('a', 'redeem', { square: 1 })).toBeTruthy();
    move(game.state, 1, 1, false, 3);
    game.send('b', 'buy');
    expect(game.state.properties[1]!.owner).toBe(1);
  });

  it('allows redemption during the third turn and starts a fresh deadline on a new loan', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    for (let i = 0; i < 3; i++) returnToBorrower(game);
    game.send('a', 'redeem', { square: 1 });
    expect(game.state.properties[1]!.mortgage).toBeUndefined();
    game.send('a', 'mortgage', { square: 1 });
    expect(game.state.properties[1]!.mortgage?.deadline).toBe(7);
    end(game);
    expect(game.state.properties[1]!.owner).toBe(0);
  });

  it('does not count additional rolls, property actions or other seats’ turns', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.state.properties[3]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    game.send('a', 'mortgage', { square: 3 }).send('a', 'redeem', { square: 3 });
    for (let i = 0; i < 3; i++) {
      game.state.after = 'roll';
      move(game.state, 0, 10, false, 2);
      game.send('a', 'roll');
      if (game.state.phase === 'event') game.send('a', 'confirm-event');
      game.state.phase = 'roll';
    }
    expect(game.state.playerTurns[0]).toBe(1);
    end(game);
    end(game);
    expect(game.state.playerTurns[0]).toBe(1);
    expect(game.state.properties[1]!.owner).toBe(0);
  });

  it('keeps the original borrower’s deadline after a transfer', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    game.send('a', 'offer-trade', { to: 1, give: 1, take: -1, giveCash: 0, takeCash: 0 });
    game.send('b', 'accept-trade');
    for (let i = 0; i < 3; i++) returnToBorrower(game);
    expect(game.state.properties[1]!.owner).toBe(1);
    end(game);
    expect(game.state.properties[1]!.owner).toBeNull();
  });

  it('clears loans on borrower bankruptcy instead of leaving an unreachable deadline', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 });
    game.state.players[0]!.cash = 0;
    Object.assign(game.state, {
      phase: 'debt',
      debt: { amount: 1, creditor: 1, reason: 'Thuê', after: 'end' },
    });
    game.send('a', 'bankrupt');
    expect(game.state.properties[1]).toMatchObject({ owner: null, mortgaged: false });
    expect(game.state.playerTurns[1]).toBe(1);
  });
});

describe('buildings must be sold before their deed is mortgaged', () => {
  it('pays half the building cost first and mortgages the land price only', () => {
    const game = fixture();
    Object.assign(game.state.properties[1]!, { owner: 0, houses: 2 });
    expect(game.error('a', 'mortgage', { square: 1 })).toBe(
      'Phải bán hết công trình trên ô đất trước khi thế chấp',
    );
    expect(game.state.players[0]!.cash).toBe(1000);
    expect(game.state.properties[1]!.mortgaged).toBe(false);

    game.send('a', 'sell-house', { square: 1 });
    game.send('a', 'sell-house', { square: 1 });
    expect(game.state.players[0]!.cash).toBe(1100);
    expect(game.state.transfers.map((transfer) => transfer.amount)).toEqual([50]);
    expect(game.state.properties[1]!.houses).toBe(0);

    game.send('a', 'mortgage', { square: 1 });
    expect(game.state.players[0]!.cash).toBe(1200);
    expect(game.state.properties[1]).toMatchObject({
      houses: 0,
      mortgaged: true,
      mortgage: { principal: 100, deadline: 4 },
    });
    expect(game.error('a', 'sell-house', { square: 1 })).toBeTruthy();
    game.send('a', 'redeem', { square: 1 });
    expect(game.state.players[0]!.cash).toBe(1090);
    expect(game.state.properties[1]).toMatchObject({ houses: 0, mortgaged: false });
  });

  it('rejects a whole batch without paying or pledging any deed if one choice is invalid', () => {
    const game = fixture();
    game.state.properties[1]!.owner = 0;
    game.state.properties[3]!.owner = 1;
    for (const squares of [[], [1, 1], [1, 3], [1, 12]]) {
      expect(game.error('a', 'mortgage', { squares })).toBeTruthy();
      expect(game.state.properties[1]!.mortgaged).toBe(false);
      expect(game.state.players[0]!.cash).toBe(1000);
      expect(game.state.transfers).toEqual([]);
    }
    game.send('a', 'mortgage', { squares: [1] });
    expect(game.error('a', 'mortgage', { squares: [1] })).toBeTruthy();
    expect(game.state.players[0]!.cash).toBe(1100);
  });

  it('rounds the whole redemption up without adding a floating point extra unit', () => {
    const game = fixture();
    game.state.properties[2]!.owner = 0;
    game.send('a', 'mortgage', { squares: [2] });
    expect(game.state.properties[2]!.mortgage?.principal).toBe(75);
    game.send('a', 'redeem', { square: 2 });
    expect(game.state.transfers[0]?.amount).toBe(83);
    game.state.properties[1]!.owner = 0;
    game.send('a', 'mortgage', { square: 1 }).send('a', 'redeem', { square: 1 });
    expect(game.state.transfers[0]?.amount).toBe(110);
  });

  it('rounds a half building price to the nearest whole currency unit', () => {
    const game = fixture();
    const deed = game.state.properties[2];
    if (!deed) throw new Error('Missing Lào Cai deed');
    deed.owner = 0;
    deed.houses = 1;

    game.send('a', 'sell-house', { square: 2 });

    expect(game.state.players[0]?.cash).toBe(1038);
    expect(game.state.transfers[0]).toMatchObject({ amount: 38, reason: 'Bán nhà ở Lào Cai' });
    expect(game.state.notice).toBe('Bán nhà ở Lào Cai, nhận 38.');
  });

  it('uses the rounded per-level sale price when liquidating buildings in bankruptcy', () => {
    const game = fixture();
    const deed = game.state.properties[2];
    if (!deed) throw new Error('Missing Lào Cai deed');
    deed.owner = 0;
    deed.houses = 2;

    game.send('a', 'bankrupt');

    expect(game.state.transfers[0]).toMatchObject({ amount: 76, reason: 'Thanh lý nhà' });
  });
});
