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
	var fill: Color = XomDaoUi.LACQUER
	var border_gold: Color = XomDaoUi.GOLD
	var border_dark: Color = XomDaoUi.GOLD_DARK
	var lip_color: Color = Color("#54090D")
	var text_color: Color = XomDaoUi.CREAM
	var text_shadow: Color = Color("#380508")
	if mode == DRAW_HOVER:
		fill = fill.lightened(0.08)
		border_gold = border_gold.lightened(0.08)
	if off:
		fill = Color("#827E78")
		border_gold = Color("#66635D")
		border_dark = Color("#524F4A")
		lip_color = Color("#42403B")
		text_color = Color(XomDaoUi.CREAM, 0.45)
		text_shadow = Color(0.0, 0.0, 0.0, 0.3)

	# 1. Contact shadow under the lip.
	var shadow_shape: PackedVector2Array = _shape(sunk + 4.0, size.y + 4.0)
	draw_colored_polygon(shadow_shape, Color(0.12, 0.05, 0.03, 0.35))

	# 2. The lip, standing DEPTH off its bottom.
	_fill(_shape(sunk, size.y), lip_color, lip_color.darkened(0.25))

	# 3. The face standing DEPTH off the lip's bottom.
	var face: PackedVector2Array = _shape(sunk, size.y - DEPTH + sunk)
	_fill(face, fill, border_gold, 4.0)

	var top: float = sunk
	var bottom: float = size.y - DEPTH + sunk

	if not off:
		# 4. Inset gold inlay contour (khảm chỉ vàng truyền thống).
		var inners: Array[PackedVector2Array] = Geometry2D.offset_polygon(face, -5.5)
		for inner: PackedVector2Array in inners:
			draw_polyline(
				inner + PackedVector2Array([inner[0]]), Color(border_dark, 0.7), 1.5, true
			)

		# 5. 2.5D Directional Lighting:
		# Soft gloss on upper half:
		var half := Rect2(0.0, top, size.x, (bottom - top) * 0.48)
		_overlay(face, half, Color(1.0, 1.0, 1.0, 0.08 if down else 0.18))
		# Shading on lower third:
		var low := Rect2(0.0, bottom - (bottom - top) * 0.28, size.x, (bottom - top) * 0.28)
		_overlay(face, low, Color(0.0, 0.0, 0.0, 0.16))

		# Highlight on top-left cut bevel:
		draw_line(
			Vector2(4.0, top + CUT.y - 2.0),
			Vector2(CUT.x - 2.0, top + 4.0),
			Color(1.0, 1.0, 1.0, 0.45 if not down else 0.2),
			2.5,
			true
		)
		# Specular rim under top horizontal edge:
		draw_line(
			Vector2(CUT.x + 8.0, top + 6.0),
			Vector2(size.x - small_corner - 6.0, top + 6.0),
			Color(1.0, 1.0, 1.0, 0.6 if not down else 0.25),
			3.0,
			true
		)
		if _shine < 1.0 and not down:
			_glint(top, bottom)

	# 6. "CHƠI ▶" Typography:
	var font: Font = XomDaoUi.display_font(800)
	var mid: float = (top + bottom) / 2.0
	var word := "CHƠI"
	var word_size: int = 62
	var at := Vector2(CUT.x - 2.0, mid + word_size * 0.33)

	# Embossed 3D shadow for letters:
	draw_string(
		font, at + Vector2(0.0, 3.0), word, HORIZONTAL_ALIGNMENT_LEFT, -1, word_size, text_shadow
	)
	draw_string(font, at, word, HORIZONTAL_ALIGNMENT_LEFT, -1, word_size, text_color)

	var after: float = at.x + font.get_string_size(word, HORIZONTAL_ALIGNMENT_LEFT, -1, word_size).x
	var arrow := PackedVector2Array(
		[
			Vector2(after + 18.0, mid - 18.0),
			Vector2(after + 48.0, mid),
			Vector2(after + 18.0, mid + 18.0)
		]
	)
	var arrow_shadow := PackedVector2Array(
		[
			Vector2(after + 18.0, mid - 18.0 + 3.0),
			Vector2(after + 48.0, mid + 3.0),
			Vector2(after + 18.0, mid + 18.0 + 3.0)
		]
	)
	draw_colored_polygon(arrow_shadow, text_shadow)
	draw_colored_polygon(arrow, border_gold if not off else text_color)
	draw_polyline(
		arrow + PackedVector2Array([arrow[0]]),
		border_gold.lightened(0.2) if not off else text_color,
		2.0,
		true
	)

	if seats != "":
		_draw_seats(font, mid, off)


