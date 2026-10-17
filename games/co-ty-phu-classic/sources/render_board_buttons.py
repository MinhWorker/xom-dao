"""Render tactile surface action buttons for Cờ tỷ phú Classic using Blender Cycles.

Matches the exact board camera, lighting, and materials (satin brass bezel + enamel inlays).
Produces:
  - assets/board-button-primary.webp (Right slot: Confirm / Go, Emerald green enamel)
  - assets/board-button-secondary.webp (Left slot: Back / Cancel, Slate mahogany enamel)
  - assets/board-button-danger.webp (Left slot: Danger / Bankrupt, Ruby red enamel)
  - assets/board-button-social.webp (Social / Bail / Amber enamel)
"""
from pathlib import Path
import bpy
from PIL import Image
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

GAME_DIR = Path("/home/minhnk/Projects/Games/xom-dao/games/co-ty-phu-classic")
ASSETS = GAME_DIR / "assets"
ART = GAME_DIR / "godot" / "art"
PREVIEWS = Path("/home/minhnk/Projects/Games/xom-dao/.blender/board-buttons")
PREVIEWS.mkdir(parents=True, exist_ok=True)
print(f"DEBUG: ASSETS={ASSETS} exists={ASSETS.exists()}")
print(f"DEBUG: ART={ART} exists={ART.exists()}")
print(f"DEBUG: PREVIEWS={PREVIEWS} exists={PREVIEWS.exists()}")

WIDTH, HEIGHT = 1400, 1200
CROP_X, CROP_Y, CROP_WIDTH, CROP_HEIGHT = 35, 145, 1330, 1045

def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

def material(name, rgb, metallic=0.0, roughness=0.5, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get("Principled BSDF")
    lin = tuple(linear(c) for c in rgb)
    mat.diffuse_color = (*lin, 1)
    p.inputs["Base Color"].default_value = (*lin, 1)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = coat
    return mat

def slab(name, bounds, top, thickness, bevel, mat):
    u0, v0, u1, v1 = bounds
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=((u0 + u1 - 1) * 2, (1 - v0 - v1) * 2, top - thickness / 2)
    )
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = ((u1 - u0) * 4, (v1 - v0) * 4, thickness)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    edge = obj.modifiers.new("Bevel", "BEVEL")
    edge.width, edge.segments = bevel, 4
    obj.modifiers.new("WeightedNormals", "WEIGHTED_NORMAL")
    obj.data.materials.append(mat)
    return obj

