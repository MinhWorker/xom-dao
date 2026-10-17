extends Control
## A single end-of-game beat: focus the board camera on the winner, bounce their pawn and burst
## fireworks while the hub brings in its result panel.

signal panel_ready
signal finished

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const CAMERA_ZOOM := 1.48
const CAMERA_SECONDS := 0.82
const FIREWORK_SECONDS := 3.6
const SHADE := Color("#102034", 0.14)
const SPARKS: Array[Color] = [
	Color("#FFD36B"), Color("#FF8177"), Color("#82C9FF"), Color("#A5EDAA")
]

var _table: Control
var _pawn: Control
var _focus := Vector2.ZERO
var _target := Vector2.ZERO
var _clock: float = -1.0
var _active: bool = false
var _panel_ready: bool = false
var _hidden_nodes: Array[Control] = []
var _previous_visibility: Array[bool] = []
var _table_mouse_filter: int = Control.MOUSE_FILTER_STOP
var _table_clip_contents: bool = true
var _background: Control
var _camera_background_covered: bool = false
var _view_transition: int = 0
var _throw: Control
var _throw_can_roll: bool = false


func _init() -> void:
	name = "Victory"
	visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


static func result_detail(view: Dictionary) -> Dictionary:
	if view.is_empty() or view.get("winner") == null:
		return {}
	var winner: int = int(view["winner"])
	var rows: Array = [
		["Số vòng", str(int(view["round"]) + 1)],
		["Tổng tài sản", XomDaoUi.money(Rules.asset_value(view, winner)) + " ₫"],
	]
	return {"reason": "Các đối thủ đã phá sản", "rows": rows, "layout": "right"}


## Wraps the board and its HUD so the final camera move treats them as one table.
func wrap_table(root: Control, table: Control) -> void:
	var children: Array[Node] = []
	for child: Node in root.get_children():
		if child != self:
			children.append(child)
	for child: Node in children:
		root.remove_child(child)
		table.add_child(child)
	root.add_child(table)
	root.move_child(table, 0)


## Moves the actual board and pawn into a clear left-of-centre frame, then celebrates.
func play(
	table: Control,
	pawn: Control,
	target: Vector2,
	hud_nodes: Array,
	buttons: Array,
	slots: Array,
	dice: Array,
	throw: Control
) -> void:
	_table = table
	_pawn = pawn
	_target = target
	_table_clip_contents = _table.clip_contents
	_background = _table.get_node_or_null("Background") as Control
	_hide_game_hud(hud_nodes, buttons, slots, dice, throw)
	_active = true
	_panel_ready = false
	visible = true
	self_modulate.a = 0.0
	_focus = _pawn.position + Vector2(_pawn.size.x * 0.5, _pawn.size.y * 0.92)
	_table.pivot_offset = _focus
	_table.scale = Vector2.ONE
	_table.position = Vector2.ZERO
	_cover_background_for_camera()
	_clock = -1.0

	var camera: Tween = _table.create_tween().set_parallel(true)
	camera.tween_property(self, "self_modulate:a", 1.0, 0.28)
	(
		camera
		. tween_property(_table, "scale", Vector2.ONE * CAMERA_ZOOM, CAMERA_SECONDS)
		. set_trans(Tween.TRANS_CUBIC)
		. set_ease(Tween.EASE_OUT)
	)
	(
		camera
		. tween_property(_table, "position", _target - _focus, CAMERA_SECONDS)
		. set_trans(Tween.TRANS_CUBIC)
		. set_ease(Tween.EASE_OUT)
	)
	_bounce_pawn()
	await camera.finished
	if not _active:
		return
	_panel_ready = true
	_clock = 0.0
	panel_ready.emit()
	var began: int = Time.get_ticks_msec()
	while _active and (Time.get_ticks_msec() - began) / 1000.0 < FIREWORK_SECONDS:
		_clock = (Time.get_ticks_msec() - began) / 1000.0
		queue_redraw()
		await get_tree().process_frame
	if _active:
		_finish()


func _bounce_pawn() -> void:
	var hop: Tween = create_tween()
	for _i: int in 6:
		hop.tween_property(_pawn, "elevation", 0.34, 0.22).set_trans(Tween.TRANS_SINE).set_ease(
			Tween.EASE_OUT
		)
		hop.tween_property(_pawn, "elevation", 0.0, 0.24).set_trans(Tween.TRANS_BOUNCE).set_ease(
			Tween.EASE_OUT
		)


## The hub waits for the camera move before showing the summary panel.
func wait_for_panel() -> void:
	if _panel_ready:
		return
	await panel_ready


