// Draws splash art (2560×1152, 20:9) in code, in the Game's own colours:
//   node scripts/splash.mjs [caro|tien-len|islands]     (no argument: all of them)
// Caro and Tiến Lên are drawn to match their clients (`games/caro/client/render.ts`,
// `games/tien-len/godot/style.gd`). The Islands' art is a placeholder: the Island's Emblem on a
// tinted backdrop, until the Games of that Island have a look of their own. Đặt Bom's
// `hub/key-art.png` is not made here.
import { readFileSync } from 'node:fs';
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
  const centre = ([c, r]) => [(c + 0.5) * cell, (r + 0.5) * cell];
  const jitter = (c, r, k) => Math.sin(c * 12.9898 + r * 78.233 + k * 3.7) * 3.5;

  const stroke = (d, color, width) => `
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${width * 1.9}" stroke-linecap="round" opacity="0.18"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  const markX = (p) => {
    const [cx, cy] = centre(p);
    const r = cell * 0.3;
    const j = (k) => jitter(p[0], p[1], k);
    return stroke(
      `M${cx - r + j(1)} ${cy - r + j(2)}L${cx + r + j(3)} ${cy + r + j(4)}M${cx + r + j(5)} ${cy - r + j(6)}L${cx - r + j(7)} ${cy + r + j(8)}`,
      INK.X,
      cell * 0.11,
    );
  };
  const markO = (p) => {
    const [cx, cy] = centre(p);
    const r = cell * 0.3;
    const tilt = jitter(p[0], p[1], 9) * 4;
    return stroke(
      `M${cx} ${cy - r * 0.96}a${r * 1.02} ${r * 0.96} ${tilt} 1 1 -0.1 0z`,
      INK.O,
      cell * 0.11,
    );
  };

  const wash = X.map((p) => {
    const [cx, cy] = centre(p);
    return `<rect x="${cx - cell / 2 + 1}" y="${cy - cell / 2 + 1}" width="${cell - 1}" height="${cell - 1}" fill="rgb(179 55 44 / 0.13)"/>`;
  }).join('');

  const grid = [
    ...Array.from({ length: cols + 1 }, (_, c) => `M${c * cell + 0.5} 0V${h}`),
    ...Array.from({ length: rows + 1 }, (_, r) => `M0 ${r * cell + 0.5}H${w}`),
  ].join('');

  const [x1, y1] = centre(X[0]);
  const [x2, y2] = centre(X[4]);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const dx = (x2 - x1) / len;
  const dy = (y2 - y1) / len;
  const strike = `M${x1 - dx * cell * 0.45} ${y1 - dy * cell * 0.45}L${x2 + dx * cell * 0.45} ${y2 + dy * cell * 0.45}`;

  const [fx, fy] = FOCUS.caro;
  const sheet = `
  <g transform="translate(${px(fx, W)} ${px(fy, H)}) scale(1 0.62) rotate(-16) translate(${-w / 2} ${-h / 2})">
    <rect x="-3" y="-1" width="${w + 9}" height="${h + 9}" fill="#000" opacity="0.55" filter="url(#blur)" transform="translate(14 26)"/>
    <rect x="-3" y="-1" width="${w + 9}" height="${h + 9}" fill="#cbbd9c"/>
    <rect x="-4" y="-3" width="${w + 10}" height="${h + 9}" fill="#ddd0b2"/>
    <rect x="-5" y="-5" width="${w + 10}" height="${h + 10}" fill="url(#paper)" stroke="#cdbf9f"/>
    ${wash}
    <path d="${grid}" stroke="rgb(59 53 44 / 0.24)" stroke-width="1.5" fill="none"/>
    ${O.map(markO).join('')}${X.map(markX).join('')}
    <path d="${strike}" stroke="${INK.X}" stroke-width="${cell * 0.14}" stroke-linecap="round" opacity="0.85" fill="none"/>
  </g>`;

  return frame(`${backdrop({
    top: '#3c2b1f',
    bottom: '#2a1e16',
    glow: '#6a4d36',
    focus: FOCUS.caro,
    glowAlpha: 0.7,
  })}
  <defs>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
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
    spade: `<g transform="scale(1 -1) translate(0 ${-0.18 * u})">${heart}</g><path d="M${-0.1 * u} ${0.2 * u}L${0.1 * u} ${0.2 * u}L${0.36 * u} ${0.98 * u}L${-0.36 * u} ${0.98 * u}Z"/>`,
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

function island(id) {
  const hue = ISLANDS[id];
  const emblem = readFileSync(resolve(ROOT, `apps/hub/src/emblems/${id}.svg`), 'utf8');
  const inner = emblem.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const [fx, fy] = FOCUS.island;
  const [cx, cy] = [px(fx, W), px(fy, H)];
  const size = 600;
  const tint = hsl(hue, 55, 66);
  return frame(`${backdrop({ top: hsl(hue, 38, 13), bottom: hsl(hue, 34, 8), glow: hsl(hue, 52, 34), focus: FOCUS.island, glowAlpha: 0.75 })}
  <circle cx="${cx}" cy="${cy}" r="${size * 0.62}" fill="none" stroke="${tint}" stroke-opacity="0.16" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="${size * 0.74}" fill="none" stroke="${tint}" stroke-opacity="0.08" stroke-width="2"/>
  <g color="${tint}" transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 64})">${inner}</g>`);
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
