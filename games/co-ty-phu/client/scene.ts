/**
 * The board in Three.js, after the approved prototype (#351): the printed board floating in
 * space, the Lots in their owners' colours, the tokens, the dice and the decks. `show` puts
 * everything where a view says; `roll`, `walk`, `jump` and `pop` play the moves between views.
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
  type Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { BOARD } from '../server/game/board.js';
import { isFullSet } from '../server/game/economy.js';
import { HOTEL, type View } from '../server/game/model.js';
import { ambience } from './ambience.js';
import { DIE, die, hotel, house, token } from './pieces.js';
import { BAND, bandRect, cardBack, placement, printBoard, SIDE } from './print.js';

export const SEAT_COLORS = ['#e0553d', '#4a8fe0', '#e8c04a', '#58b368'] as const;

const PITCH = MathUtils.degToRad(56);
const FOV = 30;
/** How much of the screen the board may fill, per axis (NDC): the sides keep the player cards. */
const FIT = [0.62, 0.98] as const;
const PIECE_TOP = 0.8;
const BOARD_H = 0.22;
const GOLD = '#e6b422';

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

/** A flat badge for a mark on a Lot: a disc with an icon drawn by `paint`. */
function badge(paint: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  paint(ctx);
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  return new MeshBasicMaterial({ map, transparent: true, depthWrite: false });
}

