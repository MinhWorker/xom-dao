"""Render a complete, static royal chess-room scene for composition review.

Run: npm run blender -- chess scene
The editable Blender file and PNG render stay under .blender/chess; the game-ready WebP
is written to assets/ and copied into godot/art/ for the isolated preview scene.
"""
from pathlib import Path
import math
import random
import shutil
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "blender"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from xomdao_bake import Image, cube, lathe, material, sphere, wood
from chess_models import make_piece as royal_piece
from chess_camera import CAMERA_LOCATION, CAMERA_TARGET, SENSOR_WIDTH

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / ".blender" / "chess"
OUT.mkdir(parents=True, exist_ok=True)
SELECTED = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []

BOARD_Z = 2.38
TABLE_TOP = 2.1
BOARD_SIDE = 10.0
PLAY_SIDE = 9.4
BOARD_Y = 2.4


def cylinder(name, radius, depth, position, mat, vertices=48, bevel=0.02):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=position
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft edge", "BEVEL")
        modifier.width, modifier.segments = bevel, 3
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def cone(name, radius_bottom, radius_top, depth, position, mat, vertices=48):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
        location=position,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("Soft edge", "BEVEL")
    modifier.width, modifier.segments = 0.025, 3
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def light(name, position, energy, color, size, target):
    bpy.ops.object.light_add(type="AREA", location=position)
    obj = bpy.context.object
    obj.name = name
    obj.data.energy = energy
    obj.data.shape = "DISK"
    obj.data.size = size
    obj.data.color = color
    aim(obj, target)
    return obj


def glow(name, color, strength):
    mat = material(name, color, 0.3, 0.0)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = strength
    return mat


def text_label(body, position, size, mat, rotation=(0, 0, 0)):
    bpy.ops.object.text_add(location=position, rotation=rotation)
    obj = bpy.context.object
    obj.name = f"Board label {body}"
    obj.data.body = body
    obj.data.size = size
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.extrude = 0.002
    obj.data.materials.append(mat)
    return obj


def curtain(name, x0, x1, y, z0, z1, mat):
    columns, rows = 14, 7
    vertices = []
    for row in range(rows + 1):
        t = row / rows
        for col in range(columns + 1):
            u = col / columns
            x = x0 + (x1 - x0) * u
            fold = math.sin(u * math.tau * 5) * 0.13
            vertices.append((x, y + fold, z0 + (z1 - z0) * t))
    faces = []
    stride = columns + 1
    for row in range(rows):
        for col in range(columns):
            a = row * stride + col
            faces.append((a, a + 1, a + stride + 1, a + stride))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    solidify = obj.modifiers.new("Cloth thickness", "SOLIDIFY")
    solidify.thickness = 0.055
    return obj


def bookcase(center_x, width, wall_y, mats, rng):
    front_y = wall_y - 0.44
    base_z, top_z = 3.1, 10.4
    cube("Bookcase backing", (width, 0.3, top_z - base_z),
         (center_x, wall_y - 0.22, (base_z + top_z) / 2), mats["dark_wood"], 0.08)
    for x in (center_x - width / 2, center_x + width / 2):
        cube("Bookcase stile", (0.28, 0.55, top_z - base_z + 0.25),
             (x, front_y, (base_z + top_z) / 2), mats["trim_wood"], 0.06)
    for z in [base_z, 4.55, 5.95, 7.35, 8.75, 10.25]:
        cube("Bookcase shelf", (width, 0.88, 0.2), (center_x, front_y - 0.12, z), mats["trim_wood"], 0.045)
        if z == base_z:
            continue
        x = center_x - width / 2 + 0.24
        while x < center_x + width / 2 - 0.35:
            book_width = rng.uniform(0.16, 0.31)
            book_height = rng.uniform(0.74, 1.22)
            book_mat = rng.choice(mats["books"])
            cube("Leather-bound book", (book_width, 0.48, book_height),
                 (x + book_width / 2, front_y - 0.34, z + 0.1 + book_height / 2),
                 book_mat, 0.025)
            if rng.random() > 0.35:
                cube("Book gilt band", (book_width * 0.72, 0.018, 0.035),
                     (x + book_width / 2, front_y - 0.586, z + 0.26), mats["brass"], 0.006)
            x += book_width + rng.uniform(0.035, 0.11)


