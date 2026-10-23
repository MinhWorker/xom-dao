class_name XiangqiFinale
extends Control
## The table's announcements over the board: the CHIẾU TƯỚNG! scroll (`check_scroll`) and the end
## beat the hub waits for before its result board (`wait`).
##
## The end beat: the beaten general wobbles and topples onto its side, a gold ring pulses round
## the winning general, a cinnabar seal stamps how the game ended (CHIẾU BÍ, ĐẦU HÀNG…; a jade
## HOÀ CỜ seal for a draw) and a paper strip under it says it from your side ("Thắng rồi!",
## "Thua rồi", "Hoà"; someone watching reads who won). A tap skips it. `arm()` when the end
## arrives, `play()` once the last move has landed, `reset()` for a new game.

signal done

enum Step { IDLE, ARMED, PLAYING, DONE }

const CINNABAR := Color("#B8262A")
const CINNABAR_DARK := Color("#7A1418")
const JADE := Color("#2F6B5A")
const JADE_DARK := Color("#1E4A3E")
const IVORY := Color("#F3E6C8")
const WALNUT := Color("#5C2D12")
const GLOW := Color("#FFE066")
## Seconds from the seal's stamp until the result board may come up.
const HOLD := 1.7
const SEALS: Dictionary = {
	"checkmate": ["CHIẾU", "BÍ"],
	"stalemate": ["HẾT", "NƯỚC"],
	"resign": ["ĐẦU", "HÀNG"],
	"left": ["RỜI", "BÀN"],
	"perpetual-check": ["CHIẾU", "DAI"],
	"perpetual-chase": ["ĐUỔI", "DAI"],
}

var step: Step = Step.IDLE
## The beaten general lies on its side (the table keeps it so on a new layout).
var toppled: bool = false

var _seal := Control.new()
var _strip := PanelContainer.new()
var _headline := Label.new()
var _line := Label.new()
var _words: Array = []
var _fill := CINNABAR
var _timeline: Tween
var _sound := Callable()
var _piece: TextureRect
var _shadow: TextureRect
var _gap: float = 60.0
var _glow_at := Vector2.ZERO
var _glow: float = -1.0:
	set(value):
		_glow = value
		queue_redraw()
var _splash: float = -1.0:
	set(value):
		_splash = value
		queue_redraw()


func _init() -> void:
	name = "Finale"
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_seal.name = "EndSeal"
	_seal.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_seal.visible = false
	_seal.draw.connect(_draw_seal)
	add_child(_seal)
	_strip.name = "EndStrip"
	_strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_strip.visible = false
	var style: StyleBoxFlat = XomDaoUi.with_shadow(XomDaoUi.box(IVORY, WALNUT, 5, 10.0))
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
	_line.add_theme_color_override("font_color", WALNUT)
	column.add_child(_line)
	add_child(_strip)


## A new game: nothing ended yet.
func reset() -> void:
	if _timeline != null:
		_timeline.kill()
	step = Step.IDLE
	toppled = false
	_piece = null
	_shadow = null
	_glow = -1.0
	_splash = -1.0
	_seal.visible = false
	_strip.visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## The end arrived. `live`: seen as it happened (not on joining a finished table, which skips it).
func arm(live: bool) -> void:
	if step == Step.IDLE:
		step = Step.ARMED if live else Step.DONE


func armed() -> bool:
	return step == Step.ARMED


## Returns once the beat is over (or never had to play).
func wait() -> void:
	while step == Step.ARMED or step == Step.PLAYING:
		await done


