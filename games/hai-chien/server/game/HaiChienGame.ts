import {
  type BotContext,
  type EventContext,
  Game,
  type GameContext,
  type LeaveContext,
  type PlayerId,
  type Seat,
  type StartContext,
} from '@xomdao/sdk';
import { z } from 'zod';
import { botFleet, botMove } from './bot.js';
import {
  allSunk,
  cellsOf,
  emptySea,
  index,
  isSunk,
  layoutProblem,
  scanArea,
  shipAt,
  shoot,
} from './fleet.js';
import {
  Clear,
  FLEET,
  type Options,
  type Placement,
  type Point,
  RADAR_SCANS,
  type Sea,
  SIZE,
  type State,
  Unknown,
  type View,
} from './model.js';

const coord = z
  .int()
  .min(0)
  .max(SIZE - 1);
const point = z.object({ x: coord, y: coord });
const placement = z.object({ x: coord, y: coord, v: z.boolean() });

/** The other seat's id. */
export const otherOf = (state: Pick<State, 'players'>, id: PlayerId) =>
  state.players[0] === id ? state.players[1] : state.players[0];

/**
 * Ends the Match won by `winner`. Each seat's score is the Matches it won in the series, which
 * the next Match reads back from `ctx.lastResult`.
 */
function won(ctx: GameContext<State, Options>, winner: PlayerId) {
  const wins = { ...ctx.state.wins, [winner]: (ctx.state.wins[winner] ?? 0) + 1 };
  ctx.finish(
    ctx.players.map((seat) => (seat.id === winner ? 1 : 2)),
    { scores: ctx.players.map((seat) => wins[seat.id] ?? 0) },
  );
  return wins;
}

export class HaiChienGame extends Game<State, Options, View> {
  readonly events = {
    fleet: z.object({ ships: z.array(placement).length(FLEET.length) }),
    unready: z.object({}),
    fire: point,
    scan: point,
  };

  /** Both seas start empty; the loser of the last Match fires first, else a coin decides. */
  onStart({ players, options, lastResult, rng }: StartContext<Options>): State {
    const ids = players.map((p) => p.id) as [PlayerId, PlayerId];
    const loser = lastResult?.seats.find((s) => s.place > 1)?.player;
    const first = loser && ids.includes(loser) ? loser : (ids[rng() < 0.5 ? 0 : 1] as PlayerId);
    const radar = options.radar ? RADAR_SCANS : 0;
    return {
      phase: 'setup',
      players: ids,
      seas: Object.fromEntries(ids.map((id) => [id, emptySea(radar)])),
      turn: first,
      shots: 0,
      last: null,
      winner: null,
      wins: Object.fromEntries(
        ids.map((id) => [id, lastResult?.seats.find((s) => s.player === id)?.score ?? 0]),
      ),
    };
  }

  /** Places the player's fleet and marks them ready; once both are, the battle begins. */
  onFleet(ctx: EventContext<State, { ships: Placement[] }, Options>): State {
    const { state, player, payload, reject } = ctx;
    if (state.phase !== 'setup') reject('Trận đánh đã bắt đầu');
    const problem = layoutProblem(payload.ships);
    if (problem) reject(problem);
    const seas = {
      ...state.seas,
      [player.id]: { ...(state.seas[player.id] as Sea), ships: payload.ships, ready: true },
    };
    const both = state.players.every((id) => seas[id]?.ready);
    return { ...state, seas, phase: both ? 'battle' : 'setup' };
  }

  /** Takes the fleet back to move it again, while the other player is still placing theirs. */
  onUnready({ state, player, reject }: EventContext<State, Record<string, never>, Options>): State {
    if (state.phase !== 'setup') reject('Trận đánh đã bắt đầu');
    const sea = state.seas[player.id] as Sea;
    return { ...state, seas: { ...state.seas, [player.id]: { ...sea, ready: false } } };
  }

  /**
   * Fires at a cell of the other player's sea. A hit lets the shooter fire again when the Room
   * says so; sinking the last ship wins.
   */
  onFire(ctx: EventContext<State, Point, Options>): State {
    const { state, player, payload, reject, options } = ctx;
    const target = this.targetOf(ctx);
    const mark = target.sea.marks[index(payload)];
    if (mark === Clear) reject('Ô này chắc chắn không có tàu');
    if (mark !== Unknown) reject('Ô này đã bắn rồi');

    const shot = shoot(target.sea, payload);
    const sea = { ...target.sea, marks: shot.marks };
    if (shot.result === 'sunk') ctx.stat(player.id, 'sunk');
    let next: State = {
      ...state,
      seas: { ...state.seas, [target.id]: sea },
      shots: state.shots + 1,
      last: {
        kind: 'shot',
        by: player.id,
        x: payload.x,
        y: payload.y,
        result: shot.result,
        ...(shot.ship >= 0 && { ship: shot.ship }),
      },
      turn: shot.result === 'miss' || !options.chain ? target.id : player.id,
    };
    if (allSunk(sea)) {
      next = { ...next, phase: 'over', winner: player.id, wins: won(ctx, player.id) };
    }
    return next;
  }

