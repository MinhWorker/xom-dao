"""Bake Bom Nguyên Tố's island arena: the ground diorama and the block sprites.

Run: npm run blender -- bom-nguyen-to [ground] [blocks] [preview]
     (or .tools/blender/bin/python games/bom-nguyen-to/sources/render_arena.py -- ground)

Every image looks at the arena from the south, pitched so a cell on the ground is TILT as tall as
it is wide and a height of h cells rises h * RISE on screen; one cell is CELL_PX pixels wide at the
arena's middle. Cell (x, y) of the 13 x 11 grid sits at world (x, -y, 0): +X right, +Y away from
the camera, +Z up; the sun comes from the upper left. The ground uses a gentle perspective from
GROUND_DISTANCE cells away (the near rows a little wider, as the eye expects); the sprites are
baked flat and the table scales them by their depth (godot/lens.gd).

- `ground`: the island with the paved 11 x 9 yard, its stone wall, plants and cliffs, transparent
  around it (the table draws the sea). arena-ground.json holds the camera for godot/lens.gd.
- `blocks`: the stone pillars, the wooden crates and baskets, the fallen laterite rocks, each as a
  sprite plus its shadow on its own canvas (anchor = the cell's centre on the ground), packed into
  the arena-blocks atlas with arena-blocks.json.
- `preview`: the ground with a few blocks composited, for a quick look.
"""
from pathlib import Path
import json
import math
import random
import sys

import bpy
from mathutils import Vector
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
ART = ROOT / 'godot' / 'art'
OUT = ROOT.parents[1] / '.blender' / 'bom-nguyen-to' / 'arena'
SELECTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
QUICK = 'quick' in SELECTED

WIDTH, HEIGHT = 13, 11
CELL_PX = 128
TILT = 0.8
RISE = math.sqrt(1 - TILT * TILT)
ELEVATION = math.asin(TILT)
# The ground image: 22 cells wide around the arena's middle column, 1920 px tall.
GROUND_SIZE = (2816, 1920)
GROUND_CENTRE = (6.0, 5.9)
# How far the ground's camera stands (cells): close enough that the near wall is about a sixth
# wider than the far one, so the yard reads with depth instead of looking wider at the back.
GROUND_DISTANCE = 36.0
SPRITE_SIZE = (192, 224)
SPRITE_ANCHOR = (96, 150)
SHADOW_SIZE = (256, 224)
SHADOW_ANCHOR = (96, 120)
SUN = Vector((-0.5, 0.42, 1.15)).normalized()

random.seed(7)


def hexcolor(value):
    value = value.lstrip('#')
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


# ── Scene ──────────────────────────────────────────────────────────────────────────────────


