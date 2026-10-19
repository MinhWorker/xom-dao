class_name HubAchievementTile
extends PanelContainer
## One achievement row on Nhà's shelf. A monochrome game logo identifies its game, while the
## title, progress and reward stay readable without a text category label.

const MONO_LOGO_SHADER: Shader = preload("res://hub/home/achievement_logo.gdshader")

var achievement_id: String = ""

var _logo := TextureRect.new()
var _name := Label.new()
var _progress := ProgressBar.new()
var _count := Label.new()
var _foot := HBoxContainer.new()


static func create(info: XomDaoAchievementInfo, game_name: String = "") -> HubAchievementTile:
	var tile := HubAchievementTile.new()
	tile.achievement_id = info.id
	tile.name = "Achievement_" + info.id.replace(":", "-")
	tile._name.text = info.name
	var source_name: String = (
		"Xóm Đảo" if info.game_id == "" else game_name if game_name != "" else info.game_id
	)
	tile._logo.tooltip_text = source_name
	tile._logo.texture = HubAchievementFilter.logo_for_game(info.game_id)
	var material := tile._logo.material as ShaderMaterial
	material.set_shader_parameter(
		"tint", XomDaoUi.HONEY_DARK if info.unlocked else Color(XomDaoUi.INK, 0.58)
	)
	tile._progress.max_value = maxi(1, info.at)
	tile._progress.value = mini(info.progress, info.at)
	tile._count.text = (
		"Đã đạt" if info.unlocked else "%d/%d" % [mini(info.progress, info.at), info.at]
	)
	var coins: int = int(info.reward.get("core:coin", 0))
	if coins > 0:
		var reward := XomDaoChip.create("+" + XomDaoUi.money(coins), "", XomDaoUi.COIN_DARK)
		reward.name = "AchievementReward"
		reward.compact()
		tile._foot.add_child(reward)
	return tile


func _init() -> void:
	custom_minimum_size = Vector2(0.0, 96.0)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var box: StyleBoxFlat = XomDaoUi.box(XomDaoUi.CREAM, XomDaoUi.PAPER_DARK, 2, 16.0)
	box.set_content_margin_all(12.0)
	add_theme_stylebox_override("panel", box)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	add_child(row)
	_logo.name = "GameLogo"
	_logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_logo.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_logo.custom_minimum_size = Vector2(54.0, 54.0)
	_logo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = MONO_LOGO_SHADER
	_logo.material = material
	row.add_child(_logo)
	var body := VBoxContainer.new()
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 6)
	row.add_child(body)
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 10)
	body.add_child(top)
	_name.name = "AchievementName"
	_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_name.add_theme_font_override("font", XomDaoUi.display_font(800))
	_name.add_theme_font_size_override("font_size", 23)
	_name.add_theme_color_override("font_color", XomDaoUi.INK)
	top.add_child(_name)
	_foot.name = "AchievementRewards"
	_foot.alignment = BoxContainer.ALIGNMENT_END
	_foot.add_theme_constant_override("separation", 6)
	top.add_child(_foot)
	var bottom := HBoxContainer.new()
	bottom.add_theme_constant_override("separation", 10)
	body.add_child(bottom)
	_progress.name = "AchievementProgress"
	_progress.show_percentage = false
	_progress.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_progress.custom_minimum_size.y = 12.0
	var track := StyleBoxFlat.new()
	track.bg_color = Color(XomDaoUi.PAPER_DARK, 0.72)
	track.set_corner_radius_all(6)
	_progress.add_theme_stylebox_override("background", track)
	var fill := StyleBoxFlat.new()
	fill.bg_color = XomDaoUi.GOLD
	fill.set_corner_radius_all(6)
	_progress.add_theme_stylebox_override("fill", fill)
	bottom.add_child(_progress)
	_count.name = "AchievementReached"
	_count.custom_minimum_size.x = 72.0
	_count.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_count.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_count.add_theme_font_override("font", XomDaoUi.display_font(700))
	_count.add_theme_font_size_override("font_size", 18)
	_count.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.76))
	bottom.add_child(_count)
