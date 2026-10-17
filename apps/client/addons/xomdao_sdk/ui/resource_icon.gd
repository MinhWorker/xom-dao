class_name XomDaoResourceIcon
extends Control
## The icon of a currency, drawn flat: the copper coin with a square hole (xu) or the green gem
## (ngọc). Light from the top left, a border darker than the face.

enum Currency { COIN, GEM }

var currency: Currency = Currency.COIN:
	set(value):
		currency = value
		queue_redraw()


func _init() -> void:
	custom_minimum_size = Vector2(72.0, 72.0)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var r: float = minf(size.x, size.y) / 2.0
	var c: Vector2 = size / 2.0
	if currency == Currency.COIN:
		_coin(c, r * 0.94)
	else:
		_gem(c, r * 0.94)


func _coin(c: Vector2, r: float) -> void:
	# 2.5D ambient drop shadow
	draw_circle(
		c + Vector2(r * 0.08, r * 0.12), r * 0.96, Color(0.12, 0.07, 0.03, 0.35), true, -1.0, true
	)
	# 3D mechanical base lip (thickness at bottom)
	draw_circle(c + Vector2(0.0, r * 0.08), r, Color("#52300B"), true, -1.0, true)
	draw_circle(c + Vector2(0.0, r * 0.04), r, Color("#754511"), true, -1.0, true)
	# Outer rim body and metallic brass face
	draw_circle(c, r, Color("#663B0E"), true, -1.0, true)
	draw_circle(c, r * 0.92, Color("#E5A62E"), true, -1.0, true)
	# Top-left specular highlight arc on outer rim
	draw_arc(c, r * 0.83, PI * 0.85, PI * 1.65, 24, Color(1.0, 0.96, 0.8, 0.82), r * 0.09, true)
	# Bottom-right shaded arc on outer rim
	draw_arc(c, r * 0.83, -PI * 0.15, PI * 0.65, 24, Color(0.42, 0.22, 0.04, 0.55), r * 0.09, true)
	# Recessed coin bed (inner depression)
	draw_circle(c, r * 0.72, Color("#7D4913"), true, -1.0, true)
	draw_circle(c, r * 0.67, Color("#B87720"), true, -1.0, true)
	# Recessed rim lighting (light hits bottom-right inner wall; top-left is in shadow)
	draw_arc(c, r * 0.67, -PI * 0.1, PI * 0.6, 20, Color(1.0, 0.88, 0.55, 0.45), r * 0.05, true)
	draw_arc(c, r * 0.67, PI * 0.9, PI * 1.6, 20, Color(0.18, 0.08, 0.02, 0.45), r * 0.05, true)
	# Square hole raised collar
	var collar: float = r * 0.30
	var hole: float = r * 0.20
	draw_rect(
		Rect2(c - Vector2(collar, collar), Vector2(collar * 2.0, collar * 2.0)), Color("#663B0E")
	)
	draw_rect(
		Rect2(
			c - Vector2(collar - r * 0.03, collar - r * 0.03),
			Vector2((collar - r * 0.03) * 2.0, (collar - r * 0.03) * 2.0)
		),
		Color("#E5A62E")
	)
	# Square hole void
	draw_rect(Rect2(c - Vector2(hole, hole), Vector2(hole * 2.0, hole * 2.0)), Color("#140C06"))
	# Hole inner bevel (depth shadow top-left, specular glint bottom-right)
	draw_line(c - Vector2(hole, hole), c + Vector2(hole, -hole), Color("#060301"), r * 0.05)
	draw_line(c - Vector2(hole, hole), c + Vector2(-hole, hole), Color("#060301"), r * 0.05)
	draw_line(
		c + Vector2(-hole, hole), c + Vector2(hole, hole), Color(1.0, 0.9, 0.65, 0.6), r * 0.03
	)
	draw_line(
		c + Vector2(hole, -hole), c + Vector2(hole, hole), Color(1.0, 0.9, 0.65, 0.6), r * 0.03
	)
	# 4 Embossed Thông Bảo relief marks on cardinal axes
	var marks: Array[Vector2] = [
		Vector2(0.0, -r * 0.48),
		Vector2(0.0, r * 0.48),
		Vector2(-r * 0.48, 0.0),
		Vector2(r * 0.48, 0.0),
	]
	for m: Vector2 in marks:
		var pos: Vector2 = c + m
		draw_circle(pos + Vector2(0.0, r * 0.02), r * 0.075, Color("#663B0E"), true, -1.0, true)
		draw_circle(pos, r * 0.07, Color("#F5BA31"), true, -1.0, true)
		draw_circle(
			pos + Vector2(-r * 0.015, -r * 0.015), r * 0.03, Color("#FFF8E7"), true, -1.0, true
		)


func _gem(c: Vector2, r: float) -> void:
	draw_circle(c + Vector2(r * 0.06, r * 0.1), r * 0.96, XomDaoUi.SHADOW, true, -1.0, true)
	var outer := PackedVector2Array()
	for i: int in 6:
		var angle: float = PI / 6.0 + i * PI / 3.0
		outer.append(c + Vector2(cos(angle), sin(angle)) * r)
	draw_colored_polygon(outer, XomDaoUi.GEM_DARK)
	var inner := PackedVector2Array()
	for point: Vector2 in outer:
		inner.append(c + (point - c) * 0.8)
	draw_colored_polygon(inner, XomDaoUi.GEM)
	var table := PackedVector2Array()
	for point: Vector2 in inner:
		table.append(c + (point - c) * 0.45 + Vector2(-r * 0.08, -r * 0.08))
	draw_colored_polygon(table, XomDaoUi.GEM.lightened(0.3))
	draw_line(inner[3], inner[4], Color(XomDaoUi.CREAM, 0.8), r * 0.08, true)
