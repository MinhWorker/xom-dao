class_name HubGameCard
extends Control
## The lobby's card of the selected game. Its splash art fills the card, dark at the top where
## the name (`title`, top left) and the players online (`online`, top right) are written straight
## on it. Two corners are big and round, two small. CHƠI (`play`, HubPlayButton) is a gold slab
## that takes the whole bottom of the card. A game that cannot be played here is fogged and
## locked.
##
##   card.show_art(HubGameArt.splash(id), locked)

const SIZE := Vector2(460.0, 340.0)
## Top left and bottom right, then top right and bottom left.
const ROUND := 44.0
const SMALL := 14.0
const TITLE_SIZE := 38
const FOG := Color(0.78, 0.83, 0.88, 0.6)

var title := Label.new()
var online := Label.new()
var play := HubPlayButton.new()

var _picture: Texture2D
var _art := ColorRect.new()
var _online_plate := PanelContainer.new()
var _online_row := HBoxContainer.new()
var _lock := TextureRect.new()
var _shader: Shader = preload("res://hub/lobby/glass.gdshader")


func _init() -> void:
	name = "SelectedGame"
	custom_minimum_size = SIZE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	# Under the art: the card's short dense shadow.
	var ground := Panel.new()
	var shadow: StyleBoxFlat = _leaf(XomDaoUi.NAVY, Color.TRANSPARENT, 0)
	shadow.shadow_color = Color(0.12, 0.06, 0.03, 0.48)
	shadow.shadow_size = 6
	shadow.shadow_offset = Vector2(0.0, 8.0)
	ground.add_theme_stylebox_override("panel", shadow)
	_cover(ground)
	_piece(_art, Vector4(ROUND, SMALL, ROUND, SMALL))
	_art.name = "SelectedArt"
	_art.material.set_shader_parameter("shade_top", 0.72)
	_art.material.set_shader_parameter("shade_bottom", 0.3)
	_cover(_art)
	_lock.texture = XomDaoUi.icon("lock-simple")
	_lock.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_lock.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_lock.modulate = XomDaoUi.NAVY
	_lock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_lock.visible = false
	add_child(_lock)
	# The rim of the card, over the art.
	var frame := Panel.new()
	var line: StyleBoxFlat = _leaf(
		Color.TRANSPARENT,
		Color(XomDaoUi.NAVY_LINE.r, XomDaoUi.NAVY_LINE.g, XomDaoUi.NAVY_LINE.b, 0.95),
		3
	)
	line.draw_center = false
	frame.add_theme_stylebox_override("panel", line)
	_cover(frame)
	# Inner gold accent highlight.
	var inner_frame := Panel.new()
	var inner_line: StyleBoxFlat = _leaf(
		Color.TRANSPARENT, Color(XomDaoUi.GOLD.r, XomDaoUi.GOLD.g, XomDaoUi.GOLD.b, 0.35), 1
	)
	inner_line.draw_center = false
	inner_line.content_margin_left = 3.0
	inner_line.content_margin_top = 3.0
	inner_line.content_margin_right = 3.0
	inner_line.content_margin_bottom = 3.0
	inner_frame.add_theme_stylebox_override("panel", inner_line)
	_cover(inner_frame)
	title.name = "SelectedName"
	title.theme_type_variation = "HudLabel"
	title.add_theme_font_size_override("font_size", TITLE_SIZE)
	title.add_theme_color_override("font_color", XomDaoUi.CREAM)
	title.add_theme_color_override("font_outline_color", Color(0.06, 0.09, 0.16, 0.95))
	title.add_theme_constant_override("outline_size", 8)
	title.add_theme_color_override("font_shadow_color", Color(0.0, 0.0, 0.0, 0.45))
	title.add_theme_constant_override("shadow_offset_y", 2)
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(title)
	_online_plate.name = "SelectedOnlinePlate"
	_online_plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var plate_style: StyleBoxFlat = XomDaoUi.box(
		Color(XomDaoUi.NAVY.r, XomDaoUi.NAVY.g, XomDaoUi.NAVY.b, 0.82),
		Color(XomDaoUi.NAVY_LINE.r, XomDaoUi.NAVY_LINE.g, XomDaoUi.NAVY_LINE.b, 0.8),
		1,
		14.0
	)
	plate_style.content_margin_left = 10.0
	plate_style.content_margin_right = 12.0
	plate_style.content_margin_top = 2.0
	plate_style.content_margin_bottom = 2.0
	plate_style.shadow_color = XomDaoPuff.SHADE
	plate_style.shadow_size = 2
	plate_style.shadow_offset = Vector2(0.0, 2.0)
	_online_plate.add_theme_stylebox_override("panel", plate_style)
	add_child(_online_plate)
	_online_row.name = "SelectedOnlineRow"
	_online_row.add_theme_constant_override("separation", 6)
	_online_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_online_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_online_plate.add_child(_online_row)
	var people := TextureRect.new()
	people.texture = XomDaoUi.icon("users")
	people.custom_minimum_size = Vector2(22.0, 22.0)
	people.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	people.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	people.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	people.modulate = XomDaoUi.GOLD
	people.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_online_row.add_child(people)
	online.name = "SelectedOnline"
	online.theme_type_variation = "HudLabel"
	online.add_theme_font_size_override("font_size", 24)
	online.add_theme_color_override("font_color", XomDaoUi.CREAM)
	online.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_online_row.add_child(online)
	add_child(play)
	resized.connect(_layout)
	_layout()


