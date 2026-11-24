/**
 * Looping touches on the Tiles that cannot be owned, each after what the Tile means: Xuất phát
 * runs arrows the way play goes, Cơ hội floats a "?", Khí vận gives off sparkles, Thuế spins a
 * coin, a plane circles Sân bay, a searchlight sweeps Nhà tù and a beacon turns on Vào tù.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  type Object3D,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from 'three';
import { BOARD, type Tile } from '../server/game/board.js';
import { placement, tintedIcon } from './print.js';

type Tick = (t: number) => void;
/** Board units to the board group's space; `y` is height above the board. */
type At = (u: number, v: number, y?: number) => Vector3;

const texture = (canvas: HTMLCanvasElement): Texture => {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
};

const draw = (size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d') as CanvasRenderingContext2D, size);
  return texture(c);
};

/** A soft round glow, white at the middle. */
const GLOW = draw(128, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

const SPARKLE = draw(64, (ctx, s) => {
  ctx.translate(s / 2, s / 2);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const r = k % 2 ? s * 0.09 : s * 0.48;
    const a = (k * Math.PI) / 4;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.fill();
});

const CHEVRON = draw(64, (ctx, s) => {
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.62, s * 0.2);
  ctx.lineTo(s * 0.32, s * 0.5);
  ctx.lineTo(s * 0.62, s * 0.8);
  ctx.stroke();
});

/** A wedge of light, bright at its point (the left middle) and fading out. */
const BEAM = draw(128, (ctx, s) => {
  const g = ctx.createLinearGradient(0, 0, s, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, s / 2);
  ctx.lineTo(s, s * 0.15);
  ctx.lineTo(s, s * 0.85);
  ctx.fill();
});

const sprite = (map: Texture, color: string, opacity = 1, additive = true) =>
  new Sprite(
    new SpriteMaterial({
      map,
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    }),
  );

