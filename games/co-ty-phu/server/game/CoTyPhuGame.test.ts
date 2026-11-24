import { optionsSchema, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { CoTyPhuGame } from './CoTyPhuGame.js';
import type { Player, State } from './model.js';
import { TUNING } from './tuning.js';

const PLAYERS = ['a', 'b', 'c', 'd'];

/**
 * A Match whose dice come from `rolls` in order, after `arrange` changed its first state.
 */
function open({
  rolls = [] as [number, number][],
  arrange = (s: State) => s,
  players = PLAYERS.slice(0, 2),
  speed = 'normal' as 'normal' | 'fast',
} = {}) {
  const game = new CoTyPhuGame({
    dice: (_, roll) => {
      const next = rolls[roll];
      if (!next) throw new Error('the test ran out of dice');
      return next;
    },
    arrange,
  });
  return testGame(game, players, { options: optionsSchema(manifest).parse({ speed }) });
}

describe('starting', () => {
  it('puts everyone on Xuất phát with 1000, the first seat to roll', () => {
    const game = open({ players: PLAYERS });
    expect(game.state.players).toHaveLength(4);
    expect(game.state.players[0]).toEqual({
      cash: 1000,
      tile: 0,
      jailed: false,
      jailTries: 0,
      jailCards: 0,
      bankrupt: false,
    });
    expect(game.state).toMatchObject({ turn: 0, phase: 'roll', dice: null });
    expect(game.state.lots.every((l) => l === null)).toBe(true);
  });
});

describe('rolling', () => {
  it('moves by the dice, then the next seat rolls', () => {
    const game = open({ rolls: [[3, 4]] }).send('a', 'roll');
    expect(game.state.players[0]?.tile).toBe(7);
    expect(game.state.dice).toEqual([3, 4]);
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
  });

  it('refuses a roll out of turn', () => {
    expect(open().error('b', 'roll')).toBe('Chưa tới lượt bạn');
  });
});

/** Changes one player's first state. */
const player =
  (seat: number, patch: Partial<Player>) =>
  (s: State): State => ({
    ...s,
    players: s.players.map((p, i) => (i === seat ? { ...p, ...patch } : p)),
  });

/** `owner` owns `tiles` at `level`, with `built` paid for each. */
const own =
  (owner: number, tiles: number[], level = 1, built = 0) =>
  (s: State): State => ({
    ...s,
    lots: s.lots.map((l, i) => (tiles.includes(i) ? { owner, level, built } : l)),
  });

const all =
  (...steps: ((s: State) => State)[]) =>
  (s: State) =>
    steps.reduce((acc, step) => step(acc), s);

const cash = (game: { state: State }) => game.state.players.map((p) => p.cash);

describe('moving', () => {
  it('pays 200 for passing Xuất phát', () => {
    const game = open({ rolls: [[1, 2]], arrange: player(0, { tile: 38 }) }).send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ tile: 1, cash: 1200 });
  });

  it('rolls again after a double, once the Tile is settled', () => {
    const game = open({
      rolls: [
        [2, 2],
        [1, 2],
      ],
    }).send('a', 'roll');
    expect(game.state).toMatchObject({ turn: 0, phase: 'roll' });
    expect(game.state.players[0]).toMatchObject({ tile: 4, cash: 900 });
    game.send('a', 'roll');
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
    expect(game.state.players[0]?.tile).toBe(7);
  });

  it('sends a third double in one turn straight to jail', () => {
    const game = open({
      rolls: [
        [1, 1],
        [1, 1],
        [3, 3],
      ],
    });
    game.send('a', 'roll').send('a', 'pass').send('a', 'roll').send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ tile: 10, jailed: true });
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
  });
});

describe('buying', () => {
  it('buys a City with Nhà 1', () => {
    const game = open({ rolls: [[1, 2]] }).send('a', 'roll');
    expect(game.state.phase).toBe('buy');
    game.send('a', 'buy');
    expect(game.state.lots[3]).toEqual({ owner: 0, level: 1, built: 0 });
    expect(cash(game)).toEqual([820, 1000]);
    expect(game.state.turn).toBe(1);
  });

  it('buys a station or a utility without Levels', () => {
    const game = open({ rolls: [[2, 3]] })
      .send('a', 'roll')
      .send('a', 'buy');
    expect(game.state.lots[5]).toEqual({ owner: 0, level: 0, built: 0 });
    expect(cash(game)).toEqual([800, 1000]);
  });

  it('offers nothing to someone who cannot pay', () => {
    const game = open({ rolls: [[1, 2]], arrange: player(0, { cash: 100 }) }).send('a', 'roll');
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
    expect(game.state.lots[3]).toBeNull();
  });

  it('only buys what the Tile offers, in turn', () => {
    const game = open({ rolls: [[1, 2]] });
    expect(game.error('a', 'buy')).toBe('Chưa thể làm việc này lúc này');
    expect(game.error('a', 'pass')).toBe('Hãy gieo xúc xắc');
    game.send('a', 'roll');
    expect(game.error('b', 'buy')).toBe('Chưa tới lượt bạn');
  });
});

