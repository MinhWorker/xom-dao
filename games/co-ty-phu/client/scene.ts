/**
 * The board in Three.js, after the approved prototype (#351): the printed board floating in
 * space, the Lots in their owners' colours, the tokens, the dice and the decks. `show` puts
 * everything where a view says; `roll`, `walk`, `jump`, `release` and `build` play the moves
 * between views, with the camera following what moves, and `fullSet`, `fall` and `victory` the
 * moments the whole table shouts at (#355).
 */

import type { BridgeGraphics } from '@xomdao/bridge';
import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
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
  QuadraticBezierCurve3,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { AIRPORT_TILE, BOARD } from '../server/game/board.js';
import { isFullSet, isMonopoly } from '../server/game/economy.js';
import { HOTEL, type Lot, type View } from '../server/game/model.js';
import { ambience } from './ambience.js';
import { Marquee } from './lights.js';
import { cage, DIE, die, hotel, house, plane, token, WINGTIPS } from './pieces.js';
import type { Change } from './present.js';
import { BAND, bandRect, cardBack, placement, printBoard, SET_COLORS, SIDE } from './print.js';

export const SEAT_COLORS = ['#e0553d', '#4a8fe0', '#e8c04a', '#58b368'] as const;

const PITCH = MathUtils.degToRad(56);
const FOV = 30;
/** How much of the screen the board may fill, per axis (NDC): the sides keep the player cards. */
const FIT = [0.62, 0.98] as const;
const PIECE_TOP = 0.8;
const BOARD_H = 0.22;
const GOLD = '#e6b422';
/** How much nearer the camera comes to a token it follows (0 stays, 1 is on it). */
const CLOSE = 0.32;

type JumpHow = Extract<Change, { kind: 'jump' }>['how'];

/** The colour of a line printed in the middle of the board. */
export type Tone = 'plain' | 'gold' | 'good' | 'bad';
const TONES: Record<Tone, string> = {
  plain: '#f4ecd8',
  gold: '#f6d77a',
  good: '#8fe39e',
  bad: '#ff6a4f',
};
/** The printed middle: between the decks and the dice, in board units and canvas pixels. */
const NOTICE = { w: 7.2, h: 2.9, z: -0.45, px: 200 } as const;

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

/** A thrown die's height over time: a fall, then two smaller bounces. */
const bounce = (k: number) => {
  if (k < 0.45) return 1.8 * (1 - (k / 0.45) ** 2);
  const hop = (a: number, b: number, h: number) =>
    k >= a && k < b ? h * Math.sin(((k - a) / (b - a)) * Math.PI) : 0;
  return hop(0.45, 0.72, 0.5) + hop(0.72, 0.88, 0.14);
};

/** Lands with a few bounces, like a dropped weight. */
const bounceOut = (k: number) => {
  const n = 7.5625;
  if (k < 1 / 2.75) return n * k * k;
  if (k < 2 / 2.75) return n * (k - 1.5 / 2.75) ** 2 + 0.75;
  if (k < 2.5 / 2.75) return n * (k - 2.25 / 2.75) ** 2 + 0.9375;
  return n * (k - 2.625 / 2.75) ** 2 + 0.984375;
};

