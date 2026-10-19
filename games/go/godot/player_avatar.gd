class_name GoPlayerAvatar
extends Control
## A quiet stone-toned portrait with a thin wooden-gold ring for the Go table.

var initial: String = "":
	set(value):
		initial = value.left(1).to_upper()
		queue_redraw()

var side: String = "b":
	set(value):
		side = value
		queue_redraw()

var picture: Texture2D:
	set(value):
		picture = value
		queue_redraw()


func _init() -> void:
	custom_minimum_size = Vector2(64.0, 64.0)
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var radius: float = minf(size.x, size.y) * 0.5
	var center: Vector2 = size * 0.5
	var face_radius: float = radius - 4.0
	draw_circle(center + Vector2(1.0, 2.0), radius, Color(0.0, 0.0, 0.0, 0.28))
	draw_circle(center, radius, Color("#987746"))
	draw_circle(center, radius - 2.0, Color("#241B13"))
	if picture != null:
		_draw_picture(center, face_radius)
	else:
		var face: Color = Color("#171513") if side == "b" else Color("#E7DFD0")
		var ink: Color = Color("#F5EBD7") if side == "b" else Color("#3C3024")
		draw_circle(center, face_radius, face)
		var font: Font = XomDaoUi.body_font(true)
		var font_size: int = int(face_radius * 1.2)
		var text_size: Vector2 = font.get_string_size(
			initial, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size
		)
		var baseline := Vector2(
			center.x - text_size.x * 0.5, center.y + font.get_ascent(font_size) * 0.35
		)
		draw_string(font, baseline, initial, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, ink)
	draw_circle(center, radius - 1.0, Color("#C4A66C", 0.88), false, 1.8, true)


func _draw_picture(center: Vector2, radius: float) -> void:
	var points := PackedVector2Array()
	var uvs := PackedVector2Array()
	for i: int in 48:
		var direction := Vector2(cos(i * TAU / 48.0), sin(i * TAU / 48.0))
		points.append(center + direction * radius)
		uvs.append(Vector2(0.5, 0.5) + direction * 0.39)
	draw_colored_polygon(points, Color.WHITE, uvs, picture)
