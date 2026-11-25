/**
 * The printed board: the 40 Tiles, their names, prices, Colour set bands and icons, drawn with
 * Canvas 2D into one texture. Units are board units (a side Tile is 1 wide); the board's
 * top-left corner is (0, 0) and v grows towards the camera.
 */
import { BOARD, type ColourSet, type Tile } from '../server/game/board.js';
import { landPrice } from '../server/game/economy.js';
import { TUNING } from '../server/game/tuning.js';
import { CREAM, DECK_COLORS, drawSpecial, SPECIAL_COLORS } from './special.js';

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
  'xanh-dau': '#9a6233',
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

/** Draws an icon `s` pixels across, centred on the origin; `t` seconds in moves it, if it moves. */
type Icon = (ctx: CanvasRenderingContext2D, s: number, t?: number) => void;

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
};

const boltPath = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.beginPath();
  ctx.moveTo(s * 0.1, -s * 0.5);
  ctx.lineTo(-s * 0.3, s * 0.06);
  ctx.lineTo(-s * 0.02, s * 0.06);
  ctx.lineTo(-s * 0.12, s * 0.5);
  ctx.lineTo(s * 0.32, -s * 0.08);
  ctx.lineTo(s * 0.04, -s * 0.08);
  ctx.closePath();
};

/** Seconds between the bolt's flashes. */
const ZAP = 2.2;

