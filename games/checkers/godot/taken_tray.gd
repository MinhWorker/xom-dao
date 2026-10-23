class_name CheckersTakenTray
extends Control
## A player's tray beside their seat: the men they took, stacked in a row like coins on a dark
## lacquer plate, with how many at the end. Hidden while empty. `slot_center(i)` is where the
## i-th disc sits, so a taken piece can fly there before `count` grows.

const DISC := 38.0
const STEP := 13.0
const PAD := 6.0
const COUNT_WIDTH := 34.0

## How many pieces lie in the tray.
var count: int = 0:
	set(value):
		count = value
		visible = value > 0
		_count.text = str(value)
		_resize()
		queue_redraw()

## The disc drawn for each taken piece.
var texture: Texture2D:
	set(value):
		texture = value
		queue_redraw()

var _count := Label.new()


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false
	_count.add_theme_font_override("font", XomDaoUi.display_font(800))
	_count.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_count.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_count.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_count.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_count.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_count)
	_resize()


## The middle of the i-th disc (from 0), in this tray's own coordinates.
func slot_center(i: int) -> Vector2:
	return Vector2(PAD + DISC / 2.0 + STEP * maxi(i, 0), PAD + DISC / 2.0)


## One disc's side, so a flying piece can shrink to it.
func disc_size() -> float:
	return DISC


func _resize() -> void:
	var discs: float = DISC + STEP * maxf(count - 1, 0)
	custom_minimum_size = Vector2(PAD * 2.0 + discs + COUNT_WIDTH, DISC + PAD * 2.0)
	size = custom_minimum_size
	_count.position = Vector2(PAD + discs, 0.0)
	_count.size = Vector2(COUNT_WIDTH, size.y)


func _draw() -> void:
	var plate: StyleBoxFlat = XomDaoUi.box(XomDaoUi.HUD, Color(XomDaoUi.GOLD_DARK, 0.6), 2, 16.0)
	draw_style_box(plate, Rect2(Vector2.ZERO, size))
	if texture == null:
		return
	for i: int in count:
		var center: Vector2 = slot_center(i)
		draw_texture_rect(
			texture, Rect2(center - Vector2.ONE * DISC / 2.0, Vector2.ONE * DISC), false
		)
