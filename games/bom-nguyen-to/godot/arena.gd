extends Control
## The island arena: the Blender diorama (art/arena-ground.webp: the paved yard in its brick
## wall, the island and its cliffs) on an animated sea, the stone pillars, crates and baskets,
## the fallen laterite rocks of the closing ring, the ticking bombs, the blasts and the five
## friends walking the lanes. `show_view` takes each snapshot, `step` runs every frame: your
## own fighter walks ahead of the server (it follows where this screen shows you), the others
## glide to their snapshot positions.
##
## Every image shares the bake's camera (sources/render_arena.py), a gentle perspective that
## lens.gd repeats: positions go through `project` / `lift`, and flat sprites grow with `zoom` as
## they come nearer. Blasts are the grey Blender
## flipbooks tinted per element (tint.gdshader), spreading from the bomb outward, with the
## element's own touch: embers, splashes, bolts, ice shards or a gust.
##
## Named nodes for tests: Fighter_<seat>, Bomb_<id>.

signal cue(sound: String)
## Someone was knocked out: their fighter and who did it ({} for a ring or their own bomb).
signal knocked(victim: Dictionary, by: Dictionary)

const Rules := preload("res://content/bom-nguyen-to/rules.gd")
const Atlas := preload("res://content/bom-nguyen-to/atlas.gd")
const SEA := preload("res://content/bom-nguyen-to/sea.gdshader")
const Effects := preload("res://content/bom-nguyen-to/effects.gd")
const Blocks := preload("res://content/bom-nguyen-to/blocks.gd")
const Bursts := preload("res://content/bom-nguyen-to/bursts.gd")
const Lens := preload("res://content/bom-nguyen-to/lens.gd")
const ART := "res://content/bom-nguyen-to/art/"
const TILT := 0.8
const RISE := 0.6
## What `fit` keeps on screen, in cells: the yard, its wall and the lanterns over the back.
const REACH := Rect2(-0.55, -0.85, 13.1, 11.35)
## Pixels of a cell in the bakes.
const BAKE := 128.0
const TEAM_INK: Array[Color] = [Color("#4c9be8"), Color("#f0708f")]
const ITEM_LABEL: Dictionary = {
	"heal": "+30 HP", "range": "Tầm nổ +1", "capacity": "Bom +1", "speed": "Tốc độ +"
}
const ONE_SHOTS: Array[String] = ["place", "skill", "hit", "ko", "spawn"]
const RING_WARNING := 5000.0
## A fighter's 256 px frame covers this many cells.
const ACTOR_SCALE := 1.55
const BIT_ART: Dictionary = {
	"crate-0": ["plank", "plank", "splinter", "splinter"],
	"crate-1": ["weave", "weave", "splinter", "leaf"],
	"rock": ["laterite", "laterite", "stone"],
}

## One cell's width on screen at the arena's middle; a cell is about TILT as tall.
var tw: float = 48.0
var th: float = 48.0 * TILT
## The bake's camera: cells to the screen (lens.gd).
var lens: Lens = Lens.new()
## Your fighter's id, "" when you watch.
var me: String = ""
var view: Dictionary = {}
## 0 at noon, 1 at dusk: the light warms as the match runs out.
var dusk: float = 0.0
var fx: Effects = Effects.new()
var blocks: Blocks = Blocks.new()
var bursts: Bursts = Bursts.new()

var _meta: Dictionary = {}
var _sea := ColorRect.new()
var _base := Node2D.new()
var _ground := Sprite2D.new()
var _shadows := Node2D.new()
var _decals := Control.new()
var _world := Node2D.new()
var _glow := Control.new()
var _overlay := Control.new()
var _glow_tex: Texture2D
var _bombs: Dictionary = {}
var _pickups: Dictionary = {}
## id → {holder, sprite, aura, ice, status, position, correction, element, facing, one_shot…}.
var _actors: Dictionary = {}
var _cells: Array = []
var _items: Dictionary = {}
var _phase: String = ""
var _snapshot_at: float = 0.0
## While you steer, your own fighter keeps its prediction over the snapshots.
var _steered_at: float = -1000.0
var _warnings: Array[Dictionary] = []
var _shake: float = 0.0
var _rumbled: int = 0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_meta = JSON.parse_string(FileAccess.get_file_as_string(ART + "arena-ground.json"))
	lens.read(_meta)
	var sea := ShaderMaterial.new()
	sea.shader = SEA
	_sea.material = sea
	_sea.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_sea)
	_ground.texture = load(ART + "arena-ground.webp")
	_ground.centered = false
	_base.add_child(_ground)
	add_child(_base)
	add_child(_shadows)
	blocks.world = _world
	blocks.shadows = _shadows
	blocks.lens = lens
	bursts.world = _world
	bursts.fx = fx
	bursts.lens = lens
	fx.lens = lens
	for layer: Control in [_decals, _glow, _overlay]:
		layer.set_anchors_preset(Control.PRESET_FULL_RECT)
		layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_decals.draw.connect(_draw_decals)
	add_child(_decals)
	_world.y_sort_enabled = true
	add_child(_world)
	var add := CanvasItemMaterial.new()
	add.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_glow.material = add
	_glow.draw.connect(_draw_glow)
	add_child(_glow)
	_overlay.draw.connect(_draw_overlay)
	add_child(_overlay)
	_glow_tex = fx.glow_tex
	fx.art = Atlas.fx3d_still


