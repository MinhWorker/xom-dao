extends Control
## The boards over Mậu Binh's table (main.gd): Luật tính điểm and Kết quả các vòng, opened with
## their buttons in the top right corner, and each round's standings ("Kết quả vòng 2", best
## first, with the seconds to the next deal) once its totals are up. main.gd feeds it the view
## with `show_view` and the free area with `place`.
##
## Named nodes for tests: RulesButton, ResultsButton, Scoring (Luật tính điểm), Standings
## (Standing_<place>, StandingsFooter), Results (RoundTabs, Entry_<seat>, ResultsEmpty).

const Rules := preload("res://content/mau-binh/rules.gd")

const PLACES: Array[String] = ["Nhất", "Nhì", "Ba", "Tư"]
const PLACE_COLORS: Array[Color] = [
	XomDaoUi.GOLD_DARK, Color("#5E6B78"), Color("#A0582A"), Color("#5E6B78")
]
## The cards of Kết quả các vòng: their width, how far the next card in a row starts (in card
## widths) and how far up the next row goes (in card heights).
const CARD := 34.0
const STEP_X := 0.56
const STEP_Y := 0.55
const ROW_START: Array[int] = [0, 5, 10]
## An entry of Kết quả các vòng: its width and the room its three chi lines take.
const ENTRY_WIDTH := 440.0
const CHI_WIDTH := 270.0
const GAP := 12.0

var rules_button: XomDaoButton = XomDaoButton.create("Luật", XomDaoUi.Kind.INFO)
var results_button: XomDaoButton = XomDaoButton.create("Kết quả", XomDaoUi.Kind.INFO)

var _shade := ColorRect.new()
var _scoring: XomDaoBoard = XomDaoBoard.create("Luật tính điểm", true)
var _standings: XomDaoBoard = XomDaoBoard.create("", true)
var _footer := Label.new()
var _results: XomDaoBoard = XomDaoBoard.create("Kết quả các vòng", true)
var _tabs := XomDaoChoice.new()
var _scroll := ScrollContainer.new()
var _entries := GridContainer.new()
var _empty := Label.new()

var _view: Dictionary = {}
var _snapshot: XomDaoRoomSnapshot
var _me: int = -1
var _names: Array[String] = []
var _totals_shown: bool = false
var _shown_at: int = 0
## The round whose standings were opened: closed, they stay closed for that round.
var _standings_round: int = -1
## The rounds Kết quả các vòng shows, and the free area of the table.
var _rounds: Array = []
var _area := Rect2()


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	rules_button.name = "RulesButton"
	rules_button.pressed.connect(open_rules)
	results_button.name = "ResultsButton"
	results_button.pressed.connect(open_results)
	for button: XomDaoButton in [rules_button, results_button]:
		button.custom_minimum_size = Vector2(0.0, XomDaoUi.TOUCH)
		button.visible = false
		add_child(button)
	_standings.name = "Standings"
	_standings.content.add_theme_constant_override("separation", 6)
	_footer.name = "StandingsFooter"
	_footer.theme_type_variation = "SmallLabel"
	_footer.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_standings.content.add_child(_footer)
	_shade.color = Color(XomDaoUi.INK, 0.45)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.gui_input.connect(_on_shade_input)
	_scoring.name = "Scoring"
	_results.name = "Results"
	_tabs.name = "RoundTabs"
	_tabs.changed.connect(func(_index: int) -> void: _fill_results())
	_results.content.add_child(_tabs)
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.add_child(_entries)
	_entries.add_theme_constant_override("h_separation", int(GAP))
	_entries.add_theme_constant_override("v_separation", int(GAP))
	_results.content.add_child(_scroll)
	_empty.name = "ResultsEmpty"
	_empty.text = "Chưa có vòng nào xong"
	_empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_results.content.add_child(_empty)
	for node: Control in [_standings, _shade, _scoring, _results]:
		node.visible = false
		add_child(node)
	for board: XomDaoBoard in [_standings, _scoring, _results]:
		board.closed.connect(_on_closed)


