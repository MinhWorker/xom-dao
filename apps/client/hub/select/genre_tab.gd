class_name HubGenreTab
extends Button
## One genre on the select screen's row: its object (HubGameArt.genre: a rook for Cờ, cards for
## Bài) standing on a plate with the genre's name. The object is taller than the plate, so its
## top stands out above it. The chosen genre has a gold plate and a bigger object that bobs.
##
##   var tab := HubGenreTab.create("co", "Cờ")
##   tab.selected = true

const PLATE_H := 60.0
const OBJECT := 92.0
const HEIGHT := 104.0

var selected: bool = false:
	set(value):
		selected = value
		set_process(value)
		queue_redraw()

var _label: String = ""
var _object: Texture2D
var _time: float = 0.0


static func create(genre_id: String, genre_name: String) -> HubGenreTab:
	var tab := HubGenreTab.new()
	tab.name = "Tab_" + genre_id
	tab._label = genre_name
	tab._object = HubGameArt.genre(genre_id)
	var font: Font = XomDaoUi.display_font(800)
	var wide: float = font.get_string_size(genre_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 28).x
	tab.custom_minimum_size = Vector2(OBJECT + wide + 34.0, HEIGHT)
	return tab


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	button_down.connect(func() -> void: XomDaoUi.play(self, XomDaoUi.SOUND_TAP))
	set_process(false)


func _process(delta: float) -> void:
	_time += delta
	queue_redraw()


func _draw() -> void:
	var down: bool = get_draw_mode() == DRAW_PRESSED or get_draw_mode() == DRAW_HOVER_PRESSED
	var over: bool = get_draw_mode() == DRAW_HOVER
	var plate := Rect2(0.0, size.y - PLATE_H, size.x, PLATE_H)
	if selected:
		XomDaoPuff.paint(self, plate, XomDaoUi.SUN, XomDaoUi.GOLD_DARK, 18.0, 6.0, down)
	else:
		var fill: Color = XomDaoUi.NAVY_HUD.lightened(0.08 if over else 0.0)
		XomDaoPuff.paint(self, plate, fill, XomDaoUi.NAVY_LINE, 18.0, 6.0, down, 2, false, false)
	# The object stands on the plate's floor and rises above its top edge.
	var side: float = OBJECT * (1.08 if selected else (1.03 if over else 1.0))
	var rise: float = 3.0 + sin(_time * 2.6) * 2.5 if selected else 0.0
	var foot := Vector2(8.0 + OBJECT / 2.0, size.y - 14.0 + (4.0 if down else 0.0))
	draw_set_transform(foot + Vector2(0.0, -2.0), 0.0, Vector2(1.0, 0.26))
	draw_circle(Vector2.ZERO, 30.0, Color(0.0, 0.0, 0.0, 0.22), true, -1.0, true)
	draw_set_transform(Vector2.ZERO)
	if _object != null:
		draw_texture_rect(
			_object, Rect2(foot.x - side / 2.0, foot.y - side - rise, side, side), false
		)
	var font: Font = XomDaoUi.display_font(800)
	var base := Vector2(OBJECT + 14.0, plate.position.y + (4.0 if down else 0.0) + 37.0)
	draw_string(
		font,
		base,
		_label,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		28,
		XomDaoUi.INK if selected else XomDaoUi.CREAM
	)