## Fits the board in `area` (as big as it goes) and redraws it there.
func fit(area: Rect2) -> void:
	lens.fit(REACH, area)
	tw = lens.cell_width()
	th = tw * TILT
	_ground.scale = Vector2(lens.scale, lens.scale)
	_ground.position = lens.offset
	var margin: float = tw * 0.5
	_sea.position = -Vector2(margin, margin)
	_sea.size = size + Vector2(margin, margin) * 2.0
	var sea: ShaderMaterial = _sea.material
	sea.set_shader_parameter("rect_size", _sea.size)
	sea.set_shader_parameter("island", project(Vector2(6, 5.4)) - _sea.position)
	sea.set_shader_parameter("reach", Vector2(tw * 9.6, th * 8.6))
	sea.set_shader_parameter("cell", tw)
	blocks.refit()
	_place_all()


## The board's rect on screen.
func board_rect() -> Rect2:
	var box := Rect2(project(REACH.position), Vector2.ZERO)
	for corner: Vector2 in [
		Vector2(REACH.end.x, REACH.position.y), REACH.end, Vector2(REACH.position.x, REACH.end.y)
	]:
		box = box.expand(project(corner))
	return box


## Where a ground cell (fractions allowed) is on screen.
func project(cell: Vector2) -> Vector2:
	return lens.point(cell)


## A point `height` cells above a ground cell, on screen.
func lift(cell: Vector2, height: float) -> Vector2:
	return lens.point(cell, height)


## How big a flat sprite at this cell is drawn, against the arena's middle.
func zoom(cell: Vector2) -> float:
	return lens.zoom(cell)


## Where this screen shows a fighter (your own one walks ahead of the server).
func shown_at(id: String) -> Vector2:
	if _actors.has(id):
		return _actors[id]["position"]
	var one: Dictionary = Rules.fighter(view, id)
	return Vector2(float(one.get("x", 0)), float(one.get("y", 0)))


## The play clock now: the snapshot's time plus what passed since it came (at most one tick).
func now() -> float:
	if view.is_empty():
		return 0.0
	return float(view["time"]) + minf(100.0, Time.get_ticks_msec() - _snapshot_at)


## Shakes the arena: `amount` 1 is a big blast.
func shake(amount: float) -> void:
	_shake = minf(1.6, maxf(_shake, amount))


## A new snapshot. `feedback` false (a resync, another viewer) shows it without effects.
func show_view(next: Dictionary, feedback: bool = true) -> void:
	var first: bool = view.is_empty()
	var before: Dictionary = view
	view = next
	_snapshot_at = Time.get_ticks_msec()
	var playing: bool = str(view["phase"]) == "playing"
	feedback = feedback and not first
	var broke: Array[Vector2i] = []
	var fell: Array[Vector2i] = []
	if feedback and playing:
		var cells: Array = view["cells"]
		for i: int in mini(cells.size(), _cells.size()):
			var cell := Vector2i(i % Rules.WIDTH, i / Rules.WIDTH)
			if _cells[i] == "crate" and cells[i] == "floor":
				broke.append(cell)
			elif _cells[i] != "wall" and cells[i] == "wall":
				fell.append(cell)
		_pickup_feedback()
	_cells = (view["cells"] as Array).duplicate()
	_items.clear()
	for item: Dictionary in view["pickups"]:
		_items[Vector2i(int(item["x"]), int(item["y"]))] = item
	_warnings = Rules.warnings(view)
	for cell: Vector2i in broke:
		_break_crate(cell)
	blocks.show(view, fell)
	_show_actors(feedback, before)
	_show_bombs(feedback)
	_show_pickups()
	bursts.me = me
	if bursts.show(view, feedback and playing):
		cue.emit("explode")
	if broke.size() > 0:
		cue.emit("crate")
	if fell.size() > 0:
		_rumbled = 0
	var phase: String = str(view["phase"])
	if phase != _phase and feedback and phase == "countdown":
		for id: String in _actors:
			_play(_actors[id], "spawn")
			bursts.burst("puff", _actors[id]["position"], 0.8, "dust", randf() * 120.0)
	_phase = phase
	_decals.queue_redraw()


