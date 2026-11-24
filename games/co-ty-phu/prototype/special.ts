/**
 * The Tiles that cannot be owned: their colours and their icons, which loop a small movement
 * on the Tile's face after what the Tile means. Without a time the icon is drawn at rest, as
 * printed on the board.
 */
import type { Tile } from '../server/game/board.js';

/** The colour of each deck: its Tiles and its card back. */
export const DECK_COLORS = { chance: '#e2731c', chest: '#138a84' } as const;

/** Each special Tile is filled with its own colour, none of them a seat colour. */
export const SPECIAL_COLORS: Partial<Record<Tile['kind'], string>> = {
  start: '#9e2b3a',
  jail: '#5a4632',
  airport: '#4b5266',
  'go-jail': '#3c424c',
  chance: DECK_COLORS.chance,
  chest: DECK_COLORS.chest,
  tax: '#a07a12',
};

/** What special Tiles print in. */
export const CREAM = '#fff6e1';
const SPARK = '#ffe9a6';

/** Draws an icon `s` pixels across, centred on the origin, in `ink` over `bg`, `t` seconds in. */
type Special = (
  ctx: CanvasRenderingContext2D,
  s: number,
  ink: string,
  bg: string,
  t?: number,
) => void;

type Point = readonly [number, number];

const segmentLengths = (pts: readonly Point[]) =>
  pts.slice(1).map((b, i) => {
    const a = pts[i] as Point;
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  });

/** The point `u` (0–1) of the way along a polyline. */
const along = (pts: readonly Point[], u: number): Point => {
  const lengths = segmentLengths(pts);
  let left = u * lengths.reduce((a, b) => a + b, 0);
  for (const [i, l] of lengths.entries()) {
    const a = pts[i] as Point;
    const b = pts[i + 1] as Point;
    if (left <= l) return [a[0] + ((b[0] - a[0]) * left) / l, a[1] + ((b[1] - a[1]) * left) / l];
    left -= l;
  }
  return pts[pts.length - 1] as Point;
};

/** The part of a polyline from its start to `u` of the way. */
const upTo = (pts: readonly Point[], u: number): Point[] => {
  const out: Point[] = [pts[0] as Point];
  const lengths = segmentLengths(pts);
  let left = u * lengths.reduce((a, b) => a + b, 0);
  for (const [i, l] of lengths.entries()) {
    if (left >= l) {
      out.push(pts[i + 1] as Point);
      left -= l;
    } else {
      out.push(along([pts[i] as Point, pts[i + 1] as Point], left / l));
      break;
    }
  }
  return out;
};

const glowDot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha = 1) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = SPARK;
  ctx.shadowColor = SPARK;
  ctx.shadowBlur = r * 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.save();
  ctx.fillStyle = SPARK;
  ctx.shadowColor = SPARK;
  ctx.shadowBlur = r * 2;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const d = k % 2 ? r * 0.22 : r;
    const a = (k * Math.PI) / 4 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.fill();
  ctx.restore();
};

const line = (ctx: CanvasRenderingContext2D, pts: readonly Point[], s: number) => {
  ctx.beginPath();
  for (const [x, y] of pts) ctx.lineTo(x * s, y * s);
};

/** The arrow points left, the way play runs; two lights run from its tip round to its tail. */
const start: Special = (ctx, s, ink, _bg, t) => {
  const top: Point[] = [
    [-0.6, 0],
    [-0.1, -0.4],
    [-0.1, -0.16],
    [0.55, -0.16],
  ];
  const bottom = top.map(([x, y]) => [x, -y] as const);
  ctx.fillStyle = ink;
  line(ctx, [...top, ...bottom.slice().reverse()], s);
  ctx.closePath();
  ctx.fill();
  if (t === undefined) return;
  const u = (t * 0.55) % 1;
  for (const edge of [top, bottom]) {
    for (let k = 5; k >= 0; k--) {
      const back = u - k * 0.025;
      if (back < 0) continue;
      const [x, y] = along(edge, back);
      glowDot(ctx, x * s, y * s, s * (0.075 - k * 0.008), 1 - k / 6);
    }
  }
};

const PLANE: Point[] = [
  [0.55, 0],
  [0.4, -0.07],
  [0.1, -0.07],
  [-0.12, -0.48],
  [-0.24, -0.48],
  [-0.1, -0.07],
  [-0.36, -0.07],
  [-0.46, -0.22],
  [-0.54, -0.22],
  [-0.48, 0],
];

