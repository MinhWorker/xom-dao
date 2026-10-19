"""Render consistent Staunton sprites and an exact 8x8 board with Blender.

Run: npm run blender -- chess [board piece-white-knight]
PNG intermediates stay in .blender/chess. Transparent sprites share a 384px canvas and anchor.
"""
from pathlib import Path
import shutil
import sys
import bpy
from functools import partial

# Shared helpers resolve identically in Blender and Python with the bpy wheel.
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "blender"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from xomdao_bake import LEGACY_RIG, material, wood, cube, setup, cloth_tile, atlas, render as bake
from chess_models import make_piece

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / '.blender' / 'chess'
OUT.mkdir(parents=True, exist_ok=True)
SELECTED = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
render = partial(bake, assets=ROOT / "assets", out=OUT, selected=SELECTED)

CHESS_LIGHTS = (((-3, 4, 7), 620, 4), ((4, -2, 5), 210, 5))
CHESS_WORLD = ((0.32, 0.27, 0.22), 0.35)
BOARD_CAMERA = (0, -15, 29.8)
BOARD_TARGET = (0, 0, 0.1)
PIECE_CAMERA = (0, -15, 30.3)
PIECE_TARGET = (0, 0, 0.6)
BOARD_LENS = 100
PIECE_LENS = 500


def chess_setup(size, scale, target, camera, perspective=False, lens=BOARD_LENS):
    """Use one 3/4 view and warm/cool key-and-fill lighting for board and pieces."""
    setup(size, scale, target=target, camera=camera, lights=CHESS_LIGHTS, world=CHESS_WORLD)
    bpy.context.scene.cycles.use_denoising = True
    if perspective:
        view = bpy.context.scene.camera.data
        view.type = 'PERSP'
        view.lens = lens
        view.sensor_width = 36
        view.sensor_fit = 'HORIZONTAL'
    lights = [obj for obj in bpy.context.scene.objects if obj.type == 'LIGHT']
    if len(lights) >= 2:
        lights[0].data.color = (1.0, 0.75, 0.48)
        lights[1].data.color = (0.55, 0.68, 1.0)


def copy_to_godot(names):
    for name in names:
        source = ROOT / 'assets' / f'{name}.webp'
        target = ROOT / 'godot' / 'art' / f'{name}.webp'
        if source.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)


def piece(kind, mat, trim):
    """Keep the still atlas identical to the models used by the room and position atlases."""
    return make_piece(kind, 0, 0, 0, mat, trim)


if not SELECTED or 'board' in SELECTED:
    chess_setup((1800, 1600), 10.65, BOARD_TARGET, BOARD_CAMERA, perspective=True)
    rim = wood('Walnut rim', (0.07, 0.024, 0.009), (0.20, 0.075, 0.023))
    gold = material('Thin brass inlay', (0.55, 0.31, 0.07), 0.36)
    light = wood('Maple squares', (0.56, 0.38, 0.18), (0.73, 0.55, 0.29))
    dark = wood('Walnut squares', (0.10, 0.032, 0.011), (0.19, 0.077, 0.03))
    cube('Carved walnut board', (10, 10, 0.24), (0, 0, 0), rim, 0.09)
    cube('Hairline brass inlay', (9.55, 9.55, 0.02), (0, 0, 0.13), gold, 0.016)
    # The playable area is exactly 94% of the image, matching ChessView's 3% inset.
    cell = 9.4 / 8
    for row in range(8):
        for col in range(8):
            cube(f'Square {row}:{col}', (cell, cell, 0.035),
                 (-4.7 + (col + 0.5) * cell, 4.7 - (row + 0.5) * cell, 0.16),
                 light if (row + col) % 2 == 0 else dark, 0)
    render('board')

KINDS = ('king', 'queen', 'rook', 'bishop', 'knight', 'pawn')
FRAMES = [f'piece-{side}-{kind}' for side in ('white', 'black') for kind in KINDS]
render_pieces = not SELECTED or 'pieces' in SELECTED or any(name in FRAMES for name in SELECTED)
for side, color in [('white', (0.82, 0.76, 0.61)), ('black', (0.045, 0.05, 0.062))]:
    for kind in KINDS:
        name = f'piece-{side}-{kind}'
        if not render_pieces:
            continue
        if SELECTED and 'pieces' not in SELECTED and name not in SELECTED and all(
                (OUT / f'{name}{suffix}.png').exists() for suffix in ('', '.normal')):
            continue
        chess_setup((384, 384), 2.3, PIECE_TARGET, PIECE_CAMERA, perspective=True, lens=PIECE_LENS)
        mat = material(f'{side} satin stone', color)
        trim = material('Subtle warm base inlay', (0.35, 0.20, 0.06), 0.36)
        piece(kind, mat, trim)
        bake(name, ROOT / 'assets', OUT, normal=True)

if render_pieces:
    atlas('pieces', FRAMES, ROOT / 'assets', OUT)

copy_to_godot(['board'] if not SELECTED else [name for name in SELECTED if name == 'board'])

if not SELECTED or 'cloth' in SELECTED:
    cloth_tile("cloth", ROOT / "assets", OUT, (0.026, 0.042, 0.056))

# Shallow lacquer/ivory faces with a fine brass inset, sized for nine-slice UI.
for name, color in [('button', (0.014, 0.045, 0.075)),
                    ('button-secondary', (0.77, 0.65, 0.45))]:
    if SELECTED and name not in SELECTED:
        continue
    setup((640, 200), 4.16, lights=LEGACY_RIG)
    brass = material('Satin brass button edge', (0.52, 0.30, 0.085), 0.58)
    face = material('Lacquer' if name == 'button' else 'Ivory', color, 0.68)
    face.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value = 0.06
    cube('Button body', (3.96, 1.13, 0.10), (0, 0, 0), brass, 0.09)
    cube('Inset button face', (3.88, 1.05, 0.035), (0, 0, 0.065), face, 0.075)
    render(name)
