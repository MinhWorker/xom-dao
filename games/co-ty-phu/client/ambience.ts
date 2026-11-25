/**
 * Moves the icons of the special Tiles and the two utilities: each gets a face laid flat over its
 * printed one, cut from one shared canvas (an atlas) that is repainted with `paintTile` a few dozen
 * times a second, so each repaint sends the GPU one texture rather than one per Tile.
 */
import {
  BufferAttribute,
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  type Vector3,
} from 'three';
import { BOARD } from '../server/game/board.js';
import { type Mark, paintTile, placement } from './print.js';
import { isSpecial } from './special.js';

/** Board units to the board group's space; `y` is height above the board. */
type At = (u: number, v: number, y?: number) => Vector3;

/**
 * Pixels per board unit on the moving faces: a Tile spans at most about 200 px on screen, even
 * with the camera close.
 */
const PX = 160;
const FPS = 30;
/** How wide the atlas grows before it starts a new row of faces. */
const ATLAS_W = 2048;
/** Pixels between faces in the atlas, so a smaller mipmap does not bleed one into the next. */
const GAP = 4;

/**
 * Lays a moving face over each special Tile; call the result each frame with seconds, or with
 * nothing to paint the icons at rest, `neon` for how lit Xuất phát's arrow is, and `marks` how
 * each Tile's price reads now.
 */
export const ambience = (parent: Object3D, at: At, anisotropy: number) => {
  const tiles = BOARD.flatMap((tile, i) =>
    isSpecial(tile.kind) || tile.kind === 'utility' ? [i] : [],
  );
  let x = 0;
  let y = 0;
  let row = 0;
  const cells = tiles.map((i) => {
    const p = placement(i);
    const w = Math.ceil(p.w * PX);
    const h = Math.ceil(p.h * PX);
    if (x + w > ATLAS_W) {
      x = 0;
      y += row + GAP;
      row = 0;
    }
    const cell = { i, x, y, w, h };
    x += w + GAP;
    row = Math.max(row, h);
    return cell;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(ATLAS_W, Math.max(...cells.map((c) => c.x + c.w)));
  canvas.height = y + row;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = anisotropy;
  const material = new MeshStandardMaterial({
    map,
    roughness: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  for (const { i, x, y, w, h } of cells) {
    const p = placement(i);
    const geometry = new PlaneGeometry(p.w, p.h);
    const uv = geometry.getAttribute('uv') as BufferAttribute;
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(
        k,
        (x + uv.getX(k) * w) / canvas.width,
        1 - (y + (1 - uv.getY(k)) * h) / canvas.height,
      );
    }
    const face = new Mesh(geometry, material);
    face.rotation.x = -Math.PI / 2;
    face.position.copy(at(p.x + p.w / 2, p.y + p.h / 2, 0.002));
    face.receiveShadow = true;
    parent.add(face);
  }
  let last = Number.NEGATIVE_INFINITY;
  return (t?: number, neon = 0, marks: ReadonlyMap<number, Mark> = new Map()) => {
    if (t !== undefined && t - last < 1 / FPS) return;
    last = t ?? Number.NEGATIVE_INFINITY;
    for (const { i, x, y, w, h } of cells) {
      ctx.setTransform(1, 0, 0, 1, x, y);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      paintTile(ctx, i, PX, t, i === 0 ? neon : 0, marks.get(i));
      ctx.restore();
    }
    map.needsUpdate = true;
  };
};