def fireplace(wall_y, mats, fire_mat):
    y = wall_y - 0.75
    cube("Fireplace stone surround", (6.7, 0.72, 5.8), (0, y, 3.1), mats["stone"], 0.2)
    cube("Fireplace dark recess", (4.65, 0.24, 3.65), (0, y - 0.43, 2.5), mats["recess"], 0.12)
    cube("Fireplace inner shadow", (3.9, 0.11, 2.9), (0, y - 0.60, 2.33), mats["black_stone"], 0.08)
    cube("Fireplace hearth", (5.6, 1.1, 0.35), (0, y - 0.35, 0.55), mats["stone"], 0.12)
    cube("Carved mantel", (7.4, 0.82, 0.38), (0, y - 0.42, 5.95), mats["trim_wood"], 0.11)
    for x in (-2.72, 2.72):
        cube("Mantel pilaster", (0.48, 0.7, 4.55), (x, y - 0.4, 3.35), mats["trim_wood"], 0.12)
        cube("Pilaster brass inset", (0.07, 0.04, 3.45), (x, y - 0.78, 3.32), mats["brass"], 0.018)
    for index, x in enumerate((-1.1, -0.48, 0.08, 0.58, 1.02)):
        height = (1.0, 1.55, 1.9, 1.52, 0.92)[index]
        flame = sphere("Firelight", (x, y - 0.74, 1.1 + height / 2),
                       (0.24, 0.11, height / 2), fire_mat, 24, 16)
        flame.rotation_euler.y = (index - 2) * 0.12
    for x in (-1.6, -0.25, 1.4):
        cylinder("Fire log", 0.09, 2.2, (x, y - 0.82, 0.85), mats["coal"], 20, 0.02).rotation_euler.y = math.pi / 2


def window(center_x, wall_y, mats):
    width, height, center_z = 4.8, 6.3, 6.7
    frame_y = wall_y - 0.34
    cube("Window dark frame", (width + 0.48, 0.34, height + 0.48),
         (center_x, frame_y, center_z), mats["trim_wood"], 0.08)
    cube("Moonlit window glass", (width, 0.12, height),
         (center_x, frame_y - 0.2, center_z), mats["glass"], 0.015)
    for dx in (-width / 4, width / 4):
        cube("Window mullion", (0.12, 0.18, height), (center_x + dx, frame_y - 0.33, center_z), mats["brass"], 0.025)
    for dz in (-height / 4, height / 4):
        cube("Window crossbar", (width, 0.18, 0.11), (center_x, frame_y - 0.34, center_z + dz), mats["brass"], 0.02)
    cube("Window sill", (width + 0.9, 0.7, 0.24), (center_x, frame_y - 0.32, center_z - height / 2 - 0.14), mats["trim_wood"], 0.08)
    curtain("Left velvet curtain", center_x - width / 2 - 1.05, center_x - width / 2 + 0.15,
            frame_y - 0.5, 2.8, 10.8, mats["velvet"])
    curtain("Right velvet curtain", center_x + width / 2 - 0.15, center_x + width / 2 + 1.05,
            frame_y - 0.5, 2.8, 10.8, mats["velvet"])
    for x in (center_x - width / 2 - 0.45, center_x + width / 2 + 0.45):
        sphere("Curtain tieback", (x, frame_y - 0.62, 5.0), (0.18, 0.16, 0.14), mats["brass"], 20, 12)


def wall_sconce(x, wall_y, z, mats, bulb):
    y = wall_y - 0.58
    cube("Sconce backplate", (0.42, 0.22, 0.85), (x, y, z), mats["brass"], 0.08)
    cylinder("Sconce arm", 0.06, 0.62, (x, y - 0.28, z - 0.08), mats["brass"], 24, 0.015).rotation_euler.x = math.pi / 2
    sphere("Sconce flame", (x, y - 0.55, z + 0.28), (0.14, 0.12, 0.28), bulb, 24, 16)


