/** Draws the Go board on its canvas: a wooden board, slate and shell stones, marks for the count. */
import { count, pointName, starPoints } from '../server/game/board.js';
import {
  BLACK,
  type Cell,
  EMPTY,
  type Point,
  type State,
  type Stone,
  WHITE,
} from '../server/game/model.js';

const WOOD_LIT = '#e7bf7a';
const WOOD_MID = '#d7a75e';
const WOOD_DARK = '#b98a45';
const LINE = 'rgb(48 30 14 / 0.82)';
const LABEL = 'rgb(48 30 14 / 0.7)';

/** How long a stone takes to land, and captured ones to vanish. */
export const DROP_MS = 170;
const TAKE_MS = 380;
const RIPPLE_MS = 420;
/** The end: territory fills in, then the result shows. */
export const END_MS = 2200;

/** What the renderer needs besides the state. */
export interface Scene {
  state: State | null;
  /** The point the player chose but has not placed yet (two taps on a small grid). */
  ghost: Point | null;
  /** The point under the mouse. */
  hover: Point | null;
  /** The player's colour, `null` for a spectator. */
  mine: Stone | null;
  /** When each stone landed, by index. */
  placedAt: Map<number, number>;
  /** Stones taken off, with when and their colour. */
  taken: { i: number; stone: Stone; at: number }[];
  /** When the count or the end began. */
  overAt: number | null;
}

const ease = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;

export class BoardView {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private grain: CanvasPattern | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  resize(width: number, height: number) {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const side = Math.min(width, height);
    this.width = side;
    this.height = side;
    this.canvas.style.width = `${side}px`;
    this.canvas.style.height = `${side}px`;
    this.canvas.width = Math.round(side * ratio);
    this.canvas.height = Math.round(side * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.grain = null;
  }

  /** Grid spacing and where the first line lies. */
  private layout(size: number) {
    const pad = Math.max(18, this.width * 0.06);
    const step = (this.width - pad * 2) / size;
    return { step, origin: pad + step / 2, pad };
  }

  /** The point under a canvas position (CSS pixels), or `null`. */
  pointAt(size: number, px: number, py: number): Point | null {
    const { step, origin } = this.layout(size);
    const x = Math.round((px - origin) / step);
    const y = Math.round((py - origin) / step);
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    const dx = px - (origin + x * step);
    const dy = py - (origin + y * step);
    return Math.hypot(dx, dy) <= step * 0.62 ? { x, y } : null;
  }

  animating(scene: Scene, now: number) {
    for (const t of scene.placedAt.values()) if (now - t < RIPPLE_MS) return true;
    if (scene.taken.some((s) => now - s.at < TAKE_MS)) return true;
    return scene.overAt !== null && now - scene.overAt < END_MS;
  }

  draw(scene: Scene, now: number) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    const state = scene.state;
    if (!state) return;
    const { size } = state;
    const { step, origin, pad } = this.layout(size);
    const at = (i: number) => ({
      x: origin + (i % size) * step,
      y: origin + Math.floor(i / size) * step,
    });

