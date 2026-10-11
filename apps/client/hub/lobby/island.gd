class_name HubIsland
extends Control
## One genre island on the lobby's ring: a floating toy island baked in Blender
## (`hub/genres/<island>.webp`, assets/sources/render_islands.py) that plays its idle loop and
## bobs in the air, or, until a genre has art, a drawn toy island with the genre's sign on it.
## The selected island is in full colour with a gold glow behind it and its name on a wooden
## sign; the others fade to a blue-grey. A locked one (Sắp có, or a genre with no ready game) is
## grey under thick fog with a lock. The Sự kiện island glows and flies a pennant with the days
## left while an event is open.
##
## The ring sizes and places it (HubIslandRing); the island only draws.

## Size at scale 1: the island and the band above it where the selected one's sign hangs.
const BASE := Vector2(240.0, 280.0)
const SIGN_BAND := 52.0
const SOON := "sap-co"
## The baked loop: FRAMES square cells, COLUMNS to a row, played at FPS.
const FRAMES := 8
const COLUMNS := 4
const FPS := 7.0
## One bob up and down takes this long; it rises this many units at scale 1.
const BOB_SECONDS := 3.2
const BOB_HEIGHT := 5.0
const GREY_SECONDS := 0.3

const _SHADER := """
shader_type canvas_item;
uniform float grey : hint_range(0.0, 1.0) = 0.0;
uniform vec3 tint : source_color = vec3(0.62, 0.71, 0.8);
varying vec4 shade;
void vertex() {
	shade = COLOR;
}
void fragment() {
	vec4 c = texture(TEXTURE, UV);
	float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
	vec3 cold = mix(vec3(l), tint, 0.35) * 1.05;
	COLOR = vec4(mix(c.rgb, cold, grey), c.a) * shade;
}
"""

static var _shader: Shader

var genre_id: String = ""
var title: String = "":
	set(value):
		title = value
		_sign.text = value

var locked: bool = false:
	set(value):
		locked = value
		_update_grey(false)
		queue_redraw()
		_veil.queue_redraw()

var selected: bool = false:
	set(value):
		var changed: bool = value != selected
		selected = value
		_sign.visible = value
		_place_sign()
		if changed:
			_update_grey(is_inside_tree())

## How near the front it is: 1 at the front, 0 at the back (paler and smaller).
var depth: float = 1.0:
	set(value):
		depth = value
		modulate = Color(1, 1, 1).lerp(Color(0.78, 0.9, 0.95), 1.0 - value)

var art: Texture2D:
	set(value):
		art = value
		_frames.clear()
		_art.visible = art != null
		if art == null:
			return
		var cell: float = float(art.get_width()) / COLUMNS
		for i: int in FRAMES:
			var frame := AtlasTexture.new()
			frame.atlas = art
			frame.region = Rect2(
				(i % COLUMNS) * cell, floorf(i / float(COLUMNS)) * cell, cell, cell
			)
			_frames.append(frame)
		_art.texture = _frames[0]
		_place_art()

## An event island with an event open: it glows and flies a pennant with the days left (-1: none).
var days_left: int = -1:
	set(value):
		days_left = value
		queue_redraw()
		_veil.queue_redraw()

var _sign := Label.new()
var _lock: Texture2D = XomDaoUi.icon("lock-simple")
var _art := TextureRect.new()
## Fog, lock and pennant, drawn over the art.
var _veil := Control.new()
var _frames: Array[AtlasTexture] = []
var _clock: float = 0.0
var _grey_tween: Tween


## The island for a ring entry ({id, name, island, locked}).
static func create(entry: Dictionary) -> HubIsland:
	var island := HubIsland.new()
	island.genre_id = str(entry.get("id", ""))
	island.name = "Island_" + island.genre_id
	island.title = str(entry.get("name", ""))
	island.locked = bool(entry.get("locked", false))
	island.days_left = int(entry.get("days", -1))
	var art_id: String = str(entry.get("island", ""))
	if art_id.is_empty() and island.genre_id == SOON:
		art_id = SOON
	var path: String = "res://hub/genres/%s.webp" % art_id
	if not art_id.is_empty() and ResourceLoader.exists(path):
		island.art = load(path)
	return island


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	size = BASE
	# Islands on one ring bob out of step.
	_clock = randf() * BOB_SECONDS
	if _shader == null:
		_shader = Shader.new()
		_shader.code = _SHADER
	var paint := ShaderMaterial.new()
	paint.shader = _shader
	_art.material = paint
	_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_art.stretch_mode = TextureRect.STRETCH_SCALE
	_art.visible = false
	add_child(_art)
	_veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_veil.draw.connect(_draw_veil)
	add_child(_veil)
	_sign.visible = false
	_sign.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_sign.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_sign.add_theme_font_override("font", XomDaoUi.display_font(800))
	_sign.add_theme_font_size_override("font_size", 34)
	_sign.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_sign.add_theme_color_override("font_outline_color", XomDaoUi.HONEY_DARK)
	_sign.add_theme_constant_override("outline_size", 8)
	var plank: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.HONEY, XomDaoUi.HONEY_DARK, XomDaoUi.BORDER, 14.0)
	)
	plank.content_margin_left = 22.0
	plank.content_margin_right = 22.0
	_sign.add_theme_stylebox_override("normal", plank)
	add_child(_sign)
	resized.connect(_place_sign)
	resized.connect(_place_art)
	_update_grey(false)


