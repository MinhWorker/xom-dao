"""Render the classic board at a fixed camera angle and export matching tile coordinates.

Run from the repository root:
  blender -b -t 4 --python games/co-ty-phu-classic/sources/render_board_25d.py
"""

from __future__ import annotations

import json
import math
import sys
import shutil
from pathlib import Path

import bpy
from PIL import Image, ImageDraw
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

REPO = Path("/home/minhnk/Projects/Games/xom-dao")
ROOT = REPO / "games" / "co-ty-phu-classic"
PNG = REPO / ".blender" / "co-ty-phu-classic-board.png"
METAL_INK = REPO / ".blender" / "co-ty-phu-classic-metal-ink.png"
WEBP = ROOT / "assets" / "board-25d.webp"
GEOMETRY = ROOT / "assets" / "board-geometry.json"
BLEND = REPO / ".blender" / "co-ty-phu-classic-board.blend"
WIDTH, HEIGHT = 1400, 1200
CROP_X, CROP_Y, CROP_WIDTH, CROP_HEIGHT = 35, 145, 1330, 1045
INK = (34, 69, 68, 255)
GROUP_COLORS = {
    "nau": (67, 73, 89, 255),
    "xanh-nhat": (115, 221, 231, 255),
    "hong": (185, 77, 214, 255),
    "cam": (116, 81, 199, 255),
    "do": (195, 40, 142, 255),
    "vang": (119, 113, 125, 255),
    "xanh-la": (103, 60, 145, 255),
    "xanh-dam": (23, 101, 120, 255),
}
# A compact inset in the open field, in unprojected board coordinates.
FIELD = (0.18, 0.18, 0.82, 0.79)
PANEL_BOTTOM = 0.365
PANEL = {
    "avatar": {"u": 0.322, "v": 0.274, "r": 0.033},
    "name": {"u": 0.375, "v": 0.248},
    "cash": {"u": 0.375, "v": 0.299},
    "field": {"top": PANEL_BOTTOM, "bottom": FIELD[3]},
}

# Keep this order and the group colors in sync with BOARD and GROUP_COLORS in game/model.ts.
SQUARES = [
    ('start', None),
    ('street', 'nau'),
    ('street', 'nau'),
    ('street', 'nau'),
    ('tax', None),
    ('station', None),
    ('street', 'xanh-nhat'),
    ('chance', None),
    ('street', 'xanh-nhat'),
    ('street', 'xanh-nhat'),
    ('jail', None),
    ('street', 'hong'),
    ('power', None),
    ('street', 'hong'),
    ('street', 'hong'),
    ('station', None),
    ('street', 'cam'),
    ('chest', None),
    ('street', 'cam'),
    ('street', 'cam'),
    ('airport', None),
    ('street', 'do'),
    ('chance', None),
    ('street', 'do'),
    ('street', 'do'),
    ('station', None),
    ('street', 'vang'),
    ('street', 'vang'),
    ('water', None),
    ('street', 'vang'),
    ('go-jail', None),
    ('street', 'xanh-la'),
    ('street', 'xanh-la'),
    ('chest', None),
    ('street', 'xanh-la'),
    ('station', None),
    ('street', 'xanh-dam'),
    ('street', 'xanh-dam'),
    ('tax', None),
    ('street', 'xanh-dam'),
]


def axis(n, horizontal):
    if horizontal:
        margin, corner, far_start, far_corner = 0.044, 0.136, 0.82, 0.136
    else:
        margin, corner, far_start, far_corner = 0.044, 0.136, 0.79, 0.125
    middle = (far_start - corner - margin) / 9
    if n == 0:
        return margin, corner
    if n == 10:
        return far_start, far_corner
    return margin + corner + (n - 1) * middle, middle


def square_bounds(i):
    if i <= 10:
        col, row = 10 - i, 10
    elif i <= 20:
        col, row = 0, 20 - i
    elif i <= 30:
        col, row = i - 20, 0
    else:
        col, row = 10, i - 30
    u, w = axis(col, True)
    v, h = axis(row, False)
    return u, v, u + w, v + h


