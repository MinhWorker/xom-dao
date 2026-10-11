class_name HubMatchRow
extends PanelContainer
## One finished game on Nhà's Lịch sử page: how it ended for you on a coloured chip (Thắng, Thua,
## Hoà), the game, who else sat at the table, and when it was and how long it took. Named
## `Match_<index>`.
##
##   var row := HubMatchRow.create(record, "Tiến Lên", Time.get_unix_time_from_system() * 1000.0)

const HEIGHT := 92.0

var _outcome := Label.new()
var _chip := PanelContainer.new()
var _game := Label.new()
var _others := Label.new()
var _when := Label.new()


## `game_name` names the game; `now_ms` is the time now (epoch milliseconds), for "3 giờ trước".
static func create(record: XomDaoMatchRecord, game_name: String, now_ms: float) -> HubMatchRow:
	var row := HubMatchRow.new()
	var colors: Dictionary = {
		"win": XomDaoUi.UP_ON_PAPER, "loss": XomDaoUi.DOWN_ON_PAPER, "draw": XomDaoUi.HONEY_DARK
	}
	var words: Dictionary = {"win": "Thắng", "loss": "Thua", "draw": "Hoà"}
	row._outcome.text = str(words.get(record.outcome, "Hoà"))
	row._outcome.name = "MatchOutcome"
	var fill: Color = colors.get(record.outcome, XomDaoUi.HONEY_DARK)
	var style: StyleBoxFlat = XomDaoUi.box(fill, Color.TRANSPARENT, 0, 16.0)
	style.content_margin_left = 16.0
	style.content_margin_right = 16.0
	row._chip.add_theme_stylebox_override("panel", style)
	row._game.text = game_name
	var names: Array[String] = []
	for player: XomDaoMatchPlayer in record.players:
		if not player.me:
			names.append(player.name)
	row._others.text = "với " + ", ".join(names) if not names.is_empty() else "Chơi một mình"
	row._when.text = "%s · %s" % [ago(now_ms - record.ended_at), took(record)]
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
	box.set_content_margin_all(14.0)
	add_theme_stylebox_override("panel", box)
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 18)
	add_child(line)
	_chip.custom_minimum_size = Vector2(112.0, 56.0)
	_chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_outcome.add_theme_font_override("font", XomDaoUi.display_font(800))
	_outcome.add_theme_font_size_override("font_size", 28)
	_outcome.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_outcome.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_outcome.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_chip.add_child(_outcome)
	line.add_child(_chip)
	var words := VBoxContainer.new()
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	words.alignment = BoxContainer.ALIGNMENT_CENTER
	words.add_theme_constant_override("separation", -2)
	line.add_child(words)
	_game.name = "MatchGame"
	_game.add_theme_font_override("font", XomDaoUi.display_font(800))
	_game.add_theme_font_size_override("font_size", 30)
	words.add_child(_game)
	_others.theme_type_variation = "SmallLabel"
	_others.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.75))
	_others.clip_text = true
	_others.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	words.add_child(_others)
	_when.theme_type_variation = "SmallLabel"
	_when.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.6))
	_when.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(_when)