    this.drawWood();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = Math.max(1, step * 0.035);
    ctx.beginPath();
    const last = origin + (size - 1) * step;
    for (let k = 0; k < size; k++) {
      const v = Math.round(origin + k * step) + 0.5;
      ctx.moveTo(origin, v);
      ctx.lineTo(last, v);
      ctx.moveTo(v, origin);
      ctx.lineTo(v, last);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, step * 0.06);
    ctx.strokeRect(origin, origin, last - origin, last - origin);
    ctx.fillStyle = LINE;
    for (const i of starPoints(size)) {
      const p = at(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, step * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    if (pad >= 18) {
      ctx.fillStyle = LABEL;
      ctx.font = `700 ${Math.round(Math.min(pad * 0.55, step * 0.5))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let k = 0; k < size; k++) {
        const name = pointName(size, { x: k, y: k });
        const letter = name[0] as string;
        const number = String(size - k);
        ctx.fillText(letter, origin + k * step, pad * 0.5);
        ctx.fillText(number, pad * 0.5, origin + k * step);
      }
    }

    const scoring = state.phase === 'score' || (state.phase === 'over' && state.ending === 'count');
    const dead = new Set(state.dead);
    const counted = scoring ? (state.count ?? count(state.board, size, dead)) : null;
    const owner = new Map<number, Cell>();
    if (counted) {
      const live = state.board.map((c, i) => (dead.has(i) ? EMPTY : c));
      for (const i of counted.territory) {
        const ns = neighbourColour(live, size, i);
        owner.set(i, ns);
      }
    }
    const radius = step * 0.48;
    for (let i = 0; i < state.board.length; i++) {
      const c = state.board[i] as Cell;
      if (c === EMPTY) continue;
      const placed = scene.placedAt.get(i);
      const age = placed === undefined ? Infinity : now - placed;
      const t = ease(age / DROP_MS);
      const p = at(i);
      drawStone(ctx, c as Stone, p.x, p.y, radius * (1 + 0.18 * (1 - t)), dead.has(i) ? 0.38 : t);
      if (age < RIPPLE_MS) {
        const k = ease(age / RIPPLE_MS);
        ctx.strokeStyle = `rgb(60 36 14 / ${0.35 * (1 - k)})`;
        ctx.lineWidth = Math.max(1, step * 0.05);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * (1 + 0.6 * k), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const s of scene.taken) {
      const age = now - s.at;
      if (age >= TAKE_MS) continue;
      const k = ease(age / TAKE_MS);
      const p = at(s.i);
      drawStone(ctx, s.stone, p.x, p.y - k * step * 0.25, radius * (1 - 0.3 * k), 1 - k);
    }

    if (counted) {
      const fade = scene.overAt === null ? 1 : ease((now - scene.overAt) / 600);
      for (const [i, c] of owner) {
        const p = at(i);
        const s = step * 0.32 * fade;
        ctx.fillStyle = c === BLACK ? 'rgb(20 20 20 / 0.85)' : 'rgb(250 248 240 / 0.95)';
        ctx.strokeStyle = 'rgb(40 30 20 / 0.5)';
        ctx.lineWidth = 1;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        if (c === WHITE) ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }

    const lastMove = state.last;
    if (lastMove && 'x' in lastMove && state.board[lastMove.y * size + lastMove.x] !== EMPTY) {
      const p = at(lastMove.y * size + lastMove.x);
      ctx.strokeStyle =
        lastMove.stone === BLACK ? 'rgb(245 235 215 / 0.95)' : 'rgb(30 24 18 / 0.9)';
      ctx.lineWidth = Math.max(1.5, step * 0.07);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }

    const ghost = scene.ghost ?? scene.hover;
    if (
      scene.mine &&
      ghost &&
      state.phase === 'play' &&
      state.board[ghost.y * size + ghost.x] === EMPTY
    ) {
      const p = at(ghost.y * size + ghost.x);
      if (scene.ghost) {
        ctx.strokeStyle = 'rgb(181 72 44 / 0.7)';
        ctx.lineWidth = Math.max(1.5, step * 0.06);
        ctx.beginPath();
        ctx.moveTo(origin, p.y);
        ctx.lineTo(last, p.y);
        ctx.moveTo(p.x, origin);
        ctx.lineTo(p.x, last);
        ctx.stroke();
      }
      drawStone(ctx, scene.mine, p.x, p.y, radius, scene.ghost ? 0.7 : 0.4);
    }
  }

  /** The board: a warm wooden slab with a grain, lit from the top left. */
  private drawWood() {
    const { ctx } = this;
    const w = this.width;
    ctx.save();
    ctx.shadowColor = 'rgb(0 0 0 / 0.5)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = WOOD_DARK;
    roundRect(ctx, 0, 0, w, w, 6);
    ctx.fill();
    ctx.restore();
    const light = ctx.createLinearGradient(0, 0, w, w);
    light.addColorStop(0, WOOD_LIT);
    light.addColorStop(0.55, WOOD_MID);
    light.addColorStop(1, WOOD_DARK);
    ctx.fillStyle = light;
    roundRect(ctx, 0, 0, w, w, 6);
    ctx.fill();
    ctx.fillStyle = this.woodGrain();
    roundRect(ctx, 0, 0, w, w, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgb(255 240 200 / 0.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, 0.5, 0.5, w - 1, w - 1, 6);
    ctx.stroke();
  }

  /** Wavy lines of darker wood, made once per size. */
  private woodGrain(): CanvasPattern | string {
    if (this.grain) return this.grain;
    const size = Math.max(64, Math.round(this.width));
    const tile = document.createElement('canvas');
    tile.width = tile.height = size;
    const g = tile.getContext('2d');
    if (!g) return 'transparent';
    let seed = 11;
    const r = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let k = 0; k < 60; k++) {
      const y0 = r() * size;
      g.strokeStyle = `rgb(120 70 30 / ${0.04 + r() * 0.07})`;
      g.lineWidth = 0.5 + r() * 1.8;
      g.beginPath();
      const amp = 2 + r() * 6;
      const freq = 0.004 + r() * 0.01;
      const phase = r() * 10;
      for (let x = 0; x <= size; x += 4) {
        const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.3;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    this.grain = this.ctx.createPattern(tile, 'no-repeat');
    return this.grain ?? 'transparent';
  }
}

function neighbourColour(live: readonly Cell[], size: number, i: number): Cell {
  const seen = new Set([i]);
  const stack = [i];
  while (stack.length) {
    const p = stack.pop() as number;
    const x = p % size;
    for (const n of [x > 0 ? p - 1 : -1, x < size - 1 ? p + 1 : -1, p - size, p + size]) {
      if (n < 0 || n >= live.length || seen.has(n)) continue;
      if (live[n] !== EMPTY) return live[n] as Cell;
      seen.add(n);
      stack.push(n);
    }
  }
  return EMPTY;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A stone with a soft shadow: black slate with a sheen, white shell with faint bands. */
export function drawStone(
  ctx: CanvasRenderingContext2D,
  stone: Stone,
  x: number,
  y: number,
  r: number,
  alpha: number,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgb(30 15 0 / 0.45)';
  ctx.shadowBlur = r * 0.35;
  ctx.shadowOffsetX = r * 0.1;
  ctx.shadowOffsetY = r * 0.16;
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
  if (stone === BLACK) {
    g.addColorStop(0, '#6d6d6d');
    g.addColorStop(0.35, '#2a2a2a');
    g.addColorStop(1, '#0a0a0a');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, '#f0ede4');
    g.addColorStop(1, '#cdc6b6');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (stone === WHITE && r > 8) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.18;
    ctx.strokeStyle = '#b9ae98';
    ctx.lineWidth = Math.max(0.5, r * 0.04);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.ellipse(
        x + k * r * 0.32,
        y + r * 1.4,
        r * 1.6,
        r * 1.2,
        0.2,
        Math.PI * 1.1,
        Math.PI * 1.9,
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}