def make_room():
    wall_y = 12.8
    wood_wall = wood("Dark walnut paneling", (0.018, 0.008, 0.004), (0.105, 0.045, 0.018))
    trim_wood = wood("Polished walnut trim", (0.035, 0.014, 0.005), (0.22, 0.075, 0.022))
    dark_wood = wood("Shelf walnut", (0.015, 0.006, 0.004), (0.075, 0.026, 0.009))
    floor = wood("Dark oak floor", (0.012, 0.009, 0.008), (0.09, 0.05, 0.025))
    velvet = material("Forest-green velvet", (0.018, 0.065, 0.045), 0.88, 0.0)
    brass = material("Aged brass", (0.39, 0.22, 0.065), 0.3, 0.45)
    stone = material("Warm carved stone", (0.12, 0.085, 0.058), 0.62, 0.08)
    recess = material("Fireplace recess", (0.008, 0.006, 0.005), 0.88, 0.0)
    black_stone = material("Black firebox stone", (0.012, 0.009, 0.007), 0.78, 0.0)
    glass = glow("Moonlit blue glass", (0.06, 0.16, 0.28), 0.35)
    bulb = glow("Warm sconce glow", (1.0, 0.38, 0.08), 2.2)
    fire_mat = glow("Amber fire", (1.0, 0.22, 0.035), 3.0)
    coal = material("Fireplace logs", (0.045, 0.018, 0.009), 0.92, 0.0)
    books = [
        material("Oxblood leather", (0.16, 0.025, 0.018), 0.62),
        material("Green leather", (0.018, 0.085, 0.05), 0.62),
        material("Navy leather", (0.018, 0.035, 0.085), 0.62),
        material("Brown leather", (0.12, 0.052, 0.018), 0.62),
        material("Black leather", (0.025, 0.022, 0.019), 0.66),
    ]
    mats = {
        "wall": wood_wall, "trim_wood": trim_wood, "dark_wood": dark_wood,
        "floor": floor, "velvet": velvet, "brass": brass, "stone": stone,
        "recess": recess, "black_stone": black_stone, "glass": glass, "coal": coal,
        "books": books,
    }
    cube("Library floor", (38, 42, 0.35), (0, 3.5, -0.25), floor, 0.02)
    cube("Back wall", (36, 0.55, 15), (0, wall_y, 7.5), wood_wall, 0.04)
    # Raised wall panels and a brass chair rail give the distant wall clear rhythm.
    for x in range(-16, 17, 2):
        cube("Lower wall panel", (1.65, 0.14, 3.2), (x, wall_y - 0.34, 1.95), dark_wood, 0.06)
        cube("Panel edge bead", (0.045, 0.08, 2.65), (x - 0.73, wall_y - 0.44, 1.95), brass, 0.015)
    cube("Chair rail", (34, 0.3, 0.18), (0, wall_y - 0.4, 3.65), trim_wood, 0.05)
    cube("Brass chair-rail line", (34, 0.08, 0.045), (0, wall_y - 0.57, 3.65), brass, 0.012)
    rng = random.Random(27)
    bookcase(-6.2, 4.25, wall_y, mats, rng)
    bookcase(6.2, 4.25, wall_y, mats, rng)
    window(-12.0, wall_y, mats)
    fireplace(wall_y, mats, fire_mat)
    # A small framed landscape on the right wall balances the blue window.
    paint_x, paint_y, paint_z = 12.0, wall_y - 0.42, 7.0
    cube("Landscape canvas", (3.6, 0.16, 4.5), (paint_x, paint_y, paint_z), mats["glass"], 0.02)
    for x in (paint_x - 1.95, paint_x + 1.95):
        cube("Landscape frame side", (0.23, 0.38, 4.95), (x, paint_y - 0.25, paint_z), trim_wood, 0.06)
    for z in (paint_z - 2.35, paint_z + 2.35):
        cube("Landscape frame rail", (4.15, 0.38, 0.23), (paint_x, paint_y - 0.25, z), trim_wood, 0.06)
    # Picture shapes: a distant hill and a low moon, kept abstract and subdued.
    hill_mat = material("Landscape hill", (0.035, 0.09, 0.075), 0.8, 0.0)
    cube("Landscape hill silhouette", (3.25, 0.06, 0.9), (paint_x, paint_y - 0.12, paint_z - 1.15), hill_mat, 0.2)
    sphere("Landscape moon", (paint_x + 0.92, paint_y - 0.17, paint_z + 0.95), (0.35, 0.06, 0.35), brass, 32, 20)
    for x in (-3.65, 3.65):
        wall_sconce(x, wall_y, 7.3, mats, bulb)
        light("Warm wall sconce", (x, wall_y - 0.85, 7.35), 220, (1.0, 0.48, 0.19), 2.4, (x, 4, 4))
    light("Fireplace amber bounce", (0, wall_y - 1.2, 3.0), 480, (1.0, 0.34, 0.12), 3.5, (0, 3.2, 2.4))
    light("Moonlight from the window", (-12.0, 8.8, 8.0), 950, (0.34, 0.55, 1.0), 5.5, (0, 2, 2.2))
    return mats


