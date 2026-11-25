/**
 * Moves the icons of the special Tiles and the two utilities: each gets a canvas laid flat over its printed face,
 * repainted a few dozen times a second with `paintTile` at the current time.
 */
import {
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  type Vector3,
} from 'three';
import { BOARD } from '../server/game/board.js';
import { paintTile, placement } from './print.js';
import { isSpecial } from './special.js';

/** Board units to the board group's space; `y` is height above the board. */
type At = (u: number, v: number, y?: number) => Vector3;

/** Pixels per board unit on the moving faces. */
const PX = 256;
const FPS = 30;

/**
 * Lays a moving face over each special Tile; call the result each frame with seconds, or with
 * nothing to paint the icons at rest, `neon` for how lit Xuất phát's arrow is, and `struck` the
 * Tiles whose price is crossed out.
 */
export const ambience = (parent: Object3D, at: At, anisotropy: number) => {
  const faces = BOARD.flatMap((tile, i) => {
    if (!isSpecial(tile.kind) && tile.kind !== 'utility') return [];
    const p = placement(i);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(p.w * PX);
    canvas.height = Math.round(p.h * PX);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = anisotropy;
    const face = new Mesh(
      new PlaneGeometry(p.w, p.h),
      new MeshStandardMaterial({
        map,
        roughness: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    face.rotation.x = -Math.PI / 2;
    face.position.copy(at(p.x + p.w / 2, p.y + p.h / 2, 0.002));
    face.receiveShadow = true;
    parent.add(face);
    return [{ i, ctx, map }];
  });
  let last = Number.NEGATIVE_INFINITY;
  return (t?: number, neon = 0, struck: ReadonlySet<number> = new Set()) => {
    if (t !== undefined && t - last < 1 / FPS) return;
    last = t ?? Number.NEGATIVE_INFINITY;
    for (const { i, ctx, map } of faces) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      paintTile(ctx, i, PX, t, i === 0 ? neon : 0, struck.has(i));
      map.needsUpdate = true;
    }
  };
};
