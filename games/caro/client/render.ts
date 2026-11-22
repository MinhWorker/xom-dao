/** Draws the board on its canvas: a sheet of squared paper with ink marks. */
import { at, keyOf, points } from '../server/game/board.js';
import type { Board, Mark, Point, State } from '../server/game/model.js';

const PAPER_LIT = '#f7f0de';
const PAPER_SHADE = '#e6d9bc';
const PAPER_EDGE = '#cdbf9f';
const SHEETS = ['#cbbd9c', '#ddd0b2'];
const GRID = 'rgb(59 53 44 / 0.24)';
const PENCIL = 'rgb(59 53 44 / 0.6)';
const FRESH = 'rgb(255 226 150 / 0.4)';
const INK: Record<Mark, string> = { X: '#b3372c', O: '#2c4f8a' };
const WASH: Record<Mark, string> = { X: 'rgb(179 55 44 / 0.13)', O: 'rgb(44 79 138 / 0.13)' };

/** How long a fresh mark takes to draw, the board to grow and the winning line to strike. */
export const MARK_MS = 220;
export const GROW_MS = 320;
const LINE_MS = 650;
/** How long the ink ring of a fresh mark spreads, and the pencil circle of the last move takes. */
const RIPPLE_MS = 460;
const CIRCLE_MS = 280;
/** How long the cells a growth added stay lighter than the rest of the sheet. */
const FRESH_MS = 1100;
/** The end of a Match, from when it is called: the line strikes once the last mark is drawn. */
export const LINE_AT = MARK_MS;
const FLOURISH_AT = LINE_AT + LINE_MS;
/** The five marks pop one after another; the loser's board dims; a draw fades out from the middle. */
const POP_STEP_MS = 90;
const POP_MS = 280;
const DIM_MS = 600;
const DRAW_WAVE_MS = 650;
/** When the end has played out and the Hub may show the results. */
export const END_MS = 2000;

/** How the Match ended for this player; `watch` is a spectator's view of a win. */
export type Ending = 'win' | 'lose' | 'draw' | 'watch';

/** The board window on screen, in board coordinates (a float while the board grows). */
interface Frame {
  left: number;
  top: number;
  cols: number;
  rows: number;
}

/** What the renderer needs besides the state: pending and hovered cells, and timing. */
export interface Scene {
  state: State | null;
  /** The cell the player just sent, drawn faintly until the server answers. */
  pending: Point | null;
  /** The cell under the mouse, when the player may mark it. */
  hover: Point | null;
  /** The player's mark, `null` for a spectator. */
  mine: Mark | null;
  /** When each mark appeared (performance.now()), by cell key. */
  placedAt: Map<string, number>;
  /** When the end began (the winning line or the draw), and how it ended for the player. */
  overAt: number | null;
  ending: Ending | null;
}

const ease = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;
/** Rises and falls back over `t` from 0 to 1; 0 outside. */
const bump = (t: number) => (t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t));

