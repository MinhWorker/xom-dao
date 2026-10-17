extends RefCounted
## Small perspective drawing primitives in board-plane units (the board spans 0..1).

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")


static func ink_font() -> FontVariation:
	var font: FontVariation = XomDaoUi.display_font(800).duplicate() as FontVariation
	var file: FontFile = font.base_font.duplicate() as FontFile
	file.generate_mipmaps = true
	font.base_font = file
	return font


static func clean(text: String) -> String:
	return text.strip_edges().rstrip(".")


static func frame(uv: Vector2, extent: Vector2) -> Transform2D:
	var at: Vector2 = Rules.plane_point(uv) * extent
	var x: Vector2 = (Rules.plane_point(uv + Vector2(0.001, 0)) * extent - at) / 0.001
	var y: Vector2 = (Rules.plane_point(uv + Vector2(0, 0.001)) * extent - at) / 0.001
	return Transform2D(x, y, at)


static func quad(bounds: Rect2, extent: Vector2) -> PackedVector2Array:
	var points := PackedVector2Array()
	for corner: Vector2 in [
		bounds.position,
		Vector2(bounds.end.x, bounds.position.y),
		bounds.end,
		Vector2(bounds.position.x, bounds.end.y)
	]:
		points.append(Rules.plane_point(corner) * extent)
	return points


static func text(
	canvas: Control,
	font: Font,
	value: String,
	uv: Vector2,
	height: float,
	width: float,
	ink: Color = XomDaoUi.INK
) -> void:
	var scale_of: float = height / 64.0
	var measured: float = font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, 64).x
	scale_of = minf(scale_of, width / maxf(1.0, measured))
	canvas.draw_set_transform_matrix(frame(uv, canvas.size).scaled_local(Vector2.ONE * scale_of))
	canvas.draw_string(
		font, Vector2(-measured / 2.0, 22), value, HORIZONTAL_ALIGNMENT_LEFT, -1, 64, ink
	)


static func paragraph(
	canvas: Control,
	font: Font,
	value: String,
	uv: Vector2,
	height: float,
	width: float,
	max_lines: int = 5,
	ink: Color = XomDaoUi.INK
) -> void:
	var scale_of: float = height / 64.0
	var lines: Array[String] = [""]
	for word: String in clean(value).split(" "):
		var next: String = word if lines[-1].is_empty() else lines[-1] + " " + word
		if (
			font.get_string_size(next, HORIZONTAL_ALIGNMENT_LEFT, -1, 64).x * scale_of > width
			and not lines[-1].is_empty()
		):
			lines.append(word)
		else:
			lines[-1] = next
	var step: float = height * 1.22 * minf(1.0, float(max_lines) / lines.size())
	for i: int in lines.size():
		text(
			canvas,
			font,
			lines[i],
			uv + Vector2(0, (i - (lines.size() - 1) / 2.0) * step),
			step / 1.22,
			width,
			ink
		)
