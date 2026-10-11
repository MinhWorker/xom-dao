class_name HubIsland
extends Control
## One genre island floating over the lobby (docs/experience.md, "Sảnh"). Its art comes from
## `hub/genres/<island>.tscn` (animated: a Node2D whose art fills a 512 × 512 canvas, playing on
## its own) or `hub/genres/<island>.webp` (still, same square canvas), else HubIslandArt draws a
## stand-in. Art is always drawn in full colour; the island does the hierarchy itself:
## - the selected (centre) island is in full colour with warm sunlight behind it and its name on
##   a wooden sign;
## - the others turn blue-grey with distance (`dim`);
## - a locked one (Sắp có, or a genre with no ready game) sits in thick white fog with a lock;
## - the Sự kiện island glows and flies a pennant with the days left while an event is open.
## Every island bobs gently. A .tscn root may define `set_selected(on: bool)`.
##
## The ring sizes and places it (HubIslandRing); the island only draws.

## Size at scale 1: a square, like the art's canvas.
const BASE := Vector2(240.0, 240.0)
## The side of the art's canvas.
const ART := 512.0
const SOON := "sap-co"
## How far the island bobs up and down (units at scale 1) and how fast (radians a second).
const BOB := 5.0
const BOB_SPEED := 1.4
## The speech bubble with the name, over the island: this size for every name that fits, wider
## for a longer one (a name is never cut). Its tail hangs TAIL below it.
const SIGN := Vector2(170.0, 54.0)
const TAIL := 16.0

static var _dim_shader: Shader = preload("res://hub/lobby/island_dim.gdshader")

var genre_id: String = ""
var title: String = "":
	set(value):
		title = value
		_sign.text = value
		_fit_bubble()
		if _drawn != null:
			_drawn.title = value

var locked: bool = false:
	set(value):
		locked = value
		_restyle()

var selected: bool = false:
	set(value):
		selected = value
		if value and not _bubble.visible:
			_pop()
		_bubble.visible = value
		if _scene != null and _scene.has_method("set_selected"):
			_scene.call("set_selected", value)
		_restyle()

## How near the front it is: 1 at the front, 0 at the back (greyer).
var depth: float = 1.0:
	set(value):
		depth = value
		_restyle()

## An event island with an event open: it glows and flies a pennant with the days left (-1: none).
var days_left: int = -1:
	set(value):
		days_left = value
		_restyle()

## The body: the art (or its stand-in) under the grey-out material; it bobs.
var _body := Control.new()
## Fog, lock and pennant over the art, bobbing with it.
var _overlay := Control.new()
## The name, in a speech bubble (`_bubble`, drawn in code) over the selected island.
var _sign := Label.new()
var _bubble := Control.new()
## How far below its place the bubble is, in units, while it pops up.
var _drop: float = 0.0:
	set(value):
		_drop = value
		_place_bubble()
var _material := ShaderMaterial.new()
var _drawn: HubIslandArt
var _scene: Node2D
var _picture: TextureRect
var _lock: Texture2D = XomDaoUi.icon("lock-simple")
var _time: float = 0.0


## The island for a ring entry ({id, name, island, locked, days?}).
static func create(entry: Dictionary) -> HubIsland:
	var island := HubIsland.new()
	island.genre_id = str(entry.get("id", ""))
	island.name = "Island_" + island.genre_id
	var art: String = str(entry.get("island", ""))
	if art == "" and island.genre_id == SOON:
		art = SOON
	island._load_art(art)
	island.title = str(entry.get("name", ""))
	island.locked = bool(entry.get("locked", false))
	island.days_left = int(entry.get("days", -1))
	return island


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	size = BASE
	_material.shader = _dim_shader
	_body.name = "Body"
	_body.material = _material
	_body.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_body)
	_overlay.name = "Overlay"
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay.draw.connect(_draw_overlay)
	add_child(_overlay)
	_bubble.name = "Bubble"
	_bubble.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bubble.size = SIGN
	_bubble.visible = false
	_bubble.draw.connect(_draw_bubble)
	add_child(_bubble)
	_sign.name = "Sign"
	_sign.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_sign.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_sign.add_theme_font_override("font", XomDaoUi.display_font(800))
	_sign.add_theme_font_size_override("font_size", 30)
	_sign.add_theme_color_override("font_color", XomDaoUi.INK)
	_sign.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bubble.add_child(_sign)
	_fit_bubble()
	resized.connect(_place)
	_time = randf() * TAU


