extends Control
## The dice in its woven bamboo tray beside the player on turn. `roll(value)` tumbles the dice
## round the tray and lands it on `value`; `ready` makes it bob and the tray's rim glow while you
## may roll. Tapping anywhere on the tray emits `tapped`.
##
##   var tray := DiceTray.new()        # preload("res://content/co-ca-ngua/dice_tray.gd")
##   tray.faces = faces; tray.size = Vector2.ONE * 170.0
##   tray.tapped.connect(_roll)
##   await tray.roll(6)
##
## Named nodes for tests: DiceTray, Dice.

signal tapped

const GOLD := Color("#FFE2A0")
const TUMBLE_SECONDS := 0.62
## The dice's side against the tray's.
const DICE := 0.56

var faces: Array[Texture2D] = []
var ready_to_roll: bool = false:
	set(value):
		if ready_to_roll == value:
			return
		ready_to_roll = value
		_time = 0.0
		mouse_default_cursor_shape = (
			Control.CURSOR_POINTING_HAND if value else Control.CURSOR_ARROW
		)
		if not value:
			dice.position = _rest()
		queue_redraw()

var dice := TextureRect.new()

var _tray := TextureRect.new()
var _time: float = 0.0
var _rolling: bool = false


func _init() -> void:
	name = "DiceTray"
	mouse_filter = Control.MOUSE_FILTER_STOP
	_tray.name = "Tray"
	_tray.texture = load("res://content/co-ca-ngua/art/dice-tray.webp")
	_tray.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_tray.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_tray)
	dice.name = "Dice"
	dice.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	dice.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(dice)
	resized.connect(_fit)
	gui_input.connect(_on_input)


func _process(delta: float) -> void:
	_time += delta
	if ready_to_roll and not _rolling:
		dice.position = _rest() + Vector2(0.0, -sin(_time * 4.0) * size.x * 0.025)
		queue_redraw()


## Shows `value` (1–6) at rest.
func show_face(value: int) -> void:
	if faces.size() == 6:
		dice.texture = faces[clampi(value, 1, 6) - 1]


## The dice tumbles round the tray through its faces and lands on `value`.
func roll(value: int) -> void:
	_rolling = true
	var side: float = size.x
	for frame: int in 7:
		show_face((value + frame * 4) % 6 + 1)
		var jitter := Vector2(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * side * 0.1
		var tween: Tween = create_tween().set_parallel()
		var step: float = TUMBLE_SECONDS / 7.0
		tween.tween_property(dice, "position", _rest() + jitter, step)
		tween.tween_property(dice, "rotation", randf_range(-0.6, 0.6), step)
		tween.tween_property(dice, "scale", Vector2.ONE * (1.18 if frame % 2 == 0 else 1.0), step)
		await tween.finished
		if not is_inside_tree():
			return
	show_face(value)
	var land: Tween = create_tween().set_parallel()
	land.tween_property(dice, "position", _rest(), 0.12)
	land.tween_property(dice, "rotation", 0.0, 0.12)
	land.tween_property(dice, "scale", Vector2.ONE, 0.2).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)
	await land.finished
	_rolling = false


func _rest() -> Vector2:
	return (size - dice.size) / 2.0 + Vector2(-size.x * 0.01, -size.x * 0.02)


func _fit() -> void:
	_tray.size = size
	dice.size = Vector2.ONE * size.x * DICE
	dice.pivot_offset = dice.size / 2.0
	if not _rolling:
		dice.position = _rest()
	queue_redraw()


func _on_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.pressed and button.button_index == MOUSE_BUTTON_LEFT:
		tapped.emit()


func _draw() -> void:
	var middle: Vector2 = size / 2.0
	var radius: float = size.x * 0.48
	# The tray's soft shadow on the deck, to the lower right.
	for ring: int in 3:
		draw_circle(
			middle + Vector2(5.0, 8.0), radius * (0.98 + ring * 0.04), Color(0.1, 0.05, 0.02, 0.14)
		)
	if not ready_to_roll:
		return
	var wave: float = 0.5 + 0.5 * sin(_time * 4.0)
	draw_arc(middle, radius + 4.0, 0.0, TAU, 64, Color(GOLD, 0.55 + 0.4 * wave), 5.0, true)
	draw_arc(
		middle, radius + 10.0 + 6.0 * wave, 0.0, TAU, 64, Color(GOLD, 0.3 * (1.0 - wave)), 3.0, true
	)
