extends RefCounted
## Shared kit primitives for the game's open ledger and its object cards.

const INK_DARK := Color("#1E293B")
const INK_MUTED := Color("#64748B")
const INK_LIGHT := Color("#94A3B8")
const GOLD_ACCENT := Color("#F59E0B")
const GOLD_TEXT := Color("#B45309")
const GREEN_TEXT := Color("#16A34A")
const RED_TEXT := Color("#DC2626")
const CARD_BG := Color("#FFFFFF")
const CARD_BORDER := Color("#DFD7C7")
const TRAY_BG := Color("#F5F3EC")
const TRAY_BORDER := Color("#D8CFBC")


static func label(value: String, pixels: int = 26, ink: Color = INK_DARK) -> Label:
	var node := Label.new()
	node.text = value
	node.add_theme_font_override("font", XomDaoUi.display_font(800))
	node.add_theme_font_size_override("font_size", pixels)
	node.add_theme_color_override("font_color", ink)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return node


static func button(
	value: String, id: String, kind: XomDaoUi.Kind = XomDaoUi.Kind.INFO
) -> XomDaoButton:
	var node: XomDaoButton = XomDaoButton.create(value, kind)
	node.name = id
	node.custom_minimum_size = Vector2(88, 88)
	node.pad = 16
	node.add_theme_font_size_override("font_size", 24)
	return node


static func clear(node: Node) -> void:
	for child: Node in node.get_children():
		node.remove_child(child)
		child.queue_free()


static func paper(node: Control, fill: Color, edge: Color, radius: float = 14.0) -> void:
	var box: StyleBoxFlat = XomDaoUi.box(fill, edge, 2, radius)
	box.set_content_margin_all(16)
	node.add_theme_stylebox_override("panel", box)


static func flat(button: XomDaoButton, selected: bool = false) -> void:
	button.body.hide()
	var normal_bg: Color = Color("#FFFFFF") if selected else Color("#F5EFE4")
	var normal_edge: Color = GOLD_ACCENT if selected else Color("#D8CEBC")
	var border_w: int = 2 if selected else 1
	var normal_box: StyleBoxFlat = XomDaoUi.box(normal_bg, normal_edge, border_w, 10)
	normal_box.set_content_margin_all(12)

	var hover_bg: Color = Color("#FFFFFF")
	var hover_edge: Color = GOLD_ACCENT if selected else Color("#B8AC96")
	var hover_box: StyleBoxFlat = XomDaoUi.box(hover_bg, hover_edge, border_w, 10)
	hover_box.set_content_margin_all(12)

	var pressed_bg: Color = Color("#EBE2D0")
	var pressed_box: StyleBoxFlat = XomDaoUi.box(pressed_bg, normal_edge, border_w, 10)
	pressed_box.set_content_margin_all(12)

	button.add_theme_stylebox_override("normal", normal_box)
	button.add_theme_stylebox_override("disabled", normal_box)
	button.add_theme_stylebox_override("hover", hover_box)
	button.add_theme_stylebox_override("pressed", pressed_box)
	button.add_theme_stylebox_override("hover_pressed", hover_box)

	var text_color: Color = INK_DARK
	for state: String in [
		"font_color", "font_hover_color", "font_pressed_color", "font_disabled_color"
	]:
		button.add_theme_color_override(state, text_color)
	for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		button.add_theme_color_override(state, Color.WHITE)


static func surface(texture: Texture2D, margin: float = 18) -> StyleBoxTexture:
	var box := StyleBoxTexture.new()
	box.texture = texture
	for side: int in [SIDE_LEFT, SIDE_TOP, SIDE_RIGHT, SIDE_BOTTOM]:
		box.set_texture_margin(side, margin)
		box.set_content_margin(side, margin)
	return box
