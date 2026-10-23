class_name CheckersEndBeat
extends Control
## The moment a game ends, over the table and before the hub's result board: the dusk dims, a
## lacquered plank with the lantern emblem swings down with the outcome ("Thắng rồi!", "Thua
## rồi", "Hoà", or "<name> thắng" for a spectator) and how it ended; on a win, lanterns rise off
## the water and sparks burst round the plank. About 2.4 s; a tap anywhere skips it. `done` fires
## once when it is over (skipped or not) and the beat frees itself.

signal done

enum Outcome { WIN, LOSS, DRAW, WATCHED }

const HOLD := 1.7
const PLANKS: Dictionary = {
	Outcome.WIN: [Color("#8E1B1B"), Color("#E7B53C")],
	Outcome.LOSS: [Color("#2E3B47"), Color("#7C8A96")],
	Outcome.DRAW: [Color("#6E4220"), Color("#D9963F")],
	Outcome.WATCHED: [Color("#14505C"), Color("#E7B53C")],
}

var _finished: bool = false
var _tween: Tween


## The outcome for a player of side `mine` ("" for a spectator) when `winner` won (null: draw).
## The table's HUD at the harbor: dark weathered planks with a hemp-rope edge, sea-teal chips, a
## lantern-gold turn timer; Xin hoà in sea teal, Đầu hàng in dark wood with a rust edge.
static func skin() -> XomDaoTableSkin:
	var look := XomDaoTableSkin.new()
	look.plate = Color("#20343A")
	look.edge = Color("#C9A86A")
	look.ink = Color("#F6EBD3")
	look.radius = 10.0
	look.chip = Color("#1E5F6E")
	look.chip_edge = Color("#C9A86A", 0.6)
	look.chip_ink = Color("#F6EBD3")
	look.timer = Color("#E7B53C")
	look.timer_track = Color("#0B2830", 0.6)
	look.secondary = [Color("#2B6F7E"), Color("#164550"), Color("#F6EBD3")]
	look.danger = [Color("#3A2416"), Color("#A0482E"), Color("#F6EBD3", 0.92)]
	look.round_button = [Color("#20343A"), Color("#C9A86A"), Color("#F6EBD3")]
	return look


static func outcome_of(winner: Variant, mine: String) -> Outcome:
	if winner == null:
		return Outcome.DRAW
	if mine == "":
		return Outcome.WATCHED
	return Outcome.WIN if str(winner) == mine else Outcome.LOSS


## The plank's words for an outcome; "" for a spectator's, which names the winner.
static func title_of(outcome: Outcome) -> String:
	return {Outcome.WIN: "Thắng rồi!", Outcome.LOSS: "Thua rồi", Outcome.DRAW: "Hoà"}.get(
		outcome, ""
	)


## The table's sound for an outcome (a spectator hears the win).
static func sound_of(outcome: Outcome) -> String:
	return {Outcome.LOSS: "lose", Outcome.DRAW: "draw"}.get(outcome, "victory")


## The hub's result board in the harbor's colours: "Thu lưới" (pulling in the nets) under the
## lantern emblem.
static func result_theme(emblem: Texture2D) -> Dictionary:
	return {
		"paper": Color("#F6EBD3"),
		"ink": Color("#1F3238"),
		"accent": Color("#1E8FA6"),
		"shade": Color("#061419", 0.6),
		"title": "Thu lưới",
		"emblem": emblem,
	}


## Starts the beat over `host`, centred on `board`. `motion` false keeps it still and short.
static func play(
	host: Control,
	outcome: Outcome,
	title: String,
	reason: String,
	board: Rect2,
	emblem: Texture2D,
	motion: bool
) -> CheckersEndBeat:
	var beat := CheckersEndBeat.new()
	beat.name = "EndBeat"
	host.add_child(beat)
	beat._build(outcome, title, reason, board, emblem, motion)
	return beat


func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP


## Ends the beat now (a tap does this too).
func skip() -> void:
	if _finished:
		return
	_finished = true
	if _tween != null:
		_tween.kill()
	done.emit()
	var out: Tween = create_tween()
	out.tween_property(self, "modulate:a", 0.0, 0.15)
	out.tween_callback(queue_free)


func _gui_input(event: InputEvent) -> void:
	var tapped: bool = event is InputEventMouseButton and (event as InputEventMouseButton).pressed
	if tapped or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed):
		accept_event()
		skip()


