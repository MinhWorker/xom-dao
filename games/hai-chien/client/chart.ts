/**
 * A sea's chart: the grid, its letters and numbers, and what is known of each cell, drawn on a
 * canvas that lies on the water as a texture.
 */
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { Clear, Hit, type Mark, Miss, type Scan, SIZE } from '../server/game/model.js';

/** World units of margin round the grid, for the letters and numbers. */
export const MARGIN = 0.75;
/** The chart's side in world units. */
export const SPAN = SIZE + MARGIN * 2;
const PX = 1024;
const UNIT = PX / SPAN;

/** What a chart shows. */
export interface ChartInput {
  marks: readonly Mark[];
  scans: readonly Scan[];
  /** `home` is the player's own sea, `enemy` the one they fire at. */
  side: 'home' | 'enemy';
  /** Cells to light (the ship being dragged), and whether its place is allowed. */
  shade?: { cells: number[]; ok: boolean } | null;
}

export class Chart {
  readonly texture: CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private key = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = PX;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = LinearMipmapLinearFilter;
  }

  /** Redraws when what it shows changed. */
  draw(input: ChartInput) {
    const key = JSON.stringify([input.marks, input.scans, input.side, input.shade ?? null]);
    if (key === this.key) return;
    this.key = key;
    const { ctx } = this;
    ctx.clearRect(0, 0, PX, PX);
    const o = MARGIN * UNIT;
    const cell = UNIT;
    const side = SIZE * cell;
    const enemy = input.side === 'enemy';

    ctx.fillStyle = enemy ? 'rgb(120 20 10 / 0.16)' : 'rgb(10 60 90 / 0.14)';
    ctx.fillRect(o, o, side, side);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if ((x + y) % 2) continue;
        ctx.fillStyle = 'rgb(255 255 255 / 0.03)';
        ctx.fillRect(o + x * cell, o + y * cell, cell, cell);
      }
    }

    for (const [i, mark] of input.marks.entries()) {
      const x = o + (i % SIZE) * cell;
      const y = o + Math.floor(i / SIZE) * cell;
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      if (mark === Clear) {
        ctx.fillStyle = 'rgb(200 230 240 / 0.13)';
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
        ctx.fillStyle = 'rgb(220 240 250 / 0.45)';
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.06, 0, Math.PI * 2);
        ctx.fill();
      } else if (mark === Miss) {
        ctx.strokeStyle = 'rgb(240 250 255 / 0.55)';
        ctx.lineWidth = cell * 0.06;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (mark === Hit) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.6);
        g.addColorStop(0, 'rgb(255 120 50 / 0.55)');
        g.addColorStop(1, 'rgb(120 20 10 / 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cell, cell);
      }
    }

    if (input.shade) {
      ctx.fillStyle = input.shade.ok ? 'rgb(140 230 255 / 0.28)' : 'rgb(255 80 60 / 0.4)';
      for (const i of input.shade.cells) {
        if (i < 0) continue;
        ctx.fillRect(o + (i % SIZE) * cell + 2, o + Math.floor(i / SIZE) * cell + 2, cell - 4, cell - 4);
      }
    }

    ctx.strokeStyle = 'rgb(225 240 250 / 0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i < SIZE; i++) {
      ctx.moveTo(o + i * cell, o);
      ctx.lineTo(o + i * cell, o + side);
      ctx.moveTo(o, o + i * cell);
      ctx.lineTo(o + side, o + i * cell);
    }
    ctx.stroke();
    ctx.strokeStyle = enemy ? 'rgb(255 190 170 / 0.85)' : 'rgb(210 240 255 / 0.85)';
    ctx.lineWidth = 5;
    ctx.strokeRect(o, o, side, side);
    ctx.lineWidth = 2;
    ctx.strokeRect(o - 9, o - 9, side + 18, side + 18);

    ctx.fillStyle = 'rgb(235 245 250 / 0.85)';
    ctx.font = `700 ${Math.round(cell * 0.46)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < SIZE; i++) {
      ctx.fillText(String.fromCharCode(65 + i), o + (i + 0.5) * cell, o * 0.45);
      ctx.fillText(String(i + 1), o * 0.45, o + (i + 0.5) * cell);
    }

    for (const scan of input.scans) {
      const x0 = Math.max(0, scan.x - 1);
      const y0 = Math.max(0, scan.y - 1);
      const x1 = Math.min(SIZE - 1, scan.x + 1);
      const y1 = Math.min(SIZE - 1, scan.y + 1);
      ctx.save();
      ctx.shadowColor = 'rgb(98 240 168 / 0.9)';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = 'rgb(98 240 168 / 0.95)';
      ctx.lineWidth = 5;
      ctx.setLineDash([cell * 0.22, cell * 0.12]);
      ctx.strokeRect(o + x0 * cell + 5, o + y0 * cell + 5, (x1 - x0 + 1) * cell - 10, (y1 - y0 + 1) * cell - 10);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgb(8 40 30 / 0.75)';
      const cx = o + (scan.x + 0.5) * cell;
      const cy = o + (scan.y + 0.5) * cell;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgb(140 255 200)';
      ctx.font = `800 ${Math.round(cell * 0.56)}px system-ui, sans-serif`;
      ctx.fillText(String(scan.count), cx, cy + cell * 0.03);
      ctx.restore();
    }
    this.texture.needsUpdate = true;
  }
}
