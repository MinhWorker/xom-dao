import { optionsSchema, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { comboOf } from './cards.js';
import { standings } from './match.js';
import { type Options, TURN_MS, type View } from './model.js';
import { TienLenGame } from './TienLenGame.js';

const PLAYERS = ['a', 'b', 'c', 'd'];

/** A Match as the server starts it: the options filled from the manifest. */
function open(
  players = PLAYERS,
  options: Partial<Options> = {},
  seed = 1,
  bots: string[] = [],
  playouts = 0,
) {
  return testGame(new TienLenGame({ playouts }), players, {
    options: optionsSchema(manifest).parse(options),
    seed,
    bots,
  });
}
type Session = ReturnType<typeof open>;

/** A Match with the deal over (the `begin` timer fired). */
function start(players = PLAYERS, options: Partial<Options> = {}, seed = 1, bots: string[] = []) {
  const game = open(players, options, seed, bots);
  expect(game.timer?.event).toBe('begin');
  return game.fireTimer();
}

/** The computer plays every seat until the round is over. */
function playRound(game: Session, players: string[]) {
  for (let i = 0; i < 800 && game.state.phase === 'play'; i++) {
    const id = players[game.state.turn] as string;
    const move = game.bot(id);
    if (!move) throw new Error(`the computer had no move for ${id}`);
    game.send(id, move.event, move.payload as object);
  }
  return game;
}

/** The computer plays every seat, round after round, until the Match is over. */
function playMatch(game: Session, players: string[]) {
  for (let round = 0; round < 12 && !game.result; round++) {
    if (game.state.phase === 'deal') game.fireTimer();
    playRound(game, players);
    if (!game.result) game.fireTimer();
  }
  return game;
}

describe('tiến lên', () => {
  it('deals 13 cards each, then the holder of 3♠ leads with it', () => {
    const game = open();
    expect(game.state).toMatchObject({ round: 1, rounds: 5, phase: 'deal' });
    expect(game.state.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(game.state.hands.flat()).size).toBe(52);
    expect(game.error(PLAYERS[game.state.lead] as string, 'play', { cards: [0] })).toBe(
      'Chưa tới lúc đánh',
    );
    game.fireTimer();
    expect(game.state.phase).toBe('play');
    expect(game.state.hands[game.state.turn]).toContain(0);
    expect(game.state.mustPlay).toBe(0);
  });

  it('takes the number of rounds from the options', () => {
    expect(open(PLAYERS, { rounds: 10 }).state.rounds).toBe(10);
    expect(optionsSchema(manifest).parse({})).toEqual({ rounds: 5 });
  });

  it('checks turn, cards and combinations', () => {
    const game = start();
    const me = PLAYERS[game.state.turn] as string;
    const other = PLAYERS[(game.state.turn + 1) % 4] as string;
    const hand = game.state.hands[game.state.turn] as number[];
    const notMine = game.state.hands[(game.state.turn + 1) % 4]?.[0] as number;
    expect(game.error(other, 'play', { cards: [notMine] })).toBe('Chưa tới lượt bạn');
    expect(game.error(me, 'play', { cards: [notMine] })).toBe('Bạn không có lá đó');
    expect(game.error(me, 'play', { cards: [hand[12] as number] })).toBe(
      'Lượt đầu phải đánh cả lá 3♠',
    );
    expect(game.error(me, 'pass')).toBe('Bạn đang cầm vòng, phải đánh');
    expect(game.error(me, 'play', { cards: [0, hand[12] as number] })).toBe(
      'Các lá này không thành bộ',
    );
    expect(game.error(me, 'play', { cards: [] })).toBe('Nước đi không hợp lệ');
    game.send(me, 'play', { cards: [0] });
    expect(game.state.table).toMatchObject({ cards: [0], kind: 'single' });
    expect(game.state.turn).toBe((PLAYERS.indexOf(me) + 1) % 4);
  });

  it('refuses a play that does not beat the table', () => {
    const game = start();
    const leader = game.state.turn;
    game.send(PLAYERS[leader] as string, 'play', { cards: [0] });
    const next = (leader + 1) % 4;
    const hand = game.state.hands[next] as number[];
    const pair = hand.find(
      (c, i) =>
        hand[i + 1] !== undefined && Math.floor(c / 4) === Math.floor((hand[i + 1] as number) / 4),
    );
    if (pair !== undefined) {
      expect(game.error(PLAYERS[next] as string, 'play', { cards: [pair, pair + 1] })).toBe(
        'Bài này không chặn được',
      );
    }
    expect(game.error(PLAYERS[next] as string, 'play', { cards: [0] })).toBe('Bạn không có lá đó');
  });

  it('starts a new trick when everyone else passes', () => {
    const game = start();
    const leader = game.state.turn;
    game.send(PLAYERS[leader] as string, 'play', { cards: [0] });
    for (let i = 1; i < 4; i++) game.send(PLAYERS[(leader + i) % 4] as string, 'pass');
    expect(game.state).toMatchObject({ turn: leader, table: null, trick: 1 });
    expect(game.state.passed).toEqual([false, false, false, false]);
  });

  it('shows you only your own cards', () => {
    const game = start();
    const view = game.view('a') as View;
    expect(view.hand).toEqual(game.state.hands[0]);
    expect(view.counts).toEqual([13, 13, 13, 13]);
    for (const seat of [1, 2, 3]) game.assertHidden('a', game.state.hands[seat]);
    for (const seat of [0, 1, 2, 3]) game.assertHidden(null, game.state.hands[seat]);
    expect((game.view(null) as View).hand).toEqual([]);
  });

  it('ranks everyone before a round ends, and gives points by rank', () => {
    for (const count of [2, 3, 4]) {
      const players = PLAYERS.slice(0, count);
      const game = playRound(start(players, { rounds: 3 }, count), players);
      const [result] = game.state.results;
      expect(game.state.phase).toBe('over');
      expect([...(result?.order ?? [])].sort()).toEqual(players.map((_, s) => s));
      // 4 players: 3, 2, 1, 0 points.
      result?.order.forEach((seat, place) => {
        expect(result.points[seat]).toBe(count - 1 - place);
      });
      expect(result?.leftover.length).toBeGreaterThan(0);
      for (const play of game.state.played) expect(comboOf(play.cards)).not.toBeNull();
      // The next round is dealt after a pause, led by the round's winner.
      expect(game.timer?.event).toBe('next-round');
      game.fireTimer().fireTimer();
      expect(game.state).toMatchObject({ round: 2, phase: 'play', mustPlay: null });
      expect(game.state.turn).toBe(result?.order[0]);
    }
  });

  it('ends the Match after its last round, placing seats by points', () => {
    const game = start(PLAYERS, { rounds: 3 });
    for (const _ of [1, 2]) playRound(game, PLAYERS).fireTimer().fireTimer();
    expect(game.result).toBeNull();
    playRound(game, PLAYERS);
    expect(game.state.results).toHaveLength(3);
    const ranking = standings(game.state);
    expect(game.result?.seats).toEqual(
      PLAYERS.map((player, seat) => ({
        player,
        place: ranking.indexOf(seat) + 1,
        score: game.state.points[seat],
      })),
    );
    const best = ranking[0] as number;
    expect(game.state.points[best]).toBe(Math.max(...game.state.points));
    expect(game.state.points.reduce((a, b) => a + b)).toBe(3 * (3 + 2 + 1));
    expect(game.error('a', 'pass')).toBe('Ván đã kết thúc');
  });

  it('breaks ties on points by rounds won, then by seat', () => {
    expect(standings({ points: [3, 3, 3, 0], firsts: [0, 1, 1, 0] })).toEqual([1, 2, 0, 3]);
    expect(standings({ points: [2, 5, 2, 5], firsts: [1, 1, 1, 2] })).toEqual([3, 1, 0, 2]);
  });

  it('counts each chặt as a stat for the "Chặt heo" achievement', () => {
    const chops: string[] = [];
    for (let seed = 1; seed <= 40 && !chops.length; seed++) {
      const game = playRound(start(PLAYERS, { rounds: 1 }, seed), PLAYERS);
      for (const stat of game.result?.stats ?? []) {
        expect(stat).toMatchObject({ name: 'chop', amount: 1 });
        chops.push(stat.player);
      }
    }
    expect(chops.length).toBeGreaterThan(0);
    expect(PLAYERS).toEqual(expect.arrayContaining(chops));
  });

  it('runs a turn clock only with two or more people', () => {
    const people = start(PLAYERS);
    expect(people.timer).toEqual({ event: 'turn-over', ms: TURN_MS });
    // Time's up while leading: the lowest card (3♠) goes down.
    people.fireTimer();
    expect(people.state.played[0]?.cards).toEqual([0]);
    // Time's up while following: a pass.
    const next = people.state.turn;
    people.fireTimer();
    expect(people.state.passed[next]).toBe(true);

    const withBot = open(['a', 'bot'], {}, 1, ['bot']).fireTimer();
    expect(withBot.state.phase).toBe('play');
    expect(withBot.timer).toBeNull();
  });

  it("a new Match is led by the last Match's winner", () => {
    const players = ['a', 'b'];
    const game = start(players, { rounds: 1 });
    playRound(game, players);
    const winner = game.result?.seats.find((s) => s.place === 1)?.player as string;
    game.newMatch().fireTimer();
    expect(game.state.turn).toBe(players.indexOf(winner));
    expect(game.state.mustPlay).toBeNull();
  });
});

describe('computer seats', () => {
  it('plays a whole Match of computers, at every table size', () => {
    for (const count of [2, 3, 4]) {
      for (const seed of [1, 2, 3]) {
        const players = PLAYERS.slice(0, count);
        const game = playMatch(open(players, { rounds: 3 }, seed, players), players);
        expect(game.state.results).toHaveLength(3);
        expect(game.result?.seats.map((s) => s.place).sort()).toEqual(players.map((_, i) => i + 1));
      }
    }
  });

  it('looks ahead without a refused move', () => {
    const players = PLAYERS.slice(0, 3);
    const game = playMatch(open(players, { rounds: 1 }, 5, players, 20), players);
    expect(game.result).not.toBeNull();
  });

  it('plays a ten-round Match through without a refused move', () => {
    const game = playMatch(open(PLAYERS, { rounds: 10 }, 7, PLAYERS).fireTimer(), PLAYERS);
    expect(game.state.results).toHaveLength(10);
    expect(game.result).not.toBeNull();
  });

  it('takes over the seats of people who left, in the middle of a round', () => {
    const game = start();
    game.send(PLAYERS[game.state.turn] as string, 'play', { cards: [0] });
    playMatch(game, PLAYERS);
    expect(game.state.results).toHaveLength(5);
    expect(game.result).not.toBeNull();
  });

  it('opens with 3♠ when it holds it, and does nothing out of turn or during the deal', () => {
    const game = open();
    expect(PLAYERS.map((id) => game.bot(id))).toEqual([null, null, null, null]);
    game.fireTimer();
    const turn = PLAYERS[game.state.turn] as string;
    const move = game.bot(turn);
    expect(move?.event).toBe('play');
    expect(move?.payload).toEqual({ cards: expect.arrayContaining([0]) });
    for (const id of PLAYERS.filter((p) => p !== turn)) expect(game.bot(id)).toBeNull();
  });
});
