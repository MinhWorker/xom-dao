/** Draws the Cờ Tướng board on its canvas: the lines, the river and palaces, marks for the last
 * move and the choices, and the round pieces sliding into place. */
import type { State } from '../server/game/model.js';

const WOOD_LIT = '#f0cf8e';
const WOOD_DARK = '#d6a95e';
const LINE = 'rgb(70 38 14 / 0.85)';
const LAST = 'rgb(40 120 200 / 0.85)';
const HINT = 'rgb(40 110 60 / 0.75)';

/** How long a piece takes to slide to its point. */
export const SLIDE_MS = 200;
const FADE_MS = 280;
/** The end: the result shows after the last move settles. */
export const END_MS = 1600;

const HAN: Record<string, string> = {
  K: '帥',
  A: '仕',
  B: '相',
  N: '傌',
  R: '俥',
  C: '炮',
  P: '兵',
  k: '將',
  a: '士',
  b: '象',
  n: '馬',
  r: '車',
  c: '砲',
  p: '卒',
};
const VIET: Record<string, string> = {
  k: 'Tướng',
  a: 'Sĩ',
  b: 'Tượng',
  n: 'Mã',
  r: 'Xe',
  c: 'Pháo',
  p: 'Tốt',
};

/** The board's size in steps between lines, margins included. */
export const COLS = 9.3;
export const ROWS = 10.3;

/** A move on its way: the piece that slid, from where to where, and what it took. */
export interface Slide {
  piece: string;
  from: number;
  to: number;
  taken?: string;
  at: number;
}

/** What the renderer needs besides the state. */
export interface Scene {
  state: State | null;
  /** True when Black sits at the bottom. */
  flipped: boolean;
  picked: number | null;
  targets: Set<number>;
  hints: boolean;
  /** Chinese characters, or Vietnamese names, on the pieces. */
  labels: 'han' | 'viet';
  drag: { from: number; x: number; y: number } | null;
  slide: Slide | null;
  overAt: number | null;
}

const ease = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;

export class BoardView {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private step = 1;
  private grain: CanvasPattern | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  /** Fits the board in `width` × `height` CSS pixels. */
  resize(width: number, height: number) {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    this.step = Math.min(width / COLS, height / ROWS);
    this.width = Math.round(this.step * COLS);
    this.height = Math.round(this.step * ROWS);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.grain = null;
  }

  private get origin() {
    return {
      x: (this.width - this.step * 8) / 2,
      y: (this.height - this.step * 9) / 2,
    };
  }

  /** The centre of a point (0..89, Black's back row first) as seen from the player's side. */
  private centre(i: number, flipped: boolean) {
    const col = flipped ? 8 - (i % 9) : i % 9;
    const row = flipped ? 9 - Math.floor(i / 9) : Math.floor(i / 9);
    const o = this.origin;
    return { x: o.x + col * this.step, y: o.y + row * this.step };
  }

  /** The point under a canvas position (CSS pixels), or `null`. */
  pointAt(px: number, py: number, flipped: boolean): number | null {
    const o = this.origin;
    const col = Math.round((px - o.x) / this.step);
    const row = Math.round((py - o.y) / this.step);
    if (col < 0 || row < 0 || col > 8 || row > 9) return null;
    return flipped ? (9 - row) * 9 + (8 - col) : row * 9 + col;
  }

  animating(scene: Scene, now: number) {
    if (scene.slide && now - scene.slide.at < Math.max(SLIDE_MS, FADE_MS)) return true;
    return scene.overAt !== null && now - scene.overAt < END_MS;
  }

