class_name HubRoomOption
extends VBoxContainer
## One of a game's room options on the waiting room's plate, drawn as what suits it, so a row
## never grows wider than the plate:
## - SWITCH: an off/on pair (Tắt/Bật) is a switch beside its name;
## - STEPPER: numbers (seats for the computer, rounds, seconds) are − value +, which stops at
##   both ends;
## - SEGMENTS: a few short words share the row as segments (XomDaoChoice);
## - PICKER: anything too long for that is ‹ value ›, one at a time, round and round.
## The control itself is named Option_<key>; `selected` is the index of the option picked.
##
##   var row := HubRoomOption.create(option, 412.0)   # a `room_setup()` row, the plate's width
##   row.changed.connect(func(index: int) -> void: ...)
##   row.locked = true                                # shown, not changed (a guest)

signal changed(index: int)

enum Kind { SWITCH, STEPPER, SEGMENTS, PICKER }

const HEIGHT := 60.0
const ARROW := 56.0
const SWITCH_SIZE := Vector2(100.0, 52.0)
const ON_WORDS: Array[String] = ["Bật", "Có"]
const OFF_WORDS: Array[String] = ["Tắt", "Không"]

var kind: Kind = Kind.SEGMENTS

var selected: int = 0:
	set(value):
		selected = clampi(value, 0, maxi(0, _labels.size() - 1))
		_show()

## Shown, not changed.
var locked: bool = false:
	set(value):
		locked = value
		_show()

var _labels: Array[String] = []
var _segments: XomDaoChoice
var _value: Label
var _previous: Button
var _next: Button
var _switch: Button
## 0 (off) to 1 (on): where the switch's knob is.
var _knob: float = 0.0:
	set(value):
		_knob = value
		if _switch != null:
			_switch.queue_redraw()


## What suits an option: its values and how much room its words need out of `width`.
static func kind_of(option: Dictionary, width: float) -> Kind:
	var pairs: Array = option.get("options", [])
	var numbers: bool = not pairs.is_empty()
	var needed: float = maxf(0, pairs.size() - 1) * 8.0
	var font: Font = XomDaoUi.display_font(800)
	for pair: Variant in pairs:
		numbers = numbers and (pair[1] is int or pair[1] is float)
		var text: float = (
			font.get_string_size(str(pair[0]), HORIZONTAL_ALIGNMENT_LEFT, -1, XomDaoUi.TEXT_MIN).x
		)
		needed += text + 34.0
	if pairs.size() == 2 and pairs[0][1] is bool and pairs[1][1] is bool:
		var off: int = 0 if pairs[0][1] == false else 1
		if OFF_WORDS.has(str(pairs[off][0])) and ON_WORDS.has(str(pairs[1 - off][0])):
			return Kind.SWITCH
	if numbers and pairs.size() > 2:
		return Kind.STEPPER
	return Kind.SEGMENTS if needed <= width else Kind.PICKER


static func create(option: Dictionary, width: float) -> HubRoomOption:
	var row := HubRoomOption.new()
	row._build(option, width)
	return row


func _init() -> void:
	add_theme_constant_override("separation", 4)


## Picks an option as if the player did (emits `changed` when it changes).
func choose(index: int) -> void:
	if locked or index == selected or index < 0 or index >= _labels.size():
		return
	selected = index
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	changed.emit(index)


func _build(option: Dictionary, width: float) -> void:
	var key: String = str(option.get("key", ""))
	name = "Row_" + key
	kind = kind_of(option, width)
	for pair: Variant in option.get("options", []):
		_labels.append(str(pair[0]))
	var title := Label.new()
	title.text = str(option.get("label", ""))
	title.theme_type_variation = "SmallLabel"
	title.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.75))
	var control: Control
	match kind:
		Kind.SWITCH:
			control = _build_switch(option)
		Kind.SEGMENTS:
			_segments = XomDaoChoice.create(_labels)
			_segments.compact = true
			_segments.fill = true
			_segments.changed.connect(_on_segment)
			control = _segments
		_:
			control = _build_stepper()
	control.name = "Option_" + key
	# A switch or a stepper sits beside the name when both fit on one line.
	var beside: bool = kind == Kind.SWITCH or kind == Kind.STEPPER
	var title_w: float = (
		title
		. get_theme_font("font")
		. get_string_size(title.text, HORIZONTAL_ALIGNMENT_LEFT, -1, XomDaoUi.TEXT_MIN)
		. x
	)
	if beside and title_w + 16.0 + control.get_combined_minimum_size().x <= width:
		var line := HBoxContainer.new()
		line.add_theme_constant_override("separation", 16)
		title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		line.add_child(title)
		control.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		line.add_child(control)
		add_child(line)
	else:
		add_child(title)
		if kind != Kind.SWITCH:
			control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		else:
			control.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		add_child(control)
	_show()


