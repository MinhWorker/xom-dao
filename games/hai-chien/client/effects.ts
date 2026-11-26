/**
 * Particles in two pools drawn as soft round sprites: `glow` adds light (fire, flashes, the
 * shell's trail) and `haze` covers (smoke, spray). Each particle rises or falls on its own.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  type Scene,
  ShaderMaterial,
} from 'three';

const VERTEX = /* glsl */ `
  attribute float size;
  attribute vec4 tint;
  varying vec4 vTint;
  uniform float scale;
  void main() {
    vTint = tint;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec4 vTint;
  uniform float soft;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    float a = pow(1.0 - d, soft);
    gl_FragColor = vec4(vTint.rgb, vTint.a * a);
    #include <colorspace_fragment>
  }
`;

/** One particle's motion and look over its life. */
export interface Spawn {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Seconds. */
  life: number;
  /** World size at the start and at the end. */
  size: number;
  grow?: number;
  color: Color;
  /** A colour it fades to (fire turning to embers). */
  to?: Color;
  alpha?: number;
  /** Down is positive. */
  gravity?: number;
  /** How much of its speed it keeps per second (air drag). */
  drag?: number;
}

interface Live extends Required<Omit<Spawn, 'to'>> {
  to: Color | null;
  age: number;
}

class Pool {
  readonly points: Points;
  private readonly live: Live[] = [];
  private readonly position: Float32Array;
  private readonly size: Float32Array;
  private readonly tint: Float32Array;
  private readonly mixed = new Color();
  private readonly material: ShaderMaterial;

