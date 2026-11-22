// Draws splash art (2560×1152, 20:9) in code, in the Game's own colours:
//   node scripts/splash.mjs [caro|tien-len|islands]     (no argument: all of them)
// Caro and Tiến Lên are drawn to match their clients (`games/caro/client/render.ts`,
// `games/tien-len/godot/style.gd`). The Islands' art is a placeholder: the Island's Emblem on a
// tinted backdrop, until the Games of that Island have a look of their own. Đặt Bom's
// `hub/key-art.png` is not made here.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const W = 2560;
const H = 1152;

const FOCUS = { caro: [70, 50], 'tien-len': [68, 50], island: [70, 50] };

const px = (percent, whole) => (whole * percent) / 100;

/** The frame every splash shares: a base, a glow behind the subject, and a calm dark left 40%. */
function backdrop({ top, bottom, glow, focus, glowAlpha = 0.5 }) {
  const [fx, fy] = focus;
  return `
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="${fx}%" cy="${fy - 4}%" r="48%" gradientTransform="translate(${(fx / 100) * (1 - 1.4)} 0) scale(1.4 1)">
      <stop offset="0" stop-color="${glow}" stop-opacity="${glowAlpha}"/>
      <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="left" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0b1018"/>
      <stop offset="0.28" stop-color="#0d131c" stop-opacity="0.96"/>
      <stop offset="0.36" stop-color="#14202b" stop-opacity="0.5"/>
      <stop offset="0.42" stop-color="#14202b" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.45"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>`;
}

