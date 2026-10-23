extends RefCounted
## Resolves a tap to a square. With a piece picked, a legal target under the finger wins (its
## square on the board plane, or the piece standing on it): a tall piece in front must not swallow
## the tap meant for the capture behind it. Otherwise visible pieces first, then the board plane.

const PROJECTION = preload("res://content/chess/projection.gd")


static func square_for_event(
	event: InputEvent,
	piece_squares: Array,
	letters: Dictionary,
	flipped: bool,
	board_position: Vector2,
	board_size: Vector2,
	animating: bool,
	targets: Array = []
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
	var plane: int = PROJECTION.square_at_point(point, flipped, board_position, board_size)
	if targets.has(plane):
		return plane
	if not animating and not targets.is_empty():
		var aimed: Array = piece_squares.filter(func(sq: Variant) -> bool: return targets.has(sq))
		var target: int = PROJECTION.piece_at_visual_point(
			point, aimed, letters, flipped, board_position, board_size
		)
		if target >= 0:
			return target
	if not animating:
		var piece: int = PROJECTION.piece_at_visual_point(
			point, piece_squares, letters, flipped, board_position, board_size
		)
		if piece >= 0:
			return piece
	return plane


## The squares a piece may leave from, among the legal `moves` ({from, to, …}).
static func starts(moves: Array) -> Array[int]:
	var out: Array[int] = []
	for move: Dictionary in moves:
		var from: int = int(move["from"])
		if not out.has(from):
			out.append(from)
	return out


## Where the piece on `from` may go, among the legal `moves`.
static func targets(moves: Array, from: int) -> Array[int]:
	var out: Array[int] = []
	for move: Dictionary in moves:
		var to: int = int(move["to"])
		if int(move["from"]) == from and not out.has(to):
			out.append(to)
	return out
