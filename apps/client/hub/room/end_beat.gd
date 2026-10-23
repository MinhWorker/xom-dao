class_name HubEndBeat
extends Control
## The moment between a game's last move and its result board. `HubEndBeat.run()` is what the hub
## awaits when a room's game finishes:
##
##   - a game with `wait_for_result_panel()` owns the moment (its celebration and its outcome
##     sound): the hub waits for it, on every ending, at most WAIT_CAP seconds;
##   - any other game gets this default beat: a short pause so the last move lands, then a
##     lacquered paper ribbon over the table ("Thắng rồi!", "Thua rồi", "Hoà", or the winner's
##     name for someone watching) with the app's win or lose sound. A tap skips it.
##
## The wait also stops as soon as `still` (the hub's "this ending still holds") returns false.

signal done

## How long the hub waits for a game's own end beat before it shows the result anyway.
const WAIT_CAP := 8.0
## The pause before the ribbon, so the last move lands.
const PAUSE := 0.8
## How long the ribbon shows, in and out included.
const RIBBON := 1.6

const _WIN_SOUND := preload("res://hub/room/sounds/win.wav")
const _LOSE_SOUND := preload("res://hub/room/sounds/lose.wav")
const _FONT_SIZE := 64
const _BAND_H := 108.0
const _TAIL := 72.0
const _TAIL_DROP := 30.0
const _TAIL_H := 98.0
const _TUCK := 24.0
const _SLATE := Color("#4E5D6C")
const _SLATE_DARK := Color("#36414C")
const _SEA_DARK := Color("#14687A")

## "win", "lose", "draw" or "watch" (someone not seated, in a game with a winner).
var outcome: String = ""
var headline: String = ""
var running: bool = false

var _dim := ColorRect.new()
var _ribbon := Control.new()
var _label := Label.new()
var _sound := AudioStreamPlayer.new()
var _timeline: Tween
var _sparks: float = -1.0:
	set(value):
		_sparks = value
		queue_redraw()


## Waits for the end of a finished game: the game's own beat when it has one, else the default
## beat over `host`. Returns when the result board may come up, or when `still` turns false.
static func run(
	host: Control,
	game: Node,
	snapshot: XomDaoRoomSnapshot,
	me: String,
	still: Callable,
	cap: float = WAIT_CAP
) -> void:
	if game != null and game.has_method("wait_for_result_panel"):
		await wait_for_game(host, game, still, cap)
		return
	var beat := HubEndBeat.new()
	host.add_child(beat)
	beat.play(snapshot, me)
	while beat.running and still.call() and beat.is_inside_tree():
		await host.get_tree().process_frame
	if still.call():
		beat.retire()
	else:
		beat.queue_free()


## Awaits `game.wait_for_result_panel()`, at most `cap` seconds and while `still` holds. True
## when the game said it was ready.
static func wait_for_game(host: Node, game: Node, still: Callable, cap: float = WAIT_CAP) -> bool:
	var said: Array[bool] = [false]
	var waiter: Callable = func() -> void:
		await game.call("wait_for_result_panel")
		said[0] = true
	waiter.call()
	var deadline: int = Time.get_ticks_msec() + int(cap * 1000.0)
	while not said[0] and Time.get_ticks_msec() < deadline and still.call():
		await host.get_tree().process_frame
	return said[0]


## How the game ended for player `me`, from the ranks the game gave.
static func outcome_for(snapshot: XomDaoRoomSnapshot, me: String) -> String:
	var ranks: Dictionary = HubResult.ranks(snapshot)
	if not ranks.has(me):
		var winners: Array[String] = snapshot.result.winners if snapshot.result != null else []
		return "draw" if winners.is_empty() else "watch"
	match int(ranks[me]):
		0:
			return "draw"
		1:
			return "win"
	return "lose"


## The ribbon's words for player `me`.
static func headline_for(snapshot: XomDaoRoomSnapshot, me: String) -> String:
	match outcome_for(snapshot, me):
		"win":
			return "Thắng rồi!"
		"lose":
			return "Thua rồi"
		"draw":
			return "Hoà"
	var names: Array[String] = []
	for id: String in snapshot.result.winners:
		for player: XomDaoPlayerInfo in snapshot.seats + snapshot.players:
			if player.id == id:
				names.append(player.name)
				break
	return "%s thắng" % " và ".join(names)


func _init() -> void:
	name = "EndBeat"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_dim.name = "EndBeatDim"
	_dim.color = Color(XomDaoUi.INK, 0.22)
	_dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_dim.modulate.a = 0.0
	add_child(_dim)
	_ribbon.name = "EndRibbon"
	_ribbon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ribbon.visible = false
	_ribbon.draw.connect(_draw_ribbon)
	add_child(_ribbon)
	_label.name = "EndBeatText"
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_label.add_theme_font_override("font", XomDaoUi.display_font(800))
	_label.add_theme_font_size_override("font_size", _FONT_SIZE)
	_label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_label.add_theme_constant_override("outline_size", 12)
	_ribbon.add_child(_label)
	_sound.name = "EndBeatSound"
	_sound.bus = XomDaoSettings.SFX_BUS
	add_child(_sound)
	resized.connect(_place)