func _ready() -> void:
	_place.call_deferred()


func _process(delta: float) -> void:
	_time += delta * BOB_SPEED
	var bob: float = sin(_time) * BOB * size.x / BASE.x
	_body.position.y = bob
	_overlay.position.y = bob


## Where the island itself is inside the control: the tap target.
func body_rect() -> Rect2:
	return Rect2(size.x * 0.08, size.y * 0.12, size.x * 0.84, size.y * 0.76)


## The art for this island: the animated scene, the still picture, or the drawn stand-in.
func _load_art(art: String) -> void:
	var scene_path: String = "res://hub/genres/%s.tscn" % art
	var picture_path: String = "res://hub/genres/%s.webp" % art
	if art != "" and ResourceLoader.exists(scene_path):
		var packed: PackedScene = load(scene_path)
		var root: Node = packed.instantiate()
		if root is Node2D:
			_scene = root
			_share_material(_scene)
			_body.add_child(_scene)
			return
		root.free()
	if art != "" and ResourceLoader.exists(picture_path):
		_picture = TextureRect.new()
		_picture.texture = load(picture_path)
		_picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		_picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_picture.use_parent_material = true
		_body.add_child(_picture)
		return
	_drawn = HubIslandArt.new()
	_drawn.genre_id = genre_id
	_body.add_child(_drawn)


## The grey-out reaches every drawing node of an art scene.
func _share_material(node: Node) -> void:
	if node is CanvasItem:
		(node as CanvasItem).use_parent_material = true
	for child: Node in node.get_children():
		_share_material(child)


func _place() -> void:
	var k: float = size.x / BASE.x
	_body.size = size
	_overlay.size = size
	for art: Control in [_drawn, _picture]:
		if art != null:
			art.size = size
	if _scene != null:
		_scene.scale = Vector2.ONE * size.x / ART
	_place_bubble()
	queue_redraw()
	_overlay.queue_redraw()


## The bubble pops up when its island comes to the front.
func _pop() -> void:
	_bubble.modulate.a = 0.0
	_drop = 14.0
	var tween: Tween = create_tween().set_parallel()
	tween.tween_property(_bubble, "modulate:a", 1.0, 0.12)
	tween.tween_property(self, "_drop", 0.0, 0.28).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)


## The bubble is as wide as its name needs, never narrower than SIGN.
func _fit_bubble() -> void:
	var font: Font = XomDaoUi.display_font(800)
	var needed: float = font.get_string_size(_sign.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 30).x + 48.0
	_bubble.size = Vector2(maxf(SIGN.x, needed), SIGN.y)
	_sign.position = Vector2.ZERO
	_sign.size = _bubble.size - Vector2(0.0, 2.0)
	_bubble.queue_redraw()
	_place_bubble()


## The bubble's tail points at the top of the island.
func _place_bubble() -> void:
	var k: float = size.x / BASE.x
	_bubble.scale = Vector2.ONE * k
	_bubble.position = Vector2(
		(size.x - _bubble.size.x * k) / 2.0, size.y * 0.1 - (SIGN.y + TAIL - _drop) * k
	)


