extends Control
## A one-shot burst on the board, drawn in vectors, that clears itself: a ring that spreads and
## fades, and sparks (or dust puffs) flying out from `at`.
##
##   var burst := Burst.new()          # preload("res://content/co-ca-ngua/burst.gd")
##   burst.setup(at, 60.0, Color.GOLD, Burst.Kind.SPARKS)
##   fx.add_child(burst)

enum Kind { SPARKS, DUST, KICK }

const SECONDS := 0.6

var _at := Vector2.ZERO
var _radius: float = 40.0
var _color := Color.WHITE
var _kind: Kind = Kind.SPARKS
var _time: float = 0.0
## Each spark: [direction (Vector2), speed (0–1), size (0–1)].
var _sparks: Array = []


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)


func setup(at: Vector2, radius: float, color: Color, kind: Kind) -> void:
	_at = at
	_radius = radius
	_color = color
	_kind = kind
	var count: int = 12 if kind == Kind.SPARKS else 9
	var offset: float = randf() * TAU
	for i: int in count:
		var angle: float = offset + TAU * i / count + randf_range(-0.2, 0.2)
		_sparks.append([Vector2.from_angle(angle), randf_range(0.6, 1.0), randf_range(0.6, 1.0)])


func _process(delta: float) -> void:
	_time += delta
	if _time >= SECONDS:
		queue_free()
		return
	queue_redraw()


func _draw() -> void:
	var t: float = clampf(_time / SECONDS, 0.0, 1.0)
	var out: float = 1.0 - pow(1.0 - t, 3.0)
	var fade: float = 1.0 - t
	if _kind != Kind.DUST:
		draw_arc(
			_at,
			_radius * (0.35 + 0.75 * out),
			0.0,
			TAU,
			48,
			Color(_color, 0.85 * fade),
			maxf(1.0, 7.0 * fade),
			true
		)
	for spark: Array in _sparks:
		var direction: Vector2 = spark[0]
		var speed: float = spark[1]
		var grain: float = spark[2]
		var at: Vector2 = _at + direction * _radius * (0.3 + 0.9 * speed * out)
		match _kind:
			Kind.DUST:
				var puff: float = _radius * 0.2 * grain * (0.6 + out)
				draw_circle(at + Vector2(0.0, -6.0 * out), puff, Color(_color, 0.55 * fade))
			Kind.KICK:
				var tail: Vector2 = direction * _radius * 0.28 * speed * fade
				draw_line(at - tail, at, Color(_color, fade), maxf(1.0, 5.0 * grain * fade), true)
			_:
				_star(at, _radius * 0.14 * grain * (1.0 - t * 0.6), Color(_color, fade))


## A four-pointed sparkle.
func _star(at: Vector2, radius: float, color: Color) -> void:
	var points := PackedVector2Array()
	for i: int in 8:
		var reach: float = radius if i % 2 == 0 else radius * 0.32
		points.append(at + Vector2.from_angle(TAU * i / 8.0 - PI / 2.0) * reach)
	draw_colored_polygon(points, color)