## One frame: `direction` is where you steer ("none" when you do not).
func step(delta: float, direction: String) -> void:
	if view.is_empty():
		return
	var time: float = now()
	var ms: float = Time.get_ticks_msec()
	if direction != "none":
		_steered_at = ms
	bursts.step(ms)
	if bursts.jolt > 0.0:
		shake(bursts.jolt)
		bursts.jolt = 0.0
	var playing: bool = str(view["phase"]) == "playing"
	for one: Dictionary in view["fighters"]:
		var id: String = str(one["id"])
		if not _actors.has(id):
			continue
		var actor: Dictionary = _actors[id]
		if int(one["hp"]) <= 0:
			_place_actor(actor, one, time)
			continue
		var held: bool = float(one["frozenUntil"]) > time or float(one["stunUntil"]) > time
		var local: bool = id == me
		var dir: String = "none" if held else (direction if local else str(one["dir"]))
		var speed: float = float(one["speed"])
		speed *= 1.85 if float(one["dashUntil"]) > time else 1.0
		speed *= 0.5 if float(one["slowUntil"]) > time else 1.0
		var before: Vector2 = actor["position"]
		var at: Vector2 = before
		if playing and (local or ms - _snapshot_at < 100.0):
			var d: Vector2 = Vector2(Rules.DIRECTIONS[dir]) * speed * delta
			at = Rules.move(view, id, at, d)
		var pull: float = minf(1.0, delta * 8.0)
		var correction: Vector2 = actor["correction"]
		at += correction * pull
		actor["correction"] = correction * (1.0 - pull)
		actor["position"] = at
		if at.distance_to(before) > 0.002 and not held:
			actor["moved"] = ms
		_animate(actor, one, dir, local and direction != "none", time, ms)
		_place_actor(actor, one, time)
	_pulse_bombs(time, ms)
	_land_rocks(ms)
	var items: Array = _pickups.values()
	for i: int in items.size():
		var item: Node2D = items[i]
		var cell: Vector2 = item.get_meta("cell")
		var bob: float = sin(ms / 260.0 + i) * tw * 0.05 * zoom(cell)
		(item.get_child(0) as Node2D).position.y = bob / item.scale.y - 18.0
		item.position = project(cell + Vector2(0, 0.05))
	fx.step(delta)
	_light(time)
	_rumble(time)
	if _shake > 0.01:
		var jolt: float = _shake * tw * 0.07
		position = Vector2(randf_range(-jolt, jolt), randf_range(-jolt, jolt) * 0.7)
		_shake = maxf(0.0, _shake - delta * 3.2)
	elif position != Vector2.ZERO:
		position = Vector2.ZERO
	_decals.queue_redraw()
	_glow.queue_redraw()
	_overlay.queue_redraw()


## The winner's cheer at the end: their skill pose, a gold burst and confetti.
func celebrate(id: String) -> void:
	if not _actors.has(id):
		return
	var actor: Dictionary = _actors[id]
	var at: Vector2 = actor["position"]
	if int(Rules.fighter(view, id).get("hp", 0)) > 0:
		_play(actor, "skill", true, "down")
	var sprite := AnimatedSprite2D.new()
	sprite.sprite_frames = Atlas.effects()
	sprite.centered = false
	sprite.offset = Vector2(-80, -88)
	sprite.scale = Vector2.ONE * tw * zoom(at) * 2.4 / 160.0
	sprite.position = lift(at, 0.83)
	sprite.set_meta("fx", true)
	sprite.z_index = 1
	sprite.animation_finished.connect(sprite.queue_free)
	_world.add_child(sprite)
	sprite.play("victory")
	fx.flash(at, 3.0, XomDaoUi.GOLD, 600.0)
	fx.ring(at, 2.2, XomDaoUi.GOLD, 700.0)
	for i: int in 24:
		_spark(at, 1.2, [XomDaoUi.GOLD, Color("#ff8a7a"), Color("#8fe3ff")][i % 3], 1.2, 1.4)


## Forgets what the screen remembered (a new viewer or a resync): no effects for this view.
func reset() -> void:
	for id: String in _actors:
		(_actors[id]["holder"] as Node).queue_free()
	_actors.clear()
	for node: Node in _world.get_children():
		if node.has_meta("fx"):
			node.queue_free()
	bursts.clear()
	fx.clear()
	view = {}
	_phase = ""


# ── Light and the closing ring ────────────────────────────────────────────────────────────


func _light(time: float) -> void:
	var played: float = float(view.get("elapsed", 0))
	if str(view["phase"]) == "playing":
		played += time - float(view["time"])
	var target: float = smoothstep(0.35, 1.0, played / Rules.MATCH_TIME)
	dusk = lerpf(dusk, target, 0.05)
	var warm := Color(1, 1, 1).lerp(Color("#ffd9b8"), dusk * 0.6)
	_base.modulate = warm
	_world.modulate = warm
	_shadows.modulate = Color(1, 1, 1, 1.0 - dusk * 0.25)
	(_sea.material as ShaderMaterial).set_shader_parameter("dusk", dusk * 0.6)


func _rumble(time: float) -> void:
	var closing: float = Rules.closing_in(view, time, RING_WARNING)
	var next: Dictionary = Rules.next_ring(view)
	if closing < 0.0 or next.is_empty():
		return
	var ring: int = int(next["ring"])
	if _rumbled != ring:
		_rumbled = ring
		cue.emit("rumble")
	# Pebbles trickle down where the rocks will land.
	if randf() < 0.25:
		var cells: Array[Vector2i] = _ring_cells(ring)
		if not cells.is_empty():
			var cell: Vector2i = cells[randi() % cells.size()]
			fx.bit(
				"laterite",
				Vector3(cell.x + randf_range(-0.3, 0.3), cell.y, 3.0),
				Vector3(0, 0, -2.0),
				0.25
			)
	_shake = maxf(_shake, 0.08)


func _ring_cells(ring: int) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for y: int in range(1, Rules.HEIGHT - 1):
		for x: int in range(1, Rules.WIDTH - 1):
			var cell := Vector2i(x, y)
			if Rules.in_ring(cell, ring) and not Rules.in_ring(cell, ring - 1):
				if Rules.tile_at(view, x, y) != "wall":
					out.append(cell)
	return out


# ── Blocks ────────────────────────────────────────────────────────────────────────────────


