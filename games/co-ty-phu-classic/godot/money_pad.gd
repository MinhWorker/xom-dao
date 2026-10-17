extends Control
## A cash pile opens a small tactile numeric pad, without form fields.

signal chosen(amount: int)
const Ui := preload("res://content/co-ty-phu-classic/ledger_ui.gd")
var amount: int = 0
var maximum: int = 100000
var _fresh: bool = true
var _digits: Label
var _panel := PanelContainer.new()


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.color = Color(XomDaoUi.NAVY, 0.85)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	Ui.paper(_panel, XomDaoUi.PAPER, XomDaoUi.GOLD)
	add_child(_panel)
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 12)
	_panel.add_child(stack)
	_digits = Ui.label(XomDaoUi.money(amount), 42)
	_digits.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stack.add_child(_digits)
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	stack.add_child(grid)
	for value: String in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"]:
		var button: XomDaoButton = Ui.button(value, "MoneyKey_" + value)
		if value in ["⌫", "✓"]:
			button.text = ""
			button.icon = XomDaoUi.icon("arrow-left" if value == "⌫" else "check-circle")
		if value != "✓":
			Ui.flat(button)
			for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
				button.add_theme_color_override(state, Ui.INK_DARK)
		button.custom_minimum_size = Vector2(92, 88)
		button.pressed.connect(_key.bind(value))
		grid.add_child(button)
	var close: XomDaoButton = Ui.button("Hủy", "MoneyCancel", XomDaoUi.Kind.BACK)
	Ui.flat(close)
	close.pressed.connect(queue_free)
	stack.add_child(close)
	resized.connect(_arrange)
	_arrange.call_deferred()


func _arrange() -> void:
	_panel.reset_size()
	_panel.position = (size - _panel.size) / 2.0


func _key(value: String) -> void:
	if value == "✓":
		chosen.emit(amount)
		queue_free()
		return
	if _fresh and value != "⌫":
		amount = 0
	_fresh = false
	amount = amount / 10 if value == "⌫" else mini(maximum, amount * 10 + int(value))
	_digits.text = XomDaoUi.money(amount)