## Plays the beat. `spec`: outcome ("win", "lose", "draw", "watch"), headline, line, reason,
## board (Rect2), gap, winner_at (the winning general's point, or null), piece and shadow (the
## beaten general's TextureRects, or null), effects, sound (Callable for the outcome sound).
func play(spec: Dictionary) -> void:
	if step != Step.ARMED:
		return
	step = Step.PLAYING
	_sound = spec["sound"]
	_piece = spec.get("piece")
	_shadow = spec.get("shadow")
	_gap = float(spec["gap"])
	if not bool(spec["effects"]):
		_land()
		return
	mouse_filter = Control.MOUSE_FILTER_STOP
	var outcome: String = spec["outcome"]
	_words = SEALS.get(str(spec["reason"]), ["HOÀ", "CỜ"])
	_fill = JADE if outcome == "draw" else CINNABAR
	_headline.text = spec["headline"]
	var ink: Color = {"win": Color("#8E1B1B"), "draw": JADE_DARK}.get(outcome, WALNUT)
	_headline.add_theme_color_override("font_color", ink)
	_line.text = spec["line"]
	_line.visible = _line.text != ""
	var board: Rect2 = spec["board"]
	var side: float = clampf(_gap * 2.5, 128.0, 230.0)
	_seal.size = Vector2.ONE * side
	_seal.pivot_offset = _seal.size / 2.0
	_seal.position = board.get_center() - Vector2(side / 2.0, side * 0.72)
	_seal.rotation = -0.08
	_strip.reset_size()
	_strip.pivot_offset = _strip.size / 2.0
	_strip.position = Vector2(
		board.get_center().x - _strip.size.x / 2.0, _seal.position.y + side + 14.0
	)
	var winner_at: Variant = spec.get("winner_at")
	if winner_at is Vector2:
		_glow_at = winner_at
		# Its own tween: the general's fall and the seal don't wait for the glow.
		create_tween().tween_property(self, "_glow", 1.0, 0.8).from(0.0)
	_timeline = create_tween()
	if _piece != null:
		var rest: Dictionary = {"rotation": _piece.rotation}
		_timeline.tween_property(_piece, "rotation", rest["rotation"] + 0.14, 0.08)
		_timeline.tween_property(_piece, "rotation", rest["rotation"] - 0.12, 0.1)
		_timeline.tween_callback(_topple)
		_timeline.tween_interval(0.3)
	else:
		_timeline.tween_interval(0.45)
	_timeline.tween_callback(_stamp)
	_timeline.tween_interval(0.32)
	_timeline.tween_callback(_unroll)
	_timeline.tween_interval(HOLD - 0.32)
	_timeline.tween_callback(_finish)


## The pose of a general knocked onto its side, from its pose standing on its point.
static func lay_down(piece: TextureRect, shadow: TextureRect, gap: float) -> void:
	piece.rotation = 0.5
	piece.scale = Vector2(1.04, 0.5)
	piece.position.y += gap * 0.2
	piece.modulate = Color(0.68, 0.62, 0.58)
	if shadow != null:
		shadow.scale = Vector2(1.2, 0.62)
		shadow.position.y += gap * 0.24
		shadow.modulate.a = 0.55


## The table's HUD: walnut plates with a brass edge and ivory words, cinnabar chips, a gold
## turn timer; Xin hoà in light walnut, Đầu hàng in a dark, quiet cinnabar.
static func skin() -> XomDaoTableSkin:
	var look := XomDaoTableSkin.new()
	look.plate = Color("#2E170C")
	look.edge = Color("#B8873C")
	look.ink = IVORY
	look.radius = 10.0
	look.chip = Color("#7A1A16")
	look.chip_edge = Color(IVORY, 0.45)
	look.chip_ink = IVORY
	look.timer = GLOW
	look.timer_track = Color("#2E170C", 0.6)
	look.secondary = [Color("#6A4024"), Color("#3A2010"), IVORY]
	look.danger = [Color("#4A1210"), Color("#8E2A22"), Color(IVORY, 0.92)]
	look.round_button = [Color("#2E170C"), Color("#B8873C"), IVORY]
	return look


## Hub hook: the result board in the table's ivory, walnut and cinnabar, with the seal on top.
static func theme(view: Dictionary) -> Dictionary:
	var end: Variant = view.get("end")
	var mate: bool = end is Dictionary and str((end as Dictionary).get("reason", "")) == "checkmate"
	return {
		"paper": IVORY,
		"ink": Color("#4A2414"),
		"accent": CINNABAR,
		"shade": Color("#0E0907", 0.55),
		"title": "Chiếu bí!" if mate else "Tàn cuộc",
		"emblem": preload("res://content/xiangqi/art/emblem.webp"),
	}


