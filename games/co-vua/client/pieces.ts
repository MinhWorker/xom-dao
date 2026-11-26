/** The chess pieces, drawn as flat Staunton silhouettes in a 100-unit box. */

interface Shape {
  /** Filled in the piece's colour and outlined. */
  body: string[];
  /** Lines drawn over the body in the outline's colour (on White) or a light one (on Black). */
  lines?: string[];
  /** Dots in the line colour: an eye, a nostril. */
  dots?: [number, number, number][];
}

const base = 'M22 90 Q20 90 20 87 L20 84 Q20 80 25 80 L75 80 Q80 80 80 84 L80 87 Q80 90 78 90 Z';

const SHAPES: Record<string, Shape> = {
  p: {
    body: [
      base,
      'M31 80 C33 68 40 62 42 55 L58 55 C60 62 67 68 69 80 Z',
      'M34 55 Q34 50 50 50 Q66 50 66 55 Q66 58 50 58 Q34 58 34 55 Z',
      'M50 22 A14 14 0 1 1 49.99 22 Z',
    ],
  },
  r: {
    body: [
      base,
      'M26 80 L26 73 L74 73 L74 80 Z',
      'M33 73 L35 42 L65 42 L67 73 Z',
      'M27 42 L27 17 L37 17 L37 24 L45 24 L45 17 L55 17 L55 24 L63 24 L63 17 L73 17 L73 42 Z',
    ],
    lines: ['M33 34 L67 34', 'M35 66 L65 66'],
  },
  n: {
    body: [
      base,
      'M28 80 C27 70 34 62 42 57 C46 54 47 52 45 50 C40 52 34 55 27 58 C23 60 18 59 16 55 C14 51 15 48 18 45 C24 39 30 31 38 25 L40 15 L47 22 L53 13 L57 24 C70 30 78 44 78 62 C78 68 77 74 76 80 Z',
    ],
    lines: ['M66 34 C71 44 72 56 70 70', 'M27 49 C31 49 34 48 37 46'],
    dots: [
      [43, 33, 3.2],
      [21, 51, 1.8],
    ],
  },
  b: {
    body: [
      base,
      'M33 80 C35 72 41 69 43 65 L57 65 C59 69 65 72 67 80 Z',
      'M35 65 Q35 60 50 60 Q65 60 65 65 Q65 68 50 68 Q35 68 35 65 Z',
      'M50 19 C63 28 69 43 61 59 L39 59 C31 43 37 28 50 19 Z',
      'M50 8 A5 5 0 1 1 49.99 8 Z',
    ],
    lines: ['M55 31 L45 45'],
  },
  q: {
    body: [
      base,
      'M27 80 L19 33 L34 57 L35 26 L44 55 L50 21 L56 55 L65 26 L66 57 L81 33 L73 80 Z',
      'M19 25.5 A4.5 4.5 0 1 1 18.99 25.5 Z',
      'M35 18.5 A4.5 4.5 0 1 1 34.99 18.5 Z',
      'M50 13.5 A4.5 4.5 0 1 1 49.99 13.5 Z',
      'M65 18.5 A4.5 4.5 0 1 1 64.99 18.5 Z',
      'M81 25.5 A4.5 4.5 0 1 1 80.99 25.5 Z',
    ],
    lines: ['M28 70 Q50 64 72 70'],
  },
  k: {
    body: [
      base,
      'M29 80 C21 68 16 54 26 46 C35 39 46 44 50 55 C54 44 65 39 74 46 C84 54 79 68 71 80 Z',
      'M50 55 C43 46 43 38 50 32 C57 38 57 46 50 55 Z',
      'M47 32 L47 22 L42 22 L42 16 L47 16 L47 10 L53 10 L53 16 L58 16 L58 22 L53 22 L53 32 Z',
    ],
    lines: ['M29 71 Q50 64 71 71'],
  },
};

const cache = new Map<string, { body: Path2D[]; lines: Path2D[] }>();
const pathsOf = (kind: string) => {
  let paths = cache.get(kind);
  if (!paths) {
    const shape = SHAPES[kind] as Shape;
    paths = {
      body: shape.body.map((d) => new Path2D(d)),
      lines: (shape.lines ?? []).map((d) => new Path2D(d)),
    };
    cache.set(kind, paths);
  }
  return paths;
};

/** Draws a piece (`PNBRQK` White, `pnbrqk` Black) filling a square of side `size` at `x, y`. */
export function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: string,
  x: number,
  y: number,
  size: number,
  alpha = 1,
) {
  const kind = piece.toLowerCase();
  const white = piece !== kind;
  const shape = SHAPES[kind];
  if (!shape || alpha <= 0) return;
  const { body, lines } = pathsOf(kind);
  const k = size / 100;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgb(0 0 0 / 0.35)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2.5;
  const fill = ctx.createLinearGradient(20, 10, 80, 90);
  if (white) {
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(1, '#ddd3c2');
  } else {
    fill.addColorStop(0, '#4a423b');
    fill.addColorStop(1, '#1d1915');
  }
  ctx.fillStyle = fill;
  ctx.strokeStyle = white ? '#2a2119' : '#0d0a08';
  ctx.lineWidth = 3.4;
  for (const p of body) ctx.fill(p);
  ctx.shadowColor = 'transparent';
  for (const p of body) ctx.stroke(p);
  ctx.strokeStyle = white ? '#2a2119' : '#cbbfae';
  ctx.lineWidth = 2.6;
  for (const p of lines) ctx.stroke(p);
  ctx.fillStyle = ctx.strokeStyle;
  for (const [cx, cy, r] of shape.dots ?? []) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
