class_name BaiCaoFinale
extends Control
## The end of the night, before the hub's result board: lamp light swells round the winner, the
## other seats' chips slide across the table into the winner's pile, and a brass-edged paper
## strip says it from your side ("Thắng rồi!", "Thua rồi", "Hoà"; someone watching reads who
## won), with a line of points. A tap skips it. `arm()` when the end arrives, `play()` when the
## last count has settled, `wait()` for the hub, `reset()` for a new game.

signal done

enum Step { IDLE, ARMED, PLAYING, DONE }

const PAPER := Color("#F6E6C6")
const BRASS := Color("#B88A3E")
const INK := Color("#3E2412")
const AMBER := Color("#FFC870")
const CHIP := 40.0
## Seconds the beat holds once the strip is up.
const HOLD := 1.5

var step: Step = Step.IDLE

var _status_was: String = ""

var _strip := PanelContainer.new()
var _headline := Label.new()
var _line := Label.new()
var _timeline: Tween
var _sound := Callable()
var _land := Callable()
var _winners: Array[Vector2] = []
var _glow: float = -1.0:
	set(value):
		_glow = value
		queue_redraw()


func _init() -> void:
	name = "Finale"
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_strip.name = "EndStrip"
	_strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_strip.visible = false
	var style: StyleBoxFlat = XomDaoUi.with_shadow(XomDaoUi.box(PAPER, BRASS, 5, 8.0))
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


func reset() -> void:
	if _timeline != null:
		_timeline.kill()
	step = Step.IDLE
	_glow = -1.0
	_strip.visible = false
	for child: Node in get_children():
		if child is TextureRect:
			child.queue_free()
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
## winners (Array of Vector2: the winners' piles), losers (Array of Vector2: where chips leave
## from), chip (Texture2D), sound (the outcome sound) and land (the chip sound), Callables.
func play(spec: Dictionary) -> void:
	if step != Step.ARMED:
		return
	step = Step.PLAYING
	mouse_filter = Control.MOUSE_FILTER_STOP
	_sound = spec["sound"]
	_land = spec["land"]
	_winners.assign(spec["winners"])
	var outcome: String = spec["outcome"]
	_headline.text = spec["headline"]
	var ink: Color = {"win": Color("#8A3A16"), "draw": Color("#6E4A16")}.get(outcome, INK)
	_headline.add_theme_color_override("font_color", ink)
	_line.text = spec["line"]
	_line.visible = _line.text != ""
	_strip.reset_size()
	_strip.pivot_offset = _strip.size / 2.0
	var middle: Vector2 = spec["middle"]
	_strip.position = middle - _strip.size / 2.0
	_timeline = create_tween()
	if not _winners.is_empty():
		_timeline.tween_property(self, "_glow", 1.0, 1.2).from(0.0)
		var losers: Array = spec["losers"]
		var chip: Texture2D = spec["chip"]
		var flight: float = 0.0
		for i: int in losers.size():
			var to: Vector2 = _nearest(losers[i])
			for k: int in 3:
				flight = 0.08 * (i * 3 + k)
				_timeline.parallel().tween_callback(_slide.bind(chip, losers[i], to, k)).set_delay(
					flight
				)
		_timeline.parallel().tween_callback(_unroll).set_delay(flight + 0.6)
		_timeline.parallel().tween_callback(_play_sound).set_delay(flight + 0.6)
		_timeline.tween_interval(HOLD - 0.1)
	else:
		_timeline.tween_callback(_unroll)
		_timeline.tween_callback(_play_sound)
		_timeline.tween_interval(HOLD)
	_timeline.tween_callback(_finish)


## Hub hook: the result board on lamp-lit paper with brass, in the table's walnut ink.
static func theme(emblem: Texture2D) -> Dictionary:
	return {
		"paper": PAPER,
		"ink": INK,
		"accent": Color("#A8432A"),
		"shade": Color("#0C0603", 0.6),
		"title": "Tàn canh",
		"emblem": emblem,
	}


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (
		(event is InputEventMouseButton and (event as InputEventMouseButton).pressed)
		or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed)
	)
	if pressed and step == Step.PLAYING:
		accept_event()
		_play_sound()
		_finish()


func _nearest(from: Vector2) -> Vector2:
	var best: Vector2 = _winners[0]
	for at: Vector2 in _winners:
		if at.distance_to(from) < best.distance_to(from):
			best = at
	return best


## One chip slides from a seat into the winner's pile, a little arc and a click on landing.
func _slide(chip: Texture2D, from: Vector2, to: Vector2, k: int) -> void:
	var piece := TextureRect.new()
	piece.texture = chip
	piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	piece.size = Vector2.ONE * CHIP
	piece.pivot_offset = piece.size / 2.0
	piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
	piece.position = from - piece.size / 2.0
	add_child(piece)
	move_child(piece, 0)
	var land: Vector2 = to - piece.size / 2.0 + Vector2(randf_range(-10.0, 10.0), -6.0 * k)
	var tween: Tween = piece.create_tween().set_parallel()
	tween.tween_property(piece, "position:x", land.x, 0.5).set_trans(Tween.TRANS_SINE)
	tween.tween_property(piece, "position:y", land.y, 0.5).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_IN
	)
	tween.tween_property(piece, "rotation", TAU * 0.5, 0.5)
	tween.chain().tween_callback(
		func() -> void:
			if k == 0 and _land.is_valid():
				_land.call()
	)


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
	_glow = -1.0
	var fade: Tween = create_tween().set_parallel()
	fade.tween_property(_strip, "modulate:a", 0.0, 0.3)
	for child: Node in get_children():
		if child is TextureRect:
			fade.tween_property(child, "modulate:a", 0.0, 0.3)
	done.emit()


## Lamp light swelling round each winner: soft amber discs, two rings breathing out.
func _draw() -> void:
	if _glow < 0.0:
		return
	var rise: float = clampf(_glow * 3.0, 0.0, 1.0)
	for at: Vector2 in _winners:
		for i: int in 5:
			draw_circle(at, 70.0 + i * 22.0, Color(AMBER, 0.07 * rise), true, -1.0, true)
		for i: int in 2:
			var t: float = fposmod(_glow * 1.6 + i * 0.5, 1.0)
			draw_arc(at, 50.0 + 70.0 * t, 0.0, TAU, 48, Color(AMBER, 0.6 * (1.0 - t)), 4.0, true)
