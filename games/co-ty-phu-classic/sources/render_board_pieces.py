"""Build Blender-authored board pieces as GLB, plus transparent pawn HUD portraits.

blender -b -t 6 --python games/co-ty-phu-classic/sources/render_board_pieces.py
Editable scene and PNG previews are kept in .blender/, ready files in assets/ and godot/art/.
"""
from pathlib import Path
import math
import shutil
import sys
import bpy
from mathutils import Vector
from PIL import Image

requested = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if requested and 'board-pieces' not in requested:
    raise SystemExit(0)

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT.parents[1] / '.blender' / 'board-pieces'
ART = ROOT / 'godot' / 'art'
ASSETS = ROOT / 'assets'
PREVIEW.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def material(name, color, roughness=.34):
    rgb = tuple(linear(int(color[i:i+2], 16)/255) for i in (0, 2, 4))
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*rgb, 1)
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = 0
    p.inputs['Coat Weight'].default_value = .16
    return m


colors = [('red', 'E53935'), ('blue', '1E88E5'), ('green', '43A047'), ('yellow', 'FDD835')]
ivory = material('Warm ivory resin', 'FFF3D8', .30)
pip_mat = material('Recessed dark teal pips', '193D40', .46)
pawns = []
profile = [(0, 0), (.40, 0), (.47, .025), (.50, .075), (.50, .12), (.47, .18),
           (.39, .23), (.32, .29), (.26, .39), (.22, .56), (.20, .76),
           (.22, .89), (.28, .95), (.28, 1.01), (.24, 1.06), (0, 1.08)]
for name, color in colors:
    mat = material(f'{name.title()} satin resin', color)
    parent = bpy.data.objects.new(f'Pawn_{name}', None)
    bpy.context.collection.objects.link(parent)
    sides = 40
    vertices = [(r * math.cos(j*math.tau/sides), r * math.sin(j*math.tau/sides), z)
                for r, z in profile for j in range(sides)]
    faces = []
    for ring in range(len(profile)-1):
        for j in range(sides):
            a, b = ring*sides+j, ring*sides+(j+1)%sides
            faces.append((a, b, b+sides, a+sides))
    mesh = bpy.data.meshes.new(f'{name} turned resin body')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    body = bpy.data.objects.new('Body', mesh)
    bpy.context.collection.objects.link(body)
    body.parent = parent
    body.data.materials.append(mat)
    for f in mesh.polygons:
        f.use_smooth = True
    sub = body.modifiers.new('Soft turned profile', 'SUBSURF')
    sub.levels = sub.render_levels = 1
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=sub.name)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=.31, location=(0, 0, 1.32))
    head = bpy.context.object
    head.name = 'Head'
    head.parent = parent
    head.data.materials.append(mat)
    for f in head.data.polygons:
        f.use_smooth = True
    pawns.append(parent)

bpy.ops.mesh.primitive_cube_add(size=1)
die = bpy.context.object
die.name = 'Die'
die.data.materials.append(ivory)
die.data.materials.append(pip_mat)
bevel = die.modifiers.new('Rounded resin edges', 'BEVEL')
bevel.width, bevel.segments = .095, 5
bpy.context.view_layer.objects.active = die
bpy.ops.object.modifier_apply(modifier=bevel.name)
# Opposite faces sum to seven. Blender +Z becomes Godot +Y (the upper face).
face_specs = [(Vector((0, 0, 1)), 1), (Vector((0, 0, -1)), 6),
              (Vector((0, 1, 0)), 2), (Vector((0, -1, 0)), 5),
              (Vector((1, 0, 0)), 3), (Vector((-1, 0, 0)), 4)]
cutters = []
for normal, value in face_specs:
    u = Vector((1, 0, 0)) if abs(normal.x) < .5 else Vector((0, 1, 0))
    v = normal.cross(u)
    pips = [(0, 0)] if value % 2 else []
    if value >= 2:
        pips += [(-1, -1), (1, 1)]
    if value >= 4:
        pips += [(-1, 1), (1, -1)]
    if value == 6:
        pips += [(-1, 0), (1, 0)]
    for x, y in pips:
        center = normal * .519 + (u*x + v*y) * .235
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=.079, location=center)
        cutter = bpy.context.object
        cutter.data.materials.append(pip_mat)
        cutters.append(cutter)
bpy.ops.object.select_all(action='DESELECT')
for obj in cutters:
    obj.select_set(True)
bpy.context.view_layer.objects.active = cutters[0]
bpy.ops.object.join()
cutter = bpy.context.object
bpy.context.view_layer.objects.active = die
boolean = die.modifiers.new('True recessed pip bowls', 'BOOLEAN')
boolean.operation, boolean.solver, boolean.object = 'DIFFERENCE', 'EXACT', cutter
bpy.ops.object.modifier_apply(modifier=boolean.name)
bpy.data.objects.remove(cutter, do_unlink=True)
# Boolean assigns the cutter's material to the concave pip surfaces.
for f in die.data.polygons:
    f.use_smooth = True
normal = die.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
normal.keep_sharp = True
bpy.ops.object.modifier_apply(modifier=normal.name)
bpy.ops.object.select_all(action='SELECT')
model = ASSETS / 'board-pieces.glb'
bpy.ops.export_scene.gltf(filepath=str(model), export_format='GLB', use_selection=True,
                          export_cameras=False, export_lights=False, export_animations=False)
shutil.copyfile(model, ART / model.name)

# HUD portraits use the same model, four plain colors, and overhead light direction.
die.hide_render = True
for parent in pawns:
    for child in parent.children:
        child.hide_render = True
bpy.ops.object.camera_add(location=(0, -5.7, 8.7))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .75)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type, camera.data.ortho_scale = 'ORTHO', 2.10
scene = bpy.context.scene
scene.camera = camera
for pos, energy, size in [((-3.5, -4, 7), 850, 5), ((4, 2, 5), 350, 5)]:
    bpy.ops.object.light_add(type='AREA', location=pos)
    bpy.context.object.data.energy = energy
    bpy.context.object.data.size = size
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 256, 320
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
scene.world.color = (.35, .35, .35)
for parent, (name, _) in zip(pawns, colors):
    for child in parent.children:
        child.hide_render = False
    scene.render.filepath = str(PREVIEW / f'pawn-{name}.png')
    bpy.ops.render.render(write_still=True)
    path = ASSETS / f'pawn-{name}.webp'
    Image.open(scene.render.filepath).save(path, 'WEBP', lossless=True, method=6)
    shutil.copyfile(path, ART / path.name)
    for child in parent.children:
        child.hide_render = True
for index, parent in enumerate(pawns):
    parent.location.x = (index-1.5)*1.3
    for child in parent.children:
        child.hide_render = False
bpy.ops.wm.save_as_mainfile(filepath=str(PREVIEW / 'board-pieces.blend'))
print(f'Wrote {model}')
