class_name HubAchievementFilter
extends Button
## An icon-only achievement category button. The game's monochrome logo identifies its category;
## the small count shows how much of that category has been reached.

const MONO_LOGO_SHADER: Shader = preload("res://hub/home/achievement_logo.gdshader")
const SIZE := Vector2(76.0, 72.0)

var category_id: String = ""
var active: bool = false:
	set(value):
		active = value
		_restyle()

var _logo := TextureRect.new()
var _count := Label.new()


static func create(
	id: String, texture: Texture2D, label: String, reached: int, total: int, selected: bool = false
) -> HubAchievementFilter:
	var filter := HubAchievementFilter.new()
	filter.category_id = id
	filter.tooltip_text = label
	filter.active = selected
	filter._logo.texture = texture
	filter._count.text = "%d/%d" % [reached, total]
	return filter


func _init() -> void:
	name = "AchievementFilter"
	custom_minimum_size = SIZE
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_logo.name = "GameLogo"
	_logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_logo.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_logo.position = Vector2(18.0, 5.0)
	_logo.size = Vector2(40.0, 38.0)
	_logo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = MONO_LOGO_SHADER
	_logo.material = material
	add_child(_logo)
	_count.name = "Progress"
	_count.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_count.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_count.position = Vector2(3.0, 44.0)
	_count.size = Vector2(SIZE.x - 6.0, 22.0)
	_count.add_theme_font_override("font", XomDaoUi.display_font(800))
	_count.add_theme_font_size_override("font_size", 16)
	_count.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_count)
	pressed.connect(func() -> void: XomDaoUi.play(self, XomDaoUi.SOUND_TAP))
	button_down.connect(func() -> void: XomDaoUi.bounce(self))
	_restyle()


func _restyle() -> void:
	var background: Color = XomDaoUi.SEA_DEEP if active else XomDaoUi.PAPER
	var border: Color = XomDaoUi.HONEY if active else XomDaoUi.PAPER_DARK
	var style: StyleBoxFlat = XomDaoUi.box(background, border, 2, 16.0)
	style.set_content_margin_all(0.0)
	add_theme_stylebox_override("normal", style)
	add_theme_stylebox_override("pressed", style)
	var hover: StyleBoxFlat = style.duplicate()
	hover.bg_color = background.lightened(0.08) if active else background.darkened(0.04)
	add_theme_stylebox_override("hover", hover)
	add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	var ink: Color = XomDaoUi.CREAM if active else XomDaoUi.INK
	_count.add_theme_color_override("font_color", ink)
	_count.add_theme_color_override("font_hover_color", ink)
	_count.add_theme_color_override("font_pressed_color", ink)
	var material := _logo.material as ShaderMaterial
	if material != null:
		material.set_shader_parameter("tint", ink)


static func logo_for_game(game_id: String) -> Texture2D:
	var path := "res://hub/select/logo/%s.svg" % game_id
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	return XomDaoUi.icon("trophy")