def setup_scene(center_u, center_v):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    # Local ground plane as shadow catcher under button
    center_3d = ((center_u - 0.5) * 4, (0.5 - center_v) * 4, 0.024)
    bpy.ops.mesh.primitive_plane_add(size=1.8, location=center_3d)
    ground = bpy.context.object
    ground.name = "ShadowCatcher"
    ground.is_shadow_catcher = True

    # Camera exactly matching board
    bpy.ops.object.camera_add(location=(0, -5.7, 8.7))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, -.02)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type, camera.data.lens = "PERSP", 75
    scene = bpy.context.scene
    scene.camera = camera

    # Lights matching board
    for name, location, energy, size in [
        ("Soft upper-left key", (-3.5, -4, 7), 1050, 5),
        ("Broad fill", (4, 2, 5), 500, 5),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy, light.data.size = energy, size

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = WIDTH, HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.world.color = (.35, .35, .35)
    return scene, camera

def render_button(kind_name, center_u, center_v, enamel_rgb, is_right, pressed=False):
    scene, camera = setup_scene(center_u, center_v)

    gold_mat = material("Satin brass bezel", (.77, .59, .32), metallic=0.60, roughness=0.32)
    enamel_mat = material(f"{kind_name} enamel", enamel_rgb, metallic=0.02, roughness=0.20, coat=0.35)

    # UV dimensions for button
    bw, bh = 0.230, 0.076
    u0 = center_u - bw / 2
    u1 = center_u + bw / 2
    v0 = center_v - bh / 2
    v1 = center_v + bh / 2

    z_offset = -0.003 if pressed else 0.0

    # Brass bezel casing
    bezel = slab(
        "ButtonBezel",
        (u0 - 0.003, v0 - 0.003, u1 + 0.003, v1 + 0.003),
        top=0.038 + z_offset,
        thickness=0.014,
        bevel=0.004,
        mat=gold_mat
    )

    # Enamel push plate
    plate = slab(
        "ButtonPlate",
        (u0, v0, u1, v1),
        top=0.040 + z_offset,
        thickness=0.008,
        bevel=0.002,
        mat=enamel_mat
    )

    # Gold filigree inner border
    slab(
        "ButtonInlay",
        (u0 + bw * 0.035, v0 + bh * 0.07, u1 - bw * 0.035, v1 - bh * 0.07),
        top=0.0408 + z_offset,
        thickness=0.002,
        bevel=0.0008,
        mat=gold_mat
    )

    # Inner recessed enamel face
    slab(
        "ButtonInnerEnamel",
        (u0 + bw * 0.05, v0 + bh * 0.10, u1 - bw * 0.05, v1 - bh * 0.10),
        top=0.0410 + z_offset,
        thickness=0.002,
        bevel=0.001,
        mat=enamel_mat
    )

    # Project corners to camera coordinates and set tight render border
    pts = [
        world_to_camera_view(scene, camera, Vector(((u - 0.5) * 4, (0.5 - v) * 4, z)))
        for u in (u0 - 0.025, u1 + 0.025)
        for v in (v0 - 0.020, v1 + 0.030)
        for z in (0.024, 0.048)
    ]
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x = max(0.0, min(p.x for p in pts))
    scene.render.border_max_x = min(1.0, max(p.x for p in pts))
    scene.render.border_min_y = max(0.0, min(p.y for p in pts))
    scene.render.border_max_y = min(1.0, max(p.y for p in pts))

    png_path = PREVIEWS / f"button-{kind_name}{'-pressed' if pressed else ''}.png"
    scene.render.filepath = str(png_path)
    bpy.ops.render.render(write_still=True)

    img = Image.open(png_path)
    webp_name = f"board-button-{kind_name}{'-pressed' if pressed else ''}.webp"
    webp_path = ASSETS / webp_name
    art_path = ART / webp_name
    img.save(webp_path, "WEBP", quality=95)
    img.save(art_path, "WEBP", quality=95)
    print(f"Rendered {webp_name} ({img.size[0]}x{img.size[1]}): {webp_path} exists={webp_path.exists()}, {art_path} exists={art_path.exists()}")

# Primary (Right slot: u=0.63, v=0.745) - Emerald green lacquer
render_button("primary", 0.63, 0.745, (0.04, 0.35, 0.16), is_right=True)
render_button("primary", 0.63, 0.745, (0.03, 0.28, 0.12), is_right=True, pressed=True)

# Secondary (Left slot: u=0.37, v=0.745) - Slate / dark mahogany lacquer
render_button("secondary", 0.37, 0.745, (0.16, 0.20, 0.24), is_right=False)
render_button("secondary", 0.37, 0.745, (0.12, 0.15, 0.18), is_right=False, pressed=True)

# Danger (Left slot: u=0.37, v=0.745) - Ruby red lacquer
render_button("danger", 0.37, 0.745, (0.45, 0.06, 0.08), is_right=False)
render_button("danger", 0.37, 0.745, (0.35, 0.04, 0.06), is_right=False, pressed=True)

# Social (Amber lacquer)
render_button("social", 0.63, 0.745, (0.55, 0.38, 0.10), is_right=True)
render_button("social", 0.63, 0.745, (0.44, 0.30, 0.08), is_right=True, pressed=True)

print("All buttons rendered successfully!")
