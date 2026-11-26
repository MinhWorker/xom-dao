/**
 * The battle in Three.js: two seas side by side on open water at dusk, the player's own on the
 * left. The camera hangs over one sea at a time and glides to the other; shells fly in from the
 * side of the sea that fired them. Everything is built in code (no model files).
 */
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three';
import { cellsOf, index } from '../server/game/fleet.js';
import { FLEET, Hit, type Mark, Miss, type Placement, type Point, type Scan, SIZE } from '../server/game/model.js';
import { Chart, SPAN } from './chart.js';
import { Effects, RADAR } from './effects.js';
import { buildShip, type ShipLook, shipLook } from './ships.js';
import { SKY, SUN, Water } from './water.js';

export type Side = 'home' | 'enemy';

/** The centre of each sea on the water (x); both lie on z = 0. */
const CENTRE: Record<Side, number> = { home: -7.5, enemy: 7.5 };
const PITCH = MathUtils.degToRad(58);
const PAN_MS = 850;
export const SHELL_MS = 950;
const SINK_MS = 2600;
const REVEAL_MS = 900;
const MAX_PEGS = SIZE * SIZE;

/** A cell's centre in the world. */
export function cellWorld(side: Side, p: Point, out = new Vector3()) {
  return out.set(CENTRE[side] - SIZE / 2 + p.x + 0.5, 0, -SIZE / 2 + p.y + 0.5);
}

/** The centre of a ship lying at `at`, and its heading (radians about y). */
function shipPose(side: Side, id: number, at: Placement) {
  const size = FLEET[id]?.size ?? 1;
  const mid = at.v ? { x: at.x, y: at.y + (size - 1) / 2 } : { x: at.x + (size - 1) / 2, y: at.y };
  return { pos: cellWorld(side, mid), heading: at.v ? -Math.PI / 2 : 0 };
}

/** What one sea shows. */
export interface SeaPicture {
  ships: readonly (Placement | null)[];
  sunk: readonly boolean[];
  marks: readonly Mark[];
  scans: readonly Scan[];
}

interface ShipView {
  id: number;
  group: Group;
  look: ShipLook;
  at: Placement | null;
  /** When it began to go down (-Infinity: down already), `null` afloat. */
  sunkAt: number | null;
  /** When it came into view, for a fade. */
  shownAt: number;
  phase: number;
  /** A refused rotation shakes it. */
  shakeAt: number;
  /** Drawn lifted while dragged. */
  lifted: boolean;
  bad: boolean;
}

class SeaView {
  readonly chart = new Chart();
  readonly ships: ShipView[] = [];
  readonly misses: InstancedMesh;
  readonly hits: InstancedMesh;
  marks: readonly Mark[] = [];
  sunkCells = new Set<number>();
  readonly root = new Group();