describe('Levels', () => {
  it('builds one Level for half the land price on landing on your own City', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(0, [3]) }).send('a', 'roll');
    expect(game.state.phase).toBe('upgrade');
    game.send('a', 'upgrade');
    expect(game.state.lots[3]).toEqual({ owner: 0, level: 2, built: 90 });
    expect(cash(game)).toEqual([910, 1000]);
  });

  it('stops at the Hotel and never builds on a station', () => {
    const hotel = open({ rolls: [[1, 2]], arrange: own(0, [3], 5, 90) }).send('a', 'roll');
    expect(hotel.state).toMatchObject({ turn: 1, phase: 'roll' });
    const station = open({ rolls: [[2, 3]], arrange: own(0, [5], 0) }).send('a', 'roll');
    expect(station.state).toMatchObject({ turn: 1, phase: 'roll' });
  });
});

describe('rent', () => {
  it('follows the Level', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(1, [3], 2, 90) }).send('a', 'roll');
    expect(cash(game)).toEqual([802, 1198]);
  });

  it('doubles on a Full set', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(1, [1, 2, 3]) }).send('a', 'roll');
    expect(cash(game)).toEqual([856, 1144]);
  });

  it('charges 50 per station the owner has', () => {
    const game = open({ rolls: [[2, 3]], arrange: own(1, [5, 15], 0) }).send('a', 'roll');
    expect(cash(game)).toEqual([900, 1100]);
  });

  it('charges the dice ×4 for one utility, ×10 for both', () => {
    const one = open({ rolls: [[2, 3]], arrange: all(player(0, { tile: 7 }), own(1, [12], 0)) });
    expect(cash(one.send('a', 'roll'))).toEqual([980, 1020]);
    const both = open({
      rolls: [[2, 3]],
      arrange: all(player(0, { tile: 7 }), own(1, [12, 28], 0)),
    });
    expect(cash(both.send('a', 'roll'))).toEqual([950, 1050]);
  });

  it('is not charged while the owner is in jail', () => {
    const game = open({
      rolls: [[1, 2]],
      arrange: all(own(1, [3], 3, 180), player(1, { tile: 10, jailed: true })),
    }).send('a', 'roll');
    expect(cash(game)).toEqual([1000, 1000]);
  });
});

describe('Takeover', () => {
  it('buys the Lot after the rent for 1.5 × (land + Levels), with its Levels', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(1, [3], 2, 90) }).send('a', 'roll');
    expect(game.state.phase).toBe('takeover');
    game.send('a', 'takeover');
    expect(cash(game)).toEqual([1000 - 198 - 405, 1000 + 198 + 405]);
    expect(game.state.lots[3]).toEqual({ owner: 0, level: 2, built: 90 });
  });

  it('may build a Level at once', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(1, [3], 2, 90) });
    game.send('a', 'roll').send('a', 'takeover');
    expect(game.state.phase).toBe('upgrade');
    game.send('a', 'upgrade');
    expect(game.state.lots[3]).toEqual({ owner: 0, level: 3, built: 180 });
    expect(game.state.turn).toBe(1);
  });

  it('is refused when passed and impossible on a Hotel', () => {
    const passed = open({ rolls: [[1, 2]], arrange: own(1, [3], 2, 90) });
    passed.send('a', 'roll').send('a', 'pass');
    expect(passed.state.lots[3]?.owner).toBe(1);
    const hotel = open({
      rolls: [[1, 2]],
      arrange: all(own(1, [3], 5, 360), player(0, { cash: 5000 })),
    }).send('a', 'roll');
    expect(hotel.state).toMatchObject({ turn: 1, phase: 'roll' });
    expect(cash(hotel)).toEqual([4100, 1900]);
  });
});

