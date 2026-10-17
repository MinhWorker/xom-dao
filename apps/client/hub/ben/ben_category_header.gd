class_name HubBenCategoryHeader
extends Button
## A collapsible category header in Bến's game list:
## displays genre icon, category title in uppercase, game count, and a toggle chevron (▾/▸).

signal category_toggled(is_collapsed: bool)

var genre_id: String = ""
var genre_name: String = ""
var count: int = 0
var collapsed: bool = false:
	set(value):
		collapsed = value
		_update_chevron()

var chevron: TextureRect


static func create(
	id: String, title: String, game_count: int, is_collapsed: bool = false
) -> HubBenCategoryHeader:
	var item := HubBenCategoryHeader.new()
	item.genre_id = id
	item.genre_name = title
	item.count = game_count
	item.name = "Category_" + id
	item.collapsed = is_collapsed
	item._build()
	return item


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	custom_minimum_size = Vector2(0.0, 48.0)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var normal: StyleBoxFlat = XomDaoUi.box(Color("#142136", 0.92), Color("#243854", 0.7), 1, 14.0)
	normal.content_margin_left = 12.0
	normal.content_margin_right = 14.0

	var hover: StyleBoxFlat = normal.duplicate()
	hover.bg_color = Color("#1A2B45", 0.96)
	hover.border_color = Color("#3B5683", 0.85)

	var pressed_style: StyleBoxFlat = normal.duplicate()
	pressed_style.bg_color = Color("#0F1826", 0.98)

	add_theme_stylebox_override("normal", normal)
	add_theme_stylebox_override("hover", hover)
	add_theme_stylebox_override("pressed", pressed_style)
	add_theme_stylebox_override("hover_pressed", pressed_style)
	add_theme_stylebox_override("focus", StyleBoxEmpty.new())

	pressed.connect(_on_pressed)


func _build() -> void:
	var row := HBoxContainer.new()
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 10)
	add_child(row)

	var margin_left := Control.new()
	margin_left.custom_minimum_size.x = 2.0
	row.add_child(margin_left)

	# Genre icon
	var icon_tex: Texture2D = HubGameArt.genre(genre_id)
	if icon_tex != null:
		var icon_rect := TextureRect.new()
		icon_rect.texture = icon_tex
		icon_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon_rect.custom_minimum_size = Vector2(26.0, 26.0)
		icon_rect.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(icon_rect)

	# Title
	var title_lbl := Label.new()
	title_lbl.text = genre_name.to_upper()
	title_lbl.add_theme_font_override("font", XomDaoUi.display_font(800))
	title_lbl.add_theme_font_size_override("font_size", 22)
	title_lbl.add_theme_color_override("font_color", XomDaoUi.CREAM)
	title_lbl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(title_lbl)

	# Count
	var count_lbl := Label.new()
	count_lbl.text = "(%d)" % count
	count_lbl.add_theme_font_override("font", XomDaoUi.body_font(true))
	count_lbl.add_theme_font_size_override("font_size", 18)
	count_lbl.add_theme_color_override("font_color", Color(XomDaoUi.CREAM, 0.6))
	count_lbl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(count_lbl)

	# Spacer
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(spacer)

	# Chevron
	chevron = TextureRect.new()
	chevron.texture = XomDaoUi.icon("caret-right")
	chevron.custom_minimum_size = Vector2(18.0, 18.0)
	chevron.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	chevron.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	chevron.modulate = XomDaoUi.SUN
	chevron.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	chevron.pivot_offset = Vector2(9.0, 9.0)
	row.add_child(chevron)
	_update_chevron()

	var margin_right := Control.new()
	margin_right.custom_minimum_size.x = 2.0
	row.add_child(margin_right)


func _on_pressed() -> void:
	XomDaoUi.bounce(self)
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	collapsed = not collapsed
	category_toggled.emit(collapsed)


func _update_chevron() -> void:
	if chevron != null:
		chevron.rotation_degrees = 0.0 if collapsed else 90.0
