import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type LeaveContext,
  type MatchResult,
  type PlayerId,
  type StartContext,
} from '@xomdao/sdk';
import { z } from 'zod';
import { findMove, fromOf, Position, promoOf, START, sq64, toOf } from './chess.js';
import type { Ending, LastMove, Options, State } from './model.js';
import { chooseMove, judge } from './search.js';

/** The stat that marks who played White, which the next Match reads back from `ctx.lastResult`. */
const FIRST = 'first';

/** Who plays White: the first seat in a new series; then the loser of the last Match ("Người
 * thua", or after a draw whoever had Black) or each in turn ("Lần lượt"). */
export function whiteOf(
  ids: readonly [PlayerId, PlayerId],
  { first }: Options,
  last: MatchResult | null,
): PlayerId {
  if (!last) return ids[0];
  const loser = last.seats.find((seat) => seat.place > 1)?.player;
  if (first === 'loser' && loser && ids.includes(loser)) return loser;
  const before = last.stats?.find((stat) => stat.name === FIRST)?.player;
  return ids.find((id) => id !== before) ?? ids[0];
}

const otherOf = (state: Pick<State, 'players'>, id: PlayerId) =>
  state.players[0] === id ? state.players[1] : state.players[0];

/** The rules' position for a state. */
export const positionOf = (state: State) =>
  Position.from(
    state.board,
    state.turn === state.players[0] ? 'w' : 'b',
    state.castling,
    state.ep,
    state.half,
    state.full,
  );

/** Ends the Match: `winner` null is a draw. Each seat's score is its wins in the series. */
function ended(ctx: GameContext<State, Options>, winner: PlayerId | null) {
  const wins = { ...ctx.state.wins };
  if (winner) wins[winner] = (wins[winner] ?? 0) + 1;
  ctx.stat(ctx.state.players[0], FIRST);
  ctx.finish(
    ctx.players.map((seat) => (!winner || seat.id === winner ? 1 : 2)),
    { scores: ctx.players.map((seat) => wins[seat.id] ?? 0) },
  );
  return wins;
}

const square = z.int().min(0).max(63);

export class CoVuaGame extends Game<State, Options> {
  readonly events = {
    move: z.object({ from: square, to: square, promo: z.enum(['q', 'r', 'b', 'n']).optional() }),
    resign: z.object({}),
    draw: z.object({}),
    decline: z.object({}),
  };

  onStart({ players, options, lastResult }: StartContext<Options>): State {
    const ids = players.map((p) => p.id) as [PlayerId, PlayerId];
    const white = whiteOf(ids, options, lastResult);
    const black = ids.find((id) => id !== white) as PlayerId;
    const pos = Position.from(START, 'w', 'KQkq', -1, 0, 1);
    return {
      board: START,
      players: [white, black],
      turn: white,
      castling: 'KQkq',
      ep: -1,
      half: 0,
      full: 1,
      keys: [pos.key()],
      sans: [],
      last: null,
      offer: null,
      phase: 'play',
      winner: null,
      ending: null,
      wins: Object.fromEntries(
        ids.map((id) => [id, lastResult?.seats.find((s) => s.player === id)?.score ?? 0]),
      ),
    };
  }

