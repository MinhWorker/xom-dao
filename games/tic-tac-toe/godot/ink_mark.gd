extends Control
## Ink strokes stay in paper coordinates while their drawn length grows.

var mark: String = "X"
var ink := Color("#a52f3e")
var variation: float = 0.0
var progress: float = 1.0:
	set(value):
		progress = value
		queue_redraw()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func write() -> void:
	progress = 0.0
	create_tween().tween_property(self, "progress", 1.0, 0.46).set_trans(Tween.TRANS_SINE)


func _draw() -> void:
	var paths: Array[PackedVector2Array] = []
	if mark == "X":
		paths.append(
			PackedVector2Array(
				[Vector2(0.16, 0.13), Vector2(0.38, 0.37), Vector2(0.65, 0.65), Vector2(0.85, 0.88)]
			)
		)
		paths.append(
			PackedVector2Array(
				[Vector2(0.84, 0.15), Vector2(0.61, 0.39), Vector2(0.37, 0.64), Vector2(0.14, 0.86)]
			)
		)
	else:
		var loop := PackedVector2Array()
		for i: int in 65:
			var angle: float = -PI * 0.65 + TAU * float(i) / 64.0
			var wobble: float = 1.0 + sin(angle * 3.0 + variation) * 0.035
			loop.append(Vector2(0.5, 0.5) + Vector2(cos(angle) * 0.37, sin(angle) * 0.4) * wobble)
		paths.append(loop)
	for i: int in paths.size():
		var amount: float = clampf(progress * paths.size() - i, 0.0, 1.0)
		if amount <= 0.0:
			continue
		var path: PackedVector2Array = paths[i]
		var drawn := PackedVector2Array()
		var end: float = amount * (path.size() - 1)
		for j: int in int(end) + 1:
			drawn.append(_point(path[j]))
		if int(end) + 1 < path.size():
			drawn.append(_point(path[int(end)].lerp(path[int(end) + 1], end - int(end))))
		if drawn.size() < 2:
			continue
		var width: float = maxf(1.6, size.x * 0.065)
		draw_polyline(drawn, ink, width, true)
		draw_circle(drawn[0], width * 0.5, ink, true, -1.0, true)
		draw_circle(drawn[-1], width * 0.5, ink, true, -1.0, true)


func _point(point: Vector2) -> Vector2:
	var tilted: Vector2 = (point - Vector2(0.5, 0.5)).rotated(sin(variation) * 0.065)
	return (tilted + Vector2(0.5, 0.5)) * size
