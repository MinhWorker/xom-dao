/**
 * Cờ Tỷ Phú on the server. The turn player sends `roll`, then takes (`buy`, `upgrade`,
 * `takeover`, `fly`) or `pass`es what their Tile offers; in jail they may `pay-bail` or
 * `use-card` before rolling. Every decision runs the clock of the Room's "Tốc độ"; when it runs
 * out the safe choice is made (`timeout`): roll, or pass the offer.
 *
 * A payment larger than the payer's cash is a Debt (phase `debt`): the debtor `sell`s Levels or
 * Lots to the bank (selling.ts) until it is covered, or the suggested sale is made when the clock
 * runs out. When even Selling everything is not enough the payer is bankrupt at once.
 *
 * Cơ hội and Khí vận draw a Card (cards.ts). A Card that asks waits in phase `card` for the
 * drawer's `pick`; a Quiz then waits in phase `quiz` for their `answer`, on a 20 s clock. The
 * piles' order and a running Quiz's answer are hidden from `view`. Effects count down at the end
 * of each of their holder's turns; a seat with Ốm skips its turn. A computer seat, and the seat of
 * a person who left, is played by `bot` (bot.ts).
 */
import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type GameEvent,
  type Rng,
  type Seat,
  type StartContext,
  shuffle,
} from '@xomdao/sdk';
import { z } from 'zod';
import { AIRPORT_TILE, BOARD, isLot, JAIL_TILE } from './board.js';
import { botMove } from './bot.js';
import {
  asks,
  botPick,
  type CardAction,
  type CardId,
  cardOf,
  deckOf,
  JAIL_CARD,
  nearest,
  offers,
  picksOf,
} from './cards.js';
import { landPrice, rent, takeoverPrice, taxOf, upgradeCost } from './economy.js';
import {
  CLOCK_MS,
  type Deck,
  DOUBLES_TO_JAIL,
  type EffectId,
  HOTEL,
  JAIL_TRIES,
  MAX_EFFECTS,
  type Options,
  type Player,
  QUIZ_MS,
  type State,
  type View,
} from './model.js';
import { makeQuiz } from './quiz.js';
import { saleProblem, sell, suggestSale, unmark, wholeLots } from './selling.js';
import { TUNING, type Tuning } from './tuning.js';

type Ctx = GameContext<State, Options>;
type Move<P = Record<string, never>> = EventContext<State, P, Options>;
const tile = z
  .number()
  .int()
  .min(0)
  .max(BOARD.length - 1);