  constructor(
    readonly side: Side,
    scene: Scene,
    pegs: { miss: [CylinderGeometry, MeshStandardMaterial]; hit: [CylinderGeometry, MeshStandardMaterial] },
  ) {
    const plane = new Mesh(
      new PlaneGeometry(SPAN, SPAN),
      new MeshBasicMaterial({ map: this.chart.texture, transparent: true, depthWrite: false }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(CENTRE[side], 0.06, 0);
    plane.renderOrder = 1;
    this.root.add(plane);
    this.misses = new InstancedMesh(pegs.miss[0], pegs.miss[1], MAX_PEGS);
    this.hits = new InstancedMesh(pegs.hit[0], pegs.hit[1], MAX_PEGS);
    this.misses.count = 0;
    this.hits.count = 0;
    this.root.add(this.misses, this.hits);
    for (const [id, ship] of FLEET.entries()) {
      const look = shipLook();
      const group = buildShip(id, ship.size, look);
      group.visible = false;
      this.root.add(group);
      this.ships.push({
        id,
        group,
        look,
        at: null,
        sunkAt: null,
        shownAt: -Infinity,
        phase: id * 1.7 + (side === 'home' ? 0 : 0.9),
        shakeAt: -Infinity,
        lifted: false,
        bad: false,
      });
    }
    scene.add(this.root);
  }
}

/** Where to look and how close, eased between the seas. */
interface CameraMove {
  from: number;
  to: number;
  at: number;
}

export class BattleView {
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(38, 1, 0.3, 400);
  private readonly water: Water;
  private readonly effects: Effects;
  private readonly seas: Record<Side, SeaView>;
  private readonly calm: [Vector4, Vector4];
  private readonly reticle: Mesh;
  private readonly sweep: Mesh;
  private readonly shell: Group;
  private readonly flash = new PointLight('#ffb070', 0, 9, 2);
  private readonly raycaster = new Raycaster();
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly scratch = new Matrix4();
  private readonly dummy = new Object3D();
  private readonly v = new Vector3();
  private look: CameraMove = { from: CENTRE.home, to: CENTRE.home, at: 0 };
  private distance = 18;
  private width = 1;
  private height = 1;
  private rect = { x: 0, y: 0, w: 1, h: 1 };
  private shakeUntil = 0;
  private shakePower = 0;
  private flashAt = -Infinity;
  private aim: { side: Side; p: Point; radar: boolean } | null = null;
  private sweepAt = -Infinity;
  private sweepCentre = new Vector3();
  private shellFlight: { from: Vector3; to: Vector3; at: number; resolve: () => void } | null = null;
  private last = performance.now();
  private raf = 0;
  private paused = false;
  private low = false;
  private readonly start = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.scene.background = SKY.haze.clone();

    this.calm = [
      new Vector4(CENTRE.home, 0, SPAN / 2 + 0.3, 0),
      new Vector4(CENTRE.enemy, 0, SPAN / 2 + 0.3, 0),
    ];
    this.water = new Water(false, this.calm);
    this.scene.add(this.water.sky, this.water.mesh);

    this.scene.add(new HemisphereLight('#bcd4ec', '#2a3440', 1.25));
    this.scene.add(new AmbientLight('#4a5870', 0.4));
    const sun = new DirectionalLight(SKY.sun, 2.2);
    sun.position.copy(SUN).multiplyScalar(30);
    this.scene.add(sun);
    const rim = new DirectionalLight('#8fb3ff', 0.6);
    rim.position.set(6, 8, 10);
    this.scene.add(rim);
    this.scene.add(this.flash);

    this.buildIslands();
    const pegGeometry = new CylinderGeometry(0.07, 0.09, 0.32, 8);
    pegGeometry.translate(0, 0.12, 0);
    const pegs = {
      miss: [pegGeometry, new MeshStandardMaterial({ color: '#f2f5f2', roughness: 0.5 })] as [
        CylinderGeometry,
        MeshStandardMaterial,
      ],
      hit: [
        pegGeometry,
        new MeshStandardMaterial({ color: '#e04a2c', roughness: 0.4, emissive: '#7a1808' }),
      ] as [CylinderGeometry, MeshStandardMaterial],
    };
    this.seas = { home: new SeaView('home', this.scene, pegs), enemy: new SeaView('enemy', this.scene, pegs) };
    this.effects = new Effects(this.scene, false);

    this.reticle = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ map: reticleTexture(), transparent: true, depthWrite: false, color: '#ffd166' }),
    );
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.renderOrder = 4;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    this.sweep = new Mesh(
      new RingGeometry(0.05, 1, 48, 1, 0, Math.PI / 3),
      new MeshBasicMaterial({ color: RADAR, transparent: true, opacity: 0.5, depthWrite: false, side: DoubleSide }),
    );
    this.sweep.rotation.x = -Math.PI / 2;
    this.sweep.visible = false;
    this.sweep.renderOrder = 4;
    this.scene.add(this.sweep);

    this.shell = new Group();
    const body = new Mesh(new CylinderGeometry(0.06, 0.08, 0.34, 8), new MeshStandardMaterial({ color: '#2d2a28', metalness: 0.6, roughness: 0.4 }));
    body.rotation.x = Math.PI / 2;
    const tip = new Mesh(new ConeGeometry(0.06, 0.14, 8), new MeshBasicMaterial({ color: '#ffcf7a' }));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.24;
    this.shell.add(body, tip);
    this.shell.visible = false;
    this.scene.add(this.shell);
  }

  /** Low graphics: fewer pixels, particles and ripples. */
  setGraphics(low: boolean) {
    this.low = low;
    this.renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio || 1, 2));
    this.water.setDetail(!low);
    this.resize(this.width, this.height);
  }

  /** A few low islands on the horizon. */
  private buildIslands() {
    const rock = new MeshStandardMaterial({ color: '#3d4a4a', flatShading: true, roughness: 1 });
    const green = new MeshStandardMaterial({ color: '#4f6a45', flatShading: true, roughness: 1 });
    for (const [x, z, s] of [
      [-38, -46, 5],
      [-28, -52, 3],
      [24, -58, 6],
      [40, -44, 3.5],
      [-60, -20, 4],
      [62, -24, 5],
    ] as const) {
      const isle = new Group();
      const base = new Mesh(new DodecahedronGeometry(1, 0), rock);
      base.scale.set(s * 1.8, s * 0.55, s * 1.2);
      base.position.y = -0.2;
      const top = new Mesh(new ConeGeometry(1, 1, 6), green);
      top.scale.set(s * 1.1, s * 0.9, s * 0.9);
      top.position.y = s * 0.45;
      isle.add(base, top);
      isle.position.set(x, 0, z);
      isle.rotation.y = x;
      this.scene.add(isle);
    }
  }

  /** Sizes the canvas (CSS pixels) and the part of it the seas should fill. */
  resize(width: number, height: number, rect = this.rect) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.rect = rect;
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.setViewOffset(
      this.width,
      this.height,
      this.width / 2 - (rect.x + rect.w / 2),
      this.height / 2 - (rect.y + rect.h / 2),
      this.width,
      this.height,
    );
    this.camera.updateProjectionMatrix();
    this.fit();
    this.effects.setScale(this.height * this.renderer.getPixelRatio() / (2 * Math.tan(MathUtils.degToRad(this.camera.fov / 2))));
    this.frame();
  }

  /** The nearest distance at which a whole sea, with its letters, fits the rect. */
  private fit() {
    const half = SPAN / 2 + 0.1;
    let near = 5;
    let far = 80;
    const corners = [-half, half].flatMap((x) =>
      [-half, half].flatMap((z) => [0, 0.5].map((y) => new Vector3(x, y, z))),
    );
    for (let i = 0; i < 26; i++) {
      const mid = (near + far) / 2;
      this.place(0, mid);
      const ok = corners.every((c) => {
        const p = c.clone().project(this.camera);
        const sx = ((p.x + 1) / 2) * this.width;
        const sy = ((1 - p.y) / 2) * this.height;
        return (
          sx >= this.rect.x &&
          sx <= this.rect.x + this.rect.w &&
          sy >= this.rect.y &&
          sy <= this.rect.y + this.rect.h
        );
      });
      if (ok) far = mid;
      else near = mid;
    }
    this.distance = far;
  }

  private place(x: number, distance: number, sway = 0) {
    this.camera.position.set(x + sway * 0.25, Math.sin(PITCH) * distance, Math.cos(PITCH) * distance + 0.4);
    this.camera.lookAt(x, 0, 0.4);
    this.camera.updateMatrixWorld();
  }

  /** Which sea the camera is over (or heading to). */
  get focused(): Side {
    return this.look.to === CENTRE.home ? 'home' : 'enemy';
  }

  /** Glides the camera over `side`; resolves once it is there. */
  focus(side: Side, animate = true): Promise<void> {
    const to = CENTRE[side];
    const now = performance.now();
    if (this.look.to === to && (!animate || now - this.look.at >= PAN_MS)) return Promise.resolve();
    this.look = { from: animate ? this.lookX(now) : to, to, at: animate ? now : -Infinity };
    this.frame();
    return animate ? wait(PAN_MS) : Promise.resolve();
  }

  private lookX(now: number) {
    const t = easeInOut((now - this.look.at) / PAN_MS);
    return this.look.from + (this.look.to - this.look.from) * t;
  }

  /**
   * Shows a sea. With `animate`, new sinkings go down slowly and newly seen ships fade in;
   * without, everything is drawn as it is.
   */
  show(side: Side, sea: SeaPicture, animate: boolean) {
    const view = this.seas[side];
    const now = performance.now();
    view.marks = sea.marks;
    view.sunkCells = new Set();
    for (const ship of view.ships) {
      const at = sea.ships[ship.id] ?? null;
      const sunk = !!sea.sunk[ship.id];
      if (at && !ship.at) ship.shownAt = animate ? now : -Infinity;
      ship.at = at;
      if (sunk && ship.sunkAt === null) ship.sunkAt = animate ? now : -Infinity;
      if (!sunk) ship.sunkAt = null;
      ship.group.visible = !!at;
      if (at && sunk) for (const c of cellsOf(ship.id, at)) view.sunkCells.add(index(c));
    }
    view.chart.draw({ marks: sea.marks, scans: sea.scans, side, shade: null });
    this.frame();
  }

  /** Lights the cells a dragged ship would take, green or red. */
  shade(side: Side, sea: SeaPicture, cells: number[] | null, ok: boolean) {
    this.seas[side].chart.draw({
      marks: sea.marks,
      scans: sea.scans,
      side,
      shade: cells && { cells, ok },
    });
    this.frame();
  }

  /** Lifts a ship being dragged, tinted red where it may not go. */
  lift(side: Side, id: number, lifted: boolean, bad = false) {
    const ship = this.seas[side].ships[id];
    if (!ship) return;
    ship.lifted = lifted;
    ship.bad = bad;
    this.frame();
  }

  /** Shakes a ship that may not turn where it lies. */
  refuse(side: Side, id: number) {
    const ship = this.seas[side].ships[id];
    if (ship) ship.shakeAt = performance.now();
    this.frame();
  }

  /** The aim on a cell (a 3×3 frame for the radar), or none. */
  setAim(aim: { side: Side; p: Point; radar: boolean } | null) {
    this.aim = aim;
    this.frame();
  }

  /** The cell of `side`'s sea under a point of the canvas, or `null`. */
  cellAt(side: Side, px: number, py: number): Point | null {
    const ndc = new Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.ground, this.v);
    if (!hit) return null;
    const x = Math.floor(hit.x - (CENTRE[side] - SIZE / 2));
    const y = Math.floor(hit.z + SIZE / 2);
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? { x, y } : null;
  }

  /** The point on the water under the canvas point, in cells of `side` (fractional, unbounded). */
  pointAt(side: Side, px: number, py: number): { x: number; y: number } | null {
    const ndc = new Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.ground, this.v);
    if (!hit) return null;
    return { x: hit.x - (CENTRE[side] - SIZE / 2), y: hit.z + SIZE / 2 };
  }

  /** A shell from the far side of `target`'s neighbour onto cell `p`; resolves when it lands. */
  fire(target: Side, p: Point): Promise<void> {
    const to = cellWorld(target, p);
    const dir = target === 'enemy' ? -1 : 1;
    const from = new Vector3(to.x + dir * 13, 1.2, to.z + 3);
    return new Promise((resolve) => {
      this.shellFlight?.resolve();
      this.shellFlight = { from, to, at: performance.now(), resolve };
      this.shell.visible = true;
      this.frame();
    });
  }

  /** The water spouts at a miss. */
  splash(target: Side, p: Point) {
    const c = cellWorld(target, p);
    this.effects.splash(c.x, c.z, this.low ? 0.5 : 1);
    this.shakeBy(0.05, 250);
  }

  /** Fire at a hit; a bigger blast, then more along the ship, when it sinks. */
  explode(target: Side, p: Point, sunk: Point[] | null) {
    const c = cellWorld(target, p);
    this.effects.blast(c.x, 0.25, c.z, this.low ? 0.6 : 1);
    this.flashAt = performance.now();
    this.flash.position.set(c.x, 1.2, c.z);
    this.shakeBy(sunk ? 0.35 : 0.18, sunk ? 900 : 450);
    if (!sunk) return;
    sunk.forEach((cell, i) => {
      window.setTimeout(() => {
        const w = cellWorld(target, cell);
        this.effects.blast(w.x, 0.2, w.z, this.low ? 0.5 : 0.8);
        this.flashAt = performance.now();
        this.flash.position.set(w.x, 1.2, w.z);
      }, 260 + i * 180);
    });
  }

  /** The radar sweeps the 3×3 round `p`; resolves when it is done. */
  scan(target: Side, p: Point): Promise<void> {
    cellWorld(target, p, this.sweepCentre);
    this.sweepAt = performance.now();
    this.sweep.visible = true;
    this.frame();
    return wait(1300);
  }

  private shakeBy(power: number, ms: number) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.shakePower = Math.max(this.shakePower, power);
    this.shakeUntil = performance.now() + ms;
  }

  /** Stops drawing while the Hub's tab is hidden. */
  pause(paused: boolean) {
    this.paused = paused;
    if (paused && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    if (!paused) {
      this.last = performance.now();
      this.frame();
    }
  }

  /** Asks for frames: the sea always moves, so it keeps drawing until paused. */
  frame() {
    if (this.raf || this.paused) return;
    this.raf = requestAnimationFrame((now) => {
      this.raf = 0;
      this.draw(now);
      this.frame();
    });
  }

  private draw(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = (now - this.start) / 1000;
    this.water.tick(t);

    const sway = Math.sin(t * 0.35) * 0.4;
    this.place(this.lookX(now), this.distance, sway);
    if (now < this.shakeUntil) {
      const k = (this.shakeUntil - now) / 600;
      this.camera.position.x += Math.sin(now * 0.09) * this.shakePower * k;
      this.camera.position.y += Math.cos(now * 0.11) * this.shakePower * k * 0.6;
    } else this.shakePower = 0;

    for (const side of ['home', 'enemy'] as const) this.drawSea(this.seas[side], now, t, dt);
    this.drawAim(now);
    this.drawSweep(now);
    this.drawShell(now);
    const flash = Math.max(0, 1 - (now - this.flashAt) / 380);
    this.flash.intensity = flash * 40;
    this.effects.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private drawSea(sea: SeaView, now: number, t: number, dt: number) {
    const bob = (x: number, z: number) => Water.heightAt(x, z, t, this.calm);
    for (const ship of sea.ships) {
      if (!ship.at) continue;
      const { pos, heading } = shipPose(sea.side, ship.id, ship.at);
      const h = bob(pos.x, pos.z);
      const sinking = ship.sunkAt === null ? 0 : easeInOut((now - ship.sunkAt) / SINK_MS);
      const shake = Math.max(0, 1 - (now - ship.shakeAt) / 380);
      ship.group.position.set(
        pos.x + Math.sin(now * 0.08) * 0.08 * shake,
        h + (ship.lifted ? 0.35 : 0) - sinking * 0.3,
        pos.z,
      );
      ship.group.rotation.set(
        Math.sin(t * 0.9 + ship.phase) * 0.025 + sinking * 0.32,
        heading,
        Math.sin(t * 0.7 + ship.phase) * 0.012 - sinking * 0.1,
        'YXZ',
      );
      const fade = Math.min(1, (now - ship.shownAt) / REVEAL_MS);
      const dark = sinking * 0.55;
      for (const [key, m] of Object.entries(ship.look) as [keyof ShipLook, MeshStandardMaterial][]) {
        m.opacity = fade;
        m.depthWrite = fade > 0.98;
        const base = BASE[key];
        m.color.copy(base).lerp(CHAR, dark);
        if (ship.bad) m.color.lerp(BAD, 0.55);
        m.emissive.set(ship.lifted && !ship.bad ? '#1b3a4a' : '#000000');
      }
    }

    let misses = 0;
    let hits = 0;
    for (const [i, mark] of sea.marks.entries()) {
      if (mark !== Miss && mark !== Hit) continue;
      const p = { x: i % SIZE, y: Math.floor(i / SIZE) };
      const w = cellWorld(sea.side, p, this.v);
      const h = bob(w.x, w.z);
      const covered = mark === Hit && this.shipCovers(sea, i);
      if (mark === Miss) {
        this.dummy.position.set(w.x, h, w.z);
        this.dummy.rotation.set(Math.sin(t * 1.3 + i) * 0.08, 0, Math.cos(t * 1.1 + i) * 0.08);
        this.dummy.updateMatrix();
        sea.misses.setMatrixAt(misses++, this.dummy.matrix);
        continue;
      }
      if (!covered) {
        this.dummy.position.set(w.x, h, w.z);
        this.dummy.rotation.set(Math.sin(t * 1.2 + i) * 0.1, 0, Math.cos(t + i) * 0.1);
        this.dummy.updateMatrix();
        sea.hits.setMatrixAt(hits++, this.dummy.matrix);
      }
      const sunk = sea.sunkCells.has(i);
      if (!this.low || !sunk) {
        this.effects.burn(w.x, h + (covered ? 0.24 : 0.3), w.z, dt, !sunk, sunk ? 0.5 : 1);
      }
    }
    sea.misses.count = misses;
    sea.hits.count = hits;
    sea.misses.instanceMatrix.needsUpdate = true;
    sea.hits.instanceMatrix.needsUpdate = true;
  }

  private shipCovers(sea: SeaView, cell: number) {
    for (const ship of sea.ships) {
      if (ship.at && cellsOf(ship.id, ship.at).some((c) => index(c) === cell)) return true;
    }
    return false;
  }

  private drawAim(now: number) {
    const aim = this.aim;
    this.reticle.visible = !!aim;
    if (!aim) return;
    const span = aim.radar ? 3 : 1;
    const c = cellWorld(aim.side, aim.p, this.v);
    const pulse = 1 + Math.sin(now * 0.008) * 0.05;
    this.reticle.position.set(c.x, 0.09, c.z);
    this.reticle.scale.set(span * pulse, span * pulse, 1);
    (this.reticle.material as MeshBasicMaterial).color.set(aim.radar ? RADAR : '#ffd166');
  }

  private drawSweep(now: number) {
    const age = (now - this.sweepAt) / 1300;
    this.sweep.visible = age >= 0 && age < 1;
    if (!this.sweep.visible) return;
    this.sweep.position.set(this.sweepCentre.x, 0.12, this.sweepCentre.z);
    this.sweep.rotation.z = age * Math.PI * 4;
    const s = 2.1 * Math.min(1, age * 3);
    this.sweep.scale.set(s, s, 1);
    (this.sweep.material as MeshBasicMaterial).opacity = 0.55 * (1 - age);
  }

  private drawShell(now: number) {
    const flight = this.shellFlight;
    if (!flight) return;
    const t = Math.min(1, (now - flight.at) / SHELL_MS);
    const { from, to } = flight;
    const arc = (k: number, out: Vector3) =>
      out.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + Math.sin(Math.PI * k) * 5.5, from.z + (to.z - from.z) * k);
    const p = arc(t, new Vector3());
    const ahead = arc(Math.min(1, t + 0.02), new Vector3());
    this.shell.position.copy(p);
    this.shell.lookAt(ahead);
    this.effects.trail(p.x, p.y, p.z);
    if (t >= 1) {
      this.shell.visible = false;
      this.shellFlight = null;
      flight.resolve();
    }
  }
}

const BASE: Record<keyof ShipLook, Color> = (() => {
  const look = shipLook();
  return Object.fromEntries(Object.entries(look).map(([k, m]) => [k, m.color.clone()])) as Record<
    keyof ShipLook,
    Color
  >;
})();
const CHAR = new Color('#1d1b1a');
const BAD = new Color('#d0402a');

/** Corner brackets and a dot: the aim on a cell. */
function reticleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 16;
  g.lineCap = 'round';
  const a = 24;
  const b = 92;
  for (const [x, y, dx, dy] of [
    [a, a, 1, 1],
    [256 - a, a, -1, 1],
    [a, 256 - a, 1, -1],
    [256 - a, 256 - a, -1, -1],
  ] as const) {
    g.beginPath();
    g.moveTo(x, y + dy * (b - a));
    g.lineTo(x, y);
    g.lineTo(x + dx * (b - a), y);
    g.stroke();
  }
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(128, 128, 12, 0, Math.PI * 2);
  g.fill();
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const easeInOut = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
};

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

