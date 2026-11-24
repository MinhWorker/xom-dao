/**
 * The board look prototype (issue #351): a still Three.js scene of a made-up Match, in a
 * landscape phone frame. Nothing here talks to the server.
 */
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
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
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { BOARD } from '../server/game/board.js';
import { die, hotel, house, token } from './pieces.js';
import { BAND, bandRect, placement, printBoard, SIDE } from './print.js';

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

interface View {
  label: string;
  /** How far the board is turned on screen, clockwise. */
  yaw: number;
  /** Camera angle above the table. */
  pitch: number;
  fov: number;
  /** How much of the screen the board may fill, per axis (NDC). */
  fit: [number, number];
}

const VIEWS: Record<string, View> = {
  diamond: {
    label: 'Chéo 45°',
    yaw: MathUtils.degToRad(45),
    pitch: MathUtils.degToRad(40),
    fov: 30,
    fit: [0.99, 0.99],
  },
  square: { label: 'Thẳng', yaw: 0, pitch: MathUtils.degToRad(50), fov: 30, fit: [0.62, 0.99] },
};

const pitchParam = Number(new URLSearchParams(location.search).get('pitch'));
if (pitchParam) for (const v of Object.values(VIEWS)) v.pitch = MathUtils.degToRad(pitchParam);

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

const scene = new Scene();
scene.background = new Color('#2a1b12');
const camera = new PerspectiveCamera(30, 844 / 390, 0.5, 200);

scene.add(new HemisphereLight('#fff4e0', '#4a3020', 0.9));
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

/** Wood grain for the table, drawn in code. */
const woodTexture = () => {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#7a4a2a';
  ctx.fillRect(0, 0, 1024, 1024);
  for (let plank = 0; plank < 4; plank++) {
    const y0 = plank * 256;
    ctx.fillStyle = `hsl(24 ${42 + plank * 3}% ${28 + (plank % 2) * 4}%)`;
    ctx.fillRect(0, y0, 1024, 256);
    for (let i = 0; i < 70; i++) {
      const y = y0 + Math.random() * 256;
      const a = 0.04 + Math.random() * 0.1;
      ctx.strokeStyle = Math.random() < 0.5 ? `rgba(30,14,6,${a})` : `rgba(255,210,160,${a * 0.6})`;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      const amp = 2 + Math.random() * 6;
      const freq = 0.004 + Math.random() * 0.01;
      const phase = Math.random() * 10;
      for (let x = 0; x <= 1024; x += 16) {
        const yy = y + Math.sin(x * freq + phase) * amp;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,8,2,0.55)';
    ctx.fillRect(0, y0, 1024, 3);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(5, 5);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
};

const table = new Mesh(
  new PlaneGeometry(80, 80),
  new MeshStandardMaterial({ map: woodTexture(), roughness: 0.75 }),
);
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
scene.add(table);

const BOARD_H = 0.22;
const world = new Group();
scene.add(world);

const base = new Mesh(
  new BoxGeometry(SIDE + 0.4, BOARD_H, SIDE + 0.4),
  new MeshStandardMaterial({ color: '#3b2316', roughness: 0.45 }),
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
/** The dice and decks keep their place on screen whichever way the board is turned. */
const centre = new Group();
scene.add(centre);

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

    const tint = flat(p.w - 0.02, p.h - 0.02, color, 0.2);
    tint.position.copy(at(p.x + p.w / 2, p.y + p.h / 2, 0.003));
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
      const spread = (k - (seats.length - 1) / 2) * 0.42;
      t.position.copy(p.inward.x === 0 ? at(cu + spread, cv) : at(cu, cv + spread));
      t.scale.setScalar(seat === TURN ? 1.7 : 1.5);
      pieces.add(t);
    });
  }

  const d1 = die();
  d1.position.set(-0.55, BOARD_H + 0.25, 1.9);
  d1.rotation.y = 0.4;
  const d2 = die();
  d2.position.set(0.6, BOARD_H + 0.25, 2.2);
  d2.rotation.set(0, -0.3, Math.PI / 2);
  centre.add(d1, d2);

  for (const [x, color, turn] of [
    [-1.6, '#e2731c', 0.12],
    [1.6, '#2f7fbf', -0.1],
  ] as const) {
    const deck = new Mesh(new BoxGeometry(1.5, 0.12, 1.0), [
      ...Array.from({ length: 2 }, () => new MeshStandardMaterial({ color: '#f5efe0' })),
      new MeshStandardMaterial({ color, roughness: 0.5 }),
      ...Array.from({ length: 3 }, () => new MeshStandardMaterial({ color: '#f5efe0' })),
    ]);
    deck.position.set(x, BOARD_H + 0.06, -2.4);
    deck.rotation.y = turn;
    deck.castShadow = true;
    centre.add(deck);
  }
};

