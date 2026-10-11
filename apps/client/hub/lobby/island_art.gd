class_name HubIslandArt
extends Control
## The drawn stand-in for a genre island until its art lands in `hub/genres/` (see HubIsland):
## a floating island of grass on a rocky foot, a waterfall off its edge, a palm, and the genre's
## sign on top (a board for Cờ, fanned cards for Bài, a lantern for Sự kiện, a bomb for Hành
## động). "Sắp có" is a bare grey rock. Drawn on the same square canvas as the real art, always
## in full colour: HubIsland greys and fogs it.

const ROCK := Color("#8C7B6B")
const ROCK_DARK := Color("#6A5B4E")
const SOIL := Color("#A0714A")
const FALL := Color("#BFE8F5")

var genre_id: String = ""
var title: String = ""


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	use_parent_material = true
	resized.connect(queue_redraw)


func _draw() -> void:
	var s: float = size.x
	var k: float = s / HubIsland.BASE.x
	var c := Vector2(s * 0.5, s * 0.42)
	var rx: float = s * 0.4
	var ry: float = s * 0.15
	var bare: bool = genre_id == HubIsland.SOON
	if not bare:
		_draw_fall(c + Vector2(rx * 0.32, ry * 0.7), s, k)
	# The rocky foot, its right side in shade (light from the top left).
	var foot := PackedVector2Array(
		[
			c + Vector2(-rx, 0),
			c + Vector2(-rx * 0.9, s * 0.12),
			c + Vector2(-rx * 0.6, s * 0.2),
			c + Vector2(-rx * 0.38, s * 0.34),
			c + Vector2(-s * 0.03, s * 0.47),
			c + Vector2(rx * 0.22, s * 0.33),
			c + Vector2(rx * 0.55, s * 0.22),
			c + Vector2(rx * 0.88, s * 0.1),
			c + Vector2(rx, 0),
		]
	)
	draw_colored_polygon(foot, ROCK)
	var shade := PackedVector2Array(
		[
			c + Vector2(-s * 0.03, s * 0.47),
			c + Vector2(rx * 0.22, s * 0.33),
			c + Vector2(rx * 0.55, s * 0.22),
			c + Vector2(rx * 0.88, s * 0.1),
			c + Vector2(rx, 0),
			c + Vector2(rx * 0.1, s * 0.05),
		]
	)
	draw_colored_polygon(shade, ROCK_DARK)
	# Soil under the rim, the grass on top and its sunny patch.
	_ellipse(c + Vector2(0, ry * 0.35), rx, ry, ROCK if bare else SOIL)
	_ellipse(c, rx * 0.98, ry * 0.92, ROCK.lightened(0.25) if bare else XomDaoUi.BAMBOO)
	if bare:
		return
	_ellipse(c - Vector2(rx * 0.18, ry * 0.2), rx * 0.6, ry * 0.5, XomDaoUi.BAMBOO.lightened(0.15))
	_draw_palm(c + Vector2(rx * 0.66, -ry * 0.1), k)
	_draw_mark(c - Vector2(0, ry * 0.25), k)


## Water pouring off the island's edge down the canvas.
func _draw_fall(top: Vector2, s: float, k: float) -> void:
	var w: float = 18.0 * k
	draw_rect(Rect2(top.x - w / 2.0, top.y, w, s * 0.95 - top.y), Color(FALL, 0.85))
	for i: int in 3:
		var x: float = top.x - w / 2.0 + w * (i + 0.5) / 3.0
		draw_line(Vector2(x, top.y), Vector2(x, s * 0.92), Color(1, 1, 1, 0.7), 2.0 * k)
	_ellipse(Vector2(top.x, s * 0.95), w * 1.4, w * 0.4, Color(1, 1, 1, 0.6))


