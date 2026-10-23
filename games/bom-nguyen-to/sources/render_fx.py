"""Bake Bom Nguyên Tố's effects with the arena's camera (see render_arena.py).

Run: npm run blender -- bom-nguyen-to [puff] [aura] [splash] [swirl] [shards] [ice] [debris]
     (add `quick` for a fast low-sample look)

The flipbooks `puff`, `aura`, `splash` and `swirl` are grey toon renders: the table tints them
per element with a gradient map (light grey becomes the element's hot colour, dark grey its
shade), so one bake serves the five elements. `shards`, `ice` and `debris` are in colour.
Everything is packed into the arena-fx3d atlas (arena-fx3d.json: frame rects, canvas anchor and
the clips' frame counts). Frames are PNGs in .blender/bom-nguyen-to/fx/.
"""
from pathlib import Path
import json
import math
import random
import sys

import bpy
from mathutils import Vector
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_arena import (ART, ASSETS, CELL_PX, ELEVATION, SUN, camera, hexcolor, reset)  # noqa: E402

OUT = Path(__file__).resolve().parents[3] / '.blender' / 'bom-nguyen-to' / 'fx'
SELECTED = [n for n in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])]
QUICK = 'quick' in SELECTED
SIZE = (256, 256)
ANCHOR = (128, 168)
FRAMES = {'puff': 14, 'aura': 16, 'splash': 12, 'swirl': 12}


# ── Toon grey shading ──────────────────────────────────────────────────────────────────────


def toon(name, levels=(0.42, 0.7, 1.0), edges=(0.25, 0.6)):
    """An emission material in three grey steps from the sun's angle, scaled by the `Heat`
    value node, with alpha cut by a noise `Cut` threshold (0 shows everything)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else None
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    geometry = nodes.new('ShaderNodeNewGeometry')
    light = nodes.new('ShaderNodeCombineXYZ')
    light.inputs[0].default_value, light.inputs[1].default_value, light.inputs[2].default_value = SUN
    dot = nodes.new('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    links.new(geometry.outputs['Normal'], dot.inputs[0])
    links.new(light.outputs[0], dot.inputs[1])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (levels[0],) * 3 + (1,)
    ramp.color_ramp.elements[1].position = edges[0]
    ramp.color_ramp.elements[1].color = (levels[1],) * 3 + (1,)
    top = ramp.color_ramp.elements.new(edges[1])
    top.color = (levels[2],) * 3 + (1,)
    links.new(dot.outputs['Value'], ramp.inputs['Fac'])
    heat = nodes.new('ShaderNodeValue')
    heat.name = 'Heat'
    heat.outputs[0].default_value = 1.0
    shade = nodes.new('ShaderNodeMath')
    shade.operation = 'MULTIPLY'
    links.new(ramp.outputs['Color'], shade.inputs[0])
    links.new(heat.outputs[0], shade.inputs[1])
    glow = nodes.new('ShaderNodeEmission')
    links.new(shade.outputs[0], glow.inputs['Color'])
    # Erosion: a noise over the object; above `Cut` it shows.
    coords = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.2
    noise.inputs['Detail'].default_value = 2
    links.new(coords.outputs['Object'], noise.inputs['Vector'])
    cut = nodes.new('ShaderNodeValue')
    cut.name = 'Cut'
    cut.outputs[0].default_value = 0.0
    more = nodes.new('ShaderNodeMath')
    more.operation = 'GREATER_THAN'
    links.new(noise.outputs['Fac'], more.inputs[0])
    links.new(cut.outputs[0], more.inputs[1])
    clear = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    links.new(more.outputs[0], mix.inputs['Fac'])
    links.new(clear.outputs[0], mix.inputs[1])
    links.new(glow.outputs[0], mix.inputs[2])
    out = nodes.new('ShaderNodeOutputMaterial')
    links.new(mix.outputs[0], out.inputs['Surface'])
    return mat


def set_value(mat, name, value):
    mat.node_tree.nodes[name].outputs[0].default_value = value


def flat(name, color, alpha=1.0, strength=1.0):
    """Emission in one colour with a constant alpha (ice glints, the aura's glow)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    glow = nodes.new('ShaderNodeEmission')
    glow.inputs['Color'].default_value = (*color, 1)
    glow.inputs['Strength'].default_value = strength
    clear = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = alpha
    links.new(clear.outputs[0], mix.inputs[1])
    links.new(glow.outputs[0], mix.inputs[2])
    out = nodes.new('ShaderNodeOutputMaterial')
    links.new(mix.outputs[0], out.inputs['Surface'])
    return mat


def ball(at, radius, mat, subdivisions=3):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=at)
    obj = bpy.context.object
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def frame_scene(samples=24):
    scene = reset(SIZE, samples)
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0
    camera(scene, (0, 0, 0), SIZE, ANCHOR)
    return scene


