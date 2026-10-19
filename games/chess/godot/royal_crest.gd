extends Control
## A compact crown-and-shield seal for the check cut-in.

const GOLD := Color("#E8C46B")
const OXBLOOD := Color("#4A101B")
const ROSE := Color("#BA3A40")


func _draw() -> void:
	var side: float = minf(size.x, size.y)
	var origin := Vector2((size.x - side) * 0.5, (size.y - side) * 0.5)
	var scale_factor: float = side / 100.0
	var shield := PackedVector2Array(
		[
			origin + Vector2(20, 34) * scale_factor,
			origin + Vector2(80, 34) * scale_factor,
			origin + Vector2(76, 70) * scale_factor,
			origin + Vector2(50, 92) * scale_factor,
			origin + Vector2(24, 70) * scale_factor,
		]
	)
	draw_colored_polygon(shield, OXBLOOD)
	var shield_outline := shield.duplicate()
	shield_outline.append(shield[0])
	draw_polyline(shield_outline, GOLD, 2.5 * scale_factor, true)

	var crown := PackedVector2Array(
		[
			origin + Vector2(26, 31) * scale_factor,
			origin + Vector2(19, 11) * scale_factor,
			origin + Vector2(38, 22) * scale_factor,
			origin + Vector2(50, 7) * scale_factor,
			origin + Vector2(62, 22) * scale_factor,
			origin + Vector2(81, 11) * scale_factor,
			origin + Vector2(74, 31) * scale_factor,
		]
	)
	draw_colored_polygon(crown, GOLD)
	draw_line(
		origin + Vector2(24, 32) * scale_factor,
		origin + Vector2(76, 32) * scale_factor,
		GOLD,
		3.0 * scale_factor,
		true
	)
	draw_colored_polygon(
		PackedVector2Array(
			[
				origin + Vector2(47, 13) * scale_factor,
				origin + Vector2(53, 13) * scale_factor,
				origin + Vector2(53, 20) * scale_factor,
				origin + Vector2(47, 20) * scale_factor,
			]
		),
		ROSE
	)
	draw_circle(origin + Vector2(19, 10) * scale_factor, 3.5 * scale_factor, GOLD)
	draw_circle(origin + Vector2(50, 6) * scale_factor, 3.5 * scale_factor, GOLD)
	draw_circle(origin + Vector2(81, 10) * scale_factor, 3.5 * scale_factor, GOLD)

	# A small Tudor rose marks the shield without making it compete with the checking piece.
	var rose_center := origin + Vector2(50, 57) * scale_factor
	draw_circle(rose_center, 10.0 * scale_factor, ROSE)
	draw_circle(rose_center, 4.2 * scale_factor, GOLD)
	for point: Vector2 in [Vector2(-1, 0), Vector2(1, 0), Vector2(0, -1), Vector2(0, 1)]:
		draw_circle(rose_center + point * 6.5 * scale_factor, 3.2 * scale_factor, Color("#F3E2C1"))
