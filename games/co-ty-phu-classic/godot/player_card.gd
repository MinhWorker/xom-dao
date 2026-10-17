extends XomDaoPlayerSlot
## Patterned paper calling card composed from SDK avatar and typography, with ink cash.

const Cash := preload("res://content/co-ty-phu-classic/card_cash.gd")
const Glint := preload("res://content/co-ty-phu-classic/card_glint.gdshader")
var accent: Color = XomDaoUi.SEA_DEEP
var local_player: bool = false
var _face := Control.new()
var _cash: Control = Cash.new()
var _icon := TextureRect.new()
var _glow := ColorRect.new()
var _status := Label.new()
var _material := ShaderMaterial.new()
var _clock_active: bool = false
var _impact_tween: Tween


func _init() -> void:
	super()
	for widget: Control in [avatar, _name_pill, _extra, _level]:
		widget.reparent(_face)
	for child: Node in get_children():
		remove_child(child)
		child.free()
	add_child(_face)
	_extra.visible = false
	_level.visible = false
	custom_minimum_size = Vector2(264, 112)
	_face.custom_minimum_size = custom_minimum_size
	_face.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_name_pill.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_name.add_theme_color_override("font_color", XomDaoUi.INK)
	_name.add_theme_font_size_override("font_size", 24)
	_name.custom_minimum_size.x = 146
	_icon.texture = preload("res://content/co-ty-phu-classic/art/hud-money.svg")
	_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_icon.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_face.add_child(_icon)
	_face.add_child(_cash)
	_cash.set("impact", _hit)
	_status.add_theme_font_override("font", XomDaoUi.display_font(700))
	_status.add_theme_font_size_override("font_size", 24)
	_status.add_theme_color_override("font_color", XomDaoUi.INK)
	_face.add_child(_status)
	_material.shader = Glint
	_glow.material = _material
	_glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_face.add_child(_glow)
	_face.move_child(_glow, 0)
	resized.connect(_arrange)


func _ready() -> void:
	super()
	_arrange()


func set_cash(value: int, status: String = "") -> void:
	_cash.call("sync", value)
	_status.text = status
	_cash.visible = status != "Phá sản"
	_icon.visible = status != "Phá sản"
	_extra.visible = false
	_status.position = Vector2(102, 60) if status == "Phá sản" else Vector2(210, 19)
	_arrange()


func change_cash(value: int, delta: int) -> void:
	_cash.call("animate_to", value, delta)


func is_turn() -> bool:
	return _clock_active


func start_turn(seconds: float, elapsed: float = 0.0) -> void:
	_clock_active = true
	_turn_seconds = maxf(seconds, 0.001)
	_turn_left = clampf(seconds - elapsed, 0.0, seconds)
	avatar.turn = -1.0
	set_process(_turn_left > 0.0)
	_highlight()


func show_turn() -> void:
	_clock_active = true
	_turn_seconds = 0.0
	avatar.turn = -1.0
	set_process(false)
	_highlight()


func end_turn() -> void:
	_clock_active = false
	avatar.turn = -1.0
	set_process(false)
	_highlight()


func _process(delta: float) -> void:
	_turn_left = maxf(0.0, _turn_left - delta)
	if _turn_left <= 0.0:
		set_process(false)
		turn_ended.emit()


func _highlight() -> void:
	_material.set_shader_parameter("active", 1.0 if is_turn() else 0.0)
	_material.set_shader_parameter("tint", accent)


func _arrange() -> void:
	avatar.custom_minimum_size = Vector2(70, 70)
	avatar.size = Vector2(70, 70)
	avatar.position = Vector2(22, 22)
	_name_pill.position = Vector2(105, 19)
	var name_width: float = 96.0 if _status.text == "Tù" else 140.0
	_name.custom_minimum_size.x = name_width
	_name_pill.size = Vector2(name_width, 34)
	_cash.position = Vector2(134, 53)
	_cash.size = Vector2(115, 38)
	_icon.position = Vector2(103, 61)
	_icon.size = Vector2(27, 22)
	_glow.size = size
	queue_redraw()


func _hit(delta: int) -> void:
	if _impact_tween != null:
		_impact_tween.kill()
	_material.set_shader_parameter(
		"impact_color", XomDaoUi.UP_ON_PAPER if delta > 0 else XomDaoUi.DOWN_ON_PAPER
	)
	_material.set_shader_parameter("impact", 1.0)
	var balance: Label = _cash.get("label")
	balance.pivot_offset = balance.size / 2.0
	balance.scale = Vector2.ONE * 1.12
	_impact_tween = create_tween().set_parallel()
	_impact_tween.tween_property(_material, "shader_parameter/impact", 0.0, 0.45)
	(
		_impact_tween
		. tween_property(balance, "scale", Vector2.ONE, 0.4)
		. set_trans(Tween.TRANS_BACK)
		. set_ease(Tween.EASE_OUT)
	)


func _draw() -> void:
	var outer: StyleBoxFlat = XomDaoUi.box(accent.lightened(0.12), accent.darkened(0.35), 2, 14.0)
	outer.shadow_color = XomDaoUi.SHADOW
	outer.shadow_size = 5
	outer.shadow_offset = Vector2(3, 5)
	draw_style_box(outer, Rect2(Vector2.ZERO, size))
	for x: int in range(17, int(size.x) - 18, 17):
		var ink: Color = XomDaoUi.PAPER if x % 3 else accent.darkened(0.25)
		for y: float in [6.0, size.y - 12.0]:
			draw_colored_polygon(
				PackedVector2Array(
					[
						Vector2(x, y),
						Vector2(x + 10, y),
						Vector2(x + 6, y + 6),
						Vector2(x - 4, y + 6)
					]
				),
				ink
			)
	var inner: StyleBoxFlat = XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.INK, 1, 10.0)
	draw_style_box(inner, Rect2(Vector2(14, 13), size - Vector2(28, 26)))


func countdown_fraction() -> float:
	return _turn_left / _turn_seconds if is_turn() and _turn_seconds > 0.0 else -1.0