/** The plane bobs on its course, drawing a trail from each wingtip. */
const airport: Special = (ctx, s, ink, _bg, t) => {
  const bob = t === undefined ? 0 : Math.sin(t * 2) * 0.035;
  if (t !== undefined) {
    for (const side of [-1, 1]) {
      const y = (side * 0.47 + bob) * s;
      const trail = ctx.createLinearGradient(-0.18 * s, 0, -0.98 * s, 0);
      trail.addColorStop(0, 'rgba(255, 246, 225, 1)');
      trail.addColorStop(1, 'rgba(255, 246, 225, 0)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = 'round';
      ctx.setLineDash([s * 0.16, s * 0.08]);
      ctx.lineDashOffset = t * s * 1.2;
      ctx.beginPath();
      ctx.moveTo(-0.2 * s, y);
      ctx.lineTo(-0.98 * s, y + side * Math.sin(t * 2 - 1) * 0.02 * s);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.save();
  ctx.translate(0, bob * s);
  ctx.fillStyle = ink;
  line(
    ctx,
    [
      ...PLANE,
      ...PLANE.slice(1)
        .reverse()
        .map(([x, y]) => [x, -y] as const),
    ],
    s,
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/** The question mark sways side to side and hops on the Tile. */
const chance: Special = (ctx, s, ink, _bg, t) => {
  ctx.save();
  if (t !== undefined) {
    ctx.translate(Math.sin(t * 1.7) * 0.22 * s, (0.06 - Math.abs(Math.sin(t * 3.4)) * 0.2) * s);
    ctx.rotate(Math.sin(t * 1.7) * 0.25);
  }
  ctx.fillStyle = ink;
  ctx.font = `900 ${s * 1.1}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, s * 0.04);
  ctx.restore();
};

/** The chest's lid lifts now and then, letting out sparkles. */
const chest: Special = (ctx, s, ink, bg, t) => {
  const open = t === undefined ? 0 : Math.max(0, Math.sin(t * 1.4)) ** 0.6;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.roundRect(-s * 0.48, -s * 0.2, s * 0.96, s * 0.58, s * 0.06);
  ctx.fill();
  ctx.save();
  ctx.translate(s * 0.48, -s * 0.2);
  ctx.rotate(open * 0.7);
  ctx.beginPath();
  ctx.ellipse(-s * 0.48, 0, s * 0.48, s * 0.24, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = bg;
  ctx.fillRect(-s * 0.08, -s * 0.12, s * 0.16, s * 0.2);
  if (t === undefined || open < 0.15) return;
  for (const [k, [x, y]] of (
    [
      [-0.42, -0.5],
      [-0.12, -0.78],
      [0.2, -0.62],
      [0.48, -0.86],
      [-0.5, -0.86],
    ] as const
  ).entries()) {
    star(ctx, x * s, y * s, s * 0.2 * open * (0.6 + 0.4 * Math.sin(t * 9 + k * 2)));
  }
};

const CHART: Point[] = [
  [-0.32, 0.24],
  [-0.12, 0.02],
  [0.06, 0.12],
  [0.36, -0.3],
];
const CHART_LOOP = 3.2;
const CHART_DRAW = 1.6;

/** A chart that climbs, for the value Thuế adds; it draws itself, holds, then starts over. */
const tax: Special = (ctx, s, ink, _bg, t) => {
  const local = t === undefined ? CHART_DRAW : t % CHART_LOOP;
  const u = Math.min(1, local / CHART_DRAW);
  const fadeOut = Math.min(1, (CHART_LOOP - local) / 0.4);
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.07;
  line(
    ctx,
    [
      [-0.46, -0.44],
      [-0.46, 0.4],
      [0.48, 0.4],
    ],
    s,
  );
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = fadeOut;
  ctx.lineWidth = s * 0.09;
  line(ctx, upTo(CHART, u), s);
  ctx.stroke();
  if (u >= 1) {
    const [ax, ay] = CHART[CHART.length - 1] as Point;
    const [bx, by] = CHART[CHART.length - 2] as Point;
    const a = Math.atan2(ay - by, ax - bx);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo((ax + Math.cos(a) * 0.08) * s, (ay + Math.sin(a) * 0.08) * s);
    ctx.lineTo((ax + Math.cos(a + 2.4) * 0.16) * s, (ay + Math.sin(a + 2.4) * 0.16) * s);
    ctx.lineTo((ax + Math.cos(a - 2.4) * 0.16) * s, (ay + Math.sin(a - 2.4) * 0.16) * s);
    ctx.fill();
  } else if (t !== undefined) {
    const [x, y] = along(CHART, u);
    glowDot(ctx, x * s, y * s, s * 0.09);
  }
  ctx.restore();
};

const BARS: Point[][] = [
  [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
    [-0.5, -0.5],
  ],
  ...[-0.25, 0, 0.25].map((x): Point[] => [
    [x, -0.5],
    [x, 0.5],
  ]),
];

/** A glint of light runs across the bars. */
const jail: Special = (ctx, s, ink, _bg, t) => {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.09;
  const passes: (string | CanvasGradient)[] = [ink];
  if (t !== undefined) {
    const at = ((t * 0.45) % 1.5) - 0.25;
    const glint = ctx.createLinearGradient(-0.6 * s, -0.6 * s, 0.6 * s, 0.6 * s);
    for (const [offset, alpha] of [
      [at - 0.12, 0],
      [at, 1],
      [at + 0.12, 0],
    ] as const) {
      if (offset >= 0 && offset <= 1) glint.addColorStop(offset, `rgba(255, 211, 107, ${alpha})`);
    }
    passes.push(glint);
  }
  for (const pass of passes) {
    ctx.strokeStyle = pass;
    for (const bar of BARS) {
      line(ctx, bar, s);
      ctx.stroke();
    }
  }
};

/** The cuffs swing from their chain. */
const goJail: Special = (ctx, s, ink, _bg, t) => {
  const swing = t === undefined ? 0 : Math.sin(t * 2.6) * 0.38;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.1;
  for (const x of [-0.1, 0.1]) {
    ctx.beginPath();
    ctx.ellipse(s * x, -s * 0.2, s * 0.08, s * 0.045, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 0.16 * s, -0.2 * s);
    ctx.rotate(side * swing);
    ctx.beginPath();
    ctx.arc(side * 0.11 * s, 0.26 * s, s * 0.21, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
};

const SPECIALS: Partial<Record<Tile['kind'], Special>> = {
  start,
  airport,
  chance,
  chest,
  tax,
  jail,
  'go-jail': goJail,
};

export const isSpecial = (kind: Tile['kind']) => kind in SPECIALS;

/** Draws a special Tile's icon; see `Special`. */
export const drawSpecial = (
  ctx: CanvasRenderingContext2D,
  kind: Tile['kind'],
  s: number,
  ink: string,
  bg: string,
  t?: number,
) => {
  ctx.save();
  SPECIALS[kind]?.(ctx, s, ink, bg, t);
  ctx.restore();
};
