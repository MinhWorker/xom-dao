import { optionsSchema, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { CoTyPhuGame } from './CoTyPhuGame.js';
import { CARDS, type CardId, deckOf } from './cards.js';
import type { Effect, State, View } from './model.js';
import { all, cash, open, own, PLAYERS, player } from './test-match.js';

/** `a` draws `id`: from Xuất phát onto Cơ hội (7), or from Nhà tù onto Khí vận (17). */
function draw(
  id: CardId,
  {
    arrange = (s: State) => s,
    rolls = [] as [number, number][],
    players = PLAYERS.slice(0, 2),
    bots = [] as string[],
    seed = 1,
  } = {},
) {
  const chest = CARDS[id].deck === 'chest';
  return open({
    rolls: [[3, 4], ...rolls],
    players,
    bots,
    seed,
    chance: chest ? [] : [id, 'chance-interest'],
    chest: chest ? [id, 'chest-harvest'] : [],
    arrange: all(player(0, { tile: chest ? 10 : 0 }), arrange),
  }).send('a', 'roll');
}

const effect = (id: Effect['id'], turns = 2, fresh = false): Effect => ({ id, turns, fresh });

describe('the decks', () => {
  it('has about 16 Cards in each, one of them jail-free', () => {
    for (const deck of ['chance', 'chest'] as const) {
      const ids = deckOf(deck);
      expect(ids.length).toBeGreaterThanOrEqual(15);
      expect(ids.length).toBeLessThanOrEqual(17);
      expect(ids.filter((id) => CARDS[id].action.kind === 'jail-free')).toHaveLength(1);
    }
  });

  it('is shuffled in secret when the Match starts', () => {
    const start = (seed: number) =>
      testGame(new CoTyPhuGame(), PLAYERS.slice(0, 2), {
        seed,
        options: optionsSchema(manifest).parse({}),
      });
    const one = start(1);
    const two = start(2);
    expect([...one.state.decks.chance].sort()).toEqual([...deckOf('chance')].sort());
    expect([...one.state.decks.chest].sort()).toEqual([...deckOf('chest')].sort());
    expect(one.state.decks.chance).not.toEqual(two.state.decks.chance);
    expect((one.view('a') as View).decks).toEqual({ chance: 16, chest: 16 });
    for (const viewer of ['a', 'b', null])
      one.assertHidden(viewer, one.state.decks.chance, one.state.decks.chest);
  });

  it('puts a drawn Card at the bottom and shows who drew what', () => {
    const game = draw('chance-interest');
    expect(game.state.decks.chance).toEqual(['chance-interest', 'chance-interest']);
    expect(game.state.card).toEqual({ id: 'chance-interest', seat: 0, draw: 1 });
  });
});

describe('Cards paid at once', () => {
  const lots = all(own(0, [1], 3), own(0, [5], 0));
  const cases: [CardId, (s: State) => State, number][] = [
    ['chance-interest', player(0, { cash: 800 }), 880],
    ['chest-wallet', player(0, { cash: 805 }), 725],
    ['chance-upkeep', lots, 950],
    ['chest-harvest', lots, 1060],
    ['chance-repairs', lots, 940],
    ['chest-tourism', lots, 1045],
  ];
  for (const [id, arrange, expected] of cases) {
    it(`${id}: ${CARDS[id].text}`, () => {
      const game = draw(id, { arrange });
      expect(game.state.players[0]?.cash).toBe(expected);
      expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
    });
  }

  it('makes the richest pay the poorest (chance-charity, chest-share)', () => {
    const rich = player(1, { cash: 2000 });
    expect(cash(draw('chance-charity', { arrange: rich }))).toEqual([1150, 1850]);
    expect(cash(draw('chest-share', { arrange: rich }))).toEqual([1100, 1900]);
    expect(cash(draw('chance-charity'))).toEqual([1000, 1000]);
  });

  it('lets the richest Sell for it out of their turn, then the turn goes on', () => {
    const game = draw('chance-charity', {
      arrange: all(player(0, { cash: 50 }), player(1, { cash: 100 }), own(1, [1], 3, 200)),
    });
    expect(game.state).toMatchObject({ phase: 'debt', debt: { from: 1, to: 0, amount: 150 } });
    game.send('b', 'sell', { sale: game.state.debt?.suggested });
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
    expect(game.state.players[0]?.cash).toBe(200);
  });

  it('taxes whoever has the most Hotels (chance-hotel-tax)', () => {
    const game = draw('chance-hotel-tax', { arrange: all(own(1, [1, 2], 5), own(0, [3], 5)) });
    expect(cash(game)).toEqual([1000, 800]);
    expect(cash(draw('chance-hotel-tax'))).toEqual([1000, 1000]);
  });

  it('keeps the jail-free Card out of the deck', () => {
    const game = draw('chance-jail');
    expect(game.state.players[0]?.jailCards).toBe(1);
    expect(game.state.decks.chance).toEqual(['chance-interest']);
  });

  it('gives the jail-free Card back to its deck once it is used', () => {
    const game = open({
      chance: ['chance-interest'],
      arrange: player(0, { tile: 10, jailed: true, jailCards: 1 }),
    }).send('a', 'use-card');
    expect(game.state.decks.chance).toEqual(['chance-interest', 'chance-jail']);
  });
});

describe('Cards that move', () => {
  it('walks to the nearest station or utility, and pays there', () => {
    const station = draw('chance-station', { arrange: own(1, [15], 0) });
    expect(station.state.players[0]?.tile).toBe(15);
    expect(cash(station)).toEqual([950, 1050]);
    const utility = draw('chest-utility');
    expect(utility.state.players[0]?.tile).toBe(28);
    expect(utility.state.phase).toBe('buy');
  });

  it('pays Xuất phát on the way round', () => {
    const game = open({
      rolls: [[1, 1]],
      chest: ['chest-utility'],
      arrange: player(0, { tile: 31 }),
    }).send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ tile: 12, cash: 1200 });
  });

  it('goes back 3 Tiles and lands there (chance-back)', () => {
    const game = draw('chance-back');
    expect(game.state.players[0]).toMatchObject({ tile: 4, cash: 900 });
  });

  it('goes to Xuất phát (chest-start) or to jail (chest-jailed)', () => {
    expect(draw('chest-start').state.players[0]).toMatchObject({ tile: 0, cash: 1200 });
    const jailed = draw('chest-jailed');
    expect(jailed.state.players[0]).toMatchObject({ tile: 10, jailed: true });
    expect(jailed.state.turn).toBe(1);
  });

  it('swaps places with a player of your choice, who is not in jail (chance-swap)', () => {
    const game = draw('chance-swap', {
      players: PLAYERS.slice(0, 3),
      arrange: all(player(1, { tile: 25 }), player(2, { tile: 10, jailed: true })),
    });
    expect(game.state.phase).toBe('card');
    expect(game.error('a', 'pick', { pick: 2 })).toBe('Không chọn được');
    game.send('a', 'pick', { pick: 1 });
    expect(game.state.players.map((p) => p.tile)).toEqual([25, 7, 10]);
    expect(game.state.turn).toBe(1);
  });
});

