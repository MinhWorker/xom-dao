/** The models on the board, built from primitives in code: houses, Hotels, tokens and dice. */
import {
  BoxGeometry,
  type BufferAttribute,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three';

const paint = (color: string | Color, roughness = 0.6, metalness = 0) =>
  new MeshStandardMaterial({ color, roughness, metalness });

const shade = (color: string, by: number) => new Color(color).offsetHSL(0, -0.05, by);

const shadowed = <T extends Mesh>(mesh: T) => {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const HOUSE = new BoxGeometry(0.17, 0.13, 0.17);
const HOUSE_ROOF = new ConeGeometry(0.15, 0.11, 4);
HOUSE_ROOF.rotateY(Math.PI / 4);

/**
 * A little Thần tài sitting on a cushion, faceless, in a robe of `color`, his black hat with its
 * two wings, a gold ingot held out in front (+z).
 */
export const godOfWealth = (color: string) => {
  const g = new Group();
  const gold = new MeshStandardMaterial({
    color: '#f2c033',
    emissive: '#5a3c00',
    roughness: 0.25,
    metalness: 0.8,
  });
  const black = paint('#1b1b22', 0.5);
  const add = (mesh: Mesh, x: number, y: number, z = 0) => {
    mesh.position.set(x, y, z);
    g.add(shadowed(mesh));
    return mesh;
  };
  add(new Mesh(new CylinderGeometry(0.36, 0.4, 0.1, 24), paint('#b8312a', 0.7)), 0, 0.05);
  add(new Mesh(new CylinderGeometry(0.18, 0.34, 0.5, 24), paint(color, 0.5)), 0, 0.34);
  add(new Mesh(new CylinderGeometry(0.2, 0.2, 0.05, 24), gold), 0, 0.42);
  add(new Mesh(new SphereGeometry(0.16, 20, 14), paint('#e9b48a', 0.6)), 0, 0.72);
  add(new Mesh(new CylinderGeometry(0.12, 0.14, 0.16, 20), black), 0, 0.86);
  add(new Mesh(new BoxGeometry(0.28, 0.04, 0.03), gold), 0, 0.8, 0.12);
  for (const x of [-0.2, 0.2]) {
    const wing = add(new Mesh(new BoxGeometry(0.2, 0.05, 0.05), black), x, 0.88);
    wing.rotation.z = x > 0 ? -0.25 : 0.25;
  }
  const ingot = add(new Mesh(new SphereGeometry(0.13, 18, 12), gold), 0, 0.44, 0.27);
  ingot.scale.set(1.3, 0.55, 0.8);
  add(new Mesh(new SphereGeometry(0.07, 14, 10), gold), 0, 0.5, 0.27);
  return g;
};

/**
 * A yellow taxi about 2.4 dice long, facing +x, its wheels in `userData.wheels` to spin. It runs
 * the second die off the board under Kẹt xe.
 */
export const car = () => {
  const g = new Group();
  const body = paint('#f2b705', 0.35, 0.1);
  const glass = paint('#1d2b44', 0.15, 0.3);
  const dark = paint('#2a2a33', 0.7);
  const part = (
    w: number,
    h: number,
    d: number,
    m: MeshStandardMaterial,
    x: number,
    y: number,
    z = 0,
  ) => {
    const mesh = shadowed(new Mesh(new BoxGeometry(w, h, d), m));
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  part(2, 0.42, 1, body, 0, 0.4);
  part(1.0, 0.32, 0.88, glass, -0.12, 0.76);
  part(0.62, 0.07, 0.9, body, -0.12, 0.95);
  part(0.36, 0.14, 0.3, paint('#fff2c2', 0.4), -0.12, 1.05);
  part(0.08, 0.16, 1.02, dark, 1.0, 0.26);
  part(0.08, 0.16, 1.02, dark, -1.0, 0.26);
  part(2.02, 0.06, 1.02, dark, 0, 0.5);
  const lamp = (color: string) =>
    new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 });
  for (const z of [-0.32, 0.32]) {
    part(0.05, 0.1, 0.2, lamp('#ffe58e'), 1.01, 0.45, z);
    part(0.05, 0.1, 0.18, lamp('#e0553d'), -1.01, 0.45, z);
  }
  const wheels: Mesh[] = [];
  const tyre = new CylinderGeometry(0.21, 0.21, 0.16, 18);
  tyre.rotateX(Math.PI / 2);
  for (const x of [-0.62, 0.62])
    for (const z of [-0.47, 0.47]) {
      const w = shadowed(new Mesh(tyre, paint('#16161c', 0.8)));
      w.position.set(x, 0.21, z);
      const hub = new Mesh(new BoxGeometry(0.2, 0.06, 0.17), paint('#b9bcc6', 0.3, 0.6));
      w.add(hub);
      g.add(w);
      wheels.push(w);
    }
  g.userData.wheels = wheels;
  return g;
};

/** A Level 1–4 house in the owner's colour. */
export const house = (color: string) => {
  const g = new Group();
  const body = shadowed(new Mesh(HOUSE, paint(color, 0.55)));
  body.position.y = 0.065;
  const roof = shadowed(new Mesh(HOUSE_ROOF, paint(shade(color, -0.18), 0.5)));
  roof.position.y = 0.13 + 0.055;
  g.add(body, roof);
  return g;
};

/** A Hotel (Level 5): a taller, wider block in the owner's colour with white trim and a gold cap. */
export const hotel = (color: string) => {
  const g = new Group();
  const body = shadowed(new Mesh(new BoxGeometry(0.56, 0.3, 0.22), paint(color, 0.5)));
  body.position.y = 0.15;
  const trim = shadowed(new Mesh(new BoxGeometry(0.58, 0.05, 0.24), paint('#f5efe0', 0.4)));
  trim.position.y = 0.2;
  const roof = shadowed(new Mesh(new BoxGeometry(0.62, 0.05, 0.27), paint('#f5efe0', 0.4)));
  roof.position.y = 0.325;
  const tower = shadowed(
    new Mesh(new BoxGeometry(0.18, 0.16, 0.16), paint(shade(color, -0.12), 0.5)),
  );
  tower.position.y = 0.43;
  const cap = shadowed(new Mesh(new ConeGeometry(0.14, 0.1, 4), paint('#d9a82b', 0.35, 0.5)));
  cap.rotation.y = Math.PI / 4;
  cap.position.y = 0.56;
  g.add(body, trim, roof, tower, cap);
  return g;
};

const PAWN = new LatheGeometry(
  [
    [0, 0],
    [0.17, 0],
    [0.175, 0.03],
    [0.15, 0.06],
    [0.1, 0.08],
    [0.07, 0.14],
    [0.055, 0.26],
    [0.09, 0.29],
    [0.09, 0.31],
    [0.05, 0.33],
    [0, 0.33],
  ].map(([x, y]) => new Vector2(x, y)),
  24,
);
const HEAD = new SphereGeometry(0.085, 20, 14);

/** A player's token: a glossy pawn in the seat colour on a white ring. */
export const token = (color: string) => {
  const g = new Group();
  const ring = shadowed(
    new Mesh(new CylinderGeometry(0.19, 0.19, 0.02, 28), paint('#fbf7ee', 0.4)),
  );
  ring.position.y = 0.01;
  const body = shadowed(new Mesh(PAWN, paint(color, 0.28, 0.05)));
  body.position.y = 0.02;
  const head = shadowed(new Mesh(HEAD, paint(color, 0.28, 0.05)));
  head.position.y = 0.42;
  g.add(ring, body, head);
  return g;
};

export const DIE = 0.8;
const DIE_ROUND = 0.12;

/** A cube of side `size` with its edges and corners rounded to `radius`. */
const roundedCube = (size: number, radius: number, segments = 16) => {
  const g = new BoxGeometry(size, size, size, segments, segments, segments);
  const pos = g.attributes.position as BufferAttribute;
  const normal = g.attributes.normal as BufferAttribute;
  const inner = size / 2 - radius;
  const p = new Vector3();
  const core = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    core.set(
      MathUtils.clamp(p.x, -inner, inner),
      MathUtils.clamp(p.y, -inner, inner),
      MathUtils.clamp(p.z, -inner, inner),
    );
    const n = p.sub(core).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
    pos.setXYZ(i, core.x + n.x * radius, core.y + n.y * radius, core.z + n.z * radius);
  }
  return g;
};

