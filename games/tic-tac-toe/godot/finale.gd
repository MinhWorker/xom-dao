extends Control
## Caro's end beat, which the hub waits for before its result board (`wait`): a pen stroke draws
## through the five in a row in the winner's ink, the five marks hop one after another and the
## gold ring settles round them; then a word is stamped on the page in pen with a hand-drawn ring
## round it, from your side ("Thắng rồi!", "Thua rồi", "Hoà"; someone watching reads who won),
## with the outcome sound. A full page (a draw) only gets the stamp. A tap skips it. The stroke
## stays on the page until the next game.
##
## `arm()` when the end arrives, `play()` once the last mark has landed, `reset()` for a new game.

signal done

enum Step { IDLE, ARMED, PLAYING, DONE }

const INK := Color("#4A2E1C")
## Seconds the stamp stays before the result board may come up.
const HOLD := 1.6

var step: Step = Step.IDLE
## The pen line through the five; the table puts it over the marks.
var stroke := Line2D.new()

var _stamp := Control.new()
var _word: String = ""
var _ink := INK
var _timeline: Tween
var _sound := Callable()
var _ends := Callable()
var _cell: Callable
var _drawn: float = -1.0


func _init() -> void:
	name = "Finale"
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	stroke.name = "WinStroke"
	stroke.begin_cap_mode = Line2D.LINE_CAP_ROUND
	stroke.end_cap_mode = Line2D.LINE_CAP_ROUND
	stroke.joint_mode = Line2D.LINE_JOINT_ROUND
	stroke.antialiased = true
	stroke.visible = false
	_stamp.name = "EndStamp"
	_stamp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_stamp.visible = false
	_stamp.draw.connect(_draw_stamp)
	add_child(_stamp)
	set_process(false)


## A new game: nothing ended yet, the page clean.
func reset() -> void:
	if _timeline != null:
		_timeline.kill()
	step = Step.IDLE
	_drawn = -1.0
	stroke.visible = false
	stroke.clear_points()
	_stamp.visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process(false)


## The end arrived. `live`: seen as it happened (not on joining a finished table, which skips it).
func arm(live: bool) -> void:
	if step == Step.IDLE:
		step = Step.ARMED if live else Step.DONE


func armed() -> bool:
	return step == Step.ARMED


## Nothing ended, or the beat is over: the board may make room for the result board.
func over() -> bool:
	return step == Step.IDLE or step == Step.DONE


## The stamped word for `outcome` ("win", "lose", "draw", or "watch" for who won).
static func headline(outcome: String, winner: String) -> String:
	return {"win": "Thắng rồi!", "lose": "Thua rồi", "draw": "Hoà"}.get(
		outcome, "%s thắng" % winner
	)


## Returns once the beat is over (or never had to play).
func wait() -> void:
	while step == Step.ARMED or step == Step.PLAYING:
		await done


## Plays the beat. `spec`: headline, ink (the stamp's and the stroke's colour), center (where the
## stamp goes), marks (the five pieces in a row, or none), ring (the gold ring round them), ends
## and cell (Callables: the row's first and last cell centres, and the cell size, as the board
## moves), line_sound and sound (Callables).
func play(spec: Dictionary) -> void:
	if step != Step.ARMED:
		return
	step = Step.PLAYING
	mouse_filter = Control.MOUSE_FILTER_STOP
	_sound = spec["sound"]
	_word = spec["headline"]
	_ink = spec["ink"]
	_ends = spec["ends"]
	_cell = spec["cell"]
	var marks: Array = spec["marks"]
	var ring: CanvasItem = spec["ring"]
	var font: Font = XomDaoUi.display_font(900)
	var width: float = font.get_string_size(_word, HORIZONTAL_ALIGNMENT_LEFT, -1, 64).x
	_stamp.size = Vector2(width + 96.0, 132.0)
	_stamp.pivot_offset = _stamp.size / 2.0
	_stamp.position = Vector2(spec["center"]) - _stamp.size / 2.0
	_stamp.rotation = -0.09
	_timeline = create_tween()
	if not marks.is_empty():
		stroke.default_color = Color(_ink, 0.88)
		stroke.visible = true
		ring.modulate.a = 0.0
		set_process(true)
		_timeline.tween_callback(spec["line_sound"])
		_timeline.tween_property(self, "_drawn", 1.0, 0.45).from(0.0).set_ease(Tween.EASE_IN_OUT)
		for i: int in marks.size():
			var mark: Control = marks[i]
			var hop: Tween = create_tween()
			hop.tween_interval(0.45 + i * 0.07)
			hop.tween_property(mark, "scale", Vector2.ONE * 1.28, 0.1).set_trans(Tween.TRANS_QUAD)
			hop.tween_property(mark, "scale", Vector2.ONE, 0.16).set_trans(Tween.TRANS_BACK)
		_timeline.tween_property(ring, "modulate:a", 1.0, 0.3)
	_timeline.tween_callback(_press)
	_timeline.tween_interval(HOLD)
	_timeline.tween_callback(_finish)