describe('Cards that ask', () => {
  it('takes the cash, or rolls once more (chance-bonus)', () => {
    const cashIn = draw('chance-bonus').send('a', 'pick', { pick: 0 });
    expect(cash(cashIn)).toEqual([1150, 1000]);
    const rolled = draw('chance-bonus', { rolls: [[1, 2]] }).send('a', 'pick', { pick: 1 });
    expect(rolled.state.players[0]?.tile).toBe(10);
    expect(rolled.state.turn).toBe(1);
  });

  it('takes the cash, or goes to Xuất phát (chest-gift)', () => {
    expect(cash(draw('chest-gift').send('a', 'pick', { pick: 0 }))).toEqual([1120, 1000]);
    const home = draw('chest-gift').send('a', 'pick', { pick: 1 });
    expect(home.state.players[0]).toMatchObject({ tile: 0, cash: 1200 });
  });

  it('waits only for the drawer, who must pick', () => {
    const game = draw('chance-bonus');
    expect(game.error('b', 'pick', { pick: 0 })).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'pass')).toBe('Hãy chọn');
    expect(game.error('a', 'pick', { pick: 2 })).toBe('Không chọn được');
  });

  it('makes the safe pick when the clock runs out', () => {
    const game = draw('chance-bonus');
    expect(game.timer).toMatchObject({ ms: 15_000 });
    game.fireTimer();
    expect(cash(game)).toEqual([1150, 1000]);
  });

  it('does nothing when there is nothing to pick', () => {
    const game = draw('chance-planning');
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
  });
});

describe('Festival', () => {
  it('doubles the rent of a Lot of yours until the next Festival', () => {
    const game = draw('chance-festival', {
      arrange: all(own(0, [9, 11]), own(1, [12], 0), player(1, { tile: 6 })),
      rolls: [[1, 2]],
    });
    expect(game.error('a', 'pick', { pick: 12 })).toBe('Không chọn được');
    game.send('a', 'pick', { pick: 9 });
    expect(game.state.festival).toBe(9);
    game.send('b', 'roll');
    expect(cash(game)).toEqual([1280, 720]);
  });

  it('moves to the Lot of the next Festival', () => {
    const game = draw('chest-festival', {
      arrange: all(own(0, [9]), (s) => ({ ...s, festival: 1 })),
    }).send('a', 'pick', { pick: 9 });
    expect(game.state.festival).toBe(9);
  });
});

