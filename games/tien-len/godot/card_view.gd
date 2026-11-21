extends Control
## One playing card, drawn in code: an ivory face with its rank and suit in the corner and a
## big suit in the middle, or a red back with a brass lattice. It moves with `move_to`, which
## tweens its center, tilt and size, and turns over with `flip`.

const Rules := preload("rules.gd")
const Style := preload("style.gd")

## The card's own size; a smaller one on the table is a `scale`.
const SIZE := Vector2(72.0, 101.0)

var card := -1
var face_up := true
## Lifted by a tap: drawn with a brass edge.
var selected := false:
	set(value):
		selected = value
		queue_redraw()
## The width factor of a turn: 1 shows the card flat, 0 edge-on.
var squash := 1.0:
	set(value):
		squash = value
		queue_redraw()

var _tween: Tween


func _init(value: int = -1, up: bool = true) -> void:
	card = value
	face_up = up
	custom_minimum_size = SIZE
	size = SIZE
	pivot_offset = SIZE * 0.5
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## Puts the card's center at `center`, tilted `angle` and sized `factor` times, over `seconds`
## after `delay`; no time at all places it at once. Returns the tween (null when placed at once).
func move_to(
	center: Vector2, angle: float, factor: float, seconds: float, delay: float = 0.0
) -> Tween:
	if _tween != null:
		_tween.kill()
		_tween = null
	var corner := center - SIZE * 0.5
	if seconds <= 0.0 and delay <= 0.0:
		position = corner
		rotation = angle
		scale = Vector2(factor, factor)
		return null
	_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tween.tween_property(self, "position", corner, seconds).set_delay(delay)
	_tween.tween_property(self, "rotation", angle, seconds).set_delay(delay)
	_tween.tween_property(self, "scale", Vector2(factor, factor), seconds).set_delay(delay)
	return _tween


## Turns the card over to `up`: it narrows to an edge, swaps faces and widens.
func flip(up: bool, seconds: float, delay: float = 0.0) -> void:
	if face_up == up:
		return
	var turn := create_tween()
	if delay > 0.0:
		turn.tween_interval(delay)
	turn.tween_property(self, "squash", 0.0, seconds * 0.5)
	turn.tween_callback(func() -> void: face_up = up)
	turn.tween_property(self, "squash", 1.0, seconds * 0.5)


## Fades the card out and frees it.
func retire(seconds: float, toward: Vector2 = Vector2.INF) -> void:
	if _tween != null:
		_tween.kill()
	var out := create_tween().set_parallel(true)
	out.tween_property(self, "modulate:a", 0.0, seconds)
	if toward != Vector2.INF:
		(
			out
			. tween_property(self, "position", toward - SIZE * 0.5, seconds)
			. set_trans(Tween.TRANS_CUBIC)
			. set_ease(Tween.EASE_IN)
		)
		out.tween_property(self, "scale", Vector2(0.4, 0.4), seconds)
	out.chain().tween_callback(queue_free)


func _draw() -> void:
	draw_set_transform(SIZE * 0.5, 0.0, Vector2(maxf(squash, 0.02), 1.0))
	var rect := Rect2(-SIZE * 0.5, SIZE)
	if selected:
		draw_style_box(Style.box(Color(0, 0, 0, 0), 9.0, Style.BRASS, 3.0), rect.grow(2.0))
	if face_up:
		_draw_face(rect)
	else:
		_draw_back(rect)


func _draw_face(rect: Rect2) -> void:
	var edge := Style.box(Style.IVORY, 8.0, Style.IVORY_EDGE, 1.5)
	edge.shadow_color = Color(0, 0, 0, 0.35)
	edge.shadow_size = 4
	edge.shadow_offset = Vector2(0, 2)
	draw_style_box(edge, rect)
	var ink := Style.RED if Rules.is_red(card) else Style.INK
	var suit := Rules.suit_of(card)
	var label: String = Rules.RANKS[Rules.rank_of(card)]
	var top_left := rect.position
	Style.draw_centered(
		self, label, top_left + Vector2(15.0, 21.0), 24 if label.length() == 1 else 20, ink, true
	)
	Style.draw_suit(self, suit, top_left + Vector2(15.0, 41.0), 15.0, ink)
	Style.draw_suit(self, suit, rect.get_center() + Vector2(9.0, 10.0), 40.0, ink)
	Style.draw_suit(self, suit, top_left + Vector2(SIZE.x - 11.0, SIZE.y - 11.0), 9.0, ink)


func _draw_back(rect: Rect2) -> void:
	var edge := Style.box(Style.IVORY, 8.0, Style.IVORY_EDGE, 1.5)
	edge.shadow_color = Color(0, 0, 0, 0.35)
	edge.shadow_size = 4
	edge.shadow_offset = Vector2(0, 2)
	draw_style_box(edge, rect)
	var field := rect.grow(-5.0)
	draw_style_box(Style.box(Style.BACK, 5.0), field)
	var line := Color(Style.BACK_LINE, 0.55)
	var gap := 11.0
	var span := field.size.x + field.size.y
	var offset := 0.0
	while offset < span:
		var a := (
			field.position + Vector2(minf(offset, field.size.x), maxf(offset - field.size.x, 0.0))
		)
		var b := (
			field.position + Vector2(maxf(offset - field.size.y, 0.0), minf(offset, field.size.y))
		)
		draw_line(a, b, line, 1.0)
		var c := (
			field.position
			+ Vector2(field.size.x - minf(offset, field.size.x), maxf(offset - field.size.x, 0.0))
		)
		var d := (
			field.position
			+ Vector2(field.size.x - maxf(offset - field.size.y, 0.0), minf(offset, field.size.y))
		)
		draw_line(c, d, line, 1.0)
		offset += gap
	draw_style_box(Style.box(Color(0, 0, 0, 0), 5.0, Color(Style.BACK_LINE, 0.9), 1.5), field)
	var middle := rect.get_center()
	draw_colored_polygon(
		PackedVector2Array(
			[
				middle + Vector2(0, -16),
				middle + Vector2(12, 0),
				middle + Vector2(0, 16),
				middle + Vector2(-12, 0)
			]
		),
		Style.BRASS
	)
	draw_colored_polygon(
		PackedVector2Array(
			[
				middle + Vector2(0, -9),
				middle + Vector2(6, 0),
				middle + Vector2(0, 9),
				middle + Vector2(-6, 0)
			]
		),
		Style.BACK
	)