## Draws the gold oval round a winning row from `first` to `last` (cell centres) into `ring`.
static func ring(line: Line2D, first: Vector2, last: Vector2, cell: float) -> void:
	var center: Vector2 = (first + last) / 2.0
	var angle: float = (last - first).angle()
	var radius: float = first.distance_to(last) / 2.0 + cell * 0.48
	for i: int in 81:
		var t: float = TAU * float(i) / 80.0
		var point := Vector2(cos(t) * radius, sin(t) * cell * 0.46)
		point.y += sin(t * 3.0) * cell * 0.035
		line.add_point(center + point.rotated(angle))


## The notebook's HUD: names on paper with a ballpoint-blue edge, the timer in red pen.
static func skin() -> XomDaoTableSkin:
	var blue := Color("#245477")
	var look := XomDaoTableSkin.new()
	look.plate = Color("#FFFBF0")
	look.edge = blue
	look.ink = Color("#22324A")
	look.radius = 8.0
	look.chip = Color("#F3EAD6")
	look.chip_edge = Color(blue, 0.55)
	look.chip_ink = blue
	look.timer = Color("#a52f3e")
	look.timer_track = Color(blue, 0.18)
	look.round_button = [Color("#FFFBF0"), blue, Color("#22324A")]
	return look


## Hub hook: the result board on the notebook page, with the paper rosette on top.
static func theme(won: bool) -> Dictionary:
	return {
		"paper": Color("#F7F1E1"),
		"ink": INK,
		"accent": Color("#a52f3e"),
		"shade": Color("#3A2B1C", 0.32),
		"title": "Nối đủ năm!" if won else "Kín trang",
		"emblem": preload("res://content/tic-tac-toe/art/emblem.webp"),
	}


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (
		(event is InputEventMouseButton and (event as InputEventMouseButton).pressed)
		or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed)
	)
	if pressed and step == Step.PLAYING:
		accept_event()
		if _timeline != null:
			_timeline.kill()
		if stroke.visible:
			_drawn = 1.0
		if _sound.is_valid():
			_sound.call()
			_sound = Callable()
		_finish()


## The pen line follows the board as it moves, drawn as far as `_drawn`.
func _process(_delta: float) -> void:
	if _drawn < 0.0 or not _ends.is_valid():
		return
	var ends: Array = _ends.call()
	if ends.size() < 2:
		return
	var cell: float = float(_cell.call())
	var from: Vector2 = ends[0]
	var to: Vector2 = ends[1]
	var along: Vector2 = (to - from).normalized()
	from -= along * cell * 0.38
	to += along * cell * 0.38
	var across := Vector2(-along.y, along.x)
	var points := PackedVector2Array()
	var steps: int = 14
	for i: int in steps + 1:
		var t: float = float(i) / steps * clampf(_drawn, 0.0, 1.0)
		var wobble: float = sin(t * 9.0 + 0.7) * 0.035 + sin(t * 23.0) * 0.012
		points.append(from.lerp(to, t) + across * wobble * cell)
	stroke.points = points
	stroke.width = maxf(3.0, cell * 0.11)


## The word comes down on the page with the outcome sound.
func _press() -> void:
	_stamp.visible = true
	_stamp.modulate.a = 0.0
	var tween: Tween = _stamp.create_tween().set_parallel()
	tween.tween_property(_stamp, "modulate:a", 1.0, 0.08)
	(
		tween
		. tween_property(_stamp, "scale", Vector2.ONE, 0.18)
		. from(Vector2.ONE * 1.5)
		. set_trans(Tween.TRANS_QUAD)
		. set_ease(Tween.EASE_IN)
	)
	if _sound.is_valid():
		_sound.call()
		_sound = Callable()


## The beat is over: the stamp fades as the result board comes in; the stroke stays.
func _finish() -> void:
	if step == Step.DONE:
		return
	step = Step.DONE
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	if _stamp.visible:
		_stamp.create_tween().tween_property(_stamp, "modulate:a", 0.0, 0.3)
	done.emit()


## The stamped word in pen ink with a loose hand-drawn ring round it, drawn twice like a pen.
func _draw_stamp() -> void:
	var font: Font = XomDaoUi.display_font(900)
	var width: float = font.get_string_size(_word, HORIZONTAL_ALIGNMENT_LEFT, -1, 64).x
	var at := Vector2((_stamp.size.x - width) / 2.0, _stamp.size.y / 2.0 + 22.0)
	_stamp.draw_string_outline(
		font, at, _word, HORIZONTAL_ALIGNMENT_LEFT, -1, 64, 10, Color("#F7F1E1")
	)
	_stamp.draw_string(font, at, _word, HORIZONTAL_ALIGNMENT_LEFT, -1, 64, _ink)
	var center: Vector2 = _stamp.size / 2.0
	var radii: Vector2 = _stamp.size / 2.0 - Vector2(6.0, 8.0)
	for lap: int in 2:
		var points := PackedVector2Array()
		for i: int in 49:
			var t: float = TAU * (float(i) / 48.0 * 1.06 + lap * 0.04)
			var wobble: float = 1.0 + 0.03 * sin(t * 3.0 + lap) + 0.02 * lap
			points.append(center + Vector2(cos(t) * radii.x, sin(t) * radii.y) * wobble)
		_stamp.draw_polyline(points, Color(_ink, 0.8 - lap * 0.3), 4.0 - lap, true)
