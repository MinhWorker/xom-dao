class_name HubGameCarousel
extends Control
## Pointer capture survives leaving the stage. Native touch and mouse are handled separately,
## avoiding duplicate emulated clicks. A drag follows the finger, then snaps; taps never drag.

signal selected_changed(game_id: String)

const TAP_SLOP := 16.0
const SNAP_SECONDS := 0.28

var islands: Array[HubGameIsland] = []
var selected: int = 0
var turn: float = 0.0:
	set(value):
		turn = value
		_layout()
var obscured: bool = false

var _press := Vector2.INF
var _press_turn: float = 0.0
var _dragging: bool = false
var _touch_index: int = -1
var _last_x: float = 0.0
var _last_ms: int = 0
var _velocity: float = 0.0
var _tween: Tween
var _cancel_watch: HubTouchCancel


func _init() -> void:
	name = "Cards"
	mouse_filter = Control.MOUSE_FILTER_STOP
	clip_contents = true
	resized.connect(_layout)


func _ready() -> void:
	_cancel_watch = HubTouchCancel.new(self, cancel_drag)


func show_games(cards: Array[XomDaoGameCard], catalog: HubCatalog, id: String) -> void:
	cancel_drag()
	for island: HubGameIsland in islands:
		remove_child(island)
		island.queue_free()
	islands.clear()
	selected = 0
	for item: XomDaoGameCard in cards:
		var island := HubGameIsland.new()
		island.show_card(item, catalog.can_play(item.id))
		island.pressed.connect(select_game.bind(item.id))
		add_child(island)
		islands.append(island)
		if item.id == id:
			selected = islands.size() - 1
	turn = selected


func select_game(id: String) -> void:
	for i: int in islands.size():
		if islands[i].card.id == id:
			var steps: float = wrapf(i - turn, -islands.size() / 2.0, islands.size() / 2.0)
			_snap(turn + steps)
			return


func step(direction: int) -> void:
	if islands.size() > 1 and not obscured:
		_snap(roundf(turn) + direction)


func cancel_drag() -> void:
	_press = Vector2.INF
	_touch_index = -1
	_dragging = false
	if _tween != null:
		_tween.kill()
	if not islands.is_empty():
		turn = selected


func set_obscured(value: bool) -> void:
	obscured = value
	if value:
		cancel_drag()
	for island: HubGameIsland in islands:
		island.set_process(not value and island.focused and island.visible)


func _gap() -> float:
	return maxf(120.0, size.x * 0.29)


func _snap(target: float) -> void:
	if islands.is_empty():
		return
	if _tween != null:
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(self, "turn", target, SNAP_SECONDS).set_trans(Tween.TRANS_CUBIC).set_ease(
		Tween.EASE_OUT
	)
	var pick: int = posmod(roundi(target), islands.size())
	if pick != selected:
		selected = pick
		XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
		selected_changed.emit(islands[pick].card.id)
	else:
		XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	_layout()


func _layout() -> void:
	var count: int = islands.size()
	if count == 0:
		return
	var base: float = minf(470.0, minf(size.x * 0.48, size.y - 96.0))
	var order: Array[int] = []
	for i: int in count:
		var d: float = wrapf(i - turn, -count / 2.0, count / 2.0) if count > 1 else 0.0
		var near: float = clampf(1.0 - absf(d), 0.0, 1.0)
		var island: HubGameIsland = islands[i]
		island.visible = absf(d) < 1.45
		var side: float = base * lerpf(0.62, 1.0, near)
		island.size = Vector2(side, side)
		island.position = Vector2(
			size.x / 2.0 + d * _gap() - side / 2.0, (size.y - 92.0 - side) / 2.0 + 8.0
		)
		island.set_depth(near, i == selected and absf(d) < 0.05 and not obscured)
		order.append(i)
	order.sort_custom(func(a: int, b: int) -> bool: return islands[a].size.x < islands[b].size.x)
	for i: int in order:
		move_child(islands[i], -1)
	queue_redraw()