func _process(_delta: float) -> void:
	if not _standings.visible or _snapshot == null:
		return
	var timer: XomDaoRoomTimer = _snapshot.timer
	var text: String = ""
	if timer != null and timer.event == "next-round" and _snapshot.result == null:
		var left: float = timer.left - (Time.get_ticks_msec() - _shown_at)
		var seconds: int = ceili(maxf(0.0, left) / 1000.0)
		text = "Vòng %d bắt đầu sau %d giây" % [int(_view["round"]) + 1, seconds]
	if _footer.text != text:
		_footer.text = text


## The latest view; `names` by seat ("Bạn" for yours), `totals_shown` once the round's points
## are up on the table.
func show_view(
	view: Dictionary,
	snapshot: XomDaoRoomSnapshot,
	me: int,
	names: Array[String],
	totals_shown: bool,
) -> void:
	if snapshot != _snapshot:
		_shown_at = Time.get_ticks_msec()
	_view = view
	_snapshot = snapshot
	_me = me
	_names = names
	_totals_shown = totals_shown
	rules_button.visible = true
	results_button.visible = true
	var round_number: int = int(view["round"])
	var up: bool = (
		str(view["phase"]) == "show"
		and totals_shown
		and snapshot.result == null
		and round_number < int(view["rounds"])
	)
	if not up:
		_standings.visible = false
	elif _standings_round != round_number:
		_standings_round = round_number
		_fill_standings()
		_standings.visible = true
		_place_boards()
		_standings.open()
	if _results.visible and _done_rounds().size() != _rounds.size():
		_fill_results(true)


## Puts the buttons in the top right of `area` and the boards in its middle.
func place(area: Rect2) -> void:
	_area = area
	var x: float = area.end.x
	for button: XomDaoButton in [results_button, rules_button]:
		button.reset_size()
		x -= button.size.x
		button.position = Vector2(x, area.position.y)
		x -= GAP
	_place_boards()


func open_rules() -> void:
	_results.visible = false
	_fill_scoring()
	_open(_scoring)


func open_results() -> void:
	_scoring.visible = false
	_fill_results(true)
	_open(_results)


func _open(board: XomDaoBoard) -> void:
	_shade.visible = true
	board.visible = true
	_place_boards()
	board.open()


func _on_shade_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		_scoring.visible = false
		_results.visible = false
		_shade.visible = false


func _on_closed() -> void:
	_shade.visible = _scoring.visible or _results.visible


## Each board as big as it wants, shrunk to fit the area, in its middle.
func _place_boards() -> void:
	if _results.visible:
		_size_results()
	for board: XomDaoBoard in [_standings, _scoring, _results]:
		if not board.visible:
			continue
		board.reset_size()
		var room: Vector2 = _area.size
		var fit: float = minf(1.0, minf(room.x / board.size.x, room.y / board.size.y))
		board.pivot_offset = board.size / 2.0
		board.scale = Vector2.ONE * fit
		board.position = _area.get_center() - board.size / 2.0


static func _label(text: String, font_size: int, color: Color = XomDaoUi.INK) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return label


static func _clear(box: Container) -> void:
	for child: Node in box.get_children():
		box.remove_child(child)
		child.queue_free()


# ── Luật tính điểm ────────────────────────────────────────────────────────────────────────


