extends Control
## One horse on the board: its soft contact shadow on the board, the horse picture standing on
## it and, while it may move, a pulsing gold ring round its feet. The control is the square the
## horse stands in; `lift` raises the picture off its shadow (a hop), `spin` turns it (a kick).
##
##   var horse := Horse.new()          # preload("res://content/co-ca-ngua/horse.gd")
##   horse.texture = frame; horse.size = Vector2.ONE * 80.0
##   horse.lift = 12.0                 # in the air: the shadow shrinks and fades
##   horse.selectable = true           # the gold ring pulses

const GOLD := Color("#FFE2A0")
## Where the horse's base sits in its picture (a fraction of the side, from the top).
const FOOT := 0.74

var texture: Texture2D:
	set(value):
		texture = value
		_body.texture = value

var lift: float = 0.0:
	set(value):
		lift = value
		_place_body()
		queue_redraw()

var spin: float = 0.0:
	set(value):
		spin = value
		_body.rotation = value

## Squash on landing: 1 is upright, below 1 flattens the horse onto its base.
var squash: float = 1.0:
	set(value):
		squash = value
		_body.scale = Vector2(2.0 - value, value)

var selectable: bool = false:
	set(value):
		if selectable == value:
			return
		selectable = value
		_pulse = 0.0
		set_process(value)
		queue_redraw()

var _body := TextureRect.new()
var _pulse: float = 0.0


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	_body.name = "Body"
	_body.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_body.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_body)
	resized.connect(_place_body)
	set_process(false)


## The point on the board under the horse's feet, relative to the control.
func foot() -> Vector2:
	return Vector2(size.x / 2.0, size.y * FOOT)


func _place_body() -> void:
	_body.size = size
	_body.pivot_offset = foot()
	_body.position = Vector2(0.0, -lift)


func _process(delta: float) -> void:
	_pulse = fmod(_pulse + delta, 1.2)
	queue_redraw()


func _draw() -> void:
	var at: Vector2 = foot() + Vector2(size.x * 0.03, size.y * 0.02)
	var air: float = clampf(lift / (size.y * 0.5), 0.0, 1.0)
	var radius: float = size.x * 0.21 * (1.0 - 0.35 * air)
	# The contact shadow: a soft ellipse thrown to the lower right (light from the top left).
	for ring: int in 3:
		var grow: float = 1.0 + ring * 0.18
		draw_set_transform(at, 0.0, Vector2(1.0, 0.55))
		draw_circle(Vector2.ZERO, radius * grow, Color(0.12, 0.07, 0.03, 0.2 * (1.0 - air * 0.7)))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if not selectable:
		return
	var wave: float = _pulse / 1.2
	var base: Vector2 = foot()
	draw_set_transform(base, 0.0, Vector2(1.0, 0.62))
	draw_arc(Vector2.ZERO, size.x * 0.3, 0.0, TAU, 40, GOLD, 4.0, true)
	draw_arc(
		Vector2.ZERO,
		size.x * (0.3 + 0.16 * wave),
		0.0,
		TAU,
		40,
		Color(GOLD, 0.8 * (1.0 - wave)),
		3.0,
		true
	)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