/** Điện lực: the bolt flashes now and then, flickering, with sparks flying off it. */
const bolt: Icon = (ctx, s, t) => {
  const k = t === undefined ? 1 : (t % ZAP) / ZAP;
  const flash = t === undefined ? 0 : k < 0.18 ? Math.abs(Math.sin(k * 60)) * (1 - k / 0.18) : 0;
  ctx.save();
  if (flash > 0) {
    ctx.shadowColor = '#fff3a0';
    ctx.shadowBlur = s * 0.5 * flash;
    ctx.scale(1 + flash * 0.12, 1 + flash * 0.12);
  }
  ctx.fillStyle = flash > 0.5 ? '#fff3a0' : '#f2b705';
  boltPath(ctx, s);
  ctx.fill();
  ctx.restore();
  if (t === undefined || k > 0.35) return;
  const u = k / 0.35;
  ctx.fillStyle = '#ffd23a';
  for (const [n, a] of [-2.4, -0.6, 0.5, 2.1, 2.9].entries()) {
    const r = s * (0.3 + u * 0.35 + n * 0.02);
    ctx.globalAlpha = 1 - u;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, s * 0.045 * (1 - u * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const dropPath = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.5);
  ctx.bezierCurveTo(s * 0.2, -s * 0.2, s * 0.38, 0, s * 0.38, s * 0.14);
  ctx.arc(0, s * 0.14, s * 0.38, 0, Math.PI);
  ctx.bezierCurveTo(-s * 0.38, 0, -s * 0.2, -s * 0.2, 0, -s * 0.5);
};

/** Seconds a drip takes from the tap to its ripple fading. */
const DRIP = 2.4;

/** Cấp nước: the drop wobbles as a small drip falls from it into widening ripples. */
const drop: Icon = (ctx, s, t) => {
  const k = t === undefined ? 1 : (t % DRIP) / DRIP;
  ctx.save();
  ctx.translate(0, -s * 0.12);
  ctx.scale(0.78, 0.78);
  if (t !== undefined) ctx.scale(1 + Math.sin(t * 5) * 0.03, 1 - Math.sin(t * 5) * 0.03);
  ctx.fillStyle = '#2b8fd6';
  dropPath(ctx, s);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.14, s * 0.06, s * 0.07, s * 0.13, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (t === undefined) return;
  const tip = s * 0.29;
  const floor = s * 0.44;
  if (k < 0.45) {
    const u = k / 0.45;
    const y = tip + (floor - tip) * u * u;
    ctx.fillStyle = '#2b8fd6';
    ctx.beginPath();
    ctx.ellipse(0, y, s * 0.04, s * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const u = (k - 0.45) / 0.55;
  ctx.strokeStyle = '#2b8fd6';
  ctx.lineWidth = s * 0.035;
  for (const lag of [0, 0.3]) {
    const v = u - lag;
    if (v <= 0) continue;
    ctx.globalAlpha = 1 - v;
    ctx.beginPath();
    ctx.ellipse(0, floor, s * (0.08 + v * 0.4), s * (0.02 + v * 0.05), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

const iconOf = (tile: Tile): Icon | undefined => {
  if (tile.kind === 'utility') return tile.name === 'Điện lực' ? bolt : drop;
  return ICONS[tile.kind];
};

/** What a Tile prints under its name: its price, or for Điện lực and Cấp nước what they charge per point rolled. */
const priceOf = (i: number) =>
  BOARD[i]?.kind === 'utility' ? `${TUNING.utilityRent[0]} ×` : landPrice(TUNING, i) || undefined;

/** A flat dark die, `s` pixels across, centred on (`x`, `y`). */
function printDie(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = '#3b3026';
  ctx.beginPath();
  ctx.roundRect(x - s / 2, y - s / 2, s, s, s * 0.22);
  ctx.fill();
  ctx.fillStyle = '#f3ead8';
  for (const k of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.arc(x + k * s * 0.27, y + k * s * 0.27, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draws one Tile's face in its own text frame, centred on the origin, `w`×`h` pixels. */
const drawFace = (
  ctx: CanvasRenderingContext2D,
  i: number,
  w: number,
  h: number,
  band: { x: number; y: number } | undefined,
  px: number,
  t?: number,
  neon?: number,
  struck?: boolean,
) => {
  const tile = BOARD[i] as Tile;
  let area = { x: -w / 2, y: -h / 2, w, h };
  const special = SPECIAL_COLORS[tile.kind];
  if (special) {
    ctx.fillStyle = special;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
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
  const icon = special ? undefined : iconOf(tile);
  const hasIcon = Boolean(special || icon);
  const price = priceOf(i);
  const nameSize = corner ? px * 0.24 : px * 0.2;
  const lines = wrap(ctx, tile.name.toUpperCase(), maxW, nameSize);
  const size = fitFont(ctx, lines, maxW, nameSize);
  const lineH = size * 1.08;
  const iconS = hasIcon ? Math.min(area.w, area.h) * (corner ? 0.5 : 0.36) : 0;
  const priceSize = px * 0.16;
  const blockH =
    lines.length * lineH + (hasIcon ? iconS + px * 0.08 : 0) + (price ? priceSize * 1.3 : 0);
  let y = area.y + (area.h - blockH) / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = special ? CREAM : INK;
  ctx.font = `800 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += lineH;
  }
  if (hasIcon) {
    y += px * 0.04;
    ctx.save();
    ctx.translate(cx, y + iconS / 2);
    if (special) drawSpecial(ctx, tile.kind, iconS, CREAM, special, t, neon);
    else icon?.(ctx, iconS, t);
    ctx.restore();
    y += iconS + px * 0.04;
  }
  if (price) {
    ctx.font = `700 ${priceSize}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const label = `${price}`;
    const text = ctx.measureText(label).width;
    const die = tile.kind === 'utility' ? priceSize * 1.05 : 0;
    const gap = die ? priceSize * 0.25 : 0;
    const width = text + gap + die;
    const space = priceSize * 0.3;
    ctx.font = `900 ${priceSize * 1.3}px system-ui, "Segoe UI", Roboto, sans-serif`;
    const zero = struck ? space + ctx.measureText('0').width : 0;
    ctx.font = `700 ${priceSize}px system-ui, "Segoe UI", Roboto, sans-serif`;
    const left = cx - (width + zero) / 2;
    const top = y + priceSize * 0.2;
    ctx.fillStyle = struck ? '#a3937e' : '#6b5a48';
    ctx.fillText(label, left, top);
    if (die) printDie(ctx, left + text + gap + die / 2, top + priceSize * 0.5, die);
    if (struck) {
      ctx.strokeStyle = '#d1312a';
      ctx.lineWidth = priceSize * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(left - priceSize * 0.1, top + priceSize * 0.58);
      ctx.lineTo(left + width + priceSize * 0.1, top + priceSize * 0.42);
      ctx.stroke();
      ctx.fillStyle = '#2f9e44';
      ctx.font = `900 ${priceSize * 1.3}px system-ui, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText('0', left + width + space, top - priceSize * 0.06);
    }
  }
};

const drawCentre = (ctx: CanvasRenderingContext2D, px: number, title: boolean) => {
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
  if (title) ctx.fillText('CỜ TỶ PHÚ', 0, 0);
  ctx.restore();
};

/**
 * Paints Tile `i` with its top-left corner at the origin; `t` sets its icon moving, if it moves,
 * `neon` (0 to 1) lights its outline, and `struck` crosses its price out for a 0 (Miễn thuê).
 */
export const paintTile = (
  ctx: CanvasRenderingContext2D,
  i: number,
  px: number,
  t?: number,
  neon?: number,
  struck?: boolean,
) => {
  const p = placement(i);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, p.w * px, p.h * px);
  ctx.save();
  ctx.translate((p.w / 2) * px, (p.h / 2) * px);
  drawFace(ctx, i, p.w * px, p.h * px, p.corner ? undefined : p.inward, px, t, neon, struck);
  ctx.restore();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = px * 0.02;
  ctx.strokeRect(0, 0, p.w * px, p.h * px);
};

/**
 * The whole printed board; all text reads upright from the bottom side. Without `title` the
 * middle stays clear for what the client prints there in a Match.
 */
export const printBoard = (px = 336, title = true): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(SIDE * px);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCentre(ctx, px, title);

  BOARD.forEach((_, i) => {
    const p = placement(i);
    ctx.save();
    ctx.translate(p.x * px, p.y * px);
    paintTile(ctx, i, px);
    ctx.restore();
  });
  frame(ctx, px);
  return canvas;
};

/** The board's thick outer and inner edges. */
const frame = (ctx: CanvasRenderingContext2D, px: number) => {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = px * 0.05;
  ctx.strokeRect(0, 0, SIDE * px, SIDE * px);
  ctx.strokeRect(CORNER * px, CORNER * px, (SIDE - 2 * CORNER) * px, (SIDE - 2 * CORNER) * px);
};

/** Paints `tiles` again on a board `printBoard` drew at `px`, those in `struck` crossed out. */
export const reprint = (
  canvas: HTMLCanvasElement,
  tiles: Iterable<number>,
  struck: ReadonlySet<number>,
  px = 336,
) => {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  for (const i of tiles) {
    const p = placement(i);
    ctx.save();
    ctx.translate(p.x * px, p.y * px);
    paintTile(ctx, i, px, undefined, 0, struck.has(i));
    ctx.restore();
  }
  frame(ctx, px);
};

/** The back of a Cơ hội or Khí vận card: the deck colour with its icon repeated small. */
export const cardBack = (
  deck: keyof typeof DECK_COLORS,
  width = 600,
  height = 400,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = DECK_COLORS[deck];
  ctx.fillRect(0, 0, width, height);
  const step = 92;
  const edge = () => {
    ctx.beginPath();
    ctx.roundRect(28, 28, width - 56, height - 56, 18);
  };
  ctx.save();
  edge();
  ctx.clip();
  for (let row = 0; row * step < height + step; row++) {
    for (let col = 0; col * step < width + step; col++) {
      ctx.save();
      ctx.translate(col * step + (row % 2 ? step / 2 : 0), row * step);
      ctx.rotate(row % 2 ? -0.25 : 0.25);
      drawSpecial(ctx, deck, 52, 'rgba(255, 246, 225, 0.32)', DECK_COLORS[deck]);
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 8;
  edge();
  ctx.stroke();
  return canvas;
};
