extends RefCounted
## The arena's blasts and puffs: the grey Blender flipbooks (art/arena-fx3d) played in the
## y-sorted world and tinted per element with tint.gdshader. A bomb's blast spreads from its cell
## outward, one cell every 38 ms, with the element's touch: embers for fire, splashes for water,
## bolts for lightning, shards for ice, gusts for wind, and a mark on the paving. Jobs can wait
## (`later`); the arena runs them every frame (`step`). `jolt` collects how hard the screen
## should shake.

const Rules := preload("res://content/bom-nguyen-to/rules.gd")
const Atlas := preload("res://content/bom-nguyen-to/atlas.gd")
const Effects := preload("res://content/bom-nguyen-to/effects.gd")
const TINT := preload("res://content/bom-nguyen-to/tint.gdshader")
const TINT_ADD := preload("res://content/bom-nguyen-to/tint_add.gdshader")
const Lens := preload("res://content/bom-nguyen-to/lens.gd")
const BAKE := 128.0
const SPREAD_MS := 38.0
## Each palette's colours for the grey flipbooks: smoke (with its alpha), shade, body, hot.
const PALETTES: Dictionary = {
	"fire": ["#9c5a4899", "#d9381f", "#ff8f2a", "#ffe9a0"],
	"water": ["#d8f1fb88", "#1f78c0", "#4fc3f7", "#f0fdff"],
	"lightning": ["#6a52a8aa", "#7a4fd6", "#c3a4ff", "#fdf8ff"],
	"ice": ["#e4f6fcaa", "#6fb8e0", "#bdf2ff", "#ffffff"],
	"wind": ["#e0fff288", "#228a6c", "#7fe3c0", "#ffffff"],
	"dust": ["#9a8a7499", "#a68d6c", "#d3bf9c", "#f3e6cc"],
	"stone": ["#8f7a6a99", "#7d6658", "#b39d87", "#e8dccb"],
	"ko": ["#ffffff55", "#9aa3b5", "#dfe4ee", "#ffffff"],
}
## The mark a blast leaves on the paving, per element.
const SCORCH: Dictionary = {
	"fire": Color(0.2, 0.1, 0.05, 0.32),
	"lightning": Color(0.22, 0.14, 0.32, 0.28),
	"water": Color(0.14, 0.36, 0.55, 0.24),
	"ice": Color(0.92, 0.98, 1.0, 0.4),
}

var world: Node2D
var fx: Effects
var lens: Lens
## Your fighter's id: your own blasts shake a little more.
var me: String = ""
## How hard the screen should shake now (the arena takes it).
var jolt: float = 0.0

var _materials: Dictionary = {}
var _pending: Array[Dictionary] = []
var _seen: Dictionary = {}


func clear() -> void:
	_pending.clear()
	_seen.clear()


## Runs `call` after `delay` ms.
func later(delay: float, call: Callable) -> void:
	_pending.append({"at": Time.get_ticks_msec() + delay, "call": call})


func step(ms: float) -> void:
	if _pending.is_empty():
		return
	var due: Array[Dictionary] = []
	var keep: Array[Dictionary] = []
	for job: Dictionary in _pending:
		if float(job["at"]) <= ms:
			due.append(job)
		else:
			keep.append(job)
	_pending = keep
	for job: Dictionary in due:
		var call: Callable = job["call"]
		if call.is_valid():
			call.call()


## Starts the blasts this view shows for the first time; true when any did (the boom).
func show(view: Dictionary, feedback: bool) -> bool:
	var live: Dictionary = {}
	var fresh: bool = false
	for blast: Dictionary in view["blasts"]:
		var id: int = int(blast["id"])
		live[id] = true
		if _seen.has(id):
			continue
		_seen[id] = true
		if not feedback:
			continue
		if str(blast["element"]) == "wind" and float(blast.get("damage", 0)) == 0.0:
			continue  # A gust of the wind skill: the fighter's own effect shows it.
		fresh = true
		_blast(blast)
	for id: int in _seen.keys():
		if not live.has(id):
			_seen.erase(id)
	return fresh


## The tint for a palette (an element, dust, stone, ko); `additive` for glows.
func material(palette: String, additive: bool = false) -> ShaderMaterial:
	var key: String = palette + ("+" if additive else "")
	if _materials.has(key):
		return _materials[key]
	var colors: Array = PALETTES.get(palette, PALETTES["dust"])
	var mat := ShaderMaterial.new()
	if additive:
		mat.shader = TINT_ADD
		mat.set_shader_parameter("shade", Color(colors[1]))
		mat.set_shader_parameter("hot", Color(colors[3]))
	else:
		mat.shader = TINT
		mat.set_shader_parameter("smoke", Color(colors[0]))
		mat.set_shader_parameter("shade", Color(colors[1]))
		mat.set_shader_parameter("body", Color(colors[2]))
		mat.set_shader_parameter("hot", Color(colors[3]))
	_materials[key] = mat
	return mat


