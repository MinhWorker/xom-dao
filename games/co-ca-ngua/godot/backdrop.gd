extends Control
## Behind the table: the stilt house's veranda deck in the afternoon (sources/render_table.py),
## shaded towards the edges so the board holds the eye and the HUD reads on it, and the board's
## soft shadow on the planks (light from the top left). `fit(area, board)` follows the board.

var _deck := TextureRect.new()
var _shade := TextureRect.new()
var _shadow := Panel.new()


func _init() -> void:
	name = "Backdrop"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var under := ColorRect.new()
	under.color = Color("#2A170C")
	under.set_anchors_preset(Control.PRESET_FULL_RECT)
	under.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(under)
	_deck.texture = load("res://content/co-ca-ngua/art/veranda.webp")
	_deck.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_deck.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_deck.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_deck)
	_shade.name = "Shade"
	_shade.texture = _shade_texture()
	_shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_shade.stretch_mode = TextureRect.STRETCH_SCALE
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_shade)
	var shadow: StyleBoxFlat = XomDaoUi.box(Color(0.1, 0.05, 0.02, 0.5), Color.TRANSPARENT, 0, 20.0)
	shadow.shadow_color = Color(0.1, 0.05, 0.02, 0.45)
	shadow.shadow_size = 26
	shadow.shadow_offset = Vector2(10.0, 16.0)
	_shadow.add_theme_stylebox_override("panel", shadow)
	_shadow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_shadow)


## Fills `area` and puts the board's shadow under `board`.
func fit(area: Vector2, board: Rect2) -> void:
	position = Vector2.ZERO
	size = area
	_deck.size = area
	_shade.size = area
	_shadow.position = board.position + Vector2.ONE * 8.0
	_shadow.size = board.size - Vector2.ONE * 16.0


static func _shade_texture() -> GradientTexture2D:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
	var dusk := Color("#160B05")
	gradient.colors = PackedColorArray([Color(dusk, 0.05), Color(dusk, 0.3), Color(dusk, 0.78)])
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.05, 0.5)
	texture.width = 256
	texture.height = 256
	return texture
