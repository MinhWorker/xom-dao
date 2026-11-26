/**
 * The five ships of a fleet as low-poly models built in code: each lies along +x, its bow at
 * +x, centred on the origin, and is `size` cells long. The waterline is y = 0.
 */
import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
} from 'three';

/** One ship's materials, cloned per ship so it can be tinted, darkened or faded on its own. */
export interface ShipLook {
  hull: MeshStandardMaterial;
  deck: MeshStandardMaterial;
  trim: MeshStandardMaterial;
  stripe: MeshStandardMaterial;
  glass: MeshStandardMaterial;
}

const BEAM = 0.62;
const flat = (color: string, roughness = 0.75, metalness = 0.15) =>
  new MeshStandardMaterial({ color, roughness, metalness, flatShading: true, transparent: true });

/** Fresh materials for one ship. */
export function shipLook(): ShipLook {
  return {
    hull: flat('#5b6b7c', 0.7, 0.25),
    deck: flat('#8d9590', 0.85, 0.05),
    trim: flat('#3c4652', 0.6, 0.3),
    stripe: flat('#8c2f2a', 0.8, 0.05),
    glass: flat('#d9e7ef', 0.2, 0.4),
  };
}

/** A hull seen from above: a pointed bow, straight sides and a rounded stern. */
function hullShape(length: number, beam: number, bow = 0.32) {
  const l = length / 2;
  const b = beam / 2;
  const s = new Shape();
  s.moveTo(-l + 0.08, -b);
  s.lineTo(l - length * bow, -b);
  s.quadraticCurveTo(l - length * bow * 0.25, -b * 0.75, l, 0);
  s.quadraticCurveTo(l - length * bow * 0.25, b * 0.75, l - length * bow, b);
  s.lineTo(-l + 0.08, b);
  s.quadraticCurveTo(-l - 0.02, b, -l - 0.02, 0);
  s.quadraticCurveTo(-l - 0.02, -b, -l + 0.08, -b);
  return s;
}

/** An extruded shape laid flat (its y up), from `bottom` to `bottom + depth`. */
function slab(shape: Shape, depth: number, bottom: number): BufferGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 6,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bottom, 0);
  return g;
}