## A sheet of paper with round ends and a small tail under its middle, outlined in ink.
func _draw_bubble() -> void:
	var paper: StyleBoxFlat = XomDaoUi.box(
		XomDaoUi.PAPER, XomDaoUi.INK, XomDaoUi.BORDER, SIGN.y / 2.0
	)
	paper.shadow_color = XomDaoPuff.SHADE
	paper.shadow_size = 3
	paper.shadow_offset = Vector2(0.0, 4.0)
	_bubble.draw_style_box(paper, Rect2(Vector2.ZERO, _bubble.size))
	var mid: float = _bubble.size.x / 2.0
	var base: float = SIGN.y - XomDaoUi.BORDER - 0.5
	var tail := PackedVector2Array(
		[Vector2(mid - 13.0, base), Vector2(mid + 13.0, base), Vector2(mid, SIGN.y + TAIL)]
	)
	_bubble.draw_colored_polygon(tail, XomDaoUi.PAPER)
	var edge := PackedVector2Array(
		[
			Vector2(mid - 13.0, SIGN.y - 1.5),
			Vector2(mid, SIGN.y + TAIL),
			Vector2(mid + 13.0, SIGN.y - 1.5)
		]
	)
	_bubble.draw_polyline(edge, XomDaoUi.INK, XomDaoUi.BORDER, true)


## Grey with distance (none at the front), more so in fog.
func _restyle() -> void:
	var dim: float = clampf((1.0 - depth) * 6.0, 0.0, 0.85)
	if locked:
		dim = maxf(dim, 0.6)
	_material.set_shader_parameter("dim", dim)
	queue_redraw()
	_overlay.queue_redraw()


## Warm sunlight behind the selected island, and an event's lantern glow.
func _draw() -> void:
	var c := Vector2(size.x * 0.5, size.y * 0.45)
	var r: float = size.x * 0.5
	if selected and not locked:
		for i: int in 6:
			draw_circle(c, r * (1.0 - i * 0.12), Color(XomDaoUi.SUN, 0.06), true, -1.0, true)
	if days_left >= 0 and not locked:
		for i: int in 4:
			draw_circle(c, r * (0.9 - i * 0.15), Color(XomDaoUi.LANTERN, 0.07), true, -1.0, true)


func _draw_overlay() -> void:
	var k: float = size.x / BASE.x
	var c := Vector2(size.x * 0.5, size.y * 0.42)
	if locked:
		_draw_fog(c, size.x * 0.4, k)
	elif days_left >= 0:
		_draw_pennant(c + Vector2(-size.x * 0.26, -size.y * 0.02), k)


func _draw_fog(c: Vector2, rx: float, k: float) -> void:
	var puffs: Array[Vector2] = [
		Vector2(-0.8, 0.1),
		Vector2(-0.45, -0.25),
		Vector2(0.0, -0.35),
		Vector2(0.45, -0.22),
		Vector2(0.8, 0.12),
		Vector2(-0.4, 0.35),
		Vector2(0.35, 0.4),
		Vector2(0.0, 0.15),
	]
	for puff: Vector2 in puffs:
		_overlay.draw_circle(c + puff * rx, rx * 0.42, Color(1, 1, 1, 0.62), true, -1.0, true)
	var side: float = 56.0 * k
	var plate := Rect2(c - Vector2(side, side) * 0.7, Vector2(side, side) * 1.4)
	_overlay.draw_style_box(XomDaoUi.box(XomDaoUi.NAVY_HUD, Color.TRANSPARENT, 0, 18.0 * k), plate)
	_overlay.draw_texture_rect(
		_lock, Rect2(c - Vector2(side, side) / 2.0, Vector2(side, side)), false, XomDaoUi.CREAM
	)


## A red pennant on a pole with the event's days left.
func _draw_pennant(at: Vector2, k: float) -> void:
	var font: Font = XomDaoUi.display_font(800)
	var font_size: int = int(20 * k)
	var text: String = "Còn %d ngày" % days_left
	var w: float = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x + 30.0 * k
	var top: Vector2 = at + Vector2(0, -96) * k
	_overlay.draw_line(at, top, XomDaoUi.HONEY_DARK, 4.0 * k, true)
	var flag := PackedVector2Array(
		[
			top,
			top + Vector2(w, 4.0 * k),
			top + Vector2(w - 12.0 * k, 20.0 * k),
			top + Vector2(w, 36.0 * k),
			top + Vector2(0, 40) * k,
		]
	)
	_overlay.draw_colored_polygon(flag, XomDaoUi.LACQUER)
	_overlay.draw_string(
		font,
		top + Vector2(8, 27) * k,
		text,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		font_size,
		XomDaoUi.CREAM
	)