## CHIẾU TƯỚNG!: a paper scroll with the checking piece unrolls over the board and rolls away.
static func check_scroll(owner: Control, board: Control, checker: Texture2D) -> void:
	var scroll := PanelContainer.new()
	scroll.name = "CutIn"
	scroll.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.box(IVORY, WALNUT, 6, 10.0)
	style.content_margin_left = 28.0
	style.content_margin_right = 40.0
	style.content_margin_top = 12.0
	style.content_margin_bottom = 12.0
	scroll.add_theme_stylebox_override("panel", style)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	scroll.add_child(row)
	var piece := TextureRect.new()
	piece.texture = checker
	piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	piece.custom_minimum_size = Vector2(96.0, 96.0)
	row.add_child(piece)
	var text := Label.new()
	text.text = "CHIẾU TƯỚNG!"
	text.add_theme_font_override("font", XomDaoUi.display_font(900))
	text.add_theme_font_size_override("font_size", 48)
	text.add_theme_color_override("font_color", Color("#8E1B1B"))
	text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(text)
	owner.add_child(scroll)
	scroll.reset_size()
	scroll.position = board.position + (board.size - scroll.size) / 2.0
	scroll.pivot_offset = scroll.size / 2.0
	scroll.scale = Vector2(0.05, 1.0)
	var tween: Tween = scroll.create_tween()
	tween.tween_property(scroll, "scale", Vector2.ONE, 0.28).set_trans(Tween.TRANS_CUBIC)
	tween.tween_interval(0.9)
	tween.tween_property(scroll, "scale", Vector2(0.05, 1.0), 0.22).set_trans(Tween.TRANS_CUBIC)
	tween.tween_callback(scroll.queue_free)


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (
		(event is InputEventMouseButton and (event as InputEventMouseButton).pressed)
		or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed)
	)
	if pressed and step == Step.PLAYING:
		accept_event()
		_land()


## Straight to the end of the beat: the general down, the sound played, the board free.
func _land() -> void:
	if _timeline != null:
		_timeline.kill()
	if _piece != null and not toppled:
		_piece.rotation = 0.0
		lay_down(_piece, _shadow, _gap)
		toppled = true
	if _sound.is_valid():
		_sound.call()
		_sound = Callable()
	_finish()


## The general tips over onto its side, its shadow spreading under it.
func _topple() -> void:
	if _piece == null or not is_instance_valid(_piece):
		return
	var from_rotation: float = _piece.rotation
	var from_position: Vector2 = _piece.position
	var shadow_position: Vector2 = _shadow.position if _shadow != null else Vector2.ZERO
	_piece.rotation = 0.0
	lay_down(_piece, _shadow, _gap)
	var to_position: Vector2 = _piece.position
	var tween: Tween = _piece.create_tween().set_parallel()
	(
		tween
		. tween_property(_piece, "rotation", _piece.rotation, 0.34)
		. from(from_rotation)
		. set_trans(Tween.TRANS_BOUNCE)
		. set_ease(Tween.EASE_OUT)
	)
	(
		tween
		. tween_property(_piece, "scale", _piece.scale, 0.3)
		. from(Vector2.ONE)
		. set_trans(Tween.TRANS_QUAD)
		. set_ease(Tween.EASE_IN)
	)
	(
		tween
		. tween_property(_piece, "position", to_position, 0.3)
		. from(from_position)
		. set_trans(Tween.TRANS_QUAD)
		. set_ease(Tween.EASE_IN)
	)
	tween.tween_property(_piece, "modulate", _piece.modulate, 0.3).from(Color.WHITE)
	if _shadow != null:
		var to_shadow: Vector2 = _shadow.position
		tween.tween_property(_shadow, "position", to_shadow, 0.3).from(shadow_position)
		tween.tween_property(_shadow, "scale", _shadow.scale, 0.3).from(Vector2.ONE)
	toppled = true


