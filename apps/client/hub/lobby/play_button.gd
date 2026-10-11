class_name HubPlayButton
extends Button
## The lobby's CHƠI: one big gold slab that takes the bottom of the selected game's card, its
## top left corner cut off and its bottom right one round like the card's. It says CHƠI ▶ and,
## on a dark pill, how many play (`seats`, "2–4 người"). It stands on a darker lip, catches the
## light on its upper half and sinks when pressed; sweep() sends a glint across it.

const HEIGHT := 124.0
const DEPTH := 9.0
## The corner cut off the top left.
const CUT := Vector2(56.0, 42.0)

## How many play the selected game ("" hides the pill).
var seats: String = "":
	set(value):
		seats = value
		queue_redraw()

## The radius of the bottom right and of the two small corners: the card's own.
var round_corner: float = 44.0
var small_corner: float = 14.0

var _shine: float = 1.0:
	set(value):
		_shine = value
		queue_redraw()

var _users: Texture2D = XomDaoUi.icon("users")


func _init() -> void:
	name = "Play"
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	custom_minimum_size.y = HEIGHT
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	button_down.connect(XomDaoUi.play.bind(self, XomDaoUi.SOUND_TAP))


## A glint crosses the face once.
func sweep(seconds: float = 0.8) -> void:
	_shine = 0.0
	create_tween().tween_property(self, "_shine", 1.0, seconds).set_trans(Tween.TRANS_SINE)


## Only the slab takes the press, not the corner cut off it.
func _has_point(point: Vector2) -> bool:
	return Geometry2D.is_point_in_polygon(point, _shape(0.0, size.y))


func _draw() -> void:
	var mode: int = get_draw_mode()
	var down: bool = mode == DRAW_PRESSED or mode == DRAW_HOVER_PRESSED
	var off: bool = mode == DRAW_DISABLED
	var sunk: float = DEPTH - 3.0 if down else 0.0
	var fill: Color = XomDaoUi.SUN
	var line: Color = XomDaoUi.GOLD_DARK
	var ink: Color = XomDaoUi.INK
	if mode == DRAW_HOVER:
		fill = fill.lightened(0.12)
	if off:
		fill = Color("#B9B6AC")
		line = Color("#7E7B72")
		ink = Color(XomDaoUi.INK, 0.55)
	# The lip, then the face standing DEPTH off its bottom.
	_fill(_shape(sunk, size.y), line.darkened(0.3), line.darkened(0.3))
	var face: PackedVector2Array = _shape(sunk, size.y - DEPTH + sunk)
	_fill(face, fill, line)
	var top: float = sunk
	var bottom: float = size.y - DEPTH + sunk
	if not off:
		# Light from above on the upper half, the lower third turning away.
		var half := Rect2(0.0, top, size.x, (bottom - top) * 0.5)
		_overlay(face, half, Color(1.0, 1.0, 1.0, 0.1 if down else 0.22))
		var low := Rect2(0.0, bottom - (bottom - top) * 0.3, size.x, (bottom - top) * 0.3)
		_overlay(face, low, Color(0.55, 0.3, 0.0, 0.12))
		draw_line(
			Vector2(CUT.x + 10.0, top + 7.0),
			Vector2(size.x - small_corner - 6.0, top + 7.0),
			Color(1.0, 1.0, 1.0, 0.55),
			3.0,
			true
		)
		if _shine < 1.0 and not down:
			_glint(top, bottom)
	# CHƠI ▶ on the left, the seats on a dark pill on the right.
	var font: Font = XomDaoUi.display_font(800)
	var mid: float = (top + bottom) / 2.0
	var word := "CHƠI"
	var word_size: int = 62
	var at := Vector2(CUT.x - 10.0, mid + word_size * 0.33)
	draw_string(font, at, word, HORIZONTAL_ALIGNMENT_LEFT, -1, word_size, ink)
	var after: float = at.x + font.get_string_size(word, HORIZONTAL_ALIGNMENT_LEFT, -1, word_size).x
	var arrow := PackedVector2Array(
		[
			Vector2(after + 16.0, mid - 18.0),
			Vector2(after + 46.0, mid),
			Vector2(after + 16.0, mid + 18.0)
		]
	)
	draw_colored_polygon(arrow, ink)
	draw_polyline(arrow + PackedVector2Array([arrow[0]]), ink, 5.0, true)
	if seats != "":
		_draw_seats(font, mid, ink, off)


func _draw_seats(font: Font, mid: float, ink: Color, off: bool) -> void:
	var text_size: int = 26
	var width: float = font.get_string_size(seats, HORIZONTAL_ALIGNMENT_LEFT, -1, text_size).x
	var pill := Rect2(0.0, mid - 23.0, width + 62.0, 46.0)
	pill.position.x = size.x - 20.0 - pill.size.x
	var box: StyleBoxFlat = XomDaoUi.box(
		Color(ink, 0.5 if off else 0.92), Color.TRANSPARENT, 0, 23.0
	)
	draw_style_box(box, pill)
	var light: Color = Color("#D8D5CC") if off else XomDaoUi.SUN
	draw_texture_rect(
		_users, Rect2(pill.position + Vector2(14.0, 10.0), Vector2(26.0, 26.0)), false, light
	)
	draw_string(
		font,
		pill.position + Vector2(46.0, 23.0 + text_size * 0.34),
		seats,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		text_size,
		light
	)


func _glint(top: float, bottom: float) -> void:
	var left: float = CUT.x + 8.0
	var right: float = size.x - round_corner
	var band: float = 60.0
	var x: float = lerpf(left, right - band, _shine)
	var glow := Color(1.0, 1.0, 1.0, 0.4 * sin(_shine * PI))
	draw_colored_polygon(
		PackedVector2Array(
			[
				Vector2(x + 22.0, top + 5.0),
				Vector2(x + 22.0 + band, top + 5.0),
				Vector2(x + band, bottom - 5.0),
				Vector2(x, bottom - 5.0)
			]
		),
		glow
	)


## The slab between `top` and `bottom`: cut top left, small top right and bottom left corners,
## round bottom right.
func _shape(top: float, bottom: float) -> PackedVector2Array:
	var w: float = size.x
	var points := PackedVector2Array([Vector2(0.0, top + CUT.y), Vector2(CUT.x, top)])
	_arc(points, Vector2(w - small_corner, top + small_corner), small_corner, -PI / 2.0)
	_arc(points, Vector2(w - round_corner, bottom - round_corner), round_corner, 0.0)
	_arc(points, Vector2(small_corner, bottom - small_corner), small_corner, PI / 2.0)
	return points


func _arc(points: PackedVector2Array, centre: Vector2, radius: float, from: float) -> void:
	for i: int in 9:
		var angle: float = from + PI / 2.0 * i / 8.0
		points.append(centre + Vector2(cos(angle), sin(angle)) * radius)


## A filled shape with a smooth edge in `line`.
func _fill(shape: PackedVector2Array, color: Color, line: Color) -> void:
	draw_colored_polygon(shape, color)
	draw_polyline(shape + PackedVector2Array([shape[0]]), line, 3.0, true)


## A tint over the part of `shape` inside `band`.
func _overlay(shape: PackedVector2Array, band: Rect2, color: Color) -> void:
	var box := PackedVector2Array(
		[
			band.position,
			Vector2(band.end.x, band.position.y),
			band.end,
			Vector2(band.position.x, band.end.y)
		]
	)
	for part: PackedVector2Array in Geometry2D.intersect_polygons(shape, box):
		if part.size() >= 3:
			draw_colored_polygon(part, color)