def reset(size, samples):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 12 if QUICK else samples
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.cycles.max_bounces = 6
    scene.cycles.transparent_max_bounces = 8
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.dither_intensity = 0
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    scene.view_settings.exposure = 0.35
    world = bpy.data.worlds.new('Sky')
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes['Background']
    background.inputs[0].default_value = (*hexcolor('#bfe6ff'), 1)
    background.inputs[1].default_value = 0.85
    sun_data = bpy.data.lights.new('Sun', 'SUN')
    sun_data.energy = 3.6
    sun_data.angle = math.radians(9)
    sun_data.color = hexcolor('#fff1dc')
    sun = bpy.data.objects.new('Sun', sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = SUN.to_track_quat('Z', 'Y').to_euler()
    return scene


def camera(scene, target, size, anchor=None, distance=None):
    """A camera on `target` (a world point) with that point at pixel `anchor` (default: the
    middle), one cell CELL_PX pixels wide there. Ortho, or a perspective from `distance` cells
    away (the ground: godot/lens.gd repeats its maths)."""
    data = bpy.data.cameras.new('Camera')
    width, height = size
    if distance:
        data.type = 'PERSP'
        data.sensor_fit = 'HORIZONTAL'
        data.sensor_width = 36
        # Focal length in pixels = CELL_PX * distance, so a cell at the target is CELL_PX wide.
        data.lens = CELL_PX * distance * data.sensor_width / width
    else:
        data.type = 'ORTHO'
        data.ortho_scale = max(width, height) / CELL_PX
    data.clip_start, data.clip_end = 0.1, 200
    longest = max(width, height)
    if anchor:
        data.shift_x = (width / 2 - anchor[0]) / longest
        data.shift_y = (anchor[1] - height / 2) / longest
    cam = bpy.data.objects.new('Camera', data)
    scene.collection.objects.link(cam)
    away = Vector((0, -math.cos(ELEVATION), math.sin(ELEVATION)))
    cam.location = Vector(target) + away * (distance or 60)
    cam.rotation_euler = (math.pi / 2 - ELEVATION, 0, 0)
    scene.camera = cam
    return cam


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ── Materials ──────────────────────────────────────────────────────────────────────────────


def principled(name, color, roughness=0.6, specular=0.25, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*hexcolor(color), 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Specular IOR Level'].default_value = specular
    shader.inputs['Coat Weight'].default_value = coat
    return mat


def mottled(name, dark, light, scale=6.0, roughness=0.7, detail=3.0, voronoi=0.0, specular=0.2,
            stretch=(1, 1, 1), bump=0.15):
    """Two colours mixed by noise (stone, wood, sand) with a matching bump."""
    mat = principled(name, light, roughness, specular)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes['Principled BSDF']
    coords = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = stretch
    links.new(coords.outputs['Object'], mapping.inputs['Vector'])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = detail
    noise.inputs['Roughness'].default_value = 0.55
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    fac = noise.outputs['Fac']
    if voronoi:
        cells = nodes.new('ShaderNodeTexVoronoi')
        cells.inputs['Scale'].default_value = voronoi
        links.new(mapping.outputs['Vector'], cells.inputs['Vector'])
        mix = nodes.new('ShaderNodeMath')
        mix.operation = 'MULTIPLY'
        links.new(noise.outputs['Fac'], mix.inputs[0])
        links.new(cells.outputs['Distance'], mix.inputs[1])
        fac = mix.outputs[0]
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[0].color = (*hexcolor(dark), 1)
    ramp.color_ramp.elements[1].color = (*hexcolor(light), 1)
    links.new(fac, ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    if bump:
        relief = nodes.new('ShaderNodeBump')
        relief.inputs['Strength'].default_value = bump
        relief.inputs['Distance'].default_value = 0.02
        links.new(fac, relief.inputs['Height'])
        links.new(relief.outputs['Normal'], shader.inputs['Normal'])
    return mat


def wood(name, dark, light, along='X'):
    stretch = {'X': (1.2, 14, 14), 'Y': (14, 1.2, 14), 'Z': (14, 14, 1.2)}[along]
    return mottled(name, dark, light, scale=3.2, roughness=0.62, detail=4, stretch=stretch,
                   bump=0.25)


def emission(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    glow = nodes.new('ShaderNodeEmission')
    glow.inputs['Color'].default_value = (*hexcolor(color), 1)
    glow.inputs['Strength'].default_value = strength
    out = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(glow.outputs[0], out.inputs[0])
    return mat


# ── Geometry ───────────────────────────────────────────────────────────────────────────────


def box(name, size, at, mat, bevel=0.06, segments=4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width, mod.segments = min(bevel, min(size) * 0.45), segments
        mod.limit_method = 'NONE'
    bpy.ops.object.shade_smooth()
    return obj


def blob(name, at, radii, mat, wobble=0.12, seed=0, subdivisions=3):
    """A soft lumpy ball: an ico sphere with a little noise (bushes, moss, rocks)."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radii
    rng = random.Random(seed)
    phase = [rng.uniform(0, 10) for _ in range(3)]
    for v in obj.data.vertices:
        p = v.co
        n = (math.sin(p.x * 3.1 + phase[0]) + math.sin(p.y * 2.7 + phase[1]) +
             math.sin(p.z * 3.7 + phase[2])) / 3
        v.co = p * (1 + n * wobble)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def cylinder(name, radius, depth, at, mat, vertices=32, bevel=0.0, top_radius=None):
    if top_radius is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                            location=at)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=top_radius,
                                        depth=depth, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width, mod.segments = bevel, 3
        mod.limit_method = 'ANGLE'
    bpy.ops.object.shade_smooth()
    return obj


def rounded_slab(name, half_w, half_h, radius, z0, z1, mat, segments=10, wobble=0.0, seed=0,
                 flare=0.0):
    """A rounded rectangle extruded from z0 to z1 (the island's body), `flare` cells wider at z0."""
    rng = random.Random(seed)
    outline = []
    corners = [(half_w - radius, half_h - radius, 0), (-(half_w - radius), half_h - radius, 1),
               (-(half_w - radius), -(half_h - radius), 2), (half_w - radius, -(half_h - radius), 3)]
    for cx, cy, quarter in corners:
        for i in range(segments + 1):
            a = (quarter + i / segments) * math.pi / 2
            outline.append((cx + math.cos(a) * radius, cy + math.sin(a) * radius))
    rings = 6
    vertices, faces = [], []
    n = len(outline)
    for r in range(rings + 1):
        t = r / rings
        z = z1 + (z0 - z1) * t
        # The cliff spreads toward the water, with a lumpy rock face. A foot wider than the top
        # reads right under the ortho camera; a narrowing one looks like reversed perspective.
        inset = -flare * t ** 0.85
        for x, y in outline:
            length = math.hypot(x, y)
            k = (length - inset + (rng.uniform(-1, 1) * wobble if 0 < r < rings else 0)) / length
            vertices.append((x * k, y * k, z))
    for r in range(rings):
        for i in range(n):
            a, b = r * n + i, r * n + (i + 1) % n
            faces.append((a, b, b + n, a + n))
    faces.append(tuple(range(n)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = link(bpy.data.objects.new(name, mesh))
    obj.data.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def cell(x, y, z=0.0):
    return Vector((x, -y, z))


# ── The yard ───────────────────────────────────────────────────────────────────────────────


def stone_material(name='Stone', light='#9aa6b0', dark='#6c7884'):
    return mottled(name, dark, light, scale=5.0, roughness=0.78, detail=4, voronoi=6, bump=0.3)


def build_yard():
    paver_a = mottled('Paver light', '#d8bf92', '#f0dfba', scale=7, roughness=0.85, voronoi=9,
                      bump=0.25)
    paver_b = mottled('Paver dark', '#c2a476', '#dcc398', scale=7, roughness=0.85, voronoi=9,
                      bump=0.25)
    moss = mottled('Moss', '#4f7f34', '#7fae4f', scale=12, roughness=0.9)
    # The moss bed between the pavers.
    box('Yard bed', (11.2, 9.2, 0.1), cell(6, 5, -0.07), moss, bevel=0.02)
    rng = random.Random(3)
    for y in range(1, HEIGHT - 1):
        for x in range(1, WIDTH - 1):
            mat = paver_a if (x + y) % 2 == 0 else paver_b
            lift = rng.uniform(-0.008, 0.008)
            slab = box(f'Paver {x},{y}', (0.93, 0.93, 0.1), cell(x, y, -0.05 + lift), mat,
                       bevel=0.05)
            slab.rotation_euler.z = rng.uniform(-0.02, 0.02)


def roof_tiles(name, length, at, along_x, mat, count=None):
    """A row of half-round red roof tiles capping a wall (mái ngói)."""
    n = count or max(2, round(length / 0.2))
    for i in range(n):
        offset = -length / 2 + (i + 0.5) * length / n
        pos = at + (Vector((offset, 0, 0)) if along_x else Vector((0, offset, 0)))
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.15, depth=length / n * 1.02,
                                            location=pos)
        tile = bpy.context.object
        tile.name = name
        tile.rotation_euler = (0, math.pi / 2, 0) if along_x else (math.pi / 2, 0, 0)
        tile.scale.z = 1.0
        tile.data.materials.append(mat)
        bpy.ops.object.shade_smooth()


def build_wall():
    """The low brick wall on the outer ring of cells, capped with red roof tiles: taller at the
    back, low at the front so it hides no one, posts with red lanterns at the corners."""
    brick = mottled('Brick', '#8f4630', '#b8664a', scale=6, roughness=0.85, voronoi=14, bump=0.35)
    plaster = mottled('Wall plaster', '#7a3a26', '#9a5038', scale=8, roughness=0.85, bump=0.15)
    tiles = mottled('Roof tile', '#9e3f28', '#cf5e3d', scale=10, roughness=0.55, bump=0.1,
                    specular=0.35)
    rng = random.Random(5)
    heights = {'back': 0.58, 'front': 0.2, 'side': 0.32}
    runs = [('back', 0, True), ('front', HEIGHT - 1, True)]
    for side, y, _ in runs:
        h = heights[side]
        box(f'Wall {side}', (WIDTH - 1.1, 0.86, h), cell(6, y, h / 2 - 0.02), brick, bevel=0.07)
        box(f'Band {side}', (WIDTH - 1.06, 0.9, 0.08), cell(6, y, h - 0.02), plaster, bevel=0.03)
        roof_tiles(f'Tiles {side}', WIDTH - 1.1, cell(6, y, h + 0.04), True, tiles, 44)
    for x in (0, WIDTH - 1):
        h = heights['side']
        box(f'Wall side {x}', (0.86, HEIGHT - 1.1, h), cell(x, 5, h / 2 - 0.02), brick, bevel=0.07)
        box(f'Band side {x}', (0.9, HEIGHT - 1.06, 0.08), cell(x, 5, h - 0.02), plaster,
            bevel=0.03)
        roof_tiles(f'Tiles side {x}', HEIGHT - 1.1, cell(x, 5, h + 0.04), False, tiles, 36)
    lantern_red = principled('Lantern', '#d8402f', roughness=0.45, specular=0.3)
    lantern_glow = emission('Lantern glow', '#ffb35c', 1.6)
    gold = principled('Lantern gold', '#e0ad3c', roughness=0.35, specular=0.5)
    tassel = principled('Tassel', '#e7b53c', 0.6)
    wood_dark = wood('Post wood', '#6e4220', '#9c5f2a', 'Z')
    for x, y in ((0, 0), (WIDTH - 1, 0), (0, HEIGHT - 1), (WIDTH - 1, HEIGHT - 1)):
        back = y == 0
        h = 0.85 if back else 0.42
        box(f'Post {x},{y}', (0.96, 0.96, h), cell(x, y, h / 2 - 0.02), brick, bevel=0.09)
        box(f'Post band {x},{y}', (1.0, 1.0, 0.09), cell(x, y, h - 0.02), plaster, bevel=0.03)
        # A little hip roof on the post, then a pole with a red lantern.
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.72, radius2=0.12, depth=0.24,
                                        location=cell(x, y, h + 0.14))
        hat = bpy.context.object
        hat.rotation_euler.z = math.pi / 4
        hat.data.materials.append(tiles)
        mod = hat.modifiers.new('Bevel', 'BEVEL')
        mod.width, mod.segments = 0.04, 3
        cylinder(f'Pole {x},{y}', 0.045, 0.8, cell(x, y, h + 0.62), wood_dark, 12)
        reach = 0.28 if x == 0 else -0.28
        box(f'Arm {x},{y}', (0.36, 0.05, 0.05), cell(x + reach / 2, y, h + 0.98), wood_dark,
            bevel=0.02)
        hang = cell(x + reach, y, h + 0.66)
        blob(f'Lantern {x},{y}', hang, (0.2, 0.2, 0.25), lantern_red, wobble=0.0, subdivisions=4)
        blob(f'Lantern core {x},{y}', hang + Vector((0, -0.05, 0)), (0.12, 0.12, 0.16),
             lantern_glow, 0, subdivisions=2)
        cylinder(f'Lantern top {x},{y}', 0.1, 0.06, hang + Vector((0, 0, 0.25)), gold, 16)
        cylinder(f'Lantern bottom {x},{y}', 0.09, 0.06, hang - Vector((0, 0, 0.25)), gold, 16)
        cylinder(f'Tassel {x},{y}', 0.03, 0.2, hang - Vector((0, 0, 0.38)), tassel, 8)
    del rng


def boat(at, turn):
    """A round bamboo basket boat (thuyền thúng) on the water, with an oar."""
    weave = mottled('Boat weave', '#7d5a2c', '#b48749', scale=30, roughness=0.8, bump=0.4)
    tar = principled('Boat tar', '#3a2a1e', 0.6)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.6, location=at)
    hull = bpy.context.object
    hull.scale.z = 0.42
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for v in hull.data.vertices:
        v.select = v.co.z > 0.05
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.delete(type='VERT')
    bpy.ops.object.mode_set(mode='OBJECT')
    solid = hull.modifiers.new('Shell', 'SOLIDIFY')
    solid.thickness = 0.04
    hull.data.materials.append(weave)
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_torus_add(major_radius=0.6, minor_radius=0.04,
                                     location=at + Vector((0, 0, 0.05)))
    bpy.context.object.data.materials.append(tar)
    oar = wood('Oar', '#7d4b23', '#b07a45', 'X')
    paddle = box('Oar', (1.1, 0.05, 0.04), at + Vector((0.3, 0.1, 0.15)), oar, bevel=0.015)
    paddle.rotation_euler = (0, -0.25, turn)


def build_island():
    """The island under the yard: a grass rim with a hedge, flowers and a few trees, sandy
    cliffs down to the water line (the table draws the sea), a beach, foam and the shallows."""
    grass = mottled('Grass', '#5a9439', '#7fb553', scale=9, roughness=0.9, bump=0.2)
    cliff = mottled('Cliff', '#b07d4a', '#dcae74', scale=3, roughness=0.9, detail=5, voronoi=3,
                    stretch=(1, 1, 3.5), bump=0.5)
    sand = mottled('Sand', '#e3c48c', '#f3ddb0', scale=14, roughness=0.95, bump=0.1)
    middle = (6, 5.15)
    top = rounded_slab('Island top', 8.3, 6.35, 1.6, -0.12, -0.04, grass, segments=12)
    top.location = cell(*middle)
    body = rounded_slab('Island cliff', 8.25, 6.3, 1.6, -1.9, -0.1, cliff, segments=12,
                        wobble=0.16, seed=4, flare=0.8)
    body.location = cell(*middle)
    shore = rounded_slab('Beach', 9.35, 7.4, 2.3, -1.95, -1.85, sand, segments=12, wobble=0.1,
                         seed=9)
    shore.location = cell(6, 5.25)
    foam = emission('Foam', '#ffffff', 0.85)
    ring = rounded_slab('Foam', 9.6, 7.65, 2.45, -1.97, -1.94, foam, segments=12, wobble=0.12,
                        seed=11)
    ring.location = cell(6, 5.25)
    # Rocks along the foot of the cliff and out in the water.
    rock_mat = mottled('Shore rock', '#6f6a62', '#a39d90', scale=5, roughness=0.85, voronoi=5,
                       bump=0.4)
    rng = random.Random(12)
    for i in range(14):
        a = rng.uniform(0, math.tau)
        x, y = 6 + math.cos(a) * 9.3, 5.25 + math.sin(a) * 7.25
        s = rng.uniform(0.18, 0.4)
        blob(f'Shore rock {i}', cell(x, y, -1.9 + s * 0.3), (s, s * 0.9, s * 0.7), rock_mat, 0.2,
             seed=40 + i)
    boat(cell(-3.3, 12.4, -1.92), 0.6)
    leaf_a = mottled('Leaf', '#3f7f33', '#6aae48', scale=6, roughness=0.75, bump=0.3)
    leaf_b = mottled('Leaf light', '#558f37', '#82bf58', scale=6, roughness=0.75, bump=0.3)
    bark = wood('Bark', '#5b3a22', '#8a5a36', 'Z')
    petals = [principled(f'Petal {c}', c, 0.6) for c in ('#f28aa0', '#fff3d6', '#f7c548',
                                                          '#e0352b')]
    # A trimmed hedge behind the back wall.
    x = -0.3
    while x < WIDTH - 0.7:
        s = rng.uniform(0.3, 0.38)
        blob(f'Hedge {x:.2f}', cell(x, -0.95, s * 0.7), (s * 1.1, s * 0.9, s * 0.95),
             leaf_a if rng.random() < 0.5 else leaf_b, 0.12, seed=int(x * 10) + 200)
        x += 0.5
    # Flower beds and bushes on the side rims, kept low.
    for side_x in (-1.4, WIDTH + 0.4):
        for k in range(7):
            y = 0.4 + k * 1.45 + rng.uniform(-0.2, 0.2)
            s = rng.uniform(0.26, 0.36)
            blob(f'Bush {side_x} {k}', cell(side_x + rng.uniform(-0.3, 0.3), y, s * 0.55),
                 (s, s, s * 0.8), leaf_a if k % 2 else leaf_b, 0.16, seed=k + int(side_x * 10))
            for f in range(rng.randint(2, 4)):
                a = rng.uniform(0, math.tau)
                blob(f'Flower {side_x} {k}.{f}', cell(side_x + math.cos(a) * s * 0.9,
                                                       y + math.sin(a) * s * 0.7, s * 1.02),
                     (0.06, 0.06, 0.045), petals[rng.randrange(len(petals))], 0, subdivisions=2)
    for x in range(1, WIDTH - 1, 2):
        blob(f'Front flower bed {x}', cell(x + 0.5, HEIGHT - 0.15, 0.08), (0.3, 0.14, 0.12),
             leaf_b, 0.15, seed=300 + x)
        for f in range(3):
            blob(f'Front flower {x}.{f}', cell(x + 0.25 + f * 0.25, HEIGHT - 0.18, 0.2),
                 (0.05, 0.05, 0.04), petals[(x + f) % len(petals)], 0, subdivisions=2)
    for i, (x, y, s) in enumerate(((-1.7, -0.6, 0.95), (WIDTH + 0.7, -0.5, 0.9),
                                   (-1.9, 6.2, 0.7), (WIDTH + 0.9, 6.6, 0.75))):
        cylinder(f'Trunk {i}', 0.12 * s, 1.1 * s, cell(x, y, 0.5 * s), bark, 12,
                 top_radius=0.08 * s)
        for k in range(4):
            a = k * math.tau / 4 + i
            blob(f'Crown {i}.{k}', cell(x + math.cos(a) * 0.32 * s, y + math.sin(a) * 0.25 * s,
                                        (1.25 + 0.15 * (k % 2)) * s),
                 (0.55 * s, 0.55 * s, 0.48 * s), leaf_a if k % 2 else leaf_b, 0.14,
                 seed=i * 9 + k)
        blob(f'Crown top {i}', cell(x, y, 1.65 * s), (0.5 * s, 0.5 * s, 0.42 * s), leaf_b, 0.14,
             seed=i * 7)


def render_ground():
    scene = reset(GROUND_SIZE, 40)
    build_island()
    build_yard()
    build_wall()
    camera(scene, cell(*GROUND_CENTRE), GROUND_SIZE, distance=GROUND_DISTANCE)
    path = OUT / 'arena-ground.png'
    OUT.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    # The camera, for godot/lens.gd to put every sprite on the image's cells.
    meta = {'cell': CELL_PX, 'elevation': ELEVATION, 'distance': GROUND_DISTANCE,
            'focal': CELL_PX * GROUND_DISTANCE, 'centre': GROUND_CENTRE, 'size': GROUND_SIZE}
    for folder in (ASSETS, ART):
        folder.mkdir(parents=True, exist_ok=True)
        with Image.open(path) as image:
            image.save(folder / 'arena-ground.webp', quality=88, method=6)
        (folder / 'arena-ground.json').write_text(json.dumps(meta, indent=2) + '\n')


# ── Blocks ─────────────────────────────────────────────────────────────────────────────────


def pillar(variant):
    stone = stone_material(f'Pillar stone {variant}', '#a2abb3', '#6f7a84')
    moss = mottled('Pillar moss', '#3f7330', '#679d45', scale=10, roughness=0.9, bump=0.3)
    h = 0.78 if variant == 0 else 0.72
    base = box('Pillar', (0.9, 0.9, h), (0, 0, h / 2), stone, bevel=0.14, segments=5)
    base.rotation_euler.z = 0.0 if variant == 0 else 0.03
    box('Pillar band', (0.94, 0.94, 0.1), (0, 0, 0.1), stone_material('Band', '#8d99a5', '#606c78'),
        bevel=0.04)
    if variant == 0:
        blob('Moss', (0.2, 0.16, h - 0.005), (0.2, 0.17, 0.04), moss, 0.25, seed=2)
        blob('Moss drip', (-0.3, -0.43, h - 0.16), (0.12, 0.05, 0.1), moss, 0.25, seed=3)
    else:
        blob('Moss', (-0.2, 0.14, h - 0.005), (0.17, 0.15, 0.04), moss, 0.25, seed=5)
        blob('Pebble', (0.22, -0.12, h + 0.04), (0.09, 0.08, 0.05),
             stone_material('Pebble', '#b4bec6', '#8a96a1'), 0.2, seed=6)


def crate():
    plank = wood('Crate plank', '#b9793a', '#e2a65c', 'X')
    frame = wood('Crate frame', '#7d4b23', '#a8692f', 'Z')
    size, h = 0.8, 0.7
    box('Crate core', (size - 0.04, size - 0.04, h - 0.04), (0, 0, h / 2), plank, bevel=0.03)
    t = 0.09
    for sx in (-1, 1):
        for sy in (-1, 1):
            box('Edge', (t, t, h), (sx * (size - t) / 2, sy * (size - t) / 2, h / 2), frame,
                bevel=0.025)
    for z in (t / 2, h - t / 2):
        for sy in (-1, 1):
            box('Rail', (size, t, t), (0, sy * (size - t) / 2, z), frame, bevel=0.025)
        for sx in (-1, 1):
            box('Rail', (t, size, t), (sx * (size - t) / 2, 0, z), frame, bevel=0.025)
    # Plank seams on the front and the top, and a diagonal brace on the front.
    seam = principled('Seam', '#6e4220', 0.9)
    for k in (-1, 1):
        box('Seam', (size - 0.1, 0.012, 0.012), (0, -size / 2 + 0.005, h / 2 + k * h / 6), seam, 0)
        box('Seam top', (size - 0.1, 0.012, 0.012), (0, k * size / 6, h + 0.005), seam, 0)
    brace = box('Brace', (size * 1.05, 0.05, t * 0.9), (0, -size / 2 + 0.01, h / 2), frame,
                bevel=0.02)
    brace.rotation_euler.y = math.atan2(h - t, size - t)
    nail = principled('Nail', '#4a4038', 0.4, 0.5)
    for sx in (-1, 1):
        for z in (t / 2, h - t / 2):
            blob('Nail', (sx * (size - t) / 2, -size / 2 - 0.002, z), (0.018, 0.012, 0.018), nail,
                 0, subdivisions=2)


def basket():
    """A woven bamboo basket (thúng) with a lid and a rope tie."""
    weave = bpy.data.materials.new('Weave')
    weave.use_nodes = True
    nodes, links = weave.node_tree.nodes, weave.node_tree.links
    shader = nodes['Principled BSDF']
    shader.inputs['Roughness'].default_value = 0.7
    coords = nodes.new('ShaderNodeTexCoord')
    checker = nodes.new('ShaderNodeTexChecker')
    checker.inputs['Scale'].default_value = 26
    checker.inputs['Color1'].default_value = (*hexcolor('#d9a75c'), 1)
    checker.inputs['Color2'].default_value = (*hexcolor('#b7823f'), 1)
    links.new(coords.outputs['Object'], checker.inputs['Vector'])
    links.new(checker.outputs['Color'], shader.inputs['Base Color'])
    relief = nodes.new('ShaderNodeBump')
    relief.inputs['Strength'].default_value = 0.4
    links.new(checker.outputs['Fac'], relief.inputs['Height'])
    links.new(relief.outputs['Normal'], shader.inputs['Normal'])
    rim = wood('Basket rim', '#8f5c2a', '#c48a45', 'X')
    cylinder('Basket', 0.36, 0.6, (0, 0, 0.3), weave, 40, top_radius=0.42, bevel=0.04)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.045, location=(0, 0, 0.6))
    torus = bpy.context.object
    torus.data.materials.append(rim)
    bpy.ops.object.shade_smooth()
    lid = blob('Lid', (0, 0, 0.62), (0.43, 0.43, 0.1), weave, 0.0, subdivisions=4)
    lid.name = 'Lid'
    blob('Knob', (0, 0, 0.73), (0.07, 0.07, 0.05), rim, 0, subdivisions=3)
    rope = principled('Basket rope', '#e6d2aa', 0.85)
    for a in (0.35, 0.35 + math.pi / 2):
        band = box('Rope', (0.9, 0.04, 0.03), (0, 0, 0.7), rope, bevel=0.012)
        band.rotation_euler.z = a


def rock(variant):
    """A fallen laterite boulder (đá ong): the arena's closing ring. A rounded block pitted
    with holes, fit to its cell like the pillars."""
    laterite = mottled(f'Laterite {variant}', '#7f3520', '#c4643c', scale=4, roughness=0.92,
                       detail=5, voronoi=13, bump=0.9)
    h = 0.7 if variant == 0 else 0.64
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, h / 2))
    body = bpy.context.object
    body.scale = (0.86, 0.84, h)
    bpy.ops.object.transform_apply(scale=True)
    bevel = body.modifiers.new('Bevel', 'BEVEL')
    bevel.width, bevel.segments = 0.16, 4
    sub = body.modifiers.new('Round', 'SUBSURF')
    sub.levels = sub.render_levels = 2
    texture = bpy.data.textures.new(f'Lumps {variant}', 'CLOUDS')
    texture.noise_scale = 0.35
    shake = body.modifiers.new('Lumps', 'DISPLACE')
    shake.texture = texture
    shake.strength = 0.08
    shake.mid_level = 0.5
    body.rotation_euler.z = 0.08 if variant else -0.05
    body.data.materials.append(laterite)
    bpy.ops.object.shade_smooth()
    blob('Chip', (0.36, -0.34, 0.06), (0.09, 0.07, 0.06), laterite, 0.2, seed=30 + variant)


BLOCKS = {
    'pillar-0': lambda: pillar(0),
    'pillar-1': lambda: pillar(1),
    'crate-0': crate,
    'crate-1': basket,
    'rock-0': lambda: rock(0),
    'rock-1': lambda: rock(1),
}


def catcher():
    """A ground plane that only shows the shadows falling on it."""
    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, 0))
    plane = bpy.context.object
    plane.name = 'Shadow catcher'
    plane.is_shadow_catcher = True
    plane.data.materials.append(principled('Catcher', '#ffffff'))
    return plane


