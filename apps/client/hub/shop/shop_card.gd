class_name HubShopCard
extends PanelContainer
## One item on Chợ's grid: a dark head with its whole name (on two lines when long), its picture
## on paper, and a foot with the screen's own Mua button or "Đã có" chip. Named
## `Item_<slot>-<look>` ("Item_frame-jade").

const SIZE := Vector2(212.0, 270.0)
const HEAD_H := 64.0

## Where the screen puts its button or chip.
var foot := HBoxContainer.new()


static func create(item: XomDaoShopItem) -> HubShopCard:
	var card := HubShopCard.new()
	card.name = "Item_" + HubItemTile.key_of(item.id)
	card._build(item)
	return card


func _init() -> void:
	custom_minimum_size = SIZE
	var paper: StyleBoxFlat = XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.HONEY_DARK, 2, 18.0)
	paper.shadow_color = XomDaoPuff.SHADE
	paper.shadow_size = 3
	paper.shadow_offset = Vector2(0.0, 5.0)
	paper.set_content_margin_all(2.0)
	add_theme_stylebox_override("panel", paper)


func _build(item: XomDaoShopItem) -> void:
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	add_child(column)
	var head := PanelContainer.new()
	head.custom_minimum_size.y = HEAD_H
	var wood := StyleBoxFlat.new()
	wood.bg_color = XomDaoUi.INK
	wood.corner_radius_top_left = 16
	wood.corner_radius_top_right = 16
	wood.corner_detail = 12
	wood.anti_aliasing = true
	wood.content_margin_left = 8.0
	wood.content_margin_right = 8.0
	head.add_theme_stylebox_override("panel", wood)
	column.add_child(head)
	var title := Label.new()
	title.text = item.name
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.add_theme_constant_override("line_spacing", -6)
	title.add_theme_font_override("font", XomDaoUi.display_font(700))
	title.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	title.add_theme_color_override("font_color", XomDaoUi.CREAM)
	head.add_child(title)
	var picture := TextureRect.new()
	picture.texture = XomDaoLooks.preview(item.slot, item.look)
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	picture.size_flags_vertical = Control.SIZE_EXPAND_FILL
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var around := MarginContainer.new()
	around.size_flags_vertical = Control.SIZE_EXPAND_FILL
	for side: String in ["left", "right", "top", "bottom"]:
		around.add_theme_constant_override("margin_" + side, 10)
	around.add_child(picture)
	column.add_child(around)
	var base := MarginContainer.new()
	base.add_theme_constant_override("margin_left", 10)
	base.add_theme_constant_override("margin_right", 10)
	base.add_theme_constant_override("margin_bottom", 10)
	column.add_child(base)
	foot.alignment = BoxContainer.ALIGNMENT_CENTER
	foot.custom_minimum_size.y = 60.0
	base.add_child(foot)
