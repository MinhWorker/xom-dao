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
	var paper: StyleBoxFlat = XomDaoUi.box(Color("#FFFDF7"), Color("#824F18"), 3, 20.0)
	paper.shadow_color = XomDaoPuff.SHADE
	paper.shadow_size = 6
	paper.shadow_offset = Vector2(0.0, 6.0)
	paper.set_content_margin_all(2.0)
	add_theme_stylebox_override("panel", paper)


func _build(item: XomDaoShopItem) -> void:
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	add_child(column)
	var head := PanelContainer.new()
	head.custom_minimum_size.y = HEAD_H
	var wood := StyleBoxFlat.new()
	wood.bg_color = Color("#22140A")
	wood.border_width_bottom = 2
	wood.border_color = Color("#C4922F", 0.75)
	wood.corner_radius_top_left = 18
	wood.corner_radius_top_right = 18
	wood.corner_detail = 12
	wood.anti_aliasing = true
	wood.content_margin_left = 10.0
	wood.content_margin_right = 10.0
	head.add_theme_stylebox_override("panel", wood)
	head.draw.connect(
		func() -> void:
			_draw_rivet(head, Vector2(12.0, HEAD_H / 2.0), 2.5)
			_draw_rivet(head, Vector2(head.size.x - 12.0, HEAD_H / 2.0), 2.5)
	)
	column.add_child(head)
	var title := Label.new()
	title.text = item.name
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.add_theme_constant_override("line_spacing", -6)
	title.add_theme_font_override("font", XomDaoUi.display_font(800))
	title.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	title.add_theme_color_override("font_color", XomDaoUi.CREAM)
	title.add_theme_color_override("font_outline_color", Color("#0A0502"))
	title.add_theme_constant_override("outline_size", 4)
	head.add_child(title)
	var mat := PanelContainer.new()
	mat.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var mat_style := StyleBoxFlat.new()
	mat_style.bg_color = Color("#F4E8D0", 0.5)
	mat_style.border_width_left = 1
	mat_style.border_width_top = 1
	mat_style.border_width_right = 1
	mat_style.border_width_bottom = 1
	mat_style.border_color = Color("#D9963F", 0.35)
	mat_style.set_corner_radius_all(14)
	mat.add_theme_stylebox_override("panel", mat_style)
	var picture := TextureRect.new()
	picture.texture = XomDaoLooks.preview(item.slot, item.look)
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	picture.size_flags_vertical = Control.SIZE_EXPAND_FILL
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mat.add_child(picture)
	var around := MarginContainer.new()
	around.size_flags_vertical = Control.SIZE_EXPAND_FILL
	for side: String in ["left", "right", "top", "bottom"]:
		around.add_theme_constant_override("margin_" + side, 10)
	around.add_child(mat)
	column.add_child(around)
	var base := MarginContainer.new()
	base.add_theme_constant_override("margin_left", 10)
	base.add_theme_constant_override("margin_right", 10)
	base.add_theme_constant_override("margin_bottom", 10)
	column.add_child(base)
	foot.alignment = BoxContainer.ALIGNMENT_CENTER
	foot.custom_minimum_size.y = 60.0
	base.add_child(foot)


static func _draw_rivet(canvas: CanvasItem, pos: Vector2, r: float = 2.5) -> void:
	canvas.draw_circle(pos + Vector2(0.0, 1.0), r, Color(0.0, 0.0, 0.0, 0.4), true, -1.0, true)
	canvas.draw_circle(pos, r, Color("#754511"), true, -1.0, true)
	canvas.draw_circle(pos, r * 0.72, Color("#E5A730"), true, -1.0, true)
	canvas.draw_circle(
		pos + Vector2(-r * 0.25, -r * 0.25), r * 0.3, Color("#FFF8E7"), true, -1.0, true
	)
