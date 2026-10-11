class_name XomDaoSlider
extends Control
## A volume-style slider on paper: a groove, a sea-coloured fill and a round honey knob, with
## the value as a number on its right. A full touch target: press or drag anywhere on it.
##
##   var volume := XomDaoSlider.create(0.8)       # 0.0 to 1.0
##   volume.changed.connect(func(value: float) -> void: ...)

signal changed(value: float)

const HEIGHT := 88.0
const STEPS := 20
const _KNOB := 22.0
const _GROOVE := 14.0
const _NUMBER := 64.0

var value: float = 0.0:
	set(next):
		value = snappedf(clampf(next, 0.0, 1.0), 1.0 / STEPS)
		queue_redraw()

## Greyed out (the row's switch is off); it still slides.
var dimmed: bool = false:
	set(next):
		dimmed = next
		queue_redraw()

var _dragging: bool = false


static func create(start: float = 0.0) -> XomDaoSlider:
	var slider := XomDaoSlider.new()
	slider.value = start
	return slider


func _init() -> void:
	custom_minimum_size = Vector2(280.0, HEIGHT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	resized.connect(queue_redraw)


## Sets the value as if the player slid to it (emits `changed` when it changes).
func slide_to(next: float) -> void:
	var before: float = value
	value = next
	if not is_equal_approx(before, value):
		changed.emit(value)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging = event.pressed
		if event.pressed:
			slide_to(_value_at(event.position.x))
		else:
			XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
		accept_event()
	elif event is InputEventMouseMotion and _dragging:
		slide_to(_value_at(event.position.x))
		accept_event()


func _track() -> Vector2:
	return Vector2(_KNOB, size.x - _NUMBER - _KNOB)


func _value_at(x: float) -> float:
	var track: Vector2 = _track()
	return (x - track.x) / maxf(1.0, track.y - track.x)


func _draw() -> void:
	var track: Vector2 = _track()
	var mid: float = size.y / 2.0
	var knob := Vector2(lerpf(track.x, track.y, value), mid)
	var fade: float = 0.45 if dimmed else 1.0
	var groove := StyleBoxFlat.new()
	groove.bg_color = Color(XomDaoUi.PAPER_DARK, fade)
	groove.set_corner_radius_all(int(_GROOVE / 2.0))
	groove.anti_aliasing = true
	var full := Rect2(track.x - _GROOVE / 2.0, mid - _GROOVE / 2.0, 0.0, _GROOVE)
	full.size.x = track.y - track.x + _GROOVE
	draw_style_box(groove, full)
	var fill: StyleBoxFlat = groove.duplicate()
	fill.bg_color = Color(XomDaoUi.SEA_DEEP, fade)
	full.size.x = knob.x - track.x + _GROOVE
	draw_style_box(fill, full)
	draw_circle(knob + Vector2(0.0, 3.0), _KNOB, XomDaoUi.SHADOW, true, -1.0, true)
	draw_circle(knob, _KNOB, Color(XomDaoUi.HONEY_DARK, 1.0), true, -1.0, true)
	draw_circle(knob, _KNOB - XomDaoUi.BORDER, XomDaoUi.HONEY.lerp(XomDaoUi.PAPER, 1.0 - fade))
	var font: Font = XomDaoUi.display_font(800)
	var text: String = str(roundi(value * 100.0))
	var at := Vector2(size.x - _NUMBER, mid + 10.0)
	draw_string(font, at, text, HORIZONTAL_ALIGNMENT_RIGHT, _NUMBER, 28, Color(XomDaoUi.INK, fade))
