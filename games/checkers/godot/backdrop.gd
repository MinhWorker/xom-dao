class_name CheckersBackdrop
extends Control
## Behind the table: the fishing-village harbor at dusk (pier, basket boats, sand), shaded
## towards the edges so the board holds the eye, and the board's soft shadow on the water (light
## from the top left). `fit(area, board)` follows the board's box.

var _harbor := TextureRect.new()
var _shade := TextureRect.new()
var _shadow := Panel.new()


func _init() -> void:
	name = "Backdrop"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var night := ColorRect.new()
	night.color = Color("#0B2830")
	night.set_anchors_preset(Control.PRESET_FULL_RECT)
	night.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(night)
	_harbor.texture = preload("res://content/checkers/art/harbor.webp")
	_harbor.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_harbor.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_harbor.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# Dusk: the painting a little darker and cooler, so the board stands out.
	_harbor.modulate = Color(0.8, 0.82, 0.9)
	add_child(_harbor)
	_shade.name = "Shade"
	_shade.texture = _shade_texture()
	_shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_shade.stretch_mode = TextureRect.STRETCH_SCALE
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_shade)
	var shadow: StyleBoxFlat = XomDaoUi.box(Color(0.0, 0.0, 0.0, 0.45), Color.TRANSPARENT, 0, 18.0)
	shadow.shadow_color = Color(0.0, 0.05, 0.08, 0.55)
	shadow.shadow_size = 26
	shadow.shadow_offset = Vector2(10.0, 16.0)
	_shadow.add_theme_stylebox_override("panel", shadow)
	_shadow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_shadow)


## Fills `area` and puts the board's shadow under `board`.
func fit(area: Vector2, board: Rect2) -> void:
	position = Vector2.ZERO
	size = area
	_harbor.size = area
	_shade.size = area
	_shadow.position = board.position + Vector2.ONE * 8.0
	_shadow.size = board.size - Vector2.ONE * 16.0


static func _shade_texture() -> GradientTexture2D:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
	var night := Color("#061419")
	gradient.colors = PackedColorArray([Color(night, 0.1), Color(night, 0.3), Color(night, 0.72)])
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.05, 0.5)
	texture.width = 256
	texture.height = 256
	return texture