func _draw() -> void:
	var count: int = islands.size()
	if count < 2:
		return
	for i: int in count:
		var p := Vector2(size.x / 2.0 + (i - (count - 1) / 2.0) * 18.0, size.y - 42.0)
		draw_circle(
			p, 4.0, XomDaoUi.CREAM if i == selected else Color(XomDaoUi.CREAM, 0.45), true, -1, true
		)


func _gui_input(event: InputEvent) -> void:
	if obscured:
		return
	if event is InputEventScreenTouch and event.pressed and _press == Vector2.INF:
		_touch_index = event.index
		_begin(event.position)
		accept_event()
	elif event is InputEventMouseButton and event.device != InputEvent.DEVICE_ID_EMULATION:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			_begin(event.position)
			accept_event()
		elif (
			event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]
		):
			step(1 if event.button_index == MOUSE_BUTTON_WHEEL_DOWN else -1)
			accept_event()


func _input(event: InputEvent) -> void:
	if obscured or _press == Vector2.INF:
		return
	var at: Vector2
	if event is InputEventScreenDrag and event.index == _touch_index:
		at = get_global_transform_with_canvas().affine_inverse() * event.position
		_drag(at)
	elif event is InputEventScreenTouch and event.index == _touch_index and not event.pressed:
		at = get_global_transform_with_canvas().affine_inverse() * event.position
		if event.canceled:
			cancel_drag()
		else:
			_release(at)
		_touch_index = -1
	elif (
		_touch_index < 0
		and event is InputEventMouseMotion
		and event.device != InputEvent.DEVICE_ID_EMULATION
	):
		_drag(get_local_mouse_position())
	elif (
		_touch_index < 0
		and event is InputEventMouseButton
		and event.button_index == MOUSE_BUTTON_LEFT
		and not event.pressed
	):
		_release(get_local_mouse_position())
	else:
		return
	get_viewport().set_input_as_handled()


func _begin(at: Vector2) -> void:
	if _tween != null:
		_tween.kill()
	_press = at
	_press_turn = turn
	_dragging = false
	_last_x = at.x
	_last_ms = Time.get_ticks_msec()
	_velocity = 0.0


func _drag(at: Vector2) -> void:
	var delta: Vector2 = at - _press
	if not _dragging and absf(delta.y) > TAP_SLOP and absf(delta.y) > absf(delta.x) * 1.3:
		cancel_drag()
		return
	if absf(delta.x) > TAP_SLOP and islands.size() > 1:
		if not _dragging:
			XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
		_dragging = true
	if _dragging:
		turn = _press_turn - delta.x / _gap()
	var now: int = Time.get_ticks_msec()
	var elapsed: float = maxf(0.001, (now - _last_ms) / 1000.0)
	_velocity = lerpf(_velocity, (at.x - _last_x) / elapsed, 0.5)
	_last_x = at.x
	_last_ms = now


func _release(at: Vector2) -> void:
	if _dragging:
		var dx: float = at.x - _press.x
		var target: float = roundf(turn)
		var flick: bool = Time.get_ticks_msec() - _last_ms < 100 and absf(_velocity) > 600.0
		if target == roundf(_press_turn) and (absf(dx) > minf(64.0, _gap() * 0.22) or flick):
			target += signf(-dx)
		_snap(target)
	else:
		_tap(at)
	_press = Vector2.INF
	_dragging = false


func _tap(at: Vector2) -> void:
	var order: Array[HubGameIsland] = islands.duplicate()
	order.sort_custom(func(a: HubGameIsland, b: HubGameIsland) -> bool: return a.size.x > b.size.x)
	for island: HubGameIsland in order:
		if island.visible and Rect2(island.position, island.size).has_point(at):
			if island.card.id == islands[selected].card.id:
				XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
				XomDaoUi.bounce(island)
			else:
				select_game(island.card.id)
			return


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT:
		cancel_drag()


func _unhandled_input(event: InputEvent) -> void:
	if obscured:
		return
	if event.is_action_pressed("ui_left"):
		step(-1)
	elif event.is_action_pressed("ui_right"):
		step(1)
	else:
		return
	get_viewport().set_input_as_handled()
