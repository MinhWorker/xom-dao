/**
 * Client-side prediction for the player's own character: it answers a key press at once instead
 * of one round trip later. The server's rules (`walk`) are replayed on its newest snapshot with
 * the inputs it has not acknowledged yet; when a snapshot changes the answer, the difference
 * fades out instead of popping. Pure, no DOM.
 */
import { walk } from '../server/game/arena.js';
import {
  type Cell,
  COUNTDOWN_TICKS,
  type Dir,
  FUSE_TICKS,
  type Input,
  MAX_BOMBS,
  type Player,
  type State,
} from '../server/game/model.js';
import { TICK_MS } from './sync.js';

/** Where the character is drawn, in cells. */
export interface Position {
  x: number;
  y: number;
}

interface Pending {
  seq: number;
  move: Dir;
  /** Local time (ms) the key was pressed. */
  at: number;
}

/** A bomb placed here before the server's snapshot shows it. */
export interface Ghost {
  seq: number;
  cell: Cell;
  at: number;
}

/** Most ticks ahead of the newest snapshot the character is predicted; older is a stalled link. */
const MAX_AHEAD = 20;
/** Seconds in which a correction fades to a third. */
const FADE = 0.12;
/** A correction larger than this many cells is a jump, not a drift. */
const JUMP = 1.5;
/** Milliseconds a ghost bomb waits for the server before it is given up. */
const GHOST_MS = 1200;

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

export class Predictor {
  private seq = 0;
  private log: Pending[] = [];
  private ghostBombs: Ghost[] = [];
  private newest: { state: State; tick: number; arrival: number; ack: number } | null = null;
  private fix = { x: 0, y: 0 };
  /** Milliseconds a message takes from here to the server, one way. */
  private oneWay = 40;

  constructor(public seat: number) {}

  /** Notes how long a send took to be acknowledged (ms), which tells how far ahead to predict. */
  noteRoundTrip(ms: number) {
    const clamped = Math.min(500, Math.max(0, ms));
    this.oneWay = this.oneWay * 0.7 + (clamped / 2) * 0.3;
  }

  /** Records a key press and returns what to send. A bomb leaves a ghost where the player is. */
  press(move: Dir, bomb: boolean, now: number): { seq: number; input: Input } {
    const seq = this.seq++;
    this.log.push({ seq, move, at: now });
    const cell = bomb ? this.cellNow(now) : null;
    if (cell && this.canPlace(cell)) this.ghostBombs.push({ seq, cell, at: now });
    return { seq, input: { move, ...(bomb && { bomb: true }) } };
  }

  /** Whether a bomb at `cell` would be allowed by what the player has on the arena. */
  private canPlace(cell: Cell) {
    const bombs = this.newest?.state.bombs ?? [];
    const mine = bombs.filter((b) => b.owner === this.seat).length + this.ghostBombs.length;
    return (
      mine < MAX_BOMBS &&
      !bombs.some((b) => sameCell(b, cell)) &&
      !this.ghostBombs.some((g) => sameCell(g.cell, cell))
    );
  }

  /** A new snapshot: the answer may change, and what it changed by fades out. */
  receive(state: State, tick: number, ack: number | undefined, now: number) {
    const before = this.at(now);
    this.newest = { state, tick, arrival: now, ack: ack ?? -1 };
    if (ack !== undefined) {
      this.log = this.log.filter((p) => p.seq > ack);
      // After a reload the server still counts our old inputs: carry on above them.
      this.seq = Math.max(this.seq, ack + 1);
    }
    const after = this.at(now);
    if (!before || !after) return;
    this.fix.x += before.x - after.x;
    this.fix.y += before.y - after.y;
    if (Math.hypot(this.fix.x, this.fix.y) > JUMP) this.fix = { x: 0, y: 0 };
  }

  /** Forgets the Match but keeps the numbering of inputs, which the server counts per player. */
  reset() {
    this.log = [];
    this.ghostBombs = [];
    this.newest = null;
    this.fix = { x: 0, y: 0 };
  }

  /** Where the character is drawn at local time `now`; `dt` (s) fades the correction. */
  position(now: number, dt: number): Position | null {
    const raw = this.at(now);
    if (!raw) return null;
    const fade = Math.exp(-dt / FADE);
    this.fix.x *= fade;
    this.fix.y *= fade;
    return { x: raw.x + this.fix.x, y: raw.y + this.fix.y };
  }

  /** The cell the character stands in. */
  cellNow(now: number): Cell | null {
    const at = this.at(now);
    return at && { x: Math.floor(at.x), y: Math.floor(at.y) };
  }

  /**
   * Bombs the player placed that the picture does not show yet, as `{ cell, fuse }`. A ghost goes
   * once the picture has the bomb, once a snapshot that took the press in shows none (the server
   * refused it) or after a while.
   */
  ghosts(now: number, shown: readonly Cell[]): { cell: Cell; fuse: number }[] {
    const newest = this.newest;
    this.ghostBombs = this.ghostBombs.filter((g) => {
      if (now - g.at > GHOST_MS) return false;
      if (shown.some((c) => sameCell(c, g.cell))) return false;
      if (newest && newest.ack >= g.seq) {
        return newest.state.bombs.some((b) => sameCell(b, g.cell));
      }
      return true;
    });
    return this.ghostBombs.map((g) => ({
      cell: g.cell,
      fuse: FUSE_TICKS - (now - g.at) / TICK_MS,
    }));
  }

  /** The prediction at local time `now`, without the correction. */
  private at(now: number): Position | null {
    const newest = this.newest;
    const me = newest?.state.players[this.seat];
    if (!newest || !me) return null;
    if (me.out !== null) return { x: me.x, y: me.y };

    // The snapshot happened one network trip before it arrived; the player's inputs, in the
    // server's time, happen when they are pressed.
    const origin = newest.arrival - this.oneWay;
    const elapsed = Math.min(MAX_AHEAD, Math.max(0, (now - origin) / TICK_MS));
    const whole = Math.floor(elapsed);
    const p: Player = { ...me };
    const pending = this.log.map((i) => ({
      ...i,
      tick: Math.max(0, Math.floor((i.at - origin) / TICK_MS)),
    }));
    let next = 0;
    /** Step `k`: the inputs that arrive before it, then the player takes it. */
    const step = (k: number, player: Player) => {
      const serverTick = newest.tick + k - 1;
      while (next < pending.length && (pending[next]?.tick ?? 0) <= k - 1) {
        if (serverTick >= COUNTDOWN_TICKS) player.move = (pending[next] as Pending).move;
        next++;
      }
      if (serverTick >= COUNTDOWN_TICKS) walk(newest.state, player);
    };
    for (let k = 1; k <= whole; k++) step(k, p);
    const frac = elapsed - whole;
    if (frac < 1e-6) return { x: p.x, y: p.y };
    const ahead: Player = { ...p };
    const saved = next;
    step(whole + 1, ahead);
    next = saved;
    return { x: p.x + (ahead.x - p.x) * frac, y: p.y + (ahead.y - p.y) * frac };
  }
}
