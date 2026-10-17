class_name HubShortcutButton
extends Button
## A tactile 2.5D wooden/lacquer shortcut plaque on the lobby's right sidebar.
## Instead of a flat web-app container, each shortcut has physical depth:
## - A dark 2.5D base lip and rich contact shadow underneath.
## - A chunky beveled plaque face with brass corner rivets.
## - Overlapping/popping 3D props (Vietnamese Hoi An festival lantern, Do paper quest scroll)
##   that break outside the top and left borders.
## - An embossed circular gold chevron action button at the right.

const WIDTH := 340.0
const DEPTH := 7.0
const RADIUS := 22.0

var id: String = ""
var label_text: String = ""
var is_banner: bool = false
var plate_height: float = 96.0

var _picture: Texture2D
var _prop: TextureRect
var _title: Label
var _content: Control
var _event_tag: XomDaoChip


static func create(
	shortcut_id: String, name_text: String, icon_fallback: String, height: float, banner: bool
) -> HubShortcutButton:
	var btn := HubShortcutButton.new()
	btn.id = shortcut_id
	btn.label_text = name_text
	btn.plate_height = height
	btn.is_banner = banner
	btn.name = "Shortcut_" + shortcut_id
	btn.custom_minimum_size = Vector2(WIDTH, height)

	var picture_path: String = "res://hub/lobby/shortcut-%s.webp" % shortcut_id
	if ResourceLoader.exists(picture_path):
		btn._picture = load(picture_path)
	elif icon_fallback != "":
		btn._picture = XomDaoUi.icon(icon_fallback)

	btn._build_ui()
	return btn


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	clip_contents = false
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())


func _ready() -> void:
	button_down.connect(_on_down)
	button_up.connect(queue_redraw)
	mouse_entered.connect(queue_redraw)
	mouse_exited.connect(queue_redraw)


func _on_down() -> void:
	XomDaoUi.bounce(self)
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	queue_redraw()


func _build_ui() -> void:
	_content = Control.new()
	_content.name = "Content"
	_content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_content)

	if is_banner and _picture != null:
		var banner_rect := ColorRect.new()
		banner_rect.name = "BannerArt"
		banner_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
		banner_rect.set_anchors_and_offsets_preset(
			Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 4
		)
		var box: Vector2 = Vector2(WIDTH, plate_height) - Vector2.ONE * 8.0
		var k: float = maxf(box.x / _picture.get_width(), box.y / _picture.get_height())
		var span: Vector2 = box / (_picture.get_size() * k)
		var material := ShaderMaterial.new()
		material.shader = preload("res://hub/lobby/glass.gdshader")
		material.set_shader_parameter("art", _picture)
		material.set_shader_parameter("has_art", true)
		material.set_shader_parameter("box", box)
		material.set_shader_parameter("radii", Vector4(18.0, 18.0, 18.0, 18.0))
		material.set_shader_parameter("shade_top", 0.12)
		material.set_shader_parameter("shade_bottom", 0.65)
		material.set_shader_parameter("uv_origin", (Vector2.ONE - span) / 2.0)
		material.set_shader_parameter("uv_span", span)
		banner_rect.material = material
		_content.add_child(banner_rect)

	# Overlapping / Popping 3D Prop
	if not is_banner and _picture != null:
		_prop = TextureRect.new()
		_prop.name = "PoppingProp"
		_prop.texture = _picture
		_prop.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_prop.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		_prop.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		_prop.mouse_filter = Control.MOUSE_FILTER_IGNORE

		if id == "su-kien":
			# Festival lantern: taller, top ring & tassel popping out
			_prop.custom_minimum_size = Vector2(92.0, 120.0)
			_prop.size = _prop.custom_minimum_size
			_prop.position = Vector2(-10.0, -14.0)
		elif id == "nhiem-vu":
			# Quest scroll: wide, parchment & rollers popping out
			_prop.custom_minimum_size = Vector2(108.0, 102.0)
			_prop.size = _prop.custom_minimum_size
			_prop.position = Vector2(-14.0, -6.0)
		else:
			_prop.custom_minimum_size = Vector2(80.0, 80.0)
			_prop.size = _prop.custom_minimum_size
			_prop.position = Vector2(4.0, (plate_height - 80.0) / 2.0)

		_content.add_child(_prop)

	# Label & Tags column
	var column := VBoxContainer.new()
	column.name = "TextColumn"
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_theme_constant_override("separation", 2)

	if is_banner:
		column.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
		column.offset_left = 20.0
		column.offset_right = -50.0
		column.offset_bottom = -12.0
		column.offset_top = -60.0
	else:
		column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		column.offset_left = 98.0
		column.offset_right = -54.0
		column.offset_top = 8.0
		column.offset_bottom = -8.0
		column.alignment = BoxContainer.ALIGNMENT_CENTER

	_content.add_child(column)

	_title = Label.new()
	_title.name = "ShortcutTitle_" + id
	_title.text = label_text
	_title.theme_type_variation = "HudLabel"
	_title.add_theme_font_size_override("font_size", 32)
	_title.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_title.add_theme_color_override("font_outline_color", Color(0.05, 0.08, 0.14, 0.95))
	_title.add_theme_constant_override("outline_size", 7)
	_title.add_theme_color_override("font_shadow_color", Color(0.0, 0.0, 0.0, 0.5))
	_title.add_theme_constant_override("shadow_offset_y", 2)
	_title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(_title)

	if id == "su-kien":
		_event_tag = XomDaoChip.create("", "", XomDaoUi.LACQUER)
		_event_tag.name = "EventTag"
		_event_tag.compact()
		_event_tag.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		column.add_child(_event_tag)