  draw(scene: Scene, now: number) {
    const { ctx, step } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    const state = scene.state;
    if (!state) return;
    const flip = scene.flipped;
    this.drawBoard();

    const r = step * 0.44;
    const last = state.last;
    if (last) {
      const a = this.centre(last.from, flip);
      ctx.strokeStyle = LAST;
      ctx.lineWidth = Math.max(1.5, step * 0.05);
      ctx.setLineDash([step * 0.12, step * 0.1]);
      ctx.beginPath();
      ctx.arc(a.x, a.y, r * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const checked = last?.check && state.phase !== 'over' ? kingOf(state, state.turn) : -1;
    const lost =
      state.ending === 'checkmate' || state.ending === 'stalemate' ? kingOf(state, state.turn) : -1;
    for (const i of [checked, lost]) {
      if (i < 0) continue;
      const c = this.centre(i, flip);
      const g = ctx.createRadialGradient(c.x, c.y, r * 0.6, c.x, c.y, r * 1.5);
      g.addColorStop(0, 'rgb(255 40 20 / 0.95)');
      g.addColorStop(1, 'rgb(220 0 0 / 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const slide = scene.slide;
    const t = slide ? ease((now - slide.at) / SLIDE_MS) : 1;
    const hidden = new Set<number>();
    if (slide && t < 1) hidden.add(slide.to);
    if (scene.drag) hidden.add(scene.drag.from);
    for (let i = 0; i < 90; i++) {
      const piece = state.board[i] as string;
      if (piece === '.' || hidden.has(i)) continue;
      const c = this.centre(i, flip);
      const lift = scene.picked === i ? step * 0.06 : 0;
      this.drawPiece(piece, c.x, c.y - lift, r, scene.labels, 1, scene.picked === i);
      if (last && last.to === i && !(slide && t < 1)) {
        ctx.strokeStyle = LAST;
        ctx.lineWidth = Math.max(1.5, step * 0.05);
        ctx.beginPath();
        ctx.arc(c.x, c.y, r + step * 0.05, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (slide?.taken) {
      const k = (now - slide.at) / FADE_MS;
      if (k < 1) {
        const c = this.centre(slide.to, flip);
        this.drawPiece(slide.taken, c.x, c.y, r * (1 - 0.2 * ease(k)), scene.labels, 1 - ease(k));
      }
    }

    if (scene.hints || scene.drag) {
      for (const i of scene.targets) {
        const c = this.centre(i, flip);
        ctx.fillStyle = HINT;
        ctx.strokeStyle = HINT;
        if (state.board[i] !== '.') {
          ctx.lineWidth = Math.max(2, step * 0.07);
          ctx.beginPath();
          ctx.arc(c.x, c.y, r + step * 0.04, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(c.x, c.y, step * 0.13, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (slide && t < 1) {
      const a = this.centre(slide.from, flip);
      const b = this.centre(slide.to, flip);
      const lift = Math.sin(Math.PI * t) * step * 0.12;
      this.drawPiece(
        slide.piece,
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t - lift,
        r * (1 + lift / step),
        scene.labels,
      );
    }
    if (scene.drag) {
      const piece = state.board[scene.drag.from] as string;
      this.drawPiece(
        piece,
        scene.drag.x,
        scene.drag.y - step * 0.3,
        r * 1.12,
        scene.labels,
        1,
        true,
      );
    }
  }

  /** The board: warm wood, the grid with the river across the middle, the palaces' diagonals and
   * the marks where cannons and soldiers start. */
  private drawBoard() {
    const { ctx, step } = this;
    const w = this.width;
    const h = this.height;
    ctx.save();
    ctx.shadowColor = 'rgb(0 0 0 / 0.5)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = WOOD_DARK;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 6);
    ctx.fill();
    ctx.restore();
    const light = ctx.createLinearGradient(0, 0, w, h);
    light.addColorStop(0, WOOD_LIT);
    light.addColorStop(1, WOOD_DARK);
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 6);
    ctx.fill();
    ctx.fillStyle = this.woodGrain();
    ctx.fill();

    const o = this.origin;
    const x = (c: number) => o.x + c * step;
    const y = (r: number) => o.y + r * step;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = Math.max(2, step * 0.07);
    ctx.strokeRect(x(0) - step * 0.12, y(0) - step * 0.12, step * 8.24, step * 9.24);
    ctx.lineWidth = Math.max(1, step * 0.03);
    ctx.beginPath();
    for (let r = 0; r < 10; r++) {
      ctx.moveTo(x(0), y(r));
      ctx.lineTo(x(8), y(r));
    }
    for (let c = 0; c < 9; c++) {
      const edge = c === 0 || c === 8;
      ctx.moveTo(x(c), y(0));
      ctx.lineTo(x(c), y(edge ? 9 : 4));
      if (!edge) {
        ctx.moveTo(x(c), y(5));
        ctx.lineTo(x(c), y(9));
      }
    }
    for (const top of [0, 7]) {
      ctx.moveTo(x(3), y(top));
      ctx.lineTo(x(5), y(top + 2));
      ctx.moveTo(x(5), y(top));
      ctx.lineTo(x(3), y(top + 2));
    }
    const mark = (c: number, r: number) => {
      const g = step * 0.08;
      const l = step * 0.2;
      for (const dx of [-1, 1]) {
        if ((dx < 0 && c === 0) || (dx > 0 && c === 8)) continue;
        for (const dy of [-1, 1]) {
          ctx.moveTo(x(c) + dx * (g + l), y(r) + dy * g);
          ctx.lineTo(x(c) + dx * g, y(r) + dy * g);
          ctx.lineTo(x(c) + dx * g, y(r) + dy * (g + l));
        }
      }
    };
    for (const r of [2, 7]) for (const c of [1, 7]) mark(c, r);
    for (const r of [3, 6]) for (const c of [0, 2, 4, 6, 8]) mark(c, r);
    ctx.stroke();

    ctx.fillStyle = 'rgb(70 38 14 / 0.55)';
    ctx.font = `600 ${Math.round(step * 0.5)}px "Kaiti SC", STKaiti, KaiTi, BiauKai, "Noto Serif CJK SC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mid = y(4.5);
    ctx.save();
    ctx.translate(x(2), mid);
    ctx.fillText('楚 河', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(x(6), mid);
    ctx.rotate(Math.PI);
    ctx.fillText('漢 界', 0, 0);
    ctx.restore();
  }

  /** A round wooden piece with its name carved in red or black. */
  private drawPiece(
    piece: string,
    x: number,
    y: number,
    r: number,
    labels: Scene['labels'],
    alpha = 1,
    raised = false,
  ) {
    const { ctx } = this;
    if (alpha <= 0) return;
    const red = piece !== piece.toLowerCase();
    const ink = red ? '#b3261e' : '#1f1a16';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgb(40 20 0 / 0.5)';
    ctx.shadowBlur = r * (raised ? 0.5 : 0.25);
    ctx.shadowOffsetY = r * (raised ? 0.25 : 0.12);
    ctx.fillStyle = '#a8763c';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.08, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = alpha;
    const face = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    face.addColorStop(0, '#fff3d6');
    face.addColorStop(0.7, '#f1d9a6');
    face.addColorStop(1, '#d9b676');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.96, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (labels === 'viet') {
      const word = VIET[piece.toLowerCase()] ?? '';
      const size = r * (word.length > 3 ? 0.5 : 0.62);
      ctx.font = `800 ${size}px system-ui, sans-serif`;
      ctx.fillText(word, x, y + r * 0.04, r * 1.45);
    } else {
      ctx.font = `700 ${r * 1.05}px "Kaiti SC", STKaiti, KaiTi, BiauKai, "Noto Serif CJK SC", "Songti SC", serif`;
      ctx.fillText(HAN[piece] ?? '', x, y + r * 0.05);
    }
    ctx.restore();
  }

  /** Wavy lines of darker wood, made once per size. */
  private woodGrain(): CanvasPattern | string {
    if (this.grain) return this.grain;
    const w = Math.max(64, Math.round(this.width));
    const h = Math.max(64, Math.round(this.height));
    const tile = document.createElement('canvas');
    tile.width = w;
    tile.height = h;
    const g = tile.getContext('2d');
    if (!g) return 'transparent';
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let k = 0; k < 70; k++) {
      const y0 = rnd() * h;
      g.strokeStyle = `rgb(120 70 30 / ${0.03 + rnd() * 0.06})`;
      g.lineWidth = 0.5 + rnd() * 1.8;
      g.beginPath();
      const amp = 2 + rnd() * 6;
      const freq = 0.004 + rnd() * 0.01;
      const phase = rnd() * 10;
      for (let x = 0; x <= w; x += 4) {
        const yy = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.3;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
    this.grain = this.ctx.createPattern(tile, 'no-repeat');
    return this.grain ?? 'transparent';
  }
}

/** The point of the general of `id`'s side. */
function kingOf(state: State, id: string) {
  return state.board.indexOf(state.players[0] === id ? 'K' : 'k');
}