const fly = z.object({ to: tile });
const pick = z.object({ pick: z.number().int().min(0) });
const answer = z.object({ choice: z.number().int().min(0).max(3) });
const sale = z.object({
  sale: z.array(z.object({ tile, levels: z.number().int().min(1).optional() })).max(BOARD.length),
});
export interface CoTyPhuSetup {
  tuning?: Tuning;
  /** Rolls two dice for the Match's `roll`-th roll (from 0); tests script them. */
  dice?: (rng: Rng, roll: number) => [number, number];
  /** Changes the first state (tests set up a board with it). */
  arrange?: (state: State) => State;
}
const die = (rng: Rng) => 1 + Math.floor(rng() * 6);
export class CoTyPhuGame extends Game<State, Options, View> {
  readonly events = {
    roll: z.object({}),
    buy: z.object({}),
    upgrade: z.object({}),
    takeover: z.object({}),
    fly,
    pass: z.object({}),
    'pay-bail': z.object({}),
    'use-card': z.object({}),
    sell: sale,
    pick,
    answer,
  };
  private readonly t: Tuning;
  private readonly dice: (rng: Rng, roll: number) => [number, number];
  private readonly arrange: (state: State) => State;
  constructor({ tuning = TUNING, dice, arrange }: CoTyPhuSetup = {}) {
    super();
    this.t = tuning;
    this.dice = dice ?? ((rng) => [die(rng), die(rng)]);
    this.arrange = arrange ?? ((s) => s);
  }
  onStart(ctx: StartContext<Options>): State {
    const player: Player = {
      cash: this.t.startingCash,
      tile: 0,
      jailed: false,
      jailTries: 0,
      jailCards: 0,
      bankrupt: false,
      effects: [],
    };
    const state = this.arrange({
      players: ctx.players.map(() => ({ ...player })),
      lots: BOARD.map(() => null),
      turn: 0,
      phase: 'roll',
      dice: null,
      rolls: 0,
      doubles: 0,
      again: false,
      bankrupt: [],
      debt: null,
      decks: {
        chance: shuffle(ctx.rng, deckOf('chance')),
        chest: shuffle(ctx.rng, deckOf('chest')),
      },
      card: null,
      quiz: null,
      festival: null,
      blackout: null,
    });
    ctx.setTimer(CLOCK_MS[ctx.options.speed], 'timeout');
    return state;
  }
  onRoll(ctx: Move): State {
    this.check(ctx, 'roll');
    return this.settle(ctx, this.roll(ctx, ctx.state));
  }
  onPayBail(ctx: Move): State {
    const me = this.checkJailed(ctx);
    if (me.cash < this.t.jailFine) ctx.reject('Không đủ tiền');
    const free = { ...me, cash: me.cash - this.t.jailFine, jailed: false, jailTries: 0 };
    return this.settle(ctx, withPlayer(ctx.state, ctx.player.seat, free));
  }
  onUseCard(ctx: Move): State {
    const me = this.checkJailed(ctx);
    if (me.jailCards < 1) ctx.reject('Bạn không có vé ra tù');
    const free = { ...me, jailCards: me.jailCards - 1, jailed: false, jailTries: 0 };
    return this.settle(ctx, returnJailCards(withPlayer(ctx.state, ctx.player.seat, free), 1));
  }
  onBuy(ctx: Move): State {
    const me = this.check(ctx, 'buy');
    const price = landPrice(this.t, me.tile);
    if (me.cash < price) ctx.reject('Không đủ tiền');
    const level = BOARD[me.tile]?.kind === 'city' ? 1 : 0;
    const state = withPlayer(ctx.state, ctx.player.seat, { ...me, cash: me.cash - price });
    return this.settle(
      ctx,
      this.next(withLot(state, me.tile, { owner: ctx.player.seat, level, built: 0 })),
    );
  }
  onUpgrade(ctx: Move): State {
    const me = this.check(ctx, 'upgrade');
    const cost = upgradeCost(this.t, ctx.state, ctx.player.seat, me.tile);
    const lot = ctx.state.lots[me.tile];
    if (!lot) ctx.reject('Chưa thể làm việc này lúc này');
    if (me.cash < cost) ctx.reject('Không đủ tiền');
    const state = withPlayer(ctx.state, ctx.player.seat, { ...me, cash: me.cash - cost });
    const built = { ...lot, level: lot.level + 1, built: lot.built + cost };
    return this.settle(ctx, this.next(withLot(state, me.tile, built)));
  }
  onTakeover(ctx: Move): State {
    const me = this.check(ctx, 'takeover');
    const price = takeoverPrice(this.t, ctx.state, me.tile);
    const lot = ctx.state.lots[me.tile];
    if (!lot || price === null) ctx.reject('Chưa thể làm việc này lúc này');
    if (me.cash < price) ctx.reject('Không đủ tiền');
    let state = transfer(ctx.state, ctx.player.seat, lot.owner, price);
    state = withLot(state, me.tile, { ...lot, owner: ctx.player.seat });
    return this.settle(ctx, this.offerUpgrade(state, ctx.player.seat) ?? this.next(state));
  }
  onFly(ctx: Move<z.infer<typeof fly>>): State {
    const me = this.check(ctx, 'fly');
    if (ctx.payload.to === AIRPORT_TILE) ctx.reject('Bạn đang ở Sân bay');
    if (me.cash < this.t.airportFee) ctx.reject('Không đủ tiền');
    const seat = ctx.player.seat;
    const to = ctx.payload.to;
    const bonus = to === 0 ? this.t.startBonus : 0;
    const cash = me.cash - this.t.airportFee + bonus;
    const state = withPlayer(ctx.state, seat, { ...me, cash, tile: to });
    return this.settle(ctx, this.land(state, seat));
  }
  onPass(ctx: Move): State {
    if (ctx.state.turn !== ctx.player.seat) ctx.reject('Chưa tới lượt bạn');
    if (ctx.state.phase === 'roll') ctx.reject('Hãy gieo xúc xắc');
    if (ctx.state.phase === 'debt') ctx.reject('Hãy bán đất để trả nợ');
    if (ctx.state.phase === 'card' || ctx.state.phase === 'quiz') ctx.reject('Hãy chọn');
    return this.settle(ctx, this.next(ctx.state));
  }