const FESTIVAL = badge((ctx) => {
  ctx.fillStyle = '#e6b422';
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const r = k % 2 ? 44 : 62;
    ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  ctx.fill();
  ctx.fillStyle = '#b0271e';
  ctx.beginPath();
  ctx.arc(64, 64, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff2c2';
  ctx.font = '900 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('×2', 64, 67);
});

const BLACKOUT = badge((ctx) => {
  ctx.fillStyle = 'rgba(16, 16, 24, 0.92)';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b6f7a';
  ctx.beginPath();
  ctx.moveTo(72, 18);
  ctx.lineTo(36, 70);
  ctx.lineTo(60, 70);
  ctx.lineTo(52, 110);
  ctx.lineTo(90, 54);
  ctx.lineTo(66, 54);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e0553d';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(26, 26);
  ctx.lineTo(102, 102);
  ctx.stroke();
});

/** The rotation that puts face `n` of a die up (BoxGeometry faces: 3, 4, 1, 6, 2, 5). */
const FACE_UP: Record<number, [number, number]> = {
  1: [0, 0],
  6: [Math.PI, 0],
  3: [0, Math.PI / 2],
  4: [0, -Math.PI / 2],
  2: [-Math.PI / 2, 0],
  5: [Math.PI / 2, 0],
};
const DIE_REST = [new Vector3(-0.75, 0, 1.9), new Vector3(0.8, 0, 2.25)] as const;

interface Tween {
  start: number;
  ms: number;
  step: (k: number) => void;
  done: () => void;
}

const ease = (k: number) => 1 - (1 - k) ** 3;

export class BoardView {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 844 / 390, 0.5, 200);
  private readonly world = new Group();
  private readonly lots = new Group();
  private readonly marks = new Group();
  private readonly tokens: Group[] = [];
  private readonly dice: Mesh[];
  private readonly glow: Mesh[] = [];
  private readonly tick: (t: number) => void;
  private readonly tweens: Tween[] = [];
  private readonly ray = new Raycaster();
  private readonly ground = new Plane(new Vector3(0, 1, 0), -BOARD_H);
  /** Where each seat's token stands, `null` when it is off the board. */
  private spots: (number | null)[] = [];
  private picking: number[] = [];
  private paused = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;
    const anisotropy = r.capabilities.getMaxAnisotropy();

    this.scene.background = spaceTexture();
    this.scene.add(new HemisphereLight('#f2f0ff', '#2a2450', 1.0));
    this.scene.add(new AmbientLight('#ffffff', 0.15));
    const sun = new DirectionalLight('#ffe8c8', 2.4);
    sun.position.set(-6, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -10;
    sun.shadow.camera.right = sun.shadow.camera.top = 10;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(this.world);

    const base = new Mesh(
      new BoxGeometry(SIDE + 0.4, BOARD_H, SIDE + 0.4),
      new MeshStandardMaterial({ color: '#232036', roughness: 0.4, metalness: 0.3 }),
    );
    base.position.y = BOARD_H / 2;
    base.castShadow = base.receiveShadow = true;
    const printed = new CanvasTexture(printBoard());
    printed.colorSpace = SRGBColorSpace;
    printed.anisotropy = anisotropy;
    const top = new Mesh(
      new PlaneGeometry(SIDE, SIDE),
      new MeshStandardMaterial({ roughness: 0.85, map: printed }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = BOARD_H + 0.001;
    top.receiveShadow = true;
    this.world.add(base, top, this.lots, this.marks);

    for (const [x, kind, turn] of [
      [-1.6, 'chance', 0.12],
      [1.6, 'chest', -0.1],
    ] as const) {
      const back = new CanvasTexture(cardBack(kind));
      back.colorSpace = SRGBColorSpace;
      back.anisotropy = anisotropy;
      const side = () => new MeshStandardMaterial({ color: '#f5efe0' });
      const deck = new Mesh(new BoxGeometry(1.5, 0.12, 1.0), [
        side(),
        side(),
        new MeshStandardMaterial({ map: back, roughness: 0.5 }),
        side(),
        side(),
        side(),
      ]);
      deck.position.set(x, BOARD_H + 0.06, -2.4);
      deck.rotation.y = turn;
      deck.castShadow = true;
      this.world.add(deck);
    }

    BOARD.forEach((_, i) => {
      const p = placement(i);
      const g = flat(p.w - 0.04, p.h - 0.04, '#ffffff', 0);
      g.position.copy(at(p.x + p.w / 2, p.y + p.h / 2, 0.02));
      g.renderOrder = 2;
      this.glow.push(g);
      this.world.add(g);
    });

    this.dice = DIE_REST.map((rest) => {
      const d = die();
      d.rotation.order = 'YXZ';
      d.position.set(rest.x, BOARD_H + DIE / 2, rest.z);
      this.world.add(d);
      return d;
    });
    this.setDice([3, 4]);

    this.tick = ambience(this.world, at, anisotropy);
    r.setAnimationLoop((ms) => this.frame(ms));
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.frameCamera();
  }

  /** Stops drawing while the Hub's tab is hidden. */
  pause(paused: boolean) {
    this.paused = paused;
  }

  /** Puts everything where `view` says, at once. */
  show(view: View) {
    this.showLots(view);
    this.spots = view.players.map((p) => (p.bankrupt ? null : p.tile));
    while (this.tokens.length < view.players.length) {
      const t = token(SEAT_COLORS[this.tokens.length] as string);
      this.tokens.push(t);
      this.world.add(t);
    }
    this.placeTokens(view.turn);
    if (view.dice) this.setDice(view.dice);
  }

  /** Redraws the Lots, their marks and Levels from `view`. */
  showLots(view: View) {
    clear(this.lots);
    clear(this.marks);
    view.lots.forEach((lot, i) => {
      if (!lot) return;
      const g = lotPieces(i, lot.owner, lot.level, isFullSet(view, i));
      g.userData.tile = i;
      this.lots.add(g);
    });
    for (const [tile, material] of [
      [view.festival, FESTIVAL],
      [view.blackout?.tile ?? null, BLACKOUT],
    ] as const) {
      if (tile === null) continue;
      const p = placement(tile);
      const m = new Mesh(new PlaneGeometry(0.62, 0.62), material);
      m.rotation.x = -Math.PI / 2;
      const off = BOARD[tile]?.kind === 'city' ? BAND / 2 : 0;
      m.position.copy(at(p.x + p.w / 2 - p.inward.x * off, p.y + p.h / 2 - p.inward.y * off, 0.03));
      m.renderOrder = 3;
      this.marks.add(m);
    }
  }

  /** The Lot on `tile` grows in from nothing. */
  pop(tile: number, ms = 360) {
    const g = this.lots.children.find((c) => c.userData.tile === tile);
    if (!g) return Promise.resolve();
    return this.tween(ms, (k) => g.scale.setScalar(Math.max(0.01, ease(k))));
  }

  /** Tumbles the dice onto `values`; one die is hidden under Kẹt xe. */
  roll(values: number[], ms = 650) {
    const spins = this.dice.map(() => [
      (Math.random() * 2 + 2) * Math.PI * (Math.random() < 0.5 ? -1 : 1),
      (Math.random() * 2 + 2) * Math.PI,
    ]);
    this.dice.forEach((d, i) => {
      d.visible = i < values.length;
    });
    return this.tween(ms, (k) => {
      this.dice.forEach((d, i) => {
        const [x, z] = FACE_UP[values[i] ?? 1] as [number, number];
        const [sx, sz] = spins[i] as [number, number];
        const e = ease(k);
        d.rotation.set(x + sx * (1 - e), 0.4 - i * 0.7 + (1 - e) * 2, z + sz * (1 - e));
        d.position.y = BOARD_H + DIE / 2 + Math.sin(k * Math.PI) * 1.2 * (1 - k * 0.5);
      });
    }).then(() => this.setDice(values));
  }

  /** Walks a token `steps` Tiles ahead from `from`, a hop per Tile. */
  async walk(seat: number, from: number, steps: number, perStep = 150) {
    const t = this.tokens[seat];
    if (!t) return;
    for (let k = 1; k <= steps; k++) {
      const a = spot((from + k - 1) % 40, 0, 1);
      const b = spot((from + k) % 40, 0, 1);
      await this.tween(perStep, (u) => {
        t.position.lerpVectors(a, b, u);
        t.position.y = a.y + Math.sin(u * Math.PI) * 0.35;
      });
    }
    this.spots[seat] = (from + steps) % 40;
    this.placeTokens(seat);
  }

  /** Flies a token straight to `to` in a high arc. */
  async jump(seat: number, to: number, ms = 520) {
    const t = this.tokens[seat];
    if (!t) return;
    const a = t.position.clone();
    const b = spot(to, 0, 1);
    await this.tween(ms, (u) => {
      const e = ease(u);
      t.position.lerpVectors(a, b, e);
      t.position.y = a.y + Math.sin(u * Math.PI) * 1.6;
    });
    this.spots[seat] = to;
    this.placeTokens(seat);
  }

  /** Lights up the Tiles a tap may pick; none clears them. */
  highlight(tiles: number[]) {
    this.picking = tiles;
  }

  /** The Tile under a point of the canvas, in CSS pixels from its top-left. */
  tileAt(x: number, y: number): number | null {
    const ndc = new Vector2(
      (x / this.canvas.clientWidth) * 2 - 1,
      -(y / this.canvas.clientHeight) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.ray.intersectPlane(this.ground, new Vector3());
    if (!hit) return null;
    const u = hit.x + SIDE / 2;
    const v = hit.z + SIDE / 2;
    const i = BOARD.findIndex((_, k) => {
      const p = placement(k);
      return u >= p.x && u < p.x + p.w && v >= p.y && v < p.y + p.h;
    });
    return i < 0 ? null : i;
  }

  private setDice(values: number[]) {
    this.dice.forEach((d, i) => {
      d.visible = i < values.length;
      const [x, z] = FACE_UP[values[i] ?? 1] as [number, number];
      d.rotation.set(x, 0.4 - i * 0.7, z);
      d.position.y = BOARD_H + DIE / 2;
    });
  }

  /** Spreads the tokens sharing a Tile; the turn player's stands a little larger. */
  private placeTokens(turn: number) {
    const stacks = new Map<number, number[]>();
    this.spots.forEach((tile, seat) => {
      if (tile !== null) stacks.set(tile, [...(stacks.get(tile) ?? []), seat]);
    });
    this.tokens.forEach((t, seat) => {
      const tile = this.spots[seat] ?? null;
      t.visible = tile !== null;
      if (tile === null) return;
      const seats = stacks.get(tile) ?? [seat];
      t.position.copy(spot(tile, seats.indexOf(seat), seats.length));
      t.scale.setScalar(seat === turn ? 0.85 : 0.75);
    });
  }

  private tween(ms: number, step: (k: number) => void) {
    return new Promise<void>((done) => {
      if (ms <= 0 || this.paused) {
        step(1);
        done();
        return;
      }
      this.tweens.push({ start: performance.now(), ms, step, done });
    });
  }

  private frame(ms: number) {
    const now = performance.now();
    for (const tw of [...this.tweens]) {
      const k = Math.min(1, (now - tw.start) / tw.ms);
      tw.step(k);
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.done();
      }
    }
    if (this.paused) return;
    const pulse = 0.22 + Math.sin(ms / 220) * 0.12;
    this.glow.forEach((g, i) => {
      (g.material as MeshBasicMaterial).opacity = this.picking.includes(i) ? pulse : 0;
    });
    this.tick(ms / 1000);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Puts the camera at PITCH as close as it can while the board stays inside FIT, with the board
   * centred on screen from top to bottom.
   */
  private frameCamera() {
    const camera = this.camera;
    camera.fov = FOV;
    camera.updateProjectionMatrix();
    const dir = new Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
    const pts: Vector3[] = [];
    const r = SIDE / 2 + 0.2;
    for (const x of [-r, r])
      for (const z of [-r, r])
        for (const y of [0, BOARD_H + PIECE_TOP]) pts.push(new Vector3(x, y, z));
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
  }
}

/** Board units (origin top-left, v towards the camera) to the board group's space. */
const at = (u: number, v: number, y = 0) => new Vector3(u - SIDE / 2, BOARD_H + y, v - SIDE / 2);

/** Where token `k` of `n` on `tile` stands: off the band, side by side along the Tile. */
function spot(tile: number, k: number, n: number) {
  const p = placement(tile);
  const band = BOARD[tile]?.kind === 'city' ? BAND : 0;
  const out = band / 2 + 0.18;
  const cu = p.x + p.w / 2 - p.inward.x * out;
  const cv = p.y + p.h / 2 - p.inward.y * out;
  const spread = (k - (n - 1) / 2) * 0.24;
  if (p.corner)
    return at(
      cu + ((k % 2) - 0.5) * 0.4 * Math.min(1, n - 1),
      cv + (Math.floor(k / 2) - 0.5) * 0.4 * (n > 2 ? 1 : 0),
    );
  return p.inward.x === 0 ? at(cu + spread, cv) : at(cu, cv + spread);
}

const flat = (w: number, h: number, color: string, opacity = 1) => {
  const m = new Mesh(
    new PlaneGeometry(w, h),
    new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
};

function clear(group: Object3D) {
  for (const child of [...group.children]) group.remove(child);
}

/** An owned Lot: a tint and an outer strip in the owner's colour, its houses or Hotel, a gold rim in a Full set. */
function lotPieces(i: number, owner: number, level: number, full: boolean) {
  const g = new Group();
  const p = placement(i);
  const color = SEAT_COLORS[owner] as string;
  const horizontal = p.inward.x === 0;
  const centre = at(p.x + p.w / 2, p.y + p.h / 2);
  g.position.copy(centre);
  const local = (u: number, v: number, y = 0) => at(u, v, y).sub(centre);

  const outer = 0.13;
  const strip = horizontal ? flat(p.w - 0.04, outer, color) : flat(outer, p.h - 0.04, color);
  const su = horizontal ? p.x + p.w / 2 : p.inward.x > 0 ? p.x + outer / 2 : p.x + p.w - outer / 2;
  const sv = horizontal
    ? p.inward.y < 0
      ? p.y + p.h - outer / 2
      : p.y + outer / 2
    : p.y + p.h / 2;
  strip.position.copy(local(su, sv, 0.004));
  g.add(strip);

  const bare = BOARD[i]?.kind === 'city' ? BAND : 0;
  const tw = p.w - 0.02 - (horizontal ? 0 : bare);
  const th = p.h - 0.02 - (horizontal ? bare : 0);
  const tint = flat(tw, th, color, 0.2);
  tint.position.copy(
    local(p.x + p.w / 2 - (p.inward.x * bare) / 2, p.y + p.h / 2 - (p.inward.y * bare) / 2, 0.003),
  );
  g.add(tint);

  if (full) {
    const b = 0.05;
    const gold = new MeshStandardMaterial({
      color: GOLD,
      emissive: '#7a5200',
      roughness: 0.3,
      metalness: 0.6,
    });
    for (const [w, h, u, v] of [
      [p.w, b, p.x + p.w / 2, p.y + b / 2],
      [p.w, b, p.x + p.w / 2, p.y + p.h - b / 2],
      [b, p.h, p.x + b / 2, p.y + p.h / 2],
      [b, p.h, p.x + p.w - b / 2, p.y + p.h / 2],
    ] as const) {
      const edge = new Mesh(new BoxGeometry(w, 0.025, h), gold);
      edge.position.copy(local(u, v, 0.0125));
      edge.castShadow = true;
      g.add(edge);
    }
  }

  if (BOARD[i]?.kind !== 'city' || level === 0) return g;
  const band = bandRect(p);
  const cu = band.x + band.w / 2;
  const cv = band.y + band.h / 2;
  if (level >= HOTEL) {
    const h = hotel(color);
    h.scale.setScalar(1.25);
    h.position.copy(local(cu, cv));
    if (!horizontal) h.rotation.y = Math.PI / 2;
    g.add(h);
    return g;
  }
  const step = 0.235;
  for (let k = 0; k < level; k++) {
    const offset = (k - (level - 1) / 2) * step;
    const h = house(color);
    h.scale.setScalar(1.3);
    h.position.copy(horizontal ? local(cu + offset, cv) : local(cu, cv + offset));
    g.add(h);
  }
  return g;
}
