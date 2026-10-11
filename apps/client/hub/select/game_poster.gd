class_name HubGamePoster
extends Button
## One game on the select screen's rail: a print of its splash art in a paper border, the
## game's logo and name over the art, its tagline at the bottom, and above the print a tag with
## the seats hanging from the rail. A game that is not here yet is washed out under a lock.
## The strip (HubGameStrip) decides what a touch means and emits `pressed` for a tap.
##
##   var poster := HubGamePoster.new()
##   poster.show_card(card, true)

const SIZE := Vector2(318.0, 470.0)
## The tag's strip above the print.
const TAG_H := 58.0
const BORDER := 7.0
const LOGO := 132.0

var card: XomDaoGameCard
var playable: bool = true

## 0 to 1: how far the poster is lifted (hover).
var lift: float = 0.0:
	set(value):
		lift = value
		queue_redraw()

var _art: Texture2D
var _logo: Texture2D
var _lock: Texture2D = XomDaoUi.icon("lock-simple")
var _people: Texture2D = XomDaoUi.icon("users")


func _init() -> void:
	custom_minimum_size = SIZE
	size = SIZE
	focus_mode = Control.FOCUS_NONE
	# The strip handles the pointer: a drag scrolls, a tap presses.
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())


func show_card(item: XomDaoGameCard, can_play: bool) -> void:
	card = item
	playable = can_play
	name = "Card_" + item.id
	_art = HubGameArt.splash(item.id)
	_logo = HubGameArt.logo(item.id)
	queue_redraw()


func _draw() -> void:
	if card == null:
		return
	var rise: float = lift * 8.0
	var print_box := Rect2(0.0, TAG_H - rise, size.x, size.y - TAG_H)
	_draw_tag(rise)
	# The print: a short dense shadow, a paper border, the art covering the inside.
	var shadow: StyleBoxFlat = XomDaoUi.box(XomDaoPuff.SHADE, Color.TRANSPARENT, 0, 6.0)
	shadow.shadow_color = Color(XomDaoPuff.SHADE, 0.3)
	shadow.shadow_size = 10
	draw_style_box(shadow, Rect2(print_box.position + Vector2(0.0, 8.0 + rise), print_box.size))
	draw_style_box(XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.PAPER_DARK, 2, 6.0), print_box)
	var inside: Rect2 = print_box.grow(-BORDER)
	if _art != null:
		var k: float = maxf(inside.size.x / _art.get_width(), inside.size.y / _art.get_height())
		var seen: Vector2 = inside.size / k
		var from := Rect2((_art.get_size() - seen) / 2.0, seen)
		draw_texture_rect_region(_art, inside, from)
	else:
		draw_rect(inside, XomDaoUi.SEA_DEEP)
	_draw_shade(inside)
	var font: Font = XomDaoUi.display_font(800)
	var middle: float = inside.position.x + inside.size.x / 2.0
	var logo_top: float = inside.position.y + inside.size.y * 0.2
	if _logo != null:
		var side: float = LOGO * (1.0 + 0.05 * lift)
		draw_texture_rect(
			_logo, Rect2(middle - side / 2.0, logo_top + (LOGO - side) / 2.0, side, side), false
		)
	# The name, whole: a long one is written smaller.
	var room: float = inside.size.x - 28.0
	var name_size: int = 44
	while (
		name_size > XomDaoUi.TEXT_MIN
		and font.get_string_size(card.name, HORIZONTAL_ALIGNMENT_LEFT, -1, name_size).x > room
	):
		name_size -= 2
	var name_y: float = logo_top + LOGO + 18.0 + font.get_ascent(name_size)
	_text(font, card.name, Vector2(inside.position.x + 14.0, name_y), room, name_size)
	var words: Font = XomDaoUi.body_font(true)
	var tagline: String = card.tagline if playable else "Sắp có trên Xóm Đảo."
	var lines := TextParagraph.new()
	lines.alignment = HORIZONTAL_ALIGNMENT_CENTER
	lines.width = room
	lines.max_lines_visible = 3
	lines.add_string(tagline, words, 22)
	var at := Vector2(inside.position.x + 14.0, name_y + 12.0)
	lines.draw_outline(get_canvas_item(), at, 5, Color(XomDaoUi.NAVY, 0.8))
	lines.draw(get_canvas_item(), at, Color(XomDaoUi.CREAM, 0.95))
	if not playable:
		draw_rect(inside, Color(XomDaoUi.PAPER, 0.5))
		var side: float = 64.0
		var spot := Vector2(inside.end.x - side - 10.0, inside.position.y + 10.0)
		draw_circle(spot + Vector2.ONE * side / 2.0, side / 2.0, XomDaoUi.HUD, true, -1.0, true)
		draw_texture_rect(_lock, Rect2(spot, Vector2.ONE * side).grow(-14.0), false, XomDaoUi.CREAM)