  onPick(ctx: Move<z.infer<typeof pick>>): State {
    this.check(ctx, 'card');
    const action = this.pending(ctx.state);
    if (!picksOf(ctx.state, ctx.player.seat, action).includes(ctx.payload.pick))
      ctx.reject('Không chọn được');
    return this.settle(ctx, this.pickCard(ctx, ctx.state, action, ctx.payload.pick));
  }

  onAnswer(ctx: Move<z.infer<typeof answer>>): State {
    this.check(ctx, 'quiz');
    return this.settle(ctx, this.answerQuiz(ctx.state, ctx.payload.choice));
  }

  onSell(ctx: Move<z.infer<typeof sale>>): State {
    const { debt } = ctx.state;
    if (ctx.state.phase !== 'debt' || !debt) ctx.reject('Chưa thể làm việc này lúc này');
    if (debt.from !== ctx.player.seat) ctx.reject('Bạn không có nợ');
    const problem = saleProblem(ctx.state, debt.from, ctx.payload.sale);
    if (problem) ctx.reject(problem);
    const sold = sell(this.t, ctx.state, debt.from, ctx.payload.sale);
    if ((sold.players[debt.from] as Player).cash < debt.amount) ctx.reject('Bán chưa đủ để trả nợ');
    return this.settle(ctx, this.payDebt(sold));
  }
  /** The clock ran out: the safe choice. */
  onTimeout(ctx: Ctx): State {
    const { state } = ctx;
    if (state.phase === 'roll') return this.settle(ctx, this.roll(ctx, state));
    if (state.phase === 'debt' && state.debt)
      return this.settle(
        ctx,
        this.payDebt(sell(this.t, state, state.debt.from, state.debt.suggested)),
      );
    if (state.phase === 'card') {
      const action = this.pending(state);
      const picks = picksOf(state, state.turn, action);
      const choice = offers(action) ? 0 : botPick(this.t, state, action, picks);
      return this.settle(ctx, this.pickCard(ctx, state, action, choice));
    }
    if (state.phase === 'quiz') return this.settle(ctx, this.answerQuiz(state, null));
    return this.settle(ctx, this.next(state));
  }

  /** The piles' sizes instead of their order, and no answer while the Quiz runs. */
  view(ctx: Ctx, _viewer: Seat | null): View {
    const { decks, quiz, ...rest } = ctx.state;
    return {
      ...rest,
      decks: { chance: decks.chance.length, chest: decks.chest.length },
      quiz: quiz && { ...quiz, answer: rest.phase === 'quiz' ? null : quiz.answer },
    };
  }