def render_block(name):
    """`name`.png (the block, lit as on the ground) and `name`-shadow.png (its shadow alone)."""
    scene = reset(SPRITE_SIZE, 128)
    BLOCKS[name]()
    camera(scene, (0, 0, 0), SPRITE_SIZE, SPRITE_ANCHOR)
    # The block's lighting includes the ground's bounce light, without showing the ground.
    ground = catcher()
    ground.visible_camera = False
    scene.render.filepath = str(OUT / f'{name}.png')
    bpy.ops.render.render(write_still=True)
    # Shadow pass: the block hidden from the camera, the catcher shows its shadow.
    for obj in scene.objects:
        if obj.type == 'MESH' and obj is not ground:
            obj.visible_camera = False
    ground.visible_camera = True
    scene.render.resolution_x, scene.render.resolution_y = SHADOW_SIZE
    camera(scene, (0, 0, 0), SHADOW_SIZE, SHADOW_ANCHOR)
    scene.render.filepath = str(OUT / f'{name}-shadow.png')
    bpy.ops.render.render(write_still=True)


def pack_blocks():
    names = [n for n in BLOCKS]
    frames = {}
    pad = 4
    columns = len(names)
    sprite_row = SPRITE_SIZE[1] + pad * 2
    sheet = Image.new('RGBA', (columns * (max(SPRITE_SIZE[0], SHADOW_SIZE[0]) + pad * 2),
                               sprite_row + SHADOW_SIZE[1] + pad * 2))
    cell_w = max(SPRITE_SIZE[0], SHADOW_SIZE[0]) + pad * 2
    for i, name in enumerate(names):
        for row, (suffix, size, anchor) in enumerate(((name, SPRITE_SIZE, SPRITE_ANCHOR),
                                                      (f'{name}-shadow', SHADOW_SIZE,
                                                       SHADOW_ANCHOR))):
            with Image.open(OUT / f'{suffix}.png') as image:
                image = image.convert('RGBA')
                if row == 1:
                    # Keep only the shadow's darkness: a soft brown-grey multiply in the table.
                    alpha = image.getchannel('A')
                    image = Image.new('RGBA', image.size, (40, 30, 24, 0))
                    image.putalpha(alpha.point(lambda a: int(a * 0.85)))
                x, y = i * cell_w + pad, row * sprite_row + pad
                sheet.paste(image, (x, y))
                frames[suffix] = {'frame': {'x': x, 'y': y, 'w': size[0], 'h': size[1]},
                                  'spriteSourceSize': {'x': 0, 'y': 0, 'w': size[0],
                                                       'h': size[1]},
                                  'sourceSize': {'w': size[0], 'h': size[1]},
                                  'anchor': list(anchor)}
    for folder in (ASSETS, ART):
        sheet.save(folder / 'arena-blocks.webp', quality=92, method=6)
        (folder / 'arena-blocks.json').write_text(
            json.dumps({'cell': CELL_PX, 'frames': frames}, indent=2) + '\n')


