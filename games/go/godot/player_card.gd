class_name GoPlayerCard
extends PanelContainer
## A single horizontal player banner for the Go table.

var player_name: String = "":
	set(value):
		player_name = value
		if _name != null:
			_name.text = value
		_avatar.initial = value

var stats: String = "":
	set(value):
		stats = value
		if _stats != null:
			_stats.text = value

var side: String = "b":
	set(value):
		side = value
		_avatar.side = value

var picture: Texture2D:
	set(value):
		picture = value
		_avatar.picture = value

var host: bool = false:
	set(value):
		host = value
		if _host_icon != null:
			_host_icon.visible = value

var active: bool = true:
	set(value):
		active = value
		modulate.a = 1.0 if value else 0.6

var _avatar := GoPlayerAvatar.new()
var _name := Label.new()
var _stats := Label.new()
var _host_icon := TextureRect.new()


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size = Vector2(286.0, 88.0)
	var panel := XomDaoUi.box(Color(0.035, 0.027, 0.02, 0.78), Color("#A58A5C"), 1, 16.0)
	panel.content_margin_left = 12.0
	panel.content_margin_right = 14.0
	panel.content_margin_top = 9.0
	panel.content_margin_bottom = 9.0
	add_theme_stylebox_override("panel", panel)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(row)
	_avatar.custom_minimum_size = Vector2(64.0, 64.0)
	_avatar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(_avatar)

	var details := VBoxContainer.new()
	details.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	details.alignment = BoxContainer.ALIGNMENT_CENTER
	details.add_theme_constant_override("separation", 2)
	row.add_child(details)

	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 5)
	name_row.alignment = BoxContainer.ALIGNMENT_BEGIN
	details.add_child(name_row)
	_name.add_theme_font_override("font", XomDaoUi.body_font(true))
	_name.add_theme_font_size_override("font_size", 27)
	_name.add_theme_color_override("font_color", Color("#FFF3DE"))
	_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	name_row.add_child(_name)
	_host_icon.texture = XomDaoUi.icon("crown")
	_host_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_host_icon.custom_minimum_size = Vector2(19.0, 19.0)
	_host_icon.modulate = Color("#D7B66F")
	_host_icon.visible = false
	name_row.add_child(_host_icon)

	_stats.add_theme_font_override("font", XomDaoUi.body_font())
	_stats.add_theme_font_size_override("font_size", 22)
	_stats.add_theme_color_override("font_color", Color("#D5C4A4"))
	_stats.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	details.add_child(_stats)
