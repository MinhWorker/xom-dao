class_name HubGameIsland
extends Button
## The carousel owns pointer gestures. This button also supports the debug bridge/keyboard.
## Only the focused preview floats; neighbours use static blue-grey art.

var card: XomDaoGameCard
var focused: bool = false
var locked: bool = false
var _picture := TextureRect.new()
var _plate := TextureRect.new()
var _name := Label.new()
var _tint := ShaderMaterial.new()
var _phase: float = 0.0


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	focus_mode = Control.FOCUS_NONE
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "focus"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	_tint.shader = preload("res://hub/select/island_tint.gdshader")
	_picture.material = _tint
	_picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_picture)
	_plate.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_plate.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_plate)
	_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_name.clip_text = true
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_name.add_theme_font_override("font", XomDaoUi.display_font())
	_name.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_name.add_theme_color_override("font_outline_color", XomDaoUi.INK)
	_name.add_theme_constant_override("outline_size", 3)
	_name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_name)
	resized.connect(_layout)
	set_process(false)


func show_card(item: XomDaoGameCard, playable: bool) -> void:
	card = item
	name = "Card_" + item.id
	_name.text = item.name
	locked = not playable
	_picture.texture = HubGameArt.island(item.id)
	var plate: String = HubGameArt.DIR + "island-label.webp"
	if ResourceLoader.exists(plate):
		_plate.texture = load(plate)
	_layout()


func set_depth(nearness: float, active: bool) -> void:
	focused = active and not locked
	_tint.set_shader_parameter("inactive", 1.0 - nearness if not locked else 0.85)
	_plate.modulate = Color.WHITE.lerp(Color("#81929e"), 1.0 - nearness)
	_layout()
	set_process(focused and is_visible_in_tree())
	if not focused:
		_picture.position.y = 0.0
	queue_redraw()


func _layout() -> void:
	_picture.size = Vector2(size.x, maxf(0.0, size.y - 56.0))
	_plate.position = Vector2(size.x * 0.05, size.y - 54.0)
	_plate.size = Vector2(size.x * 0.9, 54.0)
	_name.position = _plate.position
	_name.size = _plate.size
	var font_size: int = 32 if focused else 26
	var font: Font = XomDaoUi.display_font()
	while (
		font_size > XomDaoUi.TEXT_MIN
		and (
			font.get_string_size(_name.text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
			> _plate.size.x - 16
		)
	):
		font_size -= 1
	_name.add_theme_font_size_override("font_size", font_size)


func _process(delta: float) -> void:
	_phase += delta
	_picture.position.y = sin(_phase * TAU / 3.2) * 4.0
	queue_redraw()


func _draw() -> void:
	if focused:
		var center := Vector2(size.x * 0.5, size.y - 72.0)
		draw_set_transform(center, 0.0, Vector2(1.0, 0.22))
		draw_arc(Vector2.ZERO, size.x * 0.41, 0, TAU, 64, Color(XomDaoUi.GOLD, 0.65), 5, true)
		draw_set_transform(Vector2.ZERO)
	if locked:
		var side: float = 48.0
		draw_texture_rect(
			XomDaoUi.icon("lock-simple"),
			Rect2(Vector2(size.x / 2.0 - side / 2.0, size.y * 0.45), Vector2.ONE * side),
			false,
			XomDaoUi.CREAM
		)