export class BoardView {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private from: Frame | null = null;
  private to: Frame | null = null;
  private grewAt = 0;
  /** The extent before the last growth, to light the cells it added. */
  private before: Frame | null = null;
  private grain: CanvasPattern | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  /** Sizes the canvas in CSS pixels. */
  resize(width: number, height: number) {
    const ratio = window.devicePixelRatio || 1;
    this.width = width;
    this.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /** Follows the board's extent, easing from the last one when it grew. */
  track(board: Board, now: number, animate: boolean) {
    const next = { left: board.left, top: board.top, cols: board.cols, rows: board.rows };
    const same =
      this.to &&
      this.to.left === next.left &&
      this.to.top === next.top &&
      this.to.cols === next.cols &&
      this.to.rows === next.rows;
    if (same) return;
    this.before = animate && this.to ? this.to : null;
    this.from = animate && this.to ? this.frame(now) : next;
    this.to = next;
    this.grewAt = now;
  }

  /** The cell under a point of the canvas (CSS pixels), or `null` off the board. */
  cellAt(board: Board, px: number, py: number, now: number): Point | null {
    const { cell, ox, oy, frame } = this.layout(now);
    const p = {
      x: Math.floor(frame.left + (px - ox) / cell),
      y: Math.floor(frame.top + (py - oy) / cell),
    };
    return at(board, p) === undefined ? null : p;
  }

  /** Whether something still moves at `now` (keep drawing frames). */
  animating(scene: Scene, now: number) {
    if (now - this.grewAt < (this.before ? FRESH_MS : GROW_MS)) return true;
    if (scene.overAt !== null && now - scene.overAt < END_MS) return true;
    for (const t of scene.placedAt.values()) if (now - t < RIPPLE_MS + CIRCLE_MS) return true;
    return false;
  }

  draw(scene: Scene, now: number) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    const state = scene.state;
    if (!state || !this.to) return;
    const { board } = state;
    const { cell, ox, oy, frame } = this.layout(now);
    const x0 = ox + (board.left - frame.left) * cell;
    const y0 = oy + (board.top - frame.top) * cell;
    const w = board.cols * cell;
    const h = board.rows * cell;

    this.drawPaper(x0, y0, w, h);
    this.drawFresh(board, now, ox, oy, frame, cell);
    drawGrid(ctx, x0, y0, board.cols, board.rows, cell);

    const centre = (p: Point) => ({
      cx: ox + (p.x - frame.left + 0.5) * cell,
      cy: oy + (p.y - frame.top + 0.5) * cell,
    });

    const last = state.last;
    const lastMark = last && at(board, last);
    if (last && lastMark) {
      const { cx, cy } = centre(last);
      ctx.fillStyle = WASH[lastMark];
      ctx.fillRect(cx - cell / 2 + 1, cy - cell / 2 + 1, cell - 1, cell - 1);
      if (!state.line) {
        const placed = scene.placedAt.get(keyOf(last));
        const t = placed === undefined ? 1 : ease((now - placed - MARK_MS) / CIRCLE_MS);
        if (t > 0) {
          ctx.strokeStyle = PENCIL;
          ctx.lineWidth = Math.max(1, cell * 0.045);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.ellipse(cx, cy, cell * 0.47, cell * 0.44, -0.3, 0.2, 0.2 + (Math.PI * 2 - 0.1) * t);
          ctx.stroke();
        }
      }
    }

    const since = scene.overAt === null ? -Infinity : now - scene.overAt;
    const line = state.line ?? [];
    const lineIndex = new Map(line.map((p, i) => [keyOf(p), i]));
    if (since >= FLOURISH_AT && line.length) {
      const glow = ease((since - FLOURISH_AT) / POP_MS);
      ctx.fillStyle = WASH[at(board, line[0] as Point) as Mark];
      ctx.globalAlpha = glow;
      for (const p of line) {
        const { cx, cy } = centre(p);
        ctx.fillRect(cx - cell / 2 + 1, cy - cell / 2 + 1, cell - 1, cell - 1);
      }
      ctx.globalAlpha = 1;
    }
    const middle = { x: board.left + board.cols / 2, y: board.top + board.rows / 2 };
    const far = Math.hypot(board.cols, board.rows) / 2;

    for (const p of points(board)) {
      const mark = at(board, p);
      if (!mark) continue;
      const placed = scene.placedAt.get(keyOf(p));
      const age = placed === undefined ? Infinity : now - placed;
      if (age < RIPPLE_MS) drawRipple(ctx, mark, centre(p), cell, age / RIPPLE_MS);
      const t = ease(age / MARK_MS);
      let alpha = 1;
      let scale = 1 + 0.25 * (1 - t);
      const index = lineIndex.get(keyOf(p));
      if (index !== undefined && scene.ending !== 'lose') {
        scale *= 1 + 0.3 * bump((since - FLOURISH_AT - index * POP_STEP_MS) / POP_MS);
      } else if (scene.ending === 'draw') {
        const reach = Math.hypot(p.x + 0.5 - middle.x, p.y + 0.5 - middle.y) / far;
        const k = (since - LINE_AT - reach * DRAW_WAVE_MS) / POP_MS;
        scale *= 1 + 0.15 * bump(k);
        alpha = 1 - 0.45 * ease(k);
      }
      drawMark(ctx, mark, centre(p), cell, t, alpha, scale);
    }

    if (scene.ending === 'lose' && since > FLOURISH_AT) {
      const veil = new Path2D();
      veil.rect(x0 - 5, y0 - 5, w + 10, h + 10);
      for (const p of line) {
        const { cx, cy } = centre(p);
        veil.rect(cx - cell / 2, cy - cell / 2, cell, cell);
      }
      ctx.fillStyle = `rgb(42 30 22 / ${0.28 * ease((since - FLOURISH_AT) / DIM_MS)})`;
      ctx.fill(veil, 'evenodd');
    }

    const ghost = scene.pending ?? scene.hover;
    if (scene.mine && ghost && at(board, ghost) === null) {
      drawMark(ctx, scene.mine, centre(ghost), cell, 1, scene.pending ? 0.5 : 0.22, 1);
    }

    if (state.line && scene.overAt !== null) {
      const first = centre(state.line[0] as Point);
      const last = centre(state.line[state.line.length - 1] as Point);
      const mark = at(board, state.line[0] as Point) as Mark;
      const t = ease((since - LINE_AT) / LINE_MS);
      const length = Math.max(1, Math.hypot(last.cx - first.cx, last.cy - first.cy));
      const dx = (last.cx - first.cx) / length;
      const dy = (last.cy - first.cy) / length;
      const sx = first.cx - dx * cell * 0.45;
      const sy = first.cy - dy * cell * 0.45;
      const ex = last.cx + dx * cell * 0.45;
      const ey = last.cy + dy * cell * 0.45;
      if (t <= 0) return;
      ctx.strokeStyle = INK[mark];
      ctx.globalAlpha = 0.85;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(3, cell * 0.14);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (ex - sx) * t, sy + (ey - sy) * t);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /** Cell size and where the frame's top-left cell sits, centred on the canvas. */
  private layout(now: number) {
    const frame = this.frame(now);
    const pad = 8;
    const cell = Math.min(
      (this.width - pad * 2) / frame.cols,
      (this.height - pad * 2) / frame.rows,
    );
    return {
      cell,
      frame,
      ox: (this.width - frame.cols * cell) / 2,
      oy: (this.height - frame.rows * cell) / 2,
    };
  }

  private frame(now: number): Frame {
    const to = this.to as Frame;
    const from = this.from ?? to;
    const t = ease((now - this.grewAt) / GROW_MS);
    const mix = (a: number, b: number) => a + (b - a) * t;
    return {
      left: mix(from.left, to.left),
      top: mix(from.top, to.top),
      cols: mix(from.cols, to.cols),
      rows: mix(from.rows, to.rows),
    };
  }

  /** A pad of paper under the board: two sheets peeking out, then the lit top sheet. */
  private drawPaper(x0: number, y0: number, w: number, h: number) {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = 'rgb(0 0 0 / 0.5)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = SHEETS[0] as string;
    ctx.fillRect(x0 - 3, y0 - 1, w + 9, h + 9);
    ctx.restore();
    ctx.fillStyle = SHEETS[1] as string;
    ctx.fillRect(x0 - 4, y0 - 3, w + 10, h + 9);
    const light = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
    light.addColorStop(0, PAPER_LIT);
    light.addColorStop(1, PAPER_SHADE);
    ctx.fillStyle = light;
    ctx.fillRect(x0 - 5, y0 - 5, w + 10, h + 10);
    ctx.fillStyle = this.paperGrain();
    ctx.fillRect(x0 - 5, y0 - 5, w + 10, h + 10);
    ctx.strokeStyle = PAPER_EDGE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 4.5, y0 - 4.5, w + 9, h + 9);
    ctx.strokeStyle = 'rgb(255 255 255 / 0.55)';
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y0 - 3.5);
    ctx.lineTo(x0 + w + 4, y0 - 3.5);
    ctx.stroke();
  }

  /** Lights the cells the last growth added, fading, with a fold where the old edge was. */
  private drawFresh(board: Board, now: number, ox: number, oy: number, frame: Frame, cell: number) {
    const old = this.before;
    const age = now - this.grewAt;
    if (!old || age >= FRESH_MS) return;
    const { ctx } = this;
    const fade = 1 - ease(age / FRESH_MS);
    const sx = (x: number) => ox + (x - frame.left) * cell;
    const sy = (y: number) => oy + (y - frame.top) * cell;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.rect(sx(board.left), sy(board.top), board.cols * cell, board.rows * cell);
    ctx.rect(sx(old.left), sy(old.top), old.cols * cell, old.rows * cell);
    ctx.fillStyle = FRESH;
    ctx.fill('evenodd');
    ctx.setLineDash([cell * 0.18, cell * 0.14]);
    ctx.strokeStyle = PENCIL;
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.strokeRect(sx(old.left), sy(old.top), old.cols * cell, old.rows * cell);
    ctx.restore();
  }

  /** A faint noise pattern over the paper, made once. */
  private paperGrain(): CanvasPattern | string {
    if (this.grain) return this.grain;
    const tile = document.createElement('canvas');
    tile.width = tile.height = 96;
    const g = tile.getContext('2d');
    if (!g) return 'transparent';
    const image = g.createImageData(96, 96);
    let seed = 7;
    for (let i = 0; i < image.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const v = seed % 255;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v > 127 ? 255 : 60;
      image.data[i + 3] = 10;
    }
    g.putImageData(image, 0, 0);
    this.grain = this.ctx.createPattern(tile, 'repeat');
    return this.grain ?? 'transparent';
  }
}

