extends Control
## A player's brass-edged plate: their disc and name, the cards still in their hand (a little
## fan of backs and the count), their points, the turn clock and, once out, their place.

const Style := preload("style.gd")

const SIZE := Vector2(168.0, 58.0)
const PLACES: Array[String] = ["", "Nhất", "Nhì", "Ba", "Bét"]
const PLACE_COLORS: Array[Color] = [
	Color("#d6b25e"), Color("#d6b25e"), Color("#cfd8d4"), Color("#d69a62"), Color("#c46a5c")
]

var display_name := ""
var tint := Color.WHITE
var is_bot := false
var count := 0
var points := 0
## 1-4 once the seat has emptied its hand this round.
var place := 0
var passed := false
var active := false
## The turn clock, 1 down to 0; below 0 there is none.
var clock := -1.0
var mine := false


func _init() -> void:
	custom_minimum_size = SIZE
	size = SIZE
	pivot_offset = SIZE * 0.5
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func refresh() -> void:
	queue_redraw()


func _draw() -> void:
	var rect := Rect2(Vector2.ZERO, SIZE)
	var border := Style.BRASS if active else Color(1, 1, 1, 0.14)
	var plate := Style.box(Style.PLATE, 12.0, border, 2.5 if active else 1.5)
	plate.shadow_color = Color(0, 0, 0, 0.4)
	plate.shadow_size = 6
	plate.shadow_offset = Vector2(0, 3)
	draw_style_box(plate, rect)
	var disc := Vector2(30.0, SIZE.y * 0.5)
	draw_circle(disc, 20.0, Color(0, 0, 0, 0.35))
	draw_circle(disc, 18.0, tint)
	var initial := display_name.substr(0, 1).to_upper()
	Style.draw_centered(self, initial if initial != "" else "?", disc, 20, Style.INK, true)
	if clock >= 0.0:
		draw_arc(disc, 22.0, -PI * 0.5, -PI * 0.5 + TAU * clock, 40, Style.BRASS, 3.0, true)
	var text_x := 58.0
	var width := SIZE.x - text_x - 8.0
	draw_string(
		Style.bold(),
		Vector2(text_x, 24.0),
		display_name,
		HORIZONTAL_ALIGNMENT_LEFT,
		width,
		15,
		Style.TEXT if not is_bot else Style.MUTED
	)
	if place > 0:
		var badge := Rect2(text_x, 32.0, 48.0, 18.0)
		draw_style_box(Style.box(PLACE_COLORS[place], 9.0), badge)
		Style.draw_centered(self, PLACES[place], badge.get_center(), 12, Style.INK, true)
	else:
		_draw_hand(Vector2(text_x, 32.0))
	var number := str(points)
	var unit := " điểm"
	var number_width := Style.bold().get_string_size(number, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
	var unit_width := Style.plain().get_string_size(unit, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
	var left := SIZE.x - 10.0 - number_width - unit_width
	draw_string(
		Style.bold(), Vector2(left, 46.0), number, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Style.BRASS
	)
	draw_string(
		Style.plain(),
		Vector2(left + number_width, 46.0),
		unit,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		12,
		Style.MUTED
	)


## A little fan of card backs and how many are left.
func _draw_hand(origin: Vector2) -> void:
	var shown := mini(count, 3)
	for i in shown:
		var at := origin + Vector2(float(i) * 4.0, 1.0)
		draw_style_box(Style.box(Style.BACK, 2.0, Style.IVORY, 1.0), Rect2(at, Vector2(11.0, 16.0)))
	var color := Style.DANGER if count == 1 else Style.TEXT
	draw_string(
		Style.bold(),
		origin + Vector2(float(maxi(shown, 1) - 1) * 4.0 + 18.0, 14.0),
		str(count),
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		15,
		color
	)