func _draw_seats(font: Font, mid: float, off: bool) -> void:
	var text_size: int = 26
	var width: float = font.get_string_size(seats, HORIZONTAL_ALIGNMENT_LEFT, -1, text_size).x
	var pill := Rect2(0.0, mid - 24.0, width + 64.0, 48.0)
	pill.position.x = size.x - 22.0 - pill.size.x

	# Pill shadow
	var pill_shadow: StyleBoxFlat = XomDaoUi.box(Color.TRANSPARENT, Color.TRANSPARENT, 0, 24.0)
	pill_shadow.shadow_color = Color(0.12, 0.02, 0.03, 0.45)
	pill_shadow.shadow_size = 2
	pill_shadow.shadow_offset = Vector2(0.0, 2.0)
	draw_style_box(pill_shadow, pill)

	# Pill background: dark lacquer / dark wood with thin gold border
	var pill_box: StyleBoxFlat = XomDaoUi.box(
		Color("#36080B") if not off else Color("#45423E"),
		Color(XomDaoUi.GOLD_DARK, 0.8) if not off else Color("#6A6660"),
		2,
		24.0
	)
	draw_style_box(pill_box, pill)

	# Inner subtle top bevel on pill
	var pill_top := StyleBoxFlat.new()
	pill_top.bg_color = Color(1.0, 1.0, 1.0, 0.12)
	pill_top.corner_radius_top_left = 22
	pill_top.corner_radius_top_right = 22
	draw_style_box(
		pill_top, Rect2(pill.position + Vector2(2.0, 2.0), Vector2(pill.size.x - 4.0, 14.0))
	)

	var icon_color: Color = XomDaoUi.GOLD if not off else Color("#A8A59E")
	var label_color: Color = XomDaoUi.CREAM if not off else Color("#D8D5CC")

	# User icon
	draw_texture_rect(
		_users, Rect2(pill.position + Vector2(14.0, 11.0), Vector2(26.0, 26.0)), false, icon_color
	)

	# Seats text with carved shadow
	var text_pos := pill.position + Vector2(46.0, 24.0 + text_size * 0.34)
	draw_string(
		font,
		text_pos + Vector2(0.0, 1.5),
		seats,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		text_size,
		Color(0.1, 0.02, 0.03, 0.8)
	)
	draw_string(font, text_pos, seats, HORIZONTAL_ALIGNMENT_LEFT, -1, text_size, label_color)


func _glint(top: float, bottom: float) -> void:
	var left: float = CUT.x + 8.0
	var right: float = size.x - round_corner
	var band: float = 64.0
	var x: float = lerpf(left, right - band, _shine)
	var glow := Color(1.0, 0.95, 0.82, 0.42 * sin(_shine * PI))
	draw_colored_polygon(
		PackedVector2Array(
			[
				Vector2(x + 24.0, top + 4.0),
				Vector2(x + 24.0 + band, top + 4.0),
				Vector2(x + band, bottom - 4.0),
				Vector2(x, bottom - 4.0)
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
func _fill(shape: PackedVector2Array, color: Color, line: Color, line_width: float = 3.0) -> void:
	draw_colored_polygon(shape, color)
	draw_polyline(shape + PackedVector2Array([shape[0]]), line, line_width, true)


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
