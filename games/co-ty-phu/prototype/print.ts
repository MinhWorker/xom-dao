/**
 * The printed board: the 40 Tiles, their names, prices, Colour set bands and icons, drawn with
 * Canvas 2D into one texture. Units are board units (a side Tile is 1 wide); the board's
 * top-left corner is (0, 0) and v grows towards the camera.
 */
import { BOARD, type ColourSet, type Tile } from '../server/game/board.js';

export const TILE_W = 1;
export const CORNER = 1.6;
export const SIDE = 2 * CORNER + 9 * TILE_W;
export const BAND = 0.3;

export const SET_COLORS: Record<ColourSet, string> = {
  'than-chi': '#4b505c',
  cyan: '#21a9c4',
  'tim-lan': '#b896e0',
  'tim-violet': '#6f48c9',
  magenta: '#d43d97',
  'xam-bac': '#a4adb8',
  'tim-man': '#8c2f5c',
  'xanh-dau': '#6d9e3a',
};

const PAPER = '#f4ecd8';
const INK = '#2f261d';
const LINE = '#5b4a39';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a Tile lies on the board, and which way its inner edge (towards the centre) faces. */
export interface Placement extends Rect {
  /** Unit vector from the Tile towards the board centre; zero for corners. */
  inward: { x: number; y: number };
  corner: boolean;
}

/** Xuất phát is bottom-right; play runs clockwise (left along the bottom first). */
export const placement = (i: number): Placement => {
  const far = SIDE - CORNER;
  if (i % 10 === 0) {
    const corners = [
      [far, far],
      [0, far],
      [0, 0],
      [far, 0],
    ] as const;
    const [x, y] = corners[i / 10] as readonly [number, number];
    return { x, y, w: CORNER, h: CORNER, inward: { x: 0, y: 0 }, corner: true };
  }
  const k = i % 10;
  switch (Math.floor(i / 10)) {
    case 0:
      return {
        x: far - k * TILE_W,
        y: far,
        w: TILE_W,
        h: CORNER,
        inward: { x: 0, y: -1 },
        corner: false,
      };
    case 1:
      return {
        x: 0,
        y: far - k * TILE_W,
        w: CORNER,
        h: TILE_W,
        inward: { x: 1, y: 0 },
        corner: false,
      };
    case 2:
      return {
        x: CORNER + (k - 1) * TILE_W,
        y: 0,
        w: TILE_W,
        h: CORNER,
        inward: { x: 0, y: 1 },
        corner: false,
      };
    default:
      return {
        x: far,
        y: CORNER + (k - 1) * TILE_W,
        w: CORNER,
        h: TILE_W,
        inward: { x: -1, y: 0 },
        corner: false,
      };
  }
};

/** The Colour set band of a City, on its inner edge. */
export const bandRect = (p: Placement): Rect => {
  if (p.inward.y < 0) return { x: p.x, y: p.y, w: p.w, h: BAND };
  if (p.inward.y > 0) return { x: p.x, y: p.y + p.h - BAND, w: p.w, h: BAND };
  if (p.inward.x > 0) return { x: p.x + p.w - BAND, y: p.y, w: BAND, h: p.h };
  return { x: p.x, y: p.y, w: BAND, h: p.h };
};

const fitFont = (
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxW: number,
  size: number,
  weight = 800,
) => {
  let s = size;
  for (;;) {
    ctx.font = `${weight} ${s}px system-ui, "Segoe UI", Roboto, sans-serif`;
    if (lines.every((l) => ctx.measureText(l).width <= maxW) || s < 8) return s;
    s -= 1;
  }
};

/** Breaks a name into at most two lines when one is too wide. */
const wrap = (ctx: CanvasRenderingContext2D, name: string, maxW: number, size: number) => {
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  const words = name.split(' ');
  if (ctx.measureText(name).width <= maxW || words.length === 1) return [name];
  let bestSplit = 1;
  let bestW = Number.POSITIVE_INFINITY;
  for (let i = 1; i < words.length; i++) {
    const w = Math.max(
      ctx.measureText(words.slice(0, i).join(' ')).width,
      ctx.measureText(words.slice(i).join(' ')).width,
    );
    if (w < bestW) {
      bestW = w;
      bestSplit = i;
    }
  }
  return [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')];
};

type Icon = (ctx: CanvasRenderingContext2D, s: number) => void;

const stroke = (ctx: CanvasRenderingContext2D, s: number, color = INK) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
};