## The tag hanging from the rail: a ring on the rail, and a dark label with the seats.
func _draw_tag(rise: float) -> void:
	var rail := Vector2(26.0, 20.0)
	draw_line(rail, Vector2(rail.x, TAG_H - rise + 4.0), XomDaoUi.INK, 3.0, true)
	draw_circle(rail, 15.0, XomDaoUi.PAPER, true, -1.0, true)
	draw_circle(rail, 15.0, XomDaoUi.INK, false, 3.0, true)
	draw_circle(rail, 6.0, XomDaoUi.SUN if playable else XomDaoUi.PAPER_DARK, true, -1.0, true)
	draw_circle(rail, 6.0, XomDaoUi.INK, false, 2.0, true)
	var font: Font = XomDaoUi.display_font(800)
	var seats: String = XomDaoGameTile.players_label(card.min_players, card.max_players)
	if card.kind == "event":
		seats = "Sự kiện"
	var wide: float = font.get_string_size(seats, HORIZONTAL_ALIGNMENT_LEFT, -1, 22).x
	var label := Rect2(rail.x + 22.0, rail.y - 18.0, wide + 56.0, 36.0)
	draw_style_box(XomDaoUi.box(XomDaoUi.NAVY, XomDaoUi.INK, 0, 10.0), label)
	draw_texture_rect(
		_people,
		Rect2(label.position + Vector2(10.0, 6.0), Vector2(24.0, 24.0)),
		false,
		XomDaoUi.SUN
	)
	draw_string(
		font,
		label.position + Vector2(42.0, 26.0),
		seats,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		22,
		XomDaoUi.CREAM
	)


## The art darker from its middle down, where the words are, and a little at the top.
func _draw_shade(box: Rect2) -> void:
	var clear := Color(XomDaoUi.NAVY, 0.0)
	var dark := Color(XomDaoUi.NAVY, 0.9)
	var soft := Color(XomDaoUi.NAVY, 0.3)
	var mid: float = box.position.y + box.size.y * 0.3
	draw_polygon(
		PackedVector2Array(
			[
				Vector2(box.position.x, mid),
				Vector2(box.end.x, mid),
				box.end,
				Vector2(box.position.x, box.end.y)
			]
		),
		PackedColorArray([clear, clear, dark, dark])
	)
	draw_polygon(
		PackedVector2Array(
			[
				box.position,
				Vector2(box.end.x, box.position.y),
				Vector2(box.end.x, mid),
				Vector2(box.position.x, mid)
			]
		),
		PackedColorArray([soft, soft, clear, clear])
	)


## Centred text with a dark outline, so it reads on any art.
func _text(font: Font, text: String, at: Vector2, width: float, font_size: int) -> void:
	draw_string_outline(
		font, at, text, HORIZONTAL_ALIGNMENT_CENTER, width, font_size, 8, Color(XomDaoUi.NAVY, 0.85)
	)
	draw_string(font, at, text, HORIZONTAL_ALIGNMENT_CENTER, width, font_size, XomDaoUi.CREAM)