def tile_side(i):
    if 1 <= i <= 9:
        return "bottom"
    if 11 <= i <= 19:
        return "left"
    if 21 <= i <= 29:
        return "top"
    if 31 <= i <= 39:
        return "right"
    return "corner"


def face_bounds(square):
    """Ivory face inside the printed bevel; these are surface limits, not tile hit bounds."""
    u0, v0, u1, v1 = square_bounds(square)
    side = tile_side(square)
    iu, iv = (.035, .045) if side in ("bottom", "top") else (.045, .035)
    if side == "corner":
        iu, iv = .04, .04
    du, dv = (u1 - u0) * iu, (v1 - v0) * iv
    return u0 + du, v0 + dv, u1 - du, v1 - dv


def draw_icon(draw, kind, size, color=INK):
    """Draw a single-ink tile symbol into a square, transparent vector-style canvas."""
    center = size / 2
    unit = size * 0.9

    def point(x, y):
        return (center + (x - 50) * unit / 100, center + (y - 50) * unit / 100)

    def poly(points, fill=color):
        draw.polygon([point(x, y) for x, y in points], fill=fill)

    def rect(box, radius=0, fill=color):
        x0, y0 = point(box[0], box[1])
        x1, y1 = point(box[2], box[3])
        if radius:
            draw.rounded_rectangle((x0, y0, x1, y1), radius=unit * radius / 100, fill=fill)
        else:
            draw.rectangle((x0, y0, x1, y1), fill=fill)

    def ellipse(box, fill=color):
        x0, y0 = point(box[0], box[1])
        x1, y1 = point(box[2], box[3])
        draw.ellipse((x0, y0, x1, y1), fill=fill)

    clear = (0, 0, 0, 0)
    if kind == "street":
        poly([(10, 44), (50, 12), (90, 44)])
        rect((20, 40, 80, 87), radius=5)
        rect((43, 59, 57, 87), fill=clear)
        rect((28, 50, 40, 62), fill=clear)
        rect((60, 50, 72, 62), fill=clear)
    elif kind == "station":
        rect((12, 48, 88, 72), radius=7)
        rect((24, 31, 53, 51), radius=4)
        rect((69, 36, 76, 49), radius=2)
        ellipse((22, 68, 43, 88))
        ellipse((62, 68, 83, 88))
        rect((28, 75, 37, 82), fill=clear)
        rect((68, 75, 77, 82), fill=clear)
    elif kind == "power":
        poly([(57, 8), (30, 53), (46, 53), (38, 92), (72, 42), (55, 42)])
    elif kind == "water":
        poly(
            [
                (50, 8), (25, 43), (18, 56), (19, 69), (26, 82), (38, 90),
                (50, 93), (62, 90), (74, 82), (81, 69), (82, 56), (75, 43),
            ]
        )
    elif kind == "start":
        poly([(88, 42), (35, 42), (35, 24), (6, 50), (35, 76), (35, 58), (88, 58)])
    elif kind == "chance":
        poly([(50, 6), (61, 38), (94, 50), (61, 61), (50, 94), (39, 61), (6, 50), (39, 38)])
    elif kind == "chest":
        rect((12, 37, 88, 52), radius=6)
        rect((17, 49, 83, 83), radius=5)
        rect((44, 53, 56, 66), radius=2)
        rect((46, 55, 54, 64), fill=clear)
    elif kind == "tax":
        ellipse((19, 22, 56, 48))
        rect((19, 35, 56, 48))
        ellipse((19, 28, 56, 51), fill=color)
        ellipse((43, 42, 80, 68))
        rect((43, 55, 80, 68))
        ellipse((43, 48, 80, 71), fill=color)
        ellipse((22, 62, 77, 90))
        rect((22, 76, 77, 90))
        ellipse((22, 62, 77, 84), fill=color)
        ellipse((29, 67, 70, 79), fill=clear)
    elif kind in ("jail", "go-jail"):
        rect((16, 16, 84, 24), radius=3)
        rect((16, 76, 84, 84), radius=3)
        for x in (23, 39, 55, 71):
            rect((x, 22, x + 7, 78), radius=3)
        if kind == "go-jail":
            poly([(6, 47), (26, 34), (26, 42), (44, 42), (44, 52), (26, 52), (26, 61)])
    elif kind == "airport":
        poly([
            (46, 8), (54, 8), (59, 39), (91, 60), (91, 68),
            (58, 56), (56, 78), (70, 88), (70, 94), (50, 88),
            (30, 94), (30, 88), (44, 78), (42, 56), (9, 68),
            (9, 60), (41, 39),
        ])


