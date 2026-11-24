/**
 * The board look prototype (issue #351): a still Three.js scene of a made-up Match, in a
 * landscape phone frame. Nothing here talks to the server.
 */
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { ambience } from '../client/ambience.js';
import { DIE, die, hotel, house, token } from '../client/pieces.js';
import { BAND, bandRect, cardBack, placement, printBoard, SIDE } from '../client/print.js';
import { BOARD } from '../server/game/board.js';

const SEAT_COLORS = ['#e0553d', '#4a8fe0', '#e8c04a', '#58b368'] as const;

const PLAYERS = [
  { name: 'Minh', cash: 1840, tile: 13 },
  { name: 'Lan', cash: 960, tile: 24 },
  { name: 'Tuấn', cash: 2310, tile: 27 },
  { name: 'Hoa', cash: 420, tile: 27 },
];
const TURN = 0;

/** Made-up ownership: tile → [seat, level]. Hạ Long, Hải Phòng, Hà Nội make a Full set. */
const LOTS: Record<number, [number, number]> = {
  5: [0, 0],
  6: [0, 1],
  8: [0, 2],
  9: [0, 3],
  12: [1, 0],
  16: [1, 4],
  18: [1, 5],
  23: [2, 1],
  25: [2, 0],
  29: [2, 2],
  31: [3, 3],
  36: [3, 5],
  37: [3, 1],
};
const FULL_SET = [6, 8, 9];

const query = new URLSearchParams(location.search);
/** Camera angle above the board; `?pitch=<degrees>` tries another. */
const PITCH = MathUtils.degToRad(Number(query.get('pitch')) || 56);
const FOV = 30;
/** How much of the screen the board may fill, per axis (NDC): the sides keep the player cards. */
const FIT = [0.62, 0.98] as const;
/** How high the tallest piece stands above the board. */
const PIECE_TOP = 0.8;

const fitWindow = () => {
  const scale = Math.min(1, (window.innerWidth - 32) / 868, (window.innerHeight - 120) / 414);
  document.documentElement.style.setProperty('--scale', `${scale}`);
};
fitWindow();
window.addEventListener('resize', fitWindow);

const frame = document.getElementById('phone') as HTMLDivElement;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;

