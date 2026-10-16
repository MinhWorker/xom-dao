"""Bake flush enamel owner strips and pitched-roof porcelain buildings with the board's Blender camera.

  blender -b -t 4 --python games/co-ty-phu-classic/sources/render_deed_layers.py

The atlas contains per-square sprites with baked lighting and porcelain forms.
Strips sit flush in the face, inside its printed bevel.
Game state only selects atlas frames.
"""

from __future__ import annotations

import json
import math
import runpy
import sys
from pathlib import Path

import bpy
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.argv.append("--geometry-only")
board = runpy.run_path(str(ROOT / "sources" / "render_board_25d.py"))
scene = bpy.context.scene
for obj in scene.objects:
    if obj.type not in ("LIGHT", "CAMERA"):
        obj.hide_render = True
scene.cycles.samples = 32
scene.cycles.use_denoising = True

PREVIEW = ROOT.parents[1] / ".blender"
ASSETS = ROOT / "assets"
SQUARES = board["SQUARES"]
WIDTH, HEIGHT = board["WIDTH"], board["HEIGHT"]
CX, CY, CW, CH = (board[name] for name in ("CROP_X", "CROP_Y", "CROP_WIDTH", "CROP_HEIGHT"))
DEEDS = [i for i, (kind, _) in enumerate(SQUARES) if kind in ("street", "station", "power", "water")]
STREETS = [i for i, (kind, _) in enumerate(SQUARES) if kind == "street"]
COLORS = [0xDF6554, 0x5793D3, 0x60AF72, 0xE6BE52]


def srgb(channel):
    c = channel / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def coated(name, rgb, roughness):
    mat = board["material"](name, rgb, 0.10, roughness)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    (shader.inputs.get("Coat Weight") or shader.inputs["Clearcoat"]).default_value = 0.4
    (shader.inputs.get("Coat Roughness") or shader.inputs["Clearcoat Roughness"]).default_value = 0.20
    return mat


enamel = coated("Player enamel inlay", (0.7, 0.1, 0.08), 0.3)
porcelain = coated("Owner-colored porcelain houses", (0.9, 0.2, 0.15), 0.24)


def uv(square, along, depth):
    u0, v0, u1, v1 = board["square_bounds"](square)
    side = board["tile_side"](square)
    if side == "bottom":
        u, v = along, 1 - depth
    elif side == "left":
        u, v = depth, along
    elif side == "top":
        u, v = along, depth
    else:
        u, v = 1 - depth, along
    return u0 + (u1 - u0) * u, v0 + (v1 - v0) * v


def xy(square, along, depth):
    u, v = uv(square, along, depth)
    return (u - 0.5) * 4, (0.5 - v) * 4


def dimensions(square):
    u0, v0, u1, v1 = board["square_bounds"](square)
    w, h = (u1 - u0) * 4, (v1 - v0) * 4
    return (w, h) if board["tile_side"](square) in ("bottom", "top") else (h, w)


