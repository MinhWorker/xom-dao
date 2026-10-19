class_name HubMatchRow
extends PanelContainer
## One finished game on Nhà's Lịch sử page. Its monochrome game logo, the result, opponents,
## relative end time and duration are split into clear columns. Named `Match_<index>`.

const HEIGHT := 92.0
const MONO_LOGO_SHADER: Shader = preload("res://hub/home/achievement_logo.gdshader")

var _logo := TextureRect.new()
var _outcome := Label.new()
var _chip := PanelContainer.new()
var _game := Label.new()
var _others := Label.new()
var _when := Label.new()
var _duration := Label.new()


## `game_name` names the game; `now_ms` is the time now (epoch milliseconds), for "3 giờ trước".
static func create(record: XomDaoMatchRecord, game_name: String, now_ms: float) -> HubMatchRow:
	var row := HubMatchRow.new()
	var colors: Dictionary = {
		"win": XomDaoUi.UP_ON_PAPER, "loss": XomDaoUi.DOWN_ON_PAPER, "draw": XomDaoUi.HONEY_DARK
	}
	var words: Dictionary = {"win": "Thắng", "loss": "Thua", "draw": "Hoà"}
	row._outcome.text = str(words.get(record.outcome, "Hoà"))
	row._outcome.name = "MatchOutcome"
	row._game.text = game_name
	row._logo.texture = HubAchievementFilter.logo_for_game(record.game_id)
	row._logo.tooltip_text = game_name
	var logo_material := row._logo.material as ShaderMaterial
	if logo_material != null:
		logo_material.set_shader_parameter("tint", Color(XomDaoUi.INK, 0.78))
	var fill: Color = colors.get(record.outcome, XomDaoUi.HONEY_DARK)
	var style: StyleBoxFlat = XomDaoUi.box(fill, Color.TRANSPARENT, 0, 14.0)
	style.content_margin_left = 12.0
	style.content_margin_right = 12.0
	row._chip.add_theme_stylebox_override("panel", style)
	var names: Array[String] = []
	for player: XomDaoMatchPlayer in record.players:
		if not player.me:
			names.append(player.name)
	row._others.text = "với " + ", ".join(names) if not names.is_empty() else "Chơi một mình"
	row._when.text = ago(now_ms - record.ended_at)
	row._duration.text = took(record)
	return row


## "Vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước".
static func ago(ms: float) -> String:
	var minutes: int = int(maxf(0.0, ms) / 60000.0)
	if minutes < 1:
		return "Vừa xong"
	if minutes < 60:
		return "%d phút trước" % minutes
	if minutes < 60 * 24:
		return "%d giờ trước" % int(minutes / 60.0)
	return "%d ngày trước" % int(minutes / 1440.0)


## How long the game lasted: "45 giây", "12 phút".
static func took(record: XomDaoMatchRecord) -> String:
	var seconds: int = int(maxf(0.0, record.ended_at - record.started_at) / 1000.0)
	return "%d giây" % seconds if seconds < 60 else "%d phút" % int(seconds / 60.0)


func _init() -> void:
	custom_minimum_size.y = HEIGHT
	var box: StyleBoxFlat = XomDaoUi.box(Color("#FFF9EC"), XomDaoUi.PAPER_DARK, 2, 18.0)
	box.set_content_margin_all(12.0)
	add_theme_stylebox_override("panel", box)
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 14)
	add_child(line)
	_logo.name = "GameLogo"
	_logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_logo.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_logo.custom_minimum_size = Vector2(54.0, 54.0)
	_logo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var logo_material := ShaderMaterial.new()
	logo_material.shader = MONO_LOGO_SHADER
	_logo.material = logo_material
	line.add_child(_logo)
	var words := VBoxContainer.new()
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	words.alignment = BoxContainer.ALIGNMENT_CENTER
	words.add_theme_constant_override("separation", 1)
	line.add_child(words)
	_game.name = "MatchGame"
	_game.add_theme_font_override("font", XomDaoUi.display_font(800))
	_game.add_theme_font_size_override("font_size", 26)
	_game.add_theme_color_override("font_color", XomDaoUi.INK)
	_game.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	words.add_child(_game)
	_others.name = "MatchPlayers"
	_others.theme_type_variation = "SmallLabel"
	_others.add_theme_font_size_override("font_size", 18)
	_others.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.7))
	_others.clip_text = true
	_others.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	words.add_child(_others)
	_chip.name = "MatchResult"
	_chip.custom_minimum_size = Vector2(84.0, 44.0)
	_chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_outcome.add_theme_font_override("font", XomDaoUi.display_font(800))
	_outcome.add_theme_font_size_override("font_size", 22)
	_outcome.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_outcome.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_outcome.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_chip.add_child(_outcome)
	line.add_child(_chip)
	var meta := VBoxContainer.new()
	meta.name = "MatchMeta"
	meta.custom_minimum_size.x = 118.0
	meta.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	meta.alignment = BoxContainer.ALIGNMENT_CENTER
	meta.add_theme_constant_override("separation", 3)
	line.add_child(meta)
	_when.name = "MatchWhen"
	_when.theme_type_variation = "SmallLabel"
	_when.add_theme_font_size_override("font_size", 16)
	_when.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.62))
	_when.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_when.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	meta.add_child(_when)
	var duration_line := HBoxContainer.new()
	duration_line.alignment = BoxContainer.ALIGNMENT_END
	duration_line.add_theme_constant_override("separation", 5)
	meta.add_child(duration_line)
	var clock := TextureRect.new()
	clock.name = "MatchDurationIcon"
	clock.texture = XomDaoUi.icon("clock")
	clock.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	clock.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	clock.custom_minimum_size = Vector2(16.0, 16.0)
	clock.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	clock.modulate = XomDaoUi.HONEY_DARK
	clock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	duration_line.add_child(clock)
	_duration.name = "MatchDuration"
	_duration.add_theme_font_override("font", XomDaoUi.display_font(700))
	_duration.add_theme_font_size_override("font_size", 17)
	_duration.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.82))
	duration_line.add_child(_duration)
