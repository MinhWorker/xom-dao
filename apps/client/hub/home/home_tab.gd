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
	if selected:
		XomDaoPuff.paint(
			self, plate, Color("#FFDA55"), Color("#945D0F"), 20.0, 6.0, down, 3, false, true
		)
		var sunk: float = 4.0 if down else 0.0
		# 2 decorative brass rivets on the left
		_draw_rivet(Vector2(14.0, 14.0 + sunk), 2.2)
		_draw_rivet(Vector2(14.0, size.y - 18.0 + sunk), 2.2)
	else:
		var fill: Color = Color("#111827", 0.94).lightened(0.06 if over else 0.0)
		var edge: Color = Color("#C4922F", 0.6 if over else 0.4)
		XomDaoPuff.paint(self, plate, fill, edge, 20.0, 5.0, down, 2, false, true)
	var sunk: float = 4.0 if down else 0.0
	var middle: float = (size.y - 6.0) / 2.0 + sunk
	var ink: Color = Color("#452309") if selected else XomDaoUi.CREAM
	draw_texture_rect(_icon, Rect2(22.0, middle - 19.0, 38.0, 38.0), false, ink)
	var font: Font = XomDaoUi.display_font(800)
	var text_pos := Vector2(74.0, middle + 10.0)
	if selected:
		draw_string(
			font,
			text_pos + Vector2(0.0, 1.2),
			label,
			HORIZONTAL_ALIGNMENT_LEFT,
			size.x - 86.0,
			28,
			Color(1.0, 1.0, 1.0, 0.4)
		)
		draw_string(
			font, text_pos, label, HORIZONTAL_ALIGNMENT_LEFT, size.x - 86.0, 28, Color("#452309")
		)
	else:
		draw_string_outline(
			font, text_pos, label, HORIZONTAL_ALIGNMENT_LEFT, size.x - 86.0, 28, 4, Color("#090E16")
		)
		draw_string(
			font, text_pos, label, HORIZONTAL_ALIGNMENT_LEFT, size.x - 86.0, 28, XomDaoUi.CREAM
		)


func _draw_rivet(pos: Vector2, r: float = 2.5) -> void:
	draw_circle(pos + Vector2(0.0, 1.0), r, Color(0.0, 0.0, 0.0, 0.35), true, -1.0, true)
	draw_circle(pos, r, Color("#754511"), true, -1.0, true)
	draw_circle(pos, r * 0.72, Color("#E5A730"), true, -1.0, true)
	draw_circle(pos + Vector2(-r * 0.25, -r * 0.25), r * 0.3, Color("#FFF8E7"), true, -1.0, true)