  /** A computer seat plays sensibly (bot.ts). */
  bot(ctx: BotContext<State, Options>): GameEvent | null {
    return botMove(this.t, ctx.state, ctx.player.seat, ctx.rng);
  }
  /** Refuses a move out of turn or out of `phase`; the turn player otherwise. */
  private check(ctx: Move<unknown>, phase: State['phase']): Player {
    if (ctx.state.turn !== ctx.player.seat) ctx.reject('Chưa tới lượt bạn');
    if (ctx.state.phase !== phase) ctx.reject('Chưa thể làm việc này lúc này');
    return ctx.state.players[ctx.player.seat] as Player;
  }
  /** Refuses getting out of jail before the roll, unless jailed and not on the last try. */
  private checkJailed(ctx: Move): Player {
    const me = this.check(ctx, 'roll');
    if (!me.jailed) ctx.reject('Bạn không ở tù');
    if (me.jailTries >= JAIL_TRIES - 1) ctx.reject('Lần này phải gieo');
    return me;
  }
  /** Ends the Match when one player is left, or runs the clock for the next decision. */
  private settle(ctx: Ctx, state: State): State {
    const n = state.players.length;
    if (state.bankrupt.length >= n - 1) {
      const places = state.players.map((_, seat) => {
        const out = state.bankrupt.indexOf(seat);
        return out < 0 ? 1 : n - out;
      });
      ctx.finish(places, { scores: state.players.map((p) => p.cash) });
      return state;
    }
    ctx.setTimer(state.phase === 'quiz' ? QUIZ_MS : CLOCK_MS[ctx.options.speed], 'timeout');
    return state;
  }
  /** Two dice, or one under Kẹt xe. */
  private rollDice(ctx: Ctx, state: State, seat: number): number[] {
    const dice = this.dice(ctx.rng, state.rolls);
    return has(state, seat, 'traffic') ? [dice[0]] : dice;
  }
  private roll(ctx: Ctx, state: State): State {
    const seat = state.turn;
    const me = state.players[seat] as Player;
    const dice = this.rollDice(ctx, state, seat);
    const double = dice.length === 2 && dice[0] === dice[1];
    const walk = sum(dice);
    const rolled = { ...state, dice, rolls: state.rolls + 1 };
    if (me.jailed) {
      const tries = me.jailTries + 1;
      if (!double && tries < JAIL_TRIES) {
        return this.endTurn(withPlayer(rolled, seat, { ...me, jailTries: tries }));
      }
      const free = withPlayer(rolled, seat, { ...me, jailed: false, jailTries: 0 });
      return this.move({ ...free, again: false }, seat, walk);
    }
    const doubles = state.doubles + (double ? 1 : 0);
    if (doubles >= DOUBLES_TO_JAIL) return this.endTurn(toJail({ ...rolled, doubles }, seat));
    return this.move({ ...rolled, doubles, again: double }, seat, walk);
  }
  /** Walks `steps` Tiles, paid on passing Xuất phát, then lands. */
  private move(state: State, seat: number, steps: number): State {
    const me = state.players[seat] as Player;
    const tile = (me.tile + steps) % BOARD.length;
    const bonus = me.tile + steps >= BOARD.length ? this.t.startBonus : 0;
    return this.land(withPlayer(state, seat, { ...me, tile, cash: me.cash + bonus }), seat);
  }
  /** What the Tile under `seat` does: an offer to decide, or its effect and the turn goes on. */
  private land(state: State, seat: number): State {
    const me = state.players[seat] as Player;
    const tile = BOARD[me.tile];
    const lot = state.lots[me.tile];
    if (isLot(tile)) {
      if (!lot)
        return me.cash >= landPrice(this.t, me.tile)
          ? { ...state, phase: 'buy' }
          : this.next(state);
      if (lot.owner === seat) return this.offerUpgrade(state, seat) ?? this.next(state);
      const owner = state.players[lot.owner] as Player;
      const due = owner.jailed ? 0 : rent(this.t, state, me.tile, sum(state.dice ?? []));
      if (due > 0 && has(state, seat, 'exempt'))
        return this.afterPaying(loseEffect(state, seat, 'exempt'), seat);
      return this.afterPaying(this.charge(state, seat, lot.owner, due), seat);
    }
    if (tile?.kind === 'chance') return this.draw(state, seat, 'chance');
    if (tile?.kind === 'chest') return this.draw(state, seat, 'chest');
    if (tile?.kind === 'tax')
      return this.afterPaying(
        this.charge(state, seat, null, taxOf(this.t, tile.tax, me.cash)),
        seat,
      );
    if (tile?.kind === 'go-jail') return this.endTurn(toJail(state, seat));
    if (tile?.kind === 'airport' && me.cash >= this.t.airportFee) return { ...state, phase: 'fly' };
    return this.next(state);
  }
  /** The upgrade offer of a City `seat` owns and stands on, or `undefined` when there is none. */
  private offerUpgrade(state: State, seat: number): State | undefined {
    const me = state.players[seat] as Player;
    const lot = state.lots[me.tile];
    if (BOARD[me.tile]?.kind !== 'city' || !lot || lot.level >= HOTEL) return undefined;
    return me.cash >= upgradeCost(this.t, state, seat, me.tile)
      ? { ...state, phase: 'upgrade' }
      : undefined;
  }