## − value + for numbers (stops at the ends), ‹ value › for words (goes round).
func _build_stepper() -> Control:
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 8)
	var numbers: bool = kind == Kind.STEPPER
	_previous = _arrow("−" if numbers else "‹")
	_previous.pressed.connect(_step.bind(-1))
	line.add_child(_previous)
	var pill := PanelContainer.new()
	pill.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pill.custom_minimum_size = Vector2(0.0, ARROW)
	var box: StyleBoxFlat = XomDaoUi.box(XomDaoUi.SEA_DEEP, Color("#14687A"), XomDaoUi.BORDER, 18.0)
	box.content_margin_left = 14.0
	box.content_margin_right = 14.0
	pill.add_theme_stylebox_override("panel", box)
	_value = Label.new()
	_value.add_theme_font_override("font", XomDaoUi.display_font(800))
	_value.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_value.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_value.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_value.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	# Wide enough for its longest value, so the arrows stay where they are.
	var widest: float = 0.0
	for text: String in _labels:
		widest = maxf(
			widest,
			(
				XomDaoUi
				. display_font(800)
				. get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, XomDaoUi.TEXT_MIN)
				. x
			)
		)
	_value.custom_minimum_size.x = maxf(widest, 56.0) if numbers else 0.0
	_value.autowrap_mode = TextServer.AUTOWRAP_OFF if numbers else TextServer.AUTOWRAP_WORD_SMART
	pill.add_child(_value)
	line.add_child(pill)
	_next = _arrow("+" if numbers else "›")
	_next.pressed.connect(_step.bind(1))
	line.add_child(_next)
	return line


func _arrow(glyph: String) -> Button:
	var button := Button.new()
	button.text = glyph
	button.focus_mode = Control.FOCUS_NONE
	button.custom_minimum_size = Vector2(ARROW, ARROW)
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.add_theme_font_override("font", XomDaoUi.display_font(800))
	button.add_theme_font_size_override("font_size", 34)
	var plain: StyleBoxFlat = XomDaoUi.box(
		XomDaoUi.PAPER, XomDaoUi.PAPER_DARK, XomDaoUi.BORDER, 18.0
	)
	var over: StyleBoxFlat = plain.duplicate()
	over.bg_color = XomDaoUi.PAPER.darkened(0.05)
	for state: String in ["normal", "pressed", "hover_pressed", "disabled"]:
		button.add_theme_stylebox_override(state, plain)
	button.add_theme_stylebox_override("hover", over)
	for state: String in [
		"font_color", "font_hover_color", "font_pressed_color", "font_disabled_color"
	]:
		button.add_theme_color_override(state, XomDaoUi.INK)
	return button


func _build_switch(option: Dictionary) -> Control:
	_switch = Button.new()
	_switch.focus_mode = Control.FOCUS_NONE
	_switch.custom_minimum_size = SWITCH_SIZE
	_switch.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		_switch.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	_switch.draw.connect(_draw_switch)
	# Index 1 is "on" for [off, on]; the other way round for [on, off].
	var pairs: Array = option.get("options", [])
	var on: int = 1 if pairs[1][1] == true else 0
	_switch.set_meta("on", on)
	_switch.pressed.connect(func() -> void: choose(1 - selected))
	return _switch


func _draw_switch() -> void:
	var box := Rect2(Vector2.ZERO, _switch.size)
	var off_color: Color = XomDaoUi.PAPER_DARK
	var track: StyleBoxFlat = XomDaoUi.box(
		off_color.lerp(XomDaoUi.BAMBOO, _knob),
		XomDaoUi.HONEY_DARK.lerp(XomDaoUi.BAMBOO_DARK, _knob),
		XomDaoUi.BORDER,
		box.size.y / 2.0
	)
	_switch.draw_style_box(track, box)
	var r: float = box.size.y / 2.0 - 7.0
	var at := Vector2(
		lerpf(box.size.y / 2.0, box.size.x - box.size.y / 2.0, _knob), box.size.y / 2.0
	)
	_switch.draw_circle(at + Vector2(0.0, 2.0), r, XomDaoPuff.SHADE, true, -1.0, true)
	_switch.draw_circle(at, r, XomDaoUi.CREAM, true, -1.0, true)


func _on_segment(index: int) -> void:
	if locked:
		_segments.selected = selected
		return
	selected = index
	changed.emit(index)


func _step(direction: int) -> void:
	var count: int = _labels.size()
	if kind == Kind.STEPPER:
		choose(clampi(selected + direction, 0, count - 1))
	elif count > 0:
		choose(posmod(selected + direction, count))


func _show() -> void:
	modulate.a = 1.0
	if _segments != null:
		_segments.selected = selected
		_segments.locked = locked
	if _value != null:
		_value.text = _labels[selected] if selected < _labels.size() else ""
		var ends: bool = kind == Kind.STEPPER
		_previous.disabled = locked or (ends and selected <= 0)
		_next.disabled = locked or (ends and selected >= _labels.size() - 1)
		for arrow: Button in [_previous, _next]:
			arrow.modulate.a = 0.4 if arrow.disabled else 1.0
	if _switch != null:
		_switch.disabled = locked
		_switch.modulate.a = 0.6 if locked else 1.0
		var on: float = 1.0 if selected == int(_switch.get_meta("on")) else 0.0
		if is_inside_tree() and not is_equal_approx(on, _knob):
			create_tween().tween_property(self, "_knob", on, 0.12)
		else:
			_knob = on
