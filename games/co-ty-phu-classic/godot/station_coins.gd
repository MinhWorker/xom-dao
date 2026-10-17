extends RefCounted
## Four fixed player slots, with high-fidelity minted coins on the tile plane
## and smooth antialiased extruded cylinder edges.

const COLORS: Array[Color] = [
	Color("#DF6554"), Color("#5793D3"), Color("#60AF72"), Color("#E6BE52")
]
const SHADOW_INK := Color("#193D40")
const STEPS: int = 48


static func slots() -> Array[Vector2]:
	return [Vector2(0.185, 0.88), Vector2(0.395, 0.88), Vector2(0.605, 0.88), Vector2(0.815, 0.88)]


static func paint(
	canvas: CanvasItem,
	i: int,
	auction: Dictionary,
	extent: Vector2,
	span: Vector2,
	project: Callable
) -> void:
	var bids: Array = auction.get("bids", [])
	var counts: Array = auction.get("contributions", [])
	var radius: float = minf(span.x * 0.086, span.y * 0.075)
	var stroke_width: float = maxf(1.5, extent.x * 0.0010)

	for seat: int in mini(4, bids.size()):
		if int(bids[seat]) <= 0:
			continue
		var count: int = maxi(1, int(counts[seat])) if seat < counts.size() else 1
		var frame: Transform2D = project.call(i, slots()[seat], extent)
		var thickness: float = minf(span.y * 0.035, span.y * 0.09 / count) * frame.y.length()
		var base_color: Color = COLORS[seat]

		# 1. Soft grounded contact shadow on the board surface
		var shadow_center: Vector2 = frame.origin + Vector2(0, radius * 0.02)
		_draw_soft_shadow(canvas, shadow_center, frame, radius, stroke_width)

		# 2. Draw coins from bottom to top
		for level: int in count:
			var top: Vector2 = frame.origin - Vector2(0, (level + 1) * thickness)
			_draw_coin(canvas, top, frame, radius, thickness, base_color, stroke_width, level > 0)


static func _draw_soft_shadow(
	canvas: CanvasItem, center: Vector2, frame: Transform2D, radius: float, stroke_width: float
) -> void:
	var layers: Array[Dictionary] = [
		{"scale": 1.08, "alpha": 0.05},
		{"scale": 1.00, "alpha": 0.10},
		{"scale": 0.90, "alpha": 0.16},
	]
	for layer: Dictionary in layers:
		var poly := PackedVector2Array()
		var s: float = float(layer["scale"])
		var c := Color(SHADOW_INK.r, SHADOW_INK.g, SHADOW_INK.b, float(layer["alpha"]))
		for step: int in STEPS:
			var ang: float = step * TAU / float(STEPS)
			var p := Vector2(cos(ang), sin(ang)) * (radius * s)
			poly.append(center + frame.basis_xform(p))
		poly.append(poly[0])
		canvas.draw_colored_polygon(poly, c)
		canvas.draw_polyline(poly, c, stroke_width, true)


