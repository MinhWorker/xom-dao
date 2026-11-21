/** The arena's physics: building it, walking, bombs, explosions and who is ahead. Pure. */
import type { Rng } from '@xomdao/sdk';
import {
  BLAST_TICKS,
  BOMB_DAMAGE,
  type Bomb,
  type Cell,
  COLS,
  FUSE_TICKS,
  GUARD_TICKS,
  MAX_BOMBS,
  MAX_HP,
  type Player,
  RANGE,
  ROWS,
  STEP,
  type State,
  type Tile,
} from './model.js';

/** Where seats start: opposite corners first, so two players face each other. */
export const SPAWNS: readonly Cell[] = [
  { x: 0, y: 0 },
  { x: COLS - 1, y: ROWS - 1 },
  { x: COLS - 1, y: 0 },
  { x: 0, y: ROWS - 1 },
];

/** Chance a free cell holds a crate. */
const CRATE_CHANCE = 0.7;
const EPS = 1e-9;

const DELTAS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
] as const;

/** The first state: pillars on every odd column and row, crates elsewhere but near the corners. */
export function newArena(seats: number, rng: Rng): State {
  const rows: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    let row = '';
    for (let x = 0; x < COLS; x++) {
      if (x % 2 === 1 && y % 2 === 1) row += '#';
      else if (SPAWNS.some((s) => Math.abs(s.x - x) + Math.abs(s.y - y) <= 2)) row += '.';
      else row += rng() < CRATE_CHANCE ? 'c' : '.';
    }
    rows.push(row);
  }
  const players: Player[] = Array.from({ length: seats }, (_, seat) => {
    const spawn = SPAWNS[seat % SPAWNS.length] as Cell;
    return {
      seat,
      x: spawn.x + 0.5,
      y: spawn.y + 0.5,
      hp: MAX_HP,
      move: 'none',
      guard: 0,
      out: null,
    };
  });
  return { rows, players, bombs: [], blasts: [], nextBombId: 0 };
}

/** A copy a hook may change: the state it was given stays as it was. */
export function copyState(state: State): State {
  return {
    ...state,
    rows: [...state.rows],
    players: state.players.map((p) => ({ ...p })),
    bombs: state.bombs.map((b) => ({ ...b, free: [...b.free] })),
    blasts: state.blasts.map((b) => ({ ...b })),
  };
}

/** The tile at a cell; outside the arena counts as a pillar. */
export function tileAt(rows: readonly string[], x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return '#';
  return (rows[y]?.[x] ?? '#') as Tile;
}

