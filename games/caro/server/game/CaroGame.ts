import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type LeaveContext,
  type PlayerId,
  type StartContext,
} from '@xomdao/sdk';
import { z } from 'zod';
import { at, grow, inside, isDraw, markOf, newBoard, place, winningLine, winsAt } from './board.js';
import { botMove } from './bot.js';
import { MAX_SIDE, type Mark, type Options, type Point, type State } from './model.js';

/**
 * Ends the Match won by `winner` (`null`: a draw). Each seat's score is the Matches it won in
 * the series, which the next Match reads back from `ctx.lastResult`.
 */
function won(ctx: GameContext<State, Options>, winner: PlayerId | null) {
  const wins = { ...ctx.state.wins };
  if (winner) wins[winner] = (wins[winner] ?? 0) + 1;
  ctx.finish(
    ctx.players.map((seat) => (!winner || seat.id === winner ? 1 : 2)),
    { scores: ctx.players.map((seat) => wins[seat.id] ?? 0) },
  );
  return wins;
}

/** A cell coordinate, loosely bounded (onPlace checks it is on the board). */
const coord = z
  .int()
  .min(-MAX_SIDE)
  .max(MAX_SIDE * 2);

export class CaroGame extends Game<State, Options> {
  readonly events = { place: z.object({ x: coord, y: coord }) };

  /** X starts: the first seat, or the second with "Đổi bên". */
  onStart({ players, options, lastResult }: StartContext<Options>): State {
    const [first, second] = players.map((p) => p.id) as [string, string];
    const [x, o] = options.swap ? [second, first] : [first, second];
    const wins = Object.fromEntries(
      players.map(({ id }) => [id, lastResult?.seats.find((s) => s.player === id)?.score ?? 0]),
    );
    return { board: newBoard(), players: [x, o], turn: x, last: null, line: null, wins };
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
    const mark = markOf(state, player.id) as Mark;
    let board = place(state.board, p, mark);
    let line: Point[] | null = null;
    let wins = state.wins;
    if (winsAt(state.board, p, mark)) {
      line = winningLine(board);
      wins = won(ctx, player.id);
    } else {
      board = grow(board, p);
      if (isDraw(board)) won(ctx, null);
    }
    return { ...state, board, turn: mark === 'X' ? o : x, last: p, line, wins };
  }

  /** A player left mid-Match: it stops there and the one who stays wins. */
  onLeave(ctx: LeaveContext<State, Options>): State {
    const stays = ctx.players.find((seat) => seat.id !== ctx.player.id)?.id ?? null;
    return { ...ctx.state, wins: won(ctx, stays) };
  }

  /** The computer's move for its seat, at the Room's level (see bot.ts). */
  bot({ state, player, rng, options }: BotContext<State, Options>) {
    const cell = botMove(state, player.id, rng, options.level);
    return cell && { event: 'place', payload: cell };
  }

  /** The computer seems to think: briefly on the first mark, longer once the board fills. */
  botDelay({ state, rng }: BotContext<State, Options>) {
    if (!state.last) return 450 + Math.floor(rng() * 300);
    const marks = state.board.cells.filter((cell) => cell !== null).length;
    return 600 + Math.min(marks, 20) * 15 + Math.floor(rng() * 500);
  }
}