  /** `seat` draws the top Card of `deck`: it waits for a pick when it asks, else it is applied. */
  private draw(state: State, seat: number, deck: Deck): State {
    const [id, ...rest] = state.decks[deck];
    if (!id) return this.next(state);
    const { action } = cardOf(id);
    const kept = action.kind === 'jail-free';
    const drawn: State = {
      ...state,
      decks: { ...state.decks, [deck]: kept ? rest : [...rest, id] },
      card: { id, seat, draw: (state.card?.draw ?? 0) + 1 },
    };
    if (!asks(action)) return this.applyCard(drawn, seat, action);
    return picksOf(drawn, seat, action).length > 0 ? { ...drawn, phase: 'card' } : this.next(drawn);
  }

  /** The action of the Card waiting in phase `card`. */
  private pending(state: State): CardAction {
    return cardOf(state.card?.id as CardId).action;
  }

  /** What a Card that does not ask does to its drawer `seat`. */
  private applyCard(state: State, seat: number, action: CardAction): State {
    const me = state.players[seat] as Player;
    const mine = state.lots.flatMap((l, tile) => (l?.owner === seat ? [tile] : []));
    switch (action.kind) {
      case 'jail-free':
        return this.next(withPlayer(state, seat, { ...me, jailCards: me.jailCards + 1 }));
      case 'cash-share': {
        const amount = Math.floor(Math.abs(action.share) * Math.max(0, me.cash));
        return this.money(state, seat, action.share < 0 ? -amount : amount);
      }
      case 'per-lot':
        return this.money(state, seat, action.amount * mine.length);
      case 'per-level': {
        const levels = mine.reduce(
          (n, tile) => n + (BOARD[tile]?.kind === 'city' ? (state.lots[tile]?.level ?? 0) : 0),
          0,
        );
        return this.money(state, seat, action.amount * levels);
      }
      case 'rich-to-poor': {
        const order = playing(state).sort(
          (a, b) => (state.players[b] as Player).cash - (state.players[a] as Player).cash || a - b,
        );
        const rich = order[0] as number;
        const poor = order[order.length - 1] as number;
        const even = (state.players[rich] as Player).cash === (state.players[poor] as Player).cash;
        if (even) return this.next(state);
        return this.afterPaying(this.charge(state, rich, poor, action.amount), rich);
      }
      case 'hotel-tax': {
        const hotels = (s: number) =>
          state.lots.filter((l) => l?.owner === s && l.level >= HOTEL).length;
        const payer = playing(state).sort(
          (a, b) =>
            hotels(b) - hotels(a) ||
            (state.players[b] as Player).cash - (state.players[a] as Player).cash ||
            a - b,
        )[0] as number;
        if (hotels(payer) === 0) return this.next(state);
        return this.afterPaying(
          this.charge(state, payer, null, action.amount * hotels(payer)),
          payer,
        );
      }
      case 'nearest':
        return this.move(state, seat, steps(me.tile, nearest(me.tile, action.tile)));
      case 'back': {
        const tile = (me.tile - action.steps + BOARD.length) % BOARD.length;
        return this.land(withPlayer(state, seat, { ...me, tile }), seat);
      }
      case 'go':
        return action.to === 'jail'
          ? this.endTurn(toJail(state, seat))
          : this.move(state, seat, steps(me.tile, 0));
      case 'effect':
        return this.next(this.gainEffect(state, seat, action.effect));
      default:
        return this.next(state);
    }
  }

