class_name XomDaoButton
extends Button
## A text button coloured by what it does (XomDaoUi.Kind): a raised body (XomDaoPuff: a face on
## a darker lip, lit from above, a short dense shadow) with a cream label. PLAY is the one big
## lacquer button; HOME_PLAY the lobby's gold CHƠI (ink label).
##
##   var play := XomDaoButton.create("CHƠI", XomDaoUi.Kind.PLAY)
##   var leave := XomDaoButton.create("Rời phòng", XomDaoUi.Kind.DANGER)
## It bounces and plays the tap sound when pressed; the face sinks onto its lip.

const HEIGHT := 88.0
const PLAY_HEIGHT := 120.0

@export var kind: XomDaoUi.Kind = XomDaoUi.Kind.GO:
	set(value):
		kind = value
		_restyle()

## Space left and right of the label (0 keeps the kind's own).
var pad: float = 0.0:
	set(value):
		pad = value
		_restyle()

## The raised body behind the label.
var body: XomDaoPuff


static func create(label: String, button_kind: XomDaoUi.Kind = XomDaoUi.Kind.GO) -> XomDaoButton:
	var button := XomDaoButton.new()
	button.text = label
	button.kind = button_kind
	return button


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	body = XomDaoPuff.behind(self)
	_restyle()


func _ready() -> void:
	button_down.connect(_on_down)


func _on_down() -> void:
	XomDaoUi.bounce(self)
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)


func _restyle() -> void:
	if body == null:
		return
	var play: bool = kind == XomDaoUi.Kind.PLAY
	var home_play: bool = kind == XomDaoUi.Kind.HOME_PLAY
	var text: Color = XomDaoUi.kind_text(kind)
	var colors: Array[Color] = XomDaoUi.kind_colors(kind)
	body.face = colors[0]
	body.edge = colors[1]
	body.border = 4 if play else XomDaoUi.BORDER
	body.radius = 36.0 if play else 22.0
	body.depth = XomDaoPuff.DEPTH + 2.0 if play else XomDaoPuff.DEPTH
	var side: float = pad if pad > 0.0 else (48.0 if play else 28.0)
	# The label sits on the face, which stands `depth` off the bottom; pressed, both sink.
	var sunk: float = body.depth - 2.0
	var normal := StyleBoxEmpty.new()
	normal.content_margin_left = side
	normal.content_margin_right = side
	normal.content_margin_top = 2.0
	normal.content_margin_bottom = body.depth + 4.0
	var pressed: StyleBoxEmpty = normal.duplicate()
	pressed.content_margin_top = 2.0 + sunk
	pressed.content_margin_bottom = body.depth + 4.0 - sunk
	for state: String in ["normal", "hover", "disabled"]:
		add_theme_stylebox_override(state, normal)
	add_theme_stylebox_override("pressed", pressed)
	add_theme_stylebox_override("hover_pressed", pressed)
	add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	add_theme_font_override("font", XomDaoUi.display_font(800))
	add_theme_font_size_override("font_size", 48 if play else (40 if home_play else 32))
	for state: String in ["font_color", "font_hover_color", "font_pressed_color"]:
		add_theme_color_override(state, text)
	add_theme_color_override("font_outline_color", Color(colors[1].darkened(0.25), 0.85))
	add_theme_constant_override("outline_size", 4)
	add_theme_color_override("font_disabled_color", Color(text, 0.6))
	add_theme_constant_override("h_separation", 12)
	add_theme_constant_override("icon_max_width", 40)
	add_theme_color_override("icon_normal_color", text)
	add_theme_color_override("icon_hover_color", text)
	add_theme_color_override("icon_pressed_color", text)
	add_theme_color_override("icon_disabled_color", Color(text, 0.6))
	custom_minimum_size.y = PLAY_HEIGHT if play else HEIGHT
	if play and size.x < 280.0:
		custom_minimum_size.x = 280.0