/** A red face with a gold rim and the number in a pea-green disc. */
const dieFace = (n: number) => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#d9a82b';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#c0262d';
  ctx.beginPath();
  ctx.roundRect(16, 16, 224, 224, 26);
  ctx.fill();
  ctx.strokeStyle = '#f2cf63';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#7fae3e';
  ctx.strokeStyle = '#f2cf63';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(128, 128, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fffaf0';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 3;
  ctx.font = '900 92px system-ui, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${n}`, 128, 134);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return new MeshStandardMaterial({ map: t, roughness: 0.32, metalness: 0.05 });
};

/** BoxGeometry faces: +x, −x, +y, −y, +z, −z. */
const DIE_FACES = [3, 4, 1, 6, 2, 5].map(dieFace);
const DIE_SHAPE = roundedCube(DIE, DIE_ROUND);

/** A die with 1 up. */
export const die = () => shadowed(new Mesh(DIE_SHAPE, DIE_FACES));

const BAR = new CylinderGeometry(0.017, 0.017, 0.56, 6);
const HOOP = new CylinderGeometry(0.25, 0.25, 0.03, 28, 1, true);

/**
 * The bars round a jailed token, in its own space (a child of the token): eight iron bars between
 * two hoops. `iron` is its own material, so it can fade.
 */
