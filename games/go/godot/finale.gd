class_name GoFinale
extends Control
## The end beat the hub waits for before its result board (`wait`). After a count, each side's
## territory washes over the board row by row in its colour, then a lacquer plaque comes up with
## the two counts ticking up (Đen, Trắng) and a gold wave runs through the winner's stones from
## the middle of the board. After a resignation or a leaver the wave and the plaque come at once.
## The plaque says it from your side ("Thắng rồi!", "Thua rồi"; someone watching reads who won)
## with the outcome sound. A tap skips it.
##
## `arm()` when the end arrives, `play()` to run it, `reset()` for a new game.

signal done

enum Step { IDLE, ARMED, PLAYING, DONE }

const SIZE := 19
const INK := Color("#1B1B1B")
const SHELL := Color("#F5F2EA")
const GOLD := Color("#E7B53C")
const CREAM := Color("#FFF3DE")
const PLAQUE := Color(0.025, 0.02, 0.015, 0.9)
const PLAQUE_EDGE := Color("#C3A66C")
## Seconds the plaque stays before the result board may come up.
const HOLD := 1.5

var step: Step = Step.IDLE

var _plaque := PanelContainer.new()
var _headline := Label.new()
var _scores := HBoxContainer.new()
var _counts: Array[Label] = []
var _line := Label.new()
var _timeline: Tween
var _sound := Callable()
var _board: String = ""
var _owner: String = ""
var _winner: String = ""
var _origin := Vector2.ZERO
var _cell: float = 30.0
var _totals := Vector2.ZERO
var _wash: float = -1.0:
	set(value):
		_wash = value
		queue_redraw()
var _wave: float = -1.0:
	set(value):
		_wave = value
		queue_redraw()
var _tally: float = 0.0:
	set(value):
		_tally = value
		_show_counts()


func _init() -> void:
	name = "Finale"
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_plaque.name = "EndPlaque"
	_plaque.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_plaque.visible = false
	var style: StyleBoxFlat = XomDaoUi.box(PLAQUE, PLAQUE_EDGE, 2, 18.0)
	style.content_margin_left = 34.0
	style.content_margin_right = 34.0
	style.content_margin_top = 10.0
	style.content_margin_bottom = 16.0
	style.shadow_color = Color(0.0, 0.0, 0.0, 0.55)
	style.shadow_size = 18
	style.shadow_offset = Vector2(0.0, 8.0)
	_plaque.add_theme_stylebox_override("panel", style)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 4)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_plaque.add_child(column)
	_headline.name = "EndHeadline"
	_headline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_headline.add_theme_font_override("font", XomDaoUi.display_font(900))
	_headline.add_theme_font_size_override("font_size", 52)
	_headline.add_theme_color_override("font_color", CREAM)
	column.add_child(_headline)
	_scores.name = "EndScores"
	_scores.alignment = BoxContainer.ALIGNMENT_CENTER
	_scores.add_theme_constant_override("separation", 28)
	column.add_child(_scores)
	for side: String in ["b", "w"]:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		_scores.add_child(row)
		var stone := TextureRect.new()
		stone.texture = load(
			"res://content/go/art/stone-%s.webp" % ("black" if side == "b" else "white")
		)
		stone.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		stone.custom_minimum_size = Vector2(38.0, 38.0)
		stone.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(stone)
		var count := Label.new()
		count.name = "EndCount_" + side
		count.add_theme_font_override("font", XomDaoUi.display_font(800))
		count.add_theme_font_size_override("font_size", 36)
		count.add_theme_color_override("font_color", CREAM)
		row.add_child(count)
		_counts.append(count)
	_line.name = "EndLine"
	_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_line.add_theme_font_override("font", XomDaoUi.body_font(true))
	_line.add_theme_font_size_override("font_size", 26)
	_line.add_theme_color_override("font_color", Color("#D5C4A4"))
	column.add_child(_line)
	add_child(_plaque)


## A new game: nothing ended yet.
func reset() -> void:
	if _timeline != null:
		_timeline.kill()
	step = Step.IDLE
	_wash = -1.0
	_wave = -1.0
	_plaque.visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## The end arrived. `live`: seen as it happened (not on joining a finished table, which skips it).
func arm(live: bool) -> void:
	if step == Step.IDLE:
		step = Step.ARMED if live else Step.DONE


## Returns once the beat is over (or never had to play).
func wait() -> void:
	while step == Step.ARMED or step == Step.PLAYING:
		await done