describe('special Tiles', () => {
  it('flies from Sân bay to any other Tile for 100', () => {
    const game = open({ rolls: [[2, 3]], arrange: player(0, { tile: 15 }) }).send('a', 'roll');
    expect(game.state.phase).toBe('fly');
    expect(game.error('a', 'fly', { to: 20 })).toBe('Bạn đang ở Sân bay');
    game.send('a', 'fly', { to: 39 });
    expect(game.state.players[0]).toMatchObject({ tile: 39, cash: 900 });
    expect(game.state.phase).toBe('buy');
  });

  it('pays 200 for a flight that lands on Xuất phát, nothing for flying past it', () => {
    const start = open({ rolls: [[2, 3]], arrange: player(0, { tile: 15 }) });
    start.send('a', 'roll').send('a', 'fly', { to: 0 });
    expect(start.state.players[0]?.cash).toBe(1100);
    const past = open({ rolls: [[2, 3]], arrange: player(0, { tile: 15 }) });
    past.send('a', 'roll').send('a', 'fly', { to: 4 });
    expect(past.state.players[0]?.cash).toBe(800);
  });

  it('taxes 10% of cash, at least 100 (income) or 200 (luxury)', () => {
    const income = open({ rolls: [[1, 3]] }).send('a', 'roll');
    expect(cash(income)).toEqual([900, 1000]);
    const luxury = open({ rolls: [[1, 2]], arrange: player(0, { tile: 35, cash: 3000 }) });
    expect(cash(luxury.send('a', 'roll'))).toEqual([2700, 1000]);
  });

  it('sends Vào tù to jail and loses the double', () => {
    const game = open({ rolls: [[2, 2]], arrange: player(0, { tile: 26 }) }).send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ tile: 10, jailed: true, jailTries: 0 });
    expect(game.state.turn).toBe(1);
  });

  it('treats Cơ hội and Khí vận as empty for now', () => {
    const game = open({ rolls: [[3, 4]] }).send('a', 'roll');
    expect(cash(game)).toEqual([1000, 1000]);
    expect(game.state.turn).toBe(1);
  });
});

describe('jail', () => {
  const jailed = (patch: Partial<Player> = {}) => player(0, { tile: 10, jailed: true, ...patch });

  it('stays in after a roll that is not a double', () => {
    const game = open({ rolls: [[1, 2]], arrange: jailed() }).send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ tile: 10, jailed: true, jailTries: 1 });
    expect(game.state.turn).toBe(1);
  });

  it('walks out on a double, without rolling again', () => {
    const game = open({ rolls: [[3, 3]], arrange: jailed() }).send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ tile: 16, jailed: false });
    game.send('a', 'pass');
    expect(game.state.turn).toBe(1);
  });

  it('lets out on the third roll anyway, which can no longer be paid', () => {
    const game = open({ rolls: [[1, 2]], arrange: jailed({ jailTries: 2 }) });
    expect(game.error('a', 'pay-bail')).toBe('Lần này phải gieo');
    game.send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ tile: 13, jailed: false });
  });

  it('pays 50 to get out before rolling', () => {
    const game = open({ rolls: [[1, 2]], arrange: jailed() }).send('a', 'pay-bail');
    expect(game.state.players[0]).toMatchObject({ jailed: false, cash: 950 });
    expect(game.state.phase).toBe('roll');
    game.send('a', 'roll');
    expect(game.state.players[0]?.tile).toBe(13);
  });

  it('uses a jail-free Card', () => {
    expect(open({ arrange: jailed() }).error('a', 'use-card')).toBe('Bạn không có vé ra tù');
    const game = open({ arrange: jailed({ jailCards: 1 }) }).send('a', 'use-card');
    expect(game.state.players[0]).toMatchObject({ jailed: false, jailCards: 0, cash: 1000 });
  });
});

describe('the decision clock', () => {
  it('runs 15 s, or 10 s when "Tốc độ" is Nhanh', () => {
    expect(open().timer).toEqual({ event: 'timeout', ms: 15_000 });
    expect(open({ speed: 'fast' }).timer).toEqual({ event: 'timeout', ms: 10_000 });
  });

  it('rolls for a player out of time, then passes every offer', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(1, [3], 2, 90) }).fireTimer();
    expect(game.state.phase).toBe('takeover');
    game.fireTimer();
    expect(game.state.lots[3]?.owner).toBe(1);
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
  });
});