def save(scene, name):
    OUT.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(OUT / f'{name}.png')
    bpy.ops.render.render(write_still=True)


def ease_out(t):
    return 1 - (1 - t) ** 3


# ── Flipbooks ──────────────────────────────────────────────────────────────────────────────


def puff():
    """A cartoon blast: lumps pop out with an overshoot, rise, cool and erode away."""
    rng = random.Random(4)
    lumps = []
    for i in range(9):
        a = i / 9 * math.tau + rng.uniform(-0.3, 0.3)
        d = 0.0 if i == 0 else rng.uniform(0.18, 0.34)
        lumps.append({'dir': Vector((math.cos(a) * d, math.sin(a) * d * 0.8, 0)),
                      'z': rng.uniform(0.18, 0.42) if i else 0.36,
                      'r': rng.uniform(0.2, 0.28) if i else 0.33,
                      'delay': 0 if i == 0 else rng.uniform(0, 0.08),
                      'heat': 1.0 if i == 0 else rng.uniform(0.85, 1.0)})
    n = FRAMES['puff']
    for f in range(n):
        scene = frame_scene(32)
        t = f / (n - 1)
        for i, lump in enumerate(lumps):
            mat = toon(f'Puff {i}', levels=(0.5, 0.78, 1.0))
            local = max(0.0, (t - lump['delay']) / (1 - lump['delay']))
            grow = min(1.0, local / 0.16)
            scale = 0.25 + 0.95 * ease_out(grow)
            if grow < 1:
                scale *= 1 + 0.15 * math.sin(grow * math.pi)
            # Each lump shrinks away on its own beat instead of crumbling.
            fade_from = 0.45 + 0.25 * (i % 3) / 2
            if local > fade_from:
                scale *= max(0.0, 1 - ((local - fade_from) / (1 - fade_from)) ** 1.6)
            if scale < 0.02:
                continue
            spread = 1 + 0.9 * ease_out(local)
            at = lump['dir'] * spread + Vector((0, 0, lump['z'] + 0.45 * local * local))
            ball(at, lump['r'] * scale, mat)
            set_value(mat, 'Heat', lump['heat'] * (1.0 - 0.45 * max(0.0, (local - 0.25) / 0.75)))
            set_value(mat, 'Cut', max(0.0, (local - 0.8) / 0.2) * 0.5)
        save(scene, f'puff-{f:02d}')


def aura():
    """A looping ring of flame tongues rising around a fighter's feet, in a back and a front
    half so the fighter stands inside it. Every tongue grows, rises and shrinks on its own
    phase, so the last frame meets the first."""
    n = FRAMES['aura']
    tongues = 14
    radius = 0.42
    rng = random.Random(23)
    offsets = [rng.uniform(0, 1) for _ in range(tongues)]
    for half in ('back', 'front'):
        for f in range(n):
            scene = frame_scene(16)
            for k in range(tongues):
                a = k / tongues * math.tau
                front = math.sin(a) < 0
                if front != (half == 'front'):
                    continue
                p = (f / n + offsets[k]) % 1.0
                height = 0.12 + 0.42 * math.sin(p * math.pi)
                width = 0.075 * (1.0 - 0.5 * p)
                if width * height < 0.002:
                    continue
                r = radius * (1 - 0.12 * p)
                mat = toon(f'Tongue {k}', levels=(0.55, 0.8, 1.0))
                tongue = ball((math.cos(a) * r, math.sin(a) * r, 0.05 + p * 0.55 + height / 2),
                              1.0, mat, 3)
                tongue.scale = (width, width, height / 2)
            if half == 'back':
                ring = flat('Ground ring', (0.85, 0.85, 0.85), 0.7, 1.0)
                bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.02,
                                                 location=(0, 0, 0.01))
                torus = bpy.context.object
                torus.scale.z = 0.2
                torus.data.materials.append(ring)
            save(scene, f'aura-{half}-{f:02d}')


