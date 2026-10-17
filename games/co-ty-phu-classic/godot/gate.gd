extends Control
## Cờ tỷ phú's jail gate, after the old board's JailGateEffect: two steel doors with bars over
## the whole table. `slam()` shuts them when you are sent to jail (a recoil, a settle, then they
## fade); `open()` slides them apart when you walk out. Named JailGate.

const STEEL := Color("#25323C")
const STEEL_LIGHT := Color("#687D8A")
const STEEL_EDGE := Color("#151F28")
const SHINE := Color(0.69, 0.737, 0.765, 0.7)
const RIVET := Color("#9AAAB4")

## 0 when the doors are apart, 1 when they meet in the middle.
var closure: float = 0.0:
	set(value):
		closure = value
		queue_redraw()
var _spotlight_at := Vector2.ZERO
var _spotlight_radius: float = 72.0
var _spotlight_power: float = 0.0:
	set(value):
		_spotlight_power = value
		queue_redraw()


func _init() -> void:
	name = "JailGate"
	visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


## The doors shut, recoil a little, settle and fade.
func slam() -> void:
	closure = 0.0
	modulate.a = 1.0
	visible = true
	var tween: Tween = create_tween()
	tween.tween_property(self, "closure", 1.0, 0.24).set_trans(Tween.TRANS_CUBIC).set_ease(
		Tween.EASE_IN
	)
	tween.tween_property(self, "closure", 0.965, 0.085).set_trans(Tween.TRANS_QUAD).set_ease(
		Tween.EASE_OUT
	)
	tween.tween_property(self, "closure", 1.0, 0.1).set_trans(Tween.TRANS_QUAD).set_ease(
		Tween.EASE_IN
	)
	tween.tween_interval(0.08)
	tween.tween_property(self, "modulate:a", 0.0, 0.26).set_trans(Tween.TRANS_SINE)
	await tween.finished
	visible = false


## The doors, shut, slide apart.
func open() -> void:
	closure = 1.0
	modulate.a = 1.0
	visible = true
	var tween: Tween = create_tween()
	tween.tween_interval(0.12)
	tween.tween_property(self, "closure", 0.0, 0.65).set_trans(Tween.TRANS_CUBIC).set_ease(
		Tween.EASE_OUT
	)
	await tween.finished
	visible = false


## Briefly isolate a pawn on the Go To Jail square before its transport.
func spotlight(at: Vector2, radius: float) -> void:
	closure = 0.0
	_spotlight_at = at
	_spotlight_radius = maxf(radius, 24.0)
	_spotlight_power = 0.0
	modulate.a = 1.0
	visible = true
	var tween: Tween = create_tween()
	tween.tween_property(self, "_spotlight_power", 1.0, 0.12).set_trans(Tween.TRANS_SINE)
	tween.tween_interval(0.3)
	tween.tween_property(self, "_spotlight_power", 0.0, 0.24).set_trans(Tween.TRANS_SINE)
	await tween.finished
	visible = false


func _draw() -> void:
	if _spotlight_power > 0.0:
		_draw_spotlight()
	var half: float = size.x / 2.0
	var gap: float = half * (1.0 - closure)
	_door(-gap, half, 0)
	_door(half + gap, half, 1)


func _draw_spotlight() -> void:
	var power: float = clampf(_spotlight_power, 0.0, 1.0)
	var center: Vector2 = _spotlight_at
	var radius: float = _spotlight_radius
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.015, 0.025, 0.06, 0.34 * power))
	var beam := PackedVector2Array(
		[
			Vector2(center.x - radius * 0.12, -size.y * 0.06),
			Vector2(center.x + radius * 0.12, -size.y * 0.06),
			center + Vector2(radius, radius * 0.24),
			center + Vector2(-radius, radius * 0.24),
		]
	)
	draw_colored_polygon(beam, Color(1.0, 0.91, 0.68, 0.13 * power))
	draw_line(
		Vector2(center.x, -size.y * 0.06),
		center,
		Color(1.0, 0.93, 0.72, 0.2 * power),
		maxf(1.0, size.x * 0.0015),
		true
	)
	draw_set_transform(center, 0.0, Vector2(1.55, 0.58))
	draw_circle(Vector2.ZERO, radius, Color(1.0, 0.82, 0.38, 0.19 * power))
	draw_circle(Vector2.ZERO, radius * 0.62, Color(1.0, 0.93, 0.67, 0.14 * power))
	draw_arc(
		Vector2.ZERO,
		radius * 0.94,
		0.0,
		TAU,
		48,
		Color(1.0, 0.89, 0.55, 0.82 * power),
		maxf(1.5, size.x * 0.002),
		true
	)
	draw_arc(
		Vector2.ZERO,
		radius * 0.68,
		0.0,
		TAU,
		48,
		Color(1.0, 0.95, 0.76, 0.45 * power),
		maxf(1.0, size.x * 0.0012),
		true
	)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


## One door, `width` wide, its left edge at `left`; `side` 0 is the left door.
func _door(left: float, width: float, side: int) -> void:
	var height: float = size.y
	var bars: int = maxi(5, roundi(width / 54.0))
	for k: int in range(1, bars):
		_steel(left + k * width / bars - 6.0, 0.0, 12.0, height)
	_steel(left, 0.0, 18.0, height)
	_steel(left + width - 18.0, 0.0, 18.0, height)
	for y: float in [0.0, height * 0.22, height * 0.78, height - 24.0]:
		_steel(left, y, width, 24.0)
		for k: int in bars + 1:
			var x: float = left + clampf(k * width / bars, 9.0, width - 9.0)
			draw_circle(Vector2(x, y + 12.0), 4.0, STEEL_EDGE)
			draw_circle(Vector2(x - 1.0, y + 11.0), 2.0, RIVET)
	# The two meeting edges carry a heavy latch in the middle.
	var latch: float = left + (width - 34.0 if side == 0 else 0.0)
	_steel(latch, height / 2.0 - 28.0, 34.0, 56.0)
	draw_circle(Vector2(latch + 17.0, height / 2.0), 5.0, Color("#121A22"))


## A steel bar with its shadow, a lit face and a dark edge.
func _steel(x: float, y: float, width: float, length: float) -> void:
	draw_rect(Rect2(x + 4.0, y + 5.0, width + 3.0, length), Color("#10161D", 0.6))
	draw_rect(Rect2(x, y, width, length), STEEL)
	draw_rect(Rect2(x + 2.0, y, maxf(2.0, width * 0.3), length), STEEL_LIGHT)
	draw_rect(Rect2(x + 2.0, y, 2.0, length), SHINE)
	draw_rect(Rect2(x + width - 3.0, y, 3.0, length), STEEL_EDGE)
