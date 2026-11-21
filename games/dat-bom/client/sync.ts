/**
 * Turns the server's snapshots (10 a second) into a picture for every frame: the clock that says
 * which server tick is on screen, and interpolation between two snapshots. Pure, no DOM.
 */
import {
  BLAST_TICKS,
  type Blast,
  type Bomb,
  type Player,
  SNAPSHOT_RATE,
  type State,
  TICK_RATE,
} from '../server/game/model.js';

export const TICK_MS = 1000 / TICK_RATE;
/** How far behind the server other players are drawn: one snapshot gap plus room for jitter. */
export const INTERP_DELAY_MS = 1000 / SNAPSHOT_RATE + 50;
/** A player further than this many cells from where they were is not walking but placed anew. */
const TELEPORT = 2;
/** Arrival offsets kept to find the fastest the network has been lately. */
const CLOCK_SAMPLES = 40;

/** One snapshot: the server tick it is from and the whole Match state then. */
export interface Snapshot {
  tick: number;
  state: State;
}

/** The two snapshots the picture lies between, and how far along (0–1) it is. */
export interface Frame {
  /** The server tick on screen, fractional. */
  tick: number;
  from: Snapshot;
  to: Snapshot;
  alpha: number;
}

/**
 * Snapshots in the order they came, with an estimate of the server's clock. The estimate trusts
 * the snapshot that arrived fastest of the last few seconds, so a late packet does not push the
 * picture back.
 */
export class Timeline {
  private snaps: Snapshot[] = [];
  private offsets: number[] = [];

  get latest(): Snapshot | null {
    return this.snaps[this.snaps.length - 1] ?? null;
  }

  clear() {
    this.snaps = [];
    this.offsets = [];
  }

  /** Adds a snapshot that arrived at local time `now` (ms); one not newer than the last is ignored. */
  push(tick: number, state: State, now: number) {
    const last = this.latest;
    if (last && tick <= last.tick) return;
    this.snaps.push({ tick, state });
    this.offsets.push(now - tick * TICK_MS);
    if (this.offsets.length > CLOCK_SAMPLES) this.offsets.shift();
    if (this.snaps.length > 12) this.snaps.shift();
  }

  /** The server tick it is at local time `now`, fractional; `null` before the first snapshot. */
  serverTick(now: number): number | null {
    if (!this.offsets.length) return null;
    return (now - Math.min(...this.offsets)) / TICK_MS;
  }

  /** What to draw at local time `now`, `delayMs` behind the server; `null` before the first snapshot. */
  frame(now: number, delayMs = INTERP_DELAY_MS): Frame | null {
    const serverTick = this.serverTick(now);
    const first = this.snaps[0];
    if (serverTick === null || !first) return null;
    const tick = serverTick - delayMs / TICK_MS;
    let from = first;
    let to = first;
    for (const snap of this.snaps) {
      if (snap.tick <= tick) from = snap;
      else {
        to = snap;
        break;
      }
    }
    if (to.tick <= from.tick) return { tick, from, to: from, alpha: 0 };
    return {
      tick,
      from,
      to,
      alpha: Math.min(1, Math.max(0, (tick - from.tick) / (to.tick - from.tick))),
    };
  }
}

/** A player as drawn: their place between two snapshots and the rest from the nearer one. */
export interface DrawnPlayer extends Player {
  /** Whether the player is holding a direction. */
  walking: boolean;
}

/** A bomb as drawn, with its fuse counted down to the tick on screen (ticks, may be below 0). */
export type DrawnBomb = Bomb;

/** An explosion as drawn, with the tick it began at. */
export interface DrawnBlast extends Blast {
  /** The server tick it began at: with its first cell, a key that stays the same while it burns. */
  began: number;
}

/** The picture of one frame. */
export interface Picture {
  tick: number;
  rows: string[];
  players: DrawnPlayer[];
  bombs: DrawnBomb[];
  blasts: DrawnBlast[];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The picture at a frame: positions interpolated, everything else as the nearer snapshot says. */
export function picture(frame: Frame): Picture {
  const { from, to, alpha, tick } = frame;
  const near = alpha < 0.5 ? from : to;
  const players = near.state.players.map((p, seat): DrawnPlayer => {
    const a = from.state.players[seat] ?? p;
    const b = to.state.players[seat] ?? p;
    const far = Math.hypot(b.x - a.x, b.y - a.y) > TELEPORT;
    const t = far ? Math.round(alpha) : alpha;
    const x = lerp(a.x, b.x, t);
    const y = lerp(a.y, b.y, t);
    return { ...p, x, y, walking: p.move !== 'none' };
  });
  const age = tick - near.tick;
  return {
    tick,
    rows: near.state.rows,
    players,
    bombs: near.state.bombs.map((b) => ({ ...b, fuse: b.fuse - age })),
    blasts: near.state.blasts.map((b) => ({
      ...b,
      left: b.left - age,
      began: near.tick - (BLAST_TICKS - b.left),
    })),
  };
}
