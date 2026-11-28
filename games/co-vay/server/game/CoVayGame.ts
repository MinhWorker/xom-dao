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
import { count, group, hash, indexOf, play } from './board.js';
import { botMove, deadStones } from './bot.js';
import {
  BLACK,
  type Count,
  EMPTY,
  type Options,
  type Point,
  SIZE,
  type State,
  type Stone,
  WHITE,
} from './model.js';

/** The stat that marks who played Black, which the next Match reads back from `ctx.lastResult`. */
const FIRST = 'first';

/**
 * Who plays Black: the first seat in a new series; then the loser of the last Match ("Người
 * thua") or each in turn ("Lần lượt").
 */
export function blackOf(
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

export const stoneOf = (state: Pick<State, 'players'>, id: PlayerId): Stone =>
  state.players[0] === id ? BLACK : WHITE;
const otherOf = (state: Pick<State, 'players'>, id: PlayerId) =>
  state.players[0] === id ? state.players[1] : state.players[0];

/** Ends the Match won by `winner`; each seat's score is its wins in the series. */
function won(ctx: GameContext<State, Options>, winner: PlayerId) {
  const wins = { ...ctx.state.wins, [winner]: (ctx.state.wins[winner] ?? 0) + 1 };
  ctx.stat(ctx.state.players[0], FIRST);
  ctx.finish(
    ctx.players.map((seat) => (seat.id === winner ? 1 : 2)),
    { scores: ctx.players.map((seat) => wins[seat.id] ?? 0) },
  );
  return wins;
}

const coord = z
  .int()
  .min(0)
  .max(SIZE - 1);

export class CoVayGame extends Game<State, Options> {
  readonly events = {
    place: z.object({ x: coord, y: coord }),
    pass: z.object({}),
    resign: z.object({}),
    dead: z.object({ x: coord, y: coord }),
    accept: z.object({}),
    resume: z.object({}),
  };

  onStart({ players, options, lastResult }: StartContext<Options>): State {
    const ids = players.map((p) => p.id) as [PlayerId, PlayerId];
    const black = blackOf(ids, options, lastResult);
    const white = ids.find((id) => id !== black) as PlayerId;
    const board = new Array(SIZE * SIZE).fill(EMPTY);
    return {
      size: SIZE,
      board,
      players: [black, white],
      turn: black,
      phase: 'play',
      last: null,
      passes: 0,
      captures: { [black]: 0, [white]: 0 },
      moves: 0,
      seen: [hash(board)],
      dead: [],
      agreed: [],
      count: null,
      winner: null,
      ending: null,
      wins: Object.fromEntries(
        ids.map((id) => [id, lastResult?.seats.find((s) => s.player === id)?.score ?? 0]),
      ),
    };
  }

  /** Puts a stone down: it takes the stones it leaves with no liberty; it may not repeat a
   * position seen before in the Match, nor take its own last liberty. */
  onPlace(ctx: EventContext<State, Point, Options>): State {
    const { state, player, payload, reject } = ctx;
    this.check(ctx);
    const { size } = state;
    const i = indexOf(size, payload);
    const stone = stoneOf(state, player.id);
    const result = play(state.board, size, i, stone);
    if ('error' in result) {
      return reject(
        result.error === 'occupied' ? 'Điểm này đã có quân' : 'Không được đặt vào chỗ hết khí',
      );
    }
    const key = hash(result.board);
    if (state.seen.includes(key)) reject('Nước này lặp lại thế cờ cũ');
    if (result.captured.length) ctx.stat(player.id, 'capture', result.captured.length);
    return {
      ...state,
      board: result.board,
      turn: otherOf(state, player.id),
      last: { ...payload, stone, captured: result.captured.length },
      passes: 0,
      captures: {
        ...state.captures,
        [player.id]: (state.captures[player.id] ?? 0) + result.captured.length,
      },
      moves: state.moves + 1,
      seen: [...state.seen, key],
    };
  }

  /** Passes; after two passes in a row the players count (dead stones guessed for them). */
  onPass(ctx: EventContext<State, Record<string, never>, Options>): State {
    const { state, player } = ctx;
    this.check(ctx);
    const passes = state.passes + 1;
    const next: State = {
      ...state,
      turn: otherOf(state, player.id),
      last: { pass: stoneOf(state, player.id) },
      passes,
      moves: state.moves + 1,
    };
    if (passes < 2) return next;
    return {
      ...next,
      phase: 'score',
      dead: deadStones(state.board, state.size, BLACK, ctx.rng),
      agreed: [],
    };
  }

  /** While counting: marks a group dead, or alive again. Either player may; agreements reset. */
  onDead(ctx: EventContext<State, Point, Options>): State {
    const { state, payload, reject } = ctx;
    if (state.phase !== 'score') reject('Chưa tới lúc đếm');
    const i = indexOf(state.size, payload);
    if (state.board[i] === EMPTY) reject('Chọn một quân để đánh dấu');
    const { stones } = group(state.board, state.size, i);
    const dead = new Set(state.dead);
    const marking = !dead.has(i);
    for (const s of stones) {
      if (marking) dead.add(s);
      else dead.delete(s);
    }
    return { ...state, dead: [...dead].sort((a, b) => a - b), agreed: [] };
  }

  /** While counting: agrees to the dead stones as marked; once both do, the count decides. */
  onAccept(ctx: EventContext<State, Record<string, never>, Options>): State {
    const { state, player, reject } = ctx;
    if (state.phase !== 'score') reject('Chưa tới lúc đếm');
    if (state.agreed.includes(player.id)) return state;
    const agreed = [...state.agreed, player.id];
    if (agreed.length < 2) return { ...state, agreed };
    const result = count(state.board, state.size, new Set(state.dead));
    const winner = result.black > result.white ? state.players[0] : state.players[1];
    return {
      ...state,
      agreed,
      phase: 'over',
      count: result,
      winner,
      ending: 'count',
      wins: won(ctx, winner),
    };
  }

  /** While counting: goes back to playing; the other player moves first. */
  onResume(ctx: EventContext<State, Record<string, never>, Options>): State {
    const { state, player, reject } = ctx;
    if (state.phase !== 'score') reject('Chưa tới lúc đếm');
    return {
      ...state,
      phase: 'play',
      passes: 0,
      dead: [],
      agreed: [],
      turn: otherOf(state, player.id),
    };
  }

  /** Gives the Match to the other player. */
  onResign(ctx: EventContext<State, Record<string, never>, Options>): State {
    const { state, player, reject } = ctx;
    if (state.phase === 'over') reject('Ván đã kết thúc');
    const winner = otherOf(state, player.id);
    return { ...state, phase: 'over', winner, ending: 'resign', wins: won(ctx, winner) };
  }

  /** A player left mid-Match: the one who stays wins. */
  onLeave(ctx: LeaveContext<State, Options>): State {
    const winner = otherOf(ctx.state, ctx.player.id);
    return { ...ctx.state, phase: 'over', winner, ending: 'leave', wins: won(ctx, winner) };
  }

  /** The computer's move, pass, or its answer to the dead stones marked at the end. */
  bot({ state, player, rng, options }: BotContext<State, Options>) {
    if (state.phase === 'score') {
      if (state.agreed.includes(player.id)) return null;
      return { event: this.fairCount(state, player.id, rng) ? 'accept' : 'resume', payload: {} };
    }
    if (state.phase !== 'play' || state.turn !== player.id) return null;
    const stone = stoneOf(state, player.id);
    const otherPassed = !!state.last && 'pass' in state.last;
    const move = botMove(
      state.board,
      state.size,
      stone,
      state.seen,
      otherPassed,
      options.level,
      rng,
    );
    if (move < 0) return { event: 'pass', payload: {} };
    return { event: 'place', payload: { x: move % state.size, y: Math.floor(move / state.size) } };
  }

  /** The computer seems to think a little longer as the board fills. */
  botDelay({ state, rng }: BotContext<State, Options>) {
    if (state.phase === 'score') return 900 + Math.floor(rng() * 600);
    if (state.moves < 2) return 500 + Math.floor(rng() * 300);
    return 600 + Math.min(state.moves, 40) * 12 + Math.floor(rng() * 500);
  }

  /** Whether the dead stones marked cost the computer no more than its own reading would. */
  private fairCount(state: State, id: PlayerId, rng: BotContext<State, Options>['rng']) {
    const sign = stoneOf(state, id) === BLACK ? 1 : -1;
    const margin = (c: Count) => (c.black - c.white) * sign;
    const marked = margin(count(state.board, state.size, new Set(state.dead)));
    const own = margin(
      count(state.board, state.size, new Set(deadStones(state.board, state.size, BLACK, rng))),
    );
    return marked >= own - 1;
  }

  private check({
    state,
    player,
    reject,
  }: Pick<EventContext<State, unknown, Options>, 'state' | 'player' | 'reject'>) {
    if (state.phase === 'score') reject('Đang đếm đất');
    if (state.phase !== 'play') reject('Ván đã kết thúc');
    if (state.turn !== player.id) reject('Chưa tới lượt bạn');
  }
}