/** Overshoots a little before it settles. */
const backOut = (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

const smooth = (k: number) => k * k * (3 - 2 * k);

/** The buildings a Lot stands with: houses 1 to its Level, or the Hotel alone. */
const buildings = (lot: Lot | null) =>
  !lot ? [] : lot.level >= HOTEL ? [HOTEL] : Array.from({ length: lot.level }, (_, k) => k + 1);

/** A line printed in the middle of the board: `big` for the moments the table shouts at. */
export interface Line {
  title: string;
  sub?: string;
  tone?: Tone;
  big?: boolean;
  blink?: boolean;
}

/** How long a `say` shows, besides the line. */
type Say = Omit<Line, 'title' | 'blink'> & { ms?: number };

const DUST = new SphereGeometry(0.05, 8, 6);
const RING = new RingGeometry(0.32, 0.42, 40);
const SPARK = new PlaneGeometry(0.07, 0.11);
/** A light running along a flight's aim. */
const DOT = new SphereGeometry(0.05, 10, 8);
const BEAM = new CylinderGeometry(0.34, 0.5, 4, 24, 1, true);
BEAM.translate(0, 2, 0);
const CONFETTI = ['#e0553d', '#4a8fe0', '#e8c04a', '#58b368', '#fff2c2', '#e6b422'];

interface Tween {
  start: number;
  ms: number;
  step: (k: number) => void;
  done: () => void;
}

const ease = (k: number) => 1 - (1 - k) ** 3;
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

export class BoardView {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 844 / 390, 0.5, 200);
  private readonly world = new Group();
  private readonly lots = new Group();
  private readonly marks = new Group();
  /** What only lives while a move plays: dust, trails, a sinking house, the Card drawn. */
  private readonly fx = new Group();
  private readonly sun: DirectionalLight;
  private readonly tokens: Group[] = [];
  private readonly cages: ReturnType<typeof cage>[] = [];
  private readonly dice: Mesh[];
  /** The dice cast no shadow: a soft dark patch under each, darkest on the board, fading as it rises. */
  private readonly contacts: Mesh[];
  private readonly glow: Mesh[] = [];
  private readonly tick: (t?: number, neon?: number) => void;
  private readonly tweens: Tween[] = [];
  private readonly ray = new Raycaster();
  private readonly ground = new Plane(new Vector3(0, 1, 0), -BOARD_H);
  /** Where each seat's token stands, `null` when it is off the board. */
  private spots: (number | null)[] = [];
  private picking: number[] = [];
  /** Tiles picked for a sale: a steady gold glow and their tags. */
  private chosen: number[] = [];
  /** The Tile a flight is aimed at under the mouse (`aim`): lit, with an arc to it from Sân bay. */
  private aimed: number | null = null;
  private readonly route = new Group();
  private routePath: QuadraticBezierCurve3 | null = null;
  private readonly routeDots: Mesh[] = [];
  /** The arrows bobbing over the Tiles to pick for a sale, and the tags over those picked. */
  private readonly pointers = new Group();
  private arrows: Sprite[] = [];
  private paused = false;
  /** Bumped by `stop`: a walk under way gives up. */
  private generation = 0;
  private low = false;
  /** Until when (ms) Xuất phát's arrow blinks neon, while it pays (`payday`). */
  private neonUntil = 0;
  private wasLit = false;
  /** Whether the camera follows what moves (the player's preference). */
  private following = true;
  /** How fast moves play (1 is normal, lower is faster): the camera and dust keep up with it. */
  private pace = 1;
  private size: [number, number] = [844, 390];
  /** The camera's place over the whole board, and what it looks at from there. */
  private readonly home = { pos: new Vector3(), target: new Vector3() };
  /** The token the camera follows, and how far it has come towards it (0 to 1). */
  private focus: Object3D | null = null;
  private zoom = 0;
  private readonly look = new Vector3();
  private lastFrame = 0;
  /** The marquee bulbs round the board's rim (`lights.ts`), which the big moments take over. */
  private readonly marquee = new Marquee(halo());
  /** The middle of the board, where events are printed (`say`). */
  private readonly notice: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly noticeInk: CanvasRenderingContext2D;
  /** Bumped by every `say`: an older line stops fading itself. */
  private saying = 0;
  /** A `say` is showing. */
  private speaking = false;
  /** What `status` keeps printed between `say`s. */
  private standing: Line | null = null;
  /** The dice hop, waiting for a tap. */
  private inviting = false;
  /** The plane that flies from Sân bay, hidden between flights. */
  private readonly aircraft = plane();
  /** The camera shakes until `until` (performance.now ms), fading over its last `ms`. */
  private shaking = { until: 0, strength: 0, ms: 320 };
  /** The last frame shook, so this one puts the camera back. */
  private shook = false;

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
    this.sun = sun;
    sun.position.set(-6, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -10;
    sun.shadow.camera.right = sun.shadow.camera.top = 10;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(this.world);
    this.marquee.setHeight(BOARD_H);

    const base = new Mesh(
      new BoxGeometry(SIDE + 0.4, BOARD_H, SIDE + 0.4),
      new MeshStandardMaterial({ color: '#232036', roughness: 0.4, metalness: 0.3 }),
    );
    base.position.y = BOARD_H / 2;
    base.castShadow = base.receiveShadow = true;
    const printed = new CanvasTexture(printBoard(336, false));
    printed.colorSpace = SRGBColorSpace;
    printed.anisotropy = anisotropy;
    const top = new Mesh(
      new PlaneGeometry(SIDE, SIDE),
      new MeshStandardMaterial({ roughness: 0.85, map: printed }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = BOARD_H + 0.001;
    top.receiveShadow = true;
    this.aircraft.scale.setScalar(1.6);
    this.aircraft.visible = false;
    const ink = document.createElement('canvas');
    ink.width = NOTICE.w * NOTICE.px;
    ink.height = NOTICE.h * NOTICE.px;
    this.noticeInk = ink.getContext('2d') as CanvasRenderingContext2D;
    const inkMap = new CanvasTexture(ink);
    inkMap.colorSpace = SRGBColorSpace;
    inkMap.anisotropy = anisotropy;
    this.notice = new Mesh(
      new PlaneGeometry(NOTICE.w, NOTICE.h),
      new MeshBasicMaterial({ map: inkMap, transparent: true, depthWrite: false, opacity: 0 }),
    );
    this.notice.rotation.x = -Math.PI / 2;
    this.notice.position.set(0, BOARD_H + 0.006, NOTICE.z);
    this.notice.renderOrder = 3;
    this.world.add(
      base,
      top,
      this.route,
      this.marquee.group,
      this.pointers,
      this.notice,
      this.lots,
      this.marks,
      this.fx,
      this.aircraft,
    );

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
      d.castShadow = false;
      d.rotation.order = 'YXZ';
      d.position.set(rest.x, BOARD_H + DIE / 2, rest.z);
      this.world.add(d);
      return d;
    });
    this.setDice([3, 4]);
    const soft = new CanvasTexture(contactShadow());
    this.contacts = this.dice.map(() => {
      const c = new Mesh(
        new PlaneGeometry(DIE * 1.45, DIE * 1.45),
        new MeshBasicMaterial({
          map: soft,
          color: '#000000',
          transparent: true,
          depthWrite: false,
        }),
      );
      c.rotation.x = -Math.PI / 2;
      c.renderOrder = 1;
      this.world.add(c);
      return c;
    });

    this.tick = ambience(this.world, at, anisotropy);
    r.setAnimationLoop((ms) => this.frame(ms));
  }

  resize(w: number, h: number) {
    this.size = [w, h];
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.frameCamera();
  }

  /** Stops drawing while the Hub's tab is hidden; what was moving ends where it was going. */
  pause(paused: boolean) {
    this.paused = paused;
    if (paused) this.finish(true);
  }

  /** Drops every move under way, where it stands; the next `show` puts things right. */
  stop() {
    this.generation++;
    this.finish(false);
    clear(this.fx);
    this.marquee.stop();
    this.aircraft.visible = false;
    this.shaking.until = 0;
    this.saying++;
    this.speaking = false;
    this.standing = null;
    this.notice.material.opacity = 0;
    this.focus = null;
    this.zoom = 0;
    this.camera.position.copy(this.home.pos);
    this.camera.lookAt(this.home.target);
  }

  /**
   * `low`: no shadows, a pixel ratio of 1, the special Tiles' icons at rest, no dust or trails, a
   * still glow on the Tiles to pick and a camera that stays over the whole board.
   */
  setGraphics(level: BridgeGraphics) {
    const low = level === 'low';
    if (low === this.low) return;
    this.low = low;
    this.sun.castShadow = !low;
    this.marquee.group.visible = !low;
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.size[0], this.size[1], false);
    if (low) this.tick();
  }

  /** Off: the camera stays over the whole board, as on low graphics. */
  setFollowing(on: boolean) {
    this.following = on;
  }

  setPace(pace: number) {
    this.pace = pace;
  }

  /** A Quiz answered right: the rim's bulbs celebrate (`Marquee`). */
  cheer(ms = 2400) {
    this.marquee.play({ kind: 'quiz', ms: ms * this.pace });
  }

  /** The camera follows `seat`'s token, or goes back over the whole board. */
  follow(seat: number | null) {
    this.focus = seat === null ? null : (this.tokens[seat] ?? null);
  }

  private finish(land: boolean) {
    for (const tw of this.tweens.splice(0)) {
      if (land) tw.step(1);
      tw.done();
    }
  }

  /** Puts everything where `view` says, at once. */
  show(view: View) {
    this.showLots(view);
    this.spots = view.players.map((p) => (p.bankrupt ? null : p.tile));
    while (this.tokens.length < view.players.length) {
      const t = token(SEAT_COLORS[this.tokens.length] as string);
      const bars = cage();
      t.add(bars.group);
      this.tokens.push(t);
      this.cages.push(bars);
      this.world.add(t);
    }
    this.cages.forEach(({ group, iron }, seat) => {
      const p = view.players[seat];
      group.visible = !!p?.jailed && !p.bankrupt;
      group.position.y = 0;
      iron.opacity = 1;
    });
    this.placeTokens(view.turn);
    if (view.dice) this.setDice(view.dice);
  }

  /** Redraws the Lots, their marks and Levels from `view`. */
  showLots(view: View) {
    clear(this.lots);
    clear(this.marks);
    view.lots.forEach((lot, i) => {
      if (!lot) return;
      const g = lotPieces(i, lot.owner, lot.level, isFullSet(view, i) || isMonopoly(view, i));
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

  /**
   * Plays a Lot's change once `showLots` drew how it ends: the houses or Hotel it gained rise, the
   * ones it lost sink, a bought Lot pops in, and one given back shrinks away. A Lot Taken over is
   * snatched (`takeOver`); a new Hotel rises slower in a beam of light. The camera comes nearer while
   * a building rises.
   */
  build(tile: number, was: Lot | null, now: Lot | null, ms = 600) {
    const g = this.lots.children.find((c) => c.userData.tile === tile);
    if (g && was && now && was.owner !== now.owner)
      return this.takeOver(g, tile, was, now, ms * 1.6);
    const jobs: Promise<void>[] = [];
    const kept = !!was && !!now && was.owner === now.owner;
    const had = buildings(was);
    const has = buildings(now);
    const topped = has.includes(HOTEL) && !had.includes(HOTEL);
    if (topped) ms *= 1.5;
    if (g && !kept) jobs.push(this.popIn(g, Math.round(ms * 0.6)));
    const grew = !was || (kept && (now?.level ?? 0) > was.level);
    if (g && grew) {
      const rising = g.children.filter(
        (c) => has.includes(c.userData.building) && !(kept && had.includes(c.userData.building)),
      );
      if (rising.length > 0 && topped) this.focus = g;
      rising.forEach((b, k) => {
        jobs.push(this.rise(b, k * Math.round(ms * 0.18), ms));
      });
      if (topped && now) {
        const where = g.getWorldPosition(new Vector3());
        this.celebrate(where, SEAT_COLORS[now.owner] as string, ms * 1.6);
        jobs.push(this.wait(ms * 1.2));
      }
    }
    if (was && (!now || kept)) {
      const ghost = lotPieces(tile, was.owner, was.level, false);
      const lost = (c: Object3D) =>
        had.includes(c.userData.building) && !has.includes(c.userData.building);
      if (now) for (const c of [...ghost.children]) if (!lost(c)) ghost.remove(c);
      if (ghost.children.length > 0) {
        this.fx.add(ghost);
        jobs.push(this.sink(ghost, !now, ms));
      }
    }
    return Promise.all(jobs).then(() => {
      if (g && this.focus === g) this.focus = null;
    });
  }

  /**
   * A Takeover: the old owner's houses are yanked up off the Tile and spun round, and come down in
   * the taker's colour with a flash of it over the Tile; the tint and strip spread out under them.
   */
  private async takeOver(g: Object3D, tile: number, was: Lot, now: Lot, ms: number) {
    const mine = this.generation;
    const ghost = lotPieces(tile, was.owner, was.level, false);
    this.fx.add(ghost);
    g.visible = false;
    this.focus = g;
    const lift = 0.95;
    /** How much larger the houses grow while in the air. */
    const grow = 0.6;
    const parts = (o: Object3D) => o.children.filter((c) => c.userData.building);
    const flats = (o: Object3D) => o.children.filter((c) => !c.userData.building);
    await this.tween(ms * 0.42, (u) => {
      const up = Math.sin((u * Math.PI) / 2) * lift;
      parts(ghost).forEach((b, k) => {
        const s = b.userData.scale as number;
        b.scale.setScalar(s * (1 + Math.sin((u * Math.PI) / 2) * grow));
        b.position.y = up;
        b.rotation.y = u * u * Math.PI * 1.5 + k * 0.2;
        b.rotation.z = Math.sin(u * 30 + k) * 0.12 * (1 - u);
      });
      for (const f of flats(ghost)) f.visible = Math.sin(u * 40) > -0.2 || u < 0.3;
    });
    this.fx.remove(ghost);
    if (mine !== this.generation) return;
    g.visible = true;
    const where = g.getWorldPosition(new Vector3());
    this.flash(tile, SEAT_COLORS[now.owner] as string, ms * 0.5);
    const landed = parts(g).map((b) => ({ b, y: b.position.y, turn: b.rotation.y }));
    const spread = flats(g);
    let slammed = false;
    await this.tween(ms * 0.58, (u) => {
      const k = bounceOut(Math.min(1, u * 1.25));
      for (const { b, y, turn } of landed) {
        b.scale.setScalar((b.userData.scale as number) * (1 + (1 - k) * grow));
        b.position.y = y + (1 - k) * lift;
        b.rotation.y = turn + (1 - Math.min(1, u * 1.6)) * Math.PI;
      }
      for (const f of spread) f.scale.setScalar(Math.max(0.01, ease(Math.min(1, u * 1.8))));
      if (!slammed && u * 1.25 >= 0.36) {
        slammed = true;
        this.puff(where, 12, 520);
        this.shake(0.07, 280);
      }
    });
    if (this.focus === g) this.focus = null;
  }

  /** A sheet of `color` light over a Tile that fades. */
  private flash(tile: number, color: string, ms: number) {
    const p = placement(tile);
    const m = flat(p.w, p.h, color, 0.9);
    const material = m.material as MeshBasicMaterial;
    material.blending = AdditiveBlending;
    m.position.copy(at(p.x + p.w / 2, p.y + p.h / 2, 0.05));
    m.renderOrder = 4;
    this.fx.add(m);
    return this.tween(ms, (u) => {
      material.opacity = 0.9 * (1 - u) ** 2;
    }).then(() => {
      this.fx.remove(m);
      material.dispose();
    });
  }

  /** A beam of light, a ring and gold sparks from `where`; a ring alone on low graphics. */
  private celebrate(where: Vector3, color: string, ms: number) {
    if (this.paused) return;
    const ring = new MeshBasicMaterial({ color: GOLD, transparent: true, depthWrite: false });
    const r = new Mesh(RING, ring);
    r.rotation.x = -Math.PI / 2;
    r.position.set(where.x, BOARD_H + 0.03, where.z);
    this.fx.add(r);
    this.tween(ms * 0.6, (u) => {
      r.scale.setScalar(0.5 + ease(u) * 3.2);
      ring.opacity = 0.9 * (1 - u);
    }).then(() => {
      this.fx.remove(r);
      ring.dispose();
    });
    if (this.low) return;
    const light = new MeshBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    const beam = new Mesh(BEAM, light);
    beam.position.set(where.x, BOARD_H, where.z);
    this.fx.add(beam);
    this.tween(ms, (u) => {
      beam.scale.set(1 - u * 0.4, Math.min(1, u * 4), 1 - u * 0.4);
      light.opacity = 0.55 * Math.min(1, u * 5) * (1 - u);
    }).then(() => {
      this.fx.remove(beam);
      light.dispose();
    });
    this.sparks(where, 26, [GOLD, '#fff2c2', color], ms);
  }

  /** `n` sparks shot up from `where` that tumble and fall back. */
  /**
   * Xuất phát pays `amount`: its Tile flashes gold, sparks burst off it and "+amount" floats up from
   * it, whether a token lands there or passes.
   */
  payday(amount: number, ms = 1800) {
    ms *= this.pace;
    this.neonUntil = performance.now() + ms;
    const p = placement(0);
    const where = at(p.x + p.w / 2, p.y + p.h / 2);
    this.flash(0, GOLD, ms * 0.4);
    this.sparks(where, 18, [GOLD, '#fff2c2', '#58b368'], ms * 0.7, 1.8);
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 120;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.font = '900 92px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#3a2606';
    const text = `+${amount.toLocaleString('vi-VN')}`;
    ctx.strokeText(text, 160, 62);
    const fill = ctx.createLinearGradient(0, 20, 0, 104);
    fill.addColorStop(0, '#fff2c2');
    fill.addColorStop(1, GOLD);
    ctx.fillStyle = fill;
    ctx.fillText(text, 160, 62);
    const map = new CanvasTexture(c);
    map.colorSpace = SRGBColorSpace;
    const material = new SpriteMaterial({ map, transparent: true, depthTest: false });
    const label = new Sprite(material);
    label.renderOrder = 10;
    this.fx.add(label);
    this.tween(ms, (u) => {
      const pop = u < 0.15 ? 0.6 + (u / 0.15) * 0.5 : 1.1 - Math.min(1, (u - 0.15) * 4) * 0.1;
      label.scale.set(1.5 * pop, 0.56 * pop, 1);
      label.position.set(where.x, BOARD_H + 0.5 + ease(u) * 1.3, where.z);
      material.opacity = u < 0.7 ? 1 : (1 - u) / 0.3;
    }).then(() => {
      this.fx.remove(label);
      material.dispose();
      map.dispose();
    });
  }

  private sparks(where: Vector3, n: number, colors: readonly string[], ms: number, up = 2.2) {
    if (this.low || this.paused) return;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const out = 0.4 + Math.random() * 1.1;
      const rise = up * (0.6 + Math.random() * 0.6);
      const spin = (Math.random() - 0.5) * 20;
      const material = new MeshBasicMaterial({
        color: colors[k % colors.length],
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      });
      const m = new Mesh(SPARK, material);
      this.fx.add(m);
      const life = ms * (0.7 + Math.random() * 0.5);
      this.tween(life, (u) => {
        m.position.set(
          where.x + Math.cos(a) * out * u,
          BOARD_H + 0.1 + rise * u - rise * 1.1 * u * u,
          where.z + Math.sin(a) * out * u,
        );
        m.rotation.set(u * spin, u * spin * 0.7, 0);
        material.opacity = u < 0.8 ? 1 : (1 - u) * 5;
      }).then(() => {
        this.fx.remove(m);
        material.dispose();
      });
    }
  }

  /**
   * A Full set: its Tiles light up one after another in the owner's colour, then all three flash
   * gold together and throw up sparks, while the rim's bulbs play along (`Marquee`). The camera comes over the middle one, or stays back over
   * the whole board when `whole` (Tiles round it, as the four bến xe).
   */
  async fullSet(tiles: number[], seat: number, ms = 1400, whole = false) {
    const color = SEAT_COLORS[seat] as string;
    const first = BOARD[tiles[0] ?? 0];
    if (first?.kind === 'city')
      this.marquee.play({
        kind: 'set',
        tiles,
        color: SET_COLORS[first.set],
        step: ms * 0.18,
        ms: ms * 1.6,
      });
    else if (first?.kind === 'station' || first?.kind === 'utility')
      this.marquee.play({
        kind: first.kind === 'station' ? 'transport' : 'utility',
        ms: Math.max(ms * 1.3, 2600 * this.pace),
      });
    const middle = tiles[Math.floor(tiles.length / 2)] as number;
    const p = placement(middle);
    const marker = new Group();
    marker.position.copy(at(p.x + p.w / 2, p.y + p.h / 2));
    this.fx.add(marker);
    this.focus = whole ? null : marker;
    const mine = this.generation;
    const step = ms * 0.18;
    await Promise.all(
      tiles.map((tile, k) =>
        this.wait(step * k).then(() =>
          mine === this.generation ? this.flash(tile, color, ms * 0.45) : undefined,
        ),
      ),
    );
    if (mine !== this.generation) return;
    await Promise.all(
      tiles.map((tile) => {
        const q = placement(tile);
        this.sparks(at(q.x + q.w / 2, q.y + q.h / 2), 10, [GOLD, '#fff2c2', color], ms * 0.6, 1.4);
        return this.flash(tile, GOLD, ms * 0.4);
      }),
    );
    this.fx.remove(marker);
  }

  /**
   * Bankruptcy, over the whole board: the token's Tile flashes red and the token topples and sinks
   * into it, then the Lots it owned, `lots`, flash and crumble one after another. The camera
   * shakes.
   */
  async fall(seat: number, lots: { tile: number; lot: Lot }[], ms = 1600) {
    const t = this.tokens[seat];
    const bars = this.cages[seat];
    if (bars) bars.group.visible = false;
    this.focus = null;
    const mine = this.generation;
    const stood = this.spots[seat];
    if (stood !== null && stood !== undefined) this.flash(stood, '#e0553d', ms * 0.5);
    const ruins = lots.map(({ tile, lot }, k) => {
      const ghost = lotPieces(tile, lot.owner, lot.level, false);
      this.fx.add(ghost);
      return this.wait(ms * 0.35 + k * ms * 0.15).then(() => {
        if (mine !== this.generation) return;
        this.flash(tile, '#e0553d', ms * 0.4);
        return this.crumble(ghost, ms * 0.55);
      });
    });
    if (t) {
      const from = t.position.clone();
      const base = t.scale.x;
      const side = Math.random() < 0.5 ? -1 : 1;
      let dropped = false;
      await this.tween(ms * 0.5, (u) => {
        t.rotation.z = side * bounceOut(Math.min(1, u * 1.4)) * 1.35;
        t.position.y = from.y - Math.max(0, u - 0.6) * 0.9;
        t.scale.setScalar(base * (1 - Math.max(0, u - 0.6) * 2.2));
        if (!dropped && u * 1.4 >= 0.36) {
          dropped = true;
          this.puff(from, 10, 520);
          this.shake(0.12, 520);
        }
      });
      t.rotation.z = 0;
      t.scale.setScalar(base);
      if (mine !== this.generation) return;
      t.visible = false;
    }
    this.spots[seat] = null;
    await Promise.all(ruins);
  }

  /** A Lot's pieces shake, go grey, tip over and sink, with dust. */
  private crumble(ghost: Group, ms: number) {
    const parts = [...ghost.children];
    const tips = parts.map(() => [(Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2]);
    this.puff(ghost.getWorldPosition(new Vector3()), 8, 600);
    const grey = new MeshStandardMaterial({ color: '#5d5a66', roughness: 0.9 });
    for (const part of parts)
      part.traverse((o) => {
        if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) o.material = grey;
      });
    return this.tween(ms, (u) => {
      parts.forEach((part, k) => {
        if (!part.userData.building) {
          part.scale.setScalar(Math.max(0.01, 1 - u));
          return;
        }
        const [x, z] = tips[k] as number[];
        const e = ease(u);
        part.rotation.x = (x as number) * e;
        part.rotation.z = (z as number) * e;
        part.position.y = -e * 0.25;
        part.position.x += Math.sin(u * 60) * 0.004 * (1 - u);
        const s = part.userData.scale as number;
        part.scale.set(s, s * Math.max(0.01, 1 - e), s);
      });
    }).then(() => {
      this.fx.remove(ghost);
      grey.dispose();
    });
  }

  /** The winner's token in a beam of light with sparks, twice; the camera stays over the board. */
  victory(seat: number, ms = 1800) {
    const t = this.tokens[seat];
    if (!t?.visible) return;
    this.focus = null;
    const where = t.getWorldPosition(new Vector3());
    const color = SEAT_COLORS[seat] as string;
    this.celebrate(where, color, ms);
    this.sparks(where, 40, CONFETTI, ms * 1.4, 3);
    const mine = this.generation;
    this.wait(ms * 0.6).then(() => {
      if (mine === this.generation) this.sparks(where, 30, CONFETTI, ms * 1.4, 2.6);
    });
  }

  private wait(ms: number) {
    return this.tween(ms, () => {});
  }

  private popIn(g: Object3D, ms: number) {
    return this.tween(ms, (k) => g.scale.setScalar(Math.max(0.01, backOut(k))));
  }

  /** A house or Hotel grows up out of the board after `delay` ms, with a puff of dust. */
  private rise(b: Object3D, delay: number, ms: number) {
    const s = b.userData.scale as number;
    b.scale.set(s, 0.001, s);
    let puffed = false;
    return this.tween(delay + ms, (u) => {
      const k = clamp01((u * (delay + ms) - delay) / ms);
      b.scale.set(s, s * Math.max(0.001, backOut(k)), s);
      if (k > 0 && !puffed) {
        puffed = true;
        this.puff(b.getWorldPosition(new Vector3()), 7);
      }
    });
  }

  /** What a Lot lost goes down into the board (all of it shrinks when `whole`), then is gone. */
  private sink(ghost: Group, whole: boolean, ms: number) {
    return this.tween(ms, (u) => {
      const e = ease(u);
      if (whole) ghost.scale.setScalar(Math.max(0.01, 1 - e));
      else
        for (const b of ghost.children) {
          const s = b.userData.scale as number;
          b.scale.set(s * (1 - e * 0.3), s * Math.max(0.001, 1 - e), s * (1 - e * 0.3));
        }
    }).then(() => {
      this.fx.remove(ghost);
    });
  }

  /** Throws the dice from the far side: they bounce twice and settle on `values`. One die shows under Kẹt xe. */
  roll(values: number[], ms = 900) {
    this.inviteRoll(false);
    const throws = this.dice.map((_, i) => {
      const rest = DIE_REST[i] as Vector3;
      const sign = Math.random() < 0.5 ? -1 : 1;
      return {
        from: new Vector3(rest.x + (Math.random() - 0.5) * 1.4, 0, rest.z - 2.8),
        rest,
        spin: [(Math.random() * 2 + 3) * Math.PI * sign, (Math.random() * 2 + 3) * Math.PI],
        landed: false,
      };
    });
    this.dice.forEach((d, i) => {
      d.visible = i < values.length;
    });
    return this.tween(ms, (k) => {
      this.dice.forEach((d, i) => {
        const th = throws[i];
        if (!d.visible || !th) return;
        const [x, z] = FACE_UP[values[i] ?? 1] as [number, number];
        const e = ease(Math.min(1, k * 1.15));
        const left = 1 - e;
        d.position.set(
          th.from.x + (th.rest.x - th.from.x) * e,
          BOARD_H + DIE / 2 + bounce(k),
          th.from.z + (th.rest.z - th.from.z) * e,
        );
        d.rotation.set(
          x + (th.spin[0] as number) * left,
          0.4 - i * 0.7 + left * 2,
          z + (th.spin[1] as number) * left,
        );
        if (!th.landed && k >= 0.45) {
          th.landed = true;
          this.puff(new Vector3(d.position.x, BOARD_H, d.position.z), 8);
        }
      });
    }).then(() => this.setDice(values));
  }

  /**
   * Walks a token `steps` Tiles ahead from `from`, a hop per Tile, the camera following until it
   * stands; Xuất phát pays `bonus` (`payday`) as the token reaches it.
   */
  async walk(seat: number, from: number, steps: number, perStep = 170, bonus = 0) {
    const t = this.tokens[seat];
    if (!t) return;
    const mine = this.generation;
    this.focus = t;
    const base = t.scale.x;
    for (let k = 1; k <= steps; k++) {
      if (mine !== this.generation) return;
      const a = spot((from + k - 1) % 40, 0, 1);
      const b = spot((from + k) % 40, 0, 1);
      await this.tween(perStep, (u) => {
        const lift = Math.sin(u * Math.PI);
        t.position.lerpVectors(a, b, u);
        t.position.y = a.y + lift * 0.35;
        t.scale.set(base * (1 - lift * 0.08), base * (1 + lift * 0.14), base * (1 - lift * 0.08));
      });
      this.puff(b, 4, 300);
      if (bonus > 0 && (from + k) % 40 === 0) this.payday(bonus);
    }
    if (mine !== this.generation) return;
    this.spots[seat] = (from + steps) % 40;
    this.placeTokens(seat);
    if (this.focus === t) this.focus = null;
  }

  /**
   * Takes a token straight to `to`: a hop for a Card's move, a flight from Sân bay that lifts off,
   * crosses the board high with a trail and lands, or into jail, where the bars come down on it.
   */
  async jump(seat: number, to: number, ms = 560, how: JumpHow = 'move', bonus = 0) {
    const t = this.tokens[seat];
    if (!t) return;
    const mine = this.generation;
    const a = t.position.clone();
    const b = spot(to, 0, 1);
    this.focus = t;
    if (how === 'jail') this.marquee.play({ kind: 'jail', ms: ms * 2.4 + 400 * this.pace });
    if (how === 'flight') {
      this.marquee.play({ kind: 'dark', ms: ms * 4 });
      await this.fly(t, a, b, ms);
      if (mine === this.generation)
        this.marquee.play({ kind: 'wave', tile: to, ms: 1100 * this.pace });
    } else
      await this.tween(ms, (u) => {
        t.position.lerpVectors(a, b, ease(u));
        t.position.y = a.y + Math.sin(u * Math.PI) * 1.6;
      });
    if (mine !== this.generation) return;
    if (how !== 'flight') this.puff(b, 8);
    this.spots[seat] = to;
    this.placeTokens(seat);
    if (bonus > 0 && to === 0) this.payday(bonus);
    if (how === 'jail') await this.lock(seat, Math.round(ms * 0.9));
    if (this.focus === t) this.focus = null;
  }

  /**
   * A flight: the plane comes in low across Sân bay and picks the token up, makes a quick turn
   * over the board (straight on low graphics), drops it over `b`, and flies off. Wingtip trails
   * follow the plane and the falling token; the token lands with `impact`.
   */
  private async fly(t: Group, a: Vector3, b: Vector3, ms: number) {
    const air = this.aircraft;
    const along = new Vector3(-a.z, 0, a.x).normalize();
    const lift = (p: Vector3, y: number) => new Vector3(p.x, BOARD_H + y, p.z);
    const centre = new Vector3().lerpVectors(a, b, 0.5).multiplyScalar(0.5);
    const loop = this.low
      ? []
      : [0, 1, 2, 3, 4, 5].map((k) => {
          const start = Math.atan2(a.z - centre.z, a.x - centre.x) + 0.6;
          const angle = start + (k / 6) * Math.PI * 2;
          return lift(
            new Vector3(centre.x + Math.cos(angle) * 2.2, 0, centre.z + Math.sin(angle) * 2.2),
            2.4,
          );
        });
    const away = new Vector3(b.x, 0, b.z).normalize().multiplyScalar(6).add(b);
    const drop = lift(b, 1.9);
    const path = new CatmullRomCurve3(
      [
        lift(a.clone().addScaledVector(along, -4), 0.9),
        lift(a, 0.6),
        lift(a.clone().addScaledVector(along, 1.6), 1.6),
        ...loop,
        drop,
        lift(away, 3.2),
      ],
      false,
      'centripetal',
    );
    const points = path.getSpacedPoints(240);
    const nearest = (p: Vector3) =>
      points.reduce(
        (best, q, k) => (q.distanceTo(p) < (points[best] as Vector3).distanceTo(p) ? k : best),
        0,
      ) / 240;
    const pickAt = nearest(lift(a, 0.6));
    const dropAt = nearest(drop);
    const fall = Math.min(0.22, 1 - dropAt);
    const ahead = new Vector3();
    const hang = new Vector3();
    let heading = 0;
    let trail = 0;
    let falling: Vector3 | null = null;
    air.visible = true;
    this.focus = air;
    await this.tween(ms, (u) => {
      const at = path.getPointAt(Math.min(1, u));
      path.getPointAt(Math.min(1, u + 0.01), ahead);
      air.position.copy(at);
      air.lookAt(ahead);
      const turn = Math.atan2(ahead.x - at.x, ahead.z - at.z);
      const bend = Math.atan2(Math.sin(turn - heading), Math.cos(turn - heading));
      heading = turn;
      air.rotateZ(Math.max(-0.7, Math.min(0.7, -bend * 18)));
      if (u >= pickAt && u < dropAt) {
        hang.set(0, -0.32, 0).applyQuaternion(air.quaternion).add(at);
        t.position.copy(hang);
        this.focus = air;
      } else if (u >= dropAt) {
        falling ??= t.position.clone();
        const k = Math.min(1, (u - dropAt) / fall);
        t.position.lerpVectors(falling, b, k * k);
        t.position.y = falling.y + (b.y - falling.y) * k * k + Math.sin(k * Math.PI) * 0.3;
        this.focus = t;
      }
      if (u - trail > 0.025) {
        trail = u;
        for (const tip of WINGTIPS) this.mote(air.localToWorld(tip.clone()));
        if (falling && t.position.distanceTo(b) > 0.1) this.mote(t.position.clone());
      }
    });
    air.visible = false;
    t.position.copy(b);
    this.impact(b);
  }

  /** A token lands hard: a ring and dust run out from it, it squashes, and the camera shakes. */
  private impact(where: Vector3) {
    this.puff(where, 12, 520);
    if (this.low || this.paused) return;
    const material = new MeshBasicMaterial({
      color: '#fff1c4',
      transparent: true,
      depthWrite: false,
    });
    const ring = new Mesh(RING, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(where.x, where.y + 0.02, where.z);
    this.fx.add(ring);
    this.tween(520 * this.pace, (u) => {
      ring.scale.setScalar(0.4 + ease(u) * 2.6);
      material.opacity = 0.85 * (1 - u);
    }).then(() => {
      this.fx.remove(ring);
      material.dispose();
    });
    this.shake(0.09, 320);
  }

  /**
   * Prints `title` (and `sub` under it) in the middle of the board for `ms`: it comes in a little
   * large, settles and fades, then what `status` holds shows again. A new line replaces the one
   * showing.
   */
  say(title: string, { sub = '', tone = 'plain', big = false, ms = 1700 }: Say = {}) {
    this.ink({ title, sub, tone, big });
    const run = ++this.saying;
    this.speaking = true;
    const material = this.notice.material;
    this.tween(ms * this.pace, (u) => {
      if (run !== this.saying) return;
      const into = Math.min(1, u / 0.12);
      const out = u > 0.8 ? (1 - u) / 0.2 : 1;
      material.opacity = into * out;
      this.notice.scale.setScalar(1 + (1 - ease(into)) * (big ? 0.35 : 0.15));
    }).then(() => {
      if (run !== this.saying) return;
      this.speaking = false;
      this.stand();
    });
  }

  /**
   * What stays printed in the middle of the board while nothing happens (who is deciding, or the
   * roll waiting for a tap, blinking); `null` leaves it blank. A `say` shows over it.
   */
  status(line: Line | null) {
    this.standing = line;
    if (!this.speaking) this.stand();
  }

  private stand() {
    const material = this.notice.material;
    this.notice.scale.setScalar(1);
    if (!this.standing) {
      material.opacity = 0;
      return;
    }
    this.ink(this.standing);
    material.opacity = 1;
  }

  /** Draws `line` on the middle of the board. */
  private ink({ title, sub = '', tone = 'plain', big = false }: Line) {
    const ctx = this.noticeInk;
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const sizeTo = (text: string, size: number, weight: number) => {
      let px = size;
      do {
        ctx.font = `${weight} ${px}px system-ui, "Segoe UI", Roboto, sans-serif`;
        px -= 6;
      } while (ctx.measureText(text).width > width * 0.94 && px > 24);
    };
    const y = sub ? height * 0.4 : height / 2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    sizeTo(title, big ? 230 : 150, 900);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(10, 40, 26, 0.55)';
    ctx.strokeText(title, width / 2, y);
    ctx.fillStyle = TONES[tone];
    ctx.fillText(title, width / 2, y);
    if (sub) {
      sizeTo(sub, 86, 700);
      ctx.fillStyle = '#f4ecd8';
      ctx.fillText(sub, width / 2, height * 0.8);
    }
    (this.notice.material.map as CanvasTexture).needsUpdate = true;
  }

  /** The dice hop in place while a roll waits for a tap on them; never on low graphics. */
  inviteRoll(on: boolean) {
    this.inviting = on;
    if (!on) for (const d of this.dice) d.position.y = BOARD_H + DIE / 2;
  }

  /** Where the dice are on the canvas, in CSS pixels from its top-left, with room round them. */
  diceRect(margin = 18) {
    const [w, h] = [this.canvas.clientWidth, this.canvas.clientHeight];
    const xs: number[] = [];
    const ys: number[] = [];
    const p = new Vector3();
    for (const d of this.dice) {
      if (!d.visible) continue;
      for (const dx of [-0.5, 0.5])
        for (const dz of [-0.5, 0.5])
          for (const y of [BOARD_H, BOARD_H + DIE + 0.2]) {
            p.set(d.position.x + dx, y, d.position.z + dz).project(this.camera);
            xs.push(((p.x + 1) / 2) * w);
            ys.push(((1 - p.y) / 2) * h);
          }
    }
    const left = Math.min(...xs) - margin;
    const top = Math.min(...ys) - margin;
    return {
      left,
      top,
      width: Math.max(...xs) + margin - left,
      height: Math.max(...ys) + margin - top,
    };
  }

  /** Shakes the camera for `ms` at `strength` (board units); never on low graphics. */
  shake(strength: number, ms: number) {
    if (this.low || this.paused) return;
    ms *= this.pace;
    this.shaking = { until: performance.now() + ms, strength, ms };
  }

  /** The bars drop round a token that just went to jail. */
  private lock(seat: number, ms: number) {
    const bars = this.cages[seat];
    if (!bars) return Promise.resolve();
    const { group, iron } = bars;
    group.visible = true;
    iron.opacity = 1;
    return this.tween(ms, (u) => {
      group.position.y = (1 - bounceOut(u)) * 1.4;
    }).then(() => {
      group.position.y = 0;
    });
  }

  /** The bars round a jailed token lift away and fade. */
  release(seat: number, ms = 600) {
    const bars = this.cages[seat];
    if (!bars?.group.visible) return Promise.resolve();
    const { group, iron } = bars;
    return this.tween(ms, (u) => {
      group.position.y = ease(u) * 1.2;
      iron.opacity = 1 - u * u;
    }).then(() => {
      group.visible = false;
      group.position.y = 0;
      iron.opacity = 1;
    });
  }

  /** A few motes of dust kicking out from `where`; none on low graphics. */
  private puff(where: Vector3, n = 6, ms = 420) {
    if (this.low || this.paused) return;
    ms *= this.pace;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.6;
      const out = new Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(
        0.22 + Math.random() * 0.16,
      );
      this.particle(ms, '#efe6d2', (m, u) => {
        const e = ease(u);
        m.position.set(
          where.x + out.x * e,
          where.y + 0.04 + Math.sin(u * Math.PI) * 0.1,
          where.z + out.z * e,
        );
        m.scale.setScalar(0.6 + e * 0.9);
        return 0.8 * (1 - u);
      });
    }
  }

  /** One puff of a flight's trail, left where the token was; none on low graphics. */
  private mote(where: Vector3) {
    if (this.low || this.paused) return;
    this.particle(650 * this.pace, '#ffffff', (m, u) => {
      m.position.copy(where);
      m.scale.setScalar(1.4 * (1 - u * 0.6));
      return 0.75 * (1 - u);
    });
  }

  /** A short-lived dot; `step` places it and returns its opacity. */
  private particle(ms: number, color: string, step: (m: Mesh, u: number) => number) {
    const material = new MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const m = new Mesh(DUST, material);
    this.fx.add(m);
    this.tween(ms, (u) => {
      material.opacity = step(m, u);
    }).then(() => {
      this.fx.remove(m);
      material.dispose();
    });
  }

  /**
   * A sale being chosen: an arrow bobbing over each Tile in `tiles` not yet picked, and over each
   * one in `picked` a gold tag with what it is and fetches. No `tiles` clears them.
   */
  selling(tiles: number[], picked: { tile: number; label: string; value: string }[] = []) {
    clear(this.pointers);
    this.arrows = [];
    this.chosen = picked.map((p) => p.tile);
    for (const tile of tiles) {
      const p = placement(tile);
      const where = at(p.x + p.w / 2, p.y + p.h / 2);
      const tag = picked.find((q) => q.tile === tile);
      if (tag) {
        const sprite = saleTag(tag.label, tag.value);
        sprite.position.set(where.x, BOARD_H + 0.6, where.z);
        this.pointers.add(sprite);
      } else {
        const arrow = pointer();
        arrow.position.set(where.x, BOARD_H + 0.55, where.z);
        this.arrows.push(arrow);
        this.pointers.add(arrow);
      }
    }
  }

  /** Lights up the Tiles a tap may pick; none clears them. */
  highlight(tiles: number[]) {
    this.picking = tiles;
    if (this.aimed !== null && !tiles.includes(this.aimed)) this.aim(null);
  }

  /**
   * Aims a flight at `tile` from under the mouse: the Tile lights gold and an arc rises from Sân
   * bay to it, higher the farther it goes, with lights running along it. `null` takes it away.
   */
  aim(tile: number | null) {
    if (tile === this.aimed) return;
    this.aimed = tile;
    for (const c of this.route.children as Mesh[]) {
      if (c.geometry instanceof TubeGeometry) c.geometry.dispose();
      (c.material as MeshBasicMaterial).dispose();
    }
    clear(this.route);
    this.routeDots.length = 0;
    this.routePath = null;
    if (tile === null) return;
    const centre = (i: number) => {
      const p = placement(i);
      return at(p.x + p.w / 2, p.y + p.h / 2, 0.05);
    };
    const from = centre(AIRPORT_TILE);
    const to = centre(tile);
    const lift = 0.8 + from.distanceTo(to) * 0.32;
    const mid = from.clone().lerp(to, 0.5);
    mid.y += lift * 2;
    const path = new QuadraticBezierCurve3(from, mid, to);
    this.routePath = path;
    const tube = new Mesh(
      new TubeGeometry(path, 48, 0.045, 6),
      new MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.route.add(tube);
    const dot = new MeshBasicMaterial({ color: '#fff2c2', blending: AdditiveBlending });
    for (let k = 0; k < 8; k++) {
      const d = new Mesh(DOT, dot);
      this.route.add(d);
      this.routeDots.push(d);
    }
    const ring = new Mesh(
      RING,
      new MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(to);
    ring.scale.setScalar(0.7);
    this.route.add(ring);
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
      const rest = DIE_REST[i] as Vector3;
      d.position.set(rest.x, BOARD_H + DIE / 2, rest.z);
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
      t.rotation.z = 0;
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
    const dt = Math.min(0.1, Math.max(0, (ms - this.lastFrame) / 1000));
    this.lastFrame = ms;
    for (const tw of [...this.tweens]) {
      const k = Math.min(1, (now - tw.start) / tw.ms);
      tw.step(k);
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.done();
      }
    }
    if (this.paused) return;
    if (!this.low) this.marquee.paint(performance.now());
    const pulse = this.low ? 0.28 : 0.22 + Math.sin(ms / 220) * 0.12;
    this.glow.forEach((g, i) => {
      const material = g.material as MeshBasicMaterial;
      const chosen = this.chosen.includes(i);
      const aimed = i === this.aimed;
      material.color.set(chosen || aimed ? GOLD : '#ffffff');
      material.opacity = aimed ? 0.5 + pulse : chosen ? 0.55 : this.picking.includes(i) ? pulse : 0;
    });
    const path = this.routePath;
    if (path)
      this.routeDots.forEach((d, k) => {
        d.position.copy(path.getPoint((ms / 1400 + k / this.routeDots.length) % 1));
      });
    for (const [k, a] of this.arrows.entries())
      a.position.y = BOARD_H + 0.45 + Math.abs(Math.sin(ms / 260 + k * 0.5)) * 0.25;
    const lit = ms < this.neonUntil ? (Math.floor(ms / 110) % 2 === 0 ? 1 : 0.25) : 0;
    if (!this.low || lit > 0 || this.wasLit) this.tick(this.low ? undefined : ms / 1000, lit);
    this.wasLit = lit > 0;
    if (!this.speaking && this.standing?.blink)
      this.notice.material.opacity = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(ms / 170));
    if (this.inviting && !this.low)
      this.dice.forEach((d, i) => {
        d.position.y = BOARD_H + DIE / 2 + Math.abs(Math.sin(ms / 240 + i * 0.9)) * 0.16;
      });
    this.steer(dt);
    this.placeContacts();
    this.renderer.render(this.scene, this.camera);
  }

  /** Puts each die's contact shadow under it: dark and tight on the board, faint and wide in the air. */
  private placeContacts() {
    this.dice.forEach((d, i) => {
      const c = this.contacts[i];
      if (!c) return;
      c.visible = d.visible;
      const k = MathUtils.clamp((d.position.y - BOARD_H - DIE / 2) / 1.4, 0, 1);
      c.position.set(d.position.x, BOARD_H + 0.003, d.position.z);
      c.scale.setScalar(1 + k * 0.6);
      (c.material as MeshBasicMaterial).opacity = 0.6 * (1 - k) ** 1.5;
    });
  }

  /** Eases the camera towards the token it follows, nearer and looking at it, or back home. */
  private steer(dt: number) {
    const want = this.focus && this.following && !this.low ? 1 : 0;
    const shaking = performance.now() < this.shaking.until;
    if (want === 0 && this.zoom === 0 && !shaking && !this.shook) return;
    this.shook = shaking;
    const there = this.focus?.getWorldPosition(new Vector3());
    if (there) {
      there.y = BOARD_H;
      if (this.zoom < 0.01) this.look.copy(there);
      else this.look.lerp(there, 1 - Math.exp((-dt * 6) / this.pace));
    }
    this.zoom += (want - this.zoom) * (1 - Math.exp((-dt * 3) / this.pace));
    if (want === 0 && this.zoom < 0.002) this.zoom = 0;
    const k = smooth(this.zoom);
    const target = this.home.target.clone().lerp(this.look, k * 0.7);
    const back = this.home.pos
      .clone()
      .sub(this.home.target)
      .multiplyScalar(1 - k * CLOSE);
    this.camera.position.copy(target).add(back);
    this.camera.lookAt(target);
    if (shaking) {
      const left = (this.shaking.until - performance.now()) / this.shaking.ms;
      const s = this.shaking.strength * Math.min(1, left);
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
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
    this.home.pos.copy(camera.position);
    this.home.target.set(0, 0, tz);
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

/** An owned Lot: a tint and an outer strip in the owner's colour, its houses or Hotel, a gold rim in a Full set or a monopoly. */
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
    h.userData = { building: HOTEL, scale: 1.25 };
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
    h.userData = { building: k + 1, scale: 1.3 };
    h.position.copy(horizontal ? local(cu + offset, cv) : local(cu, cv + offset));
    g.add(h);
  }
  return g;
}

/** A soft round glow, white in the middle. */
function halo() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255, 236, 170, 1)');
  r.addColorStop(0.35, 'rgba(255, 190, 70, 0.45)');
  r.addColorStop(1, 'rgba(255, 160, 40, 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/** A gold arrow pointing down at a Tile, always facing the camera. */
function pointer() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const shape = () => {
    g.beginPath();
    g.moveTo(30, 8);
    g.lineTo(66, 8);
    g.lineTo(66, 62);
    g.lineTo(90, 62);
    g.lineTo(48, 120);
    g.lineTo(6, 62);
    g.lineTo(30, 62);
    g.closePath();
  };
  shape();
  g.lineJoin = 'round';
  g.lineWidth = 10;
  g.strokeStyle = '#3a2507';
  g.stroke();
  const face = g.createLinearGradient(0, 8, 0, 120);
  face.addColorStop(0, '#fff2b0');
  face.addColorStop(0.5, '#f5c232');
  face.addColorStop(1, '#c98a0c');
  g.fillStyle = face;
  shape();
  g.fill();
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map, depthTest: false }));
  sprite.scale.set(0.34, 0.45, 1);
  sprite.renderOrder = 5;
  return sprite;
}

/** A gold tag standing over a Tile picked for a sale: what is Sold and what it fetches. */
function saleTag(label: string, value: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 112;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#3a2507';
  g.beginPath();
  g.roundRect(4, 4, 248, 104, 22);
  g.fill();
  const face = g.createLinearGradient(0, 8, 0, 100);
  face.addColorStop(0, '#ffe58e');
  face.addColorStop(1, '#dc9c12');
  g.fillStyle = face;
  g.beginPath();
  g.roundRect(10, 10, 236, 88, 18);
  g.fill();
  g.fillStyle = '#3b2300';
  g.textAlign = 'center';
  g.font = '900 34px "Be Vietnam Pro", system-ui, sans-serif';
  g.fillText(label.toUpperCase(), 128, 50);
  g.font = '900 30px "Be Vietnam Pro", system-ui, sans-serif';
  g.fillText(value, 128, 86);
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map, depthTest: false }));
  sprite.scale.set(1.45, 0.64, 1);
  sprite.renderOrder = 5;
  return sprite;
}

/** A round soft shadow: dark in the middle, gone at the rim. */
function contactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255, 255, 255, 1)');
  r.addColorStop(0.55, 'rgba(255, 255, 255, 0.75)');
  r.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return c;
}
