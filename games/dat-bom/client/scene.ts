/**
 * The arena in Three.js: a low-poly stone yard at dusk, built from primitives in code (no model
 * files). `ArenaView.draw` takes the picture of one frame and moves the meshes to match it.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  type Material,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  BLAST_TICKS,
  BOMB_DAMAGE,
  type Cell,
  COLS,
  type Dir,
  FUSE_TICKS,
  ROWS,
  type Tile,
} from '../server/game/model.js';
import type { Position } from './predict.js';
import type { DrawnBlast, DrawnPlayer, Picture } from './sync.js';

/** One colour per seat: muted, so a character reads at a glance without glowing. */
export const SEAT_COLORS = ['#e0553d', '#4a8fe0', '#e8c04a', '#58b368'] as const;

const HALF_W = COLS / 2;
const HALF_H = ROWS / 2;
/** Camera pitch above the floor, radians. */
const PITCH = MathUtils.degToRad(63);
/** How much of the half-screen the arena may fill. */
const FIT = 0.97;
const MAX_PARTICLES = 160;
const GRAVITY = 14;
const BLAST_LIGHTS = 3;
const HP_PIPS = 3;
/** Characters are drawn a little larger than a cell so they read on a phone. */
const FIGHTER_SCALE = 1.3;

/** A cell's centre on the floor, in world units (x right, z towards the camera). */
const worldX = (cell: number) => cell - HALF_W;
const worldZ = (cell: number) => cell - HALF_H;

const flat = (color: string, extra: { roughness?: number; emissive?: string } = {}) =>
  new MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: extra.roughness ?? 0.85,
    metalness: 0.02,
    ...(extra.emissive && { emissive: extra.emissive }),
  });

/** Moves `angle` towards `target` by at most `step`, the short way round. */
function turnTo(angle: number, target: number, step: number) {
  const delta = MathUtils.euclideanModulo(target - angle + Math.PI, Math.PI * 2) - Math.PI;
  return angle + Math.max(-step, Math.min(step, delta));
}

interface Fighter {
  group: Group;
  body: Group;
  pips: Mesh[];
  marker: Mesh | null;
  facing: number;
  last: Position | null;
  /** 1 while on the arena, shrinking to 0 once knocked out. */
  presence: number;
  wasOut: boolean;
}

interface BombMesh {
  group: Group;
  ball: Mesh;
  spark: Mesh;
  material: MeshStandardMaterial;
}

interface Fire {
  group: Group;
  cells: Mesh[];
  inner: Mesh[];
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  span: number;
}

/** What `draw` needs for one frame. */
export interface FrameInput {
  picture: Picture;
  /** The viewer's seat; `-1` for none. */
  me: number;
  /** Where to draw the viewer's character instead of the snapshot's (prediction). */
  mine: Position | null;
  /** The direction the viewer is holding. */
  held: Dir;
  /** Bombs the viewer just placed that the server has not confirmed. */
  ghosts: { cell: Cell; fuse: number }[];
  /** Local time, ms. */
  now: number;
  /** Seconds since the last frame. */
  dt: number;
}

