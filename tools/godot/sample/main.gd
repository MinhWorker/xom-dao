extends Control
## A Godot client of Caro (`games/caro`): the sample Game scene for the Bridge addon. It
## draws the Match from `init` and `match:state`, sends `place` on a tap and reports `done`.
## `--autoplay` (after `--`) makes it mark cells itself, for `tools/godot/verify.mjs`.

const MARGIN := 16.0
## The Hub keeps the top-right corner (about 48x48 px) for its buttons.
const HUB_CORNER := Vector2(56.0, 56.0)
const DONE_DELAY_SEC := 1.2
const TOAST_SEC := 2.2
const BG := Color(0.043, 0.055, 0.078)
const GRID := Color(0.23, 0.28, 0.38)
const MARK_X := Color(0.95, 0.45, 0.35)
const MARK_O := Color(0.35, 0.8, 0.85)
const LAST := Color(1, 0.84, 0.3, 0.25)
const WIN := Color(1, 0.84, 0.3)
const TEXT := Color(0.91, 0.93, 0.96)

var _me := ""
var _seats: Array = []
var _match_id := ""
var _status := "loading"
var _state: Dictionary = {}
var _pending := Vector2i(-1, -1)
var _toast := ""
var _toast_until := 0
var _autoplay := false


func _ready() -> void:
	_autoplay = "--autoplay" in OS.get_cmdline_user_args()
	XomdaoBridge.inited.connect(_on_init)
	XomdaoBridge.message_received.connect(_on_message)
	XomdaoBridge.settings_changed.connect(
		func(settings: Dictionary) -> void: print("SAMPLE settings muted=", settings.get("muted"))
	)
	XomdaoBridge.visibility_changed.connect(
		func(hidden: bool) -> void: print("SAMPLE visibility hidden=", hidden)
	)
	XomdaoBridge.announce_ready()


func _on_init(init: Dictionary) -> void:
	print("SAMPLE init match=", init.get("match") != null)
	_me = str((init.get("player") as Dictionary).get("id"))
	_seats = (init.get("room") as Dictionary).get("seats", [])
	_match_id = ""
	_status = "loading"
	_pending = Vector2i(-1, -1)
	_show(init.get("match") if init.get("match") is Dictionary else {})


func _on_message(event: String, data: Variant) -> void:
	if event != "match:state" or not data is Dictionary:
		return
	var push: Dictionary = data
	var id := str(push.get("matchId", ""))
	if id != _match_id:
		_match_id = id
	_status = str(push.get("status", "loading"))
	_show(push.get("view") if push.get("view") is Dictionary else {})
	if _status == "over":
		_finish(id)


## Shows a Match state: all of the screen comes from it.
func _show(state: Dictionary) -> void:
	_state = state
	_pending = Vector2i(-1, -1)
	queue_redraw()
	if _autoplay and _my_turn():
		_autoplay_move()


## Tells the Hub the end of the Match has played out.
func _finish(id: String) -> void:
	await get_tree().create_timer(DONE_DELAY_SEC).timeout
	if id == _match_id and _status == "over":
		print("SAMPLE done")
		XomdaoBridge.done()


func _my_turn() -> bool:
	return _status == "playing" and _pending.x < 0 and str(_state.get("turn")) == _me


func _board() -> Dictionary:
	return _state.get("board", {}) as Dictionary


func _cell_size(board: Dictionary) -> float:
	var cols := int(board.get("cols", 1))
	var rows := int(board.get("rows", 1))
	var area := size - Vector2(MARGIN * 2.0, MARGIN * 2.0 + 24.0)
	return maxf(8.0, minf(area.x / float(cols), area.y / float(rows)))


func _origin(board: Dictionary, cell: float) -> Vector2:
	var span := Vector2(float(int(board.get("cols", 1))), float(int(board.get("rows", 1)))) * cell
	return Vector2((size.x - span.x) * 0.5, MARGIN + 24.0 + (size.y - MARGIN * 2.0 - 24.0 - span.y) * 0.5)


