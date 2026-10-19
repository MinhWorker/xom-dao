"""Bake chess-piece views for the Godot board camera.

Run: npm run blender -- chess [position-atlas | position-white-king ...]
Each piece atlas stores one frame per piece and board row. Files on the same row share a view from
this centered camera, so the atlas avoids storing duplicate column frames. PNG intermediates stay
in .blender/chess/position-atlas/.
"""
from pathlib import Path
import json
import shutil
import sys

import bpy
from mathutils import Vector
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "blender"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from xomdao_bake import material
from chess_models import make_piece
from chess_camera import (
    BOARD_Y,
    CAMERA_LENS,
    CAMERA_LOCATION,
    CAMERA_TARGET,
    PIECE_BASE_Z,
    PIECE_FRAME_WORLD_WIDTH,
    PLAYABLE_SIDE,
    piece_camera_location,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / ".blender" / "chess" / "position-atlas"
OUT.mkdir(parents=True, exist_ok=True)
SELECTED = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
KINDS = ("king", "queen", "rook", "bishop", "knight", "pawn")
SIDES = {
    "white": (0.82, 0.72, 0.53),
    "black": (0.025, 0.032, 0.043),
}
BRASS = (0.42, 0.24, 0.07)
FRAME = 256
GUTTER = 2
COLUMNS = 8
ROWS = 6
CELL = FRAME + GUTTER * 2


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 4
    scene.render.resolution_x = FRAME
    scene.render.resolution_y = FRAME
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.render.dither_intensity = 0
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes["Background"]
    background.inputs[0].default_value = (0.32, 0.27, 0.22, 1)
    background.inputs[1].default_value = 0.35

    camera_data = bpy.data.cameras.new("Chess square camera")
    camera = bpy.data.objects.new("Chess square camera", camera_data)
    scene.collection.objects.link(camera)
    camera.data.type = "PERSP"
    camera.data.lens = CAMERA_LENS
    camera.data.sensor_width = 36
    camera.data.sensor_fit = "HORIZONTAL"
    scene.camera = camera

    piece_origin = Vector((0.0, BOARD_Y, PIECE_BASE_Z))
    for name, position, energy, color, size, target in (
        ("Warm key", (-8, -8, 15), 2600, (1.0, 0.69, 0.42), 9, (0, 1, 2.1)),
        ("Cool fill", (10, -3, 11), 1600, (0.46, 0.63, 1.0), 8, (0, 2, 3)),
        ("Soft overhead bounce", (0, 3, 17), 1800, (1.0, 0.82, 0.62), 10, (0, 2, 2)),
    ):
        relative_position = Vector(position) - piece_origin
        relative_target = Vector(target) - piece_origin
        bpy.ops.object.light_add(type="AREA", location=relative_position)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        aim(light, relative_target)
    return scene, camera


def atlas_frame_index(kind_index, row):
    return kind_index * 8 + row


def render_page(scene, camera, side, kinds):
    page_name = f"pieces-{side}-view"
    file_path = OUT / f"{page_name}.png"
    texture_path = ROOT / "assets" / f"{page_name}.webp"
    metadata_path = ROOT / "assets" / f"{page_name}.json"

    atlas_image = Image.new("RGBA", (COLUMNS * CELL, ROWS * CELL), (0, 0, 0, 0))
    metadata = {"frames": {}}
    camera_forward = (Vector(CAMERA_TARGET) - Vector(CAMERA_LOCATION)).normalized()
    camera.rotation_euler = camera_forward.to_track_quat("-Z", "Y").to_euler()

    for kind in kinds:
        for obj in list(scene.objects):
            if obj.type == "MESH":
                bpy.data.objects.remove(obj, do_unlink=True)
        for collection in (bpy.data.meshes, bpy.data.materials):
            for block in list(collection):
                if block.users == 0:
                    collection.remove(block)

        piece_mat = material(f"{side.title()} satin stone", SIDES[side], 0.23, 0.3)
        brass_mat = material("Fine aged brass", BRASS, 0.34, 0.32)
        make_piece(kind, 0, 0, 0, piece_mat, brass_mat)
        kind_index = KINDS.index(kind)
        for row in range(8):
            cell = PLAYABLE_SIDE / 8
            y = BOARD_Y + PLAYABLE_SIDE / 2 - (row + 0.5) * cell
            target = Vector((0.0, y, PIECE_BASE_Z))
            _, distance = piece_camera_location(target)
            camera.location = -camera_forward * distance
            camera.data.lens = 36.0 * distance / PIECE_FRAME_WORLD_WIDTH
            frame_name = f"{side}-{kind}-row-{row}"
            scene.render.filepath = str(OUT / f"{frame_name}.png")
            bpy.ops.render.render(write_still=True)
            with Image.open(scene.render.filepath) as image:
                frame_image = image.convert("RGBA")
            frame_index = atlas_frame_index(kind_index, row)
            cell_x = (frame_index % COLUMNS) * CELL
            cell_y = (frame_index // COLUMNS) * CELL
            frame_x = cell_x + GUTTER
            frame_y = cell_y + GUTTER
            atlas_image.paste(frame_image, (frame_x, frame_y))
            metadata["frames"][f"{side}-{kind}-r{row}"] = {
                "frame": {"x": frame_x, "y": frame_y, "w": FRAME, "h": FRAME},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME, "h": FRAME},
                "sourceSize": {"w": FRAME, "h": FRAME},
            }
            print(f"Rendered {side}-{kind} row {row} at the fixed camera angle", flush=True)

    atlas_image.save(file_path, "PNG", optimize=True)
    texture_path.parent.mkdir(parents=True, exist_ok=True)
    atlas_image.save(texture_path, "WEBP", quality=95, method=6)
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
    godot_art = ROOT / "godot" / "art"
    godot_art.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(texture_path, godot_art / texture_path.name)
    print(f"Wrote {texture_path}", flush=True)


def selected_pairs():
    if not SELECTED or "position-atlas" in SELECTED or "position-pieces" in SELECTED:
        return [(side, kind) for side in SIDES for kind in KINDS]
    pairs = []
    for side in SIDES:
        for kind in KINDS:
            if f"position-{side}-{kind}" in SELECTED:
                pairs.append((side, kind))
    return pairs


PAIRS = selected_pairs()
if PAIRS:
    SCENE, CAMERA = setup_scene()
    GROUPED = {side: [] for side in SIDES}
    for SIDE, KIND in PAIRS:
        GROUPED[SIDE].append(KIND)
    for SIDE, KINDS_TO_RENDER in GROUPED.items():
        if KINDS_TO_RENDER:
            print(f"Rendering {SIDE} position atlas: {', '.join(KINDS_TO_RENDER)}", flush=True)
            render_page(SCENE, CAMERA, SIDE, KINDS_TO_RENDER)