const ICONS: Partial<Record<Tile['kind'], Icon>> = {
  station: (ctx, s) => {
    ctx.fillStyle = '#5d6675';
    ctx.beginPath();
    ctx.roundRect(-s * 0.5, -s * 0.38, s, s * 0.62, s * 0.12);
    ctx.fill();
    ctx.fillStyle = '#e6eef5';
    for (const x of [-0.36, -0.06, 0.24]) ctx.fillRect(s * x, -s * 0.28, s * 0.22, s * 0.2);
    ctx.fillStyle = INK;
    for (const x of [-0.27, 0.27]) {
      ctx.beginPath();
      ctx.arc(s * x, s * 0.26, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  tax: (ctx, s) => {
    ctx.fillStyle = '#b8860b';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.font = `900 ${s * 0.6}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₫', 0, s * 0.03);
  },
  chance: (ctx, s) => {
    ctx.fillStyle = '#e2731c';
    ctx.font = `900 ${s * 1.1}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, s * 0.04);
  },
  chest: (ctx, s) => {
    ctx.fillStyle = '#2f7fbf';
    ctx.beginPath();
    ctx.roundRect(-s * 0.48, -s * 0.2, s * 0.96, s * 0.58, s * 0.06);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.2, s * 0.48, s * 0.24, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(-s * 0.08, -s * 0.12, s * 0.16, s * 0.2);
  },
};

const bolt: Icon = (ctx, s) => {
  ctx.fillStyle = '#f2b705';
  ctx.beginPath();
  ctx.moveTo(s * 0.1, -s * 0.5);
  ctx.lineTo(-s * 0.3, s * 0.06);
  ctx.lineTo(-s * 0.02, s * 0.06);
  ctx.lineTo(-s * 0.12, s * 0.5);
  ctx.lineTo(s * 0.32, -s * 0.08);
  ctx.lineTo(s * 0.04, -s * 0.08);
  ctx.closePath();
  ctx.fill();
};

const drop: Icon = (ctx, s) => {
  ctx.fillStyle = '#2b8fd6';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.5);
  ctx.bezierCurveTo(s * 0.2, -s * 0.2, s * 0.38, 0, s * 0.38, s * 0.14);
  ctx.arc(0, s * 0.14, s * 0.38, 0, Math.PI);
  ctx.bezierCurveTo(-s * 0.38, 0, -s * 0.2, -s * 0.2, 0, -s * 0.5);
  ctx.fill();
};

const bars: Icon = (ctx, s) => {
  ctx.fillStyle = '#e8a33a';
  ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
  stroke(ctx, s);
  ctx.strokeRect(-s * 0.5, -s * 0.5, s, s);
  for (const x of [-0.25, 0, 0.25]) {
    ctx.beginPath();
    ctx.moveTo(s * x, -s * 0.5);
    ctx.lineTo(s * x, s * 0.5);
    ctx.stroke();
  }
};

const plane: Icon = (ctx, s) => {
  ctx.fillStyle = '#2f7fbf';
  ctx.beginPath();
  ctx.moveTo(s * 0.55, 0);
  ctx.quadraticCurveTo(s * 0.55, -s * 0.07, s * 0.4, -s * 0.07);
  ctx.lineTo(s * 0.1, -s * 0.07);
  ctx.lineTo(-s * 0.12, -s * 0.48);
  ctx.lineTo(-s * 0.24, -s * 0.48);
  ctx.lineTo(-s * 0.1, -s * 0.07);
  ctx.lineTo(-s * 0.36, -s * 0.07);
  ctx.lineTo(-s * 0.46, -s * 0.22);
  ctx.lineTo(-s * 0.54, -s * 0.22);
  ctx.lineTo(-s * 0.48, 0);
  ctx.lineTo(-s * 0.54, s * 0.22);
  ctx.lineTo(-s * 0.46, s * 0.22);
  ctx.lineTo(-s * 0.36, s * 0.07);
  ctx.lineTo(-s * 0.1, s * 0.07);
  ctx.lineTo(-s * 0.24, s * 0.48);
  ctx.lineTo(-s * 0.12, s * 0.48);
  ctx.lineTo(s * 0.1, s * 0.07);
  ctx.lineTo(s * 0.4, s * 0.07);
  ctx.quadraticCurveTo(s * 0.55, s * 0.07, s * 0.55, 0);
  ctx.fill();
};

/** Points left: play runs left along the bottom from Xuất phát. */
const arrow: Icon = (ctx, s) => {
  ctx.fillStyle = '#c8452f';
  ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.16);
  ctx.lineTo(s * 0.1, -s * 0.16);
  ctx.lineTo(s * 0.1, -s * 0.4);
  ctx.lineTo(s * 0.6, 0);
  ctx.lineTo(s * 0.1, s * 0.4);
  ctx.lineTo(s * 0.1, s * 0.16);
  ctx.lineTo(-s * 0.55, s * 0.16);
  ctx.closePath();
  ctx.fill();
};

