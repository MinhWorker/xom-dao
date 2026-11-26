/**
 * Tiến Lên (southern rules), on the server: a Match of several rounds. Players send `play` (some
 * cards) or `pass`; each hook checks the move and returns the next state. A round goes on until
 * everyone is ranked, the Match until its last round.
 *
 * A seat whose person left is played by the computer (`bot`), so no seat ever drops out.
 *
 * Timers drive the pace: `begin` after the deal and the round's announcement, `turn-over` when
 * a player runs out of time (only with two or more people at the table), `next-round` after the
 * round's ranking has been shown.
 */
import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type Seat,
  type StartContext,
  shuffle,
} from '@xomdao/sdk';
import { z } from 'zod';
import { beats, type Card, cardName, comboOf, fullDeck, isChop } from './cards.js';
import { roundPoints, standings } from './match.js';
import {
  dealMs,
  INTRO,
  type Options,
  ROUND_OVER_MS,
  type State,
  TURN_MS,
  type View,
} from './model.js';
import { afterPass, afterPlay, isPlaying } from './round.js';
import { bestMove } from './search.js';

const play = z.object({ cards: z.array(z.number().int().min(0).max(51)).min(1).max(13) });

type Ctx = GameContext<State, Options>;

export class TienLenGame extends Game<State, Options, View> {
  readonly events = { play, pass: z.object({}) };

  /** `playouts`: how hard the computer looks ahead (search.ts); 0 plays by the quick rules. */
  constructor(private readonly config: { playouts?: number } = {}) {
    super();
  }

  /** The Match begins: the first deal. */
  onStart(ctx: StartContext<Options>): State {
    const n = ctx.players.length;
    const empty: State = {
      round: 0,
      rounds: ctx.options.rounds,
      phase: 'deal',
      hands: [],
      lead: 0,
      table: null,
      played: [],
      trick: 0,
      turn: 0,
      passed: [],
      mustPlay: null,
      out: [],
      points: Array(n).fill(0),
      firsts: Array(n).fill(0),
      results: [],
    };
    return deal({ ...ctx, state: empty }, empty);
  }

  /** The deal and the announcement are over: the lead may play. */
  onBegin(ctx: Ctx): State {
    const state: State = { ...ctx.state, phase: 'play', turn: ctx.state.lead };
    startClock(ctx);
    return state;
  }

  /** The round's ranking was shown: deal the next one. */
  onNextRound(ctx: Ctx): State {
    return deal(ctx, ctx.state);
  }

  /** Cards put on the table: a combination that beats what is there. */
  onPlay(ctx: EventContext<State, z.infer<typeof play>, Options>): State {
    const { state, player, payload, reject } = ctx;
    if (state.phase !== 'play') reject('Chưa tới lúc đánh');
    if (state.turn !== player.seat) reject('Chưa tới lượt bạn');
    const hand = state.hands[player.seat] ?? [];
    if (!payload.cards.every((c) => hand.includes(c))) reject('Bạn không có lá đó');
    const combo = comboOf(payload.cards);
    if (!combo) reject('Các lá này không thành bộ');
    if (state.mustPlay !== null && !payload.cards.includes(state.mustPlay)) {
      reject(`Lượt đầu phải đánh cả lá ${cardName(state.mustPlay)}`);
    }
    const table = state.table && comboOf(state.table.cards);
    if (combo && !beats(combo, table)) reject('Bài này không chặn được');
    if (combo && table && isChop(combo, table)) ctx.stat(player.id, 'chop');
    return playCards(ctx, player.seat, payload.cards);
  }

  /** Passing: out of this trick until everyone else has passed too. */
  onPass(ctx: EventContext<State, Record<string, never>, Options>): State {
    const { state, player, reject } = ctx;
    if (state.phase !== 'play') reject('Chưa tới lúc đánh');
    if (state.turn !== player.seat) reject('Chưa tới lượt bạn');
    if (!state.table) reject('Bạn đang cầm vòng, phải đánh');
    return pass(ctx, player.seat);
  }

  /** Time's up: pass, or when leading, play the lowest card (the one that must go, if any). */
  onTurnOver(ctx: Ctx): State {
    const { state } = ctx;
    if (state.phase !== 'play') return state;
    if (state.table) return pass(ctx, state.turn);
    const lowest = state.mustPlay ?? state.hands[state.turn]?.[0];
    return lowest === undefined ? state : playCards(ctx, state.turn, [lowest]);
  }

