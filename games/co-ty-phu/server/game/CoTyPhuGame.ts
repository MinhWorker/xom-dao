/**
 * Cờ Tỷ Phú on the server. The turn player sends `roll`, then takes (`buy`, `upgrade`,
 * `takeover`, `fly`) or `pass`es what their Tile offers; in jail they may `pay-bail` or
 * `use-card` before rolling. Every decision runs the clock of the Room's "Tốc độ"; when it runs
 * out the safe choice is made (`timeout`): roll, or pass the offer.
 *
 * A payment larger than the payer's cash is a Debt (phase `debt`): the debtor `sell`s Levels or
 * Lots to the bank (debt.ts) until it is covered, or the suggested sale is made when the clock
 * runs out. When even Selling everything is not enough the payer is bankrupt at once. A seat
 * whose person left is played by `bot`, which makes the safe choice too.
 */
import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type GameEvent,
  type Rng,
  type StartContext,
} from '@xomdao/sdk';
import { z } from 'zod';
import { AIRPORT_TILE, BOARD, isLot, JAIL_TILE } from './board.js';
import { everything, saleProblem, sell, suggestSale } from './debt.js';
import { landPrice, levelCost, rent, takeoverPrice, taxOf } from './economy.js';
import {
  CLOCK_MS,
  DOUBLES_TO_JAIL,
  HOTEL,
  JAIL_TRIES,
  type Options,
  type Player,
  type State,
} from './model.js';
import { TUNING, type Tuning } from './tuning.js';

type Ctx = GameContext<State, Options>;
type Move<P = Record<string, never>> = EventContext<State, P, Options>;

const tile = z
  .number()
  .int()
  .min(0)
  .max(BOARD.length - 1);
const fly = z.object({ to: tile });
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