func _cell_center(board: Dictionary, point: Dictionary, cell: float) -> Vector2:
	var col := int(point["x"]) - int(board["left"])
	var row := int(point["y"]) - int(board["top"])
	return _origin(board, cell) + Vector2(float(col) + 0.5, float(row) + 0.5) * cell


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), BG)
	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(MARGIN, MARGIN + 14.0), _status_text(), HORIZONTAL_ALIGNMENT_LEFT, size.x - MARGIN - HUB_CORNER.x, 16, TEXT)
	if Time.get_ticks_msec() < _toast_until:
		draw_string(font, Vector2(MARGIN, size.y - MARGIN * 0.5), _toast, HORIZONTAL_ALIGNMENT_LEFT, size.x - MARGIN * 2.0, 16, MARK_X)
	var board := _board()
	if board.is_empty():
		return
	var cell := _cell_size(board)
	var origin := _origin(board, cell)
	var cols := int(board["cols"])
	var rows := int(board["rows"])
	for i in range(cols + 1):
		draw_line(origin + Vector2(float(i) * cell, 0.0), origin + Vector2(float(i) * cell, float(rows) * cell), GRID)
	for j in range(rows + 1):
		draw_line(origin + Vector2(0.0, float(j) * cell), origin + Vector2(float(cols) * cell, float(j) * cell), GRID)
	var last: Variant = _state.get("last")
	if last is Dictionary:
		var center := _cell_center(board, last, cell)
		draw_rect(Rect2(center - Vector2(cell, cell) * 0.5, Vector2(cell, cell)), LAST)
	var cells: Array = board["cells"]
	for index in range(cells.size()):
		var mark: Variant = cells[index]
		if mark == null:
			continue
		var center := origin + Vector2(float(index % cols) + 0.5, float(index / cols) + 0.5) * cell
		var reach := cell * 0.28
		if mark == "X":
			draw_line(center - Vector2(reach, reach), center + Vector2(reach, reach), MARK_X, 3.0, true)
			draw_line(center + Vector2(-reach, reach), center + Vector2(reach, -reach), MARK_X, 3.0, true)
		else:
			draw_arc(center, reach, 0.0, TAU, 24, MARK_O, 3.0, true)
	var line: Variant = _state.get("line")
	if line is Array and (line as Array).size() >= 2:
		var points: Array = line
		draw_line(_cell_center(board, points[0], cell), _cell_center(board, points[points.size() - 1], cell), WIN, 4.0, true)


func _status_text() -> String:
	if _state.is_empty():
		return "Đang chờ ván bắt đầu"
	var turn := str(_state.get("turn"))
	if _status == "over":
		var line: Variant = _state.get("line")
		if not line is Array or (line as Array).is_empty():
			return "Hòa"
		var winner := _winner(line as Array)
		return "Bạn thắng" if winner == _me else "%s thắng" % _name_of(winner)
	return "Lượt của bạn" if turn == _me else "Lượt của %s" % _name_of(turn)


## The player holding the marks of a winning `line`.
func _winner(line: Array) -> String:
	var board := _board()
	var first: Dictionary = line[0]
	var col := int(first["x"]) - int(board["left"])
	var row := int(first["y"]) - int(board["top"])
	var mark: Variant = (board["cells"] as Array)[row * int(board["cols"]) + col]
	var players: Array = _state.get("players", [])
	return str(players[0] if mark == "X" else players[1])


func _name_of(id: String) -> String:
	for seat: Dictionary in _seats:
		if str(seat.get("id")) == id:
			return str(seat.get("name"))
	return ""


func _gui_input(event: InputEvent) -> void:
	if not event is InputEventMouseButton:
		return
	var click := event as InputEventMouseButton
	if not click.pressed or click.button_index != MOUSE_BUTTON_LEFT or not _my_turn():
		return
	var board := _board()
	var cell := _cell_size(board)
	var local := (click.position - _origin(board, cell)) / cell
	var col := int(floorf(local.x))
	var row := int(floorf(local.y))
	if col < 0 or row < 0 or col >= int(board["cols"]) or row >= int(board["rows"]):
		return
	if (board["cells"] as Array)[row * int(board["cols"]) + col] != null:
		return
	_place(int(board["left"]) + col, int(board["top"]) + row)


func _place(x: int, y: int) -> void:
	_pending = Vector2i(x, y)
	var result: Dictionary = await XomdaoBridge.send("place", {"x": x, "y": y})
	if result.ok:
		return
	_pending = Vector2i(-1, -1)
	var error := str(result.error)
	if error != XomdaoBridge.ERROR_RESET and error != XomdaoBridge.ERROR_UNAVAILABLE:
		_toast = error
		_toast_until = Time.get_ticks_msec() + int(TOAST_SEC * 1000.0)
		queue_redraw()


## Marks the free cell of the board's middle row nearest its center: five in a row wins.
func _autoplay_move() -> void:
	var board := _board()
	var cols := int(board["cols"])
	var row := int(board["rows"]) / 2
	var cells: Array = board["cells"]
	for step in range(cols):
		var col := cols / 2 + (step + 1) / 2 * (1 if step % 2 == 1 else -1)
		if col >= 0 and col < cols and cells[row * cols + col] == null:
			print("SAMPLE autoplay place")
			_place(int(board["left"]) + col, int(board["top"]) + row)
			return