/** Deep space with stars, drawn in code. */
function spaceTexture() {
  const c = document.createElement('canvas');
  c.width = 1688;
  c.height = 780;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const sky = ctx.createRadialGradient(844, 420, 60, 844, 420, 1000);
  sky.addColorStop(0, '#1b1838');
  sky.addColorStop(0.55, '#0c0b1e');
  sky.addColorStop(1, '#04040b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, c.width, c.height);
  for (const [x, y, r, color] of [
    [380, 180, 420, 'rgba(90, 60, 160, 0.16)'],
    [1350, 600, 380, 'rgba(40, 90, 150, 0.14)'],
  ] as const) {
    const haze = ctx.createRadialGradient(x, y, 0, x, y, r);
    haze.addColorStop(0, color);
    haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const big = Math.random() < 0.06;
    const r = big ? 1.4 + Math.random() * 1.4 : 0.4 + Math.random() * 0.9;
    const hue = [210, 45, 0, 260][Math.floor(Math.random() * 4)];
    ctx.fillStyle = `hsla(${hue} 80% 92% / ${0.35 + Math.random() * 0.65})`;
    if (big) {
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const scene = new Scene();
scene.background = spaceTexture();
const camera = new PerspectiveCamera(30, 844 / 390, 0.5, 200);

scene.add(new HemisphereLight('#f2f0ff', '#2a2450', 1.0));
scene.add(new AmbientLight('#ffffff', 0.15));
const sun = new DirectionalLight('#ffe8c8', 2.4);
sun.position.set(-6, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -10;
sun.shadow.camera.right = sun.shadow.camera.top = 10;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const BOARD_H = 0.22;
const world = new Group();
scene.add(world);

const base = new Mesh(
  new BoxGeometry(SIDE + 0.4, BOARD_H, SIDE + 0.4),
  new MeshStandardMaterial({ color: '#232036', roughness: 0.4, metalness: 0.3 }),
);
base.position.y = BOARD_H / 2;
base.castShadow = true;
base.receiveShadow = true;
world.add(base);

const topMaterial = new MeshStandardMaterial({ roughness: 0.85 });
const top = new Mesh(new PlaneGeometry(SIDE, SIDE), topMaterial);
top.rotation.x = -Math.PI / 2;
top.position.y = BOARD_H + 0.001;
top.receiveShadow = true;
world.add(top);

/** Board units (origin top-left, v towards the camera) to the board group's space. */
const at = (u: number, v: number, y = 0) => new Vector3(u - SIDE / 2, BOARD_H + y, v - SIDE / 2);

const pieces = new Group();
world.add(pieces);

const flat = (w: number, h: number, color: string, opacity = 1) => {
  const m = new Mesh(
    new PlaneGeometry(w, h),
    new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
};

const buildPieces = () => {
  for (const [key, [seat, level]] of Object.entries(LOTS)) {
    const i = Number(key);
    const p = placement(i);
    const color = SEAT_COLORS[seat] as string;
    const tile = BOARD[i];
    const horizontal = p.inward.x === 0;

    const outer = 0.13;
    const strip = horizontal ? flat(p.w - 0.04, outer, color) : flat(outer, p.h - 0.04, color);
    const su = horizontal
      ? p.x + p.w / 2
      : p.inward.x > 0
        ? p.x + outer / 2
        : p.x + p.w - outer / 2;
    const sv = horizontal
      ? p.inward.y < 0
        ? p.y + p.h - outer / 2
        : p.y + outer / 2
      : p.y + p.h / 2;
    strip.position.copy(at(su, sv, 0.004));
    pieces.add(strip);

    const bare = tile?.kind === 'city' ? BAND : 0;
    const tw = p.w - 0.02 - (horizontal ? 0 : bare);
    const th = p.h - 0.02 - (horizontal ? bare : 0);
    const tint = flat(tw, th, color, 0.2);
    tint.position.copy(
      at(p.x + p.w / 2 - (p.inward.x * bare) / 2, p.y + p.h / 2 - (p.inward.y * bare) / 2, 0.003),
    );
    pieces.add(tint);

    if (FULL_SET.includes(i)) {
      const gold = '#e6b422';
      const b = 0.05;
      const ring = [
        [p.w, b, p.x + p.w / 2, p.y + b / 2],
        [p.w, b, p.x + p.w / 2, p.y + p.h - b / 2],
        [b, p.h, p.x + b / 2, p.y + p.h / 2],
        [b, p.h, p.x + p.w - b / 2, p.y + p.h / 2],
      ] as const;
      for (const [w, h, u, v] of ring) {
        const edge = new Mesh(
          new BoxGeometry(w, 0.025, h),
          new MeshStandardMaterial({
            color: gold,
            emissive: '#7a5200',
            roughness: 0.3,
            metalness: 0.6,
          }),
        );
        edge.position.copy(at(u, v, 0.0125));
        edge.castShadow = true;
        pieces.add(edge);
      }
    }

    if (tile?.kind !== 'city' || level === 0) continue;
    const band = bandRect(p);
    const cu = band.x + band.w / 2;
    const cv = band.y + band.h / 2;
    if (level === 5) {
      const h = hotel(color);
      h.scale.setScalar(1.25);
      h.position.copy(at(cu, cv));
      if (!horizontal) h.rotation.y = Math.PI / 2;
      pieces.add(h);
      continue;
    }
    const step = 0.235;
    for (let k = 0; k < level; k++) {
      const offset = (k - (level - 1) / 2) * step;
      const h = house(color);
      h.scale.setScalar(1.3);
      h.position.copy(horizontal ? at(cu + offset, cv) : at(cu, cv + offset));
      pieces.add(h);
    }
  }

  const stacks = new Map<number, number[]>();
  for (const [seat, pl] of PLAYERS.entries())
    stacks.set(pl.tile, [...(stacks.get(pl.tile) ?? []), seat]);
  for (const [i, seats] of stacks) {
    const p = placement(i);
    const band = BOARD[i]?.kind === 'city' ? BAND : 0;
    const out = band / 2 + 0.18;
    const cu = p.x + p.w / 2 - p.inward.x * out;
    const cv = p.y + p.h / 2 - p.inward.y * out;
    seats.forEach((seat, k) => {
      const t = token(SEAT_COLORS[seat] as string);
      const spread = (k - (seats.length - 1) / 2) * 0.24;
      t.position.copy(p.inward.x === 0 ? at(cu + spread, cv) : at(cu, cv + spread));
      t.scale.setScalar(seat === TURN ? 0.85 : 0.75);
      pieces.add(t);
    });
  }

  const d1 = die();
  d1.position.set(-0.75, BOARD_H + DIE / 2, 1.9);
  d1.rotation.y = 0.4;
  const d2 = die();
  d2.position.set(0.8, BOARD_H + DIE / 2, 2.25);
  d2.rotation.set(0, -0.3, Math.PI / 2);
  pieces.add(d1, d2);

  for (const [x, kind, turn] of [
    [-1.6, 'chance', 0.12],
    [1.6, 'chest', -0.1],
  ] as const) {
    const back = new CanvasTexture(cardBack(kind));
    back.colorSpace = SRGBColorSpace;
    back.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const deck = new Mesh(new BoxGeometry(1.5, 0.12, 1.0), [
      ...Array.from({ length: 2 }, () => new MeshStandardMaterial({ color: '#f5efe0' })),
      new MeshStandardMaterial({ map: back, roughness: 0.5 }),
      ...Array.from({ length: 3 }, () => new MeshStandardMaterial({ color: '#f5efe0' })),
    ]);
    deck.position.set(x, BOARD_H + 0.06, -2.4);
    deck.rotation.y = turn;
    deck.castShadow = true;
    pieces.add(deck);
  }
};

/** The board's outline, up to the height of its tallest piece. */
const outline = () => {
  const pts: Vector3[] = [];
  const r = SIDE / 2 + 0.2;
  for (const x of [-r, r])
    for (const z of [-r, r])
      for (const y of [0, BOARD_H + PIECE_TOP]) pts.push(new Vector3(x, y, z));
  return pts;
};

/**
 * Puts the camera at PITCH as close as it can while the board stays inside FIT, with the board
 * centred on screen from top to bottom.
 */
const frameCamera = () => {
  camera.fov = FOV;
  camera.updateProjectionMatrix();
  const dir = new Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
  const pts = outline();
  const place = (d: number, tz: number) => {
    camera.position.copy(dir).multiplyScalar(d);
    camera.position.z += tz;
    camera.lookAt(0, 0, tz);
    camera.updateMatrixWorld();
  };
  const extent = () => {
    const qs = pts.map((p) => p.clone().project(camera));
    return {
      x: Math.max(...qs.map((q) => Math.abs(q.x))),
      top: Math.max(...qs.map((q) => q.y)),
      bottom: Math.min(...qs.map((q) => q.y)),
    };
  };
  let tz = 0;
  let d = 40;
  for (let pass = 0; pass < 8; pass++) {
    let lo = 5;
    let hi = 120;
    for (let n = 0; n < 30; n++) {
      d = (lo + hi) / 2;
      place(d, tz);
      const e = extent();
      if (e.x <= FIT[0] && e.top <= FIT[1] && e.bottom >= -FIT[1]) hi = d;
      else lo = d;
    }
    d = hi;
    place(d, tz);
    const e = extent();
    tz -= ((e.top + e.bottom) / 2) * d * 0.2;
  }
  place(d, tz);
};

const resize = () => {
  const { clientWidth: w, clientHeight: h } = frame;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  frameCamera();
};

const printed = new CanvasTexture(printBoard());
printed.colorSpace = SRGBColorSpace;
printed.anisotropy = renderer.capabilities.getMaxAnisotropy();
topMaterial.map = printed;

const roster = document.getElementById('roster') as HTMLOListElement;
roster.innerHTML = PLAYERS.map(
  (p, seat) => `
  <li class="card seat-${seat}${seat === TURN ? ' turn' : ''}" style="--seat:${SEAT_COLORS[seat]}">
    <span class="avatar">${p.name[0]}</span>
    <span class="who"><b>${p.name}</b><span class="cash">${p.cash.toLocaleString('vi-VN')}</span></span>
  </li>`,
).join('');

buildPieces();
const tick = ambience(pieces, at, renderer.capabilities.getMaxAnisotropy());
new ResizeObserver(resize).observe(frame);
resize();
renderer.setAnimationLoop((ms) => {
  tick(ms / 1000);
  renderer.render(scene, camera);
});