const frame = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <rect width="${W}" height="${H}" fill="url(#left)"/>
</svg>`;

const INK = { X: '#b3372c', O: '#2c4f8a' };

function caro() {
  const cell = 100;
  const cols = 11;
  const rows = 9;
  const w = cols * cell;
  const h = rows * cell;
  const X = [
    [3, 1],
    [4, 2],
    [5, 3],
    [6, 4],
    [7, 5],
  ];
  const O = [
    [2, 0],
    [8, 6],
    [5, 2],
    [7, 3],
  ];
  const [fx, fy] = FOCUS.caro;

  const yaw = (14 * Math.PI) / 180;
  const pitch = (44 * Math.PI) / 180;
  const away = 2300;
  const height = away * Math.tan(pitch);
  const focal = (1.02 * away) / Math.cos(pitch);
  /** A point of the sheet (in its own units, origin at the corner) seen by a camera above and in front of it. */
  const project = (x, y) => {
    const u = x - w / 2;
    const depth = h / 2 - y;
    const px3 = u * Math.cos(yaw) - depth * Math.sin(yaw);
    const pz3 = u * Math.sin(yaw) + depth * Math.cos(yaw);
    const zc = height * Math.sin(pitch) + (pz3 + away) * Math.cos(pitch);
    const yc = -height * Math.cos(pitch) + (pz3 + away) * Math.sin(pitch);
    const k = focal / zc;
    return { x: px(fx, W) + px3 * k, y: px(fy, H) - yc * k, k };
  };
  const pt = (x, y) => {
    const p = project(x, y);
    return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  };
  const poly = (corners, attrs) =>
    `<polygon points="${corners.map(([x, y]) => pt(x, y)).join(' ')}" ${attrs}/>`;
  const rect = (x0, y0, x1, y1, attrs) =>
    poly(
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
      attrs,
    );

  const centre = ([c, r]) => [(c + 0.5) * cell, (r + 0.5) * cell];
  const jitter = (c, r, k) => Math.sin(c * 12.9898 + r * 78.233 + k * 3.7) * 3.5;
  const widthAt = (x, y, scale) => cell * scale * project(x, y).k;

  const stroke = (d, color, width) => `
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${width * 1.9}" stroke-linecap="round" stroke-linejoin="round" opacity="0.18"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const markX = (p) => {
    const [cx, cy] = centre(p);
    const r = cell * 0.3;
    const j = (k) => jitter(p[0], p[1], k);
    return stroke(
      `M${pt(cx - r + j(1), cy - r + j(2))}L${pt(cx + r + j(3), cy + r + j(4))}M${pt(cx + r + j(5), cy - r + j(6))}L${pt(cx - r + j(7), cy + r + j(8))}`,
      INK.X,
      widthAt(cx, cy, 0.11),
    );
  };
  const markO = (p) => {
    const [cx, cy] = centre(p);
    const r = cell * 0.3;
    const lean = jitter(p[0], p[1], 9) / 10;
    const steps = 56;
    const ring = Array.from({ length: steps }, (_, i) => {
      const a = -Math.PI / 2 - 0.3 + (2 * Math.PI * i) / steps;
      const x = cx + r * 1.02 * Math.cos(a) - r * 0.96 * lean * Math.sin(a);
      const y = cy + r * 0.96 * Math.sin(a);
      return `${i ? 'L' : 'M'}${pt(x, y)}`;
    });
    return stroke(`${ring.join('')}Z`, INK.O, widthAt(cx, cy, 0.11));
  };

  const wash = X.map(([c, r]) =>
    rect(
      c * cell + 1,
      r * cell + 1,
      (c + 1) * cell,
      (r + 1) * cell,
      'fill="rgb(179 55 44 / 0.13)"',
    ),
  ).join('');

  const grid = [
    ...Array.from({ length: cols + 1 }, (_, c) => `M${pt(c * cell, 0)}L${pt(c * cell, h)}`),
    ...Array.from({ length: rows + 1 }, (_, r) => `M${pt(0, r * cell)}L${pt(w, r * cell)}`),
  ].join('');

  const [x1, y1] = centre(X[0]);
  const [x2, y2] = centre(X[4]);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const dx = ((x2 - x1) / len) * cell * 0.45;
  const dy = ((y2 - y1) / len) * cell * 0.45;
  const strike = `M${pt(x1 - dx, y1 - dy)}L${pt(x2 + dx, y2 + dy)}`;
  const [gx0, gy0] = pt(-5, -5).split(' ');
  const [gx1, gy1] = pt(w + 5, h + 5).split(' ');

  const sheet = `
    ${rect(-3 + 14, -1 + 26, w + 6 + 14, h + 8 + 26, 'fill="#000" opacity="0.55" filter="url(#blur)"')}
    ${rect(-3, -1, w + 6, h + 8, 'fill="#cbbd9c"')}
    ${rect(-4, -3, w + 6, h + 6, 'fill="#ddd0b2"')}
    ${rect(-5, -5, w + 5, h + 5, 'fill="url(#paper)" stroke="#cdbf9f"')}
    ${wash}
    <path d="${grid}" stroke="rgb(59 53 44 / 0.24)" stroke-width="1.5" fill="none"/>
    ${O.map(markO).join('')}${X.map(markX).join('')}
    <path d="${strike}" stroke="${INK.X}" stroke-width="${widthAt(x1, y1, 0.14)}" stroke-linecap="round" opacity="0.85" fill="none"/>`;

  return frame(`${backdrop({
    top: '#3c2b1f',
    bottom: '#2a1e16',
    glow: '#6a4d36',
    focus: FOCUS.caro,
    glowAlpha: 0.7,
  })}
  <defs>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter>
    <linearGradient id="paper" gradientUnits="userSpaceOnUse" x1="${gx0}" y1="${gy0}" x2="${gx1}" y2="${gy1}">
      <stop offset="0" stop-color="#f7f0de"/><stop offset="1" stop-color="#e6d9bc"/>
    </linearGradient>
  </defs>${sheet}`);
}

const T = {
  felt: '#164238',
  feltDark: '#08130f',
  brass: '#d6b25e',
  brassDark: '#7d6027',
  ivory: '#f5edd9',
  ivoryEdge: '#c9bb97',
  ink: '#1c1e24',
  red: '#b3262e',
  back: '#7b1e2c',
  backLine: '#d9b46a',
};

function suit(kind, extent, color) {
  const u = extent / 2;
  const heart = `<path d="M0 ${0.98 * u}C${-1.15 * u} ${0.1 * u} ${-1.05 * u} ${-0.8 * u} ${-0.5 * u} ${-0.8 * u}C${-0.2 * u} ${-0.8 * u} 0 ${-0.55 * u} 0 ${-0.4 * u}C0 ${-0.55 * u} ${0.2 * u} ${-0.8 * u} ${0.5 * u} ${-0.8 * u}C${1.05 * u} ${-0.8 * u} ${1.15 * u} ${0.1 * u} 0 ${0.98 * u}Z"/>`;
  const shapes = {
    heart,
    diamond: `<path d="M0 ${-u}L${0.72 * u} 0L0 ${u}L${-0.72 * u} 0Z"/>`,
    spade: `<path d="M0 ${-u}C${0.2 * u} ${-0.5 * u} ${1.05 * u} ${-0.2 * u} ${1.05 * u} ${0.3 * u}C${1.05 * u} ${0.75 * u} ${0.35 * u} ${0.85 * u} ${0.08 * u} ${0.45 * u}L${0.3 * u} ${u}L${-0.3 * u} ${u}L${-0.08 * u} ${0.45 * u}C${-0.35 * u} ${0.85 * u} ${-1.05 * u} ${0.75 * u} ${-1.05 * u} ${0.3 * u}C${-1.05 * u} ${-0.2 * u} ${-0.2 * u} ${-0.5 * u} 0 ${-u}Z"/>`,
    club: `<circle cx="0" cy="${-0.46 * u}" r="${0.4 * u}"/><circle cx="${-0.48 * u}" cy="${0.2 * u}" r="${0.4 * u}"/><circle cx="${0.48 * u}" cy="${0.2 * u}" r="${0.4 * u}"/><path d="M${-0.09 * u} 0L${0.09 * u} 0L${0.36 * u} ${0.98 * u}L${-0.36 * u} ${0.98 * u}Z"/>`,
  };
  return `<g fill="${color}">${shapes[kind]}</g>`;
}