## Rocks of the closing ring land: dust, chips, a thud and a jolt.
func _land_rocks(ms: float) -> void:
	var landed: Array[Vector2i] = blocks.drop(ms)
	for cell: Vector2i in landed:
		bursts.burst("puff", Vector2(cell), 1.1, "stone", 0.0)
		for i: int in 5:
			fx.bit(
				BIT_ART["rock"][i % 3],
				Vector3(cell.x, cell.y, 0.2),
				Vector3(randf_range(-2, 2), randf_range(-1.5, 1.5), randf_range(2, 4)),
				1.1
			)
	if not landed.is_empty():
		cue.emit("thud")
		shake(0.9)


func _break_crate(cell: Vector2i) -> void:
	var art: Array = BIT_ART.get(blocks.kind_at(cell), BIT_ART["crate-0"])
	for i: int in 9:
		var a: float = randf() * TAU
		var speed: float = randf_range(1.2, 3.2)
		fx.bit(
			art[i % art.size()],
			Vector3(cell.x + cos(a) * 0.15, cell.y + sin(a) * 0.15, 0.4),
			Vector3(cos(a) * speed, sin(a) * speed * 0.8, randf_range(2.5, 5.0)),
			1.2
		)
	bursts.burst("puff", Vector2(cell), 0.95, "dust", 40.0)


# ── Fighters ──────────────────────────────────────────────────────────────────────────────


func _show_actors(feedback: bool, before: Dictionary) -> void:
	var time: float = float(view["time"])
	var playing: bool = str(view["phase"]) == "playing"
	var kills_before: Dictionary = {}
	for one: Dictionary in before.get("fighters", []):
		kills_before[str(one["id"])] = int(one["kills"])
	for one: Dictionary in view["fighters"]:
		var id: String = str(one["id"])
		var at := Vector2(float(one["x"]), float(one["y"]))
		var element: String = str(one["element"])
		if not _actors.has(id):
			_actors[id] = _new_actor(one, at)
		var actor: Dictionary = _actors[id]
		if actor["element"] != element:
			actor["element"] = element
			(actor["sprite"] as AnimatedSprite2D).sprite_frames = Atlas.actor(element)
			for aura: AnimatedSprite2D in actor["aura"]:
				aura.material = bursts.material(element, true)
			actor["one_shot"] = ""
			_play(actor, "frozen" if float(one["frozenUntil"]) > time else "idle", true)
		var shown: Vector2 = actor["position"]
		var error: Vector2 = at - shown
		if absf(error.x) + absf(error.y) > 1.25 or not playing:
			actor["position"] = at
			error = Vector2.ZERO
		# Your own fighter keeps its prediction while you steer: the server follows the position
		# this screen sends, so its older snapshots must not pull you back. A push is further.
		var steering: bool = Time.get_ticks_msec() - _steered_at < 500.0
		var own: bool = id == me and steering and absf(error.x) + absf(error.y) < 1.2
		actor["correction"] = Vector2.ZERO if own else error
		if feedback:
			_feedback(actor, one, time, kills_before)
		actor["hp"] = int(one["hp"])
		actor["skill"] = float(one["skillReady"])
		actor["bomb"] = float(one["nextBomb"])
		actor["dash"] = float(one["dashReady"])
		var sprite: AnimatedSprite2D = actor["sprite"]
		sprite.visible = int(one["hp"]) > 0 or actor["one_shot"] == "ko"
		_place_actor(actor, one, time)


func _new_actor(one: Dictionary, at: Vector2) -> Dictionary:
	var holder := Node2D.new()
	holder.name = "Fighter_%d" % int(one["seat"])
	_world.add_child(holder)
	var back := AnimatedSprite2D.new()
	var sprite := AnimatedSprite2D.new()
	var front := AnimatedSprite2D.new()
	for aura: AnimatedSprite2D in [back, front]:
		aura.sprite_frames = Atlas.fx3d()
		aura.centered = false
		aura.offset = -Atlas.FX_ANCHOR
		aura.visible = false
	back.play("aura-back")
	front.play("aura-front")
	sprite.centered = false
	sprite.offset = Vector2(-128, -244)
	var ice := Sprite2D.new()
	ice.texture = Atlas.fx3d_still("ice")
	ice.centered = false
	ice.offset = -Atlas.FX_ANCHOR
	ice.visible = false
	var status := AnimatedSprite2D.new()
	status.sprite_frames = Atlas.effects()
	status.centered = false
	status.offset = Vector2(-80, -96)
	status.visible = false
	for node: Node2D in [back, sprite, front, ice, status]:
		holder.add_child(node)
	var actor: Dictionary = {
		"holder": holder,
		"sprite": sprite,
		"aura": [back, front],
		"ice": ice,
		"status": status,
		"position": at,
		"correction": Vector2.ZERO,
		"element": "",
		"facing": str(one["facing"]),
		"one_shot": "",
		"moved": -1000.0,
		"dust": 0.0,
		"hp": int(one["hp"]),
		"skill": float(one["skillReady"]),
		"bomb": float(one["nextBomb"]),
		"dash": float(one["dashReady"]),
	}
	sprite.animation_finished.connect(_on_actor_done.bind(actor))
	return actor


