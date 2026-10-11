class_name HubHomeTab
extends Button
## One page of Nhà on the stack of tabs down its left side: an icon and the page's name on a
## plate. The page on show has a gold plate that reaches a little further right, towards the
## paper it fills.
##
##   var tab := HubHomeTab.create("tui-do", "Túi đồ", "gift")   # named Tab_tui-do
##   tab.selected = true

const SIZE := Vector2(232.0, 78.0)
## How much further right the chosen tab's plate reaches.
const REACH := 10.0

var label: String = ""

var selected: bool = false:
	set(value):
		selected = value
		queue_redraw()

var _icon: Texture2D


static func create(id: String, text_of: String, icon_name: String) -> HubHomeTab:
	var tab := HubHomeTab.new()
	tab.name = "Tab_" + id
	tab.label = text_of
	tab._icon = XomDaoUi.icon(icon_name)
	return tab


func _init() -> void:
	custom_minimum_size = SIZE
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	button_down.connect(func() -> void: XomDaoUi.play(self, XomDaoUi.SOUND_TAP))


func _draw() -> void:
	var down: bool = get_draw_mode() == DRAW_PRESSED or get_draw_mode() == DRAW_HOVER_PRESSED
	var over: bool = get_draw_mode() == DRAW_HOVER
	var plate := Rect2(0.0, 0.0, size.x - REACH + (REACH if selected else 0.0), size.y)
	var ink: Color = XomDaoUi.INK if selected else XomDaoUi.CREAM
	if selected:
		XomDaoPuff.paint(self, plate, XomDaoUi.SUN, XomDaoUi.GOLD_DARK, 20.0, 6.0, down)
	else:
		var fill: Color = XomDaoUi.NAVY_HUD.lightened(0.08 if over else 0.0)
		XomDaoPuff.paint(self, plate, fill, XomDaoUi.NAVY_LINE, 20.0, 6.0, down, 2, false, false)
	var sunk: float = 4.0 if down else 0.0
	var middle: float = (size.y - 6.0) / 2.0 + sunk
	draw_texture_rect(_icon, Rect2(20.0, middle - 19.0, 38.0, 38.0), false, ink)
	var font: Font = XomDaoUi.display_font(800)
	draw_string(
		font, Vector2(72.0, middle + 10.0), label, HORIZONTAL_ALIGNMENT_LEFT, size.x - 84.0, 28, ink
	)
