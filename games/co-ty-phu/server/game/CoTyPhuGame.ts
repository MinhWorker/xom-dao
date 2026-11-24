/**
 * Cờ Tỷ Phú on the server. The turn player sends `roll`, then takes (`buy`, `upgrade`,
 * `takeover`, `fly`) or `pass`es what their Tile offers; in jail they may `pay-bail` or
 * `use-card` before rolling. Every decision runs the clock of the Room's "Tốc độ"; when it runs
 * out the safe choice is made (`timeout`): roll, or pass the offer.
 *
 * Bankruptcy is for now a player whose cash goes below zero: their Lots go back to the bank.
 */
import {
  type EventContext,
  Game,
  type GameContext,
  type Rng,
  type StartContext,
} from '@xomdao/sdk';
import { z } from 'zod';
import { AIRPORT_TILE, BOARD, isLot, JAIL_TILE } from './board.js';
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

const fly = z.object({
  to: z
    .number()
    .int()
    .min(0)
    .max(BOARD.length - 1),
});

export interface CoTyPhuSetup {
  tuning?: Tuning;
  /** Rolls two dice for the Match's `roll`-th roll (from 0); tests and the simulator script them. */
  dice?: (rng: Rng, roll: number) => [number, number];
  /** Changes the first state (tests and the simulator set up a board with it). */
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
    });
    ctx.setTimer(CLOCK_MS[ctx.options.speed], 'timeout');
    return state;
  }

  onRoll(ctx: Move): State {
    this.check(ctx, 'roll');
    return this.settle(ctx, this.roll(ctx, ctx.state));
  }

  onPayBail(ctx: Move): State {
    const me = this.check(ctx, 'roll');
    if (!me.jailed) ctx.reject('Bạn không ở tù');
    if (me.jailTries >= JAIL_TRIES - 1) ctx.reject('Lần này phải gieo');
    if (me.cash < this.t.jailFine) ctx.reject('Không đủ tiền');
    const free = { ...me, cash: me.cash - this.t.jailFine, jailed: false, jailTries: 0 };
    return this.settle(ctx, withPlayer(ctx.state, ctx.player.seat, free));
  }

  onUseCard(ctx: Move): State {
    const me = this.check(ctx, 'roll');
    if (!me.jailed) ctx.reject('Bạn không ở tù');
    if (me.jailTries >= JAIL_TRIES - 1) ctx.reject('Lần này phải gieo');
    if (me.jailCards < 1) ctx.reject('Bạn không có vé ra tù');
    const free = { ...me, jailCards: me.jailCards - 1, jailed: false, jailTries: 0 };
    return this.settle(ctx, withPlayer(ctx.state, ctx.player.seat, free));
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
    const cost = levelCost(this.t, me.tile);
    const lot = ctx.state.lots[me.tile];
    if (!lot || me.cash < cost) ctx.reject('Không đủ tiền');
    const state = withPlayer(ctx.state, ctx.player.seat, { ...me, cash: me.cash - cost });
    const built = { ...lot, level: lot.level + 1, built: lot.built + cost };
    return this.settle(ctx, this.next(withLot(state, me.tile, built)));
  }

  onTakeover(ctx: Move): State {
    const me = this.check(ctx, 'takeover');
    const price = takeoverPrice(this.t, ctx.state, me.tile);
    const lot = ctx.state.lots[me.tile];
    if (!lot || price === null || me.cash < price) ctx.reject('Không đủ tiền');
    let state = pay(ctx.state, ctx.player.seat, lot.owner, price);
    state = withLot(state, me.tile, { ...lot, owner: ctx.player.seat });
    return this.settle(ctx, this.offerUpgrade(state, ctx.player.seat) ?? this.next(state));
  }

  onFly(ctx: Move<z.infer<typeof fly>>): State {
    const me = this.check(ctx, 'fly');
    if (ctx.payload.to === AIRPORT_TILE) ctx.reject('Bạn đang ở Sân bay');
    if (me.cash < this.t.airportFee) ctx.reject('Không đủ tiền');
    const seat = ctx.player.seat;
    let state = pay(ctx.state, seat, null, this.t.airportFee);
    const to = ctx.payload.to;
    const bonus = to === 0 ? this.t.startBonus : 0;
    state = withPlayer(state, seat, { ...me, cash: me.cash - this.t.airportFee + bonus, tile: to });
    return this.settle(ctx, this.land(state, seat));
  }

  onPass(ctx: Move): State {
    if (ctx.state.turn !== ctx.player.seat) ctx.reject('Chưa tới lượt bạn');
    if (ctx.state.phase === 'roll') ctx.reject('Hãy gieo xúc xắc');
    return this.settle(ctx, this.next(ctx.state));
  }

  /** The clock ran out: the safe choice. */
  onTimeout(ctx: Ctx): State {
    const state = ctx.state.phase === 'roll' ? this.roll(ctx, ctx.state) : this.next(ctx.state);
    return this.settle(ctx, state);
  }

  /** Refuses a move out of turn or out of `phase`; the turn player otherwise. */
  private check(ctx: Move<unknown>, phase: State['phase']): Player {
    if (ctx.state.turn !== ctx.player.seat) ctx.reject('Chưa tới lượt bạn');
    if (ctx.state.phase !== phase) ctx.reject('Chưa thể làm việc này lúc này');
    return ctx.state.players[ctx.player.seat] as Player;
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
      const free = withPlayer(rolled, seat, { ...me, jailed: false, jailTries: 0 });
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
      const paid = pay(state, seat, lot.owner, due);
      const after = paid.players[seat] as Player;
      const price = takeoverPrice(this.t, paid, me.tile);
      if (!after.bankrupt && price !== null && after.cash >= price)
        return { ...paid, phase: 'takeover' };
      return this.next(paid);
    }
    if (tile?.kind === 'tax')
      return this.next(pay(state, seat, null, taxOf(this.t, tile.tax, me.cash)));
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
    return { ...state, turn, phase: 'roll', doubles: 0, again: false };
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

/**
 * `from` pays `amount` to `to` (`null` = the bank). The creditor gets at most what the payer
 * had; a payer left below zero is bankrupt and their Lots go back to the bank.
 */
function pay(state: State, from: number, to: number | null, amount: number): State {
  const payer = state.players[from] as Player;
  const received = Math.min(amount, Math.max(0, payer.cash));
  const cash = payer.cash - amount;
  let next = withPlayer(state, from, { ...payer, cash });
  if (to !== null) {
    const creditor = next.players[to] as Player;
    next = withPlayer(next, to, { ...creditor, cash: creditor.cash + received });
  }
  if (cash >= 0) return next;
  return {
    ...withPlayer(next, from, { ...payer, cash: 0, bankrupt: true, jailed: false }),
    lots: next.lots.map((l) => (l?.owner === from ? null : l)),
    bankrupt: [...next.bankrupt, from],
  };
}
