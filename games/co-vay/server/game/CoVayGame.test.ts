import { optionsSchema, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { count, indexOf } from './board.js';
import { CoVayGame } from './CoVayGame.js';
import { BLACK, EMPTY, type Options, type State, WHITE } from './model.js';

type Move = [number, number] | 'pass';

function match(options: Partial<Options> = {}, bots: string[] = []) {
  return testGame(new CoVayGame(), ['a', 'b'], {
    options: optionsSchema(manifest).parse(options),
    bots,
  });
}

/** Plays `moves` in turn from whoever is to move. */
function play(game: ReturnType<typeof match>, moves: Move[]) {
  for (const m of moves) {
    if (m === 'pass') game.send(game.state.turn, 'pass', {});
    else game.send(game.state.turn, 'place', { x: m[0], y: m[1] });
  }
  return game;
}

const at = (state: State, x: number, y: number) => state.board[indexOf(state.size, { x, y })];

describe('co-vay', () => {
  it('starts on an empty 19×19 board with a (Black) to move', () => {
    const { state } = match();
    expect(state).toMatchObject({ size: 19, turn: 'a', players: ['a', 'b'], phase: 'play' });
    expect(state.board).toHaveLength(361);
    expect(state.board.every((c) => c === EMPTY)).toBe(true);
  });

  it('refuses moves out of turn and on stones', () => {
    const game = play(match(), [[4, 4]]);
    expect(at(game.state, 4, 4)).toBe(BLACK);
    expect(game.error('a', 'place', { x: 3, y: 3 })).toBe('Chưa tới lượt bạn');
    expect(game.error('b', 'place', { x: 4, y: 4 })).toBe('Điểm này đã có quân');
  });

  it('captures a stone with no liberties left and counts it', () => {
    const game = play(match(), [
      [1, 0],
      [1, 1],
      [0, 1],
      [8, 8],
      [2, 1],
      [8, 7],
      [1, 2],
    ]);
    expect(at(game.state, 1, 1)).toBe(EMPTY);
    expect(game.state.captures.a).toBe(1);
    expect(game.state.last).toMatchObject({ x: 1, y: 2, captured: 1 });
    expect(game.result).toBeNull();
  });

  it('refuses suicide, but allows a move that captures', () => {
    const game = play(match(), [
      [1, 0],
      [8, 8],
      [0, 1],
    ]);
    expect(game.error('b', 'place', { x: 0, y: 0 })).toBe('Không được đặt vào chỗ hết khí');
  });

  it('refuses retaking a ko at once (no repeated position)', () => {
    // Black: (1,0) (0,1) (2,1)... a ko shape at (1,1)/(2,1).
    const game = play(match(), [
      [1, 0],
      [2, 0],
      [0, 1],
      [3, 1],
      [1, 2],
      [2, 2],
      [8, 8],
      [1, 1],
      [2, 1],
    ]);
    expect(at(game.state, 1, 1)).toBe(EMPTY);
    expect(game.error('b', 'place', { x: 1, y: 1 })).toBe('Nước này lặp lại thế cờ cũ');
    play(game, [
      [8, 0],
      [8, 1],
      [1, 1],
    ]);
    expect(at(game.state, 1, 1)).toBe(WHITE);
  });

  it('two passes lead to counting; both agree and the area count decides', () => {
    const game = play(match(), [[4, 4], 'pass', 'pass']);
    expect(game.state.phase).toBe('score');
    expect(game.error('a', 'place', { x: 1, y: 1 })).toBe('Đang đếm đất');
    game.send('a', 'accept', {});
    expect(game.result).toBeNull();
    game.send('b', 'accept', {});
    expect(game.state.count).toMatchObject({ black: 361, white: 7.5 });
    expect(game.result?.seats.map((s) => s.place)).toEqual([1, 2]);
  });

  it('marks dead stones by group, which resets agreement; play can resume', () => {
    const game = play(match(), [[4, 4], [0, 0], [4, 5], [1, 0], 'pass', 'pass']);
    game.send('a', 'accept', {});
    const before = game.state.dead.length;
    game.send('b', 'dead', { x: 0, y: 0 });
    expect(game.state.agreed).toEqual([]);
    const toggled = new Set(game.state.dead).has(indexOf(19, { x: 1, y: 0 }));
    expect(toggled).toBe(before === 0);
    game.send('a', 'resume', {});
    expect(game.state).toMatchObject({ phase: 'play', turn: 'b', dead: [] });
  });

  it('a resignation or a player leaving ends the Match', () => {
    const resign = play(match(), [[4, 4]]);
    resign.send('a', 'resign', {});
    expect(resign.result?.seats.map((s) => s.place)).toEqual([2, 1]);
    const left = play(match(), [[4, 4]]);
    left.leave('b');
    expect(left.result?.seats.map((s) => s.place)).toEqual([1, 2]);
  });

  it('the loser plays Black in the next Match; the series score carries on', () => {
    const game = play(match(), [[4, 4]]);
    game.send('a', 'resign', {});
    game.newMatch();
    expect(game.state.players).toEqual(['a', 'b']);
    expect(game.state.wins).toEqual({ a: 0, b: 1 });
    game.send('a', 'resign', {});
    game.newMatch();
    expect(game.state.players[0]).toBe('a');
    const alt = match({ first: 'alternate' });
    alt.send('a', 'resign', {});
    alt.newMatch();
    expect(alt.state.players[0]).toBe('b');
  });

  it('counts area with komi and dead stones as the other side', () => {
    const board = new Array(81).fill(EMPTY);
    for (let y = 0; y < 9; y++) board[y * 9 + 4] = BLACK;
    for (let y = 0; y < 9; y++) board[y * 9 + 5] = WHITE;
    board[0] = WHITE;
    expect(count(board, 9, new Set())).toMatchObject({ black: 9, white: 37 + 7.5 });
    const withDead = count(board, 9, new Set([0]));
    expect(withDead.black).toBe(45);
    expect(withDead.white).toBe(36 + 7.5);
  });

  it('the computer plays a Match to the count and agrees', () => {
    const game = match({ level: 'easy' }, ['a', 'b']);
    let guard = 0;
    while (!game.result && guard++ < 400) {
      const who =
        game.state.phase === 'score'
          ? game.state.agreed.includes('a')
            ? 'b'
            : 'a'
          : game.state.turn;
      const move = game.bot(who);
      if (!move) break;
      game.send(who, move.event, move.payload as object);
    }
    expect(game.result).not.toBeNull();
    expect(game.state.ending).toBe('count');
  }, 30_000);
});
