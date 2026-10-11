class_name HubGameCard
extends Control
## The lobby's card of the selected game: its splash art fills the card, a little darker at the
## top and bottom, and everything on it sits on frosted glass. On top, a pane with the name
## (`title`) and the players online (`online`); at the bottom, a tray with the chips (`info`) and
## the buttons the lobby puts in `buttons`. A game that cannot be played here is fogged and
## locked.
##
##   card.show_art(HubGameArt.splash(id), locked)
## The glass is the same picture, blurred, cut to each pane (glass.gdshader).

const SIZE := Vector2(460.0, 392.0)
const RADIUS := 24.0
const INSET := 10.0
const TOP_H := 58.0
const TRAY_PAD := 12.0
const TRAY_H := TRAY_PAD + 40.0 + 10.0 + XomDaoButton.HEIGHT + TRAY_PAD
const GLASS := Color(0.086, 0.137, 0.247, 0.42)
const FOG := Color(0.78, 0.83, 0.88, 0.6)

static var _blurred: Dictionary = {}

var title := Label.new()
var online: XomDaoChip = XomDaoChip.create("0", "users", Color(1.0, 1.0, 1.0, 0.16))
var info := HBoxContainer.new()
var buttons := HBoxContainer.new()

var _picture: Texture2D
var _art := ColorRect.new()
var _top := ColorRect.new()
var _tray := ColorRect.new()
var _lock := TextureRect.new()
var _shader: Shader = preload("res://hub/lobby/glass.gdshader")


func _init() -> void:
	name = "SelectedGame"
	custom_minimum_size = SIZE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	# Under the art: the card's short dense shadow.
	var ground := Panel.new()
	var shadow: StyleBoxFlat = XomDaoUi.box(XomDaoUi.NAVY, Color.TRANSPARENT, 0, RADIUS)
	shadow.shadow_color = XomDaoPuff.SHADE
	shadow.shadow_size = 3
	shadow.shadow_offset = Vector2(0.0, 5.0)
	ground.add_theme_stylebox_override("panel", shadow)
	_cover(ground)
	_piece(_art, RADIUS)
	_art.name = "SelectedArt"
	_cover(_art)
	_lock.texture = XomDaoUi.icon("lock-simple")
	_lock.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_lock.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_lock.modulate = XomDaoUi.NAVY
	_lock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_lock.visible = false
	add_child(_lock)
	for pane: ColorRect in [_top, _tray]:
		_piece(pane, 18.0)
		pane.material.set_shader_parameter("tint", GLASS)
		pane.material.set_shader_parameter("rim", 0.3)
		add_child(pane)
	# The rim of the card, over the art.
	var frame := Panel.new()
	var line: StyleBoxFlat = XomDaoUi.box(Color.TRANSPARENT, XomDaoUi.NAVY_LINE, 2, RADIUS)
	line.draw_center = false
	frame.add_theme_stylebox_override("panel", line)
	_cover(frame)
	var head := HBoxContainer.new()
	head.mouse_filter = Control.MOUSE_FILTER_IGNORE
	head.add_theme_constant_override("separation", 8)
	head.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 8)
	head.offset_left = 16.0
	_top.add_child(head)
	title.name = "SelectedName"
	title.theme_type_variation = "HudLabel"
	title.add_theme_font_size_override("font_size", 34)
	title.add_theme_color_override("font_outline_color", Color(XomDaoUi.NAVY, 0.6))
	title.add_theme_constant_override("outline_size", 4)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	head.add_child(title)
	online.name = "SelectedOnline"
	online.compact()
	online.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	head.add_child(online)
	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_theme_constant_override("separation", 10)
	column.set_anchors_and_offsets_preset(
		Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, int(TRAY_PAD)
	)
	_tray.add_child(column)
	info.name = "SelectedInfo"
	info.custom_minimum_size.y = 40.0
	info.add_theme_constant_override("separation", 8)
	info.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(info)
	buttons.add_theme_constant_override("separation", 10)
	column.add_child(buttons)
	resized.connect(_layout)
	_layout()


## The art to fill the card with (null: plain sea), fogged and locked when `locked`.
func show_art(picture: Texture2D, locked: bool) -> void:
	_picture = picture
	_lock.visible = locked
	var art: ShaderMaterial = _art.material
	art.set_shader_parameter("tint", FOG if locked else Color.TRANSPARENT)
	for piece: ColorRect in [_art, _top, _tray]:
		var material: ShaderMaterial = piece.material
		material.set_shader_parameter("has_art", picture != null)
	if picture != null:
		art.set_shader_parameter("art", picture)
		var soft: Texture2D = _blur(picture)
		_top.material.set_shader_parameter("art", soft)
		_tray.material.set_shader_parameter("art", soft)
	_layout()


## A chip for the tray: a paler pane of glass.
func chip(text: String, icon_name: String) -> XomDaoChip:
	var made: XomDaoChip = XomDaoChip.create(text, icon_name, Color(1.0, 1.0, 1.0, 0.16))
	made.compact()
	return made


func _cover(part: Control) -> void:
	part.mouse_filter = Control.MOUSE_FILTER_IGNORE
	part.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(part)


func _piece(rect: ColorRect, radius: float) -> void:
	var material := ShaderMaterial.new()
	material.shader = _shader
	material.set_shader_parameter("radius", radius)
	rect.material = material
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE


func _layout() -> void:
	var box: Vector2 = size
	if box.x <= 0.0 or box.y <= 0.0:
		return
	_top.position = Vector2(INSET, INSET)
	_top.size = Vector2(box.x - 2.0 * INSET, TOP_H)
	_tray.position = Vector2(INSET, box.y - INSET - TRAY_H)
	_tray.size = Vector2(box.x - 2.0 * INSET, TRAY_H)
	# The lock sits in the window between the two panes.
	var window_top: float = _top.position.y + TOP_H
	var side: float = minf(72.0, _tray.position.y - window_top - 16.0)
	_lock.size = Vector2(side, side)
	_lock.position = Vector2(
		(box.x - side) / 2.0, window_top + (_tray.position.y - window_top - side) / 2.0
	)
	# Which part of the picture covers the card, then each piece's share of it.
	var span := Vector2.ONE
	if _picture != null:
		var picture: Vector2 = _picture.get_size()
		var k: float = maxf(box.x / picture.x, box.y / picture.y)
		span = box / (picture * k)
	var origin: Vector2 = (Vector2.ONE - span) / 2.0
	_art.material.set_shader_parameter("shade", 0.42)
	for piece: ColorRect in [_art, _top, _tray]:
		var material: ShaderMaterial = piece.material
		material.set_shader_parameter("box", piece.size)
		material.set_shader_parameter("uv_origin", origin + piece.position / box * span)
		material.set_shader_parameter("uv_span", piece.size / box * span)


## The picture out of focus: shrunk to a few pixels and stretched back.
static func _blur(picture: Texture2D) -> Texture2D:
	if _blurred.has(picture):
		return _blurred[picture]
	var image: Image = picture.get_image()
	if image == null or image.is_empty():
		return picture
	if image.is_compressed():
		image.decompress()
	var small := Vector2i(maxi(8, image.get_width() / 24), maxi(8, image.get_height() / 24))
	image.resize(small.x, small.y, Image.INTERPOLATE_LANCZOS)
	image.resize(small.x * 6, small.y * 6, Image.INTERPOLATE_CUBIC)
	var soft: Texture2D = ImageTexture.create_from_image(image)
	_blurred[picture] = soft
	return soft