function part(geometry: BufferGeometry, material: Material, x: number, y: number, z = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

/** A gun turret with `barrels` guns pointing towards the bow (`dir` 1) or the stern (-1). */
function turret(look: ShipLook, x: number, y: number, dir: 1 | -1, scale = 1, barrels = 2) {
  const g = new Group();
  const base = part(
    new CylinderGeometry(0.13 * scale, 0.15 * scale, 0.09 * scale, 8),
    look.trim,
    0,
    0,
  );
  const top = part(
    new BoxGeometry(0.2 * scale, 0.07 * scale, 0.2 * scale),
    look.hull,
    0.01 * dir,
    0.07 * scale,
  );
  g.add(base, top);
  for (let i = 0; i < barrels; i++) {
    const barrel = part(
      new CylinderGeometry(0.018 * scale, 0.02 * scale, 0.3 * scale, 5),
      look.trim,
      0.19 * scale * dir,
      0.075 * scale,
      (i - (barrels - 1) / 2) * 0.06 * scale,
    );
    barrel.rotation.z = (-Math.PI / 2) * dir + 0.06 * dir;
    g.add(barrel);
  }
  g.position.set(x, y, 0);
  return g;
}

/** A hull of `length` with its deck at `deckY`, a dark band at the waterline. */
function hull(look: ShipLook, length: number, deckY: number, beam = BEAM, bow = 0.32) {
  const g = new Group();
  const shape = hullShape(length, beam, bow);
  g.add(new Mesh(slab(hullShape(length * 0.98, beam * 0.92, bow), 0.12, -0.12), look.stripe));
  g.add(new Mesh(slab(shape, deckY, 0), look.hull));
  g.add(new Mesh(slab(hullShape(length * 0.94, beam * 0.84, bow), 0.015, deckY), look.deck));
  return g;
}

function carrier(look: ShipLook, length: number) {
  const g = new Group();
  g.add(hull(look, length * 0.92, 0.2, BEAM * 0.9, 0.18));
  const deck = part(new BoxGeometry(length, 0.05, BEAM * 1.12), look.trim, 0.03, 0.27);
  g.add(deck);
  const stripe = part(new BoxGeometry(length * 0.86, 0.006, 0.025), look.glass, 0.05, 0.297);
  g.add(stripe);
  for (let i = 0; i < 6; i++) {
    g.add(
      part(new BoxGeometry(0.12, 0.006, 0.015), look.deck, -length * 0.38 + i * 0.5, 0.297, -0.18),
    );
  }
  const island = new Group();
  island.add(part(new BoxGeometry(0.55, 0.32, 0.16), look.hull, 0, 0.16));
  island.add(part(new BoxGeometry(0.42, 0.06, 0.18), look.glass, 0.02, 0.28));
  island.add(part(new CylinderGeometry(0.012, 0.012, 0.36, 4), look.trim, -0.08, 0.5));
  island.add(part(new BoxGeometry(0.2, 0.02, 0.02), look.trim, -0.08, 0.6));
  island.position.set(length * 0.08, 0.3, BEAM * 0.42);
  g.add(island);
  for (const [x, z] of [
    [-length * 0.3, -0.12],
    [length * 0.25, -0.1],
  ] as const) {
    const plane = new Group();
    plane.add(part(new BoxGeometry(0.22, 0.025, 0.05), look.deck, 0, 0));
    plane.add(part(new BoxGeometry(0.06, 0.02, 0.24), look.deck, 0.02, 0));
    plane.position.set(x, 0.31, z);
    plane.rotation.y = 0.5;
    g.add(plane);
  }
  return g;
}

function battleship(look: ShipLook, length: number) {
  const g = new Group();
  g.add(hull(look, length, 0.2));
  const top = 0.215;
  g.add(turret(look, length * 0.3, top, 1, 1.2, 3));
  g.add(turret(look, length * 0.16, top + 0.06, 1, 1.05));
  g.add(turret(look, -length * 0.3, top, -1, 1.2, 3));
  const tower = new Group();
  tower.add(part(new BoxGeometry(0.7, 0.14, 0.34), look.hull, 0, 0.07));
  tower.add(part(new BoxGeometry(0.36, 0.18, 0.24), look.hull, 0.08, 0.22));
  tower.add(part(new BoxGeometry(0.2, 0.05, 0.26), look.glass, 0.12, 0.29));
  tower.add(part(new CylinderGeometry(0.06, 0.08, 0.26, 8), look.trim, -0.22, 0.24));
  tower.add(part(new CylinderGeometry(0.012, 0.012, 0.45, 4), look.trim, 0.05, 0.55));
  tower.position.set(-0.02, top, 0);
  g.add(tower);
  return g;
}

function cruiser(look: ShipLook, length: number) {
  const g = new Group();
  g.add(hull(look, length, 0.17, BEAM * 0.9));
  const top = 0.185;
  g.add(turret(look, length * 0.28, top, 1, 1));
  g.add(turret(look, -length * 0.3, top, -1, 1));
  const tower = new Group();
  tower.add(part(new BoxGeometry(0.55, 0.13, 0.28), look.hull, 0, 0.065));
  tower.add(part(new BoxGeometry(0.24, 0.14, 0.22), look.hull, 0.08, 0.19));
  tower.add(part(new BoxGeometry(0.14, 0.04, 0.23), look.glass, 0.12, 0.24));
  tower.add(part(new CylinderGeometry(0.05, 0.065, 0.22, 7), look.trim, -0.15, 0.2));
  tower.add(part(new CylinderGeometry(0.01, 0.01, 0.4, 4), look.trim, 0.05, 0.45));
  tower.position.set(0, top, 0);
  g.add(tower);
  return g;
}

function submarine(look: ShipLook, length: number) {
  const g = new Group();
  const body = part(new SphereGeometry(0.5, 14, 8), look.trim, 0, 0.02);
  body.scale.set(length * 0.96, 0.24, BEAM * 0.95);
  g.add(body);
  const deck = part(new BoxGeometry(length * 0.6, 0.04, 0.18), look.hull, 0.05, 0.12);
  g.add(deck);
  const sail = new Group();
  sail.add(part(new BoxGeometry(0.42, 0.26, 0.13), look.trim, 0, 0.13));
  sail.add(part(new BoxGeometry(0.24, 0.02, 0.32), look.trim, 0.02, 0.18));
  sail.add(part(new CylinderGeometry(0.01, 0.01, 0.22, 4), look.glass, -0.05, 0.36));
  sail.add(part(new CylinderGeometry(0.012, 0.012, 0.16, 4), look.trim, 0.06, 0.33));
  sail.position.set(length * 0.1, 0.12, 0);
  g.add(sail);
  const fin = part(new BoxGeometry(0.06, 0.28, 0.03), look.trim, -length * 0.46, 0.08);
  g.add(fin);
  return g;
}

function destroyer(look: ShipLook, length: number) {
  const g = new Group();
  g.add(hull(look, length, 0.15, BEAM * 0.8, 0.38));
  const top = 0.165;
  g.add(turret(look, length * 0.26, top, 1, 0.85, 1));
  const tower = new Group();
  tower.add(part(new BoxGeometry(0.42, 0.12, 0.24), look.hull, 0, 0.06));
  tower.add(part(new BoxGeometry(0.16, 0.035, 0.2), look.glass, 0.1, 0.13));
  tower.add(part(new CylinderGeometry(0.045, 0.055, 0.18, 7), look.trim, -0.12, 0.16));
  tower.add(part(new CylinderGeometry(0.009, 0.009, 0.34, 4), look.trim, 0.02, 0.3));
  tower.position.set(-0.04, top, 0);
  g.add(tower);
  g.add(part(new BoxGeometry(0.16, 0.05, 0.12), look.trim, -length * 0.34, top + 0.03));
  return g;
}

const BUILDERS = [carrier, battleship, cruiser, submarine, destroyer];

/** The model of ship `id` of `FLEET`, `size` cells long. */
export function buildShip(id: number, size: number, look: ShipLook): Group {
  const length = size - 0.18;
  const build = BUILDERS[id] ?? cruiser;
  const model = build(look, length);
  const g = new Group();
  g.add(model);
  return g;
}