def make_table(mats, size=(21.8, 16.0), full_furniture=True):
    width, depth = size
    table_wood = wood("Tabletop walnut", (0.025, 0.009, 0.004), (0.12, 0.043, 0.014))
    apron_wood = wood("Table apron", (0.018, 0.006, 0.003), (0.075, 0.023, 0.006))
    half_width, half_depth = width / 2, depth / 2
    cube("Large walnut gaming table", (width, depth, 0.52), (0, BOARD_Y, TABLE_TOP - 0.26), table_wood, 0.22, 5)
    if not full_furniture:
        cube("Brass front table inlay", (width - 1.4, 0.055, 0.035),
             (0, BOARD_Y - half_depth + 0.22, TABLE_TOP - 0.13), mats["brass"], 0.012)
        cube("Brass back table inlay", (width - 1.4, 0.055, 0.035),
             (0, BOARD_Y + half_depth - 0.22, TABLE_TOP - 0.13), mats["brass"], 0.012)
        return table_wood

    cube("Front table apron", (width - 1.2, 0.58, 1.05),
         (0, BOARD_Y - half_depth + 0.65, TABLE_TOP - 0.98), apron_wood, 0.12)
    cube("Back table apron", (width - 1.2, 0.58, 1.05),
         (0, BOARD_Y + half_depth - 0.65, TABLE_TOP - 0.98), apron_wood, 0.12)
    for x in (-half_width + 0.75, half_width - 0.75):
        cube("Side table apron", (0.58, depth - 1.4, 1.05), (x, BOARD_Y, TABLE_TOP - 0.98), apron_wood, 0.12)
    leg_wood = wood("Carved table legs", (0.026, 0.008, 0.003), (0.14, 0.043, 0.012))
    for x in (-half_width + 1.35, half_width - 1.35):
        for y in (BOARD_Y - half_depth + 1.45, BOARD_Y + half_depth - 1.45):
            leg = cube("Tapered table leg", (0.95, 0.95, 1.78), (x, y, 0.97), leg_wood, 0.12)
            leg.rotation_euler.z = math.radians(8 if x < 0 else -8)
            cube("Foot block", (1.2, 1.18, 0.22), (x, y, 0.17), mats["trim_wood"], 0.08)
    cube("Brass front table inlay", (width - 1.4, 0.055, 0.035),
         (0, BOARD_Y - half_depth + 0.22, TABLE_TOP - 0.13), mats["brass"], 0.012)
    cube("Brass back table inlay", (width - 1.4, 0.055, 0.035),
         (0, BOARD_Y + half_depth - 0.22, TABLE_TOP - 0.13), mats["brass"], 0.012)
    # A dark wine rug peeks around the table and anchors its feet to the room.
    rug = material("Oxblood rug", (0.075, 0.018, 0.018), 0.95, 0.0)
    cube("Royal rug", (width + 2.6, depth + 2.4, 0.12), (0, BOARD_Y, 0.02), rug, 0.08)
    for x in (-half_width - 0.9, half_width + 0.9):
        cube("Rug brass border", (0.045, depth + 2.0, 0.025), (x, BOARD_Y, 0.095), mats["brass"], 0.01)
    return table_wood


def make_piece(kind, x, y, z, piece_mat, brass):
    return royal_piece(kind, x, y, z, piece_mat, brass)


