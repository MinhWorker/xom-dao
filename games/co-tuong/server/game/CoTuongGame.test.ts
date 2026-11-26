import { optionsSchema, seededRng, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { CoTuongGame, perpetualChecker } from './CoTuongGame.js';
import type { Options, State } from './model.js';
import { chooseMove, search } from './search.js';
import { fromOf, Position, toOf } from './xiangqi.js';

const p = (r: number, c: number) => r * 9 + c;

function match(options: Partial<Options> = {}, bots: string[] = []) {
  return testGame(new CoTuongGame(), ['a', 'b'], {
    options: optionsSchema(manifest).parse(options),
    bots,
  });
}

/** Plays moves given as [fromRow, fromCol, toRow, toCol] in turn. */
function play(game: ReturnType<typeof match>, moves: [number, number, number, number][]) {
  for (const [r1, c1, r2, c2] of moves) {
    game.send((game.state as State).turn, 'move', { from: p(r1, c1), to: p(r2, c2) });
  }
  return game;
}

describe('co-tuong', () => {
  it('starts from the usual position with a (Red) to move', () => {
    const { state } = match();
    expect(state).toMatchObject({ turn: 'a', players: ['a', 'b'], phase: 'play', ply: 0 });
    expect(state.board.slice(81)).toBe('RNBAKABNR');
  });

  it('refuses moves out of turn, of the other side and against the rules', () => {
    const game = match();
    expect(game.error('b', 'move', { from: p(3, 0), to: p(4, 0) })).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'move', { from: p(3, 0), to: p(4, 0) })).toBe(
      'Đó không phải quân của bạn',
    );
    expect(game.error('a', 'move', { from: p(9, 1), to: p(8, 1) })).toBe('Nước này không hợp lệ');
    play(game, [[7, 1, 7, 4]]);
    expect(game.state.last).toMatchObject({
      from: p(7, 1),
      to: p(7, 4),
      taken: null,
      check: false,
    });
    play(game, [[3, 0, 4, 0]]);
    expect(game.error('b', 'move', { from: p(0, 4), to: p(1, 4) })).toBe('Chưa tới lượt bạn');
    play(game, [[7, 4, 3, 4]]);
    expect(game.state.last).toMatchObject({ taken: 'p', check: false });
    expect(game.error('b', 'move', { from: p(0, 3), to: p(1, 4) })).toBe(
      'Nước này để tướng bị chiếu',
    );
  });

  it('draws when a position comes back a third time; resigning loses', () => {
    const shuffle: [number, number, number, number][] = [
      [9, 1, 7, 2],
      [0, 1, 2, 2],
      [7, 2, 9, 1],
      [2, 2, 0, 1],
    ];
    const game = play(match(), [...shuffle, ...shuffle]);
    expect(game.state).toMatchObject({ phase: 'over', ending: 'repetition', winner: null });
    expect(game.result?.seats.map((s) => s.place)).toEqual([1, 1]);
    const resign = match();
    resign.send('b', 'resign', {});
    expect(resign.result?.seats.map((s) => s.place)).toEqual([1, 2]);
  });

  it('blames the side that checks on every move of a repetition', () => {
    expect(perpetualChecker([1, 2, 3, 4, 1], [false, false, true, false, true])).toBe('mover');
    expect(perpetualChecker([1, 2, 3, 4, 1], [false, true, false, true, false])).toBe('other');
    expect(perpetualChecker([1, 2, 3, 4, 1], [false, true, true, true, true])).toBeNull();
    expect(perpetualChecker([1, 2, 3, 4, 1], [false, false, false, false, false])).toBeNull();
  });

  it('agrees and declines draws', () => {
    const agree = match();
    agree.send('a', 'draw', {});
    expect(agree.error('a', 'draw', {})).toBe('Bạn đã cầu hoà rồi');
    agree.send('b', 'draw', {});
    expect(agree.state.ending).toBe('agreement');
    const decline = match();
    decline.send('a', 'draw', {}).send('b', 'decline', {});
    expect(decline.state.offer).toBeNull();
  });

  it('the loser plays Red next; the series score carries on', () => {
    const game = match();
    game.send('a', 'resign', {});
    game.newMatch();
    expect(game.state.players[0]).toBe('a');
    expect(game.state.wins).toEqual({ a: 0, b: 1 });
    const alt = match({ first: 'alternate' });
    alt.send('a', 'resign', {});
    alt.newMatch();
    expect(alt.state.players[0]).toBe('b');
  });

  it('the computer mates in one and takes a free rook', () => {
    const b = '.'.repeat(90).split('');
    b[p(0, 4)] = 'k';
    b[p(1, 0)] = 'R';
    b[p(5, 8)] = 'R';
    b[p(9, 3)] = 'K';
    const mate = Position.from(b.join(''), 'r');
    const m = search(mate, 5000, []).move;
    expect([fromOf(m), toOf(m)]).toEqual([p(5, 8), p(0, 8)]);
    const c = '.'.repeat(90).split('');
    c[p(0, 3)] = 'k';
    c[p(4, 4)] = 'r';
    c[p(9, 5)] = 'K';
    c[p(7, 4)] = 'R';
    const rook = Position.from(c.join(''), 'r');
    const n = chooseMove(rook, 'normal', [], seededRng(1), 30);
    expect([fromOf(n), toOf(n)]).toEqual([p(7, 4), p(4, 4)]);
  });

  it('the computer plays a whole Match against itself', () => {
    const game = match({ level: 'easy' }, ['a', 'b']);
    let guard = 0;
    while (!game.result && guard++ < 400) {
      const s = game.state as State;
      const move = game.bot(s.turn);
      if (!move) break;
      game.send(s.turn, move.event, move.payload as object);
    }
    expect(game.result).not.toBeNull();
  });
});