static func _draw_coin(
	canvas: CanvasItem,
	top: Vector2,
	frame: Transform2D,
	radius: float,
	thickness: float,
	base_color: Color,
	stroke_width: float,
	is_stacked: bool
) -> void:
	var cap := PackedVector2Array()
	var lower := PackedVector2Array()
	var offsets: Array[Vector2] = []
	offsets.resize(STEPS)

	var max_x: float = 0.0
	for step: int in STEPS:
		var ang: float = step * TAU / float(STEPS)
		var p := Vector2(cos(ang), sin(ang)) * radius
		var off: Vector2 = frame.basis_xform(p)
		offsets[step] = off
		cap.append(top + off)
		lower.append(top + off + Vector2(0, thickness))
		max_x = maxf(max_x, absf(off.x))

	max_x = maxf(max_x, 1.0)

	# 1. Cylinder barrel (side wall of the extruded coin)
	var front_lower := PackedVector2Array()
	var front_cap := PackedVector2Array()
	for s: int in STEPS:
		var s_next: int = (s + 1) % STEPS
		var dx: float = offsets[s_next].x - offsets[s].x
		# Only draw front-facing segments with non-negligible width to prevent degenerate geometry
		if dx > 0.05:
			var mid_x: float = (offsets[s].x + offsets[s_next].x) * 0.5
			var norm_x: float = clampf(mid_x / max_x, -1.0, 1.0)
			var quad_color: Color
			if norm_x < -0.2:
				var t: float = (-norm_x - 0.2) / 0.8
				quad_color = base_color.lightened(0.18 * t)
			else:
				var t: float = (norm_x + 0.2) / 1.2
				quad_color = base_color.darkened(0.20 + 0.22 * t)

			# Draw as two triangles to avoid any triangulation failure on quads
			var tri1 := PackedVector2Array([cap[s], cap[s_next], lower[s_next]])
			var tri2 := PackedVector2Array([cap[s], lower[s_next], lower[s]])
			canvas.draw_colored_polygon(tri1, quad_color)
			canvas.draw_colored_polygon(tri2, quad_color)
			canvas.draw_line(cap[s], lower[s], quad_color, stroke_width * 0.8, true)

			if front_lower.is_empty():
				front_cap.append(cap[s])
				front_lower.append(lower[s])
			front_cap.append(cap[s_next])
			front_lower.append(lower[s_next])

	# Antialias outer silhouette of the cylinder side wall
	if front_lower.size() >= 2:
		var wall_outline := PackedVector2Array()
		wall_outline.append(front_cap[0])
		for pt: Vector2 in front_lower:
			wall_outline.append(pt)
		wall_outline.append(front_cap[front_cap.size() - 1])
		canvas.draw_polyline(wall_outline, base_color.darkened(0.38), stroke_width, true)

	# 2. Coin top face
	var cap_closed := cap.duplicate()
	cap_closed.append(cap[0])
	var top_color: Color = base_color.lightened(0.06)
	canvas.draw_colored_polygon(cap, top_color)

	# 3. Two-tone beveled rim: specular highlight on top-left, shadow on bottom-right
	var rim_light := PackedVector2Array()
	var rim_dark := PackedVector2Array()
	for s: int in STEPS:
		var off: Vector2 = offsets[s]
		var facing_light: bool = (off.x + off.y * 0.5) < 0.0
		if facing_light:
			rim_light.append(cap[s])
		else:
			rim_dark.append(cap[s])

	canvas.draw_polyline(cap_closed, base_color.darkened(0.22), stroke_width, true)
	if rim_light.size() >= 2:
		canvas.draw_polyline(rim_light, base_color.lightened(0.42), stroke_width * 1.1, true)

	# 4. Recessed coin bed (inner stamped field)
	var inner_poly := PackedVector2Array()
	for s: int in STEPS:
		inner_poly.append(top + offsets[s] * 0.72)
	var inner_closed := inner_poly.duplicate()
	inner_closed.append(inner_poly[0])
	canvas.draw_colored_polygon(inner_poly, base_color.darkened(0.07))
	canvas.draw_polyline(inner_closed, base_color.darkened(0.26), stroke_width * 0.7, true)

	# 5. Minted 4-point star emblem at center
	var star := PackedVector2Array()
	for step: int in 8:
		var ang: float = step * TAU / 8.0 - PI * 0.5
		var r: float = 0.34 if (step % 2 == 0) else 0.13
		var p := Vector2(cos(ang), sin(ang)) * (radius * r)
		star.append(top + frame.basis_xform(p))
	star.append(star[0])
	canvas.draw_colored_polygon(star, base_color.lightened(0.32))
	canvas.draw_polyline(star, base_color.lightened(0.55), stroke_width * 0.6, true)

	# 6. Shadow cast onto lower coin when stacked
	if is_stacked and front_cap.size() >= 2:
		canvas.draw_polyline(front_cap, Color(0.0, 0.0, 0.0, 0.36), stroke_width * 1.6, true)