describe('Bankruptcy', () => {
  it('ends the Match when one player is left', () => {
    const game = open({
      rolls: [[1, 2]],
      arrange: all(own(1, [3], 5, 360), player(0, { cash: 100 }), own(0, [5], 0)),
    }).send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ bankrupt: true, cash: 0 });
    expect(game.state.players[1]?.cash).toBe(1200);
    expect(game.state.lots[5]).toBeNull();
    expect(game.result?.seats.map((s) => s.place)).toEqual([2, 1]);
  });

  it('skips the bankrupt and ranks players by when they went bankrupt', () => {
    const game = open({
      players: ['a', 'b', 'c'],
      rolls: [
        [1, 2],
        [1, 2],
        [1, 2],
      ],
      arrange: all(own(1, [3], 5, 360), player(0, { cash: 100 }), player(2, { cash: 100 })),
    });
    game.send('a', 'roll');
    expect(game.state.turn).toBe(1);
    expect(game.result).toBeNull();
    game.send('b', 'roll');
    game.send('c', 'roll');
    expect(game.result?.seats.map((s) => s.place)).toEqual([3, 1, 2]);
  });
});

/** a has 100 and lands on b's Việt Trì (Nhà 2, rent 198): 98 short. */
const short = (...steps: ((s: State) => State)[]) =>
  open({ rolls: [[1, 2]], arrange: all(own(1, [3], 2, 90), player(0, { cash: 100 }), ...steps) });

describe('Debt', () => {
  it('waits for the debtor to Sell, with a suggested sale in the view', () => {
    const game = short(own(0, [1], 3, 200)).send('a', 'roll');
    expect(game.state).toMatchObject({ turn: 0, phase: 'debt' });
    expect((game.view('b') as State).debt).toEqual({
      from: 0,
      to: 1,
      amount: 198,
      suggested: [{ tile: 1, levels: 2 }],
    });
    expect(cash(game)).toEqual([100, 1000]);
  });

  it('is covered by Selling Levels for half their price, before any Lot', () => {
    const game = short(own(0, [1], 3, 200), own(0, [15], 0)).send('a', 'roll');
    expect(game.state.debt?.suggested).toEqual([{ tile: 1, levels: 2 }]);
    game.send('a', 'sell', { sale: game.state.debt?.suggested });
    expect(cash(game)).toEqual([2, 1198]);
    expect(game.state.lots[1]).toEqual({ owner: 0, level: 1, built: 0 });
    expect(game.state.lots[15]?.owner).toBe(0);
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll', debt: null });
  });

  it('Sells a whole Lot for half its land and Levels, which then has no owner', () => {
    const game = short(own(0, [1], 3, 200)).send('a', 'roll');
    game.send('a', 'sell', { sale: [{ tile: 1 }] });
    expect(cash(game)).toEqual([100 + 200 - 198, 1198]);
    expect(game.state.lots[1]).toBeNull();
  });

  it('suggests the cheapest Lot that covers it and keeps the Full set', () => {
    const game = short(own(0, [11, 13, 14]), own(0, [15], 0), own(0, [19])).send('a', 'roll');
    expect(game.state.debt?.suggested).toEqual([{ tile: 15 }]);
    const small = short(
      own(0, [11, 13, 14]),
      own(0, [15], 0),
      own(0, [19]),
      player(0, { cash: 150 }),
    );
    expect(small.send('a', 'roll').state.debt?.suggested).toEqual([{ tile: 19 }]);
  });

  it('Sells from a Full set only when the rest is not enough', () => {
    const game = short(own(0, [11, 13, 14]), own(0, [19]), player(0, { cash: 0 })).send(
      'a',
      'roll',
    );
    expect(game.state.debt?.suggested).toEqual([{ tile: 14 }, { tile: 19 }]);
  });

  it('keeps the Levels of a Full set until the lone Lots are sold', () => {
    const game = short(own(0, [11, 13, 14]), own(0, [11], 3, 220), own(0, [15], 0));
    expect(game.send('a', 'roll').state.debt?.suggested).toEqual([{ tile: 15 }]);
  });

  it('leaves out Levels the Lot it had to Sell makes needless', () => {
    const game = short(own(0, [9], 2, 175), own(0, [15], 0)).send('a', 'roll');
    expect(game.state.debt?.suggested).toEqual([{ tile: 15 }]);
  });

  it('still offers the Takeover once the rent is paid', () => {
    const game = short(own(0, [9], 5, 700)).send('a', 'roll');
    game.send('a', 'sell', { sale: [{ tile: 9 }] });
    expect(cash(game)).toEqual([100 + 525 - 198, 1198]);
    expect(game.state.phase).toBe('takeover');
  });

  it('refuses a sale that is short, or not the debtor’s to make', () => {
    const game = short(own(0, [1], 3, 200), own(1, [5], 0)).send('a', 'roll');
    expect(game.error('a', 'sell', { sale: [{ tile: 1, levels: 1 }] })).toBe(
      'Bán chưa đủ để trả nợ',
    );
    expect(game.error('a', 'sell', { sale: [{ tile: 5 }] })).toBe('Bạn không có đất này');
    expect(game.error('a', 'sell', { sale: [{ tile: 1, levels: 3 }] })).toBe(
      'Không bán được chừng ấy cấp',
    );
    expect(game.error('a', 'sell', { sale: [{ tile: 1 }, { tile: 1 }] })).toBe(
      'Mỗi ô chỉ bán một lần',
    );
    expect(game.error('b', 'sell', { sale: [{ tile: 5 }] })).toBe('Bạn không có nợ');
    expect(game.error('a', 'pass')).toBe('Hãy bán đất để trả nợ');
    expect(open().error('a', 'sell', { sale: [] })).toBe('Chưa thể làm việc này lúc này');
  });

  it('makes the suggested sale when the clock runs out', () => {
    const game = short(own(0, [1], 3, 200))
      .send('a', 'roll')
      .fireTimer();
    expect(cash(game)).toEqual([2, 1198]);
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
  });

  it('rolls again after a double once the Debt is paid', () => {
    const game = open({
      rolls: [[1, 1]],
      arrange: all(own(1, [2]), own(0, [15], 0), player(0, { cash: 50 })),
    }).send('a', 'roll');
    game.send('a', 'sell', { sale: [{ tile: 15 }] });
    expect(cash(game)).toEqual([90, 1060]);
    expect(game.state).toMatchObject({ turn: 0, phase: 'roll' });
  });

  it('is a tax owed to the bank too', () => {
    const game = open({
      rolls: [[1, 3]],
      arrange: all(own(0, [15], 0), player(0, { cash: 50 })),
    }).send('a', 'roll');
    expect(game.state.debt).toMatchObject({ from: 0, to: null, amount: 100 });
    game.send('a', 'sell', { sale: [{ tile: 15 }] });
    expect(cash(game)).toEqual([50, 1000]);
  });
});

