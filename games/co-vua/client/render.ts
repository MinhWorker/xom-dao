/** Draws the chess board on its canvas: the squares, marks for the last move and the choices,
 * the pieces sliding into place and the promotion picker. */
import type { State } from '../server/game/model.js';
import { drawPiece } from './pieces.js';

const LIGHT = '#efdab4';
const DARK = '#b58763';
const FRAME = '#5a3b24';
const LAST = 'rgb(214 190 64 / 0.48)';
const PICKED = 'rgb(108 150 60 / 0.55)';
const HINT = 'rgb(38 52 24 / 0.3)';

/** How long a piece takes to slide to its square. */
export const SLIDE_MS = 190;
const FADE_MS = 260;
/** The end: the result shows after the last move settles. */
export const END_MS = 1600;
const PROMOS = ['q', 'n', 'r', 'b'];

/** A move on its way: the piece that slid, from where to where, and what it took. */
export interface Slide {
  piece: string;
  from: number;
  to: number;
  rook?: { from: number; to: number; piece: string };
  taken?: { at: number; piece: string };
  at: number;
}

/** What the renderer needs besides the state. */
export interface Scene {
  state: State | null;
  /** True when Black sits at the bottom. */
  flipped: boolean;
  /** The square the player picked up, and where it may go. */
  picked: number | null;
  targets: Set<number>;
  hints: boolean;
  /** A piece being dragged, at a canvas position (CSS pixels). */
  drag: { from: number; x: number; y: number } | null;
  /** A pawn reaching the last row, waiting for the player to choose its new piece. */
  promo: { from: number; to: number } | null;
  slide: Slide | null;
  overAt: number | null;
}

const ease = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;

