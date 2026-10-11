class_name XomDaoChoice
extends HBoxContainer
## One choice among a few options on a row (players, a rule, a setting): the chosen option is
## dark with cream text, the others light on the paper. Every option is a full touch target.
##
##   var seats := XomDaoChoice.create(["2", "3", "4"], 2)
##   seats.changed.connect(func(index: int) -> void: ...)
## `locked` shows the choice without letting it change; `compact` makes a shorter row for a
## crowded panel; `fill` shares the row's whole width between the options, as segments.

signal changed(index: int)

const HEIGHT := 88.0
const COMPACT_HEIGHT := 64.0

var options: Array[String] = []:
	set(value):
		options = value
		_rebuild()

var selected: int = 0:
	set(value):
		selected = clampi(value, 0, maxi(0, options.size() - 1))
		_restyle()

## Shown, not changed: taps do nothing and the options not chosen fade.
var locked: bool = false:
	set(value):
		locked = value
		_restyle()

## A shorter row with smaller text.
var compact: bool = false:
	set(value):
		compact = value
		_rebuild()

## The options share the row's width equally instead of hugging their text.
var fill: bool = false:
	set(value):
		fill = value
		_rebuild()


static func create(labels: Array[String], chosen: int = 0) -> XomDaoChoice:
	var choice := XomDaoChoice.new()
	choice.options = labels
	choice.selected = chosen
	return choice


func _init() -> void:
	add_theme_constant_override("separation", 8)


## Chooses an option as if the player tapped it (emits `changed` when it changes).
func choose(index: int) -> void:
	if index == selected or index < 0 or index >= options.size():
		return
	selected = index
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	changed.emit(index)


func _rebuild() -> void:
	for child: Node in get_children():
		remove_child(child)
		child.queue_free()
	for i: int in options.size():
		var option := Button.new()
		option.text = options[i]
		option.focus_mode = Control.FOCUS_NONE
		var side: float = COMPACT_HEIGHT if compact else HEIGHT
		option.custom_minimum_size = Vector2(0.0 if fill else side, side)
		if fill:
			option.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		option.add_theme_font_override("font", XomDaoUi.display_font(800))
		option.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN if compact else 28)
		option.pressed.connect(choose.bind(i))
		add_child(option)
	selected = selected


func _restyle() -> void:
	for i: int in get_child_count():
		var option: Button = get_child(i)
		var on: bool = i == selected
		option.disabled = locked
		option.modulate.a = 0.5 if locked and not on else 1.0
		option.mouse_default_cursor_shape = (
			Control.CURSOR_ARROW if locked else Control.CURSOR_POINTING_HAND
		)
		var fill: Color = XomDaoUi.SEA_DEEP if on else XomDaoUi.PAPER
		var edge: Color = Color("#14687A") if on else XomDaoUi.PAPER_DARK
		var style: StyleBoxFlat = XomDaoUi.box(fill, edge, XomDaoUi.BORDER, 20.0)
		style.content_margin_left = 14.0
		style.content_margin_right = 14.0
		var hover: StyleBoxFlat = style.duplicate()
		hover.bg_color = fill.lightened(0.08) if on else fill.darkened(0.04)
		for state: String in ["normal", "pressed", "hover_pressed", "disabled"]:
			option.add_theme_stylebox_override(state, style)
		option.add_theme_stylebox_override("hover", hover)
		option.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
		var text: Color = XomDaoUi.CREAM if on else XomDaoUi.INK
		for state: String in [
			"font_color", "font_hover_color", "font_pressed_color", "font_disabled_color"
		]:
			option.add_theme_color_override(state, text)