  /** Moves a piece by the rules of chess; checkmate wins, and the draws end the Match. */
  onMove(
    ctx: EventContext<State, { from: number; to: number; promo?: 'q' | 'r' | 'b' | 'n' }, Options>,
  ): State {
    const { state, player, payload, reject } = ctx;
    if (state.phase !== 'play') reject('Ván đã kết thúc');
    if (state.turn !== player.id) reject('Chưa tới lượt bạn');
    const pos = positionOf(state);
    const piece = state.board[payload.from] ?? '.';
    const white = state.turn === state.players[0];
    if (piece === '.' || (piece === piece.toUpperCase()) !== white)
      reject('Đó không phải quân của bạn');
    const legal = pos.legal();
    const move = findMove(pos, payload.from, payload.to, payload.promo);
    if (move === null) {
      const king = pos.inCheck() ? 'Vua đang bị chiếu' : 'Nước này không hợp lệ';
      const exposes = pos
        .pseudo([])
        .some((m) => sq64(fromOf(m)) === payload.from && sq64(toOf(m)) === payload.to);
      reject(
        exposes ? (pos.inCheck() ? king : 'Nước này để vua bị chiếu') : 'Nước này không hợp lệ',
      );
    }
    const m = move as number;
    const san = pos.san(m, legal);
    const capture = state.board[payload.to] !== '.' || san.includes('x');
    pos.make(m);
    const check = pos.inCheck();
    const key = pos.key();
    const keys = [...state.keys, key];
    const last: LastMove = { from: payload.from, to: payload.to, san, capture, check };
    if (san.startsWith('O-O')) {
      const row = payload.from - (payload.from % 8);
      last.rook = san === 'O-O' ? { from: row + 7, to: row + 5 } : { from: row, to: row + 3 };
    }
    if (capture) ctx.stat(player.id, 'capture');
    if (promoOf(m)) ctx.stat(player.id, 'promote');
    let next: State = {
      ...state,
      board: pos.boardString(),
      turn: otherOf(state, player.id),
      castling: pos.castlingString(),
      ep: pos.ep >= 0 ? sq64(pos.ep) : -1,
      half: pos.half,
      full: pos.full,
      keys,
      sans: [...state.sans, san],
      last,
      offer: null,
    };
    const replies = pos.legal().length;
    let ending: Ending | null = null;
    let winner: PlayerId | null = null;
    if (!replies) {
      ending = check ? 'checkmate' : 'stalemate';
      if (check) winner = player.id;
    } else if (pos.insufficient()) ending = 'material';
    else if (pos.half >= 100) ending = 'fifty';
    else if (keys.filter((k) => k === key).length >= 3) ending = 'repetition';
    if (ending) {
      if (ending === 'checkmate') ctx.stat(player.id, 'checkmate');
      next = { ...next, phase: 'over', ending, winner, wins: ended(ctx, winner) };
    }
    return next;
  }

  /** Offers a draw, or takes the one the other player offered. */
  onDraw(ctx: EventContext<State, Record<string, never>, Options>): State {
    const { state, player, reject } = ctx;
    if (state.phase !== 'play') reject('Ván đã kết thúc');
    if (state.offer === player.id) reject('Bạn đã cầu hoà rồi');
    if (state.offer) {
      return {
        ...state,
        phase: 'over',
        ending: 'agreement',
        winner: null,
        offer: null,
        wins: ended(ctx, null),
      };
    }
    return { ...state, offer: player.id };
  }

  /** Turns down the other player's draw offer. */
  onDecline({ state, player, reject }: EventContext<State, Record<string, never>, Options>): State {
    if (!state.offer || state.offer === player.id) reject('Không có lời cầu hoà nào');
    return { ...state, offer: null };
  }

  /** Gives the Match to the other player. */
  onResign(ctx: EventContext<State, Record<string, never>, Options>): State {
    const { state, player, reject } = ctx;
    if (state.phase !== 'play') reject('Ván đã kết thúc');
    const winner = otherOf(state, player.id);
    return {
      ...state,
      phase: 'over',
      ending: 'resign',
      winner,
      offer: null,
      wins: ended(ctx, winner),
    };
  }

  /** A player left mid-Match: the one who stays wins. */
  onLeave(ctx: LeaveContext<State, Options>): State {
    const winner = otherOf(ctx.state, ctx.player.id);
    return {
      ...ctx.state,
      phase: 'over',
      ending: 'leave',
      winner,
      offer: null,
      wins: ended(ctx, winner),
    };
  }

  /** The computer answers a draw offer by its reading of the board, then moves. */
  bot({ state, player, rng, options }: BotContext<State, Options>) {
    if (state.phase !== 'play') return null;
    if (state.offer && state.offer !== player.id) {
      const pos = positionOf(state);
      if (state.turn !== player.id) pos.makeNull();
      const score = judge(pos, state.keys);
      return {
        event: score < -150 || (Math.abs(score) < 40 && state.full > 30) ? 'draw' : 'decline',
        payload: {},
      };
    }
    if (state.turn !== player.id) return null;
    const pos = positionOf(state);
    const m = chooseMove(pos, options.level, state.keys, rng);
    const promo = promoOf(m);
    return {
      event: 'move',
      payload: {
        from: sq64(fromOf(m)),
        to: sq64(toOf(m)),
        ...(promo && { promo: ' pnbrqk'[promo] }),
      },
    };
  }

  /** The computer seems to think: quickly in the opening, longer later on. */
  botDelay({ state, rng }: BotContext<State, Options>) {
    if (state.offer) return 900 + Math.floor(rng() * 500);
    return state.full < 4 ? 450 + Math.floor(rng() * 400) : 700 + Math.floor(rng() * 900);
  }
}
