class_name BattleshipFinale
extends Control
## The end of the battle, before the hub's result board, over the big sea. You won (or someone
## watching): a line of naval signal flags runs up across the top of the sea and flutters. You
## lost: the sea goes deep and bubbles rise from it. Then a chart-paper strip with brass edges
## says it ("Thắng rồi!", "Thua rồi"; who won for someone watching) and how ("Hạm đội đối phương
## chìm hết", "Máy đầu hàng"). A tap skips it. `arm()` when the end arrives, `play()` after the
## last shot landed, `wait()` for the hub, `reset()` for a new game.
## `skin()` and `theme()` dress the table and the result board in the same chart-table look.

signal done

enum Step { IDLE, ARMED, PLAYING, DONE }

const STEEL := Color("#13283C")
const STEEL_LIGHT := Color("#2B4A66")
const BRASS := Color("#C9A24E")
const BRASS_DARK := Color("#8A6A2C")
const CHART := Color("#F1E9D2")
const INK := Color("#1C2B3A")
const SIGNAL_RED := Color("#B8352B")
const SIGNAL_GREEN := Color("#2F6B4F")
const FLAG_COLORS: Array[Color] = [
	Color("#E8C547"), Color("#24508F"), Color("#C8372D"), Color("#F4F1E6"), Color("#1F1F1F")
]
const FLAGS := 9
const BUBBLES := 18
## Seconds the beat holds once the strip is up.
const HOLD := 1.5

var step: Step = Step.IDLE

var _status_was: String = ""

var _strip := PanelContainer.new()
var _headline := Label.new()
var _line := Label.new()
var _timeline: Tween
var _sound := Callable()
var _sea := Rect2()
var _flags: float = -1.0:
	set(value):
		_flags = value
		queue_redraw()
var _bubbles: float = -1.0:
	set(value):
		_bubbles = value
		queue_redraw()
var _wave: float = 0.0


func _init() -> void:
	name = "Finale"
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_strip.name = "EndStrip"
	_strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_strip.visible = false
	var style: StyleBoxFlat = XomDaoUi.with_shadow(XomDaoUi.box(CHART, BRASS, 5, 8.0))
	style.content_margin_left = 36.0
	style.content_margin_right = 36.0
	style.content_margin_top = 6.0
	style.content_margin_bottom = 10.0
	_strip.add_theme_stylebox_override("panel", style)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", -4)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_strip.add_child(column)
	_headline.name = "EndHeadline"
	_headline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_headline.add_theme_font_override("font", XomDaoUi.display_font(900))
	_headline.add_theme_font_size_override("font_size", 52)
	column.add_child(_headline)
	_line.name = "EndLine"
	_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_line.add_theme_font_override("font", XomDaoUi.body_font(true))
	_line.add_theme_font_size_override("font_size", 26)
	_line.add_theme_color_override("font_color", INK)
	column.add_child(_line)
	add_child(_strip)
	set_process(false)


func reset() -> void:
	if _timeline != null:
		_timeline.kill()
	step = Step.IDLE
	_flags = -1.0
	_bubbles = -1.0
	_strip.visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process(false)


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


## Plays the beat. `spec`: outcome ("win", "lose", "watch"), headline, line, sea (Rect2 of the
## big sea), sound (Callable for the outcome sound).
func play(spec: Dictionary) -> void:
	if step != Step.ARMED:
		return
	step = Step.PLAYING
	mouse_filter = Control.MOUSE_FILTER_STOP
	_sound = spec["sound"]
	_sea = spec["sea"]
	var outcome: String = spec["outcome"]
	_headline.text = spec["headline"]
	_headline.add_theme_color_override(
		"font_color", SIGNAL_RED.darkened(0.2) if outcome == "win" else INK
	)
	_line.text = spec["line"]
	_line.visible = _line.text != ""
	_strip.reset_size()
	_strip.pivot_offset = _strip.size / 2.0
	_strip.position = _sea.get_center() - _strip.size / 2.0
	_wave = 0.0
	set_process(true)
	_timeline = create_tween()
	if outcome == "lose":
		_timeline.tween_property(self, "_bubbles", 1.0, 2.6).from(0.0)
	else:
		_timeline.tween_property(self, "_flags", 1.0, 0.7).from(0.0)
	_timeline.parallel().tween_callback(_unroll).set_delay(0.45)
	_timeline.parallel().tween_callback(_play_sound).set_delay(0.45)
	_timeline.parallel().tween_interval(0.45 + HOLD)
	_timeline.tween_callback(_finish)


## The table's HUD materials: steel plates with brass edges, signal colours for the actions.
static func skin() -> XomDaoTableSkin:
	var look := XomDaoTableSkin.new()
	look.plate = STEEL
	look.edge = BRASS
	look.ink = CHART
	look.radius = 8.0
	look.chip = STEEL_LIGHT
	look.chip_edge = Color(BRASS, 0.7)
	look.chip_ink = CHART
	look.timer = BRASS
	look.timer_track = Color(STEEL, 0.6)
	look.round_button = [STEEL, BRASS, CHART]
	return look


