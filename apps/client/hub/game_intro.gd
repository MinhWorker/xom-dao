class_name HubGameIntro
extends Control
## The screen between a room and its game: the game's splash art over the whole screen, its
## logo and name in the middle, and a spinner while the game's pack loads. The hub keeps it up
## for a moment even when the pack is already there (HubMain.INTRO_MS).
##
##   var intro := HubGameIntro.new("tien-len", "Tiến Lên")
##
## Named nodes for tests: IntroName, Status.

var _art := TextureRect.new()
var _logo: Texture2D
var _name := Label.new()
var _status := Label.new()
var _spin: float = 0.0


func _init(game_id: String = "", game_name: String = "") -> void:
	name = "GameIntro"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var back := ColorRect.new()
	back.color = XomDaoUi.NAVY
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(back)
	_art.texture = HubGameArt.splash(game_id)
	_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_art.modulate = Color(0.62, 0.66, 0.75)
	add_child(_art)
	_logo = HubGameArt.logo(game_id)
	var art := Control.new()
	art.name = "IntroArt"
	art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.draw.connect(_draw_middle.bind(art))
	add_child(art)
	_name.name = "IntroName"
	_name.text = game_name
	_name.theme_type_variation = "HudLabel"
	_name.add_theme_font_size_override("font_size", 72)
	_status.name = "Status"
	_status.text = "Đang tải"
	_status.theme_type_variation = "HudLabel"
	_status.add_theme_font_size_override("font_size", 28)
	for label: Label in [_name, _status]:
		label.add_theme_color_override("font_outline_color", Color(XomDaoUi.NAVY, 0.85))
		label.add_theme_constant_override("outline_size", 10)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		add_child(label)
	resized.connect(_layout)
	_layout()
	# The logo and the name come up together.
	art.modulate.a = 0.0
	_name.modulate.a = 0.0


func _ready() -> void:
	_layout()
	var art: Control = get_node("IntroArt")
	art.pivot_offset = size / 2.0
	art.scale = Vector2.ONE * 0.8
	var tween: Tween = create_tween().set_parallel()
	tween.tween_property(art, "modulate:a", 1.0, 0.25).set_delay(0.3)
	(
		tween
		. tween_property(art, "scale", Vector2.ONE, 0.45)
		. set_delay(0.3)
		. set_trans(Tween.TRANS_BACK)
		. set_ease(Tween.EASE_OUT)
	)
	tween.tween_property(_name, "modulate:a", 1.0, 0.3).set_delay(0.45)


func _process(delta: float) -> void:
	_spin = fmod(_spin + delta * 5.0, TAU)
	get_node("IntroArt").queue_redraw()


func _draw_middle(art: Control) -> void:
	var middle := Vector2(size.x / 2.0, size.y * 0.4)
	if _logo != null:
		var side: float = 220.0
		art.draw_texture_rect(
			_logo, Rect2(middle - Vector2.ONE * side / 2.0, Vector2.ONE * side), false
		)
	# The spinner, under the name.
	var c := Vector2(size.x / 2.0 - 96.0, size.y - 86.0)
	art.draw_arc(c, 13.0, 0.0, TAU, 40, Color(XomDaoUi.CREAM, 0.3), 5.0, true)
	art.draw_arc(c, 13.0, _spin, _spin + TAU * 0.3, 16, XomDaoUi.SUN, 5.0, true)


func _layout() -> void:
	_name.position = Vector2(0.0, size.y * 0.4 + 120.0)
	_name.size = Vector2(size.x, 90.0)
	_status.position = Vector2(size.x / 2.0 - 70.0, size.y - 106.0)
	_status.size = Vector2(160.0, 40.0)
