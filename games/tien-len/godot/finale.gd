class_name TienLenFinale
extends Control
## The end of a match, before the hub's result board: a red lucky-money envelope (lì xì) springs
## up in the middle of the mat. You won: its flap opens and gold coins jump out. Otherwise it
## flies to the winner's seat, and a few peach petals drift down. A red-edged paper strip under it
## says it from your side ("Thắng rồi!", "Thua rồi", "Hoà"; someone watching reads who won), with
## a line of points. A tap skips it. `arm()` when the end arrives, `play()` after the last cards
## landed, `wait()` for the hub, `reset()` for a new match.

signal done

enum Step { IDLE, ARMED, PLAYING, DONE }

const RED := Color("#B3261E")
const RED_DARK := Color("#7A1712")
const GOLD := Color("#E8B64C")
const GOLD_DARK := Color("#A9762A")
const PAPER := Color("#F7EBD3")
const INK := Color("#4A2414")
const PETAL := Color("#F4A7B9")
## The envelope, in units.
const ENVELOPE := Vector2(132.0, 176.0)
## Seconds the beat holds once the strip is up.
const HOLD := 1.5
const COINS := 16
const PETALS := 14

var step: Step = Step.IDLE

var _status_was: String = ""

var _envelope := Control.new()
var _strip := PanelContainer.new()
var _headline := Label.new()
var _line := Label.new()
var _timeline: Tween
var _sound := Callable()
## 0 closed, 1 open.
var _flap: float = 0.0:
	set(value):
		_flap = value
		_envelope.queue_redraw()
## The coins' flight, 0..1; -1 none.
var _coins: float = -1.0:
	set(value):
		_coins = value
		queue_redraw()
## The petals' fall, 0..1; -1 none.
var _petals: float = -1.0:
	set(value):
		_petals = value
		queue_redraw()
var _coin_from := Vector2.ZERO


func _init() -> void:
	name = "Finale"
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_envelope.name = "Envelope"
	_envelope.size = ENVELOPE
	_envelope.pivot_offset = ENVELOPE / 2.0
	_envelope.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_envelope.visible = false
	_envelope.draw.connect(_draw_envelope)
	add_child(_envelope)
	_strip.name = "EndStrip"
	_strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_strip.visible = false
	var style: StyleBoxFlat = XomDaoUi.with_shadow(XomDaoUi.box(PAPER, RED, 5, 10.0))
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


## A new match: nothing ended yet.
func reset() -> void:
	if _timeline != null:
		_timeline.kill()
	step = Step.IDLE
	_coins = -1.0
	_petals = -1.0
	_envelope.visible = false
	_strip.visible = false
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