const label = (text, x, y, size, color) =>
  `<text x="${x}" y="${y}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-weight="700" font-size="${size}" fill="${color}" text-anchor="middle" dominant-baseline="central">${text}</text>`;

const cardBase = () =>
  `<rect x="-36" y="-50.5" width="72" height="101" rx="8" fill="${T.ivory}" stroke="${T.ivoryEdge}" stroke-width="1.5" filter="url(#lift)"/>`;

/** A face-up card of the game's 72×101, centred on (0, 0). */
function face(rank, kind) {
  const color = kind === 'heart' || kind === 'diamond' ? T.red : T.ink;
  const [l, t] = [-36, -50.5];
  return `
  ${cardBase()}
  ${label(rank, l + 15, t + 21, rank.length === 1 ? 24 : 20, color)}
  <g transform="translate(${l + 15} ${t + 41})">${suit(kind, 15, color)}</g>
  <g transform="translate(${9} ${10})">${suit(kind, 40, color)}</g>
  <g transform="translate(${l + 72 - 11} ${t + 101 - 11})">${suit(kind, 9, color)}</g>`;
}

/** A face-down card: a maroon field with a brass lattice and a brass diamond. */
function back() {
  const [l, t, w, h] = [-36, -50.5, 72, 101];
  const f = { x: l + 5, y: t + 5, w: w - 10, h: h - 10 };
  const lines = [];
  for (let o = 0; o < f.w + f.h; o += 11) {
    lines.push(
      `M${f.x + o} ${f.y}L${f.x + o - f.h} ${f.y + f.h}`,
      `M${f.x + f.w - o} ${f.y}L${f.x + f.w - o + f.h} ${f.y + f.h}`,
    );
  }
  return `
  ${cardBase()}
  <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="5" fill="${T.back}"/>
  <path d="${lines.join('')}" stroke="${T.backLine}" stroke-opacity="0.55" stroke-width="1" clip-path="url(#field)"/>
  <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="5" fill="none" stroke="${T.backLine}" stroke-opacity="0.9" stroke-width="1.5"/>
  <path d="M0 -16L12 0L0 16L-12 0Z" fill="${T.brass}"/><path d="M0 -9L6 0L0 9L-6 0Z" fill="${T.back}"/>`;
}

function tienLen() {
  const [fx, fy] = FOCUS['tien-len'];
  const hand = [
    ['6', 'club'],
    ['7', 'diamond'],
    ['8', 'spade'],
    ['9', 'heart'],
    ['10', 'club'],
  ];
  const s = 3.2;
  const radius = 520;
  const cards = hand
    .map(([rank, kind], i) => {
      const angle = (i - 2) * 13;
      return `<g transform="translate(${px(fx, W)} ${px(fy, H) + radius - 60}) rotate(${angle}) translate(0 ${-radius}) scale(${s})">${face(rank, kind)}</g>`;
    })
    .join('');
  const deck = [0, 1, 2]
    .map(
      (i) =>
        `<g transform="translate(${2290 - i * 4} ${850 - i * 5}) rotate(${9 - i * 2}) scale(${s * 0.8})">${back()}</g>`,
    )
    .join('');
  const [cx, cy] = [px(fx, W), px(fy, H)];
  return frame(`${backdrop({ top: T.feltDark, bottom: T.feltDark, glow: '#235a4b', focus: FOCUS['tien-len'], glowAlpha: 0.95 })}
  <defs>
    <filter id="lift" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/></filter>
    <clipPath id="field"><rect x="-31" y="-45.5" width="62" height="91" rx="5"/></clipPath>
  </defs>
  <rect x="${W * 0.14}" y="40" width="${W * 0.86 - 40}" height="${H - 80}" rx="30" fill="none" stroke="${T.brassDark}" stroke-opacity="0.55" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${H * 0.27}" fill="none" stroke="${T.brass}" stroke-opacity="0.12" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="${H * 0.27 + 9}" fill="none" stroke="${T.brass}" stroke-opacity="0.07" stroke-width="2"/>
  <g>${deck}${cards}</g>`);
}

