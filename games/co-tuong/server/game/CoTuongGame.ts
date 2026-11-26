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
import type { Ending, LastMove, Options, State } from './model.js';
import { chooseMove, judge } from './search.js';
import { findMove, fromOf, Position, START, toOf } from './xiangqi.js';

/** The stat that marks who played Red, which the next Match reads back from `ctx.lastResult`. */
const FIRST = 'first';
/** Moves without a capture that end the Match in a draw (60 each). */
const QUIET_LIMIT = 120;

/** Who plays Red: the first seat in a new series; then the loser of the last Match ("Người
 * thua", or after a draw whoever had Black) or each in turn ("Lần lượt"). */
export function redOf(
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
export const positionOf = (state: Pick<State, 'board' | 'turn' | 'players'>) =>
  Position.from(state.board, state.turn === state.players[0] ? 'r' : 'b');

/**
 * Who a repetition counts against: the side whose every move in the cycle gave check, when the
 * other's did not (perpetual check loses); `null` for a draw. `keys` and `checks` end with the
 * position just reached; `mover` made that move.
 */
export function perpetualChecker(
  keys: readonly number[],
  checks: readonly boolean[],
): 'mover' | 'other' | null {
  const n = keys.length - 1;
  const first = keys.indexOf(keys[n] as number);
  let moverAll = true;
  let otherAll = true;
  for (let j = n; j > first; j--) {
    if ((n - j) % 2 === 0) moverAll &&= !!checks[j];
    else otherAll &&= !!checks[j];
  }
  if (moverAll && !otherAll) return 'mover';
  if (otherAll && !moverAll) return 'other';
  return null;
}

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

const point = z.int().min(0).max(89);

export class CoTuongGame extends Game<State, Options> {
  readonly events = {
    move: z.object({ from: point, to: point }),
    resign: z.object({}),
    draw: z.object({}),
    decline: z.object({}),
  };

  onStart({ players, options, lastResult }: StartContext<Options>): State {
    const ids = players.map((p) => p.id) as [PlayerId, PlayerId];
    const red = redOf(ids, options, lastResult);
    const black = ids.find((id) => id !== red) as PlayerId;
    return {
      board: START,
      players: [red, black],
      turn: red,
      ply: 0,
      quiet: 0,
      keys: [Position.from(START, 'r').key()],
      checks: [false],
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

  /** Moves a piece by the rules; a general with no move loses, and the draws end the Match. */
  onMove(ctx: EventContext<State, { from: number; to: number }, Options>): State {
    const { state, player, payload, reject } = ctx;
    if (state.phase !== 'play') return reject('Ván đã kết thúc');
    if (state.turn !== player.id) return reject('Chưa tới lượt bạn');
    const piece = state.board[payload.from] ?? '.';
    const red = state.turn === state.players[0];
    if (piece === '.' || (piece === piece.toUpperCase()) !== red)
      return reject('Đó không phải quân của bạn');
    const pos = positionOf(state);
    const move = findMove(pos, payload.from, payload.to);
    if (move === null) {
      const exposes = pos
        .pseudo([])
        .some((m) => fromOf(m) === payload.from && toOf(m) === payload.to);
      if (!exposes) return reject('Nước này không hợp lệ');
      return reject(pos.inCheck() ? 'Tướng đang bị chiếu' : 'Nước này để tướng bị chiếu');
    }
    const taken = state.board[payload.to] === '.' ? null : (state.board[payload.to] as string);
    pos.make(move);
    const check = pos.inCheck();
    const key = pos.key();
    const keys = [...state.keys, key];
    const checks = [...state.checks, check];
    const last: LastMove = { from: payload.from, to: payload.to, taken, check };
    if (taken) ctx.stat(player.id, 'capture');
    let next: State = {
      ...state,
      board: pos.boardString(),
      turn: otherOf(state, player.id),
      ply: state.ply + 1,
      quiet: taken ? 0 : state.quiet + 1,
      keys,
      checks,
      last,
      offer: null,
    };
    let ending: Ending | null = null;
    let winner: PlayerId | null = null;
    if (!pos.legal().length) {
      ending = check ? 'checkmate' : 'stalemate';
      winner = player.id;
    } else if (keys.filter((k) => k === key).length >= 3) {
      const blame = perpetualChecker(keys, checks);
      ending = blame ? 'perpetual' : 'repetition';
      if (blame) winner = blame === 'mover' ? otherOf(state, player.id) : player.id;
    } else if (pos.insufficient()) ending = 'material';
    else if (next.quiet >= QUIET_LIMIT) ending = 'quiet';
    if (ending) {
      if (ending === 'checkmate') ctx.stat(player.id, 'checkmate');
      next = { ...next, phase: 'over', ending, winner, wins: ended(ctx, winner) };
    }
    return next;
  }

  /** Offers a draw, or takes the one the other player offered. */
  onDraw(ctx: EventContext<State, Record<string, never>, Options>): State {
    const { state, player, reject } = ctx;
    if (state.phase !== 'play') return reject('Ván đã kết thúc');
    if (state.offer === player.id) return reject('Bạn đã cầu hoà rồi');
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
    if (!state.offer || state.offer === player.id) return reject('Không có lời cầu hoà nào');
    return { ...state, offer: null };
  }

  /** Gives the Match to the other player. */
  onResign(ctx: EventContext<State, Record<string, never>, Options>): State {
    const { state, player, reject } = ctx;
    if (state.phase !== 'play') return reject('Ván đã kết thúc');
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
        event: score < -150 || (Math.abs(score) < 40 && state.ply > 60) ? 'draw' : 'decline',
        payload: {},
      };
    }
    if (state.turn !== player.id) return null;
    const m = chooseMove(positionOf(state), options.level, state.keys, rng, state.ply);
    return { event: 'move', payload: { from: fromOf(m), to: toOf(m) } };
  }

  /** The computer seems to think: quickly in the opening, longer later on. */
  botDelay({ state, rng }: BotContext<State, Options>) {
    if (state.offer) return 900 + Math.floor(rng() * 500);
    return state.ply < 6 ? 450 + Math.floor(rng() * 400) : 700 + Math.floor(rng() * 900);
  }
}
