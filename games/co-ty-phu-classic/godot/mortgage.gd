extends PanelContainer
## Cờ tỷ phú's mortgage board, Thế chấp tài sản (`mortgage` with `squares` in
## src/game/CoTyPhuClassicGame.ts): your deeds that are not mortgaged yet, a page of rows at a
## time, each with what it brings. Tapping a row picks it or puts it back; the total follows.
## Xác nhận emits `chosen` with the picked squares.
##
## Named nodes: MortgageRow_<square>, MortgagePage, MortgagePrevious, MortgageNext,
## MortgageTotal, MortgageCancel, MortgageConfirm.

signal chosen(squares: Array[int])

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const ROWS := 5
const ROW_HEIGHT := 64.0

## Whose deeds the board shows.
var seat: int = -1

var _view: Dictionary = {}
var _picked: Array[int] = []
var _page: int = 0
var _list := VBoxContainer.new()
var _page_label := Label.new()
var _previous: XomDaoButton = XomDaoButton.create("‹", XomDaoUi.Kind.INFO)
var _next: XomDaoButton = XomDaoButton.create("›", XomDaoUi.Kind.INFO)
var _total := Label.new()
var _cancel: XomDaoButton = XomDaoButton.create("Hủy", XomDaoUi.Kind.BACK)
var _confirm: XomDaoButton = XomDaoButton.create("Xác nhận", XomDaoUi.Kind.CONFIRM)


func _init() -> void:
	name = "MortgageBoard"
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP
	var paper: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.HONEY_DARK, XomDaoUi.BORDER, 18.0)
	)
	paper.set_content_margin_all(16.0)
	add_theme_stylebox_override("panel", paper)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	add_child(column)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 10)
	column.add_child(head)
	var title: Label = _label("Thế chấp tài sản", XomDaoUi.TEXT, XomDaoUi.INK)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(title)
	_page_label.name = "MortgagePage"
	_style(_page_label, XomDaoUi.TEXT_MIN, XomDaoUi.INK)
	head.add_child(_page_label)
	_previous.name = "MortgagePrevious"
	_previous.pressed.connect(_turn.bind(-1))
	head.add_child(_previous)
	_next.name = "MortgageNext"
	_next.pressed.connect(_turn.bind(1))
	head.add_child(_next)
	_list.add_theme_constant_override("separation", 6)
	_list.custom_minimum_size.y = ROWS * ROW_HEIGHT + (ROWS - 1) * 6.0
	column.add_child(_list)
	_total.name = "MortgageTotal"
	_style(_total, XomDaoUi.TEXT_MIN, XomDaoUi.INK)
	_total.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_total)
	var terms: Label = _label(
		"Hạn chuộc: 3 lượt tiếp theo của người vay", XomDaoUi.TEXT_MIN, XomDaoUi.HONEY_DARK
	)
	terms.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(terms)
	var actions := HBoxContainer.new()
	actions.alignment = BoxContainer.ALIGNMENT_CENTER
	actions.add_theme_constant_override("separation", 12)
	_cancel.name = "MortgageCancel"
	_cancel.pressed.connect(hide)
	actions.add_child(_cancel)
	_confirm.name = "MortgageConfirm"
	_confirm.pressed.connect(_on_confirm)
	actions.add_child(_confirm)
	column.add_child(actions)


## The board for `owner`'s deeds, with `initial` picked (and its page shown) when it may be.
func open(view: Dictionary, owner: int, initial: int = -1) -> void:
	_view = view
	seat = owner
	_picked.clear()
	_page = 0
	var squares: Array[int] = Rules.mortgage_squares(view["properties"], owner)
	if initial in squares:
		_picked.append(initial)
		_page = floori(squares.find(initial) / float(ROWS))
	visible = true
	_show()


## Keeps the open board in step with a new view: a deed may have gone or been mortgaged.
func update(view: Dictionary) -> void:
	_view = view
	if visible:
		_show()


## The squares picked now, in board order.
func picked() -> Array[int]:
	var out: Array[int] = _picked.duplicate()
	out.sort()
	return out


## What the picked squares bring together.
func total() -> int:
	var sum: int = 0
	for square: int in _picked:
		sum += Rules.mortgage_amount(_view["properties"], square)
	return sum


