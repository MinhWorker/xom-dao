class_name HubGameStrip
extends Control
## The games of one genre as posters (HubGamePoster) hanging side by side from a rail. A drag
## slides the row and it keeps gliding a little after the finger lifts; the mouse wheel slides
## it too. A touch that does not move is a tap on the poster under it: `picked`. A row narrower
## than the strip sits in the middle and does not slide.
##
##   strip.show_games(cards, catalog)
##   strip.picked.connect(func(game_id: String) -> void: ...)

signal picked(game_id: String)

const TAP_SLOP := 14.0
const GAP := 34.0
const SIDE := 28.0

var posters: Array[HubGamePoster] = []

## How far the row is slid to the left, in units.
var scroll: float = 0.0:
	set(value):
		scroll = clampf(value, 0.0, max_scroll())
		_layout()

var _press := Vector2.INF
var _press_scroll: float = 0.0
var _dragging: bool = false
var _velocity: float = 0.0
var _last_x: float = 0.0
var _last_ms: int = 0
var _glide: Tween
var _over: HubGamePoster


func _init() -> void:
	name = "Cards"
	mouse_filter = Control.MOUSE_FILTER_STOP
	resized.connect(_layout)
	mouse_exited.connect(_hover.bind(null))


func show_games(cards: Array[XomDaoGameCard], catalog: HubCatalog) -> void:
	_stop()
	for poster: HubGamePoster in posters:
		remove_child(poster)
		poster.queue_free()
	posters.clear()
	_over = null
	for item: XomDaoGameCard in cards:
		var poster := HubGamePoster.new()
		poster.show_card(item, catalog.can_play(item.id))
		poster.pressed.connect(picked.emit.bind(item.id))
		add_child(poster)
		posters.append(poster)
	scroll = 0.0


## Slides the row so this game's poster is in view.
func reveal(game_id: String) -> void:
	for i: int in posters.size():
		if posters[i].card.id == game_id:
			var left: float = SIDE + i * (HubGamePoster.SIZE.x + GAP)
			scroll = left - (size.x - HubGamePoster.SIZE.x) / 2.0


func max_scroll() -> float:
	return maxf(0.0, _row_width() - size.x)


func _row_width() -> float:
	var count: int = posters.size()
	return SIDE * 2.0 + count * HubGamePoster.SIZE.x + maxi(0, count - 1) * GAP


func _layout() -> void:
	var row: float = _row_width()
	var start: float = SIDE - scroll
	if row <= size.x:
		start = (size.x - row) / 2.0 + SIDE
	var y: float = maxf(0.0, (size.y - HubGamePoster.SIZE.y) / 2.0)
	for i: int in posters.size():
		posters[i].position = Vector2(start + i * (HubGamePoster.SIZE.x + GAP), y)
		posters[i].size = HubGamePoster.SIZE
	queue_redraw()


## The rail the posters' tags hang from, across the whole strip.
func _draw() -> void:
	if posters.is_empty():
		return
	var y: float = posters[0].position.y + 20.0
	draw_line(Vector2(0.0, y), Vector2(size.x, y), XomDaoUi.INK, 3.0, true)


func _gui_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null:
		if button.button_index == MOUSE_BUTTON_LEFT:
			if button.pressed:
				_begin(button.position)
			else:
				_release(button.position)
		elif button.pressed and button.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_stop()
			scroll += 90.0
		elif button.pressed and button.button_index == MOUSE_BUTTON_WHEEL_UP:
			_stop()
			scroll -= 90.0
		return
	var motion := event as InputEventMouseMotion
	if motion != null:
		if _press != Vector2.INF:
			_drag(motion.position)
		else:
			_hover(_poster_at(motion.position))


func _begin(at: Vector2) -> void:
	_stop()
	_press = at
	_press_scroll = scroll
	_dragging = false
	_velocity = 0.0
	_last_x = at.x
	_last_ms = Time.get_ticks_msec()


func _drag(at: Vector2) -> void:
	if not _dragging and absf(at.x - _press.x) > TAP_SLOP:
		_dragging = true
		_hover(null)
	if not _dragging:
		return
	scroll = _press_scroll - (at.x - _press.x)
	var now: int = Time.get_ticks_msec()
	if now > _last_ms:
		_velocity = (at.x - _last_x) / (now - _last_ms) * 1000.0
	_last_x = at.x
	_last_ms = now


func _release(at: Vector2) -> void:
	if _press == Vector2.INF:
		return
	var tapped: bool = not _dragging and at.distance_to(_press) <= TAP_SLOP
	_press = Vector2.INF
	if tapped:
		var poster: HubGamePoster = _poster_at(at)
		if poster != null:
			XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
			poster.pressed.emit()
		return
	_dragging = false
	# The row glides on a little, slower and slower.
	var target: float = clampf(scroll - _velocity * 0.25, 0.0, max_scroll())
	if is_inside_tree() and absf(target - scroll) > 1.0:
		_glide = create_tween()
		_glide.tween_property(self, "scroll", target, 0.35).set_trans(Tween.TRANS_CUBIC).set_ease(
			Tween.EASE_OUT
		)


func _poster_at(at: Vector2) -> HubGamePoster:
	for poster: HubGamePoster in posters:
		var print_box := Rect2(
			poster.position + Vector2(0.0, HubGamePoster.TAG_H),
			poster.size - Vector2(0.0, HubGamePoster.TAG_H)
		)
		if print_box.has_point(at):
			return poster
	return null


func _hover(poster: HubGamePoster) -> void:
	if poster == _over:
		return
	for other: HubGamePoster in [_over, poster]:
		if other != null and is_instance_valid(other) and is_inside_tree():
			var to: float = 1.0 if other == poster and other.playable else 0.0
			create_tween().tween_property(other, "lift", to, 0.14)
	_over = poster
	mouse_default_cursor_shape = (
		Control.CURSOR_POINTING_HAND if poster != null and poster.playable else Control.CURSOR_ARROW
	)


func _stop() -> void:
	if _glide != null:
		_glide.kill()
		_glide = null