func get_event_tag() -> XomDaoChip:
	return _event_tag


func _draw() -> void:
	var mode: int = get_draw_mode()
	var down: bool = mode == DRAW_PRESSED or mode == DRAW_HOVER_PRESSED
	var hover: bool = mode == DRAW_HOVER
	var sunk: float = DEPTH - 2.0 if down else 0.0

	# Apply sunk offset to content so the whole card feels mechanically springy
	if _content != null:
		_content.position.y = sunk

	var face_fill: Color
	var border_color: Color
	var lip_color: Color

	if id == "su-kien":
		face_fill = Color("#2D1016")
		border_color = XomDaoUi.GOLD if hover else Color("#C23828")
		lip_color = Color("#1A070B")
	elif id == "nhiem-vu":
		face_fill = Color("#281C12")
		border_color = XomDaoUi.GOLD if hover else Color("#9C5F2A")
		lip_color = Color("#160F0A")
	else:  # "cho"
		face_fill = Color(XomDaoUi.NAVY, 0.95)
		border_color = (
			XomDaoUi.GOLD
			if hover
			else Color(XomDaoUi.NAVY_LINE.r, XomDaoUi.NAVY_LINE.g, XomDaoUi.NAVY_LINE.b, 0.95)
		)
		lip_color = Color("#0C1424")

	if hover:
		face_fill = face_fill.lightened(0.06)

	var w: float = size.x
	var h: float = size.y

	# 1. Contact shadow underneath
	var shadow_rect := Rect2(Vector2(0.0, sunk + 6.0), Vector2(w, h - DEPTH))
	var shadow_box: StyleBoxFlat = XomDaoUi.box(
		Color(0.10, 0.05, 0.03, 0.42), Color.TRANSPARENT, 0, RADIUS
	)
	draw_style_box(shadow_box, shadow_rect)

	# 2. 2.5D base lip
	var lip_rect := Rect2(Vector2(0.0, sunk), Vector2(w, h - sunk))
	var lip_box: StyleBoxFlat = XomDaoUi.box(lip_color, Color.TRANSPARENT, 0, RADIUS)
	draw_style_box(lip_box, lip_rect)

	# 3. Main plaque face
	var face_rect := Rect2(Vector2(0.0, sunk), Vector2(w, h - DEPTH))
	var face_box: StyleBoxFlat = XomDaoUi.box(face_fill, border_color, 3, RADIUS)
	draw_style_box(face_box, face_rect)

	# 4. Sun specular highlight along top edge
	draw_line(
		Vector2(RADIUS, sunk + 4.0),
		Vector2(w - RADIUS, sunk + 4.0),
		Color(1.0, 1.0, 1.0, 0.42 if not down else 0.18),
		2.0,
		true
	)

	# 5. Four brass corner rivets (chốt đồng đồ chơi thủ công)
	var rivet_inset := 15.0
	var rivet_pts: Array[Vector2] = [
		Vector2(rivet_inset, sunk + rivet_inset),
		Vector2(w - rivet_inset, sunk + rivet_inset),
		Vector2(rivet_inset, sunk + (h - DEPTH) - rivet_inset),
		Vector2(w - rivet_inset, sunk + (h - DEPTH) - rivet_inset),
	]
	for pt: Vector2 in rivet_pts:
		# Rivet shadow & brass cap
		draw_circle(pt + Vector2(0.0, 1.0), 3.0, Color(0.1, 0.05, 0.02, 0.6), true, -1.0, true)
		draw_circle(
			pt, 2.5, XomDaoUi.GOLD if hover else Color(XomDaoUi.GOLD_DARK, 0.85), true, -1.0, true
		)
		draw_circle(pt + Vector2(-0.6, -0.6), 1.0, Color(1.0, 1.0, 1.0, 0.6), true, -1.0, true)

	# 6. Action button circle at right end
	var action_center := Vector2(w - 28.0, sunk + (h - DEPTH) / 2.0)
	var btn_radius: float = 16.0
	# Button lip & shadow
	draw_circle(
		action_center + Vector2(0.0, 2.5),
		btn_radius,
		Color(0.12, 0.06, 0.03, 0.5),
		true,
		-1.0,
		true
	)
	# Button face
	var action_color: Color = XomDaoUi.GOLD if hover else Color(XomDaoUi.GOLD_DARK, 0.9)
	draw_circle(action_center, btn_radius, action_color, true, -1.0, true)
	draw_arc(action_center, btn_radius, 0.0, TAU, 24, Color(1.0, 1.0, 1.0, 0.4), 1.5, true)
	# Chevron >
	var chev_pts: PackedVector2Array = [
		action_center + Vector2(-3.0, -6.0),
		action_center + Vector2(4.0, 0.0),
		action_center + Vector2(-3.0, 6.0)
	]
	draw_polyline(chev_pts, Color("#361C08"), 3.0, true)
