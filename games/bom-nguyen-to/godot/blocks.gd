extends RefCounted
## The arena's blocks: the stone pillars, crates and baskets, and the laterite rocks of the
## closing ring, each a Blender sprite in the y-sorted world with its shadow on the paving
## (art/arena-blocks). Rocks that just closed in fall from the sky (`drop`).

const Rules := preload("res://content/bom-nguyen-to/rules.gd")
const Atlas := preload("res://content/bom-nguyen-to/atlas.gd")
const Lens := preload("res://content/bom-nguyen-to/lens.gd")
const BAKE := 128.0
const FALL_MS := 420.0

var world: Node2D
var shadows: Node2D
var lens: Lens

var _blocks: Dictionary = {}
var _shadows: Dictionary = {}


## The sprite for a cell: pillars on the even cells, crates or baskets, rocks for the ring.
static func kind_of(cell: Vector2i, tile: String) -> String:
	if tile == "crate":
		return "crate-%d" % (1 if (cell.x * 7 + cell.y * 13) % 5 < 2 else 0)
	if cell.x % 2 == 0 and cell.y % 2 == 0:
		return "pillar-%d" % ((cell.x / 2 + cell.y / 2) % 2)
	return "rock-%d" % ((cell.x + cell.y) % 2)


## The kind of block shown on a cell, "" when there is none.
func kind_at(cell: Vector2i) -> String:
	var block: Sprite2D = _blocks.get(cell)
	return str(block.get_meta("kind", "")) if block != null else ""


## Puts every block back on its cell after the arena moved or resized.
func refit() -> void:
	for one: Vector2i in _blocks:
		_place(one)


## Matches the blocks to the view's cells; `fell` are the cells that just closed in.
func show(view: Dictionary, fell: Array[Vector2i]) -> void:
	var seen: Dictionary = {}
	var art: Dictionary = Atlas.blocks()
	var ms: float = Time.get_ticks_msec()
	for y: int in range(1, Rules.HEIGHT - 1):
		for x: int in range(1, Rules.WIDTH - 1):
			var tile: String = Rules.tile_at(view, x, y)
			if tile == "floor":
				continue
			var cell := Vector2i(x, y)
			seen[cell] = true
			var kind: String = kind_of(cell, tile)
			var block: Sprite2D = _blocks.get(cell)
			if block == null:
				block = Sprite2D.new()
				block.centered = false
				world.add_child(block)
				_blocks[cell] = block
				var shade := Sprite2D.new()
				shade.centered = false
				shadows.add_child(shade)
				_shadows[cell] = shade
			if block.get_meta("kind", "") != kind:
				block.set_meta("kind", kind)
				var sprite: Array = art[kind]
				block.texture = sprite[0]
				block.offset = -(sprite[1] as Vector2)
				var shadow: Array = art[kind + "-shadow"]
				var shade: Sprite2D = _shadows[cell]
				shade.texture = shadow[0]
				shade.offset = -(shadow[1] as Vector2)
			if fell.has(cell):
				block.set_meta("drop", ms + randf() * 260.0)
			_place(cell)
	for cell: Vector2i in _blocks.keys():
		if not seen.has(cell):
			(_blocks[cell] as Node).queue_free()
			(_shadows[cell] as Node).queue_free()
			_blocks.erase(cell)
			_shadows.erase(cell)


## Moves the falling rocks; returns the cells that landed this frame.
func drop(ms: float) -> Array[Vector2i]:
	var landed: Array[Vector2i] = []
	for cell: Vector2i in _blocks:
		var block: Sprite2D = _blocks[cell]
		if not block.has_meta("drop"):
			continue
		var t: float = (ms - float(block.get_meta("drop"))) / FALL_MS
		var shade: Sprite2D = _shadows[cell]
		if t >= 1.0:
			block.remove_meta("drop")
			_place(cell)
			shade.modulate.a = 1.0
			landed.append(cell)
			continue
		var fall: float = clampf(t, 0.0, 1.0)
		var k: float = _scale(cell)
		block.position = lens.point(Vector2(cell), 7.0 * (1.0 - fall * fall))
		shade.scale = Vector2(k, k) * (0.4 + 0.6 * fall)
		shade.modulate.a = 0.3 + 0.7 * fall
	return landed


## A baked sprite's scale on this cell: its bake size, nearer cells drawn bigger.
func _scale(cell: Vector2i) -> float:
	return lens.cell_width() * lens.zoom(Vector2(cell)) / BAKE


func _place(cell: Vector2i) -> void:
	var k: float = _scale(cell)
	var block: Sprite2D = _blocks[cell]
	block.scale = Vector2(k, k)
	block.position = lens.point(Vector2(cell))
	var shade: Sprite2D = _shadows[cell]
	shade.scale = Vector2(k, k)
	shade.position = block.position
