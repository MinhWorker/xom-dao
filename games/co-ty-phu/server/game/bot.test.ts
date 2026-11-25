import { describe, expect, it } from 'vitest';
import { AIRPORT_TILE, JAIL_TILE } from './board.js';
import { thinkMs } from './bot.js';
import { all, open, own, player } from './test-match.js';

describe('the computer buying and building', () => {
  it('buys a Lot it can afford and keep a reserve after', () => {
    const game = open({ rolls: [[1, 2]] }).send('a', 'roll');
    expect(game.bot('a')).toEqual({ event: 'buy' });
  });

  it('passes a Lot that would leave it short of its reserve', () => {
    const game = open({ rolls: [[1, 2]], arrange: player(0, { cash: 300 }) }).send('a', 'roll');
    expect(game.bot('a')).toEqual({ event: 'pass' });
  });

  it('keeps more back when someone else owns a dear Lot', () => {
    const arrange = all(own(1, [36, 37, 39], 4), player(0, { cash: 700 }));
    const game = open({ rolls: [[1, 2]], arrange }).send('a', 'roll');
    expect(game.bot('a')).toEqual({ event: 'pass' });
  });

  it('buys the last City of a Colour set someone else is gathering, even short of its reserve', () => {
    const arrange = all(own(1, [1, 2], 1), player(0, { cash: 400 }));
    const game = open({ rolls: [[1, 2]], arrange }).send('a', 'roll');
    expect(game.bot('a')).toEqual({ event: 'buy' });
  });

  it('builds on its own City while it keeps its reserve', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(0, [3], 1) }).send('a', 'roll');
    expect(game.bot('a')).toEqual({ event: 'upgrade' });
  });
});

describe('the computer taking over', () => {
  it('takes over a City that breaks up a Full set', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(1, [1, 2, 3], 1) }).send('a', 'roll');
    expect(game.state.phase).toBe('takeover');
    expect(game.bot('a')).toEqual({ event: 'takeover' });
  });

  it('takes over a City that completes its own Colour set', () => {
    const arrange = all(own(0, [1, 2], 1), own(1, [3], 1));
    const game = open({ rolls: [[1, 2]], arrange }).send('a', 'roll');
    expect(game.bot('a')).toEqual({ event: 'takeover' });
  });

  it('leaves a City alone when it neither blocks nor completes a set', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(1, [3], 1) }).send('a', 'roll');
    expect(game.bot('a')).toEqual({ event: 'pass' });
  });
});

describe('the computer at Sân bay', () => {
  const atAirport = (arrange = all()) =>
    open({
      rolls: [[1, 2]],
      arrange: all(player(0, { tile: AIRPORT_TILE - 3 }), arrange),
    }).send('a', 'roll');

  it('flies to the unowned City that completes its Colour set', () => {
    const game = atAirport(own(0, [6, 8], 1));
    expect(game.bot('a')).toEqual({ event: 'fly', payload: { to: 9 } });
  });

  it('flies to Xuất phát when no Lot is worth more', () => {
    const arrange = all(
      own(1, [1, 2, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29], 1),
      own(1, [31, 32, 34, 36, 37, 39, 5, 15, 25, 35, 12, 28], 1),
    );
    expect(atAirport(arrange).bot('a')).toEqual({ event: 'fly', payload: { to: 0 } });
  });

  it('stays when the fee would leave it with too little', () => {
    expect(atAirport(player(0, { cash: 200 })).bot('a')).toEqual({ event: 'pass' });
  });
});

describe('the computer in jail', () => {
  const jailed = (patch: object) => player(0, { tile: JAIL_TILE, jailed: true, ...patch });

  it('uses a jail-free Card', () => {
    expect(open({ arrange: jailed({ jailCards: 1 }) }).bot('a')).toEqual({ event: 'use-card' });
  });

  it('pays out early while most Lots are unowned, and waits later on', () => {
    expect(open({ arrange: jailed({}) }).bot('a')).toEqual({ event: 'pay-bail' });
    const late = all(
      jailed({}),
      own(1, [1, 2, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26], 1),
    );
    expect(open({ arrange: late }).bot('a')).toEqual({ event: 'roll' });
  });
});

describe('how long the computer thinks', () => {
  it('waits out the walk it just made, and half as long under Nhanh', () => {
    const rolled = open({ rolls: [[1, 2]] }).send('a', 'roll').state;
    expect(rolled.phase).toBe('buy');
    expect(thinkMs(rolled)).toBe(900 + 170 * 3 + 900);
    expect(thinkMs({ ...rolled, speed: 'fast' })).toBe(Math.round((900 + 170 * 3 + 900) / 2));
  });
});
