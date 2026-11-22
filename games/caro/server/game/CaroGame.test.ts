import { optionsSchema, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { at, inside } from './board.js';
import { CaroGame } from './CaroGame.js';
import type { Options, Point } from './model.js';

type Move = [number, number];

/** A Match between a (first seat) and b, playing `moves` ([x, y]) in turn: whoever is X starts. */
function play(moves: Move[], options: Partial<Options> = {}, bots: string[] = []) {
  const game = testGame(new CaroGame(), ['a', 'b'], {
    options: optionsSchema(manifest).parse(options),
    bots,
  });
  for (const [x, y] of moves) game.send(game.state.turn, 'place', { x, y });
  return game;
}

/** A's marks along row 4 (x from 2), B's along row 6: nobody touches an edge. */
const rows = (count: number): Move[] =>
  Array.from({ length: count }, (_, i) => [
    [2 + i, 4],
    [2 + i, 6],
  ]).flat() as Move[];

describe('caro', () => {
  it('starts with a (X) on an empty 9×9 board', () => {
    const { state } = play([]);
    expect(state).toMatchObject({ turn: 'a', players: ['a', 'b'], last: null, line: null });
    expect(state.board).toMatchObject({ left: 0, top: 0, cols: 9, rows: 9 });
    expect(state.board.cells.every((c) => c === null)).toBe(true);
  });

  it('rejects moves out of turn, on taken cells and off the board', () => {
    const game = play([[4, 4]]);
    expect(game.state.last).toEqual({ x: 4, y: 4 });
    expect(game.error('a', 'place', { x: 3, y: 3 })).toBe('Chưa tới lượt bạn');
    expect(game.error('b', 'place', { x: 4, y: 4 })).toBe('Ô này đã có người đánh');
    expect(game.error('b', 'place', { x: 9, y: 4 })).toBe('Ô này không có trên bàn');
    expect(game.error('b', 'place', { x: -1, y: 4 })).toBe('Ô này không có trên bàn');
    expect(game.error('b', 'place', { x: 100, y: 4 })).toBe('Nước đi không hợp lệ');
    expect(game.error('b', 'place', { cell: 4 })).toBe('Nước đi không hợp lệ');
  });

  it('needs five in a row: the winner places first, then moves are refused', () => {
    expect(play(rows(4)).result).toBeNull();
    const game = play([...rows(4), [6, 4]]);
    expect(game.result).toEqual({
      seats: [
        { player: 'a', place: 1 },
        { player: 'b', place: 2 },
      ],
    });
    expect(game.state.line).toEqual([2, 3, 4, 5, 6].map((x) => ({ x, y: 4 })));
    expect(game.error('b', 'place', { x: 7, y: 7 })).toBe('Ván đã kết thúc');
  });

  it('wins on diagonals too: a from 2,2 to 6,6', () => {
    const moves: Move[] = [2, 3, 4, 5].flatMap((i) => [
      [i, i],
      [i, 7],
    ]) as Move[];
    expect(play(moves).result).toBeNull();
    expect(play([...moves, [6, 6]]).result?.seats.map((s) => s.place)).toEqual([1, 2]);
  });

  it('grows three rows or columns on the side of an edge mark, up to 15', () => {
    expect(play([[4, 4]]).state.board).toMatchObject({ left: 0, top: 0, cols: 9, rows: 9 });

    const left = play([[0, 4]]).state.board;
    expect(left).toMatchObject({ left: -3, top: 0, cols: 12, rows: 9 });
    expect(at(left, { x: 0, y: 4 })).toBe('X');
    expect(at(left, { x: -3, y: 4 })).toBeNull();

    expect(play([[8, 8]]).state.board).toMatchObject({ left: 0, top: 0, cols: 12, rows: 12 });

    const game = play([
      [0, 4],
      [-3, 4],
      [8, 0],
    ]);
    expect(game.state.board).toMatchObject({ left: -6, top: -3, cols: 15, rows: 12 });
    game.send('b', 'place', { x: -6, y: 5 });
    expect(game.state.board).toMatchObject({ left: -6, cols: 15 });
    expect(game.error('a', 'place', { x: -7, y: 5 })).toBe('Ô này không có trên bàn');
  });

  it('does not grow on a winning move', () => {
    const moves: Move[] = [0, 1, 2, 3].flatMap((x) => [
      [x + 1, 11],
      [x + 1, 5],
    ]) as Move[];
    const game = play([[4, 8], [7, 2], ...moves]);
    const before = { ...game.state.board, cells: [] };
    game.send('a', 'place', { x: 5, y: 11 });
    expect(game.result).not.toBeNull();
    expect({ ...game.state.board, cells: [] }).toEqual(before);
  });

  it('is a draw, both placing first, once the board is full size and nobody can make five', () => {
    const game = play([]);
    playToDraw(game);
    expect(game.result?.seats.map((s) => s.place)).toEqual([1, 1]);
    expect(game.state.board).toMatchObject({ cols: 15, rows: 15 });
    expect(game.state.line).toBeNull();
  });

  it('stops when a player leaves, the one who stays placing first', () => {
    const game = play(rows(2)).leave('a');
    expect(game.result).toEqual({
      seats: [
        { player: 'a', place: 2 },
        { player: 'b', place: 1 },
      ],
    });
    expect(game.error('b', 'place', { x: 7, y: 7 })).toBe('Ván đã kết thúc');
  });

  it('lets the second seat play X with "Đổi bên"', () => {
    expect(play([], { swap: true }).state).toMatchObject({ players: ['b', 'a'], turn: 'b' });
    expect(play([...rows(4), [6, 4]], { swap: true }).result?.seats).toEqual([
      { player: 'a', place: 2 },
      { player: 'b', place: 1 },
    ]);
  });

  it('plays the computer’s seat on its turn', () => {
    const game = play([], { level: 'hard' }, ['b']);
    expect(game.bot('b')).toBeNull();
    game.send('a', 'place', { x: 0, y: 0 });
    const move = game.bot('b');
    expect(move).toMatchObject({ event: 'place' });
    game.send('b', 'place', move?.payload as object);
    expect(game.state.turn).toBe('a');
  });

  it('lets the computer think for a moment, a little longer once the board fills', () => {
    const swapped = play([], { swap: true }, ['b']);
    const first = swapped.botDelay('b');
    expect(first).toBeGreaterThanOrEqual(450);
    expect(first).toBeLessThan(750);

    const late = play(rows(4).slice(0, 7), {}, ['b']);
    for (let i = 0; i < 20; i++) {
      const ms = late.botDelay('b');
      expect(ms).toBeGreaterThanOrEqual(600 + 7 * 15);
      expect(ms).toBeLessThan(600 + 7 * 15 + 500);
    }
  });
});

/**
 * Plays a drawn Match: X and O follow a pattern with at most two in a row any way, on the
 * 15×15 square the board grows to (x and y from -3 to 11), until the game calls the draw.
 * The first marks go one on each edge of the new board, so each side grows once.
 */
function playToDraw(game: ReturnType<typeof play>) {
  const markOf = ({ x, y }: Point) => ((((x + 2 * y + 1) % 4) + 4) % 4 < 2 ? 'X' : 'O');
  const todo: Point[] = [];
  for (let y = -3; y <= 11; y++) for (let x = -3; x <= 11; x++) todo.push({ x, y });
  const firstOnEachEdge = [
    (p: Point) => p.x === 0 && p.y === 4,
    (p: Point) => p.x === 8 && p.y === 5,
    (p: Point) => p.y === 0 && p.x === 3,
    (p: Point) => p.y === 8 && p.x === 5,
  ].map((is) => todo.splice(todo.findIndex(is), 1)[0] as Point);
  todo.unshift(...firstOnEachEdge);
  while (!game.result) {
    const { board, players, turn } = game.state;
    const mark = turn === players[0] ? 'X' : 'O';
    const i = todo.findIndex((p) => markOf(p) === mark && inside(board, p));
    if (i < 0) throw new Error(`no ${mark} move left`);
    const [p] = todo.splice(i, 1) as [Point];
    game.send(turn, 'place', p);
  }
}