func _feedback(actor: Dictionary, one: Dictionary, time: float, kills: Dictionary) -> void:
	var hp: int = int(one["hp"])
	var at: Vector2 = actor["position"]
	var facing: String = str(one["facing"])
	var mine: bool = str(one["id"]) == me
	if hp < int(actor["hp"]):
		fx.floater("−%d" % (int(actor["hp"]) - hp), at, Color("#ff5d6c"))
		if mine:
			cue.emit("hurt")
			shake(0.5)
		var clip: String = "hit"
		if hp == 0:
			clip = "ko"
			bursts.burst("puff", at, 1.3, "ko", 260.0)
			fx.flash(at, 2.0, Color("#ffffff"), 300.0)
			cue.emit("ko")
			var by: Dictionary = {}
			for other: Dictionary in view["fighters"]:
				var other_id: String = str(other["id"])
				if int(other["kills"]) > int(kills.get(other_id, int(other["kills"]))):
					by = other
			knocked.emit(one, by)
		elif float(one["frozenUntil"]) > time:
			clip = "frozen"
		_play(actor, clip, false, facing)
	elif float(one["skillReady"]) > float(actor["skill"]):
		_play(actor, "skill", false, facing)
		var element: String = str(one["element"])
		fx.flash(at, 1.8, Rules.CHARACTERS[element]["color"], 420.0)
		fx.ring(at, 1.4, Rules.CHARACTERS[element]["color"], 450.0)
		if element == "wind":
			var dir: Vector2 = Vector2(Rules.DIRECTIONS[facing])
			for n: int in range(1, 4):
				bursts.burst("swirl", at + dir * n, 0.9, "wind", n * 60.0, 420.0)
		if mine:
			cue.emit("skill")
	elif float(one["nextBomb"]) > float(actor["bomb"]):
		_play(actor, "place", false, facing)
		if mine:
			cue.emit("place")
	if float(one["dashReady"]) > float(actor["dash"]):
		bursts.burst("puff", at, 0.6, "dust", 0.0)
		if mine:
			cue.emit("dash")


func _on_actor_done(actor: Dictionary) -> void:
	if actor["one_shot"] == "ko":
		(actor["sprite"] as AnimatedSprite2D).visible = false
	actor["one_shot"] = ""


func _play(actor: Dictionary, clip: String, force: bool = false, facing: String = "") -> void:
	if facing == "":
		facing = actor["facing"]
	var sprite: AnimatedSprite2D = actor["sprite"]
	var anim: String = clip + "-" + facing
	if sprite.sprite_frames == null or not sprite.sprite_frames.has_animation(anim):
		return
	if not force and sprite.animation == anim and sprite.is_playing():
		return
	actor["facing"] = facing
	actor["one_shot"] = clip if ONE_SHOTS.has(clip) else ""
	sprite.speed_scale = 1.0
	sprite.play(anim)


func _animate(
	actor: Dictionary, one: Dictionary, dir: String, steering: bool, time: float, ms: float
) -> void:
	var sprite: AnimatedSprite2D = actor["sprite"]
	if float(one["frozenUntil"]) > time:
		_play(actor, "frozen", false, str(one["facing"]))
		return
	if actor["one_shot"] != "":
		return
	var held: bool = float(one["stunUntil"]) > time
	var moving: bool = (
		str(view["phase"]) == "playing"
		and not held
		and (dir != "none" or ms - float(actor["moved"]) < 130.0)
	)
	var facing: String = dir if steering else str(one["facing"])
	_play(actor, "walk" if moving else "idle", false, facing)
	var dashing: bool = float(one["dashUntil"]) > time
	if moving:
		sprite.speed_scale = (
			float(one["speed"])
			/ 3.2
			* (1.65 if dashing else 1.0)
			* (0.65 if float(one["slowUntil"]) > time else 1.0)
		)
		if dashing and ms - float(actor["dust"]) > 110.0:
			bursts.burst("puff", actor["position"], 0.45, "dust", 0.0)
			actor["dust"] = ms
	else:
		sprite.speed_scale = 1.0


func _place_actor(actor: Dictionary, one: Dictionary, time: float) -> void:
	var holder: Node2D = actor["holder"]
	var at: Vector2 = actor["position"]
	holder.position = project(at + Vector2(0, 0.15))
	var near: float = zoom(at)
	var sprite: AnimatedSprite2D = actor["sprite"]
	var k: float = tw * near * ACTOR_SCALE / 256.0
	sprite.scale = Vector2(k, k)
	var alive: bool = int(one["hp"]) > 0
	var blink: bool = (
		alive and float(one["invulnerableUntil"]) > time and Time.get_ticks_msec() / 90 % 2 == 1
	)
	sprite.modulate = Color(1, 1, 1, 0.55 if blink else 1.0)
	if alive and float(one["slowUntil"]) > time:
		sprite.modulate = Color("#b8dcff")
	var fx: float = tw * near / BAKE
	var boosted: bool = alive and float(one["skillUntil"]) > time
	for aura: AnimatedSprite2D in actor["aura"]:
		aura.visible = boosted
		aura.scale = Vector2(fx, fx) * 1.3
		aura.modulate = Color(1.35, 1.35, 1.35, 1.0)
	var ice: Sprite2D = actor["ice"]
	ice.visible = alive and float(one["frozenUntil"]) > time
	ice.scale = Vector2(fx, fx)
	var status: AnimatedSprite2D = actor["status"]
	var stunned: bool = alive and float(one["stunUntil"]) > time
	status.visible = stunned
	if stunned:
		if status.animation != "stun" or not status.is_playing():
			status.play("stun")
		status.scale = Vector2.ONE * tw * near * 1.1 / 160.0
		status.position = Vector2(0, -tw * near * 1.15)