  /**
   * Scans a 3×3 area of the other player's sea for the number of ship cells in it, using the
   * turn. An area with none is marked clear.
   */
  onScan(ctx: EventContext<State, Point, Options>): State {
    const { state, player, payload, reject } = ctx;
    const target = this.targetOf(ctx);
    const own = state.seas[player.id] as Sea;
    if (own.radar <= 0) reject('Bạn đã dùng hết ra-đa');
    const area = scanArea(payload);
    const count = area.filter((c) => shipAt(target.sea.ships, c) >= 0).length;
    const marks = [...target.sea.marks];
    if (count === 0) for (const c of area) if (marks[index(c)] === Unknown) marks[index(c)] = Clear;
    const scans = [...target.sea.scans, { x: payload.x, y: payload.y, count }];
    return {
      ...state,
      seas: {
        ...state.seas,
        [player.id]: { ...own, radar: own.radar - 1 },
        [target.id]: { ...target.sea, marks, scans },
      },
      last: { kind: 'scan', by: player.id, x: payload.x, y: payload.y, count },
      turn: target.id,
    };
  }

  /** A player left mid-Match: it stops there and the one who stays wins. */
  onLeave(ctx: LeaveContext<State, Options>): State {
    const stays = otherOf(ctx.state, ctx.player.id);
    return { ...ctx.state, phase: 'over', winner: stays, wins: won(ctx, stays) };
  }

  /** Each seat sees its own fleet; the other's ships only once sunk, or all once it is over. */
  view({ state }: GameContext<State, Options>, viewer: Seat | null): View {
    const seas: View['seas'] = {};
    for (const id of state.players) {
      const sea = state.seas[id];
      if (!sea) continue;
      const sunk = FLEET.map((_, ship) => isSunk(sea, ship));
      const shown = (ship: number) => id === viewer?.id || state.phase === 'over' || !!sunk[ship];
      seas[id] = {
        ...sea,
        ships: sea.ships.map((at, ship) => (shown(ship) ? at : null)),
        sunk,
      };
    }
    return { ...state, seas };
  }

  /** The computer places its fleet at once, then fires at the Room's level (see bot.ts). */
  bot({ state, player, rng, options }: BotContext<State, Options>) {
    const sea = state.seas[player.id];
    if (state.phase === 'setup') {
      return sea?.ready
        ? null
        : { event: 'fleet', payload: { ships: botFleet(rng, options.level) } };
    }
    if (state.phase !== 'battle' || state.turn !== player.id || !sea) return null;
    const enemy = state.seas[otherOf(state, player.id)];
    if (!enemy) return null;
    const move = botMove(this.knowledge(enemy), sea.radar, rng, options.level, state.shots);
    return { event: move.scan ? 'scan' : 'fire', payload: { x: move.x, y: move.y } };
  }

  /** Long enough for the clients to show the last shot land before the next one flies. */
  botDelay({ state, rng }: BotContext<State, Options>) {
    if (state.phase === 'setup') return 900 + Math.floor(rng() * 900);
    const last = state.last;
    const after = !last ? 1500 : last.kind === 'scan' ? 2400 : last.result === 'sunk' ? 3100 : 2100;
    return after + Math.floor(rng() * 400);
  }

  /** What the shooter may know of a sea: marks, scans and the cells of its sunk ships. */
  private knowledge(sea: Sea) {
    const sunkCells = new Set<number>();
    const sunkSizes: number[] = [];
    for (const [id, at] of sea.ships.entries()) {
      if (!isSunk(sea, id)) continue;
      sunkSizes.push(cellsOf(id, at).length);
      for (const c of cellsOf(id, at)) sunkCells.add(index(c));
    }
    const left: number[] = FLEET.map((ship) => ship.size);
    for (const size of sunkSizes) left.splice(left.indexOf(size), 1);
    return { marks: sea.marks, scans: sea.scans, sunkCells, left };
  }

  private targetOf({ state, player, reject }: EventContext<State, Point, Options>) {
    if (state.phase === 'setup') reject('Hai bên chưa xếp xong hạm đội');
    if (state.phase !== 'battle') reject('Ván đã kết thúc');
    if (state.turn !== player.id) reject('Chưa tới lượt bạn');
    const id = otherOf(state, player.id);
    const sea = state.seas[id];
    if (!sea) reject('Không có biển để bắn');
    return { id, sea: sea as Sea };
  }
}