/** The cell a player stands in. */
export function cellOf(p: Pick<Player, 'x' | 'y'>): Cell {
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

/** Whether `seat` may not step into the cell: a pillar, a crate, the edge or a bomb it is not on. */
function blocked(state: State, seat: number, x: number, y: number) {
  if (tileAt(state.rows, x, y) !== '.') return true;
  return state.bombs.some((b) => b.x === x && b.y === y && !b.free.includes(seat));
}

/**
 * Walks a player one tick along the direction they hold. They travel on lanes through cell
 * centres: turning first slides them onto the new lane, and a pillar, crate or bomb stops them
 * in the middle of the cell before it. Mutates `p`.
 */
export function walk(state: State, p: Player) {
  if (p.move === 'none') return;
  const horizontal = p.move === 'left' || p.move === 'right';
  const sign = p.move === 'right' || p.move === 'down' ? 1 : -1;
  const size = horizontal ? COLS : ROWS;
  const across = horizontal ? 'y' : 'x';
  const along = horizontal ? 'x' : 'y';

  let budget = STEP;
  const offset = Math.floor(p[across]) + 0.5 - p[across];
  if (Math.abs(offset) > EPS) {
    const slide = Math.min(budget, Math.abs(offset));
    p[across] += Math.sign(offset) * slide;
    budget -= slide;
  }
  const lane = Math.floor(p[across]);

  // u grows in the direction of travel, so one loop serves both ways.
  let u = sign > 0 ? p[along] : size - p[along];
  while (budget > EPS) {
    const cell = Math.floor(u);
    const centre = cell + 0.5;
    let move: number;
    if (u < centre - EPS) move = Math.min(budget, centre - u);
    else {
      const next = sign > 0 ? cell + 1 : size - 1 - (cell + 1);
      if (horizontal ? blocked(state, p.seat, next, lane) : blocked(state, p.seat, lane, next))
        break;
      move = Math.min(budget, cell + 1.5 - u);
    }
    u += move;
    budget -= move;
  }
  p[along] = sign > 0 ? u : size - u;
}

/** Puts a bomb where the player stands, if they have one left and the cell has none. Mutates. */
export function placeBomb(state: State, p: Player) {
  const { x, y } = cellOf(p);
  if (state.bombs.filter((b) => b.owner === p.seat).length >= MAX_BOMBS) return;
  if (state.bombs.some((b) => b.x === x && b.y === y)) return;
  const free = state.players
    .filter((o) => o.out === null && cellOf(o).x === x && cellOf(o).y === y)
    .map((o) => o.seat);
  state.bombs.push({ id: state.nextBombId++, owner: p.seat, x, y, fuse: FUSE_TICKS, free });
}

/** The cells a bomb's explosion fills: its own and `RANGE` along each way, stopped by a pillar or crate. */
export function blastCells(rows: readonly string[], x: number, y: number): Cell[] {
  const cells: Cell[] = [{ x, y }];
  for (const { dx, dy } of DELTAS) {
    for (let i = 1; i <= RANGE; i++) {
      const cell = { x: x + dx * i, y: y + dy * i };
      const tile = tileAt(rows, cell.x, cell.y);
      if (tile === '#') break;
      cells.push(cell);
      if (tile === 'c') break;
    }
  }
  return cells;
}

/**
 * When each bomb explodes, in ticks from now: its own fuse, or sooner when another bomb's
 * explosion reaches it first (the chain reaction). Same order as `bombs`.
 */
export function explosionTimes(rows: readonly string[], bombs: readonly Bomb[]): number[] {
  const at = bombs.map((b) => b.fuse);
  const reach = bombs.map((b) => blastCells(rows, b.x, b.y));
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < bombs.length; i++) {
      for (let j = 0; j < bombs.length; j++) {
        const hit = reach[i]?.some((c) => c.x === bombs[j]?.x && c.y === bombs[j]?.y);
        if (hit && (at[i] as number) < (at[j] as number)) {
          at[j] = at[i] as number;
          changed = true;
        }
      }
    }
  }
  return at;
}

/**
 * Advances bombs and explosions by one tick and hurts whoever stands in an explosion. `tick` is
 * the tick count after this one: the time a player is knocked out at. Mutates `state`.
 */
export function burn(state: State, tick: number) {
  for (const bomb of state.bombs) {
    bomb.free = bomb.free.filter((seat) => {
      const p = state.players[seat];
      return p !== undefined && p.out === null && cellOf(p).x === bomb.x && cellOf(p).y === bomb.y;
    });
    bomb.fuse -= 1;
  }

  const times = explosionTimes(state.rows, state.bombs);
  const going = state.bombs.filter((_, i) => (times[i] as number) <= 0);
  if (going.length) {
    const crates: Cell[] = [];
    for (const bomb of going) {
      const cells = blastCells(state.rows, bomb.x, bomb.y);
      crates.push(...cells.filter((c) => tileAt(state.rows, c.x, c.y) === 'c'));
      state.blasts.push({ cells, left: BLAST_TICKS });
    }
    state.bombs = state.bombs.filter((b) => !going.includes(b));
    for (const { x, y } of crates) {
      const row = state.rows[y] as string;
      state.rows[y] = `${row.slice(0, x)}.${row.slice(x + 1)}`;
    }
  }

  for (const p of state.players) {
    if (p.out !== null) continue;
    const { x, y } = cellOf(p);
    const burning = state.blasts.some((b) => b.cells.some((c) => c.x === x && c.y === y));
    if (burning && p.guard === 0) {
      p.hp = Math.max(0, p.hp - BOMB_DAMAGE);
      p.guard = GUARD_TICKS;
      if (p.hp === 0) {
        p.out = tick;
        p.move = 'none';
      }
    } else if (p.guard > 0) p.guard -= 1;
  }
  for (const blast of state.blasts) blast.left -= 1;
  state.blasts = state.blasts.filter((b) => b.left > 0);
}

/**
 * Each player's place: who is standing beats who is out; standing players go by HP, the ones
 * out by who lasted longer. Equal players share a place.
 */
export function placesOf(players: readonly Player[]): number[] {
  const better = (a: Player, b: Player) => {
    if ((a.out === null) !== (b.out === null)) return a.out === null;
    if (a.out === null) return a.hp > b.hp;
    return a.out > (b.out as number);
  };
  return players.map((p) => 1 + players.filter((o) => better(o, p)).length);
}
