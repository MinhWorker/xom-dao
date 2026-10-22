class_name XiangqiBackdrop
extends Control
## Behind the table: the night lotus pond, shaded towards the edges so the table holds the eye,
## and the table's soft shadow on the water (light from the top left). `fit(board)` follows the
## table's box.

var _pond := TextureRect.new()
var _shade := TextureRect.new()
var _shadow := Panel.new()


func _init() -> void:
	name = "Backdrop"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var night := ColorRect.new()
	night.color = Color("#1B1410")
	night.set_anchors_preset(Control.PRESET_FULL_RECT)
	night.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(night)
	_pond.texture = preload("res://content/xiangqi/art/pavilion.webp")
	_pond.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_pond.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_pond.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_pond)
	_shade.name = "Shade"
	_shade.texture = _shade_texture()
	_shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_shade.stretch_mode = TextureRect.STRETCH_SCALE
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_shade)
	var shadow: StyleBoxFlat = XomDaoUi.box(Color(0.0, 0.0, 0.0, 0.45), Color.TRANSPARENT, 0, 24.0)
	shadow.shadow_color = Color(0.0, 0.0, 0.0, 0.5)
	shadow.shadow_size = 28
	shadow.shadow_offset = Vector2(10.0, 16.0)
	_shadow.add_theme_stylebox_override("panel", shadow)
	_shadow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_shadow)


## Fills `area` and puts the table's shadow under `board`.
func fit(area: Vector2, board: Rect2) -> void:
	position = Vector2.ZERO
	size = area
	_pond.size = area
	_shade.size = area
	_shadow.position = board.position + Vector2.ONE * 6.0
	_shadow.size = board.size - Vector2.ONE * 12.0


static func _shade_texture() -> GradientTexture2D:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	var night := Color("#0E0907")
	gradient.colors = PackedColorArray([Color(night, 0.2), Color(night, 0.35), Color(night, 0.8)])
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.05, 0.5)
	texture.width = 256
	texture.height = 256
	return texture
