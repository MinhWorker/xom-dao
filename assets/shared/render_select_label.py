"""Bake the one smooth, texture-free nameplate shared by every catalog island.

blender -b -t 4 --python assets/shared/render_select_label.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/blender"))
from xomdao_bake import cube, material, render, setup

setup((768, 192), 6.4, samples=24)
rim = material("Warm wood edge", (0.32, 0.15, 0.055), roughness=0.7, coat=0.03)
face = material("Smooth honey wood", (0.56, 0.29, 0.10), roughness=0.65, coat=0.03)
cube("Soft rounded rim", (6, 1.35, 0.20), (0, 0, 0), rim, bevel=0.16, segments=8)
cube("Clean face without grain", (5.78, 1.14, 0.10), (0, 0, 0.14), face, bevel=0.13, segments=8)
render("island-label", ROOT / "assets/app/images", ROOT / ".blender/select")