/** A light lying flat on the board. */
const floorLight = (map: Texture, color: string, w: number, h: number, opacity: number) => {
  const m = new Mesh(
    new PlaneGeometry(w, h),
    new MeshBasicMaterial({
      map,
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
};

const fade = (phase: number) => Math.sin(Math.PI * phase);

const start = (parent: Object3D, c: Vector3): Tick => {
  const arrows = Array.from({ length: 3 }, () => {
    const s = sprite(CHEVRON, '#ffd9a0');
    s.scale.setScalar(0.34);
    parent.add(s);
    return s;
  });
  return (t) => {
    arrows.forEach((s, k) => {
      const phase = (t * 0.55 + k / 3) % 1;
      s.position.set(c.x + 0.55 - phase * 1.1, c.y + 0.06, c.z + 0.18);
      s.material.opacity = fade(phase) * 0.9;
    });
  };
};

const chance = (parent: Object3D, c: Vector3, seed: number): Tick => {
  const halo = sprite(GLOW, '#ffb066', 0.55);
  halo.scale.setScalar(0.8);
  const mark = sprite(texture(tintedIcon('chance', 96, '#fff6e1')), '#ffffff', 1, false);
  mark.scale.setScalar(0.5);
  parent.add(halo, mark);
  return (t) => {
    const y = c.y + 0.26 + Math.sin(t * 2.2 + seed) * 0.06;
    mark.position.set(c.x, y, c.z);
    mark.material.rotation = Math.sin(t * 1.6 + seed) * 0.22;
    halo.position.set(c.x, y, c.z - 0.01);
    halo.material.opacity = 0.4 + Math.sin(t * 3 + seed) * 0.15;
  };
};

const chest = (parent: Object3D, c: Vector3, seed: number): Tick => {
  const sparks = Array.from({ length: 7 }, (_, k) => {
    const s = sprite(SPARKLE, k % 2 ? '#bff5ee' : '#fff3c4');
    parent.add(s);
    return { s, dx: Math.sin(k * 2.4 + seed) * 0.28, dz: Math.cos(k * 3.1 + seed) * 0.22 };
  });
  return (t) => {
    sparks.forEach(({ s, dx, dz }, k) => {
      const phase = (t * 0.45 + k / sparks.length) % 1;
      s.position.set(c.x + dx, c.y + 0.05 + phase * 0.75, c.z + dz);
      s.scale.setScalar(0.08 + fade(phase) * 0.1);
      s.material.opacity = fade(phase);
      s.material.rotation = t * 2 + k;
    });
  };
};

const COIN_FACE = draw(128, (ctx, s) => {
  ctx.fillStyle = '#e0b43a';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = '#a87c16';
  ctx.lineWidth = s * 0.06;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#8a6410';
  ctx.font = `900 ${s * 0.55}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₫', s / 2, s * 0.53);
});

const tax = (parent: Object3D, c: Vector3, seed: number): Tick => {
  const face = new MeshStandardMaterial({
    map: COIN_FACE,
    emissive: '#5a4000',
    roughness: 0.35,
    metalness: 0.3,
  });
  const coin = new Mesh(new CylinderGeometry(0.2, 0.2, 0.045, 32), [
    new MeshStandardMaterial({ color: '#e0b43a', emissive: '#5a4000', roughness: 0.3 }),
    face,
    face,
  ]);
  coin.castShadow = true;
  const holder = new Group();
  holder.add(coin);
  coin.rotation.x = Math.PI / 2;
  parent.add(holder);
  return (t) => {
    holder.position.set(c.x, c.y + 0.26 + Math.sin(t * 2 + seed) * 0.04, c.z);
    holder.rotation.y = t * 2.4 + seed;
  };
};

const airport = (parent: Object3D, c: Vector3): Tick => {
  const plane = sprite(texture(tintedIcon('airport', 96, '#ffffff')), '#ffffff', 1, false);
  plane.scale.setScalar(0.5);
  const shadow = floorLight(GLOW, '#000000', 0.4, 0.4, 0.5);
  shadow.material.blending = NormalBlending;
  parent.add(plane, shadow);
  const r = 0.42;
  return (t) => {
    const a = t * 0.9;
    const x = c.x + Math.cos(a) * r;
    const z = c.z + Math.sin(a) * r * 0.8;
    plane.position.set(x, c.y + 0.3, z + 0.1);
    plane.material.rotation = -Math.atan2(Math.cos(a) * 0.8, -Math.sin(a));
    shadow.position.set(x, c.y + 0.004, z + 0.1);
  };
};

const jail = (parent: Object3D, c: Vector3): Tick => {
  const spot = floorLight(GLOW, '#fff0c8', 0.75, 0.75, 0.55);
  parent.add(spot);
  return (t) => {
    spot.position.set(c.x + Math.sin(t * 0.9) * 0.45, c.y + 0.005, c.z + Math.sin(t * 1.7) * 0.3);
  };
};

const goJail = (parent: Object3D, c: Vector3): Tick => {
  const base = new Vector3(c.x + 0.45, c.y, c.z + 0.4);
  const lamp = new MeshStandardMaterial({ color: '#ff9f1c', emissive: '#ff8a00', roughness: 0.3 });
  const dome = new Mesh(new SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lamp);
  dome.position.copy(base);
  const foot = new Mesh(
    new CylinderGeometry(0.12, 0.12, 0.04, 20),
    new MeshStandardMaterial({ color: '#2a2e35' }),
  );
  foot.position.copy(base).setY(base.y + 0.02);
  dome.position.y += 0.04;
  const beam = floorLight(BEAM, '#ffb347', 0.9, 0.5, 0.7);
  beam.geometry.translate(0.45, 0, 0);
  const spin = new Group();
  spin.position.copy(base).setY(base.y + 0.09);
  spin.add(beam);
  const halo = sprite(GLOW, '#ff9f1c', 0.6);
  halo.scale.setScalar(0.5);
  halo.position.copy(dome.position).setY(dome.position.y + 0.05);
  const beacon = new Group();
  beacon.add(foot, dome, spin, halo);
  beacon.position.copy(base);
  beacon.scale.setScalar(1.6);
  for (const part of [foot, dome, spin, halo]) part.position.sub(base);
  parent.add(beacon);
  return (t) => {
    spin.rotation.y = -t * 3;
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    lamp.emissiveIntensity = 0.6 + pulse * 0.8;
    halo.material.opacity = 0.3 + pulse * 0.4;
  };
};

const EFFECTS: Partial<
  Record<Tile['kind'], (parent: Object3D, centre: Vector3, seed: number) => Tick>
> = {
  start,
  chance,
  chest,
  tax,
  airport,
  jail,
  'go-jail': goJail,
};

/** How far below a Tile's middle its printed icon sits (names are printed above it). */
const ICON_DROP = 0.12;

/** Adds every special Tile's loop to `parent`; call the result each frame with seconds. */
export const ambience = (parent: Object3D, at: At): Tick => {
  const ticks = BOARD.flatMap((tile, i) => {
    const effect = EFFECTS[tile.kind];
    if (!effect) return [];
    const p = placement(i);
    return [effect(parent, at(p.x + p.w / 2, p.y + p.h / 2 + ICON_DROP), i)];
  });
  return (t) => {
    for (const tick of ticks) tick(t);
  };
};