export const cage = () => {
  const group = new Group();
  const iron = new MeshStandardMaterial({
    color: '#9aa0ad',
    roughness: 0.3,
    metalness: 0.75,
    transparent: true,
  });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const bar = shadowed(new Mesh(BAR, iron));
    bar.position.set(Math.cos(a) * 0.24, 0.3, Math.sin(a) * 0.24);
    group.add(bar);
  }
  for (const y of [0.03, 0.57]) {
    const hoop = shadowed(new Mesh(HOOP, iron));
    hoop.position.y = y;
    group.add(hoop);
  }
  return { group, iron };
};

const BLOB = new SphereGeometry(1, 24, 12);
const linear = (r: number, g: number, b: number) => new Color().setRGB(r, g, b);
const IVORY = new MeshStandardMaterial({ color: linear(0.92, 0.84, 0.63), roughness: 0.3 });
const TEAL = new MeshStandardMaterial({ color: linear(0.015, 0.14, 0.17), roughness: 0.3 });
const BRASS = new MeshStandardMaterial({
  color: linear(0.65, 0.4, 0.1),
  roughness: 0.3,
  metalness: 0.55,
});
const GLASS = new MeshStandardMaterial({
  color: linear(0.025, 0.07, 0.11),
  roughness: 0.3,
  metalness: 0.25,
});

/** Where the plane's wingtips are, in its own space: its trails start there. */
export const WINGTIPS = [new Vector3(-0.495, -0.015, -0.015), new Vector3(0.495, -0.015, -0.015)];

/**
 * The plane that flies from Sân bay: a small ivory and teal transport with brass trim, the one the
 * legacy Classic table made in Blender (`render_aircraft.py` at tag `legacy-godot`), rebuilt from
 * the same ellipsoids. Its nose points along −z.
 */
export const plane = () => {
  const g = new Group();
  /** An ellipsoid at Blender's (x, y, z) with its radii there, turned to y-up. */
  const blob = (
    [x, y, z]: [number, number, number],
    [sx, sy, sz]: [number, number, number],
    material: MeshStandardMaterial,
  ) => {
    const m = shadowed(new Mesh(BLOB, material));
    m.position.set(x, z, -y);
    m.scale.set(sx, sz, sy);
    g.add(m);
  };
  blob([0, 0, 0], [0.1, 0.43, 0.1], IVORY);
  blob([0, 0.25, 0.073], [0.075, 0.12, 0.048], GLASS);
  blob([0, 0.015, -0.015], [0.52, 0.095, 0.023], TEAL);
  blob([0, -0.32, 0.025], [0.2, 0.055, 0.016], TEAL);
  blob([0, -0.32, 0.09], [0.017, 0.075, 0.12], TEAL);
  for (const x of [-0.22, 0.22]) {
    blob([x, 0.055, -0.055], [0.045, 0.115, 0.045], IVORY);
    blob([x, 0.155, -0.055], [0.043, 0.015, 0.043], BRASS);
    blob([x * 2.25, 0.015, -0.015], [0.025, 0.082, 0.025], BRASS);
  }
  for (const y of [-0.16, -0.06, 0.04, 0.14])
    for (const x of [-0.096, 0.096]) blob([x, y, 0.025], [0.008, 0.019, 0.021], GLASS);
  return g;
};
