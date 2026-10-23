extends Control
## A round action button of the arena (Bom, Kỹ năng, Lướt): a disc of the HUD's dark glass on a
## darker lip, ringed in the action's colour, with its icon and name; a shade sweeps back while
## it recharges and the seconds left replace the name. A ready skill breathes a soft glow. The
## table presses it (`press`), since a finger on the D-pad must not stop another from tapping.

signal pressed

const ART := "res://content/bom-nguyen-to/art/"

var label: String = ""
var enabled: bool = false:
	set(value):
		if enabled != value:
			enabled = value
			queue_redraw()
## How much is left to recharge, 0–1, and the seconds shown instead of the name.
var cooldown: float = 0.0
var seconds: int = 0
## A gold ring while a skill's boost lasts.
var glowing: bool = false

## The ring's colour (the skill's follows your friend's element).
var rim: Color = XomDaoUi.LACQUER:
	set(value):
		rim = value
		queue_redraw()
## Breathes when the action just came back (the skill).
var eager: bool = false

var _icon: Texture2D
var _down: bool = false
var _text := Label.new()


static func create(id: String, text: String, ring: Color, icon: String) -> Control:
	var button: Control = load("res://content/bom-nguyen-to/action.gd").new()
	button.name = id
	button.set("label", text)
	button.set("rim", ring)
	button.set("_icon", load(ART + icon + ".webp"))
	return button


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_text.add_theme_font_override("font", XomDaoUi.display_font(800))
	_text.add_theme_color_override("font_color", Color.WHITE)
	_text.add_theme_color_override("font_outline_color", Color("#2a180c"))
	_text.add_theme_constant_override("outline_size", 6)
	add_child(_text)
	resized.connect(_layout)


## Shows the cooldown and the text; redraws only when something changed.
func show_state(left: float, total: float, glow: bool) -> void:
	var fraction: float = clampf(left / total, 0.0, 1.0) if total > 0.0 else 0.0
	var secs: int = ceili(left / 1000.0) if left > 500.0 else 0
	if absf(fraction - cooldown) > 0.01 or secs != seconds or glow != glowing:
		cooldown = fraction
		seconds = secs
		glowing = glow
		_text.text = "%ds" % secs if secs > 0 else label
		queue_redraw()
	elif _text.text == "":
		_text.text = label


## A finger came down on the button (or lifted with `down` false).
func press(down: bool) -> void:
	if down and enabled and not _down:
		pressed.emit()
	_down = down
	queue_redraw()


func covers(at: Vector2) -> bool:
	return at.distance_to(size / 2.0) <= size.x * 0.55


func _layout() -> void:
	var font_size: int = maxi(24, int(size.x * 0.2))
	_text.add_theme_font_size_override("font_size", font_size)
	_text.size = Vector2(size.x * 1.4, font_size * 1.4)
	_text.position = Vector2(-size.x * 0.2, size.y * 0.6)


func _process(_delta: float) -> void:
	if eager and enabled and cooldown <= 0.0:
		queue_redraw()


func _draw() -> void:
	var r: float = size.x / 2.0
	var centre: Vector2 = size / 2.0
	var sink: float = 4.0 if _down else 0.0
	var face: Vector2 = centre + Vector2(0, sink - 2.0)
	# A short dense shadow and the dark lip under the face.
	draw_circle(centre + Vector2(0, 7.0), r * 0.98, Color(0.16, 0.09, 0.05, 0.42))
	draw_circle(centre + Vector2(0, 3.0), r * 0.97, rim.darkened(0.55))
	var glass := XomDaoUi.HUD if enabled else Color(0.25, 0.2, 0.18, 0.8)
	draw_circle(face, r * 0.95, rim if enabled else rim.lerp(Color(0.5, 0.5, 0.5), 0.6))
	draw_circle(face, r * 0.95 - 4.0, glass)
	# A thin lighter edge on top: lit from above.
	draw_arc(face, r * 0.95 - 6.0, PI * 1.15, PI * 1.85, 24, Color(1, 1, 1, 0.12), 3.0, true)
	if eager and enabled and cooldown <= 0.0:
		var breath: float = 0.5 + 0.5 * sin(Time.get_ticks_msec() / 260.0)
		draw_arc(face, r * 0.95 + 3.0, 0, TAU, 48, Color(rim, 0.35 + 0.4 * breath), 4.0, true)
	var tint := Color.WHITE if enabled else Color(0.7, 0.68, 0.66, 0.8)
	var icon: float = r * 0.9
	var ratio: float = float(_icon.get_width()) / _icon.get_height()
	var icon_size := Vector2(icon * minf(ratio, 1.4), icon * minf(ratio, 1.4) / ratio)
	var at: Vector2 = face - Vector2(0, r * 0.14)
	draw_texture_rect(_icon, Rect2(at - icon_size / 2.0, icon_size), false, tint)
	if cooldown > 0.0:
		var points := PackedVector2Array([face])
		for i: int in 41:
			var angle: float = -PI / 2.0 + TAU * cooldown * i / 40.0
			points.append(face + Vector2(cos(angle), sin(angle)) * (r * 0.95 - 4.0))
		draw_colored_polygon(points, Color(0.1, 0.06, 0.04, 0.55))
	if glowing:
		draw_arc(face, r * 0.95 + 4.0, 0, TAU, 48, Color("#fff1a0"), 4.0, true)