describe('Blackout', () => {
  it('stops the rent of someone else’s Lot until your next turn', () => {
    const game = draw('chance-blackout', {
      players: PLAYERS.slice(0, 3),
      arrange: all(own(1, [9]), own(0, [1]), player(2, { tile: 6 })),
      rolls: [
        [1, 2],
        [1, 2],
      ],
    });
    expect(game.error('a', 'pick', { pick: 1 })).toBe('Không chọn được');
    game.send('a', 'pick', { pick: 9 });
    expect(game.state.blackout).toEqual({ tile: 9, by: 0 });
    game.send('b', 'roll').send('b', 'pass').send('c', 'roll');
    expect(cash(game)).toEqual([1000, 1000, 1000]);
    expect(game.state.phase).toBe('takeover');
    game.send('c', 'pass');
    expect(game.state).toMatchObject({ turn: 0, blackout: null });
  });
});

describe('Planning', () => {
  it('builds a Level on a City of yours for free', () => {
    const game = draw('chance-planning', { arrange: all(own(0, [1], 2, 100), own(0, [3], 5)) });
    expect(game.error('a', 'pick', { pick: 3 })).toBe('Không chọn được');
    game.send('a', 'pick', { pick: 1 });
    expect(game.state.lots[1]).toEqual({ owner: 0, level: 3, built: 100 });
    expect(cash(game)).toEqual([1000, 1000]);
  });
});

describe('Quiz', () => {
  it('pays the safe reward', () => {
    expect(cash(draw('chance-quiz').send('a', 'pick', { pick: 0 }))).toEqual([1100, 1000]);
  });

  it('shows the problem to everyone, the answer to nobody, for 20 seconds', () => {
    const game = draw('chest-quiz').send('a', 'pick', { pick: 1 });
    expect(game.state.phase).toBe('quiz');
    expect(game.timer).toMatchObject({ ms: 20_000 });
    const quiz = game.state.quiz;
    expect(quiz).toMatchObject({ seat: 0, picked: null });
    for (const viewer of ['a', 'b', null]) {
      expect((game.view(viewer) as View).quiz).toMatchObject({ text: quiz?.text, answer: null });
    }
    expect(game.error('b', 'answer', { choice: 0 })).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'pass')).toBe('Hãy chọn');
  });

  it('pays four times the safe reward for the right answer, nothing for a wrong one', () => {
    const right = draw('chance-quiz').send('a', 'pick', { pick: 1 });
    const answer = right.state.quiz?.answer as number;
    right.send('a', 'answer', { choice: answer });
    expect(cash(right)).toEqual([1400, 1000]);
    expect((right.view('b') as View).quiz).toMatchObject({ answer, picked: answer });
    expect(right.state.turn).toBe(1);

    const wrong = draw('chance-quiz').send('a', 'pick', { pick: 1 });
    wrong.send('a', 'answer', { choice: ((wrong.state.quiz?.answer as number) + 1) % 4 });
    expect(cash(wrong)).toEqual([1000, 1000]);
  });

  it('pays nothing when time runs out', () => {
    const game = draw('chance-quiz').send('a', 'pick', { pick: 1 });
    game.fireTimer();
    expect(cash(game)).toEqual([1000, 1000]);
    expect(game.state.quiz?.picked).toBeNull();
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
  });
});

