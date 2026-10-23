class_name BaiCaoBackdrop
extends Control
## Behind the table: a low walnut table at night under an oil lamp (top right, so the ☰ keeps
## its corner), its warm pool of light breathing a little, the edges falling into the dark.
## `skin()` is the table's HUD in the same materials: walnut plates with brass edges, clay red
## for the main action.

const WALNUT := Color("#2E1B10")
const WALNUT_LIGHT := Color("#5A3820")
const BRASS := Color("#C99A4A")
const AMBER := Color("#FFC870")
const CLAY := Color("#A8432A")
const CREAM := Color("#F6E6C6")
## Where the lamp's flame sits on the (mirrored) painting, as a share of its size.
const FLAME := Vector2(0.955, 0.075)

var _table := TextureRect.new()
var _glow := TextureRect.new()
var _shade := TextureRect.new()


func _init() -> void:
	name = "Backdrop"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var night := ColorRect.new()
	night.color = Color("#140B06")
	night.set_anchors_preset(Control.PRESET_FULL_RECT)
	night.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(night)
	_table.texture = preload("res://content/bai-cao/art/lamplight.webp")
	_table.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_table.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_table.flip_h = true
	_table.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_table.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_table)
	_glow.name = "LampGlow"
	_glow.texture = _radial([Color(AMBER, 0.32), Color(AMBER, 0.0)], [0.0, 1.0])
	_glow.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var add := CanvasItemMaterial.new()
	add.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_glow.material = add
	add_child(_glow)
	_shade.name = "Shade"
	var dark := Color("#0C0603")
	_shade.texture = _radial(
		[Color(dark, 0.0), Color(dark, 0.18), Color(dark, 0.6)], [0.0, 0.6, 1.0]
	)
	_shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_shade.stretch_mode = TextureRect.STRETCH_SCALE
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_shade)
	resized.connect(_place)


func _ready() -> void:
	_place()
	# The flame breathes: the pool of light swells and settles, never quite still.
	var breath: Tween = _glow.create_tween().set_loops()
	breath.tween_property(_glow, "modulate:a", 0.75, 1.3).set_trans(Tween.TRANS_SINE)
	breath.tween_property(_glow, "modulate:a", 1.0, 0.9).set_trans(Tween.TRANS_SINE)
	breath.tween_property(_glow, "modulate:a", 0.85, 0.5).set_trans(Tween.TRANS_SINE)
	breath.tween_property(_glow, "modulate:a", 1.0, 0.7).set_trans(Tween.TRANS_SINE)


func _place() -> void:
	# The painting covers the screen keeping its aspect: find where the flame lands.
	var texture: Texture2D = _table.texture
	var aspect: float = float(texture.get_width()) / texture.get_height()
	var cover := Vector2(size.x, size.x / aspect)
	if cover.y < size.y:
		cover = Vector2(size.y * aspect, size.y)
	var origin: Vector2 = (size - cover) / 2.0
	var flame: Vector2 = origin + cover * FLAME
	var reach: float = size.y * 0.75
	_glow.size = Vector2.ONE * reach * 2.0
	_glow.position = flame - _glow.size / 2.0


## The table's HUD materials.
static func skin() -> XomDaoTableSkin:
	var look := XomDaoTableSkin.new()
	look.plate = Color(WALNUT, 0.92)
	look.edge = BRASS
	look.ink = CREAM
	look.radius = 8.0
	look.chip = Color("#4A2C18")
	look.chip_edge = Color(BRASS, 0.7)
	look.chip_ink = AMBER
	look.timer = AMBER
	look.timer_track = Color(WALNUT, 0.6)
	look.primary = [CLAY, BRASS, CREAM]
	look.secondary = [WALNUT_LIGHT, Color("#24150B"), CREAM]
	look.round_button = [WALNUT, BRASS, CREAM]
	return look


static func _radial(colors: Array[Color], offsets: Array[float]) -> GradientTexture2D:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array(offsets)
	gradient.colors = PackedColorArray(colors)
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.0, 0.5)
	texture.width = 256
	texture.height = 256
	return texture


## Words straight on the table: cream with a dark outline against the wood.
static func hud(label: Label, font_size: int) -> void:
	label.theme_type_variation = "HudLabel"
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	label.add_theme_color_override("font_outline_color", Color("#140B06", 0.85))
	label.add_theme_constant_override("outline_size", 7)


## Words on a walnut plate: no outline, the plate carries them.
static func plain(label: Label, font_size: int) -> void:
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", CREAM)


## The round's plaque: the round and the dealer side by side, the phases in a row under them
## (`phases` gets one label per name).
static func plaque(
	look: XomDaoTableSkin, round_label: Label, dealer: Label, names: Array, phases: Array[Label]
) -> PanelContainer:
	var plate: StyleBoxFlat = XomDaoUi.with_shadow(look.plate_box(2))
	plate.content_margin_left = 18.0
	plate.content_margin_right = 18.0
	plate.content_margin_top = 2.0
	plate.content_margin_bottom = 4.0
	var panel := PanelContainer.new()
	panel.name = "Plaque"
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override("panel", plate)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(row)
	for label: Label in [round_label, dealer]:
		plain(label, XomDaoUi.TEXT_MIN)
		row.add_child(label)
	dealer.add_theme_color_override("font_color", AMBER)
	for text: Variant in names:
		var phase := Label.new()
		phase.text = str(text)
		plain(phase, XomDaoUi.TEXT_MIN - 3)
		row.add_child(phase)
		phases.append(phase)
	return panel
