class_name HubTransition
extends Control
## The curtain between two screens of the hub. A slanted navy sheet with a gold edge sweeps in
## from the left over the screen being left, shows where the player is going (the place's name,
## or a game's logo over its name), and sweeps out to the right off the new screen. `covered`
## fires at the moment nothing shows through: the hub swaps the screens then. FADE is the plain
## version, a dip to navy, for the last step into a game.
##
##   transition.play("Chọn trò")                       # a place
##   transition.play("Tiến Lên", logo)                 # a game's room
##   transition.play("", null, HubTransition.Style.FADE)
##   transition.covered.connect(...)                   # swap the screens here

signal covered

enum Style { SWEEP, FADE }

const IN := 0.26
const HOLD := 0.16
const OUT := 0.3
const SLANT := 150.0
const EDGE := 34.0

## True from play() until the curtain is gone.
var running: bool = false

var _style: Style = Style.SWEEP
var _title: String = ""
var _logo: Texture2D
var _tween: Tween
## 0: not there; 1: covering everything; 2: gone again.
var _at: float = 0.0:
	set(value):
		_at = value
		# Taps reach the new screen as soon as it shows.
		mouse_filter = Control.MOUSE_FILTER_STOP if value < 1.0 else Control.MOUSE_FILTER_IGNORE
		queue_redraw()


func _init() -> void:
	name = "Transition"
	visible = false
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS


## Draws the curtain over the screen. One already on its way in only takes the new words; one
## already covering or leaving covers again at once, so `covered` fires for this call too.
func play(title: String = "", logo: Texture2D = null, style: Style = Style.SWEEP) -> void:
	_title = title
	_logo = logo
	if running and _at < 1.0:
		queue_redraw()
		return
	if _tween != null:
		_tween.kill()
	var again: bool = running
	_style = style
	running = true
	visible = true
	_tween = create_tween()
	if again:
		_at = 1.0
		_tween.tween_callback(covered.emit)
	else:
		_at = 0.0
		_tween.tween_property(self, "_at", 1.0, IN).set_trans(Tween.TRANS_CUBIC).set_ease(
			Tween.EASE_OUT
		)
		_tween.tween_callback(covered.emit)
	_tween.tween_interval(HOLD)
	_tween.tween_property(self, "_at", 2.0, OUT).set_trans(Tween.TRANS_CUBIC).set_ease(
		Tween.EASE_IN
	)
	_tween.tween_callback(_end)


func _end() -> void:
	running = false
	visible = false


func _draw() -> void:
	var w: float = size.x
	var h: float = size.y
	if _style == Style.FADE:
		draw_rect(Rect2(0, 0, w, h), Color(XomDaoUi.NAVY, 1.0 - absf(_at - 1.0)))
		return
	# The sheet's left and right edges at mid height; both lean by SLANT.
	var far: float = w + SLANT + EDGE
	var left: float = -SLANT - EDGE if _at <= 1.0 else lerpf(-SLANT - EDGE, far, _at - 1.0)
	var right: float = lerpf(-SLANT - EDGE, far, _at) if _at <= 1.0 else far
	_sheet(left - EDGE, right + EDGE, XomDaoUi.SUN)
	_sheet(left, right, XomDaoUi.NAVY)
	# The words show while the sheet covers the middle.
	var alpha: float = clampf(1.0 - absf(_at - 1.0) * 2.4, 0.0, 1.0)
	if alpha <= 0.0:
		return
	var font: Font = XomDaoUi.display_font(800)
	var middle := Vector2(w / 2.0, h / 2.0)
	if _logo != null:
		var side: float = 150.0
		draw_texture_rect(
			_logo,
			Rect2(middle.x - side / 2.0, middle.y - side + 6.0, side, side),
			false,
			Color(1, 1, 1, alpha)
		)
		middle.y += 50.0
	draw_string(
		font,
		Vector2(0.0, middle.y + 20.0),
		_title,
		HORIZONTAL_ALIGNMENT_CENTER,
		w,
		56,
		Color(XomDaoUi.CREAM, alpha)
	)


func _sheet(left: float, right: float, color: Color) -> void:
	if right <= left:
		return
	draw_colored_polygon(
		PackedVector2Array(
			[
				Vector2(left + SLANT, 0.0),
				Vector2(right + SLANT, 0.0),
				Vector2(right - SLANT, size.y),
				Vector2(left - SLANT, size.y),
			]
		),
		color
	)
