import { type BotContext, type EventContext, Game, type StartContext } from '@xomdao/sdk';
import { z } from 'zod';
import { at, grow, inside, isDraw, newBoard, place, winningLine, winsAt } from './board.js';
import { botMove } from './bot.js';
import { MAX_SIDE, type Mark, type Options, type Point, type State } from './model.js';

/** A cell coordinate, loosely bounded (onPlace checks it is on the board). */
const coord = z
  .int()
  .min(-MAX_SIDE)
  .max(MAX_SIDE * 2);

export class CaroGame extends Game<State, Options> {
  readonly events = { place: z.object({ x: coord, y: coord }) };

  /** X starts: the first seat, or the second with "Đổi bên". */
  onStart({ players, options }: StartContext<Options>): State {
    const [first, second] = players.map((p) => p.id) as [string, string];
    const [x, o] = options.swap ? [second, first] : [first, second];
    return { board: newBoard(), players: [x, o], turn: x, last: null, line: null };
  }

  /**
   * Marks a cell: five in a row wins; otherwise a mark on an edge grows the board there, and
   * once it can't grow and nobody can make five any more it is a draw.
   */
  onPlace(ctx: EventContext<State, Point, Options>): State {
    const { state, player, payload, reject } = ctx;
    const p = { x: payload.x, y: payload.y };
    if (state.turn !== player.id) reject('Chưa tới lượt bạn');
    if (!inside(state.board, p)) reject('Ô này không có trên bàn');
    if (at(state.board, p) !== null) reject('Ô này đã có người đánh');

    const [x, o] = state.players;
    const mark: Mark = player.id === x ? 'X' : 'O';
    let board = place(state.board, p, mark);
    let line: Point[] | null = null;
    if (winsAt(state.board, p, mark)) {
      line = winningLine(board);
      ctx.finish(ctx.players.map((seat) => (seat.id === player.id ? 1 : 2)));
    } else {
      board = grow(board, p);
      if (isDraw(board)) ctx.finish([1, 1]);
    }
    return { ...state, board, turn: mark === 'X' ? o : x, last: p, line };
  }

  /** The computer's move for its seat, at the Room's level (see bot.ts). */
  bot({ state, player, rng, options }: BotContext<State, Options>) {
    const cell = botMove(state, player.id, rng, options.level);
    return cell && { event: 'place', payload: cell };
  }
}