## The scoring rules of this room, as scoring.ts has them: the duels and chi bonuses on the
## left, tới trắng on the right.
func _fill_scoring() -> void:
	_clear(_scoring.content)
	var options: Dictionary = _snapshot.options if _snapshot.options is Dictionary else {}
	var heading := _label(
		(
			"%d vòng · %d giây xếp bài"
			% [int(_view.get("rounds", 1)), int(options.get("arrangeSeconds", 90))]
		),
		XomDaoUi.TEXT,
		XomDaoUi.HONEY_DARK
	)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_scoring.content.add_child(heading)
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 32)
	_scoring.content.add_child(columns)
	var left: Array = [
		["Chi 1 (5 lá) ≥ chi 2 (5 lá) ≥ chi 3 (3 lá)"],
		["So từng chi với từng người"],
		["Thắng / thua một chi", "+%d / −%d" % [Rules.CHI_POINT, Rules.CHI_POINT]],
		["Sập 3 chi (thắng cả ba)", "thêm +%d" % Rules.SCOOP_BONUS],
		["Binh lủng, với mỗi người", "−%d" % Rules.FOUL_POINTS],
		["Thắng chi bằng bộ đặc biệt"],
	]
	for bonus: Array in Rules.CHI_BONUSES:
		left.append([bonus[3], "+%d" % int(bonus[2])])
	var right: Array = [["Tới trắng (thắng luôn mỗi người)"]]
	var kinds: Array = Rules.SPECIAL_NAMES.keys()
	kinds.reverse()
	for kind: Variant in kinds:
		right.append([Rules.SPECIAL_NAMES[kind], "+%d" % int(Rules.SPECIAL_POINTS[kind])])
	for lines: Array in [left, right]:
		var column := VBoxContainer.new()
		column.custom_minimum_size.x = 400.0
		column.add_theme_constant_override("separation", 2)
		columns.add_child(column)
		for line: Array in lines:
			column.add_child(_scoring_line(line, line == lines[0] and lines == left))


## A heading (one word on its own, or the first line, a note) or a rule and its points.
static func _scoring_line(line: Array, note: bool) -> Control:
	if line.size() == 1:
		var heading := _label(str(line[0]), 26, XomDaoUi.INK if note else XomDaoUi.HONEY_DARK)
		heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		if note:
			heading.theme_type_variation = "SmallLabel"
			heading.remove_theme_font_override("font")
			heading.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
		return heading
	var row := HBoxContainer.new()
	var text := Label.new()
	text.theme_type_variation = "SmallLabel"
	text.text = str(line[0])
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(text)
	row.add_child(_label(str(line[1]), XomDaoUi.TEXT_MIN, XomDaoUi.LACQUER_DARK))
	return row


# ── Kết quả vòng N ────────────────────────────────────────────────────────────────────────


## The round's points, best first, each with how it went: binh lủng or tới trắng, the match
## total, and against you.
func _fill_standings() -> void:
	_standings.content.remove_child(_footer)
	_clear(_standings.content)
	var results: Array = _view["results"]
	var result: Dictionary = results[results.size() - 1]
	_standings.title = "Kết quả vòng %d" % int(_view["round"])
	var points: Array = result["points"]
	var seats: Array[int] = []
	for seat: int in (result["rows"] as Array).size():
		if (result["rows"] as Array)[seat] != null:
			seats.append(seat)
	seats.sort_custom(
		func(a: int, b: int) -> bool:
			return int(points[a]) > int(points[b]) or (points[a] == points[b] and a < b)
	)
	for place: int in seats.size():
		var seat: int = seats[place]
		var marks: Array[String] = []
		var mark: Array = _mark_of(result, seat)
		if not mark.is_empty():
			marks.append(str(mark[0]))
		marks.append("Tổng %d" % int((_view["points"] as Array)[seat]))
		if _me >= 0 and seat != _me and (result["rows"] as Array)[_me] != null:
			var against: int = _against(result, seat, _me)
			marks.append("với bạn %s" % (XomDaoUi.delta(against) if against != 0 else "0"))
		var row: Control = _standing_row(place, seat, int(points[seat]), " · ".join(marks))
		row.name = "Standing_%d" % place
		_standings.content.add_child(row)
		row.modulate.a = 0.0
		row.create_tween().tween_property(row, "modulate:a", 1.0, 0.26).set_delay(
			0.18 + place * 0.14
		)
	_footer.text = ""
	_standings.content.add_child(_footer)


