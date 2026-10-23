extends RefCounted
## The arena's light effects, kept and drawn without nodes: debris thrown by crates and rocks,
## glowing sparks (embers, fuses, sparkles), flashes, shock rings, lightning bolts, the marks
## blasts leave on the paving and the numbers that float up. The arena gives it its camera
## (`lens`), steps it every frame and calls the draw functions from its layers.

const Lens := preload("res://content/bom-nguyen-to/lens.gd")
const TILT := 0.8
const BAKE := 128.0
const DEBRIS := "debris-"

var lens: Lens
## A cell's width on screen at the arena's middle.
var tw: float:
	get:
		return lens.cell_width() if lens != null else 48.0
var glow_tex: Texture2D
## Where debris pictures come from: name → Texture2D (Atlas.fx3d_still).
var art: Callable

var _bits: Array[Dictionary] = []
var _sparks: Array[Dictionary] = []
var _bolts: Array[Dictionary] = []
var _rings: Array[Dictionary] = []
var _flashes: Array[Dictionary] = []
var _floaters: Array[Dictionary] = []
var _marks: Dictionary = {}


func _init() -> void:
	var gradient := Gradient.new()
	gradient.set_color(0, Color(1, 1, 1, 1))
	gradient.set_color(1, Color(1, 1, 1, 0))
	gradient.add_point(0.45, Color(1, 1, 1, 0.45))
	var glow := GradientTexture2D.new()
	glow.gradient = gradient
	glow.fill = GradientTexture2D.FILL_RADIAL
	glow.fill_from = Vector2(0.5, 0.5)
	glow.fill_to = Vector2(1.0, 0.5)
	glow.width = 128
	glow.height = 128
	glow_tex = glow


func project(cell: Vector2) -> Vector2:
	return lens.point(cell)


func lift(cell: Vector2, height: float) -> Vector2:
	return lens.point(cell, height)


func clear() -> void:
	for list: Array[Dictionary] in [_bits, _sparks, _bolts, _rings, _flashes, _floaters]:
		list.clear()
	_marks.clear()


## A piece of debris (`plank`, `stone`, …) thrown from `at` (cells, z = height) with `v`.
func bit(name: String, at: Vector3, v: Vector3, life: float) -> void:
	if _bits.size() > 90:
		return
	(
		_bits
		. append(
			{
				"tex": art.call(DEBRIS + name),
				"p": at,
				"v": v,
				"rot": randf() * TAU,
				"spin": randf_range(-12.0, 12.0),
				"age": 0.0,
				"life": life,
			}
		)
	)


## A glowing spark rising from `at`, `height` cells up, drifting `spread` cells a second.
func spark(at: Vector2, height: float, color: Color, life: float, spread: float) -> void:
	if _sparks.size() > 160:
		return
	(
		_sparks
		. append(
			{
				"p": Vector3(at.x, at.y, height),
				"v":
				Vector3(
					randf_range(-spread, spread),
					randf_range(-spread, spread) * 0.5,
					randf_range(0.6, 1.8)
				),
				"age": 0.0,
				"life": life * randf_range(0.6, 1.0),
				"color": color,
				"size": randf_range(0.08, 0.16),
			}
		)
	)


func flash(at: Vector2, size: float, color: Color, life: float) -> void:
	var ms: float = Time.get_ticks_msec()
	_flashes.append({"at": at, "size": size, "color": color, "start": ms, "end": ms + life})


func ring(at: Vector2, size: float, color: Color, life: float) -> void:
	var ms: float = Time.get_ticks_msec()
	_rings.append({"at": at, "size": size, "color": color, "start": ms, "end": ms + life})


## A flickering bolt from one cell to another.
func bolt(from: Vector2, to: Vector2, color: Color, life: float) -> void:
	var ms: float = Time.get_ticks_msec()
	_bolts.append(
		{"from": from, "to": to, "start": ms, "end": ms + life, "seed": randi(), "color": color}
	)


func floater(text: String, at: Vector2, ink: Color) -> void:
	if _floaters.size() < 18:
		_floaters.append({"text": text, "at": at, "ink": ink, "start": Time.get_ticks_msec()})


## A blast's mark on a cell's paving, fading after a few seconds.
func mark(cell: Vector2i, color: Color) -> void:
	_marks[cell] = {"color": color, "start": Time.get_ticks_msec()}


func step(delta: float) -> void:
	var ms: float = Time.get_ticks_msec()
	var kept: Array[Dictionary] = []
	for one: Dictionary in _bits:
		one["age"] = float(one["age"]) + delta
		if float(one["age"]) >= float(one["life"]):
			continue
		var v: Vector3 = one["v"]
		var p: Vector3 = one["p"]
		v.z -= 14.0 * delta
		p += v * delta
		if p.z < 0.0:
			p.z = 0.0
			v = Vector3(v.x * 0.45, v.y * 0.45, -v.z * 0.3)
			one["spin"] = float(one["spin"]) * 0.4
		one["p"] = p
		one["v"] = v
		one["rot"] = float(one["rot"]) + float(one["spin"]) * delta
		kept.append(one)
	_bits = kept
	var lit: Array[Dictionary] = []
	for one: Dictionary in _sparks:
		one["age"] = float(one["age"]) + delta
		if float(one["age"]) >= float(one["life"]):
			continue
		one["p"] = (one["p"] as Vector3) + (one["v"] as Vector3) * delta
		one["v"] = (one["v"] as Vector3) * (1.0 - delta * 1.5)
		lit.append(one)
	_sparks = lit
	_floaters = _floaters.filter(
		func(one: Dictionary) -> bool: return ms - float(one["start"]) < 900.0
	)
	_bolts = _bolts.filter(func(one: Dictionary) -> bool: return ms < float(one["end"]))
	_rings = _rings.filter(func(one: Dictionary) -> bool: return ms < float(one["end"]))
	_flashes = _flashes.filter(func(one: Dictionary) -> bool: return ms < float(one["end"]))
	for cell: Vector2i in _marks.keys():
		if ms - float(_marks[cell]["start"]) > 2800.0:
			_marks.erase(cell)