  /** The drawer picked `choice` for the waiting Card. */
  private pickCard(ctx: Ctx, state: State, action: CardAction, choice: number): State {
    const seat = state.turn;
    const me = state.players[seat] as Player;
    const lot = state.lots[choice];
    switch (action.kind) {
      case 'cash-or-roll': {
        if (choice === 0) return this.money(state, seat, action.amount);
        const dice = this.rollDice(ctx, state, seat);
        return this.move({ ...state, dice, rolls: state.rolls + 1 }, seat, sum(dice));
      }
      case 'cash-or-start':
        return choice === 0
          ? this.money(state, seat, action.amount)
          : this.move(state, seat, steps(me.tile, 0));
      case 'quiz':
        if (choice === 0) return this.money(state, seat, this.t.quiz.safe);
        return { ...state, phase: 'quiz', quiz: { ...makeQuiz(ctx.rng), seat, picked: null } };
      case 'festival':
        return this.next({ ...state, festival: choice });
      case 'blackout':
        return this.next({ ...state, blackout: { tile: choice, by: seat } });
      case 'planning':
        return this.next(lot ? withLot(state, choice, { ...lot, level: lot.level + 1 }) : state);
      case 'swap': {
        const other = state.players[choice] as Player;
        const swapped = withPlayer(state, seat, { ...me, tile: other.tile });
        return this.next(withPlayer(swapped, choice, { ...other, tile: me.tile }));
      }
      default:
        return this.next(state);
    }
  }

  /** The Quiz is answered with `choice` (`null`: time ran out); a right answer pays. */
  private answerQuiz(state: State, choice: number | null): State {
    const quiz = state.quiz as NonNullable<State['quiz']>;
    const answered = { ...state, quiz: { ...quiz, picked: choice } };
    if (choice !== quiz.answer) return this.next(answered);
    return this.money(answered, quiz.seat, this.t.quiz.safe * this.t.quiz.times);
  }

  /** `seat` gets `amount` from the bank, or pays it when below 0, and the turn goes on. */
  private money(state: State, seat: number, amount: number): State {
    if (amount < 0) return this.afterPaying(this.charge(state, seat, null, -amount), seat);
    const me = state.players[seat] as Player;
    return this.next(withPlayer(state, seat, { ...me, cash: me.cash + amount }));
  }

  /** `seat` gains Effect `id` for its full length; one they hold is renewed. */
  private gainEffect(state: State, seat: number, id: EffectId): State {
    const me = state.players[seat] as Player;
    const others = me.effects.filter((e) => e.id !== id).slice(-(MAX_EFFECTS - 1));
    const effects = [...others, { id, turns: this.t.effects[id], fresh: true }];
    return withPlayer(state, seat, { ...me, effects });
  }

  /**
   * `from` pays `amount` to `to` (`null` = the bank). Short of cash, it becomes a Debt; when
   * even Selling everything is short, `from` Sells it all and is bankrupt.
   */
  private charge(state: State, from: number, to: number | null, amount: number): State {
    const payer = state.players[from] as Player;
    if (payer.cash >= amount) return transfer(state, from, to, amount);
    const suggested = suggestSale(this.t, state, from, amount - payer.cash);
    const raised = (sell(this.t, state, from, suggested).players[from] as Player).cash;
    if (raised >= amount) return { ...state, phase: 'debt', debt: { from, to, amount, suggested } };
    return bankrupt(sell(this.t, state, from, wholeLots(state, from)), from, to, amount);
  }

  /** The debtor has Sold enough: pays the Debt and goes on. */
  private payDebt(sold: State): State {
    const { from, to, amount } = sold.debt as NonNullable<State['debt']>;
    return this.afterPaying(this.charge(sold, from, to, amount), from);
  }

  /** A payment by `seat` is made: offers the Takeover of the Lot they stand on, or goes on. */
  private afterPaying(state: State, seat: number): State {
    if (state.debt) return state;
    if (seat !== state.turn) return this.next(state);
    const me = state.players[seat] as Player;
    const lot = state.lots[me.tile];
    const price = takeoverPrice(this.t, state, me.tile);
    if (!me.bankrupt && lot && lot.owner !== seat && price !== null && me.cash >= price)
      return { ...state, phase: 'takeover' };
    return this.next(state);
  }
  /** The offer is settled: a double rolls again, else the next seat's turn. */
  private next(state: State): State {
    const me = state.players[state.turn] as Player;
    if (state.again && !me.bankrupt && !me.jailed) return { ...state, phase: 'roll', again: false };
    return this.endTurn(state);
  }
  /**
   * The turn player's Effects count down, and the next seat not bankrupt plays; one with Ốm
   * spends that turn being skipped. A Blackout ends when its placer's turn comes again.
   */
  private endTurn(ended: State): State {
    const n = ended.players.length;
    let state = countDown(ended, ended.turn);
    let turn = ended.turn;
    for (;;) {
      turn = (turn + 1) % n;
      if (state.blackout?.by === turn) state = { ...state, blackout: null };
      if (state.players[turn]?.bankrupt) continue;
      if (!has(state, turn, 'sick')) break;
      state = countDown(state, turn);
    }
    return {
      ...state,
      turn,
      phase: 'roll',
      doubles: 0,
      again: false,
      debt: null,
    };
  }
}
const sum = (dice: readonly number[]) => dice.reduce((a, b) => a + b, 0);

