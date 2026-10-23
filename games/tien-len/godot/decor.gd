class_name TienLenDecor
extends Control
## Behind the table: the sedge mat of a Tết afternoon, a peach blossom branch leaning in from the
## top right corner (swaying a little) and a soft shade at the edges so the cards hold the eye.
## `skin()` is the table's HUD in the same materials: dark lacquered wood, brass and red paper.

const LACQUER := Color("#3A1F12")
const LACQUER_EDGE := Color("#C9953F")
const RED := Color("#A3271E")
const RED_DARK := Color("#6E1611")
const GOLD := Color("#E8B64C")
const CREAM := Color("#F7EBD3")
## How wide the branch lies at 1280 units across.
const BRANCH := 280.0

var _mat := XomDaoMat.new()
var _shade := TextureRect.new()
var _branch := TextureRect.new()


func _init() -> void:
	name = "Decor"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_mat)
	_shade.name = "Shade"
	_shade.texture = _shade_texture()
	_shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_shade.stretch_mode = TextureRect.STRETCH_SCALE
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_shade)
	_branch.name = "Blossom"
	_branch.texture = preload("res://content/tien-len/art/blossom.webp")
	_branch.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_branch.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	_branch.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_branch.modulate = Color(1.0, 1.0, 1.0, 0.96)
	add_child(_branch)
	resized.connect(_place)


func _ready() -> void:
	_place()
	# A slow sway from where the branch leaves the corner.
	var sway: Tween = _branch.create_tween().set_loops()
	sway.tween_property(_branch, "rotation_degrees", 1.6, 2.6).set_trans(Tween.TRANS_SINE)
	sway.tween_property(_branch, "rotation_degrees", -0.8, 2.6).set_trans(Tween.TRANS_SINE)


func _place() -> void:
	var texture: Texture2D = _branch.texture
	var width: float = BRANCH
	var height: float = width * texture.get_height() / texture.get_width()
	_branch.size = Vector2(width, height)
	_branch.position = Vector2(size.x - width + 18.0, -22.0)
	_branch.pivot_offset = Vector2(width - 24.0, 24.0)


## The table's HUD materials: name plates of dark lacquer with a brass edge, red paper chips,
## a brass turn timer, Đánh in red lacquer and Bỏ lượt in quiet wood.
static func skin() -> XomDaoTableSkin:
	var look := XomDaoTableSkin.new()
	look.plate = LACQUER
	look.edge = LACQUER_EDGE
	look.ink = CREAM
	look.radius = 10.0
	look.chip = RED
	look.chip_edge = GOLD
	look.chip_ink = CREAM
	look.timer = GOLD
	look.timer_track = Color(LACQUER, 0.55)
	look.primary = [RED, GOLD, CREAM]
	look.secondary = [Color("#5A3A22"), Color("#2E1A0E"), CREAM]
	look.round_button = [LACQUER, LACQUER_EDGE, CREAM]
	return look


static func _shade_texture() -> GradientTexture2D:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.6, 1.0])
	var dusk := Color("#3A1C0C")
	gradient.colors = PackedColorArray([Color(dusk, 0.0), Color(dusk, 0.12), Color(dusk, 0.45)])
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.05, 0.5)
	texture.width = 256
	texture.height = 256
	return texture