## Plays the beat. `spec`: outcome ("win", "lose", "draw", "watch"), headline, line, middle (the
## mat's middle), winner_at (the winner's seat, or null), sound (Callable for the outcome sound).
func play(spec: Dictionary) -> void:
	if step != Step.ARMED:
		return
	step = Step.PLAYING
	mouse_filter = Control.MOUSE_FILTER_STOP
	_sound = spec["sound"]
	var outcome: String = spec["outcome"]
	var middle: Vector2 = spec["middle"]
	_headline.text = spec["headline"]
	var ink: Color = {"win": RED_DARK, "draw": Color("#6E4A16")}.get(outcome, INK)
	_headline.add_theme_color_override("font_color", ink)
	_line.text = spec["line"]
	_line.visible = _line.text != ""
	_strip.reset_size()
	_strip.pivot_offset = _strip.size / 2.0
	# The envelope and the strip under it, centred together on `middle`.
	var group: float = ENVELOPE.y + 12.0 + _strip.size.y
	var home := Vector2(middle.x - ENVELOPE.x / 2.0, middle.y - group / 2.0)
	_strip.position = Vector2(middle.x - _strip.size.x / 2.0, home.y + ENVELOPE.y + 12.0)
	_envelope.position = home
	_envelope.rotation = 0.0
	_envelope.scale = Vector2.ONE
	_envelope.modulate.a = 1.0
	_flap = 0.0
	_coin_from = home + Vector2(ENVELOPE.x / 2.0, ENVELOPE.y * 0.28)
	_timeline = create_tween()
	_timeline.tween_callback(_spring_up)
	_timeline.tween_interval(0.42)
	var winner_at: Variant = spec.get("winner_at")
	if outcome == "win":
		_timeline.tween_property(self, "_flap", 1.0, 0.18).set_trans(Tween.TRANS_QUAD)
		_timeline.tween_callback(_play_sound)
		_timeline.tween_property(self, "_coins", 1.0, 1.1).from(0.0).set_trans(Tween.TRANS_LINEAR)
		_timeline.parallel().tween_callback(_unroll).set_delay(0.1)
		_timeline.tween_interval(HOLD - 0.9)
	elif outcome == "draw" or not winner_at is Vector2:
		_timeline.tween_callback(_unroll)
		_timeline.tween_callback(_play_sound)
		_timeline.tween_interval(HOLD)
	else:
		# The envelope goes to whoever came first; petals drift down meanwhile (their own tween,
		# so the beat doesn't wait for them).
		create_tween().tween_property(self, "_petals", 1.0, 2.6).from(0.0).set_delay(0.42)
		var to: Vector2 = (winner_at as Vector2) - ENVELOPE / 2.0
		_timeline.tween_property(_envelope, "position", to, 0.45).set_trans(Tween.TRANS_CUBIC)
		_timeline.parallel().tween_property(_envelope, "scale", Vector2.ONE * 0.45, 0.45)
		_timeline.parallel().tween_property(_envelope, "rotation", -0.25, 0.45)
		_timeline.parallel().tween_callback(_unroll).set_delay(0.15)
		_timeline.parallel().tween_callback(_play_sound).set_delay(0.15)
		_timeline.tween_property(_envelope, "modulate:a", 0.0, 0.25)
		_timeline.tween_interval(HOLD - 0.6)
	_timeline.tween_callback(_finish)


## Hub hook: the result board on red-edged paper, in the mat's ink and lacquer.
static func theme(emblem: Texture2D) -> Dictionary:
	var look: Dictionary = {
		"paper": PAPER,
		"ink": INK,
		"accent": RED,
		"shade": Color("#1A0B06", 0.55),
		"title": "Chung cuộc",
	}
	if emblem != null:
		look["emblem"] = emblem
	return look


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (
		(event is InputEventMouseButton and (event as InputEventMouseButton).pressed)
		or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed)
	)
	if pressed and step == Step.PLAYING:
		accept_event()
		_play_sound()
		_finish()


func _spring_up() -> void:
	_envelope.visible = true
	var tween: Tween = _envelope.create_tween().set_parallel()
	(
		tween
		. tween_property(_envelope, "position:y", _envelope.position.y, 0.38)
		. from(_envelope.position.y + 90.0)
		. set_trans(Tween.TRANS_BACK)
		. set_ease(Tween.EASE_OUT)
	)
	tween.tween_property(_envelope, "scale", Vector2.ONE, 0.38).from(Vector2.ONE * 0.4).set_trans(
		Tween.TRANS_BACK
	)
	tween.tween_property(_envelope, "modulate:a", 1.0, 0.15).from(0.0)


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


## The beat is over: everything fades as the result board comes in.
func _finish() -> void:
	if step == Step.DONE:
		return
	step = Step.DONE
	if _timeline != null:
		_timeline.kill()
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_coins = -1.0
	var fade: Tween = create_tween().set_parallel()
	fade.tween_property(_envelope, "modulate:a", 0.0, 0.3)
	fade.tween_property(_strip, "modulate:a", 0.0, 0.3)
	fade.tween_property(self, "_petals", -1.0, 0.0).set_delay(0.3)
	done.emit()