## The art to fill the card with (null: plain sea), fogged and locked when `locked`.
func show_art(picture: Texture2D, locked: bool) -> void:
	_picture = picture
	_lock.visible = locked
	var art: ShaderMaterial = _art.material
	art.set_shader_parameter("tint", FOG if locked else Color.TRANSPARENT)
	art.set_shader_parameter("has_art", picture != null)
	if picture != null:
		art.set_shader_parameter("art", picture)
	_layout()


## The game's name, whole: a long one is written smaller, never cut.
func show_title(text: String) -> void:
	title.text = text
	var font: Font = XomDaoUi.display_font(800)
	var room: float = SIZE.x - 26.0 - 110.0
	var font_size: int = TITLE_SIZE
	while (
		font_size > XomDaoUi.TEXT_MIN
		and font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x > room
	):
		font_size -= 2
	title.add_theme_font_size_override("font_size", font_size)


## Shows or hides the players online.
func show_online(count: int, shown: bool) -> void:
	online.text = str(count)
	_online_plate.visible = shown
	_layout()


## A box with the card's corners: two round, two small.
func _leaf(color: Color, line: Color, width: int) -> StyleBoxFlat:
	var style: StyleBoxFlat = XomDaoUi.box(color, line, width, SMALL)
	style.corner_radius_top_left = int(ROUND)
	style.corner_radius_bottom_right = int(ROUND)
	style.corner_detail = 16
	return style


func _cover(part: Control) -> void:
	part.mouse_filter = Control.MOUSE_FILTER_IGNORE
	part.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(part)


func _piece(rect: ColorRect, radii: Vector4) -> void:
	var material := ShaderMaterial.new()
	material.shader = _shader
	material.set_shader_parameter("radii", radii)
	rect.material = material
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE


func _layout() -> void:
	var box: Vector2 = size
	if box.x <= 0.0 or box.y <= 0.0:
		return
	title.position = Vector2(26.0, 14.0)
	title.size = Vector2(box.x - 26.0 - 110.0, 50.0)
	_online_plate.reset_size()
	_online_plate.position = Vector2(box.x - 20.0 - _online_plate.size.x, 14.0)
	play.round_corner = ROUND
	play.small_corner = SMALL
	play.position = Vector2(0.0, box.y - HubPlayButton.HEIGHT)
	play.size = Vector2(box.x, HubPlayButton.HEIGHT)
	# The lock sits in the window between the name and CHƠI.
	var side: float = 72.0
	var window: float = play.position.y - 62.0
	_lock.size = Vector2(side, side)
	_lock.position = Vector2((box.x - side) / 2.0, 62.0 + (window - side) / 2.0)
	# Which part of the picture covers the card.
	var span := Vector2.ONE
	if _picture != null:
		var picture: Vector2 = _picture.get_size()
		var k: float = maxf(box.x / picture.x, box.y / picture.y)
		span = box / (picture * k)
	var origin: Vector2 = (Vector2.ONE - span) / 2.0
	var material: ShaderMaterial = _art.material
	material.set_shader_parameter("box", box)
	material.set_shader_parameter("uv_origin", origin)
	material.set_shader_parameter("uv_span", span)
