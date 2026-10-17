"""Standalone Blender study for the lobby's card island; leaves production assets untouched.

blender -b --python assets/sources/previews/bai_diorama.py -- --still
blender -b --python assets/sources/previews/bai_diorama.py -- --frames 32 --size 720 --samples 24
Outputs and an editable, animated .blend live in .blender/bai-diorama/.
"""
import argparse
import importlib.util
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('island_helpers', ROOT / 'assets/sources/render_islands.py')
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
sys.path.insert(0, str(ROOT / 'tools/blender'))
from xomdao_bake import wood

TAU = math.tau
rng = random.Random(207)
OUT = ROOT / '.blender/bai-diorama'
MOVERS = []


def material(name, color, roughness=.65, metal=0, emission=0):
    m = h.mat(color, roughness, emission)
    m.name = name
    m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = metal
    return m


def curve(name, points, radius, mat, parent=None):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = radius
    data.bevel_resolution = 2
    data.use_fill_caps = True
    spline = data.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, xyz in zip(spline.points, points):
        p.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def ico(name, pos, scale, mat, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Worn edges', 'BEVEL')
    bevel.width, bevel.segments = .045, 2
    obj.modifiers.new('Rock normals', 'WEIGHTED_NORMAL')
    return obj


def leaf(name, pos, length, width, angle, mat, parent=None, droop=0):
    # A folded, tapered blade with a raised central vein.
    verts = []
    for j in range(7):
        t = j / 6
        w = width * math.sin(math.pi * t) ** .8
        z = .14 * length * math.sin(math.pi * t) - droop * t * t
        verts.extend([(length*t, -w, z-.05*length), (length*t, 0, z), (length*t, w, z-.05*length)])
    faces = []
    for j in range(6):
        for k in range(2):
            a = j*3+k
            faces.append((a, a+3, a+4, a+1))
    obj = h.mesh(name, verts, faces, mat, True, parent, pos)
    obj.rotation_euler.z = angle
    return obj


def animate_sway(obj, amount, phase=0, axis=1):
    rest = obj.rotation_euler[axis]
    for frame in range(1, 66, 4):
        obj.rotation_euler[axis] = rest + amount * math.sin(TAU*(frame-1)/64+phase)
        obj.keyframe_insert('rotation_euler', index=axis, frame=frame)
    obj.rotation_euler[axis] = rest


def cylinder(name, pos, r, depth, mat, n=48):
    return h.cylinder(name, pos, r, depth, mat, n)


def suit(name, kind, cx, cz, size, mat, parent, y=-.09):
    if kind == 'heart' or kind == 'spade':
        pts = []
        for i in range(64):
            t = TAU*i/64
            x = 16*math.sin(t)**3/18
            z = (13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))/18
            if kind == 'spade':
                z = -z
            pts.append((cx+size*x, y, cz+size*z))
        h.mesh(name, pts, [tuple(range(64))], mat, False, parent)
        if kind == 'spade':
            h.mesh(name+' stem', [(cx-size*.24,y,cz-size*.9),(cx+size*.24,y,cz-size*.9),
                                  (cx,y,cz-size*.15)], [(0,1,2)], mat, False, parent)
    else:
        h.mesh(name, [(cx,y,cz+size),(cx+size*.64,y,cz),(cx,y,cz-size),(cx-size*.64,y,cz)],
               [(0,1,2,3)], mat, False, parent)


def card(pos, fan, kind, size, materials):
    root = h.pivot('Card '+kind, pos)
    root.rotation_euler = (math.radians(-7), math.radians(fan), math.radians(-6))
    w, ht = size
    h.box('Brass card rim', (w,.105,ht), (0,0,ht/2), materials['gold'], .10, parent=root)
    h.box('Ivory face', (w-.075,.035,ht-.075), (0,-.062,ht/2), materials['paper'], .08, parent=root)
    ink = materials['red'] if kind != 'spade' else materials['ink']
    suit('Large '+kind,kind,0,ht*.53,w*.32,ink,root)
    suit('Corner '+kind,kind,-w*.31,ht*.87,w*.085,ink,root)
    suit('Bottom '+kind,kind,w*.31,ht*.13,w*.085,ink,root)
    return root