## Pause, ribbon, gone: `done` when it ends or is tapped away.
func play(snapshot: XomDaoRoomSnapshot, me: String) -> void:
	outcome = outcome_for(snapshot, me)
	headline = headline_for(snapshot, me)
	_label.text = headline
	_label.add_theme_color_override("font_outline_color", _colors()[1])
	_fit()
	running = true
	_timeline = create_tween()
	_timeline.tween_interval(PAUSE)
	_timeline.tween_callback(_show_ribbon)
	_timeline.tween_interval(RIBBON - 0.2)
	_timeline.tween_property(_ribbon, "modulate:a", 0.0, 0.2)
	_timeline.tween_callback(_finish)


## A tap (or Enter, Escape) cuts the beat short.
func skip() -> void:
	if not running:
		return
	if _timeline != null and _timeline.is_valid():
		_timeline.kill()
	_finish()


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (
		(event is InputEventMouseButton and (event as InputEventMouseButton).pressed)
		or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed)
	)
	if pressed:
		accept_event()
		skip()


func _unhandled_input(event: InputEvent) -> void:
	if running and (event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_cancel")):
		get_viewport().set_input_as_handled()
		skip()


func _finish() -> void:
	if not running:
		return
	running = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	done.emit()


## The ribbon gone, the dim lingers while the result board's shade comes in, then goes.
func retire() -> void:
	_ribbon.visible = false
	_sparks = -1.0
	var tween: Tween = create_tween()
	tween.tween_property(_dim, "modulate:a", 0.0, 0.4).set_delay(0.15)
	tween.tween_callback(queue_free)


func _show_ribbon() -> void:
	_place()
	_ribbon.visible = true
	_ribbon.pivot_offset = _ribbon.size / 2.0
	var target: Vector2 = _ribbon.position
	var tween: Tween = create_tween().set_parallel(true)
	tween.tween_property(_dim, "modulate:a", 1.0, 0.2)
	tween.tween_property(_ribbon, "modulate:a", 1.0, 0.12).from(0.0)
	match outcome:
		"win":
			# Stamped down like a seal, then gold flecks fly off it.
			(
				tween
				. tween_property(_ribbon, "scale", Vector2.ONE, 0.2)
				. from(Vector2.ONE * 1.45)
				. set_trans(Tween.TRANS_QUAD)
				. set_ease(Tween.EASE_IN)
			)
			(
				tween
				. tween_property(self, "_sparks", 1.0, 0.75)
				. from(0.0)
				. set_delay(0.18)
				. set_trans(Tween.TRANS_CUBIC)
				. set_ease(Tween.EASE_OUT)
			)
			_sound.stream = _WIN_SOUND
		"lose":
			# Drops in and settles a little askew.
			_ribbon.rotation_degrees = -5.0
			(
				tween
				. tween_property(_ribbon, "position", target, 0.34)
				. from(target - Vector2(0.0, 56.0))
				. set_trans(Tween.TRANS_BACK)
				. set_ease(Tween.EASE_OUT)
			)
			tween.tween_property(_ribbon, "rotation_degrees", -1.5, 0.4).set_trans(Tween.TRANS_SINE)
			_sound.stream = _LOSE_SOUND
		_:
			# Unrolls from the middle.
			(
				tween
				. tween_property(_ribbon, "scale", Vector2.ONE, 0.3)
				. from(Vector2(0.15, 1.0))
				. set_trans(Tween.TRANS_BACK)
				. set_ease(Tween.EASE_OUT)
			)
	if _sound.stream != null:
		_sound.play()
	else:
		XomDaoUi.play(self, XomDaoUi.SOUND_PANEL)


## Fill, border and trim of the ribbon for this outcome.
func _colors() -> Array[Color]:
	match outcome:
		"win":
			return [XomDaoUi.LACQUER, XomDaoUi.LACQUER_DARK, XomDaoUi.GOLD]
		"lose":
			return [_SLATE, _SLATE_DARK, Color(XomDaoUi.CREAM, 0.35)]
		"watch":
			return [XomDaoUi.SEA_DEEP, _SEA_DARK, Color(XomDaoUi.CREAM, 0.45)]
	return [XomDaoUi.HONEY, XomDaoUi.HONEY_DARK, Color(XomDaoUi.CREAM, 0.55)]


## Sizes the ribbon to its words.
func _fit() -> void:
	var font: Font = XomDaoUi.display_font(800)
	var room: float = (size.x if size.x > 0.0 else XomDaoFrame.SIZE.x) - 48.0 - _TAIL * 2.0
	var font_size: int = _FONT_SIZE
	var text_w: float = font.get_string_size(headline, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	if text_w + 150.0 > room:
		font_size = maxi(32, floori(font_size * (room - 150.0) / text_w))
		text_w = font.get_string_size(headline, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	_label.add_theme_font_size_override("font_size", font_size)
	var band_w: float = maxf(320.0, text_w + 150.0)
	_ribbon.size = Vector2(band_w + _TAIL * 2.0, _TAIL_DROP + _TAIL_H)
	_label.position = Vector2(_TAIL, -4.0)
	_label.size = Vector2(band_w, _BAND_H)
	_place()


func _place() -> void:
	_ribbon.position = (size - _ribbon.size) / 2.0 - Vector2(0.0, 24.0)


func _draw_ribbon() -> void:
	var colors: Array[Color] = _colors()
	var fill: Color = colors[0]
	var edge: Color = colors[1]
	var band_w: float = _ribbon.size.x - _TAIL * 2.0
	var tail_fill: Color = fill.darkened(0.18)
	var bottom: float = _TAIL_DROP + _TAIL_H
	var notch: float = 28.0
	for side: float in [-1.0, 1.0]:
		var outer: float = 0.0 if side < 0.0 else _ribbon.size.x
		var inner: float = _TAIL + _TUCK if side < 0.0 else _ribbon.size.x - _TAIL - _TUCK
		var tail := PackedVector2Array(
			[
				Vector2(outer, _TAIL_DROP),
				Vector2(inner, _TAIL_DROP),
				Vector2(inner, bottom),
				Vector2(outer, bottom),
				Vector2(outer - side * notch, _TAIL_DROP + _TAIL_H / 2.0),
			]
		)
		var shadow := PackedVector2Array()
		for point: Vector2 in tail:
			shadow.append(point + Vector2(4.0, 6.0))
		_ribbon.draw_colored_polygon(shadow, XomDaoUi.SHADOW)
		_ribbon.draw_colored_polygon(tail, tail_fill)
		var outline: PackedVector2Array = tail.duplicate()
		outline.append(tail[0])
		_ribbon.draw_polyline(outline, edge, 4.0, true)
		# The fold where the tail turns under the band.
		var corner: float = _TAIL if side < 0.0 else _ribbon.size.x - _TAIL
		var fold := PackedVector2Array(
			[
				Vector2(corner, _BAND_H - 2.0),
				Vector2(inner, _BAND_H - 2.0),
				Vector2(inner, bottom - 2.0),
			]
		)
		_ribbon.draw_colored_polygon(fold, edge)
	var band: StyleBoxFlat = XomDaoUi.with_shadow(XomDaoUi.box(fill, edge, 4, 10.0))
	band.draw(_ribbon.get_canvas_item(), Rect2(_TAIL, 0.0, band_w, _BAND_H))
	var trim: StyleBoxFlat = XomDaoUi.box(Color.TRANSPARENT, colors[2], 2, 6.0)
	trim.draw_center = false
	trim.draw(_ribbon.get_canvas_item(), Rect2(_TAIL + 10.0, 10.0, band_w - 20.0, _BAND_H - 20.0))
	# A soft top highlight: light from the top left.
	_ribbon.draw_rect(
		Rect2(_TAIL + 14.0, 14.0, band_w - 28.0, 6.0), Color(XomDaoUi.CREAM, 0.16), true
	)


## Gold flecks thrown off the winner's ribbon.
func _draw() -> void:
	if _sparks < 0.0 or _sparks >= 1.0 or not _ribbon.visible:
		return
	var center: Vector2 = _ribbon.position + _ribbon.size / 2.0
	var reach: Vector2 = Vector2(_ribbon.size.x * 0.5, _ribbon.size.y * 0.7)
	var fade: float = 1.0 - _sparks
	for i: int in 14:
		var angle: float = TAU * float(i) / 14.0 + 0.3 * sin(float(i) * 7.1)
		var direction := Vector2(cos(angle), sin(angle))
		var at: Vector2 = center + direction * (reach * (0.75 + 0.6 * _sparks))
		var r: float = (9.0 + 4.0 * float(i % 3)) * fade
		var star := PackedVector2Array(
			[
				at + Vector2(0.0, -r),
				at + Vector2(r * 0.3, -r * 0.3),
				at + Vector2(r, 0.0),
				at + Vector2(r * 0.3, r * 0.3),
				at + Vector2(0.0, r),
				at + Vector2(-r * 0.3, r * 0.3),
				at + Vector2(-r, 0.0),
				at + Vector2(-r * 0.3, -r * 0.3),
			]
		)
		draw_colored_polygon(star, Color(XomDaoUi.GOLD, fade))
		draw_circle(at, r * 0.25, Color(XomDaoUi.CREAM, fade), true, -1.0, true)