describe('Effects', () => {
  it('Thần tài doubles the rent its holder collects (chance-lucky)', () => {
    const game = draw('chance-lucky', {
      arrange: all(own(0, [9]), player(1, { tile: 6 })),
      rolls: [[1, 2]],
    });
    expect(game.state.players[0]?.effects).toEqual([effect('lucky', 2, false)]);
    game.send('b', 'roll');
    expect(cash(game)).toEqual([1280, 720]);
  });

  it('Kẹt xe rolls one die, which is never a double (chance-traffic, chest-traffic)', () => {
    for (const id of ['chance-traffic', 'chest-traffic'] as const) {
      const game = draw(id, {
        arrange: player(1, { cash: 50 }),
        rolls: [
          [1, 2],
          [2, 2],
        ],
      });
      game.send('b', 'roll').send('a', 'roll');
      expect(game.state.dice).toEqual([2]);
      expect(game.state.players[0]?.tile).toBe(id === 'chance-traffic' ? 9 : 19);
      expect(game.state.again).toBe(false);
    }
  });

  it('Miễn thuê waives the next rent, once (chest-exempt)', () => {
    const game = draw('chest-exempt', {
      arrange: all(own(1, [19, 21]), player(1, { cash: 50 })),
      rolls: [
        [1, 2],
        [1, 1],
      ],
    });
    game.send('b', 'roll').send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ tile: 19, cash: 1000, effects: [] });
  });

  it('Ốm skips its holder’s next turn (chest-sick)', () => {
    const game = draw('chest-sick', {
      arrange: player(1, { cash: 50 }),
      rolls: [
        [1, 2],
        [1, 2],
      ],
    });
    game.send('b', 'roll');
    expect(game.state).toMatchObject({ turn: 1, phase: 'roll' });
    expect(game.state.players[0]?.effects).toEqual([]);
    game.send('b', 'roll');
    expect(game.state.turn).toBe(0);
  });

  it('Khởi nghiệp halves what Levels cost (chest-startup)', () => {
    const game = draw('chest-startup', {
      arrange: all(own(0, [19]), player(1, { cash: 50 })),
      rolls: [
        [1, 2],
        [1, 1],
      ],
    });
    game.send('b', 'roll').send('a', 'roll');
    expect(game.state.phase).toBe('upgrade');
    game.send('a', 'upgrade');
    expect(game.state.players[0]?.cash).toBe(957);
    expect(game.state.lots[19]).toEqual({ owner: 0, level: 2, built: 43 });
  });

  it('counts down in the holder’s own turns, not the turn it came in', () => {
    const lap = Array.from({ length: 5 }, (): [number, number] => [3, 4]);
    const game = open({
      rolls: lap,
      arrange: all(
        player(0, { cash: 50, effects: [effect('lucky', 2, true)] }),
        player(1, { cash: 50 }),
      ),
    });
    const turns = () => game.state.players[0]?.effects.map((e) => e.turns);
    game.send('a', 'roll');
    expect(turns()).toEqual([2]);
    game.send('b', 'roll').send('a', 'roll');
    expect(turns()).toEqual([1]);
    game.send('b', 'roll').send('a', 'roll');
    expect(turns()).toEqual([]);
  });

  it('holds two at most, dropping the oldest, and renews one drawn again', () => {
    const two = draw('chest-sick', {
      arrange: player(0, { effects: [effect('lucky'), effect('startup')] }),
    });
    expect(two.state.players[0]?.effects.map((e) => e.id)).toEqual(['startup', 'sick']);
    const again = draw('chance-lucky', { arrange: player(0, { effects: [effect('lucky', 1)] }) });
    expect(again.state.players[0]?.effects).toEqual([effect('lucky', 2, false)]);
  });

  it('end, with the jail-free Cards back in the decks, on Bankruptcy', () => {
    const game = open({
      rolls: [[1, 3]],
      chance: ['chance-interest'],
      arrange: player(0, { cash: 50, jailCards: 1, effects: [effect('lucky')] }),
    }).send('a', 'roll');
    expect(game.state.players[0]).toMatchObject({ bankrupt: true, effects: [], jailCards: 0 });
    expect(game.state.decks.chance).toEqual(['chance-interest', 'chance-jail']);
  });
});

describe('the computer', () => {
  it('picks the Lot with the best rent for a Festival, and the worst for others', () => {
    const festival = draw('chance-festival', { arrange: own(0, [1, 9, 12]) });
    expect(festival.bot('a')).toEqual({ event: 'pick', payload: { pick: 9 } });
    const blackout = draw('chance-blackout', { arrange: own(1, [1, 9]) });
    expect(blackout.bot('a')).toEqual({ event: 'pick', payload: { pick: 9 } });
    const planning = draw('chance-planning', { arrange: all(own(0, [1]), own(0, [9])) });
    expect(planning.bot('a')).toEqual({ event: 'pick', payload: { pick: 9 } });
    expect(festival.bot('b')).toBeNull();
  });

  it('takes on a Quiz and answers it right about 70% of the time', () => {
    let right = 0;
    const tries = 400;
    for (let seed = 1; seed <= tries; seed++) {
      const game = draw('chance-quiz', { seed, bots: ['a'] });
      expect(game.bot('a')).toEqual({ event: 'pick', payload: { pick: 1 } });
      game.send('a', 'pick', { pick: 1 });
      const move = game.bot('a') as { payload: { choice: number } };
      if (move.payload.choice === game.state.quiz?.answer) right++;
    }
    expect(right / tries).toBeGreaterThan(0.62);
    expect(right / tries).toBeLessThan(0.78);
  });

  it('plays whole Matches of real dice and Cards with only moves the server accepts', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const game = testGame(new CoTyPhuGame(), PLAYERS, {
        seed,
        bots: PLAYERS,
        options: optionsSchema(manifest).parse({}),
      });
      for (let step = 0; step < 1500 && !game.result; step++) {
        const id = PLAYERS.find((p) => game.bot(p));
        const move = id && game.bot(id);
        if (id && move) game.send(id, move.event, move.payload as object);
        else game.fireTimer();
        seen.add(game.state.phase);
        if (game.state.card) seen.add(game.state.card.id);
      }
    }
    expect(seen).toContain('quiz');
    expect([...seen].filter((s) => s in CARDS).length).toBeGreaterThan(28);
  });
});
