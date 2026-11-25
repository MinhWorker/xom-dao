/**
 * The marquee bulbs round the board's rim. At rest every other one is lit, swapping about twice a
 * second; a `LightShow` takes them over for a moment: a Full set lights the bulbs by its Tiles one
 * after another in its colour, then blinks the whole rim; the four bến xe light the rim side by side
 * and send a "O o ." run round it clockwise; Điện lực and Cấp nước crackle orange along the bottom
 * and left sides and ripple blue along the top and right. Going to jail turns the rim white; a
 * flight puts it out until the token lands, then a wave runs out from that Tile all round. A Quiz
 * answered right sets off fireworks (green and gold twinkling, thicker and thicker), then a rainbow
 * spinning round clockwise, then three green flashes.
 */
import {
  AdditiveBlending,
  Color,
  Group,
  InstancedMesh,
  type Material,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  type Texture,
} from 'three';
import { BOARD } from '../server/game/board.js';
import { placement, SIDE } from './print.js';

/** About how far apart the bulbs stand along the rim. */
const GAP = 0.34;
const ON = new Color('#fff1b8');
const OFF = new Color('#5a4310');
const GOLD = new Color('#ffd21f');
const SPARK = new Color('#ffa31a');
const WATER = new Color('#3aa0ff');
const WHITE = new Color('#ffffff');
const GREEN = new Color('#3ee06a');
/** The sides of the rim in the order a clockwise run passes them, starting at the bottom. */
const CLOCKWISE_SIDES = [0, 3, 2, 1];

export type LightShow =
  /** A Full set of `tiles` in `color`; each Tile lights `step` ms after the one before. */
  | { kind: 'set'; tiles: number[]; color: string; step: number; ms: number }
  | { kind: 'transport'; ms: number }
  | { kind: 'utility'; ms: number }
  | { kind: 'jail'; ms: number }
  /** Every bulb out, while a token flies. */
  | { kind: 'dark'; ms: number }
  /** A wave out of the bulbs by `tile`, both ways round the rim. */
  | { kind: 'wave'; tile: number; ms: number }
  | { kind: 'quiz'; ms: number };