/** How many Tiles ahead `to` is from `from` (a full lap when they are the same). */
const steps = (from: number, to: number) => ((to - from + BOARD.length - 1) % BOARD.length) + 1;

/** The seats not bankrupt. */
const playing = (state: State) => state.players.flatMap((p, s) => (p.bankrupt ? [] : [s]));

const has = (state: State, seat: number, id: EffectId) =>
  state.players[seat]?.effects.some((e) => e.id === id) ?? false;

const loseEffect = (state: State, seat: number, id: EffectId): State => {
  const me = state.players[seat] as Player;
  return withPlayer(state, seat, { ...me, effects: me.effects.filter((e) => e.id !== id) });
};

/** One of `seat`'s turns ends: their Effects count down, except those gained in it. */
function countDown(state: State, seat: number): State {
  const me = state.players[seat] as Player;
  const effects = me.effects.flatMap((e) => {
    if (e.fresh || e.id === 'exempt') return [{ ...e, fresh: false }];
    return e.turns > 1 ? [{ ...e, turns: e.turns - 1 }] : [];
  });
  return withPlayer(state, seat, { ...me, effects });
}

/** `count` jail-free Cards go back to the bottom of the decks missing theirs. */
function returnJailCards(state: State, count: number): State {
  const decks = { ...state.decks };
  for (let k = 0; k < count; k++) {
    const deck = (['chance', 'chest'] as const).find((d) => !decks[d].includes(JAIL_CARD[d]));
    if (deck) decks[deck] = [...decks[deck], JAIL_CARD[deck]];
  }
  return { ...state, decks };
}

const withPlayer = (state: State, seat: number, player: Player): State => ({
  ...state,
  players: state.players.map((p, s) => (s === seat ? player : p)),
});
const withLot = (state: State, tile: number, lot: State['lots'][number]): State => ({
  ...state,
  lots: state.lots.map((l, i) => (i === tile ? lot : l)),
});
const toJail = (state: State, seat: number): State =>
  withPlayer({ ...state, again: false }, seat, {
    ...(state.players[seat] as Player),
    tile: JAIL_TILE,
    jailed: true,
    jailTries: 0,
  });

/** `from` pays `amount` they have to `to` (`null` = the bank). */
function transfer(state: State, from: number, to: number | null, amount: number): State {
  const payer = state.players[from] as Player;
  const paid = withPlayer({ ...state, debt: null }, from, {
    ...payer,
    cash: payer.cash - amount,
  });
  if (to === null) return paid;
  const creditor = paid.players[to] as Player;
  return withPlayer(paid, to, { ...creditor, cash: creditor.cash + amount });
}

/**
 * `from` cannot pay `amount`: the creditor gets their cash (at most `amount`), their Lots go
 * back to the bank, their jail-free Cards go back to the decks and their Effects end.
 */
function bankrupt(state: State, from: number, to: number | null, amount: number): State {
  const payer = state.players[from] as Player;
  const paid = returnJailCards(
    transfer(state, from, to, Math.min(amount, Math.max(0, payer.cash))),
    payer.jailCards,
  );
  const out = withPlayer(paid, from, {
    ...payer,
    cash: 0,
    bankrupt: true,
    jailed: false,
    jailCards: 0,
    effects: [],
  });
  return unmark({
    ...out,
    lots: out.lots.map((l) => (l?.owner === from ? null : l)),
    bankrupt: [...out.bankrupt, from],
  });
}
