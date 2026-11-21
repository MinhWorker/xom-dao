extends Control
## The words on top of the table: big shouts ("Vòng 2", "Chặt!"), short tags that float up
## from a seat, the error toast and the ranking board.

const Style := preload("style.gd")

const TOAST_SEC := 2.2

var _toast: Label
var _toast_id := 0
var _board: Control


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


## Big words across the table at height `y`, faded in and out over `seconds`.
func banner(text: String, font_size: int, color: Color, seconds: float, y: float) -> void:
	var node := Style.label(text, font_size, color, true)
	node.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	node.add_theme_constant_override("outline_size", 7)
	node.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	node.modulate.a = 0.0
	add_child(node)
	node.size = Vector2(size.x, float(font_size) * 1.5)
	node.position = Vector2(0.0, y - node.size.y * 0.5)
	node.pivot_offset = node.size * 0.5
	node.scale = Vector2(0.8, 0.8)
	var fade := node.create_tween().set_parallel(true)
	fade.tween_property(node, "modulate:a", 1.0, 0.15)
	fade.tween_property(node, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)
	var life := node.create_tween()
	life.tween_interval(maxf(seconds - 0.25, 0.1))
	life.tween_property(node, "modulate:a", 0.0, 0.25)
	life.tween_callback(node.queue_free)


## A short tag that floats up from `at`.
func pop(text: String, color: Color, at: Vector2) -> void:
	var node := Style.label(text, 15, color, true)
	node.add_theme_stylebox_override("normal", _pill(Color(0.03, 0.06, 0.05, 0.9), color))
	add_child(node)
	node.size = Vector2.ZERO
	node.position = at - node.get_combined_minimum_size() * 0.5
	var drift := node.create_tween().set_parallel(true)
	drift.tween_property(node, "position:y", node.position.y - 18.0, 1.0)
	drift.tween_property(node, "modulate:a", 0.0, 0.3).set_delay(0.7)
	drift.chain().tween_callback(node.queue_free)


## An error from the server, centered at height `y` for a moment.
func toast(text: String, y: float) -> void:
	if _toast == null:
		_toast = Style.label("", 16, Style.TEXT, true)
		_toast.add_theme_stylebox_override(
			"normal", _pill(Color(0.1, 0.04, 0.04, 0.92), Style.DANGER)
		)
		add_child(_toast)
	_toast_id += 1
	var id := _toast_id
	_toast.text = text
	_toast.visible = true
	_toast.size = Vector2.ZERO
	await get_tree().process_frame
	_toast.position = Vector2((size.x - _toast.size.x) * 0.5, y)
	await get_tree().create_timer(TOAST_SEC).timeout
	if id == _toast_id:
		_toast.visible = false


func hide_board() -> void:
	if _board != null:
		_board.queue_free()
		_board = null


## A ranking on a brass-edged plate in the middle of the table. `heads` names the number
## columns; each row is `{place, name, mine, cells}` with one cell per column.
func show_board(title: String, heads: Array[String], rows: Array[Dictionary]) -> void:
	hide_board()
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _board_style())
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(column)
	var heading := Style.label(title, 24, Style.BRASS, true)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(heading)
	var grid := GridContainer.new()
	grid.columns = 2 + heads.size()
	grid.add_theme_constant_override("h_separation", 22)
	grid.add_theme_constant_override("v_separation", 6)
	grid.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(grid)
	grid.add_child(Style.label("", 14))
	grid.add_child(Style.label("", 14))
	for head in heads:
		grid.add_child(_cell(head, 13, Style.MUTED, false))
	for row in rows:
		var color := Style.BRASS if row["mine"] else Style.TEXT
		grid.add_child(Style.label(str(row["place"]), 20, color, true))
		var name_label := Style.label(str(row["name"]), 18, color, true)
		name_label.custom_minimum_size.x = 130.0
		name_label.clip_text = true
		grid.add_child(name_label)
		var cells: Array = row["cells"]
		for i in cells.size():
			grid.add_child(_cell(str(cells[i]), 18, color, i == cells.size() - 1))
	var holder := ColorRect.new()
	holder.color = Color(0, 0, 0, 0.38)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.set_anchors_preset(Control.PRESET_FULL_RECT)
	holder.add_child(panel)
	add_child(holder)
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE)
	holder.modulate.a = 0.0
	holder.create_tween().tween_property(holder, "modulate:a", 1.0, 0.25)
	_board = holder


func _cell(text: String, font_size: int, color: Color, heavy: bool) -> Label:
	var cell := Style.label(text, font_size, color, heavy)
	cell.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	cell.custom_minimum_size.x = 56.0
	return cell


func _pill(fill: Color, edge: Color) -> StyleBoxFlat:
	var style := Style.box(fill, 14.0, edge, 1.5)
	style.content_margin_left = 14.0
	style.content_margin_right = 14.0
	style.content_margin_top = 6.0
	style.content_margin_bottom = 6.0
	return style


func _board_style() -> StyleBoxFlat:
	var style := Style.box(Color(0.03, 0.07, 0.06, 0.94), 18.0, Style.BRASS, 2.5)
	style.content_margin_left = 30.0
	style.content_margin_right = 30.0
	style.content_margin_top = 18.0
	style.content_margin_bottom = 20.0
	style.shadow_color = Color(0, 0, 0, 0.5)
	style.shadow_size = 14
	return style