const corners = () => {
  const pts: Vector3[] = [];
  const r = SIDE / 2 + 0.2;
  for (const x of [-r, r])
    for (const z of [-r, r]) for (const y of [0, BOARD_H]) pts.push(new Vector3(x, y, z));
  return pts;
};

/** Puts the camera at `view`'s angle, as close as it can while the board stays in the fit box. */
const frameCamera = (view: View) => {
  camera.fov = view.fov;
  camera.updateProjectionMatrix();
  const dir = new Vector3(0, Math.sin(view.pitch), Math.cos(view.pitch));
  const pts = corners().map((p) => p.applyAxisAngle(new Vector3(0, 1, 0), -view.yaw));
  const place = (d: number, tz: number) => {
    camera.position
      .copy(dir)
      .multiplyScalar(d)
      .setZ(camera.position.z + tz);
    camera.lookAt(0, 0, tz);
    camera.updateMatrixWorld();
  };
  const closest = (tz: number) => {
    let lo = 5;
    let hi = 120;
    for (let n = 0; n < 30; n++) {
      const d = (lo + hi) / 2;
      place(d, tz);
      const fits = pts.every((p) => {
        const q = p.clone().project(camera);
        return Math.abs(q.x) <= view.fit[0] && Math.abs(q.y) <= view.fit[1];
      });
      if (fits) hi = d;
      else lo = d;
    }
    return hi;
  };
  let best = { d: Number.POSITIVE_INFINITY, tz: 0 };
  for (let tz = -3; tz <= 3; tz += 0.05) {
    const d = closest(tz);
    if (d < best.d) best = { d, tz };
  }
  place(best.d, best.tz);
};

let current: View = VIEWS.diamond as View;

const show = (view: View) => {
  current = view;
  world.rotation.y = -view.yaw;
  const texture = new CanvasTexture(printBoard(view.yaw));
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  topMaterial.map?.dispose();
  topMaterial.map = texture;
  topMaterial.needsUpdate = true;
  frameCamera(view);
  render();
};

const render = () => {
  const { clientWidth: w, clientHeight: h } = frame;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  frameCamera(current);
  renderer.render(scene, camera);
};

const roster = document.getElementById('roster') as HTMLOListElement;
roster.innerHTML = PLAYERS.map(
  (p, seat) => `
  <li class="card seat-${seat}${seat === TURN ? ' turn' : ''}" style="--seat:${SEAT_COLORS[seat]}">
    <span class="avatar">${p.name[0]}</span>
    <span class="who"><b>${p.name}</b><span class="cash">${p.cash.toLocaleString('vi-VN')}</span></span>
  </li>`,
).join('');

const controls = document.getElementById('views') as HTMLDivElement;
for (const [id, view] of Object.entries(VIEWS)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = view.label;
  button.dataset.view = id;
  button.addEventListener('click', () => {
    for (const b of controls.querySelectorAll('button')) b.classList.toggle('on', b === button);
    document.body.dataset.view = id;
    show(view);
  });
  controls.append(button);
}

buildPieces();
const initial = new URLSearchParams(location.search).get('view') ?? 'diamond';
(controls.querySelector(`[data-view="${initial}"]`) as HTMLButtonElement | null)?.click();
new ResizeObserver(render).observe(frame);
