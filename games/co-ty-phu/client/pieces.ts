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