## The seal comes down hard: the outcome sound and a ring of ink on the impact.
func _stamp() -> void:
	_seal.visible = true
	_seal.queue_redraw()
	var tween: Tween = _seal.create_tween()
	(
		tween
		. tween_property(_seal, "scale", Vector2.ONE, 0.16)
		. from(Vector2.ONE * 2.3)
		. set_trans(Tween.TRANS_QUAD)
		. set_ease(Tween.EASE_IN)
	)
	tween.parallel().tween_property(_seal, "modulate:a", 1.0, 0.1).from(0.0)
	tween.tween_callback(
		func() -> void:
			if _sound.is_valid():
				_sound.call()
				_sound = Callable()
	)
	(
		tween
		. tween_property(self, "_splash", 1.0, 0.42)
		. from(0.0)
		. set_trans(Tween.TRANS_CUBIC)
		. set_ease(Tween.EASE_OUT)
	)
	tween.parallel().tween_property(_seal, "scale", Vector2.ONE * 1.05, 0.08)
	tween.tween_property(_seal, "scale", Vector2.ONE, 0.12)


func _unroll() -> void:
	_strip.visible = true
	_strip.scale = Vector2(0.05, 1.0)
	_strip.modulate.a = 1.0
	(
		_strip
		. create_tween()
		. tween_property(_strip, "scale", Vector2.ONE, 0.28)
		. set_trans(Tween.TRANS_BACK)
		. set_ease(Tween.EASE_OUT)
	)


## The beat is over: the seal and the words fade as the result board comes in.
func _finish() -> void:
	if step == Step.DONE:
		return
	step = Step.DONE
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_glow = -1.0
	if _seal.visible:
		var fade: Tween = create_tween().set_parallel()
		fade.tween_property(_seal, "modulate:a", 0.0, 0.3)
		fade.tween_property(_strip, "modulate:a", 0.0, 0.3)
	done.emit()


## Gold rings swelling from the winning general and the ink ring round the stamped seal.
func _draw() -> void:
	if _glow >= 0.0 and _glow < 1.0 and step == Step.PLAYING:
		for i: int in 2:
			var t: float = fposmod(_glow * 2.0 + i * 0.5, 1.0)
			var radius: float = _gap * (0.55 + 0.6 * t)
			draw_arc(_glow_at, radius, 0.0, TAU, 48, Color(GLOW, 1.0 - t), _gap * 0.09, true)
	if _splash >= 0.0 and _splash < 1.0 and _seal.visible:
		var center: Vector2 = _seal.position + _seal.size / 2.0
		var radius: float = _seal.size.x * (0.6 + 0.35 * _splash)
		var ink := Color(_fill, 0.45 * (1.0 - _splash))
		draw_arc(center, radius, 0.0, TAU, 64, ink, 10.0 * (1.0 - _splash) + 2.0, true)


## A square seal: lacquer face, an ivory double border and its words carved in ivory.
func _draw_seal() -> void:
	var side: float = _seal.size.x
	var face: StyleBoxFlat = XomDaoUi.box(_fill, _fill.darkened(0.35), 4, side * 0.09)
	face.shadow_color = Color(0.05, 0.02, 0.01, 0.45)
	face.shadow_size = 10
	face.shadow_offset = Vector2(5.0, 8.0)
	face.draw(_seal.get_canvas_item(), Rect2(Vector2.ZERO, _seal.size))
	var inset: float = side * 0.08
	var frame := Rect2(Vector2.ONE * inset, _seal.size - Vector2.ONE * inset * 2.0)
	_seal.draw_rect(frame, IVORY, false, maxf(2.0, side * 0.025), true)
	var inner: Rect2 = frame.grow(-side * 0.04)
	_seal.draw_rect(inner, Color(IVORY, 0.7), false, maxf(1.0, side * 0.01), true)
	var font: Font = XomDaoUi.display_font(900)
	var lines: int = _words.size()
	var font_size: int = int(side * (0.27 if lines > 1 else 0.36))
	var line_height: float = font.get_height(font_size) * 0.86
	var top: float = (side - line_height * lines) / 2.0 + font.get_ascent(font_size) * 0.92
	for i: int in lines:
		var word: String = _words[i]
		var width: float = font.get_string_size(word, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
		var scale_x: float = minf(1.0, inner.size.x * 0.9 / width)
		var at := Vector2((side - width * scale_x) / 2.0, top + line_height * i)
		_seal.draw_set_transform(at, 0.0, Vector2(scale_x, 1.0))
		_seal.draw_string(font, Vector2.ZERO, word, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, IVORY)
	_seal.draw_set_transform(Vector2.ZERO)