def build():
    h.reset()
    scene = bpy.context.scene
    scene.render.use_persistent_data = True
    scene.cycles.max_bounces = 5
    scene.cycles.diffuse_bounces = 3
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 6
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45
    bpy.data.objects.remove(bpy.data.objects['Sun'], do_unlink=True)
    for name, pos, energy, size, tint in [
        ('Warm key',(-4,-6,10),1100,5,(1,.88,.69)),
        ('Sky fill',(5,-1,6),480,5,(.69,.86,1)),
        ('Canopy rim',(1,5,7),700,4,(1,.91,.65))]:
        data = bpy.data.lights.new(name,'AREA')
        data.energy, data.shape, data.size, data.color = energy,'DISK',size,tint
        obj = bpy.data.objects.new(name,data)
        scene.collection.objects.link(obj)
        obj.location = pos
        obj.rotation_euler = (-obj.location).to_track_quat('-Z','Y').to_euler()
    mats = {
        'gold': material('Warm brass','#DDAA45',.29,.55),
        'paper': material('Warm ivory','#FFF1CE',.42),
        'red': material('Vermilion lacquer','#C83E2B',.32),
        'ink': material('Blue black','#263C49',.4),
        'grass': material('Moss carpet','#6C9B36'),
        'soil': material('Ochre soil','#886139'),
        'sand': material('Paving limestone','#D9C5A0'),
        'lightstone': material('Paving highlights','#F3DEB9'),
        'darkstone': material('Paving joints','#8C8A73'),
        'blue': material('Banner indigo','#176087'),
        'water': material('Turquoise stream','#26B8C8',.23, .15),
        'foam': material('Water glints','#D8FFFF',.3,emission=.25),
        'trunk': wood('Honey timber',h.rgb('#5F351C'),h.rgb('#BA7E39')),
        'cloth': material('Terracotta fabric','#BB422C',.85),
        'glow': material('Lantern amber','#FFD56B',.35,emission=2),
    }
    leaves = [material('Foliage '+str(i),c) for i,c in enumerate(['#477B2D','#5A942F','#7EAF37','#A6C84B','#698F30'])]
    stones = [material('Cliff '+str(i),c) for i,c in enumerate(['#8C8272','#A69B83','#777A70','#B7AC94','#95927D'])]
    # An asymmetric cap with broken, independently modeled cliff slabs.
    coast = lambda t: 1+.055*math.sin(t*5+.8)+.04*math.sin(t*3)
    h.lathe('Earth under turf',[(.04,0),(.04,2.88),(-.24,2.92),(-.52,2.65)],mats['soil'],64,wobble=coast)
    h.lathe('Mossy island crown',[(.12,0),(.12,2.78),(.06,2.94),(-.09,2.94),(-.17,2.8)],mats['grass'],64,wobble=coast)
    h.lathe('Rock heart',[(-.3,2.65),(-1.1,2.4),(-2,1.75),(-2.85,.9),(-3.35,.10)],stones[0],15,jitter=.14,smooth=False,seed=22)
    for ring in range(3):
        for i in range(13-ring*3):
            a=TAU*i/(13-ring*3)+ring*.35
            r=2.55-ring*.56
            p=(math.cos(a)*r,math.sin(a)*r,-.55-ring*.87+rng.uniform(-.13,.13))
            obj=ico('Split limestone slab',p,(rng.uniform(.40,.68),rng.uniform(.36,.58),rng.uniform(.55,.91)),rng.choice(stones))
            obj.rotation_euler=(rng.uniform(-.4,.4),rng.uniform(-.4,.4),a)
    # Trailing vines, individual leaves and grass around the coast.
    for i in range(30):
        a=TAU*i/30+.05
        r=2.88
        x,y=r*math.cos(a),r*math.sin(a)
        if x < -1.2 and y < -.6:
            continue
        length=rng.uniform(.35,1.7)
        pts=[(x*(1-.12*t),y*(1-.12*t),-.02-length*t) for t in [j/14 for j in range(15)]]
        curve('Hanging vine',pts,.015,leaves[0])
        for j in range(int(length*8)):
            t=(j+1)/(int(length*8)+1)
            p=(x*(1-.12*t),y*(1-.12*t),-.02-length*t)
            leaf('Vine leaf',p,.18,.065,a+(-.9 if j%2 else .9),rng.choice(leaves),droop=.11)
    # Circular plaza with individually fitted stone sectors, inset medallion and front steps.
    cylinder('Plaza foundation',(.35,-.06,.10),1.55,.18,mats['darkstone'])
    for band, (inner,outer) in enumerate([(.0,.85),(.88,1.17),(1.20,1.52)]):
        n=16 if band else 12
        for i in range(n):
            a,b=TAU*i/n+.012,TAU*(i+1)/n-.012
            verts=[]
            for z in [.28,.36]:
                for r in [inner,outer]:
                    for j in range(5):
                        t=a+(b-a)*j/4
                        verts.append((.35+r*math.cos(t),-.06+r*math.sin(t),z))
            faces=[tuple(range(10,15))+tuple(reversed(range(15,20))),tuple(range(5))+tuple(reversed(range(5,10)))]
            faces += [(j,j+1,j+11,j+10) for j in range(4)]
            faces += [(j+5,j+15,j+16,j+6) for j in range(4)]
            faces += [(0,10,15,5),(4,9,19,14)]
            obj=h.mesh('Radial paving',verts,faces,mats['sand'] if (i+band)%3 else mats['lightstone'],False)
            mod=obj.modifiers.new('Stone edge','BEVEL');mod.width=.018;mod.segments=2
    for i in range(3):
        h.box('Broad approach step',(1.3+i*.14,.38,.13),(.35,-1.35-i*.25,.24-i*.075),mats['lightstone'],.045)
    cylinder('Card plinth foot',(.35,.10,.37),.87,.13,mats['gold'])
    cylinder('Lacquer plinth',(.35,.10,.50),.75,.28,mats['blue'])
    cylinder('Plinth crown',(.35,.10,.78),.89,.10,mats['gold'])
    for i in range(16):
        a=TAU*i/16
        ico('Brass plinth bead',(.35+.76*math.cos(a),.10+.76*math.sin(a),.64),(.045,.045,.085),mats['gold'])
    card((-.02,.21,.82),-19,'spade',(1.0,1.67),mats)
    card((.70,.29,.82),19,'diamond',(1.0,1.67),mats)
    card((.33,-.05,.84),-3,'heart',(1.12,1.98),mats)
    # A gem at the front of the pedestal.
    gem=ico('Turquoise seal',(.35,-.70,.63),(.22,.12,.27),mats['gold'])
    ico('Gem inset',(.35,-.81,.64),(.13,.055,.18),mats['water'])
    # Red festival canopy, with actual waving mesh shape keys and brass scalloped hems.
    for x in [-1.45,1.88]:
        for y in [1.22,2.02]:
            cylinder('Canopy stone shoe',(x,y,.1),.15,.18,mats['sand'],16)
            cylinder('Bamboo canopy mast',(x,y,.25),.065,2.15,mats['trunk'],16)
            for z in [.45,1.15,2.15]:
                cylinder('Brass mast binding',(x,y,z),.077,.045,mats['gold'],16)
            ico('Mast finial',(x,y,2.48),(.10,.10,.18),mats['gold'])
    cylinder('Canopy ridge mast',(.21,1.99,.25),.055,2.86,mats['trunk'],16)
    curve('Canopy ridge beam',[(.21,1.08,3.08),(.21,2.20,3.08)],.045,mats['trunk'])
    verts,faces=[],[]
    for j in range(9):
        v=j/8
        for i in range(33):
            u=i/32
            x=-1.52+3.47*u
            z=2.43+.60*(1-abs(2*u-1))-.21*math.sin(math.pi*u*2)**2 + .05*math.cos(v*TAU)
            verts.append((x,1.13+v*1.03,z))
    for j in range(8):
        for i in range(32):
            a=j*33+i;faces.append((a,a+1,a+34,a+33))
    canopy=h.mesh('Festival canopy',verts,faces,mats['cloth'])
    canopy.shape_key_add(name='Basis')
    wave=canopy.shape_key_add(name='Breeze')
    for p in wave.data:
        p.co.z += .07*math.sin(p.co.x*4)*math.sin((p.co.y-1.13)/1.03*math.pi)
    for f,v in [(1,0),(17,1),(33,0),(49,-1),(65,0)]:
        wave.value=v;wave.keyframe_insert('value',frame=f)
    solid=canopy.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.022
    for j in [0,8]:
        points=[verts[j*33+i] for i in range(33)]
        curve('Golden canopy hem',points,.027,mats['gold'])
    # Banner at left; animated cloth uses the existing project's banner geometry.
    banner_move=h.banner('Indigo pennant',(-2.18,.85,.10),'#176087',rotation=180)
    # Face the pennant toward the camera rather than let it hide behind the trees.
    root=bpy.data.objects['Indigo pennant'];root.rotation_euler.z=0
    MOVERS.append(banner_move)
    # Hero tree behind the left shoulder, a branching silhouette with hundreds of folded leaves.
    tree=h.pivot('Breeze tree',(-1.62,1.65,.1))
    tree.scale=(.85,.85,.88)
    curve('Tree trunk',[(0,0,0),(-.10,0,.5),(.02,.02,1.15),(-.16,0,1.8),(-.05,.1,2.7)],.14,mats['trunk'],tree)
    for k in range(8):
        a=TAU*k/8
        center=Vector((math.cos(a)*.67,math.sin(a)*.53,2.55+rng.uniform(-.1,.5)))
        curve('Tree branch',[(0,0,1.1),tuple(center*.7),tuple(center)],.055,mats['trunk'],tree)
        h.ball('Canopy shadow',center,.49,leaves[k%3],(1.2,1, .75),tree,segments=12)
        for j in range(32):
            az=rng.uniform(0,TAU); radial=rng.uniform(.15,.50)
            p=center+Vector((radial*math.cos(az),radial*math.sin(az),rng.uniform(-.06,.32)))
            leaf('Tree leaf',p,rng.uniform(.20,.34),rng.uniform(.07,.12),az,rng.choice(leaves[1:]),tree,droop=.06)
    animate_sway(tree,.022,.4)
    # Curved palm and serrated compound fronds on the opposite coast.
    palm=h.pivot('Swaying palm',(2.20,.68,.1))
    curve('Palm trunk',[(0,0,0),(.09,.02,.6),(.24,.04,1.3),(.38,.06,1.95),(.43,.06,2.3)],.11,mats['trunk'],palm)
    for j in range(13):
        z=.16+j*.16
        ring=h.cylinder('Palm scar',(z*.19,0,z),.118,.025,mats['soil'],12,palm)
    for k in range(8):
        a=TAU*k/8
        tip=Vector((.43,.06,2.3))
        pts=[]
        for j in range(11):
            t=j/10
            p=tip+Vector((math.cos(a)*t*1.18,math.sin(a)*t*1.18,.42*math.sin(math.pi*t)-.3*t*t))
            pts.append(tuple(p))
            if 0<j<10:
                for side in [-1,1]:
                    leaf('Palm leaflet',p,.38*(1-t*.55),.065,a+side*1.1,rng.choice(leaves[1:4]),palm,droop=.18)
        curve('Palm rib',pts,.022,leaves[1],palm)
    animate_sway(palm,.025,1.4)
    # Curved pool leads to two turbulent falls instead of a flat striped ribbon.
    h.ball('Spring pool',(-1.80,-.42,.14),1,mats['water'],(.70,.75,.055),segments=48)
    stream_verts,stream_faces=[],[]
    for j in range(33):
        t=j/32
        cx,cy=-1.8-.24*t-.10*math.sin(t*math.pi),-.40-1.64*t
        for i in range(9):
            side=(i/8-.5)*.56
            stream_verts.append((cx+side,cy-.18*side,.155+.006*math.sin(t*25+i)))
    for j in range(32):
        for i in range(8):
            a=j*9+i;stream_faces.append((a,a+1,a+10,a+9))
    h.mesh('Stream surface',stream_verts,stream_faces,mats['water'])
    for i in range(17):
        a=TAU*i/17
        if math.sin(a)<-.3:
            continue
        ico('Spring boulder',(-1.80+.73*math.cos(a),-.42+.73*math.sin(a),.15),(.27,.21,.19),rng.choice(stones))
    for i in range(7):
        t=i/7
        cx,cy=-1.8-.24*t-.10*math.sin(t*math.pi),-.40-1.64*t
        for side in [-1,1]:
            ico('Stream bank pebble',(cx+side*.31,cy,.14),(.13,.16,.12),rng.choice(stones))
    def fall_point(u,t,front=0):
        side=(u-.5)*.56
        outward=.10*math.sin(min(t*8,math.pi/2))+.09*t+front
        return (-2.04+side*.707-outward*.707,
                -2.04-side*.707-outward*.707,
                .155-3.20*t)
    curtain_verts,curtain_faces=[],[]
    for j in range(41):
        t=j/40
        for i in range(17):
            u=i/16
            p=Vector(fall_point(u,t))
            p.x+=.012*math.sin(t*15+u*8)
            curtain_verts.append(p)
    for j in range(40):
        for i in range(16):
            a=j*17+i;curtain_faces.append((a,a+1,a+18,a+17))
    h.mesh('Continuous waterfall curtain',curtain_verts,curtain_faces,mats['water'])
    for i in range(14):
        h.ball('Spring edge froth',fall_point(i/13,.015),rng.uniform(.025,.055),mats['foam'],(1,1,.45),segments=8)
    for i in range(13):
        pts=[fall_point(i/12,j/34,.008) for j in range(35)]
        curve('White water filament',pts,.008 if i%3 else .014,mats['foam'])
    for i in range(34):
        phase=rng.random();u=rng.random()
        obj=h.ball('Falling water bead',fall_point(u,phase,.025),rng.uniform(.018,.035),mats['foam'],(.7,.7,2.2),segments=8)
        MOVERS.append(lambda t,obj=obj,u=u,phase=phase: setattr(obj,'location',fall_point(u,(t*2+phase)%1,.025)))
    for i in range(18):
        p=Vector(fall_point(rng.random(),rng.uniform(.94,1.01)))
        p.x+=rng.uniform(-.10,.10);p.y+=rng.uniform(-.10,.10)
        obj=h.ball('Soft waterfall spray',p,rng.uniform(.06,.13),mats['foam'],(1,.7,.7),segments=12)
        animate_sway(obj,.1,i)
    # Path, low timber fence and warm lanterns.
    for j in range(4):
        for k in range(2):
            h.box('Approach flagstone',(.44,.36,.06),(.12+k*.48+j*.09,-1.97-j*.25,.15),mats['sand'] if (j+k)%2 else mats['lightstone'],.07,rotation=(0,0,rng.uniform(-.12,.12)))
    for side in [-1,1]:
        xs=[-.55,-.93,-1.30] if side<0 else [1.28,1.70,2.08]
        for i,x in enumerate(xs):
            y=-2.30+.14*i
            h.box('Fence post',(.12,.12,.52),(x,y,.36),mats['trunk'],.025)
            ico('Fence cap',(x,y,.65),(.105,.105,.09),mats['trunk'])
            if i:
                for z in [.30,.48]:
                    curve('Fence rail',[(xs[i-1],-2.30+.14*(i-1),z),(x,y,z)],.036,mats['trunk'])
    for x,y in [(-.85,-1.12),(1.60,-.82),(1.60,1.25)]:
        h.box('Lantern stone pedestal',(.28,.28,.45),(x,y,.33),mats['sand'],.035)
        h.box('Lantern brass foot',(.29,.29,.07),(x,y,.59),mats['gold'],.025)
        h.box('Lantern luminous paper',(.18,.18,.26),(x,y,.76),mats['glow'],.025)
        for dx in [-.11,.11]:
            for dy in [-.11,.11]:
                h.box('Lantern corner',(.025,.025,.30),(x+dx,y+dy,.76),mats['gold'],.008)
        ico('Lantern roof',(x,y,.97),(.22,.22,.12),mats['gold'])
    # Low foliage clumps, grass blades and daisies, distributed away from the focal plaza.
    for i in range(85):
        x,y=rng.uniform(-2.7,2.7),rng.uniform(-2.5,2.6)
        if x*x+y*y>7.5 or (x-.35)**2+(y+.06)**2<2.65 or (x<-1.2 and y<.2):
            continue
        for j in range(5):
            a=rng.uniform(0,TAU)
            leaf('Ground fern',(x,y,.13),rng.uniform(.20,.42),.07,a,rng.choice(leaves),droop=-.10)
        if i%3==0:
            for j in range(3):
                px=x+rng.uniform(-.15,.15);py=y+rng.uniform(-.15,.15)
                z=rng.uniform(.24,.35)
                curve('Flower stem',[(px,py,.13),(px,py,z)],.008,leaves[0])
                for k in range(5):
                    a=TAU*k/5
                    h.ball('Daisy petal',(px+.045*math.cos(a),py+.045*math.sin(a),z),.038,mats['paper'],(1,.65,.4),segments=8)
                h.ball('Daisy pollen',(px,py,z+.007),.025,mats['gold'],segments=8)
    for i in range(24):
        a=TAU*i/24
        x,y=2.75*math.cos(a),2.75*math.sin(a)
        if x < -1.3 and y < -.5:
            continue
        for j in range(3):
            p=(x+rng.uniform(-.13,.13),y+rng.uniform(-.13,.13),.15+rng.uniform(0,.1))
            h.ball('Coastal shrub',p,rng.uniform(.12,.22),rng.choice(leaves[:3]),(1,1,.7),segments=12)
            for k in range(3):
                leaf('Shrub leaf',(p[0],p[1],p[2]+.12),.21,.08,rng.uniform(0,TAU),rng.choice(leaves[1:4]))
    for i in range(6):
        a=rng.uniform(0,TAU)
        ico('Floating rock fragment',(math.cos(a)*rng.uniform(2.8,3.2),math.sin(a)*2,-1.4-rng.random()*2),(.14,.14,.25),rng.choice(stones))
    camera=scene.camera
    camera.data.ortho_scale=9.15
    target=Vector((0,0,-.18))
    camera.location=(4.5,-15,10)
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.lens=50
    scene.render.film_transparent=True
    scene.frame_start=1;scene.frame_end=64;scene.render.fps=16
    # Bake callable movements into actual mesh shape keys/object keyframes for the saved file.
    banner=bpy.data.objects['Indigo pennant cloth']
    banner.shape_key_add(name='Basis')
    banner_keys=[]
    for f in range(17):
        MOVERS[0](f/16)
        key=banner.shape_key_add(name=f'Wind {f:02}')
        for dst,src in zip(key.data,banner.data.vertices):
            dst.co=src.co
        for frame,value in [(1,0),(max(1,1+(f-1)*4),0),(1+f*4,1),(min(65,1+(f+1)*4),0),(65,1 if f==16 else 0)]:
            key.value=value;key.keyframe_insert('value',frame=frame)
        key.value=0
        banner_keys.append(key)
    for f in range(1,66):
        for move in MOVERS[1:]:
            move((f-1)/64)
        for obj in bpy.data.objects:
            if obj.name.startswith('Falling water bead'):
                obj.keyframe_insert('location',frame=f)
    floating=h.pivot('Floating island',(0,0,0))
    for obj in list(scene.objects):
        if obj != floating and obj.parent is None and obj.type not in {'LIGHT','CAMERA'}:
            obj.parent=floating
    for frame,z in [(1,0),(17,.065),(33,0),(49,-.065),(65,0)]:
        floating.location.z=z
        floating.keyframe_insert('location',index=2,frame=frame)
    scene.frame_set(1)
    return scene



