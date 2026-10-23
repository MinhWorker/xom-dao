class_name MauBinhFinale
extends Control
## The end of the match, before the hub's result board: a brass ring breathes out round the
## winner's seat while an indigo hanging scroll (brass rods, a pale batik hem) drops into the
## middle of the cloth and unrolls downwards to say it from your side ("Thắng rồi!", "Thua rồi",
## "Hoà"; someone watching reads who won), with a line of points. You lost: it hangs a little
## askew. A tap skips it. `arm()` when the end arrives, `play()` once the last reveal is over,
## `wait()` for the hub, `reset()` for a new match.

signal done

enum Step { IDLE, ARMED, PLAYING, DONE }

const INDIGO := Color("#1D2B4A")
const INDIGO_DEEP := Color("#121B30")
const BRASS := Color("#C9A45A")
const BRASS_DARK := Color("#8A6A2C")
const PALE := Color("#CFE0F2")
const CREAM := Color("#F4EAD6")
const ROD := 16.0
## Seconds the beat holds once the scroll is open.
const HOLD := 1.6

var step: Step = Step.IDLE

var _status_was: String = ""

var _scroll := Control.new()
var _headline := Label.new()
var _line := Label.new()
var _timeline: Tween
var _sound := Callable()
var _winners: Array[Vector2] = []
## How far the cloth has unrolled, 0..1.
var _open: float = 0.0:
	set(value):
		_open = value
		_scroll.queue_redraw()
		_headline.visible = value > 0.55
		_line.visible = value > 0.8 and _line.text != ""
var _glow: float = -1.0:
	set(value):
		_glow = value
		queue_redraw()


func _init() -> void:
	name = "Finale"
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scroll.name = "EndScroll"
	_scroll.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scroll.visible = false
	_scroll.draw.connect(_draw_scroll)
	add_child(_scroll)
	_headline.name = "EndHeadline"
	_headline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_headline.add_theme_font_override("font", XomDaoUi.display_font(900))
	_headline.add_theme_font_size_override("font_size", 50)
	_headline.add_theme_color_override("font_color", CREAM)
	_scroll.add_child(_headline)
	_line.name = "EndLine"
	_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_line.add_theme_font_override("font", XomDaoUi.body_font(true))
	_line.add_theme_font_size_override("font_size", 24)
	_line.add_theme_color_override("font_color", PALE)
	_scroll.add_child(_line)


func reset() -> void:
	if _timeline != null:
		_timeline.kill()
	step = Step.IDLE
	_glow = -1.0
	_scroll.visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## The end arrived. `live`: seen as it happened (joining a finished table skips the beat).
func arm(live: bool) -> void:
	if step == Step.IDLE:
		step = Step.ARMED if live else Step.DONE


## Follows the room's status: a new game resets the beat, an ending seen live arms it (a table
## joined after the end skips it). True when the beat should be played now.
func follow(snapshot: XomDaoRoomSnapshot) -> bool:
	var was: String = _status_was
	_status_was = snapshot.status
	if snapshot.status != "finished":
		if step != Step.IDLE:
			reset()
		return false
	if step != Step.IDLE:
		return false
	arm(was == "playing")
	return armed()


func armed() -> bool:
	return step == Step.ARMED


## Returns once the beat is over (or never had to play).
func wait() -> void:
	while step == Step.ARMED or step == Step.PLAYING:
		await done


