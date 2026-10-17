extends RefCounted
## Bounded surface accents. Timings are staggered so the board remains quiet between beats.


static func paint(canvas: CanvasItem, kind: String, side: float, time: float) -> void:
	match kind:
		"airport":
			canvas.draw_circle(Vector2.ZERO, side * 0.69, Color("#173B50"), true, -1, true)
			canvas.draw_arc(
				Vector2.ZERO, side * 0.61, 0, TAU, 64, Color("#718F9B"), side * 0.018, true
			)
			for j: int in 7:
				var p := Vector2(sin(j * 13.7), cos(j * 7.3)) * side * 0.50
				canvas.draw_circle(
					p,
					side * 0.012,
					Color(1, 0.94, 0.72, 0.35 + 0.30 * sin(time + j)),
					true,
					-1,
					true
				)
			for j: int in 8:
				var t: float = time * 0.7 - j * 0.12
				canvas.draw_circle(
					Vector2(
						sin(t) * side * 0.055,
						cos(t) * side * 0.032 + 0.32 * side + j * side * 0.025
					),
					side * 0.015,
					Color(0.7, 0.91, 1.0, (1.0 - j / 8.0) * 0.6),
					true,
					-1,
					true
				)
		"start":
			for j: int in 3:
				var x: float = (fposmod(time * 0.30 + j / 3.0, 1.0) - 0.5) * side * 1.30
				var alpha: float = (1.0 - absf(x / side) * 1.5) * 0.5
				canvas.draw_polyline(
					PackedVector2Array(
						[
							Vector2(x + side * 0.07, side * 0.58),
							Vector2(x, side * 0.64),
							Vector2(x + side * 0.07, side * 0.70)
						]
					),
					Color(0.15, 0.44, 0.37, alpha),
					side * 0.025,
					true
				)
		"jail":
			var x: float = sin(time * 0.75) * side * 0.40
			canvas.draw_line(
				Vector2(x, -side * 0.38),
				Vector2(x, side * 0.38),
				Color(1, 0.97, 0.71, 0.6),
				side * 0.07,
				true
			)
		"go-jail":
			for j: int in 2:
				var color := Color("#DF6554") if j == 0 else Color("#5793D3")
				color.a = 0.25 + maxf(0.0, sin(time * 2.8 + j * PI)) * 0.65
				canvas.draw_circle(
					Vector2((j - 0.5) * side * 0.36, -side * 0.55),
					side * 0.07,
					color,
					true,
					-1,
					true
				)
		"chance", "chest":
			for j: int in 3:
				var t: float = fposmod(time * 0.20 + j / 3.0, 1.0)
				var p := Vector2(sin(j * 9.0) * side * 0.47, side * (0.30 - t * 0.92))
				var color := Color(1.0, 0.94, 0.67, sin(t * PI) * 0.8)
				var radius: float = side * 0.038 * sin(t * PI)
				canvas.draw_line(
					p - Vector2(radius, 0), p + Vector2(radius, 0), color, side * 0.017, true
				)
				canvas.draw_line(
					p - Vector2(0, radius), p + Vector2(0, radius), color, side * 0.017, true
				)
		"tax":
			var t: float = fposmod(time * 0.22, 1.0)
			canvas.draw_arc(
				Vector2(0, side * 0.39),
				side * (0.16 + t * 0.36),
				0.0,
				PI,
				28,
				Color(0.39, 0.29, 0.15, (1.0 - t) * 0.38),
				side * 0.025,
				true
			)
		"station":
			for j: int in 3:
				var t: float = fposmod(time * 0.40 + j / 3.0, 1.0)
				var x: float = side * (-0.58 + t * 0.25)
				canvas.draw_line(
					Vector2(x, side * 0.12),
					Vector2(x - side * 0.09, side * 0.12),
					Color(0.14, 0.28, 0.27, sin(t * PI) * 0.5),
					side * 0.022,
					true
				)
