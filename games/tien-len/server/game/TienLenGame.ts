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
import { botPlay } from './bot.js';
import { beats, type Card, cardName, comboOf, fullDeck, isChop } from './cards.js';
import { roundPoints, standings } from './match.js';
import {
  dealMs,
  INTRO,
  type Options,
  type Play,
  ROUND_OVER_MS,
  type State,
  TURN_MS,
  type View,
} from './model.js';

const play = z.object({ cards: z.array(z.number().int().min(0).max(51)).min(1).max(13) });

type Ctx = GameContext<State, Options>;

export class TienLenGame extends Game<State, Options, View> {
  readonly events = { play, pass: z.object({}) };

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
    const cards = botPlay(state, player.seat);
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

/** Still in this round with cards in hand. */
const isPlaying = (state: State, seat: number) => (state.hands[seat]?.length ?? 0) > 0;

/** The first seat after `seat` still holding cards. */
function nextPlaying(state: State, seat: number) {
  const n = state.hands.length;
  for (let k = 1; k <= n; k++) {
    const next = (seat + k) % n;
    if (isPlaying(state, next)) return next;
  }
  return null;
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
  const { state } = ctx;
  const sorted = [...cards].sort((a, b) => a - b);
  const hand = (state.hands[seat] ?? []).filter((c) => !sorted.includes(c));
  const played: Play = {
    seat,
    cards: sorted,
    kind: comboOf(sorted)?.kind ?? 'single',
    trick: state.trick,
  };
  const next = advance({
    ...state,
    hands: state.hands.map((h, s) => (s === seat ? hand : h)),
    table: played,
    played: [...state.played, played],
    mustPlay: null,
    out: hand.length === 0 ? [...state.out, seat] : state.out,
  });
  return endRound(ctx, next) ?? withClock(ctx, next);
}

function pass(ctx: Ctx, seat: number): State {
  const next = advance({
    ...ctx.state,
    passed: ctx.state.passed.map((p, s) => p || s === seat),
  });
  return withClock(ctx, next);
}

/**
 * The turn moves on to the next seat still in the trick. When it comes back to whoever played
 * last, everyone else passed: they start a new trick. If they have no cards left, the first
 * player after them leads instead.
 */
function advance(state: State): State {
  const n = state.hands.length;
  const owner = state.table?.seat;
  for (let k = 1; k <= n; k++) {
    const seat = (state.turn + k) % n;
    if (seat === owner && isPlaying(state, seat)) return newTrick(state, seat);
    if (seat !== owner && isPlaying(state, seat) && !state.passed[seat]) {
      return { ...state, turn: seat };
    }
  }
  const lead = nextPlaying(state, owner ?? state.turn);
  return lead === null ? state : newTrick(state, lead);
}

const newTrick = (state: State, lead: number): State => ({
  ...state,
  turn: lead,
  table: null,
  trick: state.trick + 1,
  passed: state.passed.map(() => false),
});

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