## Plays the beat. `spec`: outcome ("win", "lose", "draw", "watch"), headline, line, middle,
## winners (Array of Vector2: the winners' seats), sound (Callable for the outcome sound).
func play(spec: Dictionary) -> void:
	if step != Step.ARMED:
		return
	step = Step.PLAYING
	mouse_filter = Control.MOUSE_FILTER_STOP
	_sound = spec["sound"]
	_winners.assign(spec["winners"])
	var outcome: String = spec["outcome"]
	_headline.text = spec["headline"]
	_headline.add_theme_color_override(
		"font_color", Color("#FFE3A0") if outcome == "win" else CREAM
	)
	_line.text = spec["line"]
	var font: Font = XomDaoUi.display_font(900)
	var text_w: float = maxf(
		font.get_string_size(_headline.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 50).x,
		XomDaoUi.body_font(true).get_string_size(_line.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
	)
	var width: float = maxf(360.0, text_w + 96.0)
	var height: float = 150.0 if _line.text != "" else 116.0
	_scroll.size = Vector2(width, height + ROD * 2.0)
	_scroll.pivot_offset = Vector2(width / 2.0, 0.0)
	_headline.position = Vector2(0.0, ROD + 12.0)
	_headline.size = Vector2(width, 64.0)
	_line.position = Vector2(0.0, ROD + 74.0)
	_line.size = Vector2(width, 36.0)
	var middle: Vector2 = spec["middle"]
	var rest := Vector2(middle.x - width / 2.0, middle.y - _scroll.size.y / 2.0)
	_scroll.position = rest - Vector2(0.0, 60.0)
	_scroll.rotation = 0.0
	_scroll.modulate.a = 0.0
	_scroll.visible = true
	_open = 0.0
	if not _winners.is_empty():
		create_tween().tween_property(self, "_glow", 1.0, 1.6).from(0.0)
	_timeline = create_tween()
	_timeline.tween_property(_scroll, "modulate:a", 1.0, 0.15)
	_timeline.parallel().tween_property(_scroll, "position", rest, 0.3).set_trans(Tween.TRANS_QUAD)
	_timeline.tween_property(self, "_open", 1.0, 0.42).set_trans(Tween.TRANS_CUBIC).set_ease(
		Tween.EASE_OUT
	)
	_timeline.parallel().tween_callback(_play_sound).set_delay(0.12)
	if outcome == "lose":
		_timeline.parallel().tween_property(_scroll, "rotation", -0.05, 0.5).set_trans(
			Tween.TRANS_ELASTIC
		)
	_timeline.tween_interval(HOLD)
	_timeline.tween_callback(_finish)


## Plays the beat for a points game from your side. `seats`: per seat {id, name, at (where its
## avatar is)}; `points`: by seat; `sfx`: plays a named sound ("win", "lose").
func play_points(
	snapshot: XomDaoRoomSnapshot,
	me: String,
	seats: Array[Dictionary],
	points: Array,
	middle: Vector2,
	sfx: Callable
) -> void:
	var winners: Array[String] = snapshot.result.winners if snapshot.result != null else []
	var spots: Array[Vector2] = []
	var names: Array[String] = []
	var best: int = 0
	for seat: int in seats.size():
		if winners.has(str(seats[seat]["id"])):
			spots.append(seats[seat]["at"])
			names.append(str(seats[seat]["name"]))
			best = int(points[seat])
	var how: String = XomDaoPlaces.outcome(snapshot, me)
	var words: Array[String] = XomDaoPlaces.words(how, names, best)
	var spec: Dictionary = {"outcome": how, "headline": words[0], "line": words[1]}
	spec.merge(
		{"middle": middle, "winners": spots, "sound": sfx.bind("win" if how == "win" else "lose")}
	)
	play(spec)


## Hub hook: the result board on cream paper in the cloth's indigo, brass for the headline.
static func theme(emblem: Texture2D) -> Dictionary:
	return {
		"paper": CREAM,
		"ink": INDIGO_DEEP,
		"accent": Color("#A63A2B"),
		"shade": Color(INDIGO_DEEP, 0.6),
		"title": "Mãn cuộc",
		"emblem": emblem,
	}


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (
		(event is InputEventMouseButton and (event as InputEventMouseButton).pressed)
		or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed)
	)
	if pressed and step == Step.PLAYING:
		accept_event()
		_open = 1.0
		_play_sound()
		_finish()


func _play_sound() -> void:
	if _sound.is_valid():
		_sound.call()
		_sound = Callable()


func _finish() -> void:
	if step == Step.DONE:
		return
	step = Step.DONE
	if _timeline != null:
		_timeline.kill()
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_glow = -1.0
	create_tween().tween_property(_scroll, "modulate:a", 0.0, 0.3)
	done.emit()


## The scroll: a top rod, the indigo cloth unrolled `_open` of the way with its pale hem, and the
## bottom rod where the roll still is.
func _draw_scroll() -> void:
	var width: float = _scroll.size.x
	var cloth: float = (_scroll.size.y - ROD * 2.0) * _open
	var shadow := Rect2(Vector2(6.0, ROD + 8.0), Vector2(width - 12.0, cloth))
	_scroll.draw_rect(shadow, Color(0.0, 0.0, 0.05, 0.35))
	var body := Rect2(Vector2(10.0, ROD), Vector2(width - 20.0, cloth))
	_scroll.draw_rect(body, INDIGO)
	if cloth > 24.0:
		# The batik hem: a pale double line and a row of small diamonds just inside it.
		var hem: Rect2 = body.grow(-8.0)
		_scroll.draw_rect(hem, Color(PALE, 0.55), false, 2.0, true)
		_scroll.draw_rect(hem.grow(-5.0), Color(PALE, 0.3), false, 1.0, true)
		var step_x: float = 26.0
		var count: int = int((hem.size.x - 20.0) / step_x)
		for i: int in count:
			var at := Vector2(hem.position.x + 10.0 + step_x * (i + 0.5), hem.end.y - 12.0)
			if at.y < hem.position.y + 10.0:
				break
			var r: float = 4.0
			_scroll.draw_colored_polygon(
				PackedVector2Array(
					[
						at + Vector2(0, -r),
						at + Vector2(r, 0),
						at + Vector2(0, r),
						at + Vector2(-r, 0)
					]
				),
				Color(PALE, 0.45)
			)
	for y: float in [ROD / 2.0, ROD * 1.5 + cloth]:
		var rod := Rect2(Vector2(0.0, y - ROD / 2.0), Vector2(width, ROD))
		var style: StyleBoxFlat = XomDaoUi.box(BRASS, BRASS_DARK, 2, ROD / 2.0)
		style.draw(_scroll.get_canvas_item(), rod)
		_scroll.draw_rect(
			Rect2(rod.position + Vector2(8.0, 3.0), Vector2(width - 16.0, 3.0)), Color(CREAM, 0.35)
		)


## A brass ring breathing out round each winner's seat.
func _draw() -> void:
	if _glow < 0.0 or _glow >= 1.0 or step != Step.PLAYING:
		return
	for at: Vector2 in _winners:
		for i: int in 2:
			var t: float = fposmod(_glow * 1.4 + i * 0.5, 1.0)
			draw_arc(at, 46.0 + 60.0 * t, 0.0, TAU, 48, Color(BRASS, 0.7 * (1.0 - t)), 4.0, true)