def make_board(include_labels=True, include_pieces=True):
    rim = wood("Chessboard walnut frame", (0.035, 0.011, 0.003), (0.20, 0.068, 0.016))
    light_square = wood("Maple board squares", (0.42, 0.27, 0.12), (0.68, 0.49, 0.26))
    dark_square = wood("Walnut board squares", (0.045, 0.013, 0.004), (0.14, 0.043, 0.012))
    gold = material("Board brass inlay", (0.5, 0.27, 0.065), 0.34, 0.35)
    label_mat = material("Board coordinate lettering", (0.82, 0.68, 0.43), 0.55, 0.0)
    cube("Carved chessboard", (BOARD_SIDE, BOARD_SIDE, 0.24), (0, BOARD_Y, TABLE_TOP + 0.12), rim, 0.1, 5)
    cube("Board brass border", (9.72, 9.72, 0.035), (0, BOARD_Y, TABLE_TOP + 0.265), gold, 0.028)
    cell = PLAY_SIDE / 8
    for row in range(8):
        for col in range(8):
            x = -PLAY_SIDE / 2 + (col + 0.5) * cell
            y = BOARD_Y + PLAY_SIDE / 2 - (row + 0.5) * cell
            cube(f"Square {row}:{col}", (cell, cell, 0.04), (x, y, TABLE_TOP + 0.305),
                 light_square if (row + col) % 2 == 0 else dark_square, 0.004, 1)
    if include_labels:
        for index, file_name in enumerate("abcdefgh"):
            x = -PLAY_SIDE / 2 + (index + 0.5) * cell
            text_label(file_name, (x, BOARD_Y - 4.88, TABLE_TOP + 0.325), 0.26, label_mat)
            text_label(file_name, (x, BOARD_Y + 4.88, TABLE_TOP + 0.325), 0.26, label_mat)
            y = BOARD_Y + PLAY_SIDE / 2 - (index + 0.5) * cell
            text_label(str(8 - index), (-4.88, y, TABLE_TOP + 0.325), 0.26, label_mat)
            text_label(str(8 - index), (4.88, y, TABLE_TOP + 0.325), 0.26, label_mat)
    if not include_pieces:
        return
    white = material("Ivory chess pieces", (0.82, 0.72, 0.53), 0.23, 0.3)
    black = material("Charcoal chess pieces", (0.025, 0.032, 0.043), 0.2, 0.32)
    piece_gold = material("Chess piece brass details", (0.42, 0.24, 0.07), 0.34, 0.32)
    back_rank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"]
    for side, color, rank, pawn_rank in (("black", black, 0, 1), ("white", white, 7, 6)):
        for col, kind in enumerate(back_rank):
            x = -PLAY_SIDE / 2 + (col + 0.5) * cell
            row = rank
            y = BOARD_Y + PLAY_SIDE / 2 - (row + 0.5) * cell
            make_piece(kind, x, y, TABLE_TOP + 0.345, color, piece_gold)
            pawn_row = pawn_rank
            pawn_y = BOARD_Y + PLAY_SIDE / 2 - (pawn_row + 0.5) * cell
            make_piece("pawn", x, pawn_y, TABLE_TOP + 0.345, color, piece_gold)


def build_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.curves):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.filepath = str(OUT / "chess-room-scene.png")
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes["Background"]
    background.inputs[0].default_value = (0.018, 0.024, 0.04, 1)
    background.inputs[1].default_value = 0.28

    room_mats = make_room()
    table_wood = make_table(room_mats)
    make_board()

    light("Warm key over the board", (-8, -8, 15), 2600, (1.0, 0.69, 0.42), 9, (0, 1, 2.1))
    light("Cool moon fill", (10, -3, 11), 1600, (0.46, 0.63, 1.0), 8, (0, 2, 3))
    light("Soft overhead bounce", (0, 3, 17), 1800, (1.0, 0.82, 0.62), 10, (0, 2, 2))
    # Keep the same direction as the game camera while framing the full room.
    bpy.ops.object.camera_add(location=CAMERA_LOCATION)
    camera = bpy.context.object
    camera.name = "Royal-room still camera"
    camera.data.type = "PERSP"
    camera.data.lens = 58
    camera.data.sensor_width = SENSOR_WIDTH
    camera.data.sensor_fit = "HORIZONTAL"
    aim(camera, CAMERA_TARGET)
    scene.camera = camera

    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "chess-room-scene.blend"))
    bpy.ops.render.render(write_still=True)
    with Image.open(scene.render.filepath) as rendered:
        rendered.convert("RGB").save(ROOT / "assets" / "chess-scene.webp", "WEBP", quality=92, method=6)
    target = ROOT / "godot" / "art" / "chess-scene.webp"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / "assets" / "chess-scene.webp", target)
    print(f"Rendered static scene to {ROOT / 'assets' / 'chess-scene.webp'}")


if not SELECTED or "scene" in SELECTED:
    build_scene()