  /** The computer's move for its seat (see bot.ts). */
  bot({ state, player }: BotContext<State, Options>) {
    if (state.phase !== 'play' || state.turn !== player.seat) return null;
    const cards = bestMove(state, player.seat, this.config.playouts);
    return cards ? { event: 'play', payload: { cards } } : { event: 'pass' };
  }

  /** Everyone sees the table; only your own cards, and how many the others hold. */
  view({ state }: GameContext<State, Options>, viewer: Seat | null): View {
    const { hands, ...rest } = state;
    return {
      ...rest,
      hand: viewer ? (hands[viewer.seat] ?? []) : [],
      counts: hands.map((h) => h.length),
    };
  }
}

/**
 * Deals the next round to every seat. The first round is led by the holder of the lowest card
 * (who must play it), unless the Room's last Match had a winner seated again; later rounds by
 * the last round's winner.
 */
function deal(ctx: Ctx, state: State): State {
  const n = ctx.players.length;
  const deck = shuffle(ctx.rng, fullDeck());
  const hands = ctx.players.map((_, seat) =>
    deck.slice(13 * seat, 13 * seat + 13).sort((a, b) => a - b),
  );
  const lastWinner = state.results.at(-1)?.order[0];
  const champion = ctx.players.findIndex(
    (p) => p.id === ctx.lastResult?.seats.find((s) => s.place === 1)?.player,
  );
  let lead: number;
  let mustPlay: Card | null = null;
  if (lastWinner !== undefined) {
    lead = lastWinner;
  } else if (champion >= 0) {
    lead = champion;
  } else {
    const lowest = Math.min(...hands.flat());
    lead = hands.findIndex((h) => h.includes(lowest));
    mustPlay = lowest;
  }
  ctx.setTimer(dealMs(13 * n) + INTRO.roundMs + INTRO.leadMs, 'begin');
  return {
    ...state,
    round: state.round + 1,
    phase: 'deal',
    hands,
    lead,
    turn: lead,
    table: null,
    played: [],
    trick: 0,
    passed: Array(n).fill(false),
    mustPlay,
    out: [],
  };
}

/** `seat` puts `cards` (already checked) on the table. */
function playCards(ctx: Ctx, seat: number, cards: Card[]): State {
  const next = afterPlay(ctx.state, seat, cards);
  return endRound(ctx, next) ?? withClock(ctx, next);
}

function pass(ctx: Ctx, seat: number): State {
  return withClock(ctx, afterPass(ctx.state, seat));
}

/**
 * When one player (or none) still holds cards, the round is over: rank it, add the points, and
 * either end the Match or deal again after a pause. `undefined` while the round goes on.
 */
function endRound(ctx: Ctx, state: State): State | undefined {
  const holding = state.hands.map((_, s) => s).filter((s) => isPlaying(state, s));
  if (holding.length > 1) return undefined;
  const last = holding[0];
  const out = last === undefined ? state.out : [...state.out, last];
  const points = roundPoints(out, state.hands.length);
  const winner = out[0];
  const over: State = {
    ...state,
    phase: 'over',
    out,
    points: state.points.map((p, s) => p + (points[s] ?? 0)),
    firsts: state.firsts.map((f, s) => f + (s === winner ? 1 : 0)),
    results: [
      ...state.results,
      {
        order: out,
        points,
        holder: last ?? null,
        leftover: last === undefined ? [] : (state.hands[last] ?? []),
      },
    ],
  };
  if (over.round >= over.rounds) return finishMatch(ctx, over);
  ctx.setTimer(ROUND_OVER_MS, 'next-round');
  return over;
}

/** The Match's places follow its standings; the scores are the points. */
function finishMatch(ctx: Ctx, state: State): State {
  const places = Array<number>(state.points.length).fill(0);
  standings(state).forEach((seat, place) => {
    places[seat] = place + 1;
  });
  ctx.finish(places, { scores: state.points });
  return state;
}

/** Runs the turn clock when two or more people sit at the table. */
function startClock(ctx: Ctx) {
  if (ctx.players.filter((p) => !p.bot).length >= 2) ctx.setTimer(TURN_MS, 'turn-over');
  else ctx.clearTimer();
}

function withClock(ctx: Ctx, state: State) {
  startClock(ctx);
  return state;
}