## The marks on the paving (under everything).
func draw_marks(on: CanvasItem) -> void:
	var ms: float = Time.get_ticks_msec()
	for cell: Vector2i in _marks:
		var one: Dictionary = _marks[cell]
		var ink: Color = one["color"]
		ink.a *= clampf(1.0 - (ms - float(one["start"]) - 1000.0) / 1800.0, 0.0, 1.0)
		var r := Vector2(tw * 0.5, tw * TILT * 0.5)
		on.draw_texture_rect(glow_tex, Rect2(project(Vector2(cell)) - r, r * 2.0), false, ink)


## Additive light: flashes, sparks and the bolts' halos.
func draw_glow(on: CanvasItem) -> void:
	var ms: float = Time.get_ticks_msec()
	for one: Dictionary in _flashes:
		var t: float = (ms - float(one["start"])) / (float(one["end"]) - float(one["start"]))
		var ink: Color = one["color"]
		ink.a = (1.0 - t) * 0.75
		var r: float = tw * float(one["size"]) * (0.6 + 0.4 * t) / 2.0
		var at: Vector2 = lift(one["at"], 0.35)
		var half := Vector2(r, r * 0.8)
		on.draw_texture_rect(glow_tex, Rect2(at - half, half * 2.0), false, ink)
	for one: Dictionary in _sparks:
		var p: Vector3 = one["p"]
		var ink: Color = one["color"]
		ink.a = 1.0 - float(one["age"]) / float(one["life"])
		var r: float = tw * float(one["size"])
		var at: Vector2 = lift(Vector2(p.x, p.y), p.z)
		on.draw_texture_rect(glow_tex, Rect2(at - Vector2(r, r), Vector2(r, r) * 2.0), false, ink)
	for one: Dictionary in _bolts:
		var ink: Color = one["color"]
		ink.a = 0.55
		on.draw_polyline(_bolt_points(one, ms), ink, maxf(6.0, tw * 0.22), true)


## Over the world: shock rings, bolt cores, debris and the floating numbers.
func draw_over(on: CanvasItem) -> void:
	var ms: float = Time.get_ticks_msec()
	for one: Dictionary in _rings:
		var t: float = (ms - float(one["start"])) / (float(one["end"]) - float(one["start"]))
		var ink: Color = one["color"]
		ink.a = (1.0 - t) * 0.9
		var r: float = tw * float(one["size"]) * (0.3 + 0.7 * sqrt(t))
		var points := PackedVector2Array()
		var at: Vector2 = project(one["at"])
		for i: int in 33:
			var angle: float = TAU * i / 32.0
			points.append(at + Vector2(cos(angle) * r, sin(angle) * r * TILT))
		on.draw_polyline(points, ink, tw * 0.08 * (1.0 - t) + 1.5, true)
	for one: Dictionary in _bolts:
		on.draw_polyline(_bolt_points(one, ms), Color("#fbf6ff"), maxf(2.0, tw * 0.05), true)
	for one: Dictionary in _bits:
		var tex: Texture2D = one["tex"]
		if tex == null:
			continue
		var p: Vector3 = one["p"]
		var k: float = tw * lens.zoom(Vector2(p.x, p.y)) / BAKE
		var t: float = float(one["age"]) / float(one["life"])
		on.draw_set_transform(lift(Vector2(p.x, p.y), p.z), float(one["rot"]), Vector2(k, k))
		on.draw_texture(tex, -Vector2(32, 32), Color(1, 1, 1, clampf((1.0 - t) * 3.0, 0.0, 1.0)))
	on.draw_set_transform(Vector2.ZERO)
	var font: Font = XomDaoUi.display_font(800)
	for one: Dictionary in _floaters:
		var t: float = (ms - float(one["start"])) / 900.0
		var ink: Color = one["ink"]
		ink.a = clampf((1.0 - t) * 2.0, 0.0, 1.0)
		var pop: float = 1.0 + 0.35 * maxf(0.0, 1.0 - t * 5.0)
		var at: Vector2 = project(one["at"]) - Vector2(0, tw * 1.55 + t * tw * 0.6)
		text(on, font, one["text"], at, int(maxi(18, int(tw * 0.34)) * pop), ink)


static func text(
	on: CanvasItem, font: Font, words: String, at: Vector2, font_size: int, ink: Color
) -> void:
	var w: float = font.get_string_size(words, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var spot: Vector2 = at - Vector2(w / 2.0, -font_size * 0.35)
	var outline := Color("#3a2416", ink.a)
	on.draw_string_outline(font, spot, words, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 6, outline)
	on.draw_string(font, spot, words, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, ink)


func _bolt_points(one: Dictionary, ms: float) -> PackedVector2Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(one["seed"]) + int(ms / 50.0)
	var from: Vector2 = one["from"]
	var to: Vector2 = one["to"]
	var steps: int = maxi(3, int(from.distance_to(to) * 3.0))
	var points := PackedVector2Array()
	var along: Vector2 = (to - from).normalized()
	var side := Vector2(-along.y, along.x)
	for i: int in steps + 1:
		var t: float = float(i) / steps
		var jitter: float = 0.0 if i == 0 or i == steps else rng.randf_range(-0.22, 0.22)
		points.append(lift(from.lerp(to, t) + side * jitter, 0.45 + rng.randf_range(-0.1, 0.1)))
	return points