/** A number from 0 to 1 that looks random but is the same for the same `a` and `b`. */
const hash = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export class Marquee {
  readonly group = new Group();
  private readonly bulbs: InstancedMesh;
  private readonly halos: InstancedMesh;
  private readonly count: number;
  /** Per bulb: which side of the rim it is on (0 bottom, 1 right, 2 top, 3 left) and where along it. */
  private readonly side: number[] = [];
  private readonly along: number[] = [];
  /** Per bulb: the Tile it stands nearest. */
  private readonly nearest: number[] = [];
  private show: (LightShow & { start: number; tint: Color }) | null = null;
  private readonly per: number;
  private readonly bulb = new Color();
  private readonly glow = new Color();
  private readonly hue = new Color();
  /** The at-rest swap the bulbs show now, `-1` after a show. */
  private painted = -1;

  constructor(halo: Texture) {
    const half = SIDE / 2 + 0.1;
    const per = Math.round((2 * half) / GAP);
    this.per = per;
    this.count = per * 4;
    this.bulbs = new InstancedMesh(
      new SphereGeometry(0.06, 12, 8),
      new MeshBasicMaterial({ color: '#ffffff' }),
      this.count,
    );
    this.halos = new InstancedMesh(
      new PlaneGeometry(0.42, 0.42),
      new MeshBasicMaterial({
        map: halo,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
      this.count,
    );
    const centres = BOARD.map((_, i) => {
      const p = placement(i);
      return [p.x + p.w / 2 - SIDE / 2, p.y + p.h / 2 - SIDE / 2] as const;
    });
    const o = new Object3D();
    let n = 0;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < per; i++) {
        const t = -half + (i * 2 * half) / per;
        const [x, z] = [
          [t, half],
          [half, -t],
          [-t, -half],
          [-half, t],
        ][side] as [number, number];
        o.position.set(x, 0.03, z);
        o.rotation.set(0, 0, 0);
        o.updateMatrix();
        this.bulbs.setMatrixAt(n, o.matrix);
        o.position.y = 0.004;
        o.rotation.x = -Math.PI / 2;
        o.updateMatrix();
        this.halos.setMatrixAt(n, o.matrix);
        this.side.push(side);
        this.along.push(i);
        let best = 0;
        let dist = Infinity;
        centres.forEach(([cx, cz], tile) => {
          const d = (cx - x) ** 2 + (cz - z) ** 2;
          if (d < dist) {
            dist = d;
            best = tile;
          }
        });
        this.nearest.push(best);
        n++;
      }
    }
    this.group.add(this.bulbs, this.halos);
    this.paint(performance.now());
  }

  /** Lifts the whole rim to `y`, the board's top. */
  setHeight(y: number) {
    this.group.position.y = y;
  }

  /** Takes the bulbs over for `show.ms`; a new show replaces the one playing. */
  play(show: LightShow) {
    const tint = new Color(show.kind === 'set' ? show.color : '#ffffff');
    this.show = { ...show, start: performance.now(), tint };
  }

  /** Back to the bulbs at rest. */
  stop() {
    this.show = null;
  }

  /** Sets every bulb for the time `now` (ms); at rest only when they swap. */
  paint(now: number) {
    const show = this.show;
    if (show && now - show.start > show.ms) this.show = null;
    const rest = this.show ? -1 : Math.floor(now / 480);
    if (rest >= 0 && rest === this.painted) return;
    this.painted = rest;
    for (let k = 0; k < this.count; k++) {
      const [color, level] = this.light(k, now);
      this.bulb.copy(OFF).lerp(color, level);
      this.bulbs.setColorAt(k, this.bulb);
      this.glow.copy(color).multiplyScalar(level);
      this.halos.setColorAt(k, this.glow);
    }
    if (this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true;
    if (this.halos.instanceColor) this.halos.instanceColor.needsUpdate = true;
  }

  dispose() {
    for (const m of [this.bulbs, this.halos]) {
      m.geometry.dispose();
      (m.material as Material).dispose();
      m.dispose();
    }
  }

  /** Bulb `k`'s colour and how lit it is (0 to 1) at `now`. */
  private light(k: number, now: number): [Color, number] {
    const show = this.show;
    if (!show) return [ON, (k + Math.floor(now / 480)) % 2 === 0 ? 1 : 0];
    const t = now - show.start;
    const side = this.side[k] as number;
    if (show.kind === 'jail') return [WHITE, 1];
    if (show.kind === 'dark') return [ON, 0];
    if (show.kind === 'quiz') {
      const u = t / show.ms;
      if (u < 0.28) {
        const bucket = Math.floor(t / 60);
        const lit = hash(k, bucket) < 0.15 + (u / 0.28) * 0.5;
        return [hash(k, 7) < 0.5 ? GREEN : GOLD, lit ? 1 : 0];
      }
      if (u < 0.78) {
        const clockwise = (this.count - k) % this.count;
        const spin = (u - 0.28) / 0.5;
        this.hue.setHSL(((((clockwise * 2) / this.count - spin * 1.5) % 1) + 1) % 1, 0.9, 0.6);
        return [this.hue, 1];
      }
      return [GREEN, Math.floor((u - 0.78) / (0.22 / 6)) % 2 === 0 ? 1 : 0];
    }
    if (show.kind === 'wave') {
      const from = this.nearest.indexOf(show.tile);
      const apart = Math.abs(k - Math.max(0, from));
      const ring = Math.min(apart, this.count - apart);
      const front = (t / (show.ms * 0.8)) * (this.count / 2);
      const crest = Math.max(0, 1 - Math.abs(ring - front) / 4);
      return [crest > 0.5 ? WHITE : ON, ring < front ? Math.max(crest, 0.35) : crest];
    }
    if (show.kind === 'set') {
      const color = show.tint;
      const all = show.step * (show.tiles.length - 1) + show.step * 0.8;
      if (t >= all) return [color, Math.floor((t - all) / 140) % 2 === 0 ? 1 : 0.1];
      const at = show.tiles.indexOf(this.nearest[k] as number);
      return [color, at >= 0 && t >= at * show.step ? 1 : 0];
    }
    if (show.kind === 'transport') {
      const sideMs = 180;
      const lapAt = sideMs * 4 + 150;
      if (t < lapAt) {
        const lit = Math.floor(t / sideMs);
        return [GOLD, CLOCKWISE_SIDES.indexOf(side) <= lit ? 1 : 0];
      }
      const lap = (t - lapAt) / (show.ms - lapAt);
      const clockwise = (this.count - k) % this.count;
      const step = (((clockwise - Math.floor(lap * this.count)) % 3) + 3) % 3;
      return [GOLD, [1, 0.4, 0][step] as number];
    }
    if (side === 0 || side === 3) {
      const bucket = Math.floor(t / 70);
      const strobe = Math.floor(t / 210) % 2 === 0 ? 1 : 0.55;
      return [SPARK, hash(k, bucket) > 0.35 ? strobe : 0.05];
    }
    const i = this.along[k] as number;
    const fromCorner = side === 2 ? i : this.per - i;
    return [WATER, 0.5 + 0.5 * Math.sin(fromCorner * 0.55 - t / 90)];
  }
}