  constructor(
    readonly max: number,
    additive: boolean,
  ) {
    const g = new BufferGeometry();
    this.position = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.tint = new Float32Array(max * 4);
    g.setAttribute('position', new BufferAttribute(this.position, 3));
    g.setAttribute('size', new BufferAttribute(this.size, 1));
    g.setAttribute('tint', new BufferAttribute(this.tint, 4));
    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { scale: { value: 600 }, soft: { value: additive ? 1.6 : 1.1 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    this.material = material;
    this.points = new Points(g, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
  }

  set scale(value: number) {
    (this.material.uniforms.scale as { value: number }).value = value;
  }

  add(s: Spawn) {
    if (this.live.length >= this.max) this.live.shift();
    this.live.push({
      x: s.x,
      y: s.y,
      z: s.z,
      vx: s.vx ?? 0,
      vy: s.vy ?? 0,
      vz: s.vz ?? 0,
      life: s.life,
      size: s.size,
      grow: s.grow ?? s.size,
      color: s.color,
      to: s.to ?? null,
      alpha: s.alpha ?? 1,
      gravity: s.gravity ?? 0,
      drag: s.drag ?? 1,
      age: 0,
    });
  }

  get count() {
    return this.live.length;
  }

  update(dt: number) {
    let n = 0;
    for (const p of this.live) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const keep = p.drag ** dt;
      p.vx *= keep;
      p.vz *= keep;
      p.vy = p.vy * keep - p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      this.live[n++] = p;
    }
    this.live.length = n;
    for (let i = 0; i < n; i++) {
      const p = this.live[i] as Live;
      const t = p.age / p.life;
      this.position[i * 3] = p.x;
      this.position[i * 3 + 1] = p.y;
      this.position[i * 3 + 2] = p.z;
      this.size[i] = p.size + (p.grow - p.size) * t;
      const c = p.to ? this.mixed.copy(p.color).lerp(p.to, t) : p.color;
      this.tint[i * 4] = c.r;
      this.tint[i * 4 + 1] = c.g;
      this.tint[i * 4 + 2] = c.b;
      const fadeIn = Math.min(1, t * 8);
      this.tint[i * 4 + 3] = p.alpha * fadeIn * (1 - t) ** 1.4;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    for (const name of ['position', 'size', 'tint']) {
      (g.getAttribute(name) as BufferAttribute).needsUpdate = true;
    }
  }
}

export const FIRE = new Color('#ffb24a');
export const EMBER = new Color('#c2361b');
export const FLASH = new Color('#fff2c9');
export const SMOKE = new Color('#3b3a3c');
export const STEAM = new Color('#c9d3d8');
export const SPRAY = new Color('#eef6f8');
export const RADAR = new Color('#62f0a8');

/** Both pools, and the shapes of the effects built from them. */
export class Effects {
  readonly glow: Pool;
  readonly haze: Pool;
  private seed = 1;

  constructor(scene: Scene, low: boolean) {
    this.glow = new Pool(low ? 260 : 900, true);
    this.haze = new Pool(low ? 260 : 900, false);
    scene.add(this.glow.points, this.haze.points);
  }

  /** The pixel height of one world unit at distance one, to size the sprites. */
  setScale(value: number) {
    this.glow.scale = value;
    this.haze.scale = value;
  }

  /** A random number in [-1, 1), from a seed of its own (the effects need no fairness). */
  r() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed / 2147483647) * 2 - 1;
  }

  update(dt: number) {
    this.glow.update(dt);
    this.haze.update(dt);
  }

  /** A column of water and spray where a shell falls in the sea. */
  splash(x: number, z: number, scale = 1) {
    for (let i = 0; i < 46 * scale; i++) {
      const up = 3.2 + Math.abs(this.r()) * 3.4;
      this.haze.add({
        x: x + this.r() * 0.12,
        y: 0.05,
        z: z + this.r() * 0.12,
        vx: this.r() * 0.9,
        vy: up,
        vz: this.r() * 0.9,
        life: 0.9 + Math.abs(this.r()) * 0.5,
        size: 0.18,
        grow: 0.5,
        color: SPRAY,
        alpha: 0.85,
        gravity: 9,
        drag: 0.6,
      });
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.haze.add({
        x: x + Math.cos(a) * 0.2,
        y: 0.04,
        z: z + Math.sin(a) * 0.2,
        vx: Math.cos(a) * 1.4,
        vy: 0.4,
        vz: Math.sin(a) * 1.4,
        life: 0.8,
        size: 0.25,
        grow: 0.6,
        color: SPRAY,
        alpha: 0.5,
        gravity: 1,
        drag: 0.2,
      });
    }
  }

  /** A blast of fire, smoke and sparks; `scale` 1 for a hit, more for a ship going down. */
  blast(x: number, y: number, z: number, scale = 1) {
    this.glow.add({
      x,
      y: y + 0.2,
      z,
      life: 0.35,
      size: 2.2 * scale,
      grow: 3.4 * scale,
      color: FLASH,
      alpha: 0.9,
    });
    for (let i = 0; i < 34 * scale; i++) {
      this.glow.add({
        x: x + this.r() * 0.15,
        y: y + 0.1,
        z: z + this.r() * 0.15,
        vx: this.r() * 2.4,
        vy: 1 + Math.abs(this.r()) * 3,
        vz: this.r() * 2.4,
        life: 0.45 + Math.abs(this.r()) * 0.4,
        size: 0.5 * scale,
        grow: 0.15,
        color: FIRE,
        to: EMBER,
        gravity: -1,
        drag: 0.15,
      });
    }
    for (let i = 0; i < 16 * scale; i++) {
      this.glow.add({
        x,
        y: y + 0.1,
        z,
        vx: this.r() * 4,
        vy: 2 + Math.abs(this.r()) * 4,
        vz: this.r() * 4,
        life: 0.7 + Math.abs(this.r()) * 0.5,
        size: 0.07,
        color: FIRE,
        to: EMBER,
        gravity: 9,
        drag: 0.7,
      });
    }
    for (let i = 0; i < 14 * scale; i++) {
      this.haze.add({
        x: x + this.r() * 0.2,
        y: y + 0.3,
        z: z + this.r() * 0.2,
        vx: this.r() * 0.6,
        vy: 0.8 + Math.abs(this.r()) * 0.6,
        vz: this.r() * 0.6,
        life: 1.6 + Math.abs(this.r()),
        size: 0.5 * scale,
        grow: 1.6 * scale,
        color: SMOKE,
        alpha: 0.7,
        drag: 0.5,
      });
    }
  }

  /** One frame of a burning cell: a few flames and a thread of smoke, `dt` seconds' worth. */
  burn(x: number, y: number, z: number, dt: number, fire: boolean, smoke = 1) {
    if (fire && Math.abs(this.r()) < dt * 9) {
      this.glow.add({
        x: x + this.r() * 0.14,
        y,
        z: z + this.r() * 0.14,
        vx: this.r() * 0.1,
        vy: 0.6 + Math.abs(this.r()) * 0.5,
        vz: this.r() * 0.1,
        life: 0.5 + Math.abs(this.r()) * 0.3,
        size: 0.34,
        grow: 0.08,
        color: FIRE,
        to: EMBER,
      });
    }
    if (Math.abs(this.r()) < dt * 3.5 * smoke) {
      this.haze.add({
        x: x + this.r() * 0.1,
        y: y + 0.25,
        z: z + this.r() * 0.1,
        vx: 0.25 + this.r() * 0.1,
        vy: 0.7 + Math.abs(this.r()) * 0.3,
        vz: -0.1 + this.r() * 0.1,
        life: 2.4 + Math.abs(this.r()),
        size: 0.32,
        grow: 1.3,
        color: SMOKE,
        alpha: 0.55,
      });
    }
  }

  /** The glowing trail a shell leaves behind it. */
  trail(x: number, y: number, z: number) {
    this.glow.add({
      x,
      y,
      z,
      life: 0.28,
      size: 0.32,
      grow: 0.05,
      color: FIRE,
      to: EMBER,
      alpha: 0.9,
    });
    this.haze.add({ x, y, z, life: 0.7, size: 0.12, grow: 0.45, color: STEAM, alpha: 0.25 });
  }
}