badges = []
for square in DEEDS:
    corners = [xy(square, a, d) for a, d in ((.035, .855), (.965, .855), (.965, .955), (.035, .955))]
    xs, ys = zip(*corners)
    bpy.ops.mesh.primitive_cube_add(size=1, location=((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, 0.0355))
    obj = bpy.context.object
    obj.name = f"Flush enamel strip {square}"
    obj.dimensions = (max(xs) - min(xs), max(ys) - min(ys), 0.001)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("Fine enamel highlight", "BEVEL")
    bevel.width, bevel.segments = 0.00015, 2
    obj.modifiers.new("Face normals", "WEIGHTED_NORMAL")
    obj.data.materials.append(enamel)
    badges.append(obj)

# Crop around the whole tile and the tallest roof, not only the old flat ownership band.
rects = [None] * 40
for square in DEEDS:
    u0, v0, u1, v1 = board["square_bounds"](square)
    points = [board["project"](u, v, z) for u, v in ((u0, v0), (u1, v0), (u1, v1), (u0, v1)) for z in (.035, .16)]
    xs, ys = zip(*points)
    x0, y0 = math.floor(min(xs) * CW) - 3, math.floor(min(ys) * CH) - 3
    x1, y1 = math.ceil(max(xs) * CW) + 3, math.ceil(max(ys) * CH) + 3
    rects[square] = (x0, y0, x1 - x0, y1 - y0)
normalized = [None if r is None else [round(r[0]/CW, 8), round(r[1]/CH, 8), round(r[2]/CW, 8), round(r[3]/CH, 8)] for r in rects]

sprites = []


def render_frames(prefix, squares):
    png = PREVIEW / f"deed-{prefix}.png"
    if "--resume" not in sys.argv or not png.exists():
        scene.render.filepath = str(png)
        bpy.ops.render.render(write_still=True)
    source = Image.open(png)
    for square in squares:
        x, y, w, h = rects[square]
        sprite = source.crop((CX + x, CY + y, CX + x + w, CY + y + h))
        if prefix.startswith("owner-"):
            # The tall roof crop also sees the next tile's strip. Isolate this
            # flush strip before adding its contact shade, using its projected face.
            mask_scale = 4
            mask = Image.new("L", (w * mask_scale, h * mask_scale), 0)
            face = []
            for along, depth in ((.035, .855), (.965, .855), (.965, .955), (.035, .955)):
                u, v = uv(square, along, depth)
                px, py = board["project"](u, v, .036)
                face.append(((px * CW - x) * mask_scale, (py * CH - y) * mask_scale))
            ImageDraw.Draw(mask).polygon(face, fill=255)
            # Include subpixel bevel edges without admitting neighboring strips.
            mask = mask.filter(ImageFilter.MaxFilter(5)).resize((w, h), Image.Resampling.LANCZOS)
            alpha = np.minimum(np.asarray(sprite.getchannel("A")), np.asarray(mask))
            sprite.putalpha(Image.fromarray(alpha))
        # Soft contact shade follows only the object's matte, never a rectangular plane.
        alpha = sprite.getchannel("A")
        shade = Image.new("RGBA", sprite.size, (43, 36, 28, 0))
        soft = alpha.filter(ImageFilter.GaussianBlur(1.2)).point(lambda value: round(value * .23))
        displaced = Image.new("L", sprite.size, 0)
        displaced.paste(soft, (0, 1))
        shade.putalpha(displaced)
        shade.alpha_composite(sprite)
        sprite = shade
        bounds = sprite.getbbox()
        if bounds is None:
            raise ValueError(f"Empty Blender frame: {prefix}-{square}")
        sprites.append((f"{prefix}-{square}", sprite.crop(bounds), bounds, sprite.size))


for seat, color in enumerate(COLORS):
    rgb = tuple(srgb((color >> shift) & 255) for shift in (16, 8, 0))
    enamel.diffuse_color = (*rgb, 1)
    enamel.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (*rgb, 1)
    render_frames(f"owner-{seat}", DEEDS)

for obj in badges:
    obj.hide_render = True


roof_material = coated("Owner-colored glazed roof", (.13, .32, .36), .38)


def building(square, along_center, large=False):
    along, depth = dimensions(square)
    width, length = along * (.48 if large else .12), depth * .085
    height = .085 if large else .045
    center = xy(square, along_center, .87)
    horizontal = board["tile_side"](square) in ("bottom", "top")
    objects = []

    def transform(x, y, z):
        px, py = (x, y) if horizontal else (y, x)
        return center[0]+px, center[1]+py, z

    bpy.ops.mesh.primitive_cube_add(size=1, location=(*center, .038 + height / 2))
    body = bpy.context.object
    body.name = f"{'Hotel' if large else 'House'} {square}"
    body.dimensions = (width, length, height) if horizontal else (length, width, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    body.data.materials.append(porcelain)
    edge = body.modifiers.new("Porcelain corners", "BEVEL")
    edge.width, edge.segments = .003, 3
    body.modifiers.new("Body normals", "WEIGHTED_NORMAL")
    objects.append(body)
    # A pitched roof keeps the house silhouette recognizable at actual board size.
    w, d, z = width*.59, length*.65, .038+height
    points = [(-w,-d,z), (w,-d,z), (-w,d,z), (w,d,z), (-w,0,z+.020), (w,0,z+.020)]
    mesh = bpy.data.meshes.new("Pitched roof")
    mesh.from_pydata([transform(*p) for p in points], [], [(0,1,5,4), (4,5,3,2), (0,4,2), (1,3,5), (0,2,3,1)])
    mesh.update()
    roof = bpy.data.objects.new("Glazed roof", mesh)
    bpy.context.collection.objects.link(roof)
    roof.data.materials.append(roof_material)
    bevel = roof.modifiers.new("Soft roof edge", "BEVEL")
    bevel.width, bevel.segments = .002, 2
    objects.append(roof)
    return objects


for level in range(1, 6):
    buildings = []
    for square in STREETS:
        if level == 5:
            buildings.extend(building(square, .5, True))
        else:
            for k in range(level):
                buildings.extend(building(square, .5 + (k - (level-1)/2)*.19))
    for seat, color in enumerate(COLORS):
        for mat, shade in ((porcelain, 1.0), (roof_material, .72)):
            rgb = tuple(srgb(((color >> shift) & 255) * shade) for shift in (16, 8, 0))
            mat.diffuse_color = (*rgb, 1)
            mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (*rgb, 1)
        render_frames(f"houses-{seat}-{level}", STREETS)
    for obj in buildings:
        bpy.data.objects.remove(obj, do_unlink=True)

# White projected ink masks are tinted by the owner at runtime. The board has no baked
# deed symbols, so an ownership change cannot leave a neutral symbol under the colored one.
for square in DEEDS:
    kind, _ = SQUARES[square]
    u0, v0, u1, v1 = board["square_bounds"](square)
    side = board["tile_side"](square)
    u, v = {"bottom": (.16, .74), "top": (.16, .27), "left": (.26, .70), "right": (.74, .70)}[side]
    center_u, center_v = u0+(u1-u0)*u, v0+(v1-v0)*v
    half = min(u1-u0, v1-v0)*.14
    x, y, w, h = rects[square]
    quad = [board["project"](cu, cv, .0362) for cu, cv in ((center_u-half, center_v-half), (center_u+half, center_v-half), (center_u+half, center_v+half), (center_u-half, center_v+half))]
    rows, rhs = [], []
    for (px, py), (su, sv) in zip(quad, ((0,0), (512,0), (512,512), (0,512))):
        px, py = px*CW-x, py*CH-y
        rows += [[px,py,1,0,0,0,-px*su,-py*su], [0,0,0,px,py,1,-px*sv,-py*sv]]
        rhs += [su,sv]
    coefficients = np.linalg.solve(np.array(rows), np.array(rhs))
    icon = Image.new("RGBA", (512,512), (0,0,0,0))
    board["draw_icon"](ImageDraw.Draw(icon), kind, 512, (255,255,255,255))
    sprite = icon.transform((w,h), Image.Transform.PERSPECTIVE, coefficients, Image.Resampling.BICUBIC)
    bounds = sprite.getbbox()
    if bounds is None:
        raise ValueError(f"Empty symbol for tile {square}")
    sprites.append((f"symbol-{square}", sprite.crop(bounds), bounds, sprite.size))

# Shelf packing with two transparent pixels between frames prevents texture bleeding.
atlas_width = 2048
x, y, row_height = 2, 2, 0
packed = []
for name, sprite, bounds, source_size in sprites:
    w, h = sprite.size
    if x + w + 2 > atlas_width:
        x, y, row_height = 2, y + row_height + 4, 0
    packed.append((name, sprite, x, y, bounds, source_size))
    x += w + 4
    row_height = max(row_height, h)
atlas = Image.new("RGBA", (atlas_width, y + row_height + 2), (0, 0, 0, 0))
frames = {}
for name, sprite, x, y, bounds, source_size in packed:
    w, h = sprite.size
    atlas.paste(sprite, (x, y))
    frames[name] = {"frame": {"x": x, "y": y, "w": w, "h": h}, "rotated": False, "trimmed": True,
                    "spriteSourceSize": {"x": bounds[0], "y": bounds[1], "w": w, "h": h}, "sourceSize": {"w": source_size[0], "h": source_size[1]}}
atlas.save(ASSETS / "deed-layers.webp", "WEBP", quality=96, method=6)
(ASSETS / "deed-layers.json").write_text(json.dumps({"frames": frames, "meta": {"image": "deed-layers.webp", "size": {"w": atlas.width, "h": atlas.height}, "scale": "1", "boardRects": normalized}}, separators=(",", ":")))
print(f"Baked {len(frames)} Blender deed frames into {atlas.width}x{atlas.height}")
