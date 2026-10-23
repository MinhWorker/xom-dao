extends Control
## A fighter's card on the HUD's dark glass: the friend's portrait in a ring of their element, the
## name and the HP bar, with the team's letter in a team match. Your own card (`stats` on) also
## shows the bombs you can still place and the blast range as chips. Knocked-out fighters fade.
## The table fills it with `show_fighter`.

const ART := "res://content/bom-nguyen-to/art/"
const Rules := preload("res://content/bom-nguyen-to/rules.gd")
const TEAM_INK: Array[Color] = [Color("#4c9be8"), Color("#f0708f")]

## Your own card: bigger, with the bombs and the range under the bar.
var stats: bool = false

var _fighter: Dictionary = {}
var _title: String = ""
var _team: String = ""
var _bombs: String = ""
var _range: String = ""
var _boosted: bool = false
var _paint: String = ""
var _shown_hp: float = 100.0
var _portraits: Dictionary = {}
var _icons: Dictionary = {}


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for element: String in Rules.ELEMENTS:
		_portraits[element] = load(ART + "portrait-%s.webp" % element)
	for icon: String in ["bomb", "blast"]:
		_icons[icon] = load(ART + "icon-%s.webp" % icon)
	resized.connect(queue_redraw)


## Shows a fighter ({} hides the card); `title` is the name to show.
func show_fighter(one: Dictionary, title: String, view: Dictionary) -> void:
	visible = not one.is_empty()
	if one.is_empty():
		return
	_fighter = one
	_title = title
	_team = ""
	if str(view.get("mode", "solo")) == "teams":
		_team = "A" if int(one["team"]) == 0 else "B"
	_bombs = "%d/%d" % [Rules.bombs_left(view, one), int(one["capacity"])]
	_range = str(int(one["range"]))
	_boosted = float(one["skillUntil"]) > float(view.get("time", 0))
	var paint: String = (
		"%s|%s|%s|%s|%s|%s|%s" % [title, one["hp"], one["element"], _team, _bombs, _range, _boosted]
	)
	modulate.a = 1.0 if int(one["hp"]) > 0 else 0.5
	if paint != _paint:
		_paint = paint
		queue_redraw()


func _process(delta: float) -> void:
	if _fighter.is_empty():
		return
	var hp: float = float(_fighter["hp"])
	if absf(_shown_hp - hp) > 0.3:
		_shown_hp = lerpf(_shown_hp, hp, minf(1.0, delta * 6.0))
		queue_redraw()


func _draw() -> void:
	if _fighter.is_empty():
		return
	var element: String = str(_fighter["element"])
	var info: Dictionary = Rules.CHARACTERS[element]
	var hp: int = int(_fighter["hp"])
	var head: float = size.y if not stats else minf(size.y * 0.62, 84.0)
	var plate := Rect2(Vector2(head * 0.5, 4.0), Vector2(size.x - head * 0.5, head - 8.0))
	if stats:
		plate.size.y = size.y - 8.0
	var style := StyleBoxFlat.new()
	style.bg_color = XomDaoUi.HUD
	style.set_corner_radius_all(int(minf(22.0, plate.size.y * 0.4)))
	style.border_color = Color(info["color"], 0.9) if _boosted else Color(1, 1, 1, 0.08)
	style.set_border_width_all(3 if _boosted else 1)
	draw_style_box(style, plate)
	# The portrait in its element ring, spilling over the plate's left end.
	var centre := Vector2(head / 2.0, head / 2.0)
	var r: float = head / 2.0 - 2.0
	draw_circle(centre, r, Color(info["bar"]).darkened(0.35))
	draw_circle(centre, r - 4.0, info["pastel"])
	var picture: Texture2D = _portraits[element]
	var fit: float = (r * 2.0 - 10.0) / maxf(picture.get_width(), picture.get_height())
	var pic: Vector2 = picture.get_size() * fit
	var grey := Color(0.55, 0.55, 0.55) if hp <= 0 else Color.WHITE
	draw_texture_rect(picture, Rect2(centre - pic / 2.0, pic), false, grey)
	var font: Font = XomDaoUi.display_font(800)
	var x: float = head + 6.0
	var w: float = size.x - x - 12.0
	var bar_h: float = 16.0 if not stats else 20.0
	var name_size: int = 24
	var title_at: float = plate.position.y + 4.0 + name_size * 0.9
	if _team != "":
		var tag: String = "Đội " + _team
		var tw: float = font.get_string_size(tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
		draw_string(
			font,
			Vector2(size.x - 12.0 - tw, title_at),
			tag,
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			24,
			TEAM_INK[0 if _team == "A" else 1]
		)
		w -= tw + 8.0
	draw_string(
		font,
		Vector2(x, title_at),
		_fit(font, _title, w, name_size),
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		name_size,
		XomDaoUi.CREAM
	)
	var bar := Rect2(x, title_at + 8.0, size.x - x - 12.0, bar_h)
	_pill(bar, Color(0, 0, 0, 0.35))
	var shown: float = clampf(_shown_hp / 100.0, 0.0, 1.0)
	if shown > 0.0:
		_pill(
			Rect2(bar.position, Vector2(maxf(bar_h, bar.size.x * shown), bar_h)), Color("#f6d2a0")
		)
	if hp > 0:
		_pill(
			Rect2(bar.position, Vector2(maxf(bar_h, bar.size.x * hp / 100.0), bar_h)), info["bar"]
		)
	if stats:
		var number: String = str(hp)
		var nw: float = font.get_string_size(number, HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
		draw_string_outline(
			font,
			bar.get_center() + Vector2(-nw / 2.0, 9.0),
			number,
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			24,
			5,
			Color("#3a2416")
		)
		draw_string(
			font,
			bar.get_center() + Vector2(-nw / 2.0, 9.0),
			number,
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			24,
			XomDaoUi.CREAM
		)
		var chip_y: float = bar.end.y + 8.0
		var chip_x: float = x
		for row: Array in [["bomb", _bombs], ["blast", _range]]:
			chip_x = _chip(chip_x, chip_y, _icons[row[0]], row[1], font) + 8.0


## A small dark chip with an icon and a value; returns its right edge.
func _chip(x: float, y: float, icon: Texture2D, value: String, font: Font) -> float:
	var h: float = 34.0
	var vw: float = font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
	var box := Rect2(x, y, h + vw + 12.0, h)
	_pill(box, Color(0, 0, 0, 0.3))
	var k: float = (h - 6.0) / icon.get_height()
	draw_texture_rect(icon, Rect2(Vector2(x + 4.0, y + 3.0), icon.get_size() * k), false)
	draw_string(
		font,
		Vector2(x + h + 2.0, y + 25.0),
		value,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		24,
		XomDaoUi.CREAM
	)
	return box.end.x


func _pill(box: Rect2, ink: Color) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = ink
	style.set_corner_radius_all(int(box.size.y / 2.0))
	draw_style_box(style, box)


static func _fit(font: Font, text: String, width: float, font_size: int) -> String:
	var out: String = text
	while (
		out.length() > 1
		and font.get_string_size(out, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x > width
	):
		out = out.left(out.length() - 2) + "…"
	return out
