extends RefCounted
## Wraps Tile HUD copy into readable blocks on the board plane.

const HUD_TOP := 0.478
const HUD_HEIGHT := 0.230
const HUD_FONT_HEIGHT := 0.024
const HEADER_EXTENSION := 0.046
const QUOTE_TOP := 0.308
const QUOTE_HEIGHT := 0.088
const QUOTE_FONT_HEIGHT := 0.022


static func layout_for_hud(value: String, font: Font, panel: Rect2) -> Array[Dictionary]:
	return layout(
		value,
		font,
		Rect2(
			Vector2(panel.position.x + 0.019, HUD_TOP + HEADER_EXTENSION),
			Vector2(panel.size.x - 0.038, HUD_HEIGHT)
		),
		HUD_FONT_HEIGHT
	)


static func layout_for_quote(value: String, font: Font, panel: Rect2) -> Array[Dictionary]:
	return layout(
		value,
		font,
		Rect2(
			Vector2(panel.position.x + 0.010, QUOTE_TOP),
			Vector2(panel.size.x - 0.020, QUOTE_HEIGHT)
		),
		QUOTE_FONT_HEIGHT,
		HORIZONTAL_ALIGNMENT_CENTER,
		1.12
	)


static func layout(
	value: String,
	font: Font,
	bounds: Rect2,
	preferred_height: float,
	alignment: int = HORIZONTAL_ALIGNMENT_LEFT,
	line_step_ratio: float = 1.22
) -> Array[Dictionary]:
	var line_height: float = preferred_height
	var lines: Array[String] = []
	for _attempt: int in 4:
		lines = _wrap(value, font, bounds.size.x, line_height)
		var step: float = line_height * line_step_ratio
		var required_height: float = line_height + maxi(0, lines.size() - 1) * step
		if required_height <= bounds.size.y:
			break
		line_height *= bounds.size.y / required_height
	lines = _wrap(value, font, bounds.size.x, line_height)
	var step: float = line_height * line_step_ratio
	var result: Array[Dictionary] = []
	for i: int in lines.size():
		var line_bounds := Rect2(
			bounds.position + Vector2(0.0, i * step), Vector2(bounds.size.x, line_height)
		)
		(
			result
			. append(
				{
					"text": lines[i],
					"at": line_bounds.get_center(),
					"height": line_height,
					"width": bounds.size.x,
					"alignment": alignment,
					"bounds": line_bounds,
				}
			)
		)
	return result


static func _wrap(value: String, font: Font, width: float, height: float) -> Array[String]:
	var lines: Array[String] = [""]
	var paragraphs: PackedStringArray = value.split("\n")
	for paragraph_index: int in paragraphs.size():
		if paragraph_index > 0:
			lines.append("")
		for word: String in paragraphs[paragraph_index].split(" "):
			var candidate: String = word if lines[-1].is_empty() else lines[-1] + " " + word
			var measured: float = (
				font.get_string_size(candidate, HORIZONTAL_ALIGNMENT_LEFT, -1, 64).x
			)
			if measured * height / 64.0 > width and not lines[-1].is_empty():
				lines.append(word)
			else:
				lines[-1] = candidate
	return lines