func _turn(by: int) -> void:
	_page += by
	_show()


func _toggle(square: int) -> void:
	if square in _picked:
		_picked.erase(square)
	else:
		_picked.append(square)
	_show()


func _show() -> void:
	var properties: Array = _view["properties"]
	var squares: Array[int] = Rules.mortgage_squares(properties, seat)
	for square: int in _picked.duplicate():
		if square not in squares:
			_picked.erase(square)
	var pages: int = maxi(1, ceili(squares.size() / float(ROWS)))
	_page = clampi(_page, 0, pages - 1)
	_page_label.text = "%d / %d" % [_page + 1, pages]
	_page_label.visible = pages > 1
	_previous.visible = pages > 1
	_next.visible = pages > 1
	_previous.disabled = _page == 0
	_next.disabled = _page + 1 >= pages
	for row: Node in _list.get_children():
		_list.remove_child(row)
		row.queue_free()
	for square: int in squares.slice(_page * ROWS, (_page + 1) * ROWS):
		_list.add_child(_row(square, int(properties[square]["houses"])))
	var sum: int = total()
	_total.text = "%d tài sản · Nhận %s ₫" % [_picked.size(), XomDaoUi.money(sum)]
	_confirm.text = "Xác nhận +%s ₫" % XomDaoUi.money(sum)
	_confirm.disabled = _picked.is_empty()


## One deed: a tick when picked, its name and buildings, and what it brings.
func _row(square: int, houses: int) -> Button:
	var picked_now: bool = square in _picked
	var row := Button.new()
	row.name = "MortgageRow_%d" % square
	row.focus_mode = Control.FOCUS_NONE
	row.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	row.custom_minimum_size.y = ROW_HEIGHT
	var fill: Color = Color("#FFE0A0") if picked_now else Color("#FFFDF4")
	var edge: Color = XomDaoUi.HONEY_DARK if picked_now else XomDaoUi.PAPER_DARK
	var style: StyleBoxFlat = XomDaoUi.box(fill, edge, 2, 12.0)
	for state: String in ["normal", "hover", "pressed", "hover_pressed"]:
		row.add_theme_stylebox_override(state, style)
	row.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	row.pressed.connect(_toggle.bind(square))
	row.button_down.connect(func() -> void: XomDaoUi.play(row, XomDaoUi.SOUND_TAP))
	var line := HBoxContainer.new()
	line.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	line.offset_left = 14.0
	line.offset_right = -18.0
	line.add_theme_constant_override("separation", 12)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(line)
	var tick := TextureRect.new()
	tick.texture = XomDaoUi.icon("check-circle")
	tick.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tick.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tick.custom_minimum_size = Vector2(36.0, 36.0)
	tick.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	tick.modulate = XomDaoUi.GEM_DARK if picked_now else Color(XomDaoUi.INK, 0.18)
	line.add_child(tick)
	var title: Label = _label(str(Rules.SQUARES[square]["name"]), XomDaoUi.TEXT_MIN, XomDaoUi.INK)
	line.add_child(title)
	var detail: Label = _label(detail_of(square, houses), XomDaoUi.TEXT_MIN, XomDaoUi.HONEY_DARK)
	detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	line.add_child(detail)
	var amount: int = Rules.mortgage_amount(_view["properties"], square)
	line.add_child(_label("+%s ₫" % XomDaoUi.money(amount), XomDaoUi.TEXT_MIN, Color("#875020")))
	for child: Node in line.get_children():
		(child as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
	return row


## "Khách sạn", "2 nhà", "Bến xe" or "Đất trống".
static func detail_of(square: int, houses: int) -> String:
	if houses == 5:
		return "Khách sạn"
	if houses > 0:
		return "%d nhà" % houses
	match str(Rules.SQUARES[square]["kind"]):
		"station":
			return "Bến xe"
		"utility":
			return "Tiện ích"
	return "Đất trống"


func _on_confirm() -> void:
	if _picked.is_empty():
		return
	chosen.emit(picked())
	hide()


func _label(text: String, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	_style(label, font_size, color)
	return label


func _style(label: Label, font_size: int, color: Color) -> void:
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