export class ArenaView {
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(36, 1, 0.5, 80);
  private readonly cameraDir = new Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
  private distance = 20;
  private readonly fighters: Fighter[] = [];
  private readonly bombs = new Map<number | string, BombMesh>();
  private readonly fires = new Map<string, Fire>();
  private readonly lights: PointLight[] = [];
  private readonly crates: InstancedMesh;
  private readonly bands: InstancedMesh;
  private readonly bits: InstancedMesh;
  private readonly particles: Particle[] = [];
  private cratesKey = '';
  private lastRows: string[] | null = null;
  private shake = 0;
  private readonly calm: boolean;
  private slow = 0;
  private ratio: number;
  private width = 1;
  private height = 1;
  private readonly bombBall = new IcosahedronGeometry(0.3, 1);
  private readonly bombCap = new CylinderGeometry(0.07, 0.09, 0.12, 6);
  private readonly spark = new IcosahedronGeometry(0.07, 0);
  private readonly capMaterial = flat('#6b5a43');
  private readonly sparkMaterial = new MeshBasicMaterial({ color: '#ffb347' });
  private readonly fireGeometry = new BoxGeometry(0.88, 0.5, 0.88);
  private readonly fireMaterial = new MeshBasicMaterial({ color: '#ff8a2a' });
  private readonly coreGeometry = new BoxGeometry(0.58, 0.56, 0.58);
  private readonly coreMaterial = new MeshBasicMaterial({ color: '#fff0b8' });
  private readonly scratch = new Matrix4();
  private readonly quat = new Quaternion();
  private readonly spot = new Vector3();
  private readonly bulk = new Vector3();
  private readonly tint = new Color();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly colors: readonly string[] = SEAT_COLORS,
  ) {
    this.calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.ratio = Math.min(devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.shadowMap.enabled = true;
    this.scene.background = new Color('#12141c');

    this.scene.add(new HemisphereLight('#aab6d8', '#2a2230', 1.1));
    this.scene.add(new AmbientLight('#3a3f55', 0.6));
    const sun = new DirectionalLight('#ffd9a8', 2.4);
    sun.position.set(-6, 11, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 7, bottom: -7, near: 1, far: 30 });
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    for (let i = 0; i < BLAST_LIGHTS; i++) {
      const light = new PointLight('#ff9640', 0, 6, 2);
      light.position.set(0, 1, 0);
      this.lights.push(light);
      this.scene.add(light);
    }

    this.buildGround();
    const crate = new BoxGeometry(0.84, 0.84, 0.84);
    this.crates = this.instanced(crate, flat('#a8743f'), COLS * ROWS);
    this.bands = this.instanced(new BoxGeometry(0.9, 0.14, 0.9), flat('#80532c'), COLS * ROWS);
    this.crates.castShadow = true;
    this.crates.receiveShadow = true;
    this.crates.count = 0;
    this.bands.count = 0;

    const dust = new BoxGeometry(1, 1, 1);
    this.bits = new InstancedMesh(dust, new MeshBasicMaterial(), MAX_PARTICLES);
    this.bits.frustumCulled = false;
    this.scene.add(this.bits);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.bits.setColorAt(i, this.tint.set('#ffffff'));
      this.particles.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, life: 0, span: 1 });
    }
  }

  private instanced(geometry: BoxGeometry, material: Material, count: number) {
    const mesh = new InstancedMesh(geometry, material, count);
    this.scene.add(mesh);
    return mesh;
  }

  /** The floor, the rim round it and the pillars (which never change). */
  private buildGround() {
    const base = new Mesh(new PlaneGeometry(60, 60), flat('#161923'));
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.31;
    base.receiveShadow = true;
    this.scene.add(base);

    const slab = new BoxGeometry(1, 0.3, 1);
    const floor = new InstancedMesh(slab, flat('#ffffff', { roughness: 0.95 }), COLS * ROWS);
    floor.receiveShadow = true;
    const a = new Color('#4c546a');
    const b = new Color('#434a5e');
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        floor.setMatrixAt(i, this.scratch.makeTranslation(worldX(x + 0.5), -0.15, worldZ(y + 0.5)));
        floor.setColorAt(i, (x + y) % 2 ? a : b);
      }
    }
    this.scene.add(floor);

    const rim = flat('#2b2f3f');
    const thick = 0.6;
    for (const [w, d, x, z] of [
      [COLS + thick * 2, thick, 0, -HALF_H - thick / 2],
      [COLS + thick * 2, thick, 0, HALF_H + thick / 2],
      [thick, ROWS, -HALF_W - thick / 2, 0],
      [thick, ROWS, HALF_W + thick / 2, 0],
    ] as const) {
      const wall = new Mesh(new BoxGeometry(w, 0.55, d), rim);
      wall.position.set(x, 0.12, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
    }

    const pillars: Cell[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) if (x % 2 === 1 && y % 2 === 1) pillars.push({ x, y });
    const post = this.instanced(new BoxGeometry(0.9, 1, 0.9), flat('#5d6478'), pillars.length);
    const cap = this.instanced(new BoxGeometry(0.98, 0.12, 0.98), flat('#838aa0'), pillars.length);
    pillars.forEach(({ x, y }, i) => {
      post.setMatrixAt(i, this.scratch.makeTranslation(worldX(x + 0.5), 0.5, worldZ(y + 0.5)));
      cap.setMatrixAt(i, this.scratch.makeTranslation(worldX(x + 0.5), 1.02, worldZ(y + 0.5)));
    });
    for (const mesh of [post, cap]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  }

  /** Sizes the canvas and fits the whole arena in view. */
  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.fit();
  }

  /** Finds the nearest camera distance at which every corner of the arena is on screen. */
  private fit() {
    const corners: Vector3[] = [];
    for (const x of [-HALF_W - 0.35, HALF_W + 0.35]) {
      for (const z of [-HALF_H - 0.35, HALF_H + 0.35]) {
        for (const y of [-0.3, 1.5]) corners.push(new Vector3(x, y, z));
      }
    }
    let near = 4;
    let far = 60;
    const probe = new Vector3();
    for (let i = 0; i < 24; i++) {
      const mid = (near + far) / 2;
      this.camera.position.copy(this.cameraDir).multiplyScalar(mid);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateMatrixWorld(true);
      const widest = Math.max(
        ...corners.map((c) => {
          probe.copy(c).project(this.camera);
          return Math.max(Math.abs(probe.x), Math.abs(probe.y));
        }),
      );
      if (widest <= FIT) far = mid;
      else near = mid;
    }
    this.distance = far;
    this.placeCamera(0, 0);
  }

  private placeCamera(shakeX: number, shakeZ: number) {
    this.camera.position.copy(this.cameraDir).multiplyScalar(this.distance);
    this.camera.position.x += shakeX;
    this.camera.position.z += shakeZ;
    this.camera.lookAt(shakeX * 0.5, 0, shakeZ * 0.5);
  }

  private makeFighter(seat: number): Fighter {
    const color = this.colors[seat % this.colors.length] as string;
    const group = new Group();
    const body = new Group();
    const suit = flat(color);
    const dark = flat('#262a36');
    const skin = flat('#f1dcc0');

    const torso = new Mesh(new CylinderGeometry(0.2, 0.27, 0.44, 6), suit);
    torso.position.y = 0.34;
    const head = new Mesh(new IcosahedronGeometry(0.23, 0), skin);
    head.position.y = 0.72;
    const hood = new Mesh(new CylinderGeometry(0.245, 0.245, 0.14, 6), suit);
    hood.position.y = 0.83;
    const visor = new Mesh(new BoxGeometry(0.3, 0.1, 0.12), dark);
    visor.position.set(0, 0.72, 0.17);
    const bag = new Mesh(new BoxGeometry(0.22, 0.26, 0.12), dark);
    bag.position.set(0, 0.38, -0.25);
    const feet = [-0.1, 0.1].map((x) => {
      const foot = new Mesh(new BoxGeometry(0.14, 0.1, 0.22), dark);
      foot.position.set(x, 0.05, 0.02);
      return foot;
    });
    body.add(torso, head, hood, visor, bag, ...feet);
    for (const part of body.children) part.castShadow = true;
    group.add(body);

    const pips: Mesh[] = [];
    for (let i = 0; i < HP_PIPS; i++) {
      const pip = new Mesh(new BoxGeometry(0.11, 0.11, 0.11), new MeshBasicMaterial({ color }));
      pip.position.set((i - (HP_PIPS - 1) / 2) * 0.16, 1.18, 0);
      group.add(pip);
      pips.push(pip);
    }
    this.scene.add(group);
    return { group, body, pips, marker: null, facing: 0, last: null, presence: 1, wasOut: false };
  }

  private makeBomb(): BombMesh {
    const group = new Group();
    const material = flat('#23252e', { emissive: '#000000' });
    const ball = new Mesh(this.bombBall, material);
    ball.position.y = 0.32;
    ball.castShadow = true;
    const cap = new Mesh(this.bombCap, this.capMaterial);
    cap.position.y = 0.62;
    const spark = new Mesh(this.spark, this.sparkMaterial);
    spark.position.y = 0.74;
    group.add(ball, cap, spark);
    this.scene.add(group);
    return { group, ball, spark, material };
  }

  private makeFire(cells: readonly Cell[]): Fire {
    const group = new Group();
    const outer: Mesh[] = [];
    const inner: Mesh[] = [];
    for (const c of cells) {
      const cell = new Mesh(this.fireGeometry, this.fireMaterial);
      cell.position.set(worldX(c.x + 0.5), 0.25, worldZ(c.y + 0.5));
      const core = new Mesh(this.coreGeometry, this.coreMaterial);
      core.position.copy(cell.position);
      group.add(cell, core);
      outer.push(cell);
      inner.push(core);
    }
    this.scene.add(group);
    return { group, cells: outer, inner };
  }

  /** Throws `count` cubes of `color` from a point on the floor. */
  private burst(
    x: number,
    z: number,
    colors: readonly string[],
    count: number,
    speed: number,
    rise: number,
  ) {
    let made = 0;
    for (let i = 0; i < this.particles.length && made < count; i++) {
      const p = this.particles[i] as Particle;
      if (p.life > 0) continue;
      const angle = Math.random() * Math.PI * 2;
      const push = speed * (0.4 + Math.random() * 0.6);
      Object.assign(p, {
        x,
        y: 0.3 + Math.random() * 0.3,
        z,
        vx: Math.cos(angle) * push,
        vy: rise * (0.5 + Math.random()),
        vz: Math.sin(angle) * push,
        size: 0.07 + Math.random() * 0.09,
        span: 0.5 + Math.random() * 0.4,
        life: 0.5 + Math.random() * 0.4,
      });
      p.span = p.life;
      this.bits.setColorAt(
        i,
        this.tint.set(colors[Math.floor(Math.random() * colors.length)] as string),
      );
      made++;
    }
    if (this.bits.instanceColor) this.bits.instanceColor.needsUpdate = true;
  }

  private stepParticles(dt: number) {
    this.particles.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= GRAVITY * dt;
        p.x += p.vx * dt;
        p.y = Math.max(0.04, p.y + p.vy * dt);
        p.z += p.vz * dt;
        if (p.y <= 0.04) {
          p.vx *= 0.6;
          p.vz *= 0.6;
          p.vy = 0;
        }
      }
      const size = p.life > 0 ? p.size * Math.min(1, (p.life / p.span) * 2) : 0;
      this.scratch.compose(
        this.spot.set(p.x, p.y, p.z),
        this.quat,
        this.bulk.set(size, size, size),
      );
      this.bits.setMatrixAt(i, this.scratch);
    });
    this.bits.instanceMatrix.needsUpdate = true;
  }

  /** Puts the crates on the arena where the rows say, bursting the ones that are gone. */
  private syncCrates(rows: readonly string[]) {
    const key = rows.join('');
    if (key === this.cratesKey) return;
    const before = this.lastRows;
    let n = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = (rows[y]?.[x] ?? '#') as Tile;
        if (tile === 'c') {
          this.scratch.makeTranslation(worldX(x + 0.5), 0.42, worldZ(y + 0.5));
          this.crates.setMatrixAt(n, this.scratch);
          this.bands.setMatrixAt(n, this.scratch);
          n++;
        } else if (before && before[y]?.[x] === 'c') {
          this.burst(
            worldX(x + 0.5),
            worldZ(y + 0.5),
            ['#b9824a', '#80532c', '#d9a36a'],
            9,
            3.2,
            5,
          );
        }
      }
    }
    this.crates.count = n;
    this.bands.count = n;
    this.crates.instanceMatrix.needsUpdate = true;
    this.bands.instanceMatrix.needsUpdate = true;
    this.cratesKey = key;
    this.lastRows = [...rows];
  }

  private syncFighters(input: FrameInput) {
    const { picture, me, mine, held, now, dt } = input;
    while (this.fighters.length < picture.players.length) {
      this.fighters.push(this.makeFighter(this.fighters.length));
    }
    picture.players.forEach((player, seat) => {
      const fighter = this.fighters[seat] as Fighter;
      const useMine = seat === me && mine !== null && player.out === null;
      const at = useMine ? mine : { x: player.x, y: player.y };
      const walking = useMine ? held !== 'none' : player.walking;
      this.moveFighter(fighter, player, at, walking, seat === me, now, dt);
    });
  }

  private moveFighter(
    fighter: Fighter,
    player: DrawnPlayer,
    at: Position,
    walking: boolean,
    mine: boolean,
    now: number,
    dt: number,
  ) {
    const { group, body } = fighter;
    const out = player.out !== null;
    if (out && !fighter.wasOut) {
      this.burst(
        worldX(at.x),
        worldZ(at.y),
        [this.colors[player.seat % this.colors.length] as string, '#f1dcc0', '#262a36'],
        16,
        3.6,
        6,
      );
      this.shake = Math.max(this.shake, 0.2);
    }
    fighter.wasOut = out;
    fighter.presence = MathUtils.clamp(fighter.presence + (out ? -dt * 4 : dt * 4), 0, 1);
    group.visible = fighter.presence > 0.01;
    group.scale.setScalar(Math.max(0.001, fighter.presence) * FIGHTER_SCALE);

    const dx = fighter.last ? at.x - fighter.last.x : 0;
    const dz = fighter.last ? at.y - fighter.last.y : 0;
    fighter.last = { x: at.x, y: at.y };
    if (Math.hypot(dx, dz) > 1e-4 && dt > 0) {
      fighter.facing = turnTo(fighter.facing, Math.atan2(dx, dz), dt * 18);
    }
    const bob = walking ? Math.abs(Math.sin(now / 75)) * 0.07 : Math.sin(now / 420) * 0.015;
    group.position.set(worldX(at.x), 0, worldZ(at.y));
    body.position.y = bob;
    body.rotation.y = fighter.facing;
    body.rotation.z = walking ? Math.sin(now / 75) * 0.06 : 0;
    // A hit player blinks for as long as they are protected.
    body.visible = player.guard <= 0 || Math.floor(now / 70) % 2 === 0;

    const alive = Math.ceil(Math.max(0, player.hp) / BOMB_DAMAGE);
    fighter.pips.forEach((pip, i) => {
      const material = pip.material as MeshBasicMaterial;
      material.color.set(
        i < alive ? (this.colors[player.seat % this.colors.length] as string) : '#2b2e3a',
      );
    });
    if (mine && !fighter.marker) {
      fighter.marker = new Mesh(
        new ConeGeometry(0.13, 0.2, 3),
        new MeshBasicMaterial({ color: '#ffffff' }),
      );
      fighter.marker.rotation.x = Math.PI;
      fighter.group.add(fighter.marker);
    }
    if (fighter.marker) fighter.marker.position.y = 1.5 + Math.sin(now / 260) * 0.05;
  }

  private syncBombs(input: FrameInput) {
    const { picture, ghosts, now } = input;
    const seen = new Set<number | string>();
    const place = (id: number | string, cell: Cell, fuse: number) => {
      seen.add(id);
      let bomb = this.bombs.get(id);
      if (!bomb) {
        bomb = this.makeBomb();
        this.bombs.set(id, bomb);
      }
      const left = Math.max(0, fuse) / FUSE_TICKS;
      const rate = 6 + (1 - left) * 22;
      const pulse = 1 + 0.07 * Math.sin((now / 1000) * rate);
      bomb.group.position.set(worldX(cell.x + 0.5), 0, worldZ(cell.y + 0.5));
      bomb.group.scale.set(pulse, 1 / pulse, pulse);
      const glow = left < 0.28 ? 0.5 + 0.5 * Math.sin((now / 1000) * rate * 1.6) : 0;
      bomb.material.emissive.setRGB(glow * 0.9, glow * 0.35, glow * 0.1);
      bomb.spark.scale.setScalar(0.8 + 0.5 * Math.abs(Math.sin(now / 55)));
    };
    for (const b of picture.bombs) place(b.id, b, b.fuse);
    for (const [i, g] of ghosts.entries()) place(`ghost${i}`, g.cell, g.fuse);
    for (const [id, bomb] of this.bombs) {
      if (seen.has(id)) continue;
      this.scene.remove(bomb.group);
      bomb.material.dispose();
      this.bombs.delete(id);
    }
  }

  private syncFire(picture: Picture) {
    const seen = new Set<string>();
    const lit = [...picture.blasts].sort((a, b) => b.left - a.left);
    this.lights.forEach((light, i) => {
      const blast = lit[i];
      const life = blast ? Math.max(0, blast.left) / BLAST_TICKS : 0;
      const centre = blast?.cells[0];
      if (centre) light.position.set(worldX(centre.x + 0.5), 1.1, worldZ(centre.y + 0.5));
      light.intensity = blast ? 14 * life : 0;
    });
    for (const blast of picture.blasts) {
      const first = blast.cells[0];
      const key = `${blast.began}:${first?.x},${first?.y}`;
      seen.add(key);
      let fire = this.fires.get(key);
      if (!fire) {
        fire = this.makeFire(blast.cells);
        this.fires.set(key, fire);
        this.flash(blast);
      }
      const life = MathUtils.clamp(blast.left / BLAST_TICKS, 0, 1);
      const grow = 0.55 + 0.45 * Math.sin(Math.min(1, life * 1.4 + 0.05) * Math.PI * 0.5);
      for (const mesh of fire.cells) mesh.scale.set(grow, 0.4 + life * 0.9, grow);
      for (const mesh of fire.inner) mesh.scale.set(grow * life, 0.3 + life, grow * life);
    }
    for (const [key, fire] of this.fires) {
      if (seen.has(key)) continue;
      this.scene.remove(fire.group);
      this.fires.delete(key);
    }
  }

  /** The first frame of an explosion: sparks and a knock on the camera. */
  private flash(blast: DrawnBlast) {
    for (const c of blast.cells) {
      this.burst(
        worldX(c.x + 0.5),
        worldZ(c.y + 0.5),
        ['#ffb347', '#ff7a2a', '#fff0b8'],
        2,
        2.2,
        4.5,
      );
    }
    this.shake = Math.max(this.shake, 0.14);
  }

  /** Draws the empty arena, before any snapshot has come. */
  idle() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Draws one frame. */
  draw(input: FrameInput) {
    const { dt } = input;
    this.syncCrates(input.picture.rows);
    this.syncFighters(input);
    this.syncBombs(input);
    this.syncFire(input.picture);
    this.stepParticles(dt);

    this.shake *= 0.86 ** (dt * 60);
    if (this.calm || this.shake < 0.004) this.placeCamera(0, 0);
    else this.placeCamera((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    this.renderer.render(this.scene, this.camera);
    this.govern(dt);
  }

  /** Lowers the render resolution when frames keep taking too long (a slow phone). */
  private govern(dt: number) {
    this.slow = dt > 0.026 ? this.slow + 1 : Math.max(0, this.slow - 1);
    if (this.slow > 45 && this.ratio > 1) {
      this.ratio = Math.max(1, this.ratio - 0.5);
      this.slow = 0;
      this.resize(this.width, this.height);
    }
  }
}