## Hub hook: the result board on chart paper, steel ink, signal red for the headline.
static func theme(emblem: Texture2D) -> Dictionary:
	var look: Dictionary = {
		"paper": CHART,
		"ink": INK,
		"accent": SIGNAL_RED,
		"shade": Color("#06121D", 0.6),
		"title": "Hải chiến kết thúc",
	}
	if emblem != null:
		look["emblem"] = emblem
	return look


func _process(delta: float) -> void:
	_wave += delta
	if _flags >= 0.0:
		queue_redraw()


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (
		(event is InputEventMouseButton and (event as InputEventMouseButton).pressed)
		or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed)
	)
	if pressed and step == Step.PLAYING:
		accept_event()
		_play_sound()
		_finish()


func _unroll() -> void:
	_strip.visible = true
	_strip.modulate.a = 1.0
	_strip.scale = Vector2(0.05, 1.0)
	(
		_strip
		. create_tween()
		. tween_property(_strip, "scale", Vector2.ONE, 0.28)
		. set_trans(Tween.TRANS_BACK)
		. set_ease(Tween.EASE_OUT)
	)


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
	var fade: Tween = create_tween().set_parallel()
	fade.tween_property(_strip, "modulate:a", 0.0, 0.3)
	fade.tween_property(self, "modulate:a", 0.0, 0.3)
	fade.chain().tween_callback(
		func() -> void:
			_flags = -1.0
			_bubbles = -1.0
			modulate.a = 1.0
			set_process(false)
	)
	done.emit()


func _draw() -> void:
	if _bubbles >= 0.0:
		_draw_depths()
	if _flags >= 0.0:
		_draw_flags()


## A line of signal flags strung across the top of the sea, each run up in turn, fluttering.
func _draw_flags() -> void:
	var from := Vector2(_sea.position.x - 10.0, _sea.position.y + 6.0)
	var to := Vector2(_sea.end.x + 10.0, _sea.position.y + 6.0)
	var sag: float = 26.0
	var rope := PackedVector2Array()
	for i: int in 25:
		var t: float = i / 24.0
		rope.append(from.lerp(to, t) + Vector2(0.0, sag * 4.0 * t * (1.0 - t)))
	draw_polyline(rope, Color("#E8DCC0"), 3.0, true)
	var flag: float = minf(54.0, _sea.size.x / FLAGS * 0.7)
	for i: int in FLAGS:
		var t: float = (i + 0.5) / FLAGS
		var shown: float = clampf(_flags * (FLAGS + 3.0) / 3.0 - i / 3.0, 0.0, 1.0)
		if shown <= 0.0:
			continue
		var at: Vector2 = from.lerp(to, t) + Vector2(0.0, sag * 4.0 * t * (1.0 - t))
		var sway: float = sin(_wave * 5.0 + i * 0.9) * 6.0
		var drop: float = flag * 1.1 * shown
		var color: Color = FLAG_COLORS[i % FLAG_COLORS.size()]
		var other: Color = FLAG_COLORS[(i * 2 + 1) % FLAG_COLORS.size()]
		var left := at + Vector2(-flag / 2.0, 0.0)
		var right := at + Vector2(flag / 2.0, 0.0)
		if i % 3 == 2:
			# A pennant: a long triangle.
			draw_colored_polygon(PackedVector2Array([left, right, at + Vector2(sway, drop)]), color)
		else:
			# A square flag in two colours, split down its middle.
			var bottom_left := left + Vector2(sway, drop)
			var bottom_right := right + Vector2(sway, drop)
			draw_colored_polygon(
				PackedVector2Array([left, right, bottom_right, bottom_left]), color
			)
			draw_colored_polygon(
				PackedVector2Array([at, right, bottom_right, at + Vector2(sway, drop)]), other
			)
			draw_polyline(
				PackedVector2Array([left, right, bottom_right, bottom_left, left]),
				Color(0.05, 0.08, 0.12, 0.6),
				2.0,
				true
			)


## The sea goes deep and bubbles rise from where the fleet went down.
func _draw_depths() -> void:
	var deep: float = clampf(_bubbles * 3.0, 0.0, 1.0)
	draw_rect(_sea, Color("#020A14", 0.45 * deep))
	for i: int in BUBBLES:
		var x: float = _sea.position.x + fposmod(i * 0.173 + 0.07, 1.0) * _sea.size.x
		var rise: float = fposmod(_bubbles * (0.8 + 0.07 * (i % 4)) + i * 0.13, 1.0)
		var at := Vector2(x + sin(_bubbles * 9.0 + i) * 8.0, _sea.end.y - rise * _sea.size.y)
		var r: float = 4.0 + 5.0 * float(i % 3)
		var fade: float = (1.0 - rise) * deep
		draw_arc(at, r, 0.0, TAU, 20, Color(0.85, 0.95, 1.0, 0.7 * fade), 2.0, true)
		draw_circle(at + Vector2(-r * 0.3, -r * 0.3), r * 0.25, Color(1.0, 1.0, 1.0, 0.6 * fade))