const ISLANDS = { co: 196, bai: 352, 'xuc-xac': 150, 'nao-nhiet': 24 };

function hsl(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const hash = (a, b, k) => {
  const v = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

const dot = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;

const PIPS = {
  1: [[0, 0]],
  2: [
    [-17, -17],
    [17, 17],
  ],
  3: [
    [-17, -17],
    [0, 0],
    [17, 17],
  ],
  4: [
    [-17, -17],
    [17, -17],
    [-17, 17],
    [17, 17],
  ],
  5: [
    [-17, -17],
    [17, -17],
    [0, 0],
    [-17, 17],
    [17, 17],
  ],
  6: [
    [-17, -19],
    [17, -19],
    [-17, 0],
    [17, 0],
    [-17, 19],
    [17, 19],
  ],
};
const die = (n) =>
  `<rect x="-34" y="-34" width="68" height="68" rx="10" fill="#f3ecd9" stroke="#c9bb97" stroke-width="2.5"/>${PIPS[
    n
  ]
    .map(([x, y]) => dot(x, y, n === 1 ? 10 : 6.5, n === 1 ? T.red : T.ink))
    .join('')}`;
const pawn = (color) =>
  `<path d="M-22 30L-9 -4L9 -4L22 30Z" fill="${color}"/>${dot(0, -17, 14, color)}<ellipse cx="0" cy="31" rx="26" ry="6" fill="${color}" opacity="0.8"/>`;
const stone = (fill, edge) =>
  `${dot(0, 0, 34, fill)}<circle r="34" fill="none" stroke="${edge}" stroke-width="2"/><ellipse cx="-11" cy="-13" rx="12" ry="7" fill="#fff" opacity="0.28" transform="rotate(-35 -11 -13)"/>`;
const starPoints = (n, outer, inner) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 ? inner : outer;
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

/** What each Island's pattern is made of, centred on (0, 0) in a box about 70 across. */
const MOTIFS = {
  co: [
    () =>
      `<path d="M-28-28L28 28M28-28L-28 28" stroke="${INK.X}" stroke-width="11" stroke-linecap="round"/>`,
    () => `<ellipse rx="30" ry="28" fill="none" stroke="${INK.O}" stroke-width="11"/>`,
    () => stone('#1b1d22', '#000'),
    () => stone('#ece6d6', '#b9b09a'),
    () =>
      `${dot(0, 0, 36, '#8f2a22')}<circle r="28" fill="none" stroke="#e8c27a" stroke-width="3"/><circle r="17" fill="none" stroke="#e8c27a" stroke-width="2"/>`,
    () =>
      `<path d="M-26 32V22H-20L-17-8H-24V-30H-14V-20H-5V-30H5V-20H14V-30H24V-8H17L20 22H26V32Z" fill="#e9dfc6" stroke="#bca97d" stroke-width="2.5" stroke-linejoin="round"/>`,
    () =>
      `${dot(0, 0, 34, '#c43d2f')}<circle r="24" fill="none" stroke="#e86a58" stroke-width="3"/><circle r="14" fill="none" stroke="#e86a58" stroke-width="3"/>`,
  ],
  bai: [
    () => suit('heart', 62, T.red),
    () => suit('spade', 62, '#d9d4c6'),
    () => suit('diamond', 62, T.red),
    () => suit('club', 62, '#d9d4c6'),
    () =>
      `<rect x="-26" y="-37" width="52" height="74" rx="7" fill="${T.ivory}" stroke="${T.ivoryEdge}" stroke-width="2"/><rect x="-21" y="-32" width="42" height="64" rx="4" fill="${T.back}"/><path d="M0-14L10 0L0 14L-10 0Z" fill="${T.brass}"/>`,
    () =>
      `<rect x="-26" y="-37" width="52" height="74" rx="7" fill="${T.ivory}" stroke="${T.ivoryEdge}" stroke-width="2"/><g transform="translate(0 4)">${suit('heart', 32, T.red)}</g><g transform="translate(-14 -22)">${suit('heart', 10, T.red)}</g>`,
    () =>
      `<rect x="-26" y="-37" width="52" height="74" rx="7" fill="${T.ivory}" stroke="${T.ivoryEdge}" stroke-width="2"/><g transform="translate(0 4)">${suit('spade', 32, T.ink)}</g><g transform="translate(-14 -22)">${suit('spade', 10, T.ink)}</g>`,
  ],
  'xuc-xac': [
    () => die(1),
    () => die(2),
    () => die(3),
    () => die(4),
    () => die(5),
    () => die(6),
    () => pawn('#d9503c'),
    () => pawn('#3f7fd0'),
    () => pawn('#3fa066'),
    () => pawn('#e0b43a'),
  ],
  'nao-nhiet': [
    () =>
      `${dot(0, 4, 30, '#23252e')}<ellipse cx="-10" cy="-8" rx="9" ry="6" fill="#fff" opacity="0.18"/><path d="M8-24Q14-36 26-38" stroke="#8a6a43" stroke-width="5" fill="none" stroke-linecap="round"/>${dot(27, -38, 12, '#ff8a2a').replace('/>', ' opacity="0.45"/>')}${dot(27, -38, 6, '#ffb347')}`,
    () =>
      `<polygon points="${starPoints(5, 38, 17)}" fill="#e8a33d" stroke="#8a4f1b" stroke-width="3" stroke-linejoin="round"/><polygon points="${starPoints(5, 20, 9)}" fill="#ffd479"/>`,
    () =>
      `<rect x="-30" y="-30" width="60" height="60" fill="#a8743f" stroke="#80532c" stroke-width="4"/><path d="M-30-30L30 30M30-30L-30 30" stroke="#80532c" stroke-width="4"/>`,
    () => `<polygon points="${starPoints(4, 30, 7)}" fill="#ffd479"/>`,
    () =>
      `<rect x="-11" y="-34" width="22" height="68" rx="5" fill="#c43d2f" stroke="#7d2018" stroke-width="2.5"/><path d="M-11-14H11M-11 6H11" stroke="#f0c46a" stroke-width="3"/><path d="M0-34Q4-44 12-46" stroke="#8a6a43" stroke-width="3" fill="none"/>`,
  ],
};

/** An Island's splash: a wallpaper of its genre's objects, fading into the dark left side. */
function island(id) {
  const hue = ISLANDS[id];
  const motifs = MOTIFS[id];
  const stepX = 190;
  const stepY = 150;
  const items = [];
  for (let row = -1; row * stepY < H + stepY; row++) {
    for (let col = -1; col * stepX < W + stepX; col++) {
      const x = col * stepX + (row % 2 ? stepX / 2 : 0) + (hash(row, col, 1) - 0.5) * 70;
      const y = row * stepY + (hash(row, col, 2) - 0.5) * 50;
      const fade = Math.min(1, Math.max(0, (x - W * 0.34) / (W * 0.2)));
      if (fade === 0) continue;
      const pick = Math.floor(hash(row, col, 3) * motifs.length);
      const turn = (hash(row, col, 4) - 0.5) * 70;
      const size = 0.85 + hash(row, col, 5) * 0.55;
      items.push(
        `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${turn.toFixed(0)}) scale(${size.toFixed(2)})" opacity="${(0.82 * fade).toFixed(2)}">${motifs[pick]()}</g>`,
      );
    }
  }
  return frame(`${backdrop({ top: hsl(hue, 34, 17), bottom: hsl(hue, 34, 9), glow: hsl(hue, 45, 30), focus: FOCUS.island, glowAlpha: 0.6 })}
  <g filter="url(#sink)">${items.join('')}</g>
  <defs><filter id="sink" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity="0.45"/></filter></defs>`);
}

const jobs = {
  caro: () => ['games/caro/hub/key-art.png', caro()],
  'tien-len': () => ['games/tien-len/hub/key-art.png', tienLen()],
  islands: () =>
    Object.keys(ISLANDS).map((id) => [`apps/hub/src/island-art/${id}.png`, island(id)]),
};

const wanted = process.argv[2] ? [process.argv[2]] : Object.keys(jobs);
for (const name of wanted) {
  if (!jobs[name]) throw new Error(`unknown splash "${name}"; use ${Object.keys(jobs).join(', ')}`);
  const made = jobs[name]();
  for (const [path, svg] of Array.isArray(made[0]) ? made : [made]) {
    await sharp(Buffer.from(svg)).png().toFile(resolve(ROOT, path));
    console.log(`wrote ${path}`);
  }
}