## Plays the beat. `spec`: headline, line, winner ("b", "w"), board and owner (the view's board
## and the count's owner, "" without a count), score (Vector2 of Black's and White's count, or
## null), origin and cell (where point 0 is and the gap between lines), board_rect, count_sound
## and sound (Callables).
func play(spec: Dictionary) -> void:
	if step != Step.ARMED:
		return
	step = Step.PLAYING
	mouse_filter = Control.MOUSE_FILTER_STOP
	_sound = spec["sound"]
	_board = spec["board"]
	_owner = spec["owner"]
	_winner = spec["winner"]
	_origin = spec["origin"]
	_cell = float(spec["cell"])
	_headline.text = spec["headline"]
	_line.text = spec["line"]
	var score: Variant = spec.get("score")
	_scores.visible = score is Vector2
	_totals = score if score is Vector2 else Vector2.ZERO
	_tally = 0.0
	for i: int in 2:
		var lead: bool = (i == 0) == (_winner == "b")
		_counts[i].add_theme_color_override("font_color", GOLD if lead else CREAM)
	_plaque.reset_size()
	_plaque.pivot_offset = _plaque.size / 2.0
	var board: Rect2 = spec["board_rect"]
	_plaque.position = board.get_center() - _plaque.size / 2.0
	_timeline = create_tween()
	if _owner != "":
		_timeline.tween_callback(spec["count_sound"])
		_timeline.tween_property(self, "_wash", 1.0, 1.0).from(0.0)
	_timeline.tween_callback(_raise)
	if _scores.visible:
		_timeline.tween_property(self, "_tally", 1.0, 0.6).set_trans(Tween.TRANS_CUBIC).set_ease(
			Tween.EASE_OUT
		)
	_timeline.tween_callback(_cheer)
	_timeline.tween_property(self, "_wave", 1.0, 0.9).from(0.0)
	_timeline.tween_interval(HOLD - 0.9)
	_timeline.tween_callback(_finish)


## Hub hook: the result board in kaya wood and ink, with the bowl of stones on top.
static func theme(view: Dictionary) -> Dictionary:
	var end: Variant = view.get("end")
	var counted: bool = end is Dictionary and str((end as Dictionary).get("reason", "")) == "score"
	return {
		"paper": Color("#F3E4C4"),
		"ink": Color("#2B1E14"),
		"accent": Color("#7A3B1E"),
		"shade": Color("#0B0806", 0.6),
		"title": "Đếm mục" if counted else "Thu quân",
		"emblem": preload("res://content/go/art/emblem.webp"),
	}


## 7.5 → "7,5" (Vietnamese decimals).
static func number(value: float) -> String:
	if is_equal_approx(value, roundf(value)):
		return str(int(value))
	return str(value).replace(".", ",")


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (
		(event is InputEventMouseButton and (event as InputEventMouseButton).pressed)
		or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed)
	)
	if pressed and step == Step.PLAYING:
		accept_event()
		if _timeline != null:
			_timeline.kill()
		_cheer()
		_finish()


func _raise() -> void:
	_plaque.visible = true
	_plaque.modulate.a = 0.0
	_plaque.scale = Vector2.ONE * 0.9
	var tween: Tween = _plaque.create_tween().set_parallel()
	tween.tween_property(_plaque, "modulate:a", 1.0, 0.16)
	tween.tween_property(_plaque, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)


## The final counts and the outcome sound.
func _cheer() -> void:
	_tally = 1.0
	if _sound.is_valid():
		_sound.call()
		_sound = Callable()


func _show_counts() -> void:
	_counts[0].text = number(snappedf(_totals.x * _tally, 0.5))
	_counts[1].text = number(snappedf(_totals.y * _tally, 0.5))


## The beat is over: the plaque and the washes fade as the result board comes in.
func _finish() -> void:
	if step == Step.DONE:
		return
	step = Step.DONE
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fade: Tween = create_tween().set_parallel()
	fade.tween_property(self, "modulate:a", 0.0, 0.35)
	fade.chain().tween_callback(
		func() -> void:
			_wash = -1.0
			_wave = -1.0
			_plaque.visible = false
			modulate.a = 1.0
	)
	done.emit()


## The territory washes (rows revealed top to bottom) and the gold wave through the winner's
## stones (spreading from the middle).
func _draw() -> void:
	if _wash >= 0.0 and _owner != "":
		var half: float = _cell * 0.48
		for p: int in _owner.length():
			var side: String = _owner[p]
			if side == "." or (p < _board.length() and _board[p] == side):
				continue
			var shown: float = clampf((_wash * (SIZE + 4) - p / SIZE) / 4.0, 0.0, 1.0)
			if shown <= 0.0:
				continue
			var at: Vector2 = _origin + Vector2(p % SIZE, p / SIZE) * _cell
			var color: Color = Color(INK, 0.34) if side == "b" else Color(SHELL, 0.42)
			color.a *= shown
			draw_rect(Rect2(at - Vector2.ONE * half, Vector2.ONE * half * 2.0), color)
	if _wave < 0.0:
		return
	var middle := Vector2(SIZE - 1, SIZE - 1) / 2.0
	var reach: float = middle.length() + 2.0
	for p: int in _board.length():
		if _board[p] != _winner:
			continue
		var grid := Vector2(p % SIZE, p / SIZE)
		var front: float = _wave * reach - grid.distance_to(middle)
		var glow: float = clampf(1.0 - absf(front - 1.0) / 2.0, 0.0, 1.0)
		if front > 1.0:
			glow = maxf(glow, 0.35)
		if glow <= 0.0:
			continue
		var at: Vector2 = _origin + grid * _cell
		draw_arc(at, _cell * 0.5, 0.0, TAU, 24, Color(GOLD, glow), maxf(2.0, _cell * 0.1), true)
