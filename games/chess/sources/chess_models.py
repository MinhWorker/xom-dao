"""Shared stylized Staunton geometry used by the room render and sprite atlases."""
import math

import bpy

from xomdao_bake import cube, lathe, sphere


def cylinder(name, radius, depth, position, mat, vertices=48, bevel=0.02):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=position
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft edge", "BEVEL")
        modifier.width, modifier.segments = bevel, 3
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def cone(name, radius_bottom, radius_top, depth, position, mat, vertices=48):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
        location=position,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("Soft edge", "BEVEL")
    modifier.width, modifier.segments = 0.025, 3
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def make_piece(kind, x, y, z, piece_mat, brass):
    """Make one chess piece at its base origin; parent to an Empty to animate a topple."""
    profile = [
        (0.00, 0.27), (0.045, 0.34), (0.11, 0.35), (0.16, 0.30),
        (0.21, 0.23), (0.28, 0.19), (0.52, 0.16), (0.61, 0.20),
        (0.68, 0.27), (0.74, 0.23),
    ]
    lathe(f"{kind.title()} weighted base and stem", profile, piece_mat).location = (x, y, z)
    lathe("Fine brass base ring", [(0.10, 0.35), (0.125, 0.33)], brass).location = (x, y, z)
    if kind == "pawn":
        sphere("Pawn ball", (x, y, z + 0.97), (0.22, 0.22, 0.22), piece_mat, 32, 20)
    elif kind == "rook":
        cylinder("Rook tower", 0.25, 0.34, (x, y, z + 0.9), piece_mat)
        cylinder("Rook crown lip", 0.32, 0.12, (x, y, z + 1.13), brass)
        cylinder("Rook crown", 0.29, 0.22, (x, y, z + 1.26), piece_mat)
        for index in range(6):
            angle = math.tau * index / 6
            cube(
                "Rook crenel", (0.14, 0.15, 0.18),
                (x + 0.25 * math.cos(angle), y + 0.25 * math.sin(angle), z + 1.43),
                piece_mat, 0.025,
            )
    elif kind == "bishop":
        cylinder("Bishop collar", 0.29, 0.12, (x, y, z + 0.82), brass)
        cone("Bishop mitre", 0.29, 0.025, 0.7, (x, y, z + 1.2), piece_mat)
        sphere("Bishop finial", (x, y, z + 1.58), (0.08, 0.08, 0.1), brass, 20, 12)
        cut = cube("Bishop slit", (0.08, 0.62, 0.08), (x + 0.04, y - 0.02, z + 1.26), brass, 0.025)
        cut.rotation_euler.y = -0.52
    elif kind == "queen":
        cylinder("Queen crown band", 0.28, 0.13, (x, y, z + 0.86), brass)
        cone("Queen crown", 0.24, 0.16, 0.34, (x, y, z + 1.08), piece_mat)
        for index in range(7):
            angle = math.tau * index / 7
            sphere(
                "Queen crown pearl",
                (x + 0.25 * math.cos(angle), y + 0.25 * math.sin(angle), z + 1.31),
                (0.065, 0.065, 0.075), brass, 16, 10,
            )
        sphere("Queen finial", (x, y, z + 1.39), (0.1, 0.1, 0.12), piece_mat, 20, 12)
    elif kind == "king":
        cylinder("King crown band", 0.28, 0.15, (x, y, z + 0.88), brass)
        cone("King crown", 0.24, 0.11, 0.38, (x, y, z + 1.13), piece_mat)
        cube("King cross stem", (0.13, 0.14, 0.42), (x, y, z + 1.48), piece_mat, 0.025)
        cube("King cross arms", (0.39, 0.14, 0.12), (x, y, z + 1.52), piece_mat, 0.025)
    elif kind == "knight":
        sphere("Knight head", (x, y, z + 1.05), (0.2, 0.18, 0.34), piece_mat, 32, 20)
        sphere("Knight muzzle", (x + 0.19, y - 0.015, z + 0.88), (0.24, 0.14, 0.13), piece_mat, 24, 16)
        for dx in (-0.1, 0.08):
            ear = cone("Knight ear", 0.09, 0.015, 0.28, (x + dx, y, z + 1.35), piece_mat, 24)
            ear.rotation_euler.y = -0.18 if dx < 0 else 0.18
        sphere("Knight eye", (x + 0.23, y - 0.15, z + 1.07), (0.035, 0.025, 0.035), brass, 16, 10)