func _standing_row(place: int, seat: int, points: int, note: String) -> Control:
	var back := PanelContainer.new()
	var fill: Color = Color(XomDaoUi.GOLD, 0.35) if seat == _me else Color(XomDaoUi.INK, 0.08)
	var style: StyleBoxFlat = XomDaoUi.box(fill, Color.TRANSPARENT, 0, 14.0)
	style.content_margin_left = 12.0
	style.content_margin_right = 16.0
	style.content_margin_top = 4.0
	style.content_margin_bottom = 4.0
	back.add_theme_stylebox_override("panel", style)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	back.add_child(row)
	var rank := _label(PLACES[mini(place, PLACES.size() - 1)], 28, PLACE_COLORS[mini(place, 3)])
	rank.custom_minimum_size.x = 72.0
	row.add_child(rank)
	var avatar := XomDaoAvatar.new()
	avatar.custom_minimum_size = Vector2(56.0, 56.0)
	avatar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	avatar.initial = _names[seat] if seat < _names.size() else "?"
	if seat < _snapshot.seats.size():
		avatar.frame = _snapshot.seats[seat].frame
	row.add_child(avatar)
	var words := VBoxContainer.new()
	words.add_theme_constant_override("separation", -4)
	words.custom_minimum_size.x = 300.0
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(words)
	var who := _label(_names[seat] if seat < _names.size() else "", 28)
	who.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	words.add_child(who)
	var under := Label.new()
	under.theme_type_variation = "SmallLabel"
	under.text = note
	under.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.75))
	words.add_child(under)
	row.add_child(
		_label(
			XomDaoUi.delta(points) if points != 0 else "0",
			XomDaoUi.TEXT,
			XomDaoUi.delta_color(points, true)
		)
	)
	return back


## Bỏ cuộc, binh lủng, tới trắng or rows arranged by the computer: [text, colour], or [].
static func _mark_of(result: Dictionary, seat: int) -> Array:
	var special: Variant = (result["specials"] as Array)[seat]
	if bool((result["forfeits"] as Array)[seat]):
		return ["Bỏ cuộc", XomDaoUi.DOWN_ON_PAPER]
	if bool((result["fouls"] as Array)[seat]):
		return ["Binh lủng", XomDaoUi.DOWN_ON_PAPER]
	if special != null:
		return [Rules.SPECIAL_NAMES.get(str(special), ""), XomDaoUi.GOLD_DARK]
	if bool((result["auto"] as Array)[seat]):
		return ["Hết giờ, máy xếp", XomDaoUi.HONEY_DARK]
	return []


## What `seat` won from `other` in a round, all duels counted.
static func _against(result: Dictionary, seat: int, other: int) -> int:
	for item: Variant in result["duels"]:
		var duel: Dictionary = item
		var a: int = int(duel["a"])
		var b: int = int(duel["b"])
		if a == seat and b == other:
			return int(duel["points"])
		if a == other and b == seat:
			return -int(duel["points"])
	return 0


# ── Kết quả các vòng ──────────────────────────────────────────────────────────────────────


## Every finished round; the one being revealed joins once its totals are up.
func _done_rounds() -> Array:
	var results: Array = _view.get("results", [])
	var pending: bool = str(_view.get("phase", "")) == "show" and not _totals_shown
	return results.slice(0, results.size() - (1 if pending and not results.is_empty() else 0))


## One tab per round (the last one picked when `fresh`), and the picked round's players.
func _fill_results(fresh: bool = false) -> void:
	var rounds: Array = _done_rounds()
	if fresh:
		var labels: Array[String] = []
		for i: int in rounds.size():
			labels.append(("Vòng %d" if rounds.size() <= 5 else "%d") % (i + 1))
		if labels != _tabs.options:
			_tabs.options = labels
			_tabs.selected = rounds.size() - 1
	_rounds = rounds
	_tabs.visible = not rounds.is_empty()
	_scroll.visible = not rounds.is_empty()
	_empty.visible = rounds.is_empty()
	_clear(_entries)
	if rounds.is_empty():
		return
	var result: Dictionary = rounds[clampi(_tabs.selected, 0, rounds.size() - 1)]
	for seat: int in (result["rows"] as Array).size():
		if (result["rows"] as Array)[seat] != null:
			_entries.add_child(_entry(result, seat))
	_place_boards()