## Returns to the full board when the player chooses Xem bàn, and restores winner focus on reopen.
func set_board_view(looking: bool) -> void:
	if _table == null or not is_instance_valid(_table) or _pawn == null:
		return
	_view_transition += 1
	var transition: int = _view_transition
	if looking:
		_finish()
	_focus = _pawn.position + Vector2(_pawn.size.x * 0.5, _pawn.size.y * 0.92)
	_table.pivot_offset = _focus
	if not looking:
		_cover_background_for_camera()
	var zoom: float = 1.0 if looking else CAMERA_ZOOM
	var destination: Vector2 = Vector2.ZERO if looking else _target - _focus
	var camera: Tween = _table.create_tween().set_parallel(true)
	(
		camera
		. tween_property(_table, "scale", Vector2.ONE * zoom, 0.52)
		. set_trans(Tween.TRANS_CUBIC)
		. set_ease(Tween.EASE_IN_OUT)
	)
	(
		camera
		. tween_property(_table, "position", destination, 0.52)
		. set_trans(Tween.TRANS_CUBIC)
		. set_ease(Tween.EASE_IN_OUT)
	)
	await camera.finished
	if transition == _view_transition and looking:
		_restore_camera_background()


## Cancels the celebration and restores the normal table for a rematch.
func reset() -> void:
	_view_transition += 1
	_finish()
	_restore_game_hud()
	if _table != null and is_instance_valid(_table):
		_restore_camera_background()
		_table.pivot_offset = Vector2.ZERO
		_table.scale = Vector2.ONE
		_table.position = Vector2.ZERO
	_pawn = null
	_table = null
	_background = null


func _cover_background_for_camera() -> void:
	if _table == null or not is_instance_valid(_table):
		return
	_table.clip_contents = false
	if _background != null and is_instance_valid(_background):
		_camera_background_covered = true
		_background.call("cover_camera_path", _table.size, _focus, _target, CAMERA_ZOOM)


func layout_background(viewport_size: Vector2) -> void:
	if not _camera_background_covered or _background == null or not is_instance_valid(_background):
		return
	_background.call("cover_camera_path", viewport_size, _focus, _target, CAMERA_ZOOM)


func _restore_camera_background() -> void:
	_camera_background_covered = false
	if _background != null and is_instance_valid(_background):
		_background.call("clear_camera_cover")
	if _table != null and is_instance_valid(_table):
		_table.clip_contents = _table_clip_contents


func _hide_game_hud(
	hud_nodes: Array, buttons: Array, slots: Array, dice: Array, throw: Control
) -> void:
	_hidden_nodes.clear()
	_previous_visibility.clear()
	_table_mouse_filter = _table.mouse_filter
	_throw = throw
	_throw_can_roll = bool(throw.get("can_roll"))
	_table.mouse_filter = Control.MOUSE_FILTER_STOP
	_throw.set("can_roll", false)
	for group: Array in [hud_nodes, buttons, slots, dice]:
		for item: Variant in group:
			var node: Control = item as Control
			if node == null:
				continue
			_hidden_nodes.append(node)
			_previous_visibility.append(node.visible)
			node.hide()


func _restore_game_hud() -> void:
	for index: int in mini(_hidden_nodes.size(), _previous_visibility.size()):
		var node: Control = _hidden_nodes[index]
		if is_instance_valid(node):
			node.visible = _previous_visibility[index]
	_hidden_nodes.clear()
	_previous_visibility.clear()
	if _table != null and is_instance_valid(_table):
		_table.mouse_filter = _table_mouse_filter
	if _throw != null and is_instance_valid(_throw):
		_throw.set("can_roll", _throw_can_roll)
	_throw = null


func _finish() -> void:
	if not _panel_ready:
		_panel_ready = true
		panel_ready.emit()
	if not _active:
		return
	_active = false
	_clock = -1.0
	visible = false
	finished.emit()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), SHADE)
	if _clock < 0.0:
		return
	var elapsed: float = _clock * 1000.0
	for burst: int in 8:
		var age: float = elapsed - burst * 350.0
		if age < 0.0:
			continue
		age = fmod(age, 1750.0)
		if age > 1380.0:
			continue
		var spread: float = float((burst * 37) % 37) / 100.0 - 0.18
		var x: float = clampf(_target.x + size.x * spread, size.x * 0.08, size.x * 0.67)
		var y: float = size.y * (0.20 + ((burst * 17) % 27) / 100.0)
		if age < 300.0:
			var rocket: float = size.y - (size.y - y) * age / 300.0
			draw_line(Vector2(x, rocket), Vector2(x, rocket + 24.0), Color("#FFEFBD"), 2.0)
			continue
		var t: float = (age - 300.0) / 1080.0
		var ink: Color = Color(SPARKS[burst % SPARKS.size()], 1.0 - t)
		for ray: int in 22:
			var angle: float = ray * TAU / 22.0
			var along := Vector2(cos(angle), sin(angle))
			var tip: Vector2 = Vector2(x, y) + along * 92.0 * t + Vector2(0.0, 46.0 * t * t)
			draw_line(tip, tip - along * 9.0, ink, 2.0)