describe('Bankruptcy after Selling', () => {
  it('Sells everything, the creditor gets the cash up to the Debt, the Cards are lost', () => {
    const game = open({
      players: ['a', 'b', 'c'],
      rolls: [[1, 2]],
      arrange: all(
        own(1, [3], 5, 360),
        own(0, [1], 3, 200),
        player(0, { cash: 100, jailCards: 1 }),
      ),
    });
    game.send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ bankrupt: true, cash: 0, jailCards: 0 });
    expect(cash(game)).toEqual([0, 1000 + 100 + 200, 1000]);
    expect(game.state.lots[1]).toBeNull();
    expect(game.state.phase).toBe('roll');
    expect(game.state.turn).toBe(1);
  });

  it('ends the Match on a tax nobody can pay', () => {
    const broke = open({ rolls: [[1, 3]], arrange: player(0, { cash: 40 }) }).send('a', 'roll');
    expect(broke.state.players[0]).toMatchObject({ bankrupt: true, cash: 0 });
    expect(broke.result?.seats.map((s) => s.place)).toEqual([2, 1]);
  });
});

describe('the computer', () => {
  it('rolls, passes every offer and makes the suggested sale', () => {
    const game = short(own(0, [1], 3, 200));
    expect(game.bot('a')).toEqual({ event: 'roll' });
    expect(game.bot('b')).toBeNull();
    game.send('a', 'roll');
    expect(game.bot('a')).toEqual({ event: 'sell', payload: { sale: [{ tile: 1, levels: 2 }] } });
    expect(game.bot('b')).toBeNull();
    const offer = open({ rolls: [[1, 2]] }).send('a', 'roll');
    expect(offer.bot('a')).toEqual({ event: 'pass' });
  });
});

describe('tuning', () => {
  it('scales City prices, and what follows from them', () => {
    const game = testGame(
      new CoTyPhuGame({ tuning: { ...TUNING, cityPrice: 2 }, dice: () => [1, 2] }),
      PLAYERS.slice(0, 2),
      { options: optionsSchema(manifest).parse({}) },
    ).send('a', 'roll');
    game.send('a', 'buy');
    expect(game.state.players[0]?.cash).toBe(640);
  });
});