## The genre's sign on its island: a little board, fanned cards, a lantern or a bomb.
func _draw_mark(at: Vector2, k: float) -> void:
	match genre_id:
		"co":
			var side: float = 72.0 * k
			var board := Rect2(at - Vector2(side, side * 0.6) / 2.0, Vector2(side, side * 0.6))
			draw_rect(Rect2(board.position + Vector2(3, 4) * k, board.size), XomDaoUi.SHADOW)
			draw_rect(board, XomDaoUi.PAPER_DARK)
			for i: int in range(1, 5):
				var x: float = board.position.x + board.size.x * i / 5.0
				draw_line(
					Vector2(x, board.position.y),
					Vector2(x, board.end.y),
					XomDaoUi.HONEY_DARK,
					1.5 * k
				)
			for i: int in range(1, 3):
				var y: float = board.position.y + board.size.y * i / 3.0
				draw_line(
					Vector2(board.position.x, y),
					Vector2(board.end.x, y),
					XomDaoUi.HONEY_DARK,
					1.5 * k
				)
			_piece(
				board.position + Vector2(board.size.x * 0.3, board.size.y * 0.35),
				12.0 * k,
				XomDaoUi.LACQUER
			)
			_piece(
				board.position + Vector2(board.size.x * 0.7, board.size.y * 0.7),
				12.0 * k,
				XomDaoUi.INK
			)
		"bai":
			for i: int in 3:
				var angle: float = (i - 1) * 0.3
				var card := Rect2(Vector2(-16, -46) * k, Vector2(32, 46) * k)
				draw_set_transform(at + Vector2((i - 1) * 16.0 * k, 4.0 * k), angle)
				draw_rect(card, XomDaoUi.CREAM)
				draw_rect(card, XomDaoUi.INK, false, 1.5 * k)
				var pip: Color = XomDaoUi.LACQUER if i != 1 else XomDaoUi.INK
				draw_circle(card.get_center(), 6.0 * k, pip)
			draw_set_transform(Vector2.ZERO)
		"su-kien":
			draw_line(at + Vector2(0, -40) * k, at + Vector2(0, -26) * k, XomDaoUi.INK, 2.0 * k)
			_ellipse(at, 26.0 * k, 22.0 * k, XomDaoUi.LANTERN)
			draw_rect(Rect2(at + Vector2(-10, -26) * k, Vector2(20, 6) * k), XomDaoUi.GOLD)
			draw_rect(Rect2(at + Vector2(-10, 20) * k, Vector2(20, 6) * k), XomDaoUi.GOLD)
		"hanh-dong":
			var bomb: Vector2 = at + Vector2(0, 4) * k
			draw_circle(bomb + Vector2(2, 3) * k, 24.0 * k, XomDaoUi.SHADOW)
			draw_circle(bomb, 24.0 * k, XomDaoUi.INK)
			draw_circle(bomb - Vector2(8, 8) * k, 7.0 * k, Color(1, 1, 1, 0.35))
			draw_rect(Rect2(bomb + Vector2(-7, -31) * k, Vector2(14, 9) * k), XomDaoUi.HONEY_DARK)
			var fuse: Vector2 = bomb + Vector2(12, -42) * k
			draw_line(bomb + Vector2(0, -30) * k, fuse, XomDaoUi.HONEY, 3.0 * k, true)
			draw_circle(fuse, 7.0 * k, XomDaoUi.GOLD)
			draw_circle(fuse, 3.5 * k, XomDaoUi.LANTERN)
		_:
			var font: Font = XomDaoUi.display_font(800)
			var letter: String = title.left(1)
			var font_size: int = int(48 * k)
			var w: float = font.get_string_size(letter, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
			draw_string(
				font,
				at + Vector2(-w / 2.0, font_size * 0.35),
				letter,
				HORIZONTAL_ALIGNMENT_LEFT,
				-1,
				font_size,
				XomDaoUi.INK
			)


func _piece(at: Vector2, r: float, color: Color) -> void:
	draw_circle(at + Vector2(1, 2), r, XomDaoUi.SHADOW)
	draw_circle(at, r, XomDaoUi.CREAM)
	draw_circle(at, r * 0.75, color, false, 2.0)


func _draw_palm(at: Vector2, k: float) -> void:
	var top: Vector2 = at + Vector2(-6, -58) * k
	draw_line(at, top, XomDaoUi.HONEY_DARK, 6.0 * k, true)
	for i: int in 5:
		var angle: float = PI + i * PI / 4.0
		var tip: Vector2 = top + Vector2(cos(angle), sin(angle) * 0.6 + 0.35) * 34.0 * k
		draw_line(top, tip, XomDaoUi.BAMBOO_DARK, 7.0 * k, true)


func _ellipse(c: Vector2, rx: float, ry: float, color: Color) -> void:
	var points := PackedVector2Array()
	for i: int in 48:
		var a: float = i * TAU / 48.0
		points.append(c + Vector2(cos(a) * rx, sin(a) * ry))
	draw_colored_polygon(points, color)
