/** The models on the board, built from primitives in code: houses, Hotels, tokens and dice. */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
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

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
};

const dieFace = (n: number) => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#fbf7ee';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = n === 1 ? '#c8302a' : '#1f1a16';
  for (const [x, y] of PIPS[n] ?? []) {
    ctx.beginPath();
    ctx.arc(64 + x * 32, 64 + y * 32, n === 1 ? 17 : 12, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return new MeshStandardMaterial({ map: t, roughness: 0.35 });
};

/** BoxGeometry faces: +x, −x, +y, −y, +z, −z. */
const DIE_FACES = [3, 4, 1, 6, 2, 5].map(dieFace);

/** A die with 1 up. */
export const die = () => shadowed(new Mesh(new BoxGeometry(0.5, 0.5, 0.5), DIE_FACES));