# ── Bombs and pickups ─────────────────────────────────────────────────────────────────────


func _show_bombs(feedback: bool) -> void:
	var seen: Dictionary = {}
	for bomb: Dictionary in view["bombs"]:
		var id: int = int(bomb["id"])
		seen[id] = true
		var holder: Node2D = _bombs.get(id)
		if holder == null:
			holder = Node2D.new()
			holder.name = "Bomb_%d" % id
			var sprite := AnimatedSprite2D.new()
			sprite.sprite_frames = Atlas.arena()
			sprite.centered = false
			sprite.offset = Vector2(-96, -176)
			sprite.play("bomb")
			holder.add_child(sprite)
			_world.add_child(holder)
			_bombs[id] = holder
			holder.set_meta("born", Time.get_ticks_msec() if feedback else 0.0)
		holder.set_meta("bomb", bomb)
		holder.position = project(Vector2(float(bomb["x"]), float(bomb["y"]) + 0.1))
	for id: int in _bombs.keys():
		if not seen.has(id):
			(_bombs[id] as Node).queue_free()
			_bombs.erase(id)


func _pulse_bombs(time: float, ms: float) -> void:
	for id: int in _bombs:
		var holder: Node2D = _bombs[id]
		var sprite: AnimatedSprite2D = holder.get_child(0)
		var bomb: Dictionary = holder.get_meta("bomb")
		var frozen: bool = float(bomb.get("frozenUntil", 0)) > time
		var left: float = float(bomb["explodeAt"]) - time
		var soon: bool = left < 700.0
		sprite.speed_scale = 0.2 if frozen else (2.4 if soon else 1.0)
		var pulse: float = 1.0
		if not frozen:
			pulse += maxf(0.0, sin(ms / (45.0 if soon else 110.0))) * (0.1 if soon else 0.04)
		# Dropped bombs land with a squash.
		var age: float = (ms - float(holder.get_meta("born"))) / 260.0
		var squash := Vector2.ONE
		if age < 1.0:
			var bounce: float = sin(age * PI) * (1.0 - age)
			squash = Vector2(1.0 + bounce * 0.35, 1.0 - bounce * 0.3)
		var near: float = zoom(Vector2(float(bomb["x"]), float(bomb["y"])))
		sprite.scale = Vector2.ONE * tw * near * 0.92 * pulse / 192.0 * squash
		if frozen:
			sprite.modulate = Color("#bfefff")
		elif soon and int(ms / 90.0) % 2 == 1:
			sprite.modulate = Color("#ffb0a0")
		else:
			sprite.modulate = Color.WHITE
		# The fuse sparks in the bomb's element colour.
		if not frozen and randf() < 0.5:
			var tip: Vector2 = Vector2(float(bomb["x"]) + 0.24, float(bomb["y"]))
			_spark(tip, 0.95, Rules.CHARACTERS[str(bomb["element"])]["color"], 0.35, 0.05)


func _show_pickups() -> void:
	var seen: Dictionary = {}
	for item: Dictionary in view["pickups"]:
		var cell := Vector2i(int(item["x"]), int(item["y"]))
		var key: String = "%d,%d,%s" % [cell.x, cell.y, item["kind"]]
		seen[key] = true
		var holder: Node2D = _pickups.get(key)
		if holder == null:
			holder = Node2D.new()
			var sprite := Sprite2D.new()
			sprite.texture = Atlas.still("item-%s-00" % item["kind"])
			sprite.centered = false
			sprite.offset = Vector2(-96, -176)
			holder.add_child(sprite)
			holder.set_meta("cell", Vector2(cell))
			_world.add_child(holder)
			_pickups[key] = holder
		holder.scale = Vector2.ONE * tw * zoom(Vector2(cell)) * 0.72 / 192.0
		holder.position = project(Vector2(cell) + Vector2(0, 0.05))
	for key: String in _pickups.keys():
		if not seen.has(key):
			(_pickups[key] as Node).queue_free()
			_pickups.erase(key)


func _pickup_feedback() -> void:
	var now_items: Dictionary = {}
	for item: Dictionary in view["pickups"]:
		now_items[Vector2i(int(item["x"]), int(item["y"]))] = true
	for cell: Vector2i in _items:
		if now_items.has(cell):
			continue
		for one: Dictionary in view["fighters"]:
			var at := Vector2(float(one["x"]), float(one["y"]))
			if at.distance_to(Vector2(cell)) < 0.7:
				var kind: String = str(_items[cell]["kind"])
				fx.floater(ITEM_LABEL.get(kind, ""), Vector2(cell), Color("#7ee0a1"))
				for i: int in 10:
					_spark(Vector2(cell), 0.4, Color("#fff1a0"), 0.6, 0.6)
				fx.flash(Vector2(cell), 1.0, Color("#fff1a0"), 260.0)
				if str(one["id"]) == me:
					cue.emit("pickup")
				break