def splash():
    """Water: a crown of drops thrown out and falling back."""
    rng = random.Random(9)
    drops = []
    for i in range(22):
        a = i / 22 * math.tau + rng.uniform(-0.12, 0.12)
        speed = rng.uniform(0.55, 0.9)
        drops.append((a, speed, rng.uniform(1.4, 2.2), rng.uniform(0.05, 0.09)))
    n = FRAMES['splash']
    for f in range(n):
        scene = frame_scene(24)
        t = f / (n - 1)
        for i, (a, speed, up, r) in enumerate(drops):
            d = speed * ease_out(t) * 0.75
            z = max(0.0, up * t - 2.6 * t * t) * 0.55
            size = r * (1.15 - 0.7 * t)
            drop = ball((math.cos(a) * d, math.sin(a) * d * 0.9, z + 0.05), size,
                        toon(f'Drop {i}', levels=(0.5, 0.78, 1.0)))
            drop.scale.z = 1.25
        # The wave ring on the water: a thin flattened torus, early only.
        if t < 0.45:
            mat = toon('Wave', levels=(0.55, 0.8, 1.0))
            set_value(mat, 'Cut', max(0.0, t - 0.35))
            bpy.ops.mesh.primitive_torus_add(major_radius=0.2 + 0.45 * ease_out(t),
                                             minor_radius=0.035 * (1 - t * 2) + 0.01,
                                             location=(0, 0, 0.03))
            wave = bpy.context.object
            wave.scale.z = 0.6
            wave.data.materials.append(mat)
            bpy.ops.object.shade_smooth()
        # A central column that pops up and falls.
        column = max(0.0, math.sin(min(1.0, t / 0.7) * math.pi))
        if column > 0.05:
            mat = toon('Column')
            set_value(mat, 'Cut', max(0.0, t - 0.5) * 1.4)
            ball((0, 0, 0.3 * column), 0.18 * (0.6 + column * 0.6), mat).scale.z = 1.6
        save(scene, f'splash-{f:02d}')


def swirl():
    """Wind: two ribbons spiralling up and outward, one turn per loop."""
    n = FRAMES['swirl']
    for f in range(n):
        scene = frame_scene(16)
        t = f / n
        for k in range(3):
            verts, faces = [], []
            steps = 64
            for i in range(steps + 1):
                u = i / steps
                a = u * math.tau * 1.4 + k * math.tau / 3 + t * math.tau
                r = 0.12 + 0.42 * u
                z = 0.05 + 0.7 * u
                w = 0.05 + 0.08 * math.sin(u * math.pi)
                for side in (-1, 1):
                    verts.append((math.cos(a) * r, math.sin(a) * r * 0.9, z + side * w))
            for i in range(steps):
                faces.append((i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1))
            mesh = bpy.data.meshes.new('Ribbon')
            mesh.from_pydata(verts, [], faces)
            obj = bpy.data.objects.new('Ribbon', mesh)
            scene.collection.objects.link(obj)
            # Fade along the ribbon: a gradient texture over the vertex order (UV).
            mat = bpy.data.materials.new('Ribbon')
            mat.use_nodes = True
            nodes, links = mat.node_tree.nodes, mat.node_tree.links
            nodes.clear()
            coords = nodes.new('ShaderNodeTexCoord')
            sep = nodes.new('ShaderNodeSeparateXYZ')
            links.new(coords.outputs['Object'], sep.inputs[0])
            fade = nodes.new('ShaderNodeMapRange')
            fade.inputs['From Min'].default_value = 0.05
            fade.inputs['From Max'].default_value = 0.75
            fade.inputs['To Min'].default_value = 0.95
            fade.inputs['To Max'].default_value = 0.0
            links.new(sep.outputs['Z'], fade.inputs['Value'])
            glow = nodes.new('ShaderNodeEmission')
            glow.inputs['Color'].default_value = (0.95, 0.95, 0.95, 1)
            clear = nodes.new('ShaderNodeBsdfTransparent')
            mix = nodes.new('ShaderNodeMixShader')
            links.new(fade.outputs['Result'], mix.inputs['Fac'])
            links.new(clear.outputs[0], mix.inputs[1])
            links.new(glow.outputs[0], mix.inputs[2])
            out = nodes.new('ShaderNodeOutputMaterial')
            links.new(mix.outputs[0], out.inputs['Surface'])
            obj.data.materials.append(mat)
        save(scene, f'swirl-{f:02d}')


# ── Colour stills ──────────────────────────────────────────────────────────────────────────


