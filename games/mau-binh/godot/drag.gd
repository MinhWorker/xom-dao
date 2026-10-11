extends RefCounted
## Dragging your cards on Mậu Binh's table (main.gd). A press that moves drags the card: it
## follows the pointer, a little bigger and over the others; the card it would swap with (the
## one whose place is nearest, within about a card) lights up and slides over to the dragged
## card's place. Dropping it there swaps them, anywhere else sends it back. A press that does not
## move is a tap.

## The press became a drag.
signal lifted
## A press let go where it began.
signal tapped(position: int)
## Card `from` was dropped on card `on`.
signal dropped(from: int, on: int)

## A press that moves this far (px) drags the card; it swaps with a card whose place its middle
## is dropped within this many card heights of.
const START := 10.0
const REACH := 0.75
const LIFT := 1.08

## Your cards by position, and each one's place (top left corner).
var cards: Array[XomDaoCard] = []
var homes: Array[Vector2] = []
## The card pressed, the one dragged and the one it would swap with (-1: none); where the
## pointer is and where it holds the card.
var pressed: int = -1
var dragged: int = -1
var hint: int = -1
var _pointer := Vector2.ZERO
var _grab := Vector2.ZERO


## A mouse (or touch) event on card `k`.
func input(event: InputEventMouse, k: int) -> void:
	var card: XomDaoCard = cards[k]
	# Where the pointer is on the table (the card may be scaled up while dragged).
	var at: Vector2 = card.get_transform() * event.position
	var button := event as InputEventMouseButton
	if button != null and button.button_index == MOUSE_BUTTON_LEFT:
		if button.pressed:
			pressed = k
			_pointer = at
			_grab = at - card.position
			return
		var from: int = dragged
		var on: int = hint
		var was: int = pressed
		cancel()
		if from >= 0 and on >= 0:
			dropped.emit(from, on)
		elif from >= 0:
			slide(card, homes[from], 0.18)
		elif was == k:
			tapped.emit(k)
	elif event is InputEventMouseMotion and pressed == k:
		if dragged < 0 and at.distance_to(_pointer) > START:
			dragged = k
			card.z_index = 2
			card.scale = Vector2.ONE * LIFT
			lifted.emit()
		_pointer = at
		if dragged == k:
			card.position = at - _grab
			_show_hint(drop_target(homes, card.position + card.size / 2.0, k, card.size.y * REACH))


## After the cards were laid out (`homes` are their places): the dragged one stays under the
## pointer and the hinted one at the dragged one's place.
func place() -> void:
	if dragged >= 0:
		cards[dragged].position = _pointer - _grab
	if hint >= 0:
		cards[hint].position = homes[dragged]


## Lets go of the card without dropping it anywhere.
func cancel() -> void:
	if dragged >= 0:
		cards[dragged].scale = Vector2.ONE
		cards[dragged].z_index = 0
	if hint >= 0:
		cards[hint].picked = false
	dragged = -1
	hint = -1
	pressed = -1


## The card whose place (`spots`, top left corners of cards as big as the dragged one) is
## nearest `center` within `reach`, or -1 when that is the dragged card's own place (`from`)
## or none is that near.
func drop_target(spots: Array[Vector2], center: Vector2, from: int, reach: float) -> int:
	var half: Vector2 = cards[from].size / 2.0
	var best: int = -1
	var nearest: float = reach
	for k: int in spots.size():
		var distance: float = (spots[k] + half).distance_to(center)
		if distance < nearest:
			nearest = distance
			best = k
	return -1 if best == from else best


static func slide(card: Control, to: Vector2, seconds: float = 0.12) -> void:
	if card.is_inside_tree():
		card.create_tween().tween_property(card, "position", to, seconds).set_trans(
			Tween.TRANS_QUAD
		)
	else:
		card.position = to


func _show_hint(target: int) -> void:
	if target == hint:
		return
	if hint >= 0:
		slide(cards[hint], homes[hint])
		cards[hint].picked = false
	hint = target
	if target >= 0:
		cards[target].picked = true
		slide(cards[target], homes[dragged])