## Two columns when the area is wide enough; the list scrolls when it is too tall.
func _size_results() -> void:
	var wide: bool = _area.size.x >= 2.0 * ENTRY_WIDTH + GAP + 120.0
	_entries.columns = 2 if wide and _entries.get_child_count() > 1 else 1
	var grid: Vector2 = _entries.get_combined_minimum_size()
	var room: float = maxf(160.0, _area.size.y - 280.0)
	_scroll.custom_minimum_size = Vector2(grid.x, minf(grid.y, room))


## A player's round: name, mark and points, the three rows of cards, each chi's hand and what
## it won (yours against everyone, theirs against you).
func _entry(result: Dictionary, seat: int) -> Control:
	var back := PanelContainer.new()
	back.name = "Entry_%d" % seat
	back.custom_minimum_size.x = ENTRY_WIDTH
	var fill: Color = Color(XomDaoUi.GOLD, 0.3) if seat == _me else Color(XomDaoUi.INK, 0.08)
	var style: StyleBoxFlat = XomDaoUi.box(fill, Color.TRANSPARENT, 0, 14.0)
	style.set_content_margin_all(10.0)
	back.add_theme_stylebox_override("panel", style)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	back.add_child(column)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 10)
	column.add_child(head)
	var who := _label(_names[seat] if seat < _names.size() else "", 28)
	who.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	who.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(who)
	var mark: Array = _mark_of(result, seat)
	if not mark.is_empty():
		head.add_child(_label(str(mark[0]), XomDaoUi.TEXT_MIN, mark[1]))
	var points: int = int((result["points"] as Array)[seat])
	head.add_child(
		_label(
			XomDaoUi.delta(points) if points != 0 else "0",
			XomDaoUi.TEXT,
			XomDaoUi.delta_color(points, true)
		)
	)
	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 12)
	column.add_child(body)
	var rows: Array = (result["rows"] as Array)[seat]
	body.add_child(_cards(rows))
	var lines := VBoxContainer.new()
	lines.add_theme_constant_override("separation", 0)
	lines.custom_minimum_size.x = CHI_WIDTH
	body.add_child(lines)
	var against: int = -1
	if seat != _me and _me >= 0 and (result["rows"] as Array)[_me] != null:
		against = _me
	for row: int in [2, 1, 0]:
		var won: Variant = Rules.chi_won(result, seat, row, against)
		var text: String = "Chi %d · %s" % [row + 1, Rules.hand_name(rows[row])]
		if won != null:
			text += " %s" % (XomDaoUi.delta(int(won)) if int(won) != 0 else "0")
		var line := Label.new()
		line.theme_type_variation = "SmallLabel"
		line.text = text
		line.add_theme_color_override(
			"font_color", XomDaoUi.delta_color(int(won), true) if won != null else XomDaoUi.INK
		)
		lines.add_child(line)
	return back


## A player's 13 cards in three overlapping rows, chi 3 on top.
static func _cards(rows: Array) -> Control:
	var block := Control.new()
	var height: float = CARD * XomDaoCard.RATIO
	block.custom_minimum_size = Vector2(CARD * (1.0 + 4.0 * STEP_X), height * (1.0 + 2.0 * STEP_Y))
	for row: int in [2, 1, 0]:
		var cards: Array = rows[row]
		for k: int in cards.size():
			var value: int = int(cards[k])
			var card := XomDaoCard.new()
			card.size = Vector2(CARD, height)
			card.position = Vector2(k * CARD * STEP_X, (2 - row) * height * STEP_Y)
			card.show_face(Rules.RANKS[Rules.rank_of(value)], value % 4)
			block.add_child(card)
	return block