## Plays a grey flipbook (`puff`, `splash`, `swirl`) at a cell, `size` cells across its
## canvas's two, tinted with `palette`, after `delay` ms; a looping clip stops after `last`.
func burst(
	clip: String, at: Vector2, size: float, palette: String, delay: float, last: float = 0.0
) -> void:
	if delay > 0.0:
		later(delay, burst.bind(clip, at, size, palette, 0.0, last))
		return
	if world.get_child_count() > 260:
		return
	var sprite := AnimatedSprite2D.new()
	sprite.sprite_frames = Atlas.fx3d()
	sprite.centered = false
	sprite.offset = -Atlas.FX_ANCHOR
	sprite.flip_h = randf() < 0.5
	sprite.material = material(palette)
	sprite.set_meta("fx", true)
	var k: float = lens.cell_width() * lens.zoom(at) / BAKE * size
	sprite.scale = Vector2(k, k)
	sprite.position = lens.point(at + Vector2(0, 0.32))
	world.add_child(sprite)
	sprite.play(clip)
	if last > 0.0:
		later(last, sprite.queue_free)
	else:
		sprite.animation_finished.connect(sprite.queue_free)


func _blast(blast: Dictionary) -> void:
	var element: String = str(blast["element"])
	var enhanced: bool = bool(blast.get("enhanced", false))
	var cells: Array = blast["cells"]
	if cells.is_empty():
		return
	var centre := Vector2(float(cells[0]["x"]), float(cells[0]["y"]))
	var color: Color = Rules.CHARACTERS[element]["color"]
	var reach: int = 0
	for cell: Dictionary in cells:
		var at := Vector2(float(cell["x"]), float(cell["y"]))
		var steps: float = absf(at.x - centre.x) + absf(at.y - centre.y)
		reach = maxi(reach, int(steps))
		var delay: float = steps * SPREAD_MS
		var big: bool = steps == 0.0
		burst(
			"puff",
			at,
			(1.35 if big else 0.95) * (0.8 if element == "wind" else 1.0),
			element,
			delay
		)
		if SCORCH.has(element):
			later(delay + 120.0, fx.mark.bind(Vector2i(at), SCORCH[element]))
		match element:
			"fire":
				for i: int in 5 if big else 2:
					later(delay, fx.spark.bind(at, 0.4, Color("#ffb347"), 0.9, 0.5))
			"water":
				if big:
					burst("splash", at, 1.3 if enhanced else 1.0, "water", delay + 30.0)
			"ice":
				if enhanced or big:
					later(delay, _shards.bind(at))
			"wind":
				burst("swirl", at, 1.25, "wind", delay, 560.0)
	if element == "lightning":
		_lightning(cells, centre)
	fx.flash(centre, 2.6 if enhanced else 2.0, color.lerp(Color.WHITE, 0.4), 300.0)
	fx.ring(centre, 1.2 + reach * 0.25, color.lerp(Color.WHITE, 0.6), 380.0)
	var mine: bool = str(blast["owner"]) == me
	jolt = maxf(jolt, 0.45 + minf(0.6, cells.size() * 0.05) + (0.2 if mine else 0.0))


## A bolt along each straight run of the blast, flickering while it lasts.
func _lightning(cells: Array, centre: Vector2) -> void:
	var ends: Dictionary = {}
	for cell: Dictionary in cells:
		var at := Vector2(float(cell["x"]), float(cell["y"]))
		var d: Vector2 = at - centre
		if d == Vector2.ZERO or (d.x != 0.0 and d.y != 0.0):
			continue
		var key: String = str(Vector2(signf(d.x), signf(d.y)))
		if not ends.has(key) or (ends[key] as Vector2).distance_to(centre) < d.length():
			ends[key] = at
	for key: String in ends:
		fx.bolt(centre, ends[key], Color("#c9a8ff"), 420.0)


func _shards(at: Vector2) -> void:
	var sprite := Sprite2D.new()
	sprite.texture = Atlas.fx3d_still("shards-%d" % (randi() % 2))
	sprite.centered = false
	sprite.offset = -Atlas.FX_ANCHOR
	sprite.flip_h = randf() < 0.5
	sprite.set_meta("fx", true)
	var k: float = lens.cell_width() * lens.zoom(at) / BAKE
	sprite.position = lens.point(at + Vector2(0, 0.2))
	sprite.scale = Vector2(k, k * 0.2)
	world.add_child(sprite)
	var tween: Tween = sprite.create_tween()
	tween.tween_property(sprite, "scale", Vector2(k, k), 0.16).set_trans(Tween.TRANS_BACK)
	tween.tween_interval(0.45)
	tween.tween_property(sprite, "modulate:a", 0.0, 0.35)
	tween.tween_callback(sprite.queue_free)
