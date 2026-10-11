class_name XomDaoIconButton
extends Button
## A round HUD button with one icon: a raised dark disc (XomDaoPuff), cream icon, 88 × 88.
##
##   var menu := XomDaoIconButton.create("list")   # a Phosphor Fill icon name
##   menu.dot = true                               # the red dot of something new

const SIZE := 88.0
const ICON := 48
const DEPTH := 5.0

## Shows the red dot on the button.
var dot: bool = false:
	set(value):
		dot = value
		if value:
			XomDaoDot.attach(self)
		elif has_node("Dot"):
			get_node("Dot").queue_free()

## The disc's colour (the lobby's navy HUD sets its own).
var background: Color = XomDaoUi.HUD:
	set(value):
		background = value
		_restyle()

var icon_name: String = "":
	set(value):
		icon_name = value
		icon = XomDaoUi.icon(value) if value != "" else null

var _body: XomDaoPuff


static func create(name_of_icon: String) -> XomDaoIconButton:
	var button := XomDaoIconButton.new()
	button.icon_name = name_of_icon
	return button


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	custom_minimum_size = Vector2(SIZE, SIZE)
	expand_icon = true
	icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vertical_icon_alignment = VERTICAL_ALIGNMENT_CENTER
	_body = XomDaoPuff.behind(self)
	background = XomDaoUi.HUD
	add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		add_theme_color_override(state, XomDaoUi.CREAM)
	add_theme_color_override("icon_disabled_color", Color(XomDaoUi.CREAM, 0.4))


func _restyle() -> void:
	if _body == null:
		return
	_body.face = background
	_body.edge = Color(background.darkened(0.3), background.a)
	_body.border = 2
	_body.radius = SIZE / 2.0
	_body.depth = DEPTH
	var pad: float = (SIZE - ICON) / 2.0
	var normal := StyleBoxEmpty.new()
	normal.set_content_margin_all(pad)
	normal.content_margin_top = pad - DEPTH / 2.0
	normal.content_margin_bottom = pad + DEPTH / 2.0
	var pressed: StyleBoxEmpty = normal.duplicate()
	pressed.content_margin_top = pad
	pressed.content_margin_bottom = pad
	for state: String in ["normal", "hover", "disabled"]:
		add_theme_stylebox_override(state, normal)
	add_theme_stylebox_override("pressed", pressed)
	add_theme_stylebox_override("hover_pressed", pressed)


func _ready() -> void:
	button_down.connect(_on_down)


func _on_down() -> void:
	XomDaoUi.bounce(self)
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