# ── Effects ───────────────────────────────────────────────────────────────────────────────


## A spark (see effects.gd), after `delay` ms.
func _spark(
	at: Vector2, height: float, color: Color, life: float, spread: float, delay: float = 0.0
) -> void:
	if delay > 0.0:
		bursts.later(delay, fx.spark.bind(at, height, color, life, spread))
	else:
		fx.spark(at, height, color, life, spread)


func _place_all() -> void:
	if not view.is_empty():
		_show_actors(false, view)
		_show_bombs(false)
		_show_pickups()
	_decals.queue_redraw()


# ── Drawing ───────────────────────────────────────────────────────────────────────────────


## On the paving: blast marks, the danger ahead, shadows under fighters, bombs and items.
func _draw_decals() -> void:
	if view.is_empty():
		return
	var ms: float = Time.get_ticks_msec()
	fx.draw_marks(_decals)
	var time: float = now()
	_draw_warnings(time)
	for one: Dictionary in view["fighters"]:
		var id: String = str(one["id"])
		if int(one["hp"]) <= 0 or not _actors.has(id):
			continue
		var pos: Vector2 = _actors[id]["position"]
		var feet: Vector2 = project(pos + Vector2(0.04, 0.15))
		var z: float = zoom(pos)
		_ellipse(
			_decals,
			feet,
			Vector2(tw, th) * z * Vector2(0.3, 0.16),
			Color(0.16, 0.1, 0.06, 0.32),
			true
		)
		var ring := Vector2(tw, th) * z * Vector2(0.38, 0.21)
		if str(view.get("mode", "solo")) == "teams":
			_ellipse(_decals, feet, ring, TEAM_INK[int(one["team"]) % 2], false)
		elif id == me:
			_ellipse(_decals, feet, ring, Color(1, 0.96, 0.82, 0.8), false)
	for bomb: Dictionary in view["bombs"]:
		var spot := Vector2(float(bomb["x"]), float(bomb["y"]))
		_ellipse(
			_decals,
			project(spot + Vector2(0.04, 0.12)),
			Vector2(tw, th) * zoom(spot) * Vector2(0.3, 0.16),
			Color(0.16, 0.1, 0.06, 0.35),
			true
		)
	for cell_at: Vector2i in _items:
		var spot := Vector2(cell_at)
		var radii: Vector2 = Vector2(tw, th) * zoom(spot) * Vector2(0.26, 0.14)
		_ellipse(
			_decals, project(spot + Vector2(0, 0.1)), radii, Color(0.16, 0.1, 0.06, 0.25), true
		)


func _draw_warnings(time: float) -> void:
	if str(view["phase"]) != "playing":
		return
	var ms: float = Time.get_ticks_msec()
	var r: float = minf(12.0, tw * 0.16)
	var closing: float = Rules.closing_in(view, time, RING_WARNING)
	var next: Dictionary = Rules.next_ring(view)
	if closing >= 0.0 and not next.is_empty():
		var pulse: float = 0.3 + absf(sin(ms / (90.0 if closing < 2000.0 else 180.0))) * 0.3
		var grow: float = 1.0 - closing / RING_WARNING
		for cell: Vector2i in _ring_cells(int(next["ring"])):
			var at: Vector2 = project(Vector2(cell))
			var box: Rect2 = lens.cell_box(Vector2(cell))
			_round(_decals, box, Color(0.72, 0.16, 0.1, pulse), r)
			# The shadow of the rock about to land.
			_ellipse(
				_decals,
				at,
				Vector2(tw, th) * zoom(Vector2(cell)) * Vector2(0.42, 0.36) * (0.3 + 0.7 * grow),
				Color(0.2, 0.06, 0.03, 0.35 + 0.3 * grow),
				true
			)
	for warning: Dictionary in _warnings:
		var box: Rect2 = lens.cell_box(Vector2(warning["cell"]))
		var left: float = float(warning["start"]) - time
		var soon: bool = left < 700.0
		var ink: Color = Rules.CHARACTERS[warning["element"]]["color"]
		if warning["frozen"]:
			ink = Color("#72c6dd")
		elif soon:
			ink = Color("#ff5a3c")
		var fill: Color = ink
		fill.a = 0.36 + sin(ms / 60.0) * 0.12 if soon else 0.2
		_round(_decals, box, fill, r)
		var line: Color = Color("#fff0d8") if soon else ink
		line.a = 0.95 if soon else 0.75
		_round(_decals, box, line, r, 2.0)
	for blast: Dictionary in view["blasts"]:
		var element: String = str(blast["element"])
		var ink: Color = Rules.CHARACTERS[element]["color"]
		ink.a = 0.35 * clampf((float(blast["expires"]) - time) / 300.0, 0.0, 1.0)
		for cell: Dictionary in blast["cells"]:
			_round(_decals, lens.cell_box(Vector2(float(cell["x"]), float(cell["y"]))), ink, r)


