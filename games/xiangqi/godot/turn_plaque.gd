class_name XiangqiTurnPlaque
extends PanelContainer
## The plaque at the top right of the table: whose turn (or who won) in `status`, and below it
## the move in `move_count` and a `note` (Chiếu tướng!, or how the game ended). `fit(width)`
## after a change lays it out.

var status := Label.new()
var move_count := Label.new()
var note := Label.new()


func _init() -> void:
	name = "TurnPlaque"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.HUD, XomDaoUi.GOLD_DARK, 2, 18.0)
	)
	style.content_margin_left = 18.0
	style.content_margin_right = 18.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 10.0
	add_theme_stylebox_override("panel", style)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	add_child(column)
	status.name = "Status"
	status.theme_type_variation = "HudLabel"
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(status)
	move_count.name = "MoveCount"
	move_count.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	move_count.add_theme_color_override("font_color", Color(XomDaoUi.CREAM, 0.7))
	column.add_child(move_count)
	note.name = "StatusNote"
	note.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	note.add_theme_font_override("font", XomDaoUi.display_font(800))
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(note)


## Lays the plaque out `width` wide: its words wrap inside that width.
func fit(width: float) -> void:
	var inner: float = width - 36.0
	status.custom_minimum_size.x = inner
	note.custom_minimum_size.x = inner
	custom_minimum_size.x = width
	reset_size()


## The note in `color`; "" hides it.
func set_note(text: String, color: Color) -> void:
	note.text = text
	note.visible = text != ""
	note.add_theme_color_override("font_color", color)