func _build(
	outcome: Outcome, title: String, reason: String, board: Rect2, emblem: Texture2D, motion: bool
) -> void:
	# Anchored full: the offsets settle its size to the parent's now (no size set by hand).
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var dusk := ColorRect.new()
	dusk.color = Color("#061419", 0.0)
	dusk.set_anchors_preset(Control.PRESET_FULL_RECT)
	dusk.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(dusk)
	var colors: Array = PLANKS[outcome]
	var plank := PanelContainer.new()
	plank.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.box(colors[0], colors[1], 4, 22.0)
	style.content_margin_left = 48.0
	style.content_margin_right = 48.0
	style.content_margin_top = 64.0
	style.content_margin_bottom = 22.0
	style.shadow_color = Color(0.0, 0.0, 0.0, 0.45)
	style.shadow_size = 18
	style.shadow_offset = Vector2(6.0, 12.0)
	plank.add_theme_stylebox_override("panel", style)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 2)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	plank.add_child(column)
	var heading := Label.new()
	heading.name = "Outcome"
	heading.text = title
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	heading.add_theme_font_override("font", XomDaoUi.display_font(800))
	heading.add_theme_font_size_override("font_size", 64)
	heading.add_theme_color_override("font_color", XomDaoUi.CREAM)
	heading.add_theme_color_override("font_outline_color", Color(0.0, 0.0, 0.0, 0.35))
	heading.add_theme_constant_override("outline_size", 8)
	column.add_child(heading)
	var line := Label.new()
	line.name = "Reason"
	line.text = reason
	line.visible = reason != ""
	line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	line.add_theme_font_override("font", XomDaoUi.body_font(true))
	line.add_theme_font_size_override("font_size", 28)
	line.add_theme_color_override("font_color", Color(XomDaoUi.CREAM, 0.85))
	column.add_child(line)
	plank.name = "Plank"
	# The plank and the emblem over its top edge move as one.
	var banner := Control.new()
	banner.name = "Banner"
	banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	banner.add_child(plank)
	add_child(banner)
	plank.reset_size()
	plank.custom_minimum_size.x = maxf(plank.size.x, 440.0)
	plank.reset_size()
	banner.size = plank.size
	var rest := Vector2(
		board.get_center().x - plank.size.x / 2.0, board.get_center().y - plank.size.y / 2.0 + 30.0
	)
	banner.position = rest
	banner.pivot_offset = Vector2(plank.size.x / 2.0, 0.0)
	var badge := TextureRect.new()
	badge.name = "Emblem"
	badge.texture = emblem
	badge.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	badge.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	badge.size = Vector2(124.0, 112.0)
	badge.position = Vector2((plank.size.x - badge.size.x) / 2.0, -badge.size.y * 0.5)
	if outcome == Outcome.LOSS:
		badge.modulate = Color(0.7, 0.72, 0.78)
	banner.add_child(badge)

	_tween = create_tween()
	if not motion:
		dusk.color.a = 0.35
		_tween.tween_interval(HOLD * 0.7)
		_tween.tween_callback(skip)
		return
	banner.position.y = rest.y - 260.0
	banner.rotation = -0.08
	banner.modulate.a = 0.0
	_tween.set_parallel()
	_tween.tween_property(dusk, "color:a", 0.42, 0.35)
	_tween.tween_property(banner, "modulate:a", 1.0, 0.2)
	_tween.tween_property(banner, "position:y", rest.y, 0.42).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)
	_tween.tween_property(banner, "rotation", 0.0, 0.7).set_trans(Tween.TRANS_ELASTIC).set_ease(
		Tween.EASE_OUT
	)
	_tween.chain().tween_interval(HOLD)
	_tween.chain().tween_callback(skip)
	if outcome == Outcome.WIN or outcome == Outcome.WATCHED:
		for i: int in 3:
			get_tree().create_timer(0.3 + 0.35 * i).timeout.connect(
				_burst.bind(rest + banner.size / 2.0, banner.size, i)
			)
		for i: int in 9:
			_lantern(board, i)
	elif outcome == Outcome.LOSS:
		var droop: Tween = banner.create_tween()
		droop.tween_interval(0.75)
		droop.tween_property(banner, "rotation", 0.035, 0.6).set_trans(Tween.TRANS_SINE)


## Sparks round the plank's edge.
func _burst(center: Vector2, area: Vector2, round_of: int) -> void:
	if _finished:
		return
	var at: Vector2 = center + Vector2((round_of - 1) * area.x * 0.42, -area.y * 0.25)
	CheckersFlourish.sparkles(self, at, 120.0)


## A small paper lantern rising off the water and fading out.
func _lantern(board: Rect2, i: int) -> void:
	var glow := Control.new()
	glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var radius: float = 12.0 + float(i % 3) * 4.0
	glow.draw.connect(
		func() -> void:
			glow.draw_circle(Vector2.ZERO, radius * 2.2, Color("#FFB04A", 0.18))
			glow.draw_circle(Vector2.ZERO, radius, Color("#D3603F"))
			glow.draw_circle(
				Vector2(-radius * 0.25, -radius * 0.3), radius * 0.55, Color("#F59A62")
			)
			glow.draw_rect(Rect2(-radius * 0.5, -radius - 4.0, radius, 5.0), XomDaoUi.GOLD)
	)
	add_child(glow)
	move_child(glow, 1)
	var x: float = board.position.x + board.size.x * (0.08 + 0.84 * fmod(i * 0.37, 1.0))
	glow.position = Vector2(x, board.end.y + 20.0)
	glow.modulate.a = 0.0
	var rise: Tween = glow.create_tween().set_parallel()
	var delay: float = 0.1 + 0.12 * i
	var seconds: float = 2.0 + 0.2 * float(i % 4)
	rise.tween_property(glow, "modulate:a", 1.0, 0.3).set_delay(delay)
	(
		rise
		. tween_property(glow, "position:y", board.position.y + board.size.y * 0.15, seconds)
		. set_delay(delay)
	)
	rise.tween_property(glow, "position:x", x + (12.0 if i % 2 == 0 else -12.0), seconds).set_delay(
		delay
	)
