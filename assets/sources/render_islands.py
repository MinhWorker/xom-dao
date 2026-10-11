"""The lobby's floating genre islands (docs/experience.md, "Sảnh: vòng đảo thể loại").

Every island is a toy diorama on a floating rock: a grass cap, a cliff, a waterfall and the props
that name its genre. Each is baked as FRAMES frames of one idle loop (waterfall, banner, trees,
lanterns, the bomb's spark) and packed into apps/client/hub/genres/<island>-loop.webp, a
COLUMNS-wide grid of SIZE x SIZE cells, next to <island>.tscn: the island slot HubIsland loads, a
Node2D whose AnimatedSprite2D plays the loop on its own. The client tints the islands that are not
selected and draws the fog and lock of a locked one, so every island is baked in full colour.

    npm run blender -- app [co bai su-kien hanh-dong sap-co]
"""
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.blender' / 'islands'
ASSETS = ROOT / 'apps' / 'client' / 'hub' / 'genres'
FONT = ROOT / 'apps' / 'client' / 'addons' / 'xomdao_sdk' / 'ui' / 'fonts' / 'Baloo2.ttf'

SIZE = 512
FRAMES = 8
FPS = 7
COLUMNS = 4
SAMPLES = 48


def rgb(hex_code):
    """docs/art-direction.md colours are sRGB; Blender wants linear."""
    def channel(c):
        c = int(c, 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    hex_code = hex_code.lstrip('#')
    return tuple(channel(hex_code[i:i + 2]) for i in (0, 2, 4))


PALETTE = {
    'grass': '#6DB34A', 'grass-dark': '#3F7F33', 'grass-light': '#8CCB5E',
    'dirt': '#9C5F2A', 'stone': '#A39282', 'stone-dark': '#7C6B5E', 'sand': '#F3DDB0',
    'sand-dark': '#D9B97E', 'paper': '#FBF1DC', 'wood': '#D9963F', 'wood-dark': '#9C5F2A',
    'tile': '#D3603F', 'tile-dark': '#9E3F28', 'lacquer': '#B8262A', 'lantern': '#E0352B',
    'gold': '#E7B53C', 'ink': '#2B2B30', 'cream': '#FFF6E3', 'blossom': '#F4A6C0',
    'blossom-dark': '#E07CA0', 'sea-deep': '#1E8FA6', 'trunk': '#7A4A26', 'water': '#8FD3F4',
}
MATS = {}


# --- Scene -----------------------------------------------------------------------------------

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.cycles.device = 'CPU'
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.dither_intensity = 0
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    world = bpy.data.worlds.new('Sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (*rgb('#CFE9F7'), 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.85
    scene.world = world
    # Ortho camera from the front, a little to the right and above, like the mockup.
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 5.8
    cam = bpy.data.objects.new('Camera', cam_data)
    scene.collection.objects.link(cam)
    azimuth, elevation = math.radians(-18), math.radians(32)
    direction = Vector((math.sin(azimuth) * -1, -math.cos(azimuth), 0)) * math.cos(elevation)
    direction.z = math.sin(elevation)
    target = Vector((0, 0, -0.75))
    cam.location = target + direction * 20
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    # Sun from the upper left of the screen: short soft shadows down to the right.
    sun_data = bpy.data.lights.new('Sun', 'SUN')
    sun_data.energy = 3.2
    sun_data.angle = math.radians(12)
    sun = bpy.data.objects.new('Sun', sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (Vector((0, 0, 0)) - Vector((-5, -3, 8))).to_track_quat('-Z', 'Y').to_euler()


def mat(key, roughness=0.6, emission=0.0):
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    shader = m.node_tree.nodes['Principled BSDF']
    color = rgb(PALETTE.get(key, key))
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Specular IOR Level'].default_value = 0.2
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    MATS[key] = m
    return m


def link(obj, material, smooth=True, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if material is not None:
        obj.data.materials.append(material)
    if smooth and obj.type == 'MESH':
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    if parent is not None:
        obj.parent = parent
    return obj


def mesh(name, verts, faces, material, smooth=True, parent=None, location=(0, 0, 0)):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    return link(obj, material, smooth, parent)


def pivot(name, location, parent=None):
    empty = bpy.data.objects.new(name, None)
    empty.location = location
    bpy.context.scene.collection.objects.link(empty)
    if parent is not None:
        empty.parent = parent
    return empty


def box(name, size, location, material, bevel=0.03, rotation=(0, 0, 0), parent=None):
    sx, sy, sz = (s / 2 for s in size)
    verts = [(x * sx, y * sy, z * sz) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    obj = mesh(name, verts, faces, material, False, parent, location)
    obj.rotation_euler = rotation
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width, mod.segments = bevel, 3
        obj.modifiers.new('Normals', 'WEIGHTED_NORMAL')
    return obj


def ball(name, location, radius, material, squash=(1, 1, 1), parent=None, segments=24):
    verts, faces = [], []
    rings = segments // 2
    for j in range(1, rings):
        phi = math.pi * j / rings
        for i in range(segments):
            theta = math.tau * i / segments
            verts.append((math.sin(phi) * math.cos(theta) * radius * squash[0],
                          math.sin(phi) * math.sin(theta) * radius * squash[1],
                          math.cos(phi) * radius * squash[2]))
    top, bottom = len(verts), len(verts) + 1
    verts += [(0, 0, radius * squash[2]), (0, 0, -radius * squash[2])]
    for j in range(rings - 2):
        for i in range(segments):
            a, b = j * segments + i, j * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    last = (rings - 2) * segments
    for i in range(segments):
        faces.append((top, (i + 1) % segments, i))
        faces.append((bottom, last + i, last + (i + 1) % segments))
    return mesh(name, verts, faces, material, True, parent, location)


def lathe(name, profile, material, segments=32, location=(0, 0, 0), wobble=None, jitter=0.0,
          smooth=True, parent=None, seed=0):
    """Rings of (z, radius) from the top down, closed at both ends. `wobble(theta)` scales the
    radius around the ring (an uneven coast); `jitter` roughens every vertex (rock)."""
    rand = random.Random(seed)
    verts, faces = [], []
    for z, r in profile:
        for i in range(segments):
            theta = math.tau * i / segments
            k = wobble(theta) if wobble else 1.0
            j = 1 + rand.uniform(-jitter, jitter) if r > 0 else 1
            verts.append((math.cos(theta) * r * k * j, math.sin(theta) * r * k * j,
                          z + rand.uniform(-jitter, jitter) * 0.6))
    for ring in range(len(profile) - 1):
        for i in range(segments):
            a, b = ring * segments + i, ring * segments + (i + 1) % segments
            faces.append((a, a + segments, b + segments, b))
    faces.append(tuple(range(segments)))
    faces.append(tuple(reversed(range((len(profile) - 1) * segments, len(verts)))))
    return mesh(name, verts, faces, material, smooth, parent, location)


def cylinder(name, location, radius, height, material, segments=16, parent=None, taper=1.0):
    return lathe(name, [(height, radius * taper), (0, radius)], material, segments, location,
                 parent=parent)


# --- The floating rock -------------------------------------------------------------------------

def coast(seed):
    rand = random.Random(seed)
    phases = [rand.uniform(0, math.tau) for _ in range(3)]
    return lambda t: 1 + 0.05 * math.sin(3 * t + phases[0]) + 0.035 * math.sin(5 * t + phases[1]) \
        + 0.02 * math.sin(7 * t + phases[2])


def rock(seed, radius=2.15, grass='grass', cliff='stone'):
    wobble = coast(seed)
    lathe('Grass', [(0.0, 0), (0.0, radius * 0.96), (-0.06, radius), (-0.22, radius * 1.01),
                    (-0.3, radius * 0.97)], mat(grass), 48, wobble=wobble)
    lathe('Soil', [(-0.24, radius * 0.97), (-0.5, radius * 0.95), (-0.62, radius * 0.9)],
          mat('dirt', 0.9), 48, wobble=wobble)
    lathe('Cliff', [(-0.55, radius * 0.92), (-1.05, radius * 0.82), (-1.7, radius * 0.6),
                    (-2.35, radius * 0.36), (-2.85, radius * 0.16), (-3.05, 0)],
          mat(cliff, 0.85), 13, wobble=wobble, jitter=0.07, smooth=False, seed=seed)
    # A darker band of stones and grass tufts hanging over the rim.
    lathe('Ledge', [(-1.0, radius * 0.84), (-1.25, radius * 0.8), (-1.4, radius * 0.7)],
          mat(cliff + '-dark' if cliff == 'stone' else cliff, 0.9), 13, wobble=wobble,
          jitter=0.06, smooth=False, seed=seed + 1)
    rand = random.Random(seed)
    for i in range(9):
        theta = math.tau * i / 9 + rand.uniform(-0.2, 0.2)
        r = radius * wobble(theta) * 0.99
        ball(f'Tuft {i}', (math.cos(theta) * r, math.sin(theta) * r, -0.24),
             rand.uniform(0.13, 0.2), mat(grass), squash=(1, 1, 1.5), segments=12)


def waterfall(theta, radius=2.15, top=-0.05, length=2.7):
    """A stream across the grass to the rim, then a falling ribbon. Returns its move: the
    stripes ride the ribbon's UVs, which slide down one stripe per loop (Cycles re-syncs edited
    mesh data, not a changed node value)."""
    period = math.tau / 7.0
    m = bpy.data.materials.new('Waterfall')
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    nodes.clear()
    coords = nodes.new('ShaderNodeTexCoord')
    split = nodes.new('ShaderNodeSeparateXYZ')
    links.new(coords.outputs['UV'], split.inputs[0])
    world = nodes.new('ShaderNodeNewGeometry')
    height = nodes.new('ShaderNodeSeparateXYZ')
    links.new(world.outputs['Position'], height.inputs[0])
    wave = nodes.new('ShaderNodeMath')
    wave.operation = 'MULTIPLY'
    wave.inputs[1].default_value = 7.0
    links.new(split.outputs['Y'], wave.inputs[0])
    sine = nodes.new('ShaderNodeMath')
    sine.operation = 'SINE'
    links.new(wave.outputs[0], sine.inputs[0])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (*rgb('#8FD3F4'), 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (*rgb('#FFFFFF'), 1)
    to_unit = nodes.new('ShaderNodeMapRange')
    to_unit.inputs['From Min'].default_value = -1
    links.new(sine.outputs[0], to_unit.inputs['Value'])
    links.new(to_unit.outputs[0], ramp.inputs['Fac'])
    emit = nodes.new('ShaderNodeEmission')
    emit.inputs['Strength'].default_value = 1.0
    links.new(ramp.outputs['Color'], emit.inputs['Color'])
    fade = nodes.new('ShaderNodeMapRange')
    fade.inputs['From Min'].default_value = top - length
    fade.inputs['From Max'].default_value = top - length + 1.2
    links.new(height.outputs['Z'], fade.inputs['Value'])
    clear = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    links.new(fade.outputs[0], mix.inputs['Fac'])
    links.new(clear.outputs[0], mix.inputs[1])
    links.new(emit.outputs[0], mix.inputs[2])
    out = nodes.new('ShaderNodeOutputMaterial')
    links.new(mix.outputs[0], out.inputs['Surface'])

    out_dir = Vector((math.cos(theta), math.sin(theta), 0))
    side = Vector((-out_dir.y, out_dir.x, 0))
    width = 0.4
    verts, faces = [], []
    # Along the grass from 60% of the radius to the rim, then down, bowing outward.
    steps = []
    for i in range(5):
        r = radius * (0.62 + 0.38 * i / 4)
        steps.append(out_dir * r + Vector((0, 0, 0.015)))
    for i in range(1, 15):
        t = i / 14
        steps.append(out_dir * (radius + 0.12 + 0.35 * math.sin(t * 1.6)) +
                     Vector((0, 0, top - length * t)))
    for p in steps:
        verts += [tuple(p - side * width / 2), tuple(p + side * width / 2)]
    for i in range(len(steps) - 1):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    ribbon = mesh('Waterfall', verts, faces, m, True)
    uv = ribbon.data.uv_layers.new()
    # Spray where it leaves the rim.
    rim = out_dir * (radius + 0.08)
    for i, (dx, dz, r) in enumerate(((-0.18, -0.25, 0.12), (0.17, -0.3, 0.1), (0, -0.4, 0.13))):
        ball(f'Spray {i}', tuple(rim + side * dx + Vector((0, 0, dz))), r, mat('cream', 0.5, 0.4),
             segments=12)

    def move(t):
        for poly in ribbon.data.polygons:
            for li in poly.loop_indices:
                z = verts[ribbon.data.loops[li].vertex_index][2]
                # The stream on the grass scrolls toward the rim like the fall below it.
                along = z if z < 0 else -(radius - Vector(verts[ribbon.data.loops[li]
                                                                .vertex_index][:2]).length)
                uv.data[li].uv = (0, along + period * t)
        ribbon.data.update()
    return move


# --- Props --------------------------------------------------------------------------------------

def at(r, theta, z=0.0):
    return (math.cos(math.radians(theta)) * r, math.sin(math.radians(theta)) * r, z)


def tree(name, location, blossom=False, height=0.9, scale=1.0, seed=0):
    root = pivot(name, location)
    rand = random.Random(seed)
    cylinder(name + ' trunk', (0, 0, 0), 0.09 * scale, height * scale, mat('trunk', 0.9), 10,
             root, 0.6)
    leaf, dark = ('blossom', 'blossom-dark') if blossom else ('grass-light', 'grass')
    for i in range(5):
        a = math.tau * i / 5 + rand.uniform(-0.3, 0.3)
        r = 0.28 * scale
        ball(f'{name} leaf {i}',
             (math.cos(a) * r, math.sin(a) * r, height * scale + rand.uniform(-0.05, 0.15)),
             rand.uniform(0.28, 0.36) * scale, mat(leaf if i % 2 else dark, 0.8), parent=root,
             segments=16)
    ball(name + ' crown', (0, 0, (height + 0.25) * scale), 0.36 * scale, mat(leaf, 0.8),
         parent=root, segments=16)
    return root


def palm(name, location, height=1.3, lean=12, seed=0):
    root = pivot(name, location)
    root.rotation_euler = (0, math.radians(lean), 0)
    for i in range(6):
        cylinder(f'{name} trunk {i}', (0, 0, i * height / 6), 0.085 - i * 0.008, height / 6 + 0.02,
                 mat('trunk' if i % 2 else 'wood-dark', 0.9), 10, root)
    crown = pivot(name + ' crown', (0, 0, height), root)
    for i in range(7):
        a = math.tau * i / 7
        leaf = ball(f'{name} frond {i}', (math.cos(a) * 0.36, math.sin(a) * 0.36, -0.06), 0.42,
                    mat('grass' if i % 2 else 'grass-dark', 0.8), squash=(1, 0.32, 0.12),
                    parent=crown, segments=12)
        leaf.rotation_euler = (0, math.radians(18), a)
    return crown


def bamboo(name, location, count=6, seed=0):
    root = pivot(name, location)
    rand = random.Random(seed)
    stalks = []
    for i in range(count):
        a = math.tau * i / count + rand.uniform(-0.4, 0.4)
        r = rand.uniform(0.05, 0.25)
        h = rand.uniform(1.3, 1.9)
        stalk = pivot(f'{name} {i}', (math.cos(a) * r, math.sin(a) * r, 0), root)
        cylinder(f'{name} stalk {i}', (0, 0, 0), 0.055, h, mat('grass', 0.5), 10, stalk)
        for k in range(1, int(h / 0.35)):
            cylinder(f'{name} node {i}.{k}', (0, 0, k * 0.35), 0.062, 0.03, mat('grass-dark'), 10,
                     stalk)
        for k in range(3):
            leaf = ball(f'{name} leaf {i}.{k}', (0.12, 0, h - 0.1 - k * 0.2), 0.16,
                        mat('grass-light', 0.8), squash=(1, 0.3, 0.15), parent=stalk, segments=8)
            leaf.rotation_euler = (0, math.radians(-25), rand.uniform(0, math.tau))
        stalks.append(stalk)
    return stalks


def roof(name, location, width, depth, height, material, parent=None, rotation=0.0):
    """A hip roof of red tiles with eaves that turn up at the corners."""
    w, d = width / 2, depth / 2
    ridge = max(w - d, 0.05)
    lift = 0.08
    verts = [(-w, -d, lift), (w, -d, lift), (w, d, lift), (-w, d, lift),
             (-ridge, 0, height), (ridge, 0, height),
             (-w * 0.92, -d * 0.92, 0), (w * 0.92, -d * 0.92, 0), (w * 0.92, d * 0.92, 0),
             (-w * 0.92, d * 0.92, 0)]
    faces = [(0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4), (6, 9, 8, 7), (0, 6, 7, 1),
             (1, 7, 8, 2), (2, 8, 9, 3), (3, 9, 6, 0)]
    obj = mesh(name, verts, faces, material, False, parent, location)
    obj.rotation_euler = (0, 0, rotation)
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width, mod.segments = 0.03, 2
    ridge_bar = box(name + ' ridge', (ridge * 2 + 0.2, 0.1, 0.1), (0, 0, height), mat('tile-dark'),
                    0.04, parent=obj)
    for sx in (-1, 1):
        ball(f'{name} curl {sx}', (sx * (ridge + 0.12), 0, height + 0.07), 0.08, mat('tile-dark'),
             parent=ridge_bar.parent)
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        ball(f'{name} eave {sx}{sy}', (sx * w * 1.02, sy * d * 1.02, lift + 0.06), 0.06,
             mat('tile-dark'), parent=obj)
    return obj


def house(name, location, rotation=0.0, size=(1.25, 0.85)):
    root = pivot(name, location)
    root.rotation_euler = (0, 0, math.radians(rotation))
    w, d = size
    box(name + ' base', (w + 0.16, d + 0.16, 0.14), (0, 0, 0.07), mat('stone'), 0.03, parent=root)
    box(name + ' walls', (w, d, 0.62), (0, 0, 0.45), mat('paper', 0.8), 0.03, parent=root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f'{name} post {sx}{sy}', (0.09, 0.09, 0.66), (sx * w / 2, sy * d / 2, 0.47),
                mat('wood-dark'), 0.02, parent=root)
    box(name + ' door', (0.32, 0.04, 0.44), (0, -d / 2 - 0.01, 0.36), mat('wood-dark'), 0.02,
        parent=root)
    for sx in (-1, 1):
        box(f'{name} window {sx}', (0.22, 0.04, 0.2), (sx * w * 0.3, -d / 2 - 0.01, 0.5),
            mat('wood'), 0.015, parent=root)
    roof(name + ' roof', (0, 0, 0.74), w + 0.42, d + 0.42, 0.5, mat('tile', 0.55), root)
    return root


def pavilion(name, location, rotation=0.0):
    root = pivot(name, location)
    root.rotation_euler = (0, 0, math.radians(rotation))
    box(name + ' floor', (1.0, 0.8, 0.16), (0, 0, 0.08), mat('wood'), 0.03, parent=root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cylinder(f'{name} column {sx}{sy}', (sx * 0.38, sy * 0.28, 0.16), 0.055, 0.6,
                     mat('lacquer', 0.5), 12, root)
    roof(name + ' roof', (0, 0, 0.76), 1.3, 1.05, 0.42, mat('tile', 0.55), root)
    return root


def stone_lantern(name, location):
    root = pivot(name, location)
    box(name + ' foot', (0.26, 0.26, 0.1), (0, 0, 0.05), mat('stone'), 0.02, parent=root)
    box(name + ' post', (0.12, 0.12, 0.3), (0, 0, 0.25), mat('stone'), 0.02, parent=root)
    box(name + ' light', (0.24, 0.24, 0.2), (0, 0, 0.5), mat('stone-dark'), 0.02, parent=root)
    box(name + ' cap', (0.36, 0.36, 0.08), (0, 0, 0.64), mat('stone'), 0.03, parent=root)
    ball(name + ' top', (0, 0, 0.72), 0.06, mat('stone'), parent=root)
    return root


def fence(name, start, end, posts=5):
    a, b = Vector(start), Vector(end)
    for i in range(posts):
        p = a.lerp(b, i / (posts - 1))
        box(f'{name} post {i}', (0.07, 0.07, 0.3), (p.x, p.y, 0.15), mat('wood'), 0.015)
    mid = (a + b) / 2
    angle = math.atan2(b.y - a.y, b.x - a.x)
    for z in (0.12, 0.24):
        box(f'{name} rail {z}', ((b - a).length, 0.04, 0.04), (mid.x, mid.y, z), mat('wood-dark'),
            0.01, rotation=(0, 0, angle))


def banner(name, location, color, emblem='gold', rotation=0.0):
    """A pole with a cloth that waves: frame() moves the cloth's vertices."""
    root = pivot(name, location)
    root.rotation_euler = (0, 0, math.radians(rotation))
    cylinder(name + ' pole', (0, 0, 0), 0.06, 2.2, mat('wood-dark', 0.8), 12, root)
    box(name + ' bar', (0.9, 0.07, 0.07), (0.4, 0, 2.08), mat('wood-dark'), 0.02, parent=root)
    ball(name + ' knob', (0, 0, 2.24), 0.08, mat('gold', 0.4), parent=root)
    cols, rows = 10, 12
    w, h = 0.72, 1.05
    verts, faces = [], []
    for j in range(rows + 1):
        for i in range(cols + 1):
            verts.append((0.08 + w * i / cols, 0, 2.02 - h * j / rows))
    for j in range(rows):
        for i in range(cols):
            a = j * (cols + 1) + i
            faces.append((a, a + 1, a + cols + 2, a + cols + 1))
    m = bpy.data.materials.new(name + ' cloth')
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    shader = nodes['Principled BSDF']
    shader.inputs['Roughness'].default_value = 0.8
    coords = nodes.new('ShaderNodeTexCoord')
    split = nodes.new('ShaderNodeSeparateXYZ')
    links.new(coords.outputs['UV'], split.inputs[0])
    # A gold border and a gold disc emblem, from the cloth's own UVs.
    disc = nodes.new('ShaderNodeVectorMath')
    disc.operation = 'DISTANCE'
    disc.inputs[1].default_value = (0.5, 0.58, 0)
    scale = nodes.new('ShaderNodeVectorMath')
    scale.operation = 'MULTIPLY'
    scale.inputs[1].default_value = (1.0, h / w, 0)
    links.new(coords.outputs['UV'], scale.inputs[0])
    links.new(scale.outputs[0], disc.inputs[0])
    disc.inputs[1].default_value = (0.5, 0.58 * h / w, 0)
    inside = nodes.new('ShaderNodeMath')
    inside.operation = 'LESS_THAN'
    inside.inputs[1].default_value = 0.24
    links.new(disc.outputs['Value'], inside.inputs[0])
    edge = nodes.new('ShaderNodeMath')
    edge.operation = 'MAXIMUM'
    border_x = nodes.new('ShaderNodeMath')
    border_x.operation = 'PINGPONG'
    border_x.inputs[1].default_value = 0.5
    links.new(split.outputs['X'], border_x.inputs[0])
    near_x = nodes.new('ShaderNodeMath')
    near_x.operation = 'LESS_THAN'
    near_x.inputs[1].default_value = 0.07
    links.new(border_x.outputs[0], near_x.inputs[0])
    near_y = nodes.new('ShaderNodeMath')
    near_y.operation = 'GREATER_THAN'
    near_y.inputs[1].default_value = 0.94
    links.new(split.outputs['Y'], near_y.inputs[0])
    links.new(near_x.outputs[0], edge.inputs[0])
    links.new(near_y.outputs[0], edge.inputs[1])
    gold = nodes.new('ShaderNodeMath')
    gold.operation = 'MAXIMUM'
    links.new(edge.outputs[0], gold.inputs[0])
    links.new(inside.outputs[0], gold.inputs[1])
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = (*rgb(PALETTE.get(color, color)), 1)
    mix.inputs['B'].default_value = (*rgb(PALETTE.get(emblem, emblem)), 1)
    links.new(gold.outputs[0], mix.inputs['Factor'])
    links.new(mix.outputs['Result'], shader.inputs['Base Color'])
    cloth = mesh(name + ' cloth', verts, faces, m, True, root)
    uv = cloth.data.uv_layers.new()
    for poly in cloth.data.polygons:
        for li in poly.loop_indices:
            x, _, z = verts[cloth.data.loops[li].vertex_index]
            uv.data[li].uv = ((x - 0.08) / w, (z - (2.02 - h)) / h)
    solid = cloth.modifiers.new('Thickness', 'SOLIDIFY')
    solid.thickness = 0.025
    rest = [Vector(v) for v in verts]

    def wave(t):
        for index, v in enumerate(cloth.data.vertices):
            p = rest[index]
            u = (p.x - 0.08) / w
            down = (2.02 - p.z) / h
            v.co = (p.x - 0.04 * u * u, 0.13 * u * math.sin(math.tau * (u * 0.9 - t) + down),
                    p.z - 0.03 * u * math.sin(math.tau * (u - t)))
        cloth.data.update()
    return wave


def sway(obj, degrees, phase=0.0, axis=1):
    rest = obj.rotation_euler.copy()

    def move(t):
        angle = list(rest)
        angle[axis] += math.radians(degrees) * math.sin(math.tau * (t + phase))
        obj.rotation_euler = angle
    return move


# --- Islands ------------------------------------------------------------------------------------

def island_co():
    rock(11)
    flow = waterfall(math.radians(-62))
    ball('Path', (0.15, -0.45, 0.0), 1.0, mat('sand-dark', 0.9), squash=(1.05, 0.8, 0.03))
    # The stone xiangqi board with a red and a black piece, front and centre.
    board = pivot('Board', (0.15, -0.45, 0.02))
    box('Board slab', (1.25, 0.95, 0.1), (0, 0, 0.05), mat('sand'), 0.03, parent=board)
    for i in range(1, 5):
        box(f'Board line x{i}', (0.02, 0.86, 0.012), (-0.6 + 1.2 * i / 5, 0, 0.105),
            mat('wood-dark'), 0, parent=board)
    for i in range(1, 4):
        box(f'Board line y{i}', (1.16, 0.02, 0.012), (0, -0.45 + 0.9 * i / 4, 0.105),
            mat('wood-dark'), 0, parent=board)
    for name, pos, ring in (('red', (-0.27, -0.1), 'lacquer'), ('black', (0.3, 0.12), 'ink')):
        cylinder(f'Piece {name}', (pos[0], pos[1], 0.1), 0.2, 0.12, mat('cream', 0.4), 32, board)
        cylinder(f'Piece {name} ring', (pos[0], pos[1], 0.22), 0.15, 0.006, mat(ring, 0.4), 32,
                 board)
        cylinder(f'Piece {name} face', (pos[0], pos[1], 0.22), 0.12, 0.012, mat('cream', 0.4),
                 32, board)
    house('House', (-0.55, 0.75, 0), rotation=8)
    stalks = bamboo('Bamboo', (0.55, 1.15, 0), 7, seed=3)
    blossom = tree('Blossom', (-1.45, 0.05, 0), blossom=True, height=0.75, scale=1.05, seed=2)
    green = tree('Tree', (1.35, 0.55, 0), height=0.6, scale=0.85, seed=5)
    stone_lantern('Lantern L', (-1.0, -0.95, 0))
    stone_lantern('Lantern R', (1.15, -0.55, 0))
    fence('Fence', (-1.55, -0.85, 0), (-1.0, -1.4, 0), 4)
    cylinder('Pot', (0.95, -1.15, 0), 0.14, 0.24, mat('wood-dark', 0.7), 16, taper=0.75)
    wave = banner('Banner', (1.05, 0.05, 0), 'lacquer', rotation=-15)
    moves = [wave, sway(blossom, 2.5), sway(green, 2.5, 0.3)]
    moves += [sway(s, 2.0, i * 0.13) for i, s in enumerate(stalks)]
    return [flow] + moves


def island_bai():
    rock(23)
    flow = waterfall(math.radians(-118))
    ball('Path', (0.0, -0.35, 0.0), 1.0, mat('sand-dark', 0.9), squash=(1.1, 0.85, 0.03))
    # A giant fan of five cards standing on the sand.
    fan = pivot('Fan', (0.1, -0.2, 0.0))
    fan.scale = (1.3, 1.3, 1.3)
    fan.rotation_euler = (0, 0, math.radians(-8))
    suits = ('lacquer', 'ink', 'lacquer', 'ink', 'lacquer')
    for i, suit in enumerate(suits):
        card = pivot(f'Card {i}', (0, 0, 0.12), fan)
        card.rotation_euler = (0, math.radians((i - 2) * 16), 0)
        box(f'Card {i} face', (0.62, 0.04, 0.9), (0, -i * 0.012, 0.55), mat('cream', 0.5), 0.03,
            parent=card)
        box(f'Card {i} pip', (0.2, 0.02, 0.2), (0, -i * 0.012 - 0.03, 0.62), mat(suit, 0.5), 0.02,
            rotation=(0, math.radians(45), 0), parent=card)
        for corner in (-1, 1):
            box(f'Card {i} corner {corner}', (0.08, 0.02, 0.08),
                (corner * 0.21, -i * 0.012 - 0.03, 0.55 + corner * 0.33), mat(suit, 0.5), 0.01,
                rotation=(0, math.radians(45), 0), parent=card)
    pavilion('Dinh', (-0.75, 0.85, 0), rotation=-6)
    crown = palm('Palm', (1.3, 0.7, 0), seed=4)
    blossom = tree('Blossom', (-1.5, -0.2, 0), blossom=True, height=0.6, scale=0.85, seed=7)
    tree('Tree', (0.55, 1.25, 0), height=0.7, scale=0.9, seed=8)
    stone_lantern('Lantern', (1.25, -0.75, 0))
    fence('Fence', (-1.2, -1.15, 0), (-0.55, -1.55, 0), 4)
    wave = banner('Banner', (-1.5, -0.25, 0), 'sea-deep', rotation=10)
    moves = [wave, sway(crown, 4.0, 0.1, 0), sway(blossom, 2.5)]
    return [flow] + moves


def island_su_kien():
    rock(37)
    flow = waterfall(math.radians(-65))
    ball('Path', (0.0, -0.3, 0.0), 1.0, mat('sand-dark', 0.9), squash=(1.1, 0.85, 0.03))
    # A string of red lanterns between two bamboo poles, and a star lantern on a pole.
    left, right = Vector((-1.15, 0.2, 0)), Vector((0.95, 0.75, 0))
    for p in (left, right):
        cylinder('Lantern pole', tuple(p), 0.05, 1.7, mat('grass-dark', 0.6), 10)
    lanterns = []
    for i in range(5):
        t = (i + 1) / 6
        p = left.lerp(right, t)
        hang = pivot(f'Hang {i}', (p.x, p.y, 1.62 - 0.35 * math.sin(math.pi * t)))
        cylinder(f'String {i}', (0, 0, -0.18), 0.008, 0.18, mat('ink'), 6, hang)
        color = 'lantern' if i % 2 == 0 else 'gold'
        ball(f'Lantern {i}', (0, 0, -0.38), 0.25, mat(color, 0.4, 0.5), squash=(1, 1, 0.85),
             parent=hang)
        for z in (-0.22, -0.54):
            cylinder(f'Lantern {i} cap {z}', (0, 0, z - 0.02), 0.09, 0.04, mat('gold', 0.4), 12,
                     hang)
        lanterns.append(hang)
    star = pivot('Star', (0.85, -0.7, 0))
    cylinder('Star pole', (0, 0, 0), 0.04, 1.15, mat('wood-dark'), 10, star)
    points = []
    for i in range(10):
        r = 0.42 if i % 2 == 0 else 0.18
        a = math.pi / 2 + math.tau * i / 10
        points.append((math.cos(a) * r, 0, math.sin(a) * r))
    verts = [(x, -0.07, z) for x, _, z in points] + [(x, 0.07, z) for x, _, z in points]
    verts += [(0, -0.14, 0), (0, 0.14, 0)]
    faces = []
    for i in range(10):
        j = (i + 1) % 10
        faces.append((20, j, i))
        faces.append((21, 10 + i, 10 + j))
        faces.append((i, j, 10 + j, 10 + i))
    star_head = mesh('Star lantern', verts, faces, mat('gold', 0.45, 0.6), False, star,
                     (0, 0, 1.45))
    pavilion('Dinh', (-0.45, 1.05, 0), rotation=4)
    blossom = tree('Blossom', (1.45, -0.15, 0), blossom=True, height=0.65, scale=0.9, seed=9)
    tree('Tree', (-1.55, -0.45, 0), height=0.7, scale=0.85, seed=10)
    box('Table', (0.5, 0.4, 0.22), (-0.75, -0.75, 0.11), mat('wood'), 0.03)
    ball('Mooncake', (-0.75, -0.75, 0.27), 0.12, mat('wood'), squash=(1, 1, 0.5))
    moves = [sway(h, 7.0, i * 0.17, 1) for i, h in enumerate(lanterns)]
    moves += [sway(star_head, 8.0, 0.0, 2), sway(blossom, 2.5)]
    return [flow] + moves


def island_hanh_dong():
    rock(53)
    flow = waterfall(math.radians(-115))
    ball('Path', (0.05, -0.3, 0.0), 1.0, mat('sand-dark', 0.9), squash=(1.1, 0.85, 0.03))
    # The big bomb with a lit fuse.
    bomb = pivot('Bomb', (0.1, -0.3, 0))
    ball('Bomb body', (0, 0, 0.62), 0.62, mat('ink', 0.35), parent=bomb, segments=32)
    ball('Bomb shine', (-0.25, -0.33, 0.95), 0.12, mat('#8A8A96', 0.3), squash=(1, 0.6, 1.3),
         parent=bomb)
    cylinder('Bomb cap', (0.12, 0.05, 1.12), 0.17, 0.16, mat('wood-dark', 0.6), 16, bomb)
    fuse = []
    for i in range(6):
        t = i / 5
        p = Vector((0.15 + 0.35 * t, 0.05, 1.3 + 0.35 * math.sin(t * 2.4)))
        fuse.append(p)
        ball(f'Fuse {i}', tuple(p), 0.045, mat('wood', 0.8), parent=bomb, segments=10)
    spark = pivot('Spark', tuple(fuse[-1] + Vector((0.02, 0, 0.06))), bomb)
    ball('Spark core', (0, 0, 0), 0.1, mat('gold', 0.3, 6.0), parent=spark, segments=12)
    rays = []
    for i in range(6):
        a = math.tau * i / 6
        ray = ball(f'Spark ray {i}', (math.cos(a) * 0.14, 0, math.sin(a) * 0.14), 0.045,
                   mat('lantern', 0.3, 4.0), parent=spark, segments=8)
        rays.append(ray)
    box('Crate A', (0.45, 0.45, 0.45), (-1.05, 0.55, 0.225), mat('wood', 0.8), 0.04,
        rotation=(0, 0, 0.3))
    box('Crate B', (0.36, 0.36, 0.36), (-0.95, 0.5, 0.63), mat('wood', 0.8), 0.04,
        rotation=(0, 0, 0.9))
    box('Crate C', (0.36, 0.36, 0.36), (-1.45, 0.05, 0.18), mat('wood-dark', 0.8), 0.04)
    for i in range(3):
        cylinder(f'Barrel {i}', (1.0 + i * 0.12, 0.85 - i * 0.35, 0), 0.17, 0.42,
                 mat('wood-dark' if i % 2 else 'wood', 0.8), 16, taper=0.9)
    crown = palm('Palm', (1.35, 0.25, 0), seed=6)
    tree('Tree', (-0.25, 1.3, 0), height=0.7, scale=0.95, seed=12)
    fence('Fence', (0.85, -1.35, 0), (1.5, -0.85, 0), 4)
    wave = banner('Banner', (-1.4, -0.6, 0), 'tile', rotation=12)

    def flicker(t):
        k = 1 + 0.25 * math.sin(math.tau * t * 2) + 0.12 * math.sin(math.tau * t * 3 + 1)
        spark.scale = (k, k, k)
        for i, ray in enumerate(rays):
            r = 0.13 + 0.05 * math.sin(math.tau * (t * 2 + i / 6))
            a = math.tau * i / 6 + math.tau * t / 3
            ray.location = (math.cos(a) * r, 0, math.sin(a) * r)
    return [flow] + [wave, flicker, sway(crown, 4.0, 0.2, 0), sway(bomb, 1.5, 0.0, 0)]


def island_sap_co():
    """The locked island: bare stone and a closed gate (the client adds fog and a lock)."""
    rock(71, grass='grass-dark')
    flow = waterfall(math.radians(-70))
    ball('Path', (0.0, -0.2, 0.0), 1.0, mat('sand-dark', 0.9), squash=(1.05, 0.8, 0.03))
    gate = pivot('Gate', (0.0, 0.25, 0))
    for sx in (-1, 1):
        box(f'Gate pillar {sx}', (0.22, 0.22, 1.25), (sx * 0.55, 0, 0.62), mat('stone'), 0.03,
            parent=gate)
    box('Gate beam', (1.6, 0.26, 0.16), (0, 0, 1.3), mat('stone-dark'), 0.03, parent=gate)
    box('Gate beam 2', (1.3, 0.2, 0.1), (0, 0, 1.12), mat('stone'), 0.02, parent=gate)
    box('Gate door', (0.88, 0.08, 1.0), (0, 0.02, 0.5), mat('wood-dark', 0.8), 0.02, parent=gate)
    for i, (x, y, r) in enumerate(((-1.3, -0.3, 0.32), (1.25, 0.4, 0.38), (0.9, -0.9, 0.22),
                                   (-0.8, 0.95, 0.26))):
        ball(f'Boulder {i}', (x, y, r * 0.4), r, mat('stone', 0.9), squash=(1.2, 1, 0.75),
             segments=10)
    stalks = bamboo('Bamboo', (-1.1, 0.6, 0), 4, seed=5)
    tree('Tree', (1.35, -0.25, 0), height=0.7, scale=0.9, seed=13)
    return [flow] + [sway(s, 2.0, i * 0.2) for i, s in enumerate(stalks)]


ISLANDS = {
    'co': island_co,
    'bai': island_bai,
    'su-kien': island_su_kien,
    'hanh-dong': island_hanh_dong,
    'sap-co': island_sap_co,
}


def bake(name):
    reset()
    moves = ISLANDS[name]()
    out = OUT / name
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    for f in range(FRAMES):
        t = f / FRAMES
        for move in moves:
            move(t)
        bpy.context.view_layer.update()
        scene.render.filepath = str(out / f'{f}.png')
        bpy.ops.render.render(write_still=True)
    pack(name)


def pack(name):
    """The baked frames of `name` as its loop sheet and its island scene."""
    frames = [OUT / name / f'{f}.png' for f in range(FRAMES)]
    sheet = Image.new('RGBA', (SIZE * COLUMNS, SIZE * math.ceil(FRAMES / COLUMNS)))
    for f, path in enumerate(frames):
        with Image.open(path) as image:
            sheet.paste(image, ((f % COLUMNS) * SIZE, (f // COLUMNS) * SIZE))
    ASSETS.mkdir(parents=True, exist_ok=True)
    sheet.save(ASSETS / f'{name}-loop.webp', quality=88, method=6)
    atlases = '\n'.join(
        f'[sub_resource type="AtlasTexture" id="frame_{f}"]\natlas = ExtResource("sheet")\n'
        f'region = Rect2({(f % COLUMNS) * SIZE}, {(f // COLUMNS) * SIZE}, {SIZE}, {SIZE})\n'
        for f in range(FRAMES))
    frames_list = ', '.join(
        f'{{\n"duration": 1.0,\n"texture": SubResource("frame_{f}")\n}}' for f in range(FRAMES))
    (ASSETS / f'{name}.tscn').write_text(
        f'[gd_scene load_steps={FRAMES + 3} format=3]\n\n'
        f'[ext_resource type="Texture2D" path="res://hub/genres/{name}-loop.webp" id="sheet"]\n\n'
        f'{atlases}\n'
        '[sub_resource type="SpriteFrames" id="loop"]\n'
        f'animations = [{{\n"frames": [{frames_list}],\n"loop": true,\n"name": &"default",\n'
        f'"speed": {FPS}.0\n}}]\n\n'
        f'[node name="Island" type="Node2D"]\n\n'
        '[node name="Loop" type="AnimatedSprite2D" parent="."]\n'
        'sprite_frames = SubResource("loop")\nautoplay = "default"\ncentered = false\n')
    print(f'island {name}: {ASSETS / (name + ".tscn")}')


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if argv[:1] == ['--pack']:
        for island in argv[1:] or list(ISLANDS):
            pack(island)
    else:
        for island in argv or list(ISLANDS):
            bake(island)
