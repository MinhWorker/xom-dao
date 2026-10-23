extends Control
## The D-pad at the bottom left: a disc of the HUD's dark glass with four cream arrow keys. The
## table reads where a finger is (`direction_at`) and shows the key held down (`held`).

const KEYS: Dictionary = {
	"up": Vector2(0, -1), "left": Vector2(-1, 0), "down": Vector2(0, 1), "right": Vector2(1, 0)
}

var held: String = "none":
	set(value):
		if held != value:
			held = value
			queue_redraw()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## The direction a finger at `at` (in this control) points, "none" in the middle, "" outside.
func direction_at(at: Vector2) -> String:
	var radius: float = size.x / 2.0
	var d: Vector2 = at - size / 2.0
	if d.length() > radius * 1.5:
		return ""
	if d.length() < radius * 0.12:
		return "none"
	if absf(d.x) > absf(d.y):
		return "right" if d.x > 0.0 else "left"
	return "down" if d.y > 0.0 else "up"


## Whether `at` (in this control) is on the plate.
func covers(at: Vector2) -> bool:
	return at.distance_to(size / 2.0) <= size.x / 2.0


func _draw() -> void:
	var d: float = size.x
	var centre: Vector2 = size / 2.0
	draw_circle(centre + Vector2(0, 6.0), d * 0.49, Color(0.16, 0.09, 0.05, 0.35))
	draw_circle(centre, d * 0.49, Color(0.227, 0.141, 0.086, 0.62))
	draw_arc(centre, d * 0.49 - 2.0, 0, TAU, 64, Color(1, 1, 1, 0.1), 3.0, true)
	draw_circle(centre, d * 0.12, Color(0, 0, 0, 0.25))
	for dir: String in KEYS:
		var down: bool = held == dir
		var along: Vector2 = KEYS[dir]
		var side := Vector2(-along.y, along.x)
		var at: Vector2 = centre + along * d * 0.3
		var k: float = d * 0.25 * (0.92 if down else 1.0)
		var key := Rect2(at - Vector2(k, k) / 2.0, Vector2(k, k))
		var style := StyleBoxFlat.new()
		style.set_corner_radius_all(int(k * 0.3))
		style.bg_color = XomDaoUi.CREAM if down else Color(1.0, 0.965, 0.89, 0.22)
		draw_style_box(style, key.grow(2.0) if down else key)
		var r: float = k * 0.24
		var arrow := PackedVector2Array(
			[at + along * r, at - along * r * 0.7 + side * r, at - along * r * 0.7 - side * r]
		)
		draw_colored_polygon(arrow, XomDaoUi.INK if down else XomDaoUi.CREAM)