## Additive light: flashes, sparks and embers, bolt halos, the lanterns at dusk.
func _draw_glow() -> void:
	if view.is_empty():
		return
	var ms: float = Time.get_ticks_msec()
	fx.draw_glow(_glow)
	# A boosted fighter stands in a pool of their element's light.
	var time: float = now()
	for one: Dictionary in view["fighters"]:
		var id: String = str(one["id"])
		if int(one["hp"]) <= 0 or float(one["skillUntil"]) <= time or not _actors.has(id):
			continue
		var ink: Color = Rules.CHARACTERS[str(one["element"])]["color"]
		ink.a = 0.55 + 0.15 * sin(ms / 160.0)
		var pos: Vector2 = _actors[id]["position"]
		var feet: Vector2 = project(pos + Vector2(0, 0.15))
		var pool: Vector2 = Vector2(tw, th) * zoom(pos) * Vector2(0.75, 0.5)
		_glow.draw_texture_rect(_glow_tex, Rect2(feet - pool, pool * 2.0), false, ink)
		if randf() < 0.3:
			fx.spark(_actors[id]["position"], 0.2, ink, 0.8, 0.25)
	if dusk > 0.2:
		var glow: float = (dusk - 0.2) / 0.8
		for corner: Vector2 in [Vector2(0, 0), Vector2(12, 0), Vector2(0, 10), Vector2(12, 10)]:
			var height: float = 1.51 if corner.y == 0 else 1.08
			var at: Vector2 = lift(corner + Vector2(0.28 if corner.x == 0 else -0.28, 0), height)
			var r: float = tw * zoom(corner) * (0.7 + sin(ms / 400.0 + corner.x) * 0.04)
			_glow.draw_texture_rect(
				_glow_tex,
				Rect2(at - Vector2(r, r), Vector2(r, r) * 2.0),
				false,
				Color(1.0, 0.62, 0.3, 0.55 * glow)
			)


## Debris, bolts, shock rings, names, health and the numbers that float up.
func _draw_overlay() -> void:
	if view.is_empty():
		return
	var ms: float = Time.get_ticks_msec()
	fx.draw_over(_overlay)
	var font: Font = XomDaoUi.display_font(800)
	var name_size: int = maxi(14, int(tw * 0.24))
	for one: Dictionary in view["fighters"]:
		var id: String = str(one["id"])
		if int(one["hp"]) <= 0 or not _actors.has(id):
			continue
		var pos: Vector2 = _actors[id]["position"]
		var z: float = zoom(pos)
		var head: Vector2 = project(pos) - Vector2(0, tw * z * 1.3)
		var bar := Rect2(
			head - Vector2(tw * z * 0.32, 0), Vector2(tw * z * 0.64, maxf(5.0, tw * z * 0.09))
		)
		_round(_overlay, bar.grow(1.5), Color("#3a2416d0"), bar.size.y)
		var hp: float = clampf(float(one["hp"]) / 100.0, 0.0, 1.0)
		if hp > 0.0:
			var fill: Color = Rules.CHARACTERS[str(one["element"])]["bar"]
			_round(
				_overlay,
				Rect2(bar.position, Vector2(bar.size.x * hp, bar.size.y)),
				fill,
				bar.size.y
			)
		if id == me and str(view["phase"]) != "ended":
			_heart(head - Vector2(0, tw * 0.12 - sin(ms / 180.0) * tw * 0.04), tw * 0.2)
		elif not bool(one["bot"]):
			Effects.text(
				_overlay,
				font,
				str(one["name"]).left(12),
				head - Vector2(0, tw * 0.22),
				name_size,
				Color.WHITE
			)


## The red heart pointing down at your own fighter.
func _heart(tip: Vector2, r: float) -> void:
	var white: Array[Vector2] = [
		tip + Vector2(-r * 1.1, -r * 1.6), tip + Vector2(r * 1.1, -r * 1.6), tip
	]
	_overlay.draw_colored_polygon(PackedVector2Array(white), Color.WHITE)
	_overlay.draw_circle(tip + Vector2(-r * 0.55, -r * 1.5), r * 0.62, Color.WHITE)
	_overlay.draw_circle(tip + Vector2(r * 0.55, -r * 1.5), r * 0.62, Color.WHITE)
	var red: Array[Vector2] = [
		tip + Vector2(-r * 0.8, -r * 1.5),
		tip + Vector2(r * 0.8, -r * 1.5),
		tip + Vector2(0, -r * 0.25)
	]
	_overlay.draw_colored_polygon(PackedVector2Array(red), Color("#f04359"))
	_overlay.draw_circle(tip + Vector2(-r * 0.4, -r * 1.42), r * 0.42, Color("#f04359"))
	_overlay.draw_circle(tip + Vector2(r * 0.4, -r * 1.42), r * 0.42, Color("#f04359"))


static func _round(
	on: CanvasItem, box: Rect2, ink: Color, radius: float, line: float = 0.0
) -> void:
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(int(radius))
	if line > 0.0:
		style.draw_center = false
		style.border_color = ink
		style.set_border_width_all(int(line))
	else:
		style.bg_color = ink
	on.draw_style_box(style, box)


static func _ellipse(
	on: CanvasItem, at: Vector2, radii: Vector2, ink: Color, fill: bool, width: float = 0.0
) -> void:
	var points := PackedVector2Array()
	for i: int in 33:
		var angle: float = TAU * i / 32.0
		points.append(at + Vector2(cos(angle) * radii.x, sin(angle) * radii.y))
	if fill:
		on.draw_colored_polygon(points, ink)
	else:
		on.draw_polyline(points, ink, width if width > 0.0 else maxf(2.0, radii.x * 0.1), true)
