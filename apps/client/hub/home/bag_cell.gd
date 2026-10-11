class_name HubBagCell
extends Button
## One item of Túi đồ as a cell: every cell the same square, the item's picture alone in it. The
## item worn has a green tick in the corner; the one whose drawer is open has a gold ring. Named
## `Item_<slot>-<look>` ("Item_frame-jade").
##
##   var cell := HubBagCell.create(item, true)   # worn
##   cell.picked = true

const SIZE := Vector2(124.0, 124.0)

var item: XomDaoShopItem
var worn: bool = false

## Its drawer is open.
var picked: bool = false:
	set(value):
		picked = value
		queue_redraw()

var _picture: Texture2D
var _tick: Texture2D = XomDaoUi.icon("check-circle")


static func create(shop_item: XomDaoShopItem, is_worn: bool) -> HubBagCell:
	var cell := HubBagCell.new()
	cell.item = shop_item
	cell.worn = is_worn
	cell.name = "Item_" + HubItemTile.key_of(shop_item.id)
	cell._picture = XomDaoLooks.preview(shop_item.slot, shop_item.look)
	return cell


func _init() -> void:
	custom_minimum_size = SIZE
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	button_down.connect(func() -> void: XomDaoUi.play(self, XomDaoUi.SOUND_TAP))


func _draw() -> void:
	var over: bool = get_draw_mode() == DRAW_HOVER
	var down: bool = get_draw_mode() == DRAW_PRESSED or get_draw_mode() == DRAW_HOVER_PRESSED
	var box := Rect2(Vector2.ZERO, size)
	var fill: Color = Color("#FFF9EC").darkened(0.04 if over or down else 0.0)
	var line: Color = XomDaoUi.GOLD_DARK if picked else XomDaoUi.PAPER_DARK
	draw_style_box(XomDaoUi.box(fill, line, 4 if picked else 2, 20.0), box)
	if picked:
		draw_style_box(
			XomDaoUi.box(Color(XomDaoUi.SUN, 0.22), Color.TRANSPARENT, 0, 16.0), box.grow(-4.0)
		)
	if _picture != null:
		var room: Rect2 = box.grow(-14.0)
		var k: float = minf(room.size.x / _picture.get_width(), room.size.y / _picture.get_height())
		var drawn: Vector2 = _picture.get_size() * k
		draw_texture_rect(_picture, Rect2(room.get_center() - drawn / 2.0, drawn), false)
	if worn:
		var side: float = 34.0
		var at := Vector2(size.x - side - 6.0, 6.0)
		draw_circle(
			at + Vector2.ONE * side / 2.0, side / 2.0 + 2.0, XomDaoUi.PAPER, true, -1.0, true
		)
		draw_texture_rect(_tick, Rect2(at, Vector2.ONE * side), false, XomDaoUi.UP_ON_PAPER)