## The envelope: red paper, a darker flap folded down (or opened up), a gold rim and a round gold
## seal with Lộc on it.
func _draw_envelope() -> void:
	var s: Vector2 = ENVELOPE
	var canvas: RID = _envelope.get_canvas_item()
	var body: StyleBoxFlat = XomDaoUi.box(RED, RED_DARK, 3, 12.0)
	body.shadow_color = Color(0.1, 0.02, 0.0, 0.4)
	body.shadow_size = 8
	body.shadow_offset = Vector2(5.0, 8.0)
	body.draw(canvas, Rect2(Vector2.ZERO, s))
	_envelope.draw_rect(Rect2(Vector2(10.0, 10.0), s - Vector2(20.0, 20.0)), GOLD, false, 2.0, true)
	# Gold flowers printed at the foot.
	for i: int in 3:
		var at := Vector2(s.x * (0.25 + 0.25 * i), s.y * 0.86)
		for petal: int in 5:
			var angle: float = TAU * petal / 5.0 - PI / 2.0
			_envelope.draw_circle(at + Vector2(cos(angle), sin(angle)) * 6.0, 4.0, Color(GOLD, 0.8))
		_envelope.draw_circle(at, 3.0, RED_DARK)
	# The flap: a triangle from the top edge, folded down (closed) or turned up (open).
	var tip: float = lerpf(s.y * 0.42, -s.y * 0.34, _flap)
	var flap := PackedVector2Array(
		[Vector2(2.0, 2.0), Vector2(s.x - 2.0, 2.0), Vector2(s.x / 2.0, tip)]
	)
	_envelope.draw_colored_polygon(flap, RED_DARK if _flap < 0.5 else RED.darkened(0.1))
	var outline: PackedVector2Array = flap.duplicate()
	outline.append(flap[0])
	_envelope.draw_polyline(outline, GOLD_DARK, 2.0, true)
	if _flap < 0.5:
		var seal := Vector2(s.x / 2.0, s.y * 0.42)
		_envelope.draw_circle(seal, 26.0, GOLD_DARK, true, -1.0, true)
		_envelope.draw_circle(seal, 23.0, GOLD, true, -1.0, true)
		var font: Font = XomDaoUi.display_font(900)
		var word := "Lộc"
		var width: float = font.get_string_size(word, HORIZONTAL_ALIGNMENT_LEFT, -1, 22).x
		_envelope.draw_string(
			font,
			seal + Vector2(-width / 2.0, 8.0),
			word,
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			22,
			RED_DARK
		)


## Gold coins thrown out of the opened envelope; peach petals falling over the mat.
func _draw() -> void:
	if _coins >= 0.0 and _coins < 1.0:
		for i: int in COINS:
			var spread: float = (float(i) / (COINS - 1) - 0.5) * 2.0
			var speed := Vector2(
				spread * 360.0 + sin(i * 3.7) * 40.0, -520.0 - 140.0 * cos(i * 1.9)
			)
			var t: float = _coins * 1.1
			var at: Vector2 = _coin_from + speed * t + Vector2(0.0, 900.0) * t * t
			var fade: float = clampf((1.0 - _coins) * 3.0, 0.0, 1.0)
			var r: float = 17.0
			# A coin turning: its width swings with its spin.
			var squash: float = absf(cos(_coins * 9.0 + i))
			draw_set_transform(at, 0.0, Vector2(maxf(0.2, squash), 1.0))
			draw_circle(Vector2.ZERO, r, Color(GOLD_DARK, fade), true, -1.0, true)
			draw_circle(Vector2.ZERO, r - 2.5, Color(GOLD, fade), true, -1.0, true)
			draw_rect(Rect2(-4.5, -4.5, 9.0, 9.0), Color(GOLD_DARK, fade), true)
		draw_set_transform(Vector2.ZERO)
	if _petals >= 0.0 and _petals < 1.0 and step == Step.PLAYING:
		var fade_in: float = clampf(_petals * 6.0, 0.0, 1.0)
		for i: int in PETALS:
			var x: float = fposmod(float(i) * 0.137 + 0.05, 1.0) * size.x
			var fall: float = fposmod(_petals * (0.55 + 0.04 * (i % 5)) + float(i) * 0.071, 1.0)
			var at := Vector2(x + sin(_petals * 6.0 + i) * 30.0, -20.0 + fall * (size.y + 40.0))
			draw_set_transform(at, _petals * 4.0 + i, Vector2(1.0, 0.6))
			draw_circle(Vector2.ZERO, 7.0, Color(PETAL, 0.85 * fade_in), true, -1.0, true)
			draw_circle(
				Vector2(2.0, -1.0), 3.0, Color(1.0, 0.92, 0.94, 0.6 * fade_in), true, -1.0, true
			)
		draw_set_transform(Vector2.ZERO)
