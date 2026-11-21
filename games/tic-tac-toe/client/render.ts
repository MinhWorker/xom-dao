/** Draws the board on its canvas: a sheet of squared paper with ink marks. */
import { at, keyOf, points } from '../server/game/board.js';
import type { Board, Mark, Point, State } from '../server/game/model.js';

const PAPER = '#f1e9d6';
const PAPER_EDGE = '#d9cdb2';
const GRID = 'rgb(59 53 44 / 0.26)';
const PENCIL = 'rgb(59 53 44 / 0.55)';
const INK: Record<Mark, string> = { X: '#b3372c', O: '#2c4f8a' };

/** How long a fresh mark takes to draw, the board to grow and the winning line to strike. */
export const MARK_MS = 220;
export const GROW_MS = 320;
export const LINE_MS = 650;

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
  /** When the winning line appeared, or the draw was called. */
  overAt: number | null;
}

const ease = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;

export class BoardView {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private from: Frame | null = null;
  private to: Frame | null = null;
  private grewAt = 0;
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
    if (now - this.grewAt < GROW_MS) return true;
    if (scene.overAt !== null && now - scene.overAt < LINE_MS) return true;
    for (const t of scene.placedAt.values()) if (now - t < MARK_MS) return true;
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

    ctx.save();
    ctx.shadowColor = 'rgb(0 0 0 / 0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = PAPER;
    ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
    ctx.restore();
    ctx.fillStyle = this.paperGrain();
    ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
    ctx.strokeStyle = PAPER_EDGE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 3.5, y0 - 3.5, w + 7, h + 7);

    ctx.strokeStyle = GRID;
    ctx.beginPath();
    for (let c = 0; c <= board.cols; c++) {
      const x = Math.round(x0 + c * cell) + 0.5;
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + h);
    }
    for (let r = 0; r <= board.rows; r++) {
      const y = Math.round(y0 + r * cell) + 0.5;
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
    }
    ctx.stroke();

    const centre = (p: Point) => ({
      cx: ox + (p.x - frame.left + 0.5) * cell,
      cy: oy + (p.y - frame.top + 0.5) * cell,
    });

    if (state.last && !state.line) {
      const { cx, cy } = centre(state.last);
      ctx.strokeStyle = PENCIL;
      ctx.lineWidth = Math.max(1, cell * 0.04);
      ctx.beginPath();
      ctx.ellipse(cx, cy, cell * 0.47, cell * 0.44, -0.3, 0.2, Math.PI * 2 - 0.1);
      ctx.stroke();
    }

    for (const p of points(board)) {
      const mark = at(board, p);
      if (!mark) continue;
      const placed = scene.placedAt.get(keyOf(p));
      const t = placed === undefined ? 1 : ease((now - placed) / MARK_MS);
      drawMark(ctx, mark, centre(p), cell, t, 1);
    }

    const ghost = scene.pending ?? scene.hover;
    if (scene.mine && ghost && at(board, ghost) === null) {
      drawMark(ctx, scene.mine, centre(ghost), cell, 1, scene.pending ? 0.5 : 0.22);
    }

    if (state.line && scene.overAt !== null) {
      const first = centre(state.line[0] as Point);
      const last = centre(state.line[state.line.length - 1] as Point);
      const mark = at(board, state.line[0] as Point) as Mark;
      const t = ease((now - scene.overAt) / LINE_MS);
      const length = Math.max(1, Math.hypot(last.cx - first.cx, last.cy - first.cy));
      const dx = (last.cx - first.cx) / length;
      const dy = (last.cy - first.cy) / length;
      const sx = first.cx - dx * cell * 0.45;
      const sy = first.cy - dy * cell * 0.45;
      const ex = last.cx + dx * cell * 0.45;
      const ey = last.cy + dy * cell * 0.45;
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

/** An ink X or O at `t` of its stroke (0–1). */
function drawMark(
  ctx: CanvasRenderingContext2D,
  mark: Mark,
  { cx, cy }: { cx: number; cy: number },
  cell: number,
  t: number,
  alpha: number,
) {
  const r = cell * 0.3;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = INK[mark];
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, cell * 0.11);
  ctx.beginPath();
  if (mark === 'X') {
    const a = Math.min(1, t * 2);
    const b = Math.max(0, t * 2 - 1);
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx - r + 2 * r * a, cy - r + 2 * r * a);
    if (b > 0) {
      ctx.moveTo(cx + r, cy - r);
      ctx.lineTo(cx + r - 2 * r * b, cy - r + 2 * r * b);
    }
  } else {
    const start = -Math.PI / 2 - 0.3;
    ctx.ellipse(cx, cy, r * 1.02, r * 0.96, 0, start, start + Math.PI * 2 * t);
  }
  ctx.stroke();
  ctx.restore();
}