def crystal(at, length, radius, tilt, spin, mat):
    """A six-sided ice crystal with a pointed tip, leaning `tilt` toward `spin`."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=radius, depth=length * 0.7,
                                        location=(0, 0, length * 0.35))
    body = bpy.context.object
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=radius, radius2=0, depth=length * 0.3,
                                    location=(0, 0, length * 0.85))
    tip = bpy.context.object
    body.select_set(True)
    tip.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.data.materials.append(mat)
    body.location = at
    body.rotation_euler = (tilt, 0, spin)
    mod = body.modifiers.new('Bevel', 'BEVEL')
    mod.width, mod.segments = radius * 0.18, 2
    return body


def ice_material(name, alpha=0.92):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    geometry = nodes.new('ShaderNodeNewGeometry')
    light = nodes.new('ShaderNodeCombineXYZ')
    light.inputs[0].default_value, light.inputs[1].default_value, light.inputs[2].default_value = SUN
    dot = nodes.new('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    links.new(geometry.outputs['Normal'], dot.inputs[0])
    links.new(light.outputs[0], dot.inputs[1])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].color = (*hexcolor('#7cc6e8'), 1)
    ramp.color_ramp.elements[1].position = 0.2
    ramp.color_ramp.elements[1].color = (*hexcolor('#c4efff'), 1)
    top = ramp.color_ramp.elements.new(0.62)
    top.color = (*hexcolor('#f2fdff'), 1)
    links.new(dot.outputs['Value'], ramp.inputs['Fac'])
    fresnel = nodes.new('ShaderNodeLayerWeight')
    fresnel.inputs['Blend'].default_value = 0.35
    edge = nodes.new('ShaderNodeMapRange')
    edge.inputs['To Min'].default_value = alpha * 0.55
    edge.inputs['To Max'].default_value = alpha
    links.new(fresnel.outputs['Facing'], edge.inputs['Value'])
    glow = nodes.new('ShaderNodeEmission')
    links.new(ramp.outputs['Color'], glow.inputs['Color'])
    clear = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    links.new(edge.outputs['Result'], mix.inputs['Fac'])
    links.new(clear.outputs[0], mix.inputs[1])
    links.new(glow.outputs[0], mix.inputs[2])
    out = nodes.new('ShaderNodeOutputMaterial')
    links.new(mix.outputs[0], out.inputs['Surface'])
    return mat


def shards():
    for variant in range(2):
        scene = frame_scene(24)
        rng = random.Random(17 + variant)
        mat = ice_material('Ice')
        crystal((0, 0, 0), 0.62, 0.11, 0.05, 0, mat)
        for k in range(6 + variant):
            a = k / (6 + variant) * math.tau + rng.uniform(-0.3, 0.3)
            d = rng.uniform(0.12, 0.26)
            crystal((math.cos(a) * d, math.sin(a) * d, 0), rng.uniform(0.3, 0.48),
                    rng.uniform(0.06, 0.09), rng.uniform(0.45, 0.8), a - math.pi / 2, mat)
        save(scene, f'shards-{variant}')


def ice():
    """The block of ice a frozen fighter stands in (drawn over them, so it is see-through)."""
    scene = frame_scene(32)
    mat = ice_material('Ice block', alpha=0.62)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
    block = bpy.context.object
    block.scale = (0.78, 0.7, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    mod = block.modifiers.new('Bevel', 'BEVEL')
    mod.width, mod.segments = 0.12, 4
    block.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    glint = flat('Glint', (1, 1, 1), 0.85, 1.0)
    for x, z, h in ((-0.24, 0.62, 0.36), (-0.15, 0.5, 0.2)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -0.36, z))
        streak = bpy.context.object
        streak.scale = (0.035, 0.01, h)
        streak.rotation_euler.y = 0.35
        streak.data.materials.append(glint)
    crystal((0.3, -0.25, 0.0), 0.32, 0.07, 0.5, 2.2, ice_material('Ice foot'))
    crystal((-0.34, -0.2, 0.0), 0.26, 0.06, 0.6, -2.0, ice_material('Ice foot 2'))
    save(scene, 'ice')


DEBRIS = ('plank', 'splinter', 'weave', 'stone', 'laterite', 'leaf')


def debris():
    from render_arena import mottled, principled, wood  # noqa: E402
    makers = {
        'plank': lambda: (wood('Plank', '#b9793a', '#e2a65c'), (0.36, 0.1, 0.04)),
        'splinter': lambda: (wood('Splinter', '#7d4b23', '#a8692f'), (0.24, 0.05, 0.04)),
        'weave': lambda: (principled('Weave', '#d9a75c', 0.7), (0.28, 0.07, 0.02)),
        'stone': lambda: (mottled('Chip', '#6e7b88', '#9fabb6', voronoi=6), (0.14, 0.12, 0.1)),
        'laterite': lambda: (mottled('Laterite', '#8e3f25', '#c9673f', voronoi=11),
                             (0.15, 0.13, 0.11)),
        'leaf': lambda: (principled('Leaf', '#6db34a', 0.6), (0.14, 0.08, 0.01)),
    }
    for name in DEBRIS:
        scene = reset((64, 64), 32)
        camera(scene, (0, 0, 0), (64, 64))
        mat, size = makers[name]()
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
        piece = bpy.context.object
        piece.scale = size
        piece.rotation_euler = (0.3, 0.2, 0.5)
        bpy.ops.object.transform_apply(scale=True)
        mod = piece.modifiers.new('Bevel', 'BEVEL')
        mod.width, mod.segments = min(size) * 0.3, 2
        piece.data.materials.append(mat)
        bpy.ops.object.shade_smooth()
        save(scene, f'debris-{name}')


def pack():
    """Every frame into arena-fx3d.webp: clips in rows of 256 px cells, stills after them."""
    clips = {}
    for clip in ('puff', 'splash', 'swirl'):
        clips[clip] = [f'{clip}-{i:02d}' for i in range(FRAMES[clip])]
    for half in ('back', 'front'):
        clips[f'aura-{half}'] = [f'aura-{half}-{i:02d}' for i in range(FRAMES['aura'])]
    stills = ['shards-0', 'shards-1', 'ice'] + [f'debris-{n}' for n in DEBRIS]
    images = {}
    for name in [f for frames in clips.values() for f in frames] + stills:
        with Image.open(OUT / f'{name}.png') as image:
            images[name] = image.convert('RGBA')
    # Trim each frame to its pixels (plus 2), recording where the canvas anchor falls.
    pad = 2
    placed, frames = [], {}
    for name, image in images.items():
        box = image.getbbox() or (0, 0, 1, 1)
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(image.width, box[2] + pad),
               min(image.height, box[3] + pad))
        placed.append((name, image.crop(box), box, image.size))
    # Shelf packing, tallest first, 2048 wide.
    placed.sort(key=lambda p: -p[1].height)
    width, x, y, shelf = 2048, 0, 0, 0
    spots = {}
    for name, crop, box, full in placed:
        if x + crop.width > width:
            x, y, shelf = 0, y + shelf + 2, 0
        spots[name] = (x, y)
        x += crop.width + 2
        shelf = max(shelf, crop.height)
    sheet = Image.new('RGBA', (width, y + shelf))
    for name, crop, box, full in placed:
        sx, sy = spots[name]
        sheet.paste(crop, (sx, sy))
        anchor = ANCHOR if not name.startswith('debris') else (32, 32)
        # TexturePacker's trimmed-frame layout (godot/atlas.gd restores the full canvas).
        frames[name] = {'frame': {'x': sx, 'y': sy, 'w': crop.width, 'h': crop.height},
                        'spriteSourceSize': {'x': box[0], 'y': box[1], 'w': crop.width,
                                             'h': crop.height},
                        'sourceSize': {'w': full[0], 'h': full[1]}, 'anchor': list(anchor)}
    meta = {'cell': CELL_PX, 'frames': frames, 'clips': {k: len(v) for k, v in clips.items()}}
    for folder in (ASSETS, ART):
        sheet.save(folder / 'arena-fx3d.webp', quality=90, method=6)
        (folder / 'arena-fx3d.json').write_text(json.dumps(meta, indent=1) + '\n')


BAKES = {'puff': puff, 'aura': aura, 'splash': splash, 'swirl': swirl, 'shards': shards,
         'ice': ice, 'debris': debris}

if __name__ == '__main__':
    names = [n for n in SELECTED if n in BAKES]
    if not names and [n for n in SELECTED if n not in ('quick', 'pack')]:
        sys.exit(0)  # The names are render_arena.py's.
    for name in names or list(BAKES):
        BAKES[name]()
    if not names or 'pack' in SELECTED or len(names) == len(BAKES):
        pack()
    elif 'pack' not in SELECTED:
        print('Baked', names, '(run with `pack` to rebuild the atlas)')
