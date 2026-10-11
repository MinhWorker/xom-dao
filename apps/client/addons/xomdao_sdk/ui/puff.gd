class_name XomDaoPuff
extends Control
## The raised body of a button: a face sitting on a darker lip, lit from above (a pale gloss on
## its upper half, a thin rim of light under its top edge) with a short dense shadow below.
## Pressed, the face sinks onto the lip. A button adds one behind its label:
##
##   var body := XomDaoPuff.behind(self)     # a BaseButton: the body follows its state
##   body.face = XomDaoUi.SUN
##   body.edge = XomDaoUi.GOLD_DARK
## Anything else draws one with XomDaoPuff.paint(canvas_item, rect, face, edge, …).

## How far the face stands off the lip, in units.
const DEPTH := 7.0
const SHADE := Color(0.165, 0.094, 0.047, 0.42)

var face: Color = XomDaoUi.LACQUER:
	set(value):
		face = value
		queue_redraw()

## The border of the face; the lip is a darker shade of it.
var edge: Color = XomDaoUi.LACQUER_DARK:
	set(value):
		edge = value
		queue_redraw()

var radius: float = 22.0:
	set(value):
		radius = value
		queue_redraw()

var depth: float = DEPTH:
	set(value):
		depth = value
		queue_redraw()

var border: int = XomDaoUi.BORDER:
	set(value):
		border = value
		queue_redraw()

## Whether the face catches the light (gloss, rim, shade). Off: a plain face on its lip.
var lit: bool = true:
	set(value):
		lit = value
		queue_redraw()

## 0 to 1: a band of light crossing the face from left to right (1 = gone past).
var shine: float = 1.0:
	set(value):
		shine = value
		queue_redraw()

var _button: BaseButton


## Puts a body behind `button`'s label and icon; it redraws with the button's state.
static func behind(button: BaseButton) -> XomDaoPuff:
	var body := XomDaoPuff.new()
	body.name = "Body"
	body._button = button
	body.show_behind_parent = true
	body.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	button.add_child(body, false, Node.INTERNAL_MODE_FRONT)
	button.draw.connect(body.queue_redraw)
	return body


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


## Sweeps the band of light across once.
func sweep(seconds: float = 0.7) -> void:
	shine = 0.0
	create_tween().tween_property(self, "shine", 1.0, seconds).set_trans(Tween.TRANS_SINE)


func _draw() -> void:
	var down: bool = false
	var hover: bool = false
	var off: bool = false
	if _button != null:
		var mode: int = _button.get_draw_mode()
		down = mode == BaseButton.DRAW_PRESSED or mode == BaseButton.DRAW_HOVER_PRESSED
		hover = mode == BaseButton.DRAW_HOVER
		off = mode == BaseButton.DRAW_DISABLED
	var fill: Color = face.lightened(0.08) if hover else face
	var line: Color = edge
	if off:
		fill = _grey(fill)
		line = _grey(line)
	XomDaoPuff.paint(
		self, Rect2(Vector2.ZERO, size), fill, line, radius, depth, down, border, off, lit
	)
	if shine < 1.0 and not down and not off:
		_draw_shine()


func _draw_shine() -> void:
	# Kept clear of the round corners, so it needs no clipping.
	var left: float = radius * 0.7
	var right: float = size.x - radius * 0.7
	var band: float = minf(46.0, (right - left) * 0.3)
	var x: float = lerpf(left, right - band, shine)
	var top: float = border + 2.0
	var bottom: float = size.y - depth - border - 2.0
	var lean: float = minf(14.0, band * 0.4)
	var glow := Color(1.0, 1.0, 1.0, 0.34 * sin(shine * PI))
	draw_colored_polygon(
		PackedVector2Array(
			[
				Vector2(x + lean, top),
				Vector2(x + lean + band, top),
				Vector2(x + band, bottom),
				Vector2(x, bottom)
			]
		),
		glow
	)


## Disabled look: 60% greyed and 60% opaque.
func _grey(color: Color) -> Color:
	var grey: float = color.get_luminance()
	return Color(color.lerp(Color(grey, grey, grey), 0.6), color.a * 0.6)


## Draws a raised body in `rect` on `canvas`. `flat` leaves out the shadow and the light;
## `light` false keeps the shadow and the lip but leaves the face plain.
static func paint(
	canvas: CanvasItem,
	rect: Rect2,
	fill: Color,
	line: Color,
	corner: float = 22.0,
	lift: float = DEPTH,
	down: bool = false,
	line_width: int = XomDaoUi.BORDER,
	flat: bool = false,
	light: bool = true
) -> void:
	var sunk: float = lift - 2.0 if down else 0.0
	# The lip: the whole rect, a darker shade of the border, with the shadow under it.
	var lip: StyleBoxFlat = XomDaoUi.box(
		Color(line.darkened(0.28), line.a), Color.TRANSPARENT, 0, corner
	)
	if not flat:
		lip.shadow_color = SHADE
		lip.shadow_size = 2 if down else 3
		lip.shadow_offset = Vector2(0.0, 2.0 if down else 5.0)
	var lip_rect := Rect2(rect.position + Vector2(0.0, sunk), rect.size - Vector2(0.0, sunk))
	canvas.draw_style_box(lip, lip_rect)
	# The face, standing `lift` off the lip's bottom.
	var top: StyleBoxFlat = XomDaoUi.box(fill, line, line_width, corner)
	var face_rect := Rect2(rect.position + Vector2(0.0, sunk), rect.size - Vector2(0.0, lift))
	canvas.draw_style_box(top, face_rect)
	if flat or not light:
		return
	var inner: Rect2 = face_rect.grow(-float(line_width) - 2.0)
	if inner.size.x <= 4.0 or inner.size.y <= 4.0:
		return
	var soft: float = maxf(2.0, corner - line_width - 2.0)
	# Light from above: a pale gloss over the upper half…
	var gloss := StyleBoxFlat.new()
	gloss.bg_color = Color(1.0, 1.0, 1.0, 0.07 if down else 0.16)
	gloss.corner_radius_top_left = int(soft)
	gloss.corner_radius_top_right = int(soft)
	gloss.corner_radius_bottom_left = int(soft * 0.5)
	gloss.corner_radius_bottom_right = int(soft * 0.5)
	gloss.corner_detail = 12
	gloss.anti_aliasing = true
	canvas.draw_style_box(gloss, Rect2(inner.position, Vector2(inner.size.x, inner.size.y * 0.5)))
	# …a thin bright rim just under the top edge…
	var rim := StyleBoxFlat.new()
	rim.bg_color = Color(1.0, 1.0, 1.0, 0.12 if down else 0.38)
	rim.set_corner_radius_all(2)
	rim.anti_aliasing = true
	var rim_inset: float = minf(soft * 0.7, inner.size.x * 0.25)
	canvas.draw_style_box(
		rim,
		Rect2(
			inner.position + Vector2(rim_inset, 1.0), Vector2(inner.size.x - 2.0 * rim_inset, 3.0)
		)
	)
	# …and the lower third turning away from it.
	var shade := StyleBoxFlat.new()
	shade.bg_color = Color(0.0, 0.0, 0.0, 0.09)
	shade.corner_radius_bottom_left = int(soft)
	shade.corner_radius_bottom_right = int(soft)
	shade.corner_detail = 12
	shade.anti_aliasing = true
	var low: float = inner.size.y * 0.3
	canvas.draw_style_box(
		shade, Rect2(inner.position + Vector2(0.0, inner.size.y - low), Vector2(inner.size.x, low))
	)