def ground_pixel(x, y, height=0.0):
    """Where cell (x, y) at `height` lands in the ground image, and how much bigger than at the
    middle things are there (the maths of godot/lens.gd)."""
    away = Vector((0, -math.cos(ELEVATION), math.sin(ELEVATION)))
    forward = -away
    up = Vector((0, math.sin(ELEVATION), math.cos(ELEVATION)))
    rel = Vector((x - GROUND_CENTRE[0], -(y - GROUND_CENTRE[1]), height)) - away * GROUND_DISTANCE
    depth = rel.dot(forward)
    focal = CELL_PX * GROUND_DISTANCE
    w, h = GROUND_SIZE
    return (w / 2 + rel.x * focal / depth, h / 2 - rel.dot(up) * focal / depth), \
        GROUND_DISTANCE / depth


def preview():
    """The ground with a pillar on every even cell and a few crates and rocks, as the table
    stacks them, to judge the look without Godot."""
    with Image.open(OUT / 'arena-ground.png') as ground:
        canvas = Image.new('RGBA', ground.size, (62, 193, 201, 255))
        canvas.alpha_composite(ground.convert('RGBA'))
    rng = random.Random(1)
    blocks = []
    for y in range(1, HEIGHT - 1):
        for x in range(1, WIDTH - 1):
            if x % 2 == 0 and y % 2 == 0:
                blocks.append((x, y, f'pillar-{(x * 3 + y) % 2}'))
            elif rng.random() < 0.5 and (x + y) > 3:
                blocks.append((x, y, 'rock-0' if y == 1 else f'crate-{rng.randrange(2)}'))
    for suffix, anchor in (('-shadow', SHADOW_ANCHOR), ('', SPRITE_ANCHOR)):
        for x, y, name in sorted(blocks, key=lambda b: b[1]):
            with Image.open(OUT / f'{name}{suffix}.png') as sprite:
                sprite = sprite.convert('RGBA')
                if suffix:
                    alpha = sprite.getchannel('A').point(lambda a: int(a * 0.85))
                    sprite = Image.new('RGBA', sprite.size, (40, 30, 24, 0))
                    sprite.putalpha(alpha)
                (px, py), zoom = ground_pixel(x, y)
                size = (round(sprite.width * zoom), round(sprite.height * zoom))
                sprite = sprite.resize(size, Image.LANCZOS)
                canvas.alpha_composite(sprite, (int(px - anchor[0] * zoom),
                                                int(py - anchor[1] * zoom)))
    canvas.convert('RGB').save(OUT / 'preview.png')


if __name__ == '__main__':
    everything = not [n for n in SELECTED if n != 'quick']
    if everything or 'ground' in SELECTED:
        render_ground()
    if everything or 'blocks' in SELECTED:
        for block in BLOCKS:
            if everything or 'blocks' in SELECTED or block in SELECTED:
                render_block(block)
        pack_blocks()
    if everything or 'preview' in SELECTED:
        preview()
