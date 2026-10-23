extends PanelContainer
## The plaque by the dice: whose turn (or who won) in `status`, in that player's colour, and
## below it the table's `note` (Chọn ngựa, Ra 6, Đá ngựa!…), one line per part. `fit(width)`
## after a change lays it out.
##
## Named nodes for tests: TurnPlaque, Status, Notice.

var status := Label.new()
var note := Label.new()


func _init() -> void:
	name = "TurnPlaque"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.HUD, XomDaoUi.GOLD_DARK, 2, 18.0)
	)
	style.content_margin_left = 16.0
	style.content_margin_right = 16.0
	style.content_margin_top = 6.0
	style.content_margin_bottom = 8.0
	add_theme_stylebox_override("panel", style)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(column)
	status.name = "Status"
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.add_theme_font_override("font", XomDaoUi.display_font(800))
	status.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	column.add_child(status)
	note.name = "Notice"
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.add_theme_font_override("font", XomDaoUi.display_font(700))
	note.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	note.add_theme_color_override("font_color", Color("#FFE2A0"))
	column.add_child(note)


## Lays the plaque out `width` wide: its words wrap inside that width.
func fit(width: float) -> void:
	var inner: float = width - 32.0
	status.custom_minimum_size.x = inner
	note.custom_minimum_size.x = inner
	custom_minimum_size.x = width
	reset_size()


## Whose turn in `color`.
func set_status(text: String, color: Color) -> void:
	status.text = text
	status.add_theme_color_override("font_color", color)


## The note; "" hides it. Its parts (joined with " · " by the server) go one per line.
func set_note(text: String) -> void:
	note.text = "\n".join(text.split(" · ", false))
	note.visible = note.text != ""