def material(name, color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    # Input palette is sRGB; Blender shader colors are linear.
    rgb = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in color)
    mat.diffuse_color = (*rgb, 1)
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return mat


def slab(name, bounds, top, thickness, bevel, mat):
    u0, v0, u1, v1 = bounds
    bpy.ops.mesh.primitive_cube_add(size=1, location=((u0 + u1 - 1) * 2, (1 - v0 - v1) * 2, top - thickness / 2))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = ((u1 - u0) * 4, (v1 - v0) * 4, thickness)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    edge = obj.modifiers.new("Soft toy edge", "BEVEL")
    edge.width, edge.segments = bevel, 4
    obj.modifiers.new("Weighted face normals", "WEIGHTED_NORMAL")
    obj.data.materials.append(mat)
    return obj


def print_symbols():
    ink = Image.new("RGBA", (3072, 3072), (0, 0, 0, 0))
    draw = ImageDraw.Draw(ink)

    # Corner symbols
    for i, (kind, _) in enumerate(SQUARES):
        if kind in ("street", "station", "power", "water", "chance", "chest", "tax"):
            continue
        u0, v0, u1, v1 = square_bounds(i)
        side = tile_side(i)
        u, v = .5, .38 if side == "corner" else .5
        if side == "bottom":
            v = .61
        elif side == "top":
            v = .39
        elif side == "left":
            u, v = .38, .58
        elif side == "right":
            u, v = .62, .58
        symbol = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        draw_icon(ImageDraw.Draw(symbol), kind, 512)
        pixels = round(min(u1 - u0, v1 - v0) * ink.width * .43)
        symbol = symbol.resize((pixels, pixels), Image.Resampling.LANCZOS)
        ink.alpha_composite(symbol, (round((u0 + (u1 - u0) * u) * ink.width - pixels / 2), round((v0 + (v1 - v0) * v) * ink.height - pixels / 2)))

    gold_ink = (185, 145, 75, 235)

    # Card deck top filigree and gold emblems
    def draw_card_top(u0, v0, u1, v1, is_chest):
        x0, y0 = round(u0 * 3072), round(v0 * 3072)
        x1, y1 = round(u1 * 3072), round(v1 * 3072)
        pad = round((x1 - x0) * 0.08)
        draw.rounded_rectangle((x0 + pad, y0 + pad, x1 - pad, y1 - pad), radius=16, outline=gold_ink, width=4)
        draw.rounded_rectangle((x0 + pad + 6, y0 + pad + 6, x1 - pad - 6, y1 - pad - 6), radius=12, outline=gold_ink, width=2)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        size = round((x1 - x0) * 0.50)
        icon_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw_icon(ImageDraw.Draw(icon_img), "chest" if is_chest else "chance", size, color=gold_ink)
        ink.alpha_composite(icon_img, (cx - size // 2, cy - size // 2))

    draw_card_top(0.193, 0.536, 0.297, 0.684, True)
    draw_card_top(0.703, 0.536, 0.807, 0.684, False)

    ink.save(METAL_INK)

    # Transfer mesh on the board surface and tiles
    mesh = bpy.data.meshes.new("Printed symbols")
    mesh.from_pydata([(-2, -2, .0325), (2, -2, .0325), (2, 2, .0325), (-2, 2, .0325)], [], [(0, 1, 2, 3)])
    uv = mesh.uv_layers.new()
    for loop, coord in zip(mesh.polygons[0].loop_indices, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[loop].uv = coord
    obj = bpy.data.objects.new("Ink on the tile faces", mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new("Transparent ceramic transfers")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    mix = nodes.new("ShaderNodeMixShader")
    clear = nodes.new("ShaderNodeBsdfTransparent")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = .65
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(METAL_INK))
    texture.image.pack()
    links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    links.new(texture.outputs["Alpha"], mix.inputs[0])
    links.new(clear.outputs[0], mix.inputs[1])
    links.new(shader.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    obj.data.materials.append(mat)

    # Deck top transfer mesh at deck height
    deck_mesh = bpy.data.meshes.new("Deck top transfers")
    deck_mesh.from_pydata([(-2, -2, .0585), (2, -2, .0585), (2, 2, .0585), (-2, 2, .0585)], [], [(0, 1, 2, 3)])
    uv2 = deck_mesh.uv_layers.new()
    for loop, coord in zip(deck_mesh.polygons[0].loop_indices, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv2.data[loop].uv = coord
    deck_obj = bpy.data.objects.new("Deck top transfers obj", deck_mesh)
    bpy.context.collection.objects.link(deck_obj)
    deck_obj.data.materials.append(mat)


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
PNG.parent.mkdir(parents=True, exist_ok=True)

wood = material("Deep teal lacquer", (.13, .29, .29), .05, .34)
dark_wood = material("Dark underside", (.08, .17, .18), .02, .5)
gold = material("Satin brass", (.77, .59, .32), .55, .36)
ivory = material("Warm ceramic", (.96, .92, .82), .02, .48)
paper = material("Turn plaque porcelain", (.99, .96, .88), .02, .48)
felt = material("Quiet jade playing field", (.47, .67, .60), 0, .94)
slab("Underframe", (.034, .034, .966, .927), -.050, .115, .035, dark_wood)
slab("Slim brass reveal", (.036, .036, .964, .925), -.018, .028, .012, gold)
slab("Lacquer playing tray", (.039, .039, .961, .922), .015, .05, .018, wood)
slab("Inset field brass rim", (.177, .177, .823, .793), .018, .025, .009, gold)
slab("Jade field", (.181, .181, .819, .789), .024, .025, .010, felt)

special_colors = {
    "start": (.74, .85, .69), "chance": (.80, .75, .89),
    "chest": (.94, .78, .40), "tax": (.89, .76, .64),
    "jail": (.66, .76, .80), "go-jail": (.66, .76, .80),
    "airport": (.42, .76, .77), "station": (.86, .87, .81),
    "power": (.92, .84, .60), "water": (.69, .85, .88),
}
specials = {kind: material(f"{kind} enamel", rgb, .12, .43) for kind, rgb in special_colors.items()}
groups = {name: material(f"Group {name}", tuple(c / 255 for c in rgb[:3]), .03, .4) for name, rgb in GROUP_COLORS.items()}
for i, (kind, group) in enumerate(SQUARES):
    bounds = face_bounds(i)
    slab(f"Tile {i:02d} {kind}", bounds, .035, .032, .010, ivory if group else specials[kind])
    if not group:
        continue
    u0, v0, u1, v1 = bounds
    w, h = u1 - u0, v1 - v0
    side = tile_side(i)
    if side == "bottom":
        band = (u0 + w * .035, v1 - h * .12, u1 - w * .035, v1 - h * .035)
    elif side == "top":
        band = (u0 + w * .035, v0 + h * .035, u1 - w * .035, v0 + h * .12)
    elif side == "left":
        band = (u0 + w * .035, v0 + h * .035, u0 + w * .12, v1 - h * .035)
    else:
        band = (u1 - w * .12, v0 + h * .035, u1 - w * .035, v1 - h * .035)
    slab(f"Group inlay {i:02d}", band, .036, .004, .0015, groups[group])

# One continuous header fills the inset above the playing field.
p_bounds = (0.181, 0.181, 0.819, PANEL_BOTTOM)
slab("Turn header brass rim", (p_bounds[0] - .003, p_bounds[1] - .003, p_bounds[2] + .003, p_bounds[3] + .003), .030, .012, .003, gold)
slab("Turn header plate", p_bounds, .032, .006, .002, paper)

# Card decks (3D physical stacks in the field)
card_stack_mat = material("Card stack edge paper", (.94, .91, .82), .01, .68)
chest_lacquer = material("Chest card back lacquer", (.06, .26, .30), .04, .28)
chance_lacquer = material("Chance card back lacquer", (.45, .06, .06), .04, .28)

chest_bounds = (0.193, 0.536, 0.297, 0.684)
slab("Chest deck stack", chest_bounds, .056, .032, .003, card_stack_mat)
slab("Chest top card", chest_bounds, .058, .004, .002, chest_lacquer)

chance_bounds = (0.703, 0.536, 0.807, 0.684)
slab("Chance deck stack", chance_bounds, .056, .032, .003, card_stack_mat)
slab("Chance top card", chance_bounds, .058, .004, .002, chance_lacquer)

# Bake ceramic ink transfers (corner symbols, placeholder ink-texture, card deck insignias)
print_symbols()

# Keep the established projection so board movement and hit regions remain familiar.
bpy.ops.object.camera_add(location=(0, -5.7, 8.7))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, -.02)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type, camera.data.lens = "PERSP", 75
scene = bpy.context.scene
scene.camera = camera
for name, location, energy, size in [("Soft upper-left key", (-3.5, -4, 7), 1050, 5), ("Broad fill", (4, 2, 5), 500, 5)]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy, light.data.size = energy, size
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = WIDTH, HEIGHT
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(PNG)
scene.view_settings.view_transform = "Standard"
scene.world.color = (.35, .35, .35)


def project(u, v, z=.035):
    point = world_to_camera_view(scene, camera, Vector(((u - .5) * 4, (.5 - v) * 4, z)))
    return [round((point.x * WIDTH - CROP_X) / CROP_WIDTH, 6), round(((1 - point.y) * HEIGHT - CROP_Y) / CROP_HEIGHT, 6)]


cells, faces = [], []
for i in range(40):
    for target, bounds in [(cells, square_bounds(i)), (faces, face_bounds(i))]:
        u0, v0, u1, v1 = bounds
        target.append([project(u0, v0), project(u1, v0), project(u1, v1), project(u0, v1)])

import numpy as np

corners = [(0, 0), (1, 0), (1, 1), (0, 1)]
rows, rhs = [], []
for (u, v), (x, y) in zip(corners, [project(u, v) for u, v in corners]):
    rows += [[u, v, 1, 0, 0, 0, -u*x, -v*x], [0, 0, 0, u, v, 1, -u*y, -v*y]]
    rhs += [x, y]
homography = [round(float(v), 8) for v in np.linalg.solve(np.array(rows), np.array(rhs))] + [1]
geometry = {"cells": cells, "faces": faces, "homography": homography, "ratio": CROP_WIDTH / CROP_HEIGHT, "panel": PANEL}
GEOMETRY.write_text(json.dumps(geometry, indent=2) + "\n")

# Generate the runtime geometry directly; there is no retired Phaser TypeScript step.
lines = ["extends RefCounted", "## Generated by sources/render_board_25d.py. Do not edit coordinates.", "", "const CELLS: Array = ["]
for cell in cells:
    lines.append("\t[")
    for j, (x, y) in enumerate(cell):
        lines.append(f"\t\tVector2({x}, {y})" + ("," if j < len(cell) - 1 else ""))
    lines.append("\t],")
lines += ["]", f"const IMAGE_RATIO := {geometry['ratio']}", "const HOMOGRAPHY: Array[float] = ["]
lines.append("\t" + ", ".join(str(v) for v in homography[:5]) + ",")
lines.append("\t" + ", ".join(str(v) for v in homography[5:]))
lines.append("]")
a = PANEL["avatar"]
lines += [f"const PANEL_AVATAR := Vector3({a['u']}, {a['v']}, {a['r']})"]
for key in ("name", "cash"):
    p = PANEL[key]
    lines.append(f"const PANEL_{key.upper()} := Vector2({p['u']}, {p['v']})")
lines += [f"const FIELD := Rect2(0.18, {PANEL_BOTTOM}, 0.64, {FIELD[3] - PANEL_BOTTOM})", ""]
(ROOT / "godot" / "board_geometry.gd").write_text("\n".join(lines))

if "--geometry-only" not in sys.argv:
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.render.render(write_still=True)
    Image.open(PNG).crop((CROP_X, CROP_Y, CROP_X + CROP_WIDTH, CROP_Y + CROP_HEIGHT)).save(WEBP, "WEBP", quality=95)
    shutil.copyfile(WEBP, ROOT / "godot" / "art" / "board.webp")
    print(f"Wrote {WEBP} and {GEOMETRY}")
