extends Control
## A continuous notebook grid with a light wash under hover, last move and winning marks.

var wash := Color.TRANSPARENT:
	set(value):
		wash = value
		queue_redraw()

var left_edge: bool = false:
	set(value):
		left_edge = value
		queue_redraw()
var top_edge: bool = false:
	set(value):
		top_edge = value
		queue_redraw()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), wash)
	var grid := Color("#82949c")
	# Each shared edge is drawn once, so the page reads as one continuous grid.
	draw_polyline(
		PackedVector2Array([Vector2(size.x, 0.0), size, Vector2(0.0, size.y)]), grid, 1.0, true
	)
	if left_edge:
		draw_line(Vector2.ZERO, Vector2(0.0, size.y), grid, 1.0, true)
	if top_edge:
		draw_line(Vector2.ZERO, Vector2(size.x, 0.0), grid, 1.0, true)
