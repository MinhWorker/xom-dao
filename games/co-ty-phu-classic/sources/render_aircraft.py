"""Author a small ivory/teal transport plane, nose along Blender +Y (Godot -Z)."""
from pathlib import Path
import shutil
import sys
import bpy

requested = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if requested and 'aircraft' not in requested:
    raise SystemExit(0)
root = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = .3
    return mat


ivory = material('Ivory enamel', (.92, .84, .63))
teal = material('Deep teal wings', (.015, .14, .17))
gold = material('Brass trim', (.65, .40, .10), .55)
glass = material('Cockpit glass', (.025, .07, .11), .25)


def ellipsoid(name, at, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


ellipsoid('Fuselage', (0, 0, 0), (.10, .43, .10), ivory)
ellipsoid('Cockpit', (0, .25, .073), (.075, .12, .048), glass)
ellipsoid('Main wings', (0, .015, -.015), (.52, .095, .023), teal)
ellipsoid('Tail wings', (0, -.32, .025), (.20, .055, .016), teal)
ellipsoid('Tail fin', (0, -.32, .09), (.017, .075, .12), teal)
for x in (-.22, .22):
    ellipsoid('Engine', (x, .055, -.055), (.045, .115, .045), ivory)
    ellipsoid('Engine brass nose', (x, .155, -.055), (.043, .015, .043), gold)
    ellipsoid('Wingtip', (x*2.25, .015, -.015), (.025, .082, .025), gold)
for y in (-.16, -.06, .04, .14):
    for x in (-.096, .096):
        ellipsoid('Cabin window', (x, y, .025), (.008, .019, .021), glass)
preview = root.parents[1] / '.blender' / 'aircraft'
preview.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(preview / 'aircraft.blend'))
output = root / 'assets' / 'aircraft.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_yup=True)
shutil.copyfile(output, root / 'godot' / 'art' / output.name)