## How grey the art is: 0 selected and open, 1 not selected or locked.
func grey() -> float:
	return (_art.material as ShaderMaterial).get_shader_parameter("grey")


func _update_grey(animate: bool) -> void:
	var target: float = 1.0 if locked or not selected else 0.0
	var paint := _art.material as ShaderMaterial
	if _grey_tween != null:
		_grey_tween.kill()
	if animate:
		_grey_tween = create_tween()
		_grey_tween.tween_property(paint, "shader_parameter/grey", target, GREY_SECONDS)
	else:
		paint.set_shader_parameter("grey", target)


func _process(delta: float) -> void:
	_clock += delta
	if not _frames.is_empty():
		_art.texture = _frames[int(_clock * FPS) % FRAMES]
	_place_art()


## The art's square: as wide as the island, its foot on the island's foot, bobbing.
func art_rect() -> Rect2:
	var k: float = size.x / BASE.x
	var bob: float = sin(_clock * TAU / BOB_SECONDS) * BOB_HEIGHT * k
	return Rect2(0.0, size.y - size.x - bob, size.x, size.x)


func _place_art() -> void:
	var rect: Rect2 = art_rect()
	_art.position = rect.position
	_art.size = rect.size
	_veil.position = Vector2.ZERO
	_veil.size = size
	if art != null:
		_veil.queue_redraw()


## Where the island itself is inside the control (below the sign band).
func body_rect() -> Rect2:
	var k: float = size.x / BASE.x
	return Rect2(0.0, SIGN_BAND * k, size.x, size.y - SIGN_BAND * k)


func _place_sign() -> void:
	var k: float = size.x / BASE.x
	_sign.scale = Vector2.ONE * k
	_sign.size = _sign.get_combined_minimum_size()
	_sign.position = Vector2((size.x - _sign.size.x * k) / 2.0, 0.0)
	queue_redraw()


func _ready() -> void:
	_place_sign.call_deferred()


func _draw() -> void:
	var body: Rect2 = body_rect()
	var k: float = size.x / BASE.x
	if art != null:
		# A soft glow in the air behind the island.
		var glow := Vector2(body.get_center().x, art_rect().position.y + size.x * 0.42)
		if days_left >= 0 and not locked:
			_ellipse(glow, size.x * 0.5, size.x * 0.36, Color(XomDaoUi.LANTERN, 0.14), 0.0)
		if selected and not locked:
			for i: int in 3:
				var r: float = size.x * (0.52 - i * 0.07)
				_ellipse(glow, r, r * 0.72, Color(XomDaoUi.GOLD, 0.12), 0.0)
		return
	var c := Vector2(body.get_center().x, body.position.y + body.size.y * 0.62)
	var rx: float = body.size.x * 0.46
	var ry: float = body.size.y * 0.3
	if days_left >= 0 and not locked:
		_ellipse(c, rx * 1.3, ry * 1.5, Color(XomDaoUi.LANTERN, 0.18), 0.0)
		_ellipse(c, rx * 1.18, ry * 1.32, Color(XomDaoUi.GOLD, 0.22), 0.0)
	if selected:
		_ellipse(c + Vector2(0, ry * 0.25), rx * 1.12, ry * 1.25, Color(XomDaoUi.GOLD, 0.35), 0.0)
		_ellipse(c + Vector2(0, ry * 0.25), rx * 1.12, ry * 1.25, XomDaoUi.GOLD, 4.0 * k)
	# Foam on the water, the rocky foot, then the sand and the grass on top.
	_ellipse(c + Vector2(0, ry * 0.18), rx * 1.04, ry * 1.06, Color(1, 1, 1, 0.55), 0.0)
	_ellipse(c + Vector2(0, ry * 0.12), rx, ry, Color("#8C7B6B"), 0.0)
	_ellipse(c, rx * 0.97, ry * 0.92, XomDaoUi.SAND, 0.0)
	_ellipse(c - Vector2(0, ry * 0.18), rx * 0.72, ry * 0.62, XomDaoUi.BAMBOO, 0.0)
	_ellipse(
		c - Vector2(rx * 0.1, ry * 0.28), rx * 0.48, ry * 0.38, XomDaoUi.BAMBOO.lightened(0.15), 0.0
	)
	if not locked:
		_draw_palm(c + Vector2(rx * 0.62, -ry * 0.2), k)
		_draw_mark(c - Vector2(0, ry * 0.35), k)