export class BoardView {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  resize(width: number, height: number) {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const side = Math.min(width, height);
    this.width = side;
    this.canvas.style.width = `${side}px`;
    this.canvas.style.height = `${side}px`;
    this.canvas.width = Math.round(side * ratio);
    this.canvas.height = Math.round(side * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private get pad() {
    return Math.max(5, Math.round(this.width * 0.022));
  }

  private get step() {
    return (this.width - this.pad * 2) / 8;
  }

  /** The top-left corner of a square (0..63, a8 first) as seen from the player's side. */
  private corner(i: number, flipped: boolean) {
    const col = flipped ? 7 - (i & 7) : i & 7;
    const row = flipped ? 7 - (i >> 3) : i >> 3;
    return { x: this.pad + col * this.step, y: this.pad + row * this.step };
  }

  /** The square under a canvas position (CSS pixels), or `null`. */
  squareAt(px: number, py: number, flipped: boolean): number | null {
    const col = Math.floor((px - this.pad) / this.step);
    const row = Math.floor((py - this.pad) / this.step);
    if (col < 0 || row < 0 || col > 7 || row > 7) return null;
    return flipped ? (7 - row) * 8 + (7 - col) : row * 8 + col;
  }

  /** The squares of the promotion picker, from the pawn's square toward the middle. */
  promoSquares(scene: Scene) {
    const promo = scene.promo;
    if (!promo) return [];
    const down = promo.to < 8 ? 8 : -8;
    return PROMOS.map((kind, k) => ({ kind, square: promo.to + down * k }));
  }

  animating(scene: Scene, now: number) {
    if (scene.slide && now - scene.slide.at < Math.max(SLIDE_MS, FADE_MS)) return true;
    return scene.overAt !== null && now - scene.overAt < END_MS;
  }

  draw(scene: Scene, now: number) {
    const { ctx } = this;
    const w = this.width;
    ctx.clearRect(0, 0, w, w);
    const state = scene.state;
    if (!state) return;
    const { step, pad } = this;
    const flip = scene.flipped;

    ctx.save();
    ctx.shadowColor = 'rgb(0 0 0 / 0.5)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = FRAME;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, w, 6);
    ctx.fill();
    ctx.restore();
    const frame = ctx.createLinearGradient(0, 0, w, w);
    frame.addColorStop(0, 'rgb(255 220 170 / 0.18)');
    frame.addColorStop(1, 'rgb(0 0 0 / 0.2)');
    ctx.fillStyle = frame;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, w, 6);
    ctx.fill();

    for (let i = 0; i < 64; i++) {
      const { x, y } = this.corner(i, flip);
      ctx.fillStyle = ((i >> 3) + (i & 7)) % 2 ? DARK : LIGHT;
      ctx.fillRect(x, y, step + 0.5, step + 0.5);
    }
    const shade = ctx.createLinearGradient(pad, pad, w - pad, w - pad);
    shade.addColorStop(0, 'rgb(255 250 235 / 0.12)');
    shade.addColorStop(1, 'rgb(60 30 10 / 0.12)');
    ctx.fillStyle = shade;
    ctx.fillRect(pad, pad, w - pad * 2, w - pad * 2);

    const last = state.last;
    if (last) {
      for (const i of [last.from, last.to]) {
        const { x, y } = this.corner(i, flip);
        ctx.fillStyle = LAST;
        ctx.fillRect(x, y, step, step);
      }
    }
    if (scene.picked !== null) {
      const { x, y } = this.corner(scene.picked, flip);
      ctx.fillStyle = PICKED;
      ctx.fillRect(x, y, step, step);
    }
    const checked = last?.check && state.phase !== 'over' ? kingOf(state) : -1;
    const mated = state.ending === 'checkmate' ? kingOf(state) : -1;
    for (const i of [checked, mated]) {
      if (i < 0) continue;
      const { x, y } = this.corner(i, flip);
      const g = ctx.createRadialGradient(
        x + step / 2,
        y + step / 2,
        0,
        x + step / 2,
        y + step / 2,
        step * 0.7,
      );
      g.addColorStop(0, 'rgb(255 40 20 / 0.95)');
      g.addColorStop(0.45, 'rgb(230 30 10 / 0.6)');
      g.addColorStop(1, 'rgb(200 0 0 / 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, step, step);
    }

    const label = Math.max(7, Math.round(step * 0.19));
    if (step >= 28) {
      ctx.font = `700 ${label}px system-ui, sans-serif`;
      const ink = (sq: number) => (((sq >> 3) + (sq & 7)) % 2 ? LIGHT : DARK);
      for (let k = 0; k < 8; k++) {
        const bottom = flip ? 7 - k : 56 + k;
        const b = this.corner(bottom, flip);
        ctx.fillStyle = ink(bottom);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('abcdefgh'[bottom & 7] as string, b.x + step * 0.94, b.y + step * 0.97);
        const left = flip ? 63 - k * 8 : k * 8;
        const l = this.corner(left, flip);
        ctx.fillStyle = ink(left);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(8 - (left >> 3)), l.x + step * 0.05, l.y + step * 0.04);
      }
    }

    const slide = scene.slide;
    const t = slide ? ease((now - slide.at) / SLIDE_MS) : 1;
    const moving = new Set<number>();
    if (slide && t < 1) {
      moving.add(slide.to);
      if (slide.rook) moving.add(slide.rook.to);
    }
    if (scene.drag) moving.add(scene.drag.from);
    const size = step;
    for (let i = 0; i < 64; i++) {
      const piece = state.board[i] as string;
      if (piece === '.' || moving.has(i)) continue;
      const { x, y } = this.corner(i, flip);
      drawPiece(ctx, piece, x, y, size, scene.promo?.from === i ? 0.35 : 1);
    }
    if (slide?.taken) {
      const k = (now - slide.at) / FADE_MS;
      if (k < 1) {
        const { x, y } = this.corner(slide.taken.at, flip);
        const s = size * (1 - 0.25 * ease(k));
        drawPiece(ctx, slide.taken.piece, x + (size - s) / 2, y + (size - s) / 2, s, 1 - ease(k));
      }
    }

    if (scene.hints || scene.drag) {
      for (const i of scene.targets) {
        const { x, y } = this.corner(i, flip);
        ctx.fillStyle = HINT;
        if (state.board[i] !== '.') {
          ctx.beginPath();
          ctx.rect(x, y, step, step);
          ctx.arc(x + step / 2, y + step / 2, step * 0.56, 0, Math.PI * 2, true);
          ctx.fill('evenodd');
        } else {
          ctx.beginPath();
          ctx.arc(x + step / 2, y + step / 2, step * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (slide && t < 1) {
      const glide = (from: number, to: number, piece: string) => {
        const a = this.corner(from, flip);
        const b = this.corner(to, flip);
        drawPiece(ctx, piece, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, size);
      };
      if (slide.rook) glide(slide.rook.from, slide.rook.to, slide.rook.piece);
      glide(
        slide.from,
        slide.to,
        state.board[slide.to] === '.' ? slide.piece : (state.board[slide.to] as string),
      );
    }
    if (scene.drag) {
      const piece = state.board[scene.drag.from] as string;
      const s = size * 1.15;
      drawPiece(ctx, piece, scene.drag.x - s / 2, scene.drag.y - s * 0.62, s);
    }

    if (scene.promo) {
      const white = scene.promo.to < 8;
      ctx.fillStyle = 'rgb(20 14 8 / 0.45)';
      ctx.fillRect(pad, pad, w - pad * 2, w - pad * 2);
      for (const { kind, square } of this.promoSquares(scene)) {
        const { x, y } = this.corner(square, flip);
        ctx.fillStyle = '#f6eee0';
        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, step * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgb(60 40 20 / 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        drawPiece(
          ctx,
          white ? kind.toUpperCase() : kind,
          x + step * 0.08,
          y + step * 0.08,
          step * 0.84,
        );
      }
    }
  }
}

/** The square of the king whose side is to move. */
function kingOf(state: State) {
  const king = state.turn === state.players[0] ? 'K' : 'k';
  return state.board.indexOf(king);
}