/** The squared-paper lines of the board. */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cols: number,
  rows: number,
  cell: number,
) {
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    const x = Math.round(x0 + c * cell) + 0.5;
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + rows * cell);
  }
  for (let r = 0; r <= rows; r++) {
    const y = Math.round(y0 + r * cell) + 0.5;
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + cols * cell, y);
  }
  ctx.stroke();
}

/** The ink ring that spreads from a fresh mark, at `t` (0–1) of its life. */
function drawRipple(
  ctx: CanvasRenderingContext2D,
  mark: Mark,
  { cx, cy }: { cx: number; cy: number },
  cell: number,
  t: number,
) {
  const k = ease(t);
  ctx.save();
  ctx.globalAlpha = 0.4 * (1 - k);
  ctx.strokeStyle = INK[mark];
  ctx.lineWidth = Math.max(1, cell * 0.06 * (1 - k));
  ctx.beginPath();
  ctx.arc(cx, cy, cell * (0.3 + 0.35 * k), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** An ink X or O at `t` of its stroke (0–1), `scale` times its size, with a faint bleed. */
function drawMark(
  ctx: CanvasRenderingContext2D,
  mark: Mark,
  { cx, cy }: { cx: number; cy: number },
  cell: number,
  t: number,
  alpha: number,
  scale: number,
) {
  const r = cell * 0.3 * scale;
  const width = Math.max(2, cell * 0.11);
  const path = new Path2D();
  if (mark === 'X') {
    const a = Math.min(1, t * 2);
    const b = Math.max(0, t * 2 - 1);
    path.moveTo(cx - r, cy - r);
    path.lineTo(cx - r + 2 * r * a, cy - r + 2 * r * a);
    if (b > 0) {
      path.moveTo(cx + r, cy - r);
      path.lineTo(cx + r - 2 * r * b, cy - r + 2 * r * b);
    }
  } else {
    const start = -Math.PI / 2 - 0.3;
    path.ellipse(cx, cy, r * 1.02, r * 0.96, 0, start, start + Math.PI * 2 * t);
  }
  ctx.save();
  ctx.strokeStyle = INK[mark];
  ctx.lineCap = 'round';
  ctx.globalAlpha = alpha * 0.18;
  ctx.lineWidth = width * 1.9;
  ctx.stroke(path);
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.restore();
}