def prepare_view():
    """Keep the standalone file convenient to inspect without starting a render."""
    for mat in bpy.data.materials:
        if mat.use_nodes:
            shader=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if shader:
                mat.diffuse_color=shader.inputs['Base Color'].default_value
        if mat.name.startswith('Indigo pennant cloth'):
            mat.diffuse_color=(*h.rgb('#176087'),1)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active
                space.shading.type='SOLID'
                space.shading.color_type='MATERIAL'
                space.shading.show_shadows=True
                space.shading.show_cavity=True
                space.overlay.show_overlays=False
                space.region_3d.view_perspective='CAMERA'
    bpy.context.scene.frame_set(1)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--still',action='store_true')
    parser.add_argument('--frames',type=int,default=32)
    parser.add_argument('--size',type=int,default=720)
    parser.add_argument('--samples',type=int,default=24)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    OUT.mkdir(parents=True,exist_ok=True)
    scene=build()
    scene.render.resolution_x=scene.render.resolution_y=args.size
    scene.cycles.samples=args.samples
    prepare_view()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bai-diorama.blend'))
    frames=[1] if args.still else [1+round(i*64/args.frames) for i in range(args.frames)]
    for i,frame in enumerate(frames):
        scene.frame_set(frame)
        scene.render.filepath=str(OUT/('still.png' if args.still else f'frame-{i:03}.png'))
        bpy.ops.render.render(write_still=True)
        print(f'PREVIEW {i+1}/{len(frames)}',flush=True)


if __name__=='__main__':
    main()
