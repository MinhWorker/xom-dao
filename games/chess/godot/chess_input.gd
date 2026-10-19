extends RefCounted
## Resolves taps on visible pieces first, then on the board plane.

const PROJECTION = preload("res://content/chess/projection.gd")


static func square_for_event(
	event: InputEvent,
	piece_squares: Array,
	letters: Dictionary,
	flipped: bool,
	board_position: Vector2,
	board_size: Vector2,
	animating: bool
) -> int:
	var point := Vector2.ZERO
	if event is InputEventMouseButton:
		var mouse: InputEventMouseButton = event
		if mouse.button_index != MOUSE_BUTTON_LEFT or not mouse.pressed:
			return -1
		point = mouse.position
	elif event is InputEventScreenTouch:
		var touch: InputEventScreenTouch = event
		if not touch.pressed:
			return -1
		point = touch.position
	else:
		return -1
	if not animating:
		var piece: int = PROJECTION.piece_at_visual_point(
			point, piece_squares, letters, flipped, board_position, board_size
		)
		if piece >= 0:
			return piece
	return PROJECTION.square_at_point(point, flipped, board_position, board_size)