export class CoTyPhuGame extends Game<State, Options> {
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
    const free = {
      ...me,
      cash: me.cash - this.t.jailFine,
      jailed: false,
      jailTries: 0,
    };
    return this.settle(ctx, withPlayer(ctx.state, ctx.player.seat, free));
  }

  onUseCard(ctx: Move): State {
    const me = this.checkJailed(ctx);
    if (me.jailCards < 1) ctx.reject('Bạn không có vé ra tù');
    const free = {
      ...me,
      jailCards: me.jailCards - 1,
      jailed: false,
      jailTries: 0,
    };
    return this.settle(ctx, withPlayer(ctx.state, ctx.player.seat, free));
  }

  onBuy(ctx: Move): State {
    const me = this.check(ctx, 'buy');
    const price = landPrice(this.t, me.tile);
    if (me.cash < price) ctx.reject('Không đủ tiền');
    const level = BOARD[me.tile]?.kind === 'city' ? 1 : 0;
    const state = withPlayer(ctx.state, ctx.player.seat, {
      ...me,
      cash: me.cash - price,
    });
    return this.settle(
      ctx,
      this.next(withLot(state, me.tile, { owner: ctx.player.seat, level, built: 0 })),
    );
  }

  onUpgrade(ctx: Move): State {
    const me = this.check(ctx, 'upgrade');
    const cost = levelCost(this.t, me.tile);
    const lot = ctx.state.lots[me.tile];
    if (!lot) ctx.reject('Chưa thể làm việc này lúc này');
    if (me.cash < cost) ctx.reject('Không đủ tiền');
    const state = withPlayer(ctx.state, ctx.player.seat, {
      ...me,
      cash: me.cash - cost,
    });
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
    return this.settle(ctx, this.next(ctx.state));
  }

  onSell(ctx: Move<z.infer<typeof sale>>): State {
    const { debt } = ctx.state;
    if (ctx.state.phase !== 'debt' || !debt) ctx.reject('Chưa thể làm việc này lúc này');
    if (debt.from !== ctx.player.seat) ctx.reject('Bạn không có nợ');
    const problem = saleProblem(ctx.state, debt.from, ctx.payload.sale);
    if (problem) ctx.reject(problem);
    const sold = sell(this.t, ctx.state, debt.from, ctx.payload.sale);
    if ((sold.players[debt.from] as Player).cash < debt.amount) ctx.reject('Bán chưa đủ để trả nợ');
    return this.settle(ctx, this.next(this.charge(sold, debt.from, debt.to, debt.amount)));
  }

  /** The clock ran out: the safe choice. */
  onTimeout(ctx: Ctx): State {
    const { state } = ctx;
    if (state.phase === 'roll') return this.settle(ctx, this.roll(ctx, state));
    if (state.phase === 'debt' && state.debt) return this.settle(ctx, this.sellSuggested(state));
    return this.settle(ctx, this.next(state));
  }

  /** The safe choice for a computer seat (#349 makes it play): roll, pass, or the suggested sale. */
  bot(ctx: BotContext<State, Options>): GameEvent | null {
    const { state, player } = ctx;
    if (state.phase === 'debt')
      return state.debt?.from === player.seat
        ? { event: 'sell', payload: { sale: state.debt.suggested } }
        : null;
    if (state.turn !== player.seat) return null;
    return { event: state.phase === 'roll' ? 'roll' : 'pass' };
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
    ctx.setTimer(CLOCK_MS[ctx.options.speed], 'timeout');
    return state;
  }

  private roll(ctx: Ctx, state: State): State {
    const seat = state.turn;
    const me = state.players[seat] as Player;
    const dice = this.dice(ctx.rng, state.rolls);
    const double = dice[0] === dice[1];
    const steps = dice[0] + dice[1];
    const rolled = { ...state, dice, rolls: state.rolls + 1 };
    if (me.jailed) {
      const tries = me.jailTries + 1;
      if (!double && tries < JAIL_TRIES) {
        return this.endTurn(withPlayer(rolled, seat, { ...me, jailTries: tries }));
      }
      const free = withPlayer(rolled, seat, {
        ...me,
        jailed: false,
        jailTries: 0,
      });
      return this.move({ ...free, again: false }, seat, steps);
    }
    const doubles = state.doubles + (double ? 1 : 0);
    if (doubles >= DOUBLES_TO_JAIL) return this.endTurn(toJail({ ...rolled, doubles }, seat));
    return this.move({ ...rolled, doubles, again: double }, seat, steps);
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
      const sum = (state.dice?.[0] ?? 0) + (state.dice?.[1] ?? 0);
      const due = owner.jailed ? 0 : rent(this.t, state, me.tile, sum);
      const paid = this.charge(state, seat, lot.owner, due);
      if (paid.phase === 'debt') return paid;
      const after = paid.players[seat] as Player;
      const price = takeoverPrice(this.t, paid, me.tile);
      if (!after.bankrupt && price !== null && after.cash >= price)
        return { ...paid, phase: 'takeover' };
      return this.next(paid);
    }
    if (tile?.kind === 'tax') {
      const paid = this.charge(state, seat, null, taxOf(this.t, tile.tax, me.cash));
      return paid.phase === 'debt' ? paid : this.next(paid);
    }
    if (tile?.kind === 'go-jail') return this.endTurn(toJail(state, seat));
    if (tile?.kind === 'airport' && me.cash >= this.t.airportFee) return { ...state, phase: 'fly' };
    return this.next(state);
  }

  /** The upgrade offer of a City `seat` owns and stands on, or `undefined` when there is none. */
  private offerUpgrade(state: State, seat: number): State | undefined {
    const me = state.players[seat] as Player;
    const lot = state.lots[me.tile];
    if (BOARD[me.tile]?.kind !== 'city' || !lot || lot.level >= HOTEL) return undefined;
    return me.cash >= levelCost(this.t, me.tile) ? { ...state, phase: 'upgrade' } : undefined;
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
    return bankrupt(sell(this.t, state, from, everything(state, from)), from, to, amount);
  }

  private sellSuggested(state: State): State {
    const debt = state.debt as NonNullable<State['debt']>;
    return this.next(
      this.charge(sell(this.t, state, debt.from, debt.suggested), debt.from, debt.to, debt.amount),
    );
  }

  /** The offer is settled: a double rolls again, else the next seat's turn. */
  private next(state: State): State {
    const me = state.players[state.turn] as Player;
    if (state.again && !me.bankrupt && !me.jailed) return { ...state, phase: 'roll', again: false };
    return this.endTurn(state);
  }

  private endTurn(state: State): State {
    const n = state.players.length;
    let turn = state.turn;
    for (let k = 1; k <= n; k++) {
      turn = (state.turn + k) % n;
      if (!state.players[turn]?.bankrupt) break;
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
 * back to the bank and their jail-free Cards are lost.
 */
function bankrupt(state: State, from: number, to: number | null, amount: number): State {
  const payer = state.players[from] as Player;
  const paid = transfer(state, from, to, Math.min(amount, Math.max(0, payer.cash)));
  return {
    ...withPlayer(paid, from, {
      ...payer,
      cash: 0,
      bankrupt: true,
      jailed: false,
      jailCards: 0,
    }),
    lots: paid.lots.map((l) => (l?.owner === from ? null : l)),
    bankrupt: [...paid.bankrupt, from],
  };
}
