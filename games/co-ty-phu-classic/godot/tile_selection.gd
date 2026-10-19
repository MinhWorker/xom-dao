extends RefCounted
## Tracks a tapped board square and clears the selection when pawn movement starts.

signal focus_changed(square: int)

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")

var _board: Control
var _enabled: bool = false
var _focus: int = -1


func bind(board: Control) -> void:
	_board = board
	_board.gui_input.connect(_on_board_input)


func set_enabled(enabled: bool) -> void:
	_enabled = enabled


func clear_focus() -> void:
	set_focus(-1)


func set_focus(square: int) -> void:
	if _focus == square:
		return
	_focus = square
	focus_changed.emit(_focus)


func _on_board_input(event: InputEvent) -> void:
	if not _enabled or not _is_tap(event):
		return
	var square: int = _square_at(_event_position(event))
	if square < 0:
		return
	set_focus(-1 if _focus == square else square)


func _square_at(board_point: Vector2) -> int:
	if _board == null or _board.size.x <= 0.0 or _board.size.y <= 0.0:
		return -1
	var point: Vector2 = board_point / _board.size
	for i: int in Rules.CELLS.size():
		var polygon := PackedVector2Array()
		for corner: Vector2 in Rules.CELLS[i]:
			polygon.append(corner)
		if Geometry2D.is_point_in_polygon(point, polygon):
			return i
	return -1


static func _is_tap(event: InputEvent) -> bool:
	if event is InputEventMouseButton:
		var mouse: InputEventMouseButton = event
		return mouse.button_index == MOUSE_BUTTON_LEFT and not mouse.pressed
	if event is InputEventScreenTouch:
		return not (event as InputEventScreenTouch).pressed
	return false


static func _event_position(event: InputEvent) -> Vector2:
	if event is InputEventMouseButton:
		return (event as InputEventMouseButton).position
	if event is InputEventScreenTouch:
		return (event as InputEventScreenTouch).position
	return Vector2(-1, -1)