const whistle: Icon = (ctx, s) => {
  ctx.fillStyle = '#2e4a8f';
  ctx.beginPath();
  ctx.arc(0, -s * 0.05, s * 0.42, Math.PI, 0);
  ctx.lineTo(s * 0.42, s * 0.12);
  ctx.lineTo(-s * 0.42, s * 0.12);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(-s * 0.55, s * 0.08, s * 1.1, s * 0.14);
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.arc(0, -s * 0.18, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
};

const iconOf = (tile: Tile): Icon | undefined => {
  if (tile.kind === 'utility') return tile.name === 'Điện lực' ? bolt : drop;
  if (tile.kind === 'start') return arrow;
  if (tile.kind === 'jail') return bars;
  if (tile.kind === 'airport') return plane;
  if (tile.kind === 'go-jail') return whistle;
  return ICONS[tile.kind];
};

const priceOf = (tile: Tile) => {
  if (tile.kind === 'city') return tile.price;
  if (tile.kind === 'station') return 200;
  if (tile.kind === 'utility') return 150;
  return undefined;
};

/** Draws one Tile's face in its own text frame, centred on the origin, `w`×`h` pixels. */
const drawFace = (
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  w: number,
  h: number,
  band: { x: number; y: number } | undefined,
  px: number,
) => {
  let area = { x: -w / 2, y: -h / 2, w, h };
  if (tile.kind === 'city' && band) {
    const b = BAND * px;
    ctx.fillStyle = SET_COLORS[tile.set];
    let r: Rect;
    if (band.y < 0) r = { x: -w / 2, y: -h / 2, w, h: b };
    else if (band.y > 0) r = { x: -w / 2, y: h / 2 - b, w, h: b };
    else if (band.x > 0) r = { x: w / 2 - b, y: -h / 2, w: b, h };
    else r = { x: -w / 2, y: -h / 2, w: b, h };
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = px * 0.015;
    ctx.beginPath();
    if (band.y !== 0) {
      const y = band.y < 0 ? r.y + r.h : r.y;
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(w / 2, y);
      area = { x: -w / 2, y: band.y < 0 ? y : -h / 2, w, h: h - b };
    } else {
      const x = band.x < 0 ? r.x + r.w : r.x;
      ctx.moveTo(x, -h / 2);
      ctx.lineTo(x, h / 2);
      area = { x: band.x < 0 ? x : -w / 2, y: -h / 2, w: w - b, h };
    }
    ctx.stroke();
  }

  const pad = px * 0.08;
  const cx = area.x + area.w / 2;
  const maxW = area.w - pad * 2;
  const corner =
    tile.kind === 'start' ||
    tile.kind === 'jail' ||
    tile.kind === 'airport' ||
    tile.kind === 'go-jail';
  const icon = iconOf(tile);
  const price = priceOf(tile);
  const nameSize = corner ? px * 0.24 : px * 0.2;
  const lines = wrap(ctx, tile.name.toUpperCase(), maxW, nameSize);
  const size = fitFont(ctx, lines, maxW, nameSize);
  const lineH = size * 1.08;
  const iconS = icon ? Math.min(area.w, area.h) * (corner ? 0.5 : 0.36) : 0;
  const priceSize = px * 0.16;
  const blockH =
    lines.length * lineH + (icon ? iconS + px * 0.08 : 0) + (price ? priceSize * 1.3 : 0);
  let y = area.y + (area.h - blockH) / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `800 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += lineH;
  }
  if (icon) {
    y += px * 0.04;
    ctx.save();
    ctx.translate(cx, y + iconS / 2);
    icon(ctx, iconS);
    ctx.restore();
    y += iconS + px * 0.04;
  }
  if (price) {
    ctx.fillStyle = '#6b5a48';
    ctx.font = `700 ${priceSize}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${price}`, cx, y + priceSize * 0.2);
  }
};

const drawCentre = (ctx: CanvasRenderingContext2D, px: number) => {
  const inner = CORNER * px;
  const size = (SIDE - 2 * CORNER) * px;
  const g = ctx.createRadialGradient(
    (SIDE * px) / 2,
    (SIDE * px) / 2,
    0,
    (SIDE * px) / 2,
    (SIDE * px) / 2,
    size * 0.75,
  );
  g.addColorStop(0, '#2f8a63');
  g.addColorStop(1, '#1d6146');
  ctx.fillStyle = g;
  ctx.fillRect(inner, inner, size, size);

  ctx.save();
  ctx.translate((SIDE * px) / 2, (SIDE * px) / 2);
  ctx.strokeStyle = 'rgba(255, 236, 180, 0.35)';
  ctx.lineWidth = px * 0.03;
  ctx.strokeRect(-size / 2 + px * 0.25, -size / 2 + px * 0.25, size - px * 0.5, size - px * 0.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f6d77a';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = px * 0.1;
  ctx.shadowOffsetY = px * 0.04;
  ctx.font = `900 ${px * 1.15}px system-ui, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText('CỜ TỶ PHÚ', 0, 0);
  ctx.restore();
};

/** The whole printed board; all text reads upright from the bottom side. */
export const printBoard = (px = 336): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(SIDE * px);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCentre(ctx, px);

  BOARD.forEach((tile, i) => {
    const p = placement(i);
    ctx.fillStyle = PAPER;
    ctx.fillRect(p.x * px, p.y * px, p.w * px, p.h * px);
    ctx.save();
    ctx.translate((p.x + p.w / 2) * px, (p.y + p.h / 2) * px);
    drawFace(ctx, tile, p.w * px, p.h * px, p.corner ? undefined : p.inward, px);
    ctx.restore();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = px * 0.02;
    ctx.strokeRect(p.x * px, p.y * px, p.w * px, p.h * px);
  });
  ctx.lineWidth = px * 0.05;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.strokeRect(CORNER * px, CORNER * px, (SIDE - 2 * CORNER) * px, (SIDE - 2 * CORNER) * px);
  return canvas;
};
