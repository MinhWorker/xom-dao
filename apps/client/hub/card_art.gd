class_name HubCardArt
extends Control
## The picture of a game card: `picture` cropped to fill, or until the game has one, sea with
## the game's initial big on a disc. Fog with a lock when it is not playable here yet.

var title: String = "":
	set(value):
		title = value
		queue_redraw()

var locked: bool = false:
	set(value):
		locked = value
		queue_redraw()

## The game's art (null: the stand-in is drawn).
var picture: Texture2D:
	set(value):
		picture = value
		_image.texture = value
		_mask.visible = value != null
		queue_redraw()

var _mask := Panel.new()
var _image := TextureRect.new()
var _over := Control.new()
var _lock: Texture2D = XomDaoUi.icon("lock-simple")


func _init() -> void:
	custom_minimum_size = Vector2(120.0, 96.0)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_contents = true
	# The picture is cut to the rounded corners by the panel it sits in.
	_mask.add_theme_stylebox_override(
		"panel", XomDaoUi.box(Color.WHITE, Color.TRANSPARENT, 0, 14.0)
	)
	_mask.clip_children = CanvasItem.CLIP_CHILDREN_ONLY
	_mask.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mask.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_mask.visible = false
	add_child(_mask)
	_image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_mask.add_child(_image)
	_over.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_over.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_over.draw.connect(_draw_over)
	add_child(_over)
	draw.connect(_over.queue_redraw)


## Over the picture: its rim, and the fog and lock of a game that cannot be played here.
func _draw_over() -> void:
	if picture == null:
		return
	var rect := Rect2(Vector2.ZERO, size)
	if locked:
		_over.draw_style_box(XomDaoUi.box(Color(1, 1, 1, 0.55), Color.TRANSPARENT, 0, 14.0), rect)
		var side: float = minf(size.x, size.y) * 0.38
		_over.draw_texture_rect(
			_lock,
			Rect2((size - Vector2(side, side)) / 2.0, Vector2(side, side)),
			false,
			XomDaoUi.HUD
		)
	_over.draw_style_box(
		XomDaoUi.box(Color.TRANSPARENT, XomDaoUi.PAPER_DARK, XomDaoUi.BORDER, 14.0), rect
	)


func _draw() -> void:
	if picture != null:
		return
	var box: StyleBoxFlat = XomDaoUi.box(XomDaoUi.SEA, XomDaoUi.PAPER_DARK, XomDaoUi.BORDER, 14.0)
	draw_style_box(box, Rect2(Vector2.ZERO, size))
	var c: Vector2 = size / 2.0
	var r: float = minf(size.x, size.y) * 0.34
	draw_circle(c + Vector2(3, 4), r, XomDaoUi.SHADOW, true, -1.0, true)
	draw_circle(c, r, XomDaoUi.PAPER, true, -1.0, true)
	draw_circle(c, r * 0.86, XomDaoUi.LACQUER, false, maxf(2.0, r * 0.08), true)
	var font: Font = XomDaoUi.display_font(800)
	var letter: String = title.left(1)
	var font_size: int = int(r * 1.15)
	var w: float = font.get_string_size(letter, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	draw_string(
		font,
		c + Vector2(-w / 2.0, font_size * 0.36),
		letter,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		font_size,
		XomDaoUi.INK
	)
	if locked:
		draw_rect(Rect2(Vector2.ZERO, size), Color(1, 1, 1, 0.55))
		var side: float = r * 1.1
		draw_texture_rect(
			_lock, Rect2(c - Vector2(side, side) / 2.0, Vector2(side, side)), false, XomDaoUi.HUD
		)
