class_name HubBenGameCard
extends Button
## A game card on Bến's left list:
## displays game splash art clipped to rounded corners, game logo (no background),
## title, seats tagline, and gold border/chevron indicator when selected.

const SHADER: Shader = preload("res://hub/ben/ben_card.gdshader")
const RADIUS := 16.0

var card: XomDaoGameCard
var playable: bool = true
var selected: bool = false:
	set(value):
		selected = value
		_update_style()
		_layout()

var _splash: Texture2D
var _logo: Texture2D

var _base_panel: Panel
var _art: ColorRect
var _logo_rect: TextureRect
var _title_lbl: Label
var _seats_lbl: Label
var _chevron: TextureRect
var _row: HBoxContainer


static func create(game_card: XomDaoGameCard, is_playable: bool = true) -> HubBenGameCard:
	var item := HubBenGameCard.new()
	item.card = game_card
	item.playable = is_playable
	item.name = "GameCard_" + game_card.id
	item._build()
	return item


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	custom_minimum_size = Vector2(0.0, 72.0)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	button_down.connect(_on_button_down)
	mouse_entered.connect(_update_style)
	mouse_exited.connect(_update_style)
	resized.connect(_layout)


func _on_button_down() -> void:
	XomDaoUi.bounce(self)
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)


func _build() -> void:
	if card == null:
		return

	_splash = HubGameArt.splash(card.id)
	_logo = HubGameArt.logo(card.id)

	# Base panel with rounded corners and soft shadow
	_base_panel = Panel.new()
	_base_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_base_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_base_panel)

	# Splash art ColorRect with rounded corner shader
	_art = ColorRect.new()
	_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var mat := ShaderMaterial.new()
	mat.shader = SHADER
	mat.set_shader_parameter("art", _splash)
	mat.set_shader_parameter("has_art", _splash != null)
	mat.set_shader_parameter("scrim_color", Color(0.055, 0.09, 0.16, 1.0))
	_art.material = mat
	add_child(_art)

	# Content row
	_row = HBoxContainer.new()
	_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_row.offset_left = 12.0
	_row.offset_top = 8.0
	_row.offset_right = -12.0
	_row.offset_bottom = -8.0
	_row.add_theme_constant_override("separation", 10)
	add_child(_row)

	# Game Logo directly on scrim - no extra background panel behind it
	_logo_rect = TextureRect.new()
	_logo_rect.texture = _logo
	_logo_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_logo_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_logo_rect.custom_minimum_size = Vector2(42.0, 42.0)
	_logo_rect.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_logo_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_logo_rect.visible = _logo != null
	_row.add_child(_logo_rect)

	# Text column
	var text_col := VBoxContainer.new()
	text_col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	text_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text_col.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	text_col.add_theme_constant_override("separation", 2)
	_row.add_child(text_col)

	_title_lbl = Label.new()
	_title_lbl.text = card.name
	_title_lbl.add_theme_font_override("font", XomDaoUi.display_font(800))
	_title_lbl.add_theme_font_size_override("font_size", 22)
	_title_lbl.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_title_lbl.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_title_lbl.clip_text = true
	_title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	text_col.add_child(_title_lbl)

	_seats_lbl = Label.new()
	var seats_text: String = (
		"%d người" % card.max_players
		if card.min_players == card.max_players
		else "%d–%d người" % [card.min_players, card.max_players]
	)
	_seats_lbl.text = seats_text
	_seats_lbl.add_theme_font_size_override("font_size", 17)
	_seats_lbl.add_theme_color_override("font_color", Color("#8BA2C4"))
	_seats_lbl.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_seats_lbl.clip_text = true
	_seats_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_seats_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	text_col.add_child(_seats_lbl)

	# Chevron
	_chevron = TextureRect.new()
	_chevron.texture = XomDaoUi.icon("caret-right")
	_chevron.custom_minimum_size = Vector2(18.0, 18.0)
	_chevron.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_chevron.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_chevron.modulate = XomDaoUi.SUN
	_chevron.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_chevron.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_row.add_child(_chevron)

	_update_style()
	_layout()


func _update_style() -> void:
	if _base_panel == null:
		return
	var over: bool = is_hovered()
	var border_color: Color = (
		XomDaoUi.SUN
		if selected
		else (XomDaoUi.NAVY_LINE.lightened(0.2) if over else XomDaoUi.NAVY_LINE)
	)
	var border_width: int = 3 if selected else 2

	var base_style: StyleBoxFlat = XomDaoUi.box(
		Color("#10192A"), border_color, border_width, RADIUS
	)
	base_style.shadow_color = Color(0.0, 0.0, 0.0, 0.35)
	base_style.shadow_size = 4
	base_style.shadow_offset = Vector2(0.0, 3.0)
	_base_panel.add_theme_stylebox_override("panel", base_style)

	if _chevron != null:
		_chevron.visible = selected

	if _art != null and _art.material is ShaderMaterial:
		var inner_rad: float = RADIUS - float(border_width)
		var mat := _art.material as ShaderMaterial
		mat.set_shader_parameter("radii", Vector4(inner_rad, inner_rad, inner_rad, inner_rad))
		mat.set_shader_parameter("scrim_left", 0.88 if selected else 0.94)
		mat.set_shader_parameter("scrim_right", 0.42 if selected else 0.52)


func _layout() -> void:
	if _art == null or size.x <= 0.0 or size.y <= 0.0:
		return
	var border_w: float = 3.0 if selected else 2.0
	var art_pos := Vector2(border_w, border_w)
	var art_size: Vector2 = size - art_pos * 2.0
	_art.position = art_pos
	_art.size = art_size

	var mat := _art.material as ShaderMaterial
	if mat == null:
		return
	mat.set_shader_parameter("box", art_size)
	var inner_rad: float = RADIUS - border_w
	mat.set_shader_parameter("radii", Vector4(inner_rad, inner_rad, inner_rad, inner_rad))

	if _splash != null:
		var pic_size := _splash.get_size()
		var k: float = maxf(art_size.x / pic_size.x, art_size.y / pic_size.y)
		var span := art_size / (pic_size * k)
		var origin := (Vector2.ONE - span) / 2.0
		mat.set_shader_parameter("uv_origin", origin)
		mat.set_shader_parameter("uv_span", span)
