class_name HubNavButton
extends Button
## One place on the lobby's dock: its picture (`hub/lobby/nav-<art>.webp`, or a Phosphor icon
## until it has one) over its name. The place the player is in sits on a raised gold plate and
## its picture bobs; the others lift under the pointer and squash when pressed.
##
##   var cho := HubNavButton.create("Chợ", "nav-cho", "storefront")
##   cho.selected = true
##   cho.enter(0.1)          # slides in from the left after 0.1 s

const SIZE := Vector2(128.0, 122.0)
const ICON := Vector2(84.0, 64.0)
const DIR := "res://hub/lobby/"

var label: String = "":
	set(value):
		label = value
		_art.queue_redraw()

var selected: bool = false:
	set(value):
		selected = value
		set_process(value)
		_art.queue_redraw()

var _art := Control.new()
var _picture: Texture2D
var _tinted: bool = false
var _time: float = 0.0
## 0 to 1: how far the picture is lifted (hover).
var _lift: float = 0.0:
	set(value):
		_lift = value
		_art.queue_redraw()


static func create(place_name: String, art: String, icon_name: String) -> HubNavButton:
	var button := HubNavButton.new()
	button.label = place_name
	var path: String = DIR + art + ".webp"
	if ResourceLoader.exists(path):
		button._picture = load(path)
	else:
		button._picture = XomDaoUi.icon(icon_name)
		button._tinted = true
	return button


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	custom_minimum_size = SIZE
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_art.draw.connect(_draw_art)
	add_child(_art)
	draw.connect(_art.queue_redraw)
	mouse_entered.connect(_hover.bind(true))
	mouse_exited.connect(_hover.bind(false))
	button_down.connect(_squash)
	set_process(false)


func _process(delta: float) -> void:
	_time += delta
	_art.queue_redraw()


## Slides in from the left and fades in, `delay` seconds from now.
func enter(delay: float) -> void:
	_art.modulate.a = 0.0
	_art.position.x = -48.0
	var tween: Tween = create_tween().set_parallel()
	tween.tween_property(_art, "modulate:a", 1.0, 0.2).set_delay(delay)
	(
		tween
		. tween_property(_art, "position:x", 0.0, 0.36)
		. set_delay(delay)
		. set_trans(Tween.TRANS_BACK)
		. set_ease(Tween.EASE_OUT)
	)


func _hover(over: bool) -> void:
	create_tween().tween_property(self, "_lift", 1.0 if over else 0.0, 0.14).set_trans(
		Tween.TRANS_SINE
	)


## Pressed: wide and short, then tall and narrow, then itself again.
func _squash() -> void:
	_art.pivot_offset = Vector2(size.x / 2.0, size.y)
	var tween: Tween = create_tween()
	tween.tween_property(_art, "scale", Vector2(1.08, 0.88), 0.07)
	tween.tween_property(_art, "scale", Vector2(0.96, 1.06), 0.1)
	tween.tween_property(_art, "scale", Vector2.ONE, 0.14).set_trans(Tween.TRANS_BACK)


func _draw_art() -> void:
	var box: Vector2 = _art.size
	var down: bool = get_draw_mode() == DRAW_PRESSED or get_draw_mode() == DRAW_HOVER_PRESSED
	if selected:
		XomDaoPuff.paint(
			_art,
			Rect2(4.0, 2.0, box.x - 8.0, box.y - 4.0),
			XomDaoUi.SUN,
			XomDaoUi.GOLD_DARK,
			24.0,
			XomDaoPuff.DEPTH,
			down
		)
	elif _lift > 0.0:
		var glow: StyleBoxFlat = XomDaoUi.box(
			Color(XomDaoUi.NAVY_LINE, 0.4 * _lift), Color.TRANSPARENT, 0, 24.0
		)
		_art.draw_style_box(glow, Rect2(4.0, 2.0, box.x - 8.0, box.y - 4.0))
	# The picture: bobbing where the player is, lifted under the pointer.
	var rise: float = _lift * 5.0
	if selected:
		rise += 2.0 + sin(_time * 2.6) * 2.5
	var k: float = minf(ICON.x / _picture.get_width(), ICON.y / _picture.get_height())
	k *= 1.0 + 0.06 * _lift
	var drawn: Vector2 = _picture.get_size() * k
	var at := Vector2((box.x - drawn.x) / 2.0, 10.0 + (ICON.y - drawn.y) / 2.0 - rise)
	# Its shadow stays on the ground, and shrinks as it rises.
	var ground := Vector2(box.x / 2.0, 10.0 + ICON.y + 1.0)
	var spread: float = 26.0 - rise * 0.8
	_art.draw_set_transform(ground, 0.0, Vector2(1.0, 0.28))
	_art.draw_circle(Vector2.ZERO, spread, Color(0.0, 0.0, 0.0, 0.2), true, -1.0, true)
	_art.draw_set_transform(Vector2.ZERO)
	var tint: Color = Color.WHITE
	if _tinted:
		tint = XomDaoUi.INK if selected else XomDaoUi.CREAM
	_art.draw_texture_rect(_picture, Rect2(at, drawn), false, tint)
	var font: Font = XomDaoUi.display_font(800)
	var font_size: int = XomDaoUi.TEXT_MIN
	var line := Vector2(0.0, box.y - 13.0 - (XomDaoPuff.DEPTH if selected and not down else 4.0))
	if not selected:
		_art.draw_string_outline(
			font, line, label, HORIZONTAL_ALIGNMENT_CENTER, box.x, font_size, 6, XomDaoUi.NAVY
		)
	_art.draw_string(
		font,
		line,
		label,
		HORIZONTAL_ALIGNMENT_CENTER,
		box.x,
		font_size,
		XomDaoUi.INK if selected else XomDaoUi.CREAM
	)
