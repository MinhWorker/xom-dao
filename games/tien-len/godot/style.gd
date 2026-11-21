extends RefCounted
## The look of the table: a green felt mat under lamp light, ivory cards, brass trim. Palette,
## fonts, small helpers and the four suit shapes, all drawn in code.

const FELT := Color("#164238")
const FELT_DARK := Color("#08130f")
const BRASS := Color("#d6b25e")
const BRASS_DARK := Color("#7d6027")
const IVORY := Color("#f5edd9")
const IVORY_EDGE := Color("#c9bb97")
const INK := Color("#1c1e24")
const RED := Color("#b3262e")
const TEXT := Color("#efe8d4")
const MUTED := Color("#9db3a8")
const PLATE := Color(0.035, 0.075, 0.066, 0.82)
const BACK := Color("#7b1e2c")
const BACK_LINE := Color("#d9b46a")
const DANGER := Color("#d96a55")

static var _bold: FontVariation
static var _shapes: Dictionary = {}


## The text face with a heavier stroke, for numbers and titles.
static func bold() -> Font:
	if _bold == null:
		_bold = FontVariation.new()
		_bold.base_font = ThemeDB.fallback_font
		_bold.variation_embolden = 0.55
	return _bold


static func plain() -> Font:
	return ThemeDB.fallback_font


## A rounded box: the plates, cards and buttons all come from here.
static func box(
	fill: Color, radius: float, border: Color = Color(0, 0, 0, 0), border_width: float = 0.0
) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.set_corner_radius_all(int(radius))
	style.set_border_width_all(int(border_width))
	style.border_color = border
	style.anti_aliasing = true
	return style


## A label that ignores the mouse.
static func label(text: String, font_size: int, color: Color = TEXT, heavy: bool = false) -> Label:
	var node := Label.new()
	node.text = text
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	node.add_theme_font_size_override("font_size", font_size)
	node.add_theme_color_override("font_color", color)
	node.add_theme_font_override("font", bold() if heavy else plain())
	return node


## Draws `text` centered on `center` (its width is measured, so no Label is needed).
static func draw_centered(
	canvas: CanvasItem,
	text: String,
	center: Vector2,
	font_size: int,
	color: Color,
	heavy: bool = false
) -> void:
	var font := bold() if heavy else plain()
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var ascent := font.get_ascent(font_size)
	var descent := font.get_descent(font_size)
	canvas.draw_string(
		font,
		center + Vector2(-width * 0.5, (ascent - descent) * 0.5),
		text,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		font_size,
		color
	)


## Draws suit `suit` (0 spade, 1 club, 2 diamond, 3 heart) as a shape `extent` wide.
static func draw_suit(
	canvas: CanvasItem, suit: int, center: Vector2, extent: float, color: Color
) -> void:
	for part: PackedVector2Array in _suit_parts(suit):
		var points := PackedVector2Array()
		for point in part:
			points.append(center + point * extent * 0.5)
		canvas.draw_colored_polygon(points, color)


static func _suit_parts(suit: int) -> Array:
	if _shapes.has(suit):
		return _shapes[suit]
	var parts: Array = []
	match suit:
		0:
			parts.append(_scaled(_heart(), Vector2(0.98, -0.8), Vector2(0.0, -0.18)))
			parts.append(
				PackedVector2Array(
					[
						Vector2(-0.07, 0.3),
						Vector2(0.07, 0.3),
						Vector2(0.34, 0.98),
						Vector2(-0.34, 0.98)
					]
				)
			)
		1:
			for spot: Vector2 in [Vector2(0.0, -0.46), Vector2(-0.48, 0.2), Vector2(0.48, 0.2)]:
				parts.append(_circle(spot, 0.4))
			parts.append(
				PackedVector2Array(
					[
						Vector2(-0.09, 0.0),
						Vector2(0.09, 0.0),
						Vector2(0.36, 0.98),
						Vector2(-0.36, 0.98)
					]
				)
			)
		2:
			parts.append(
				PackedVector2Array(
					[Vector2(0.0, -1.0), Vector2(0.72, 0.0), Vector2(0.0, 1.0), Vector2(-0.72, 0.0)]
				)
			)
		_:
			parts.append(_scaled(_heart(), Vector2(1.0, 0.94), Vector2.ZERO))
	_shapes[suit] = parts
	return parts


## The classic heart curve, fitted to -1..1.
static func _heart() -> PackedVector2Array:
	var points := PackedVector2Array()
	var steps := 40
	for i in steps:
		var t := TAU * float(i) / float(steps)
		var x := 16.0 * pow(sin(t), 3.0)
		var y := 13.0 * cos(t) - 5.0 * cos(2.0 * t) - 2.0 * cos(3.0 * t) - cos(4.0 * t)
		points.append(Vector2(x / 16.0, (-y - 2.95) / 14.05))
	return points


static func _circle(center: Vector2, radius: float) -> PackedVector2Array:
	var points := PackedVector2Array()
	for i in 20:
		var angle := TAU * float(i) / 20.0
		points.append(center + Vector2(cos(angle), sin(angle)) * radius)
	return points


static func _scaled(
	points: PackedVector2Array, factor: Vector2, offset: Vector2
) -> PackedVector2Array:
	var out := PackedVector2Array()
	for point in points:
		out.append(point * factor + offset)
	return out
