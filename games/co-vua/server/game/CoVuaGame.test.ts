import { optionsSchema, seededRng, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { CoVuaGame } from './CoVuaGame.js';
import { fen } from './chess.js';
import type { Options, State } from './model.js';
import { chooseMove, search } from './search.js';

/** A square's 0..63 index from its name. */
const sq = (name: string) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0] as string);

function match(options: Partial<Options> = {}, bots: string[] = []) {
  return testGame(new CoVuaGame(), ['a', 'b'], {
    options: optionsSchema(manifest).parse(options),
    bots,
  });
}

/** Plays moves like `e2e4` in turn. */
function play(game: ReturnType<typeof match>, moves: string[]) {
  for (const m of moves) {
    const promo = m[4] as 'q' | undefined;
    game.send((game.state as State).turn, 'move', {
      from: sq(m.slice(0, 2)),
      to: sq(m.slice(2, 4)),
      ...(promo && { promo }),
    });
  }
  return game;
}

describe('co-vua', () => {
  it('starts from the usual position with a (White) to move', () => {
    const { state } = match();
    expect(state).toMatchObject({
      turn: 'a',
      players: ['a', 'b'],
      castling: 'KQkq',
      phase: 'play',
    });
    expect(state.board.slice(48)).toBe('PPPPPPPPRNBQKBNR');
  });

  it('refuses moves out of turn, of the other side and against the rules', () => {
    const game = match();
    expect(game.error('b', 'move', { from: sq('e7'), to: sq('e5') })).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'move', { from: sq('e7'), to: sq('e5') })).toBe(
      'Đó không phải quân của bạn',
    );
    expect(game.error('a', 'move', { from: sq('e2'), to: sq('e5') })).toBe('Nước này không hợp lệ');
    play(game, ['e2e4', 'f7f6', 'd2d4']);
    expect(game.error('b', 'move', { from: sq('a7'), to: sq('a6') })).toBeNull();
    play(game, ['e7e5', 'd1h5']);
    expect(game.state.last).toMatchObject({ san: 'Qh5+', check: true });
    expect(game.error('b', 'move', { from: sq('a7'), to: sq('a6') })).toBe('Vua đang bị chiếu');
  });

  it("checkmate wins: Fool's mate", () => {
    const game = play(match(), ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(game.state).toMatchObject({ phase: 'over', ending: 'checkmate', winner: 'b' });
    expect(game.state.sans).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
    expect(game.result?.seats.map((s) => s.place)).toEqual([2, 1]);
  });

  it('castles, takes en passant and promotes', () => {
    const game = play(match(), [
      'e2e4',
      'a7a6',
      'e4e5',
      'd7d5',
      'e5d6',
      'a6a5',
      'g1f3',
      'a5a4',
      'f1e2',
      'a4a3',
      'e1g1',
    ]);
    expect(game.state.sans.slice(4)).toEqual(['exd6', 'a5', 'Nf3', 'a4', 'Be2', 'a3', 'O-O']);
    expect(game.state.last?.rook).toEqual({ from: sq('h1'), to: sq('f1') });
    expect(game.state.board[sq('d5')]).toBe('.');
    play(game, ['a3b2', 'd6c7', 'b2a1n']);
    expect(game.state.board[sq('a1')]).toBe('n');
    play(game, ['c7d8q']);
    expect(game.state.last?.san).toBe('cxd8=Q+');
  });

  it('draws by stalemate, repetition and agreement; a resignation loses', () => {
    const stale = match();
    play(stale, [
      'e2e3',
      'a7a5',
      'd1h5',
      'a8a6',
      'h5a5',
      'h7h5',
      'h2h4',
      'a6h6',
      'a5c7',
      'f7f6',
      'c7d7',
      'e8f7',
      'd7b7',
      'd8d3',
      'b7b8',
      'd3h7',
      'b8c8',
      'f7g6',
      'c8e6',
    ]);
    expect(stale.state).toMatchObject({ phase: 'over', ending: 'stalemate', winner: null });
    expect(stale.result?.seats.map((s) => s.place)).toEqual([1, 1]);

    const repeat = play(match(), ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
    expect(repeat.state.ending).toBe('repetition');

    const agree = match();
    agree.send('a', 'draw', {});
    expect(agree.state.offer).toBe('a');
    expect(agree.error('a', 'draw', {})).toBe('Bạn đã cầu hoà rồi');
    agree.send('b', 'draw', {});
    expect(agree.state.ending).toBe('agreement');

    const decline = match();
    decline.send('a', 'draw', {}).send('b', 'decline', {});
    expect(decline.state.offer).toBeNull();

    const resign = match();
    resign.send('b', 'resign', {});
    expect(resign.result?.seats.map((s) => s.place)).toEqual([1, 2]);
  });

  it('the loser plays White next; the series score carries on', () => {
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

  it('the computer finds mate in one and takes a free queen', () => {
    const mate = fen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    expect(mate.san(search(mate, 5000, []).move)).toBe('Ra8#');
    const queen = fen('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
    expect(queen.san(chooseMove(queen, 'normal', [], seededRng(1)))).toBe('Rxd5');
  });

  it('the computer plays a whole Match against itself', () => {
    const game = match({ level: 'easy' }, ['a', 'b']);
    let guard = 0;
    while (!game.result && guard++ < 600) {
      const s = game.state as State;
      const move = game.bot(s.turn);
      if (!move) break;
      game.send(s.turn, move.event, move.payload as object);
    }
    expect(game.result).not.toBeNull();
  });
});
