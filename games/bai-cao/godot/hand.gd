class_name BaiCaoHand
extends RefCounted
## Your three cards on Bài Cào's table, face down until you open them. Each is a clip box
## (Mine_<k>) holding the face and the back that slides off it: tap one to open it, or drag it up
## (or right) to squeeze it, the back showing the face bit by bit; let go early and it covers up
## again. The table adds the boxes, lays them out and says when they may be squeezed.

## A card was opened (by a tap, a squeeze or a key).
signal opened
## A squeeze began (for its sound).
signal pressed

## How far a drag must go (in card heights) to open a card.
const SQUEEZE_OPEN := 0.52

var boxes: Array[Control] = []
var faces: Array[XomDaoCard] = []
var backs: Array[XomDaoCard] = []
## Cards opened this round.
var peeked: Array[int] = []
## The card being squeezed (-1 none).
var squeezing: int = -1
## Whether card k may be squeezed now (k → bool), set by the table.
var can_open := func(_k: int) -> bool: return false

var _from := Vector2.ZERO
var _moved: float = 0.0
var _progress: float = 0.0


func _init() -> void:
	for k: int in 3:
		var box := Control.new()
		box.name = "Mine_%d" % k
		box.clip_contents = true
		box.mouse_filter = Control.MOUSE_FILTER_STOP
		box.gui_input.connect(_on_input.bind(k))
		var face := XomDaoCard.new()
		box.add_child(face)
		var back := XomDaoCard.new()
		box.add_child(back)
		boxes.append(box)
		faces.append(face)
		backs.append(back)


## A new round: every card face down, nothing opened.
func reset() -> void:
	peeked.clear()
	squeezing = -1
	for back: XomDaoCard in backs:
		back.position = Vector2.ZERO
		back.visible = true


## Shows the hand (card numbers through `face_of`, k → [rank, suit]); `all_open` turns every
## card face up (turned over, or the count).
func show_cards(dealt: bool, face_of: Callable, back: Texture2D, all_open: bool) -> void:
	for k: int in 3:
		var box: Control = boxes[k]
		if not box.has_meta("flying"):
			box.visible = dealt
		if not dealt:
			continue
		var face: Array = face_of.call(k)
		faces[k].show_face(face[0], face[1])
		backs[k].back = back
		if (all_open or peeked.has(k)) and backs[k].visible and squeezing != k:
			slide_back(k, true)
		var can: bool = can_open.call(k)
		box.mouse_default_cursor_shape = (
			Control.CURSOR_POINTING_HAND if can else Control.CURSOR_ARROW
		)


## Keeps the faces and backs the size of their boxes (after a layout).
func fit() -> void:
	for k: int in 3:
		for card: XomDaoCard in [faces[k], backs[k]]:
			card.size = boxes[k].size
		if backs[k].visible and squeezing != k:
			backs[k].position.y = 0.0 if not peeked.has(k) else -boxes[k].size.y


## Opens card `k` straight away (a key).
func open_card(k: int) -> void:
	if not can_open.call(k):
		return
	pressed.emit()
	peeked.append(k)
	slide_back(k, true)
	opened.emit()


## The back slides off the card (open) or back over it.
func slide_back(k: int, open: bool) -> void:
	var back: XomDaoCard = backs[k]
	var height: float = boxes[k].size.y
	back.visible = true
	boxes[k].rotation = 0.0
	if not back.is_inside_tree():
		back.position = Vector2(0.0, -height if open else 0.0)
		back.visible = not open
		return
	var tween: Tween = back.create_tween()
	tween.tween_property(back, "position:y", -height if open else 0.0, 0.32 if open else 0.18)
	if open:
		tween.tween_callback(func() -> void: back.visible = false)


## Press on a card to squeeze it: dragging up or right slides the back off; a tap or a long
## enough drag opens it, a short one covers it again.
func _on_input(event: InputEvent, k: int) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).button_index == 1:
		var button := event as InputEventMouseButton
		if button.pressed and squeezing < 0 and can_open.call(k):
			squeezing = k
			_from = button.global_position
			_moved = 0.0
			_progress = 0.0
			pressed.emit()
		elif not button.pressed and squeezing == k:
			squeezing = -1
			var open: bool = _moved < 8.0 or _progress >= SQUEEZE_OPEN
			if open and can_open.call(k):
				peeked.append(k)
			slide_back(k, open)
			opened.emit()
	elif event is InputEventMouseMotion and squeezing == k:
		var at: Vector2 = (event as InputEventMouseMotion).global_position
		_moved = maxf(_moved, at.distance_to(_from))
		var height: float = boxes[k].size.y
		var pulled: float = maxf(_from.y - at.y, (at.x - _from.x) * 0.8)
		_progress = clampf(pulled / (height * 0.65), 0.0, 0.96)
		backs[k].position = Vector2(0.0, -_progress * height)
		boxes[k].rotation = deg_to_rad(-_progress * 3.0)