## Over the island: the fog and lock of a locked one, the pennant of an open event.
func _draw_veil() -> void:
	var k: float = size.x / BASE.x
	if art != null:
		var rect: Rect2 = art_rect()
		# The grass top of the baked island is around these fractions of its square.
		var top := Vector2(rect.get_center().x, rect.position.y + rect.size.y * 0.42)
		if locked:
			_draw_fog(top, rect.size.x * 0.4, rect.size.x * 0.16, k)
		elif days_left >= 0:
			_draw_pennant(top + Vector2(-rect.size.x * 0.28, rect.size.x * 0.02), k)
		return
	var body: Rect2 = body_rect()
	var c := Vector2(body.get_center().x, body.position.y + body.size.y * 0.62)
	if locked:
		_draw_fog(c, body.size.x * 0.46, body.size.y * 0.3, k)
	elif days_left >= 0:
		_draw_pennant(c + Vector2(-body.size.x * 0.46 * 0.62, -body.size.y * 0.3 * 0.1), k)


## The genre's sign on its island until it has art: a little board, or fanned cards.
func _draw_mark(at: Vector2, k: float) -> void:
	match genre_id:
		"co":
			var side: float = 70.0 * k
			var board := Rect2(at - Vector2(side, side * 0.6) / 2.0, Vector2(side, side * 0.6))
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
			# A lantern on a stick.
			draw_line(at + Vector2(0, -40) * k, at + Vector2(0, -26) * k, XomDaoUi.INK, 2.0 * k)
			_ellipse(at, 26.0 * k, 22.0 * k, XomDaoUi.LANTERN, 0.0)
			_ellipse(at, 12.0 * k, 22.0 * k, XomDaoUi.LACQUER_DARK, 2.0 * k)
			draw_rect(Rect2(at + Vector2(-10, -26) * k, Vector2(20, 6) * k), XomDaoUi.GOLD)
			draw_rect(Rect2(at + Vector2(-10, 20) * k, Vector2(20, 6) * k), XomDaoUi.GOLD)
		"hanh-dong":
			# A round bomb with a lit fuse.
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


## A red pennant on a pole with the event's days left.
func _draw_pennant(at: Vector2, k: float) -> void:
	var font: Font = XomDaoUi.display_font(800)
	var font_size: int = int(20 * k)
	var text: String = "Còn %d ngày" % days_left
	var w: float = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x + 30.0 * k
	var top: Vector2 = at + Vector2(0, -96) * k
	_veil.draw_line(at, top, XomDaoUi.HONEY_DARK, 4.0 * k, true)
	var flag := PackedVector2Array(
		[
			top,
			top + Vector2(w, 4.0 * k),
			top + Vector2(w - 12.0 * k, 20.0 * k),
			top + Vector2(w, 36.0 * k),
			top + Vector2(0, 40) * k,
		]
	)
	_veil.draw_colored_polygon(flag, XomDaoUi.LACQUER)
	_veil.draw_string(
		font,
		top + Vector2(8, 27) * k,
		text,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		font_size,
		XomDaoUi.CREAM
	)


func _draw_palm(at: Vector2, k: float) -> void:
	var top: Vector2 = at + Vector2(-6, -58) * k
	draw_line(at, top, XomDaoUi.HONEY_DARK, 6.0 * k, true)
	for i: int in 5:
		var angle: float = PI + i * PI / 4.0
		var tip: Vector2 = top + Vector2(cos(angle), sin(angle) * 0.6 + 0.35) * 34.0 * k
		draw_line(top, tip, XomDaoUi.BAMBOO_DARK, 7.0 * k, true)


## Thick drifting fog over the island and a lock in a dark badge.
func _draw_fog(c: Vector2, rx: float, ry: float, k: float) -> void:
	var drift: float = sin(_clock * TAU / (BOB_SECONDS * 2.0)) * rx * 0.05
	for row: int in 3:
		for i: int in 5:
			var x: float = (i - 2) * rx * 0.42 + (drift if row % 2 == 0 else -drift)
			var at: Vector2 = c + Vector2(x, (row - 1.4) * ry * 0.9 - absf(i - 2) * ry * 0.12)
			var r: float = rx * (0.3 + 0.06 * ((i + row) % 2))
			_veil.draw_circle(at, r, Color(1, 1, 1, 0.5), true, -1.0, true)
	var side: float = 56.0 * k
	var badge: Vector2 = c - Vector2(0, side * 0.5)
	_veil.draw_circle(badge, side * 0.72, XomDaoUi.HUD, true, -1.0, true)
	_veil.draw_texture_rect(
		_lock, Rect2(badge - Vector2(side, side) / 2.0, Vector2(side, side)), false, XomDaoUi.CREAM
	)


func _ellipse(c: Vector2, rx: float, ry: float, color: Color, width: float) -> void:
	var points := PackedVector2Array()
	for i: int in 49:
		var a: float = i * TAU / 48.0
		points.append(c + Vector2(cos(a) * rx, sin(a) * ry))
	if width > 0.0:
		draw_polyline(points, color, width, true)
	else:
		draw_colored_polygon(points, color)
