class_name XomDaoLit
extends RefCounted
## Normal-mapped lighting for baked pieces: an even ambient plus one warm key light from the
## upper left, the light tools/blender/xomdao_bake renders with. A game's `art/<name>.webp`
## pairs with `art/<name>.normal.webp` (same canvas; see assets/AGENTS.md).
##
##   var lit := XomDaoLit.material()                  # one per table, shared by every piece
##   piece.texture = XomDaoLit.texture(diffuse, normal)
##   piece.material = lit
##
## It is a small unshaded canvas shader, not Light2D: one more texture read per pixel, the same on
## every renderer, and nothing else on the screen is touched. A flat normal (128, 128, 255) gets
## `ambient + energy × 0.81`; surfaces facing the light get up to `ambient + energy`, those facing
## away `ambient`. Modulate (fades, tints) still applies.

const SHADER := preload("res://addons/xomdao_sdk/lit.gdshader")
## Toward the key light, in normal-map space (+X right, +Y up, +Z toward the viewer).
const KEY := Vector3(-0.3, 0.4, 0.7)
const KEY_COLOR := Color("#FFF3DF")
const AMBIENT := 0.8
const ENERGY := 0.45


## The material that lights a piece. Raise `ambient` (and lower `energy`) for art whose sides
## face away from the light, so they keep their brightness.
static func material(
	ambient: float = AMBIENT, energy: float = ENERGY, key: Vector3 = KEY, color: Color = KEY_COLOR
) -> ShaderMaterial:
	var lit := ShaderMaterial.new()
	lit.shader = SHADER
	lit.set_shader_parameter("ambient", ambient)
	lit.set_shader_parameter("energy", energy)
	lit.set_shader_parameter("key", key)
	lit.set_shader_parameter("key_color", Vector3(color.r, color.g, color.b))
	return lit


## A picture with its normal map, for a TextureRect or Sprite2D that has `material()`.
static func texture(diffuse: Texture2D, normal: Texture2D) -> CanvasTexture:
	var both := CanvasTexture.new()
	both.diffuse_texture = diffuse
	both.normal_texture = normal
	return both
