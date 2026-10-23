extends RefCounted
## The bake's camera (sources/render_arena.py, art/arena-ground.json): a gentle perspective
## looking at the arena from the south, so the near rows are wider than the far ones. `point`
## takes a cell (x right, y toward the camera) and a height in cells to the screen; `zoom` is how
## big things are there compared with the arena's middle (1.0), for sprites baked flat. Every
## layer of the arena goes through it, so the sprites stay on the ground image's cells.
##
## `scale` (screen px per bake px) and `offset` (where the bake's top left lands) come from the
## arena's fit; a cell at the middle is BAKE * scale wide on screen.

const BAKE := 128.0

## Camera pitch (radians above the ground), its distance to the middle (cells), the focal length
## (bake px), the middle cell it looks at and the ground image's size (bake px).
var elevation: float = asin(0.8)
var distance: float = 36.0
var focal: float = 128.0 * 36.0
var centre := Vector2(6.0, 5.5)
var size := Vector2(2560, 1760)
var scale: float = 1.0
var offset := Vector2.ZERO


func read(meta: Dictionary) -> void:
	elevation = float(meta.get("elevation", elevation))
	distance = float(meta.get("distance", distance))
	focal = float(meta.get("focal", focal))
	var middle: Array = meta.get("centre", [centre.x, centre.y])
	centre = Vector2(float(middle[0]), float(middle[1]))
	var pixels: Array = meta.get("size", [size.x, size.y])
	size = Vector2(float(pixels[0]), float(pixels[1]))


## The bake pixel a point lands on: cell (x, y) at `height` cells above the ground.
func bake(cell: Vector2, height: float = 0.0) -> Vector2:
	var rel: Vector3 = _from_camera(cell, height)
	var depth: float = rel.dot(_forward())
	var up := Vector3(0.0, sin(elevation), cos(elevation))
	return size / 2.0 + Vector2(rel.x, -rel.dot(up)) * focal / depth


func point(cell: Vector2, height: float = 0.0) -> Vector2:
	return offset + bake(cell, height) * scale


## How big a flat sprite at this cell is drawn, against one at the middle.
func zoom(cell: Vector2, height: float = 0.0) -> float:
	return distance / _from_camera(cell, height).dot(_forward())


## One cell's width on screen at the middle.
func cell_width() -> float:
	return BAKE * scale


## The screen box of a cell's square, shrunk by `inset` cells on each side.
func cell_box(cell: Vector2, inset: float = 0.04) -> Rect2:
	var half: float = 0.5 - inset
	var a: Vector2 = point(cell - Vector2(half, half))
	var b: Vector2 = point(cell + Vector2(half, half))
	return Rect2(a, b - a)


## Fits the bake points of `reach` (cells) in `area`, as big as they go, centred.
func fit(reach: Rect2, area: Rect2) -> void:
	var corners: Array[Vector2] = [
		bake(reach.position),
		bake(Vector2(reach.end.x, reach.position.y)),
		bake(Vector2(reach.position.x, reach.end.y)),
		bake(reach.end),
	]
	var box := Rect2(corners[0], Vector2.ZERO)
	for corner: Vector2 in corners:
		box = box.expand(corner)
	scale = minf(area.size.x / box.size.x, area.size.y / box.size.y)
	offset = area.position + (area.size - box.size * scale) / 2.0 - box.position * scale


func _from_camera(cell: Vector2, height: float) -> Vector3:
	var away := Vector3(0.0, -cos(elevation), sin(elevation))
	var world := Vector3(cell.x - centre.x, -(cell.y - centre.y), height)
	return world - away * distance


func _forward() -> Vector3:
	return Vector3(0.0, cos(elevation), -sin(elevation))
