"""Render the Blender chessboard on its walnut table using the live game camera.

Run: npm run blender -- chess board-table
The editable scene and PNG stay in .blender/chess; the WebP plate and camera profile are copied
into the game's Godot art pack.
"""
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Vector
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "blender"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from xomdao_bake import material, wood
from chess_camera import (
    BOARD_RESOLUTION,
    CAMERA_LENS,
    CAMERA_LOCATION,
    CAMERA_TARGET,
    SENSOR_WIDTH,
    write_godot_profile,
    write_profile,
)
from render_scene import make_board, make_table

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / ".blender" / "chess"
SELECTED = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def build_board_table():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.curves,
    ):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = BOARD_RESOLUTION
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.filepath = str(OUT / "chess-board-table.png")
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes["Background"]
    # Match the game's BoardBackdrop (#110D0C) after AgX so the plate edge disappears in Godot.
    background.inputs[0].default_value = (0.031, 0.025, 0.021, 1)
    background.inputs[1].default_value = 0.28

    trim_wood = wood("Table trim walnut", (0.018, 0.006, 0.003), (0.075, 0.023, 0.006))
    brass = material("Table brass trim", (0.5, 0.27, 0.065), 0.34, 0.35)
    make_table({"trim_wood": trim_wood, "brass": brass}, size=(12.0, 11.2), full_furniture=False)
    make_board(include_labels=False, include_pieces=False)

    for name, position, energy, color, size, target in (
        ("Warm key over the board", (-8, -8, 15), 2600, (1.0, 0.69, 0.42), 9, (0, 1, 2.1)),
        ("Cool moon fill", (10, -3, 11), 1600, (0.46, 0.63, 1.0), 8, (0, 2, 3)),
        ("Soft overhead bounce", (0, 3, 17), 1800, (1.0, 0.82, 0.62), 10, (0, 2, 2)),
    ):
        bpy.ops.object.light_add(type="AREA", location=position)
        lamp = bpy.context.object
        lamp.name = name
        lamp.data.energy = energy
        lamp.data.shape = "DISK"
        lamp.data.size = size
        lamp.data.color = color
        lamp.rotation_euler = (Vector(target) - lamp.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.camera_add(location=CAMERA_LOCATION)
    camera = bpy.context.object
    camera.name = "Chess game camera"
    camera.data.type = "PERSP"
    camera.data.lens = CAMERA_LENS
    camera.data.sensor_width = SENSOR_WIDTH
    camera.data.sensor_fit = "HORIZONTAL"
    camera.rotation_euler = (
        Vector(CAMERA_TARGET) - camera.location
    ).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    scene.render.filepath = str(OUT / "chess-board-table.png")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "chess-board-table.blend"))
    bpy.ops.render.render(write_still=True)

    assets = ROOT / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    with Image.open(scene.render.filepath) as rendered:
        rendered.save(assets / "board-table.webp", "WEBP", quality=97, method=6)
    write_profile(assets / "board-camera.json")
    art = ROOT / "godot" / "art"
    art.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(assets / "board-table.webp", art / "board-table.webp")
    write_godot_profile(ROOT / "godot" / "projection_profile.gd")
    print(f"Rendered Blender board and walnut table to {assets / 'board-table.webp'}", flush=True)


if not SELECTED or "board-table" in SELECTED:
    build_board_table()
