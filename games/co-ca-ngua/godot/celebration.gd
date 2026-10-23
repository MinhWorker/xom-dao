extends Control
## A team home: fireworks over the board and the award plaque, "CHIẾN THẮNG!" for the winner or
## "VỀ ĐÍCH!" for a later finisher, the player's name in their colour and "HẠNG n" on a gold
## ribbon. The plaque is drawn in vectors (a 508 × 132 design at a 640 board side, scaled to the
## board) so it stays crisp; it swings in and everything clears itself after SECONDS.
##
##   var party := Celebration.new()   # preload("res://content/co-ca-ngua/celebration.gd")
##   party.setup(board_rect, Color("#E95853"), Color("#FFB5A4"), "Bạn", 1)
##   party.setup(board_rect, accent, tint, "Máy 1", 1, "CHIẾN THẮNG!", "BẠN THUA", false)  # a loss
##   add_child(party)
##   party.play()
##
## Named nodes for tests: Celebration, Badge, BadgeHeading, BadgeName, BadgeRank.

## As long as the server waits after a team comes home (CELEBRATION_MS in src/game/model.ts).
const SECONDS := 3.0
const ENTRANCE := 0.35
## The design size of the board the plaque was drawn for.
const DESIGN := 640.0
const SPARKS: Array[Color] = [
	Color("#FFE2A0"), Color("#FF8EAA"), Color("#88E3FF"), Color("#A8EBC7")
]
const GOLD_LIGHT := Color("#FFDF8C")
const GOLD_DEEP := Color("#9C6425")
const GOLD_LEAF := Color("#E7BD64")
const TEAL := Color("#0A3438")
const DEEP := Color("#001A1E")
const NAME_WIDTH := 278.0

## The board on the screen; the fireworks burst over it and the plaque hangs at its top.
var board := Rect2()
var elapsed: float = 0.0

var _accent := Color("#E7BD64")
var _fireworks: bool = true
var _badge := Control.new()
var _heading := Label.new()
var _name := Label.new()
var _rank := Label.new()


## The plaque's heading for a place (1 is the winner).
static func heading_for(rank: int) -> String:
	return "CHIẾN THẮNG!" if rank == 1 else "VỀ ĐÍCH!"


func _init() -> void:
	name = "Celebration"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_badge.name = "Badge"
	_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_badge.modulate.a = 0.0
	_badge.draw.connect(_draw_badge)
	add_child(_badge)
	_heading.name = "BadgeHeading"
	_name.name = "BadgeName"
	_rank.name = "BadgeRank"
	_text(_heading, 22, Color("#FFF0B5"), DEEP, 2, -34.0)
	_text(_name, 34, Color.WHITE, DEEP, 4, -3.0)
	_text(_rank, 26, Color("#553410"), Color("#FFF1BF"), 0, 35.0)


## What the plaque shows: the player's colour (accent for the ribbons, tint for the name), and
## optionally its own `heading` and `ribbon` words (else heading_for(rank) and "HẠNG n");
## `fireworks` false keeps the sky dark (someone else won).
func setup(
	on: Rect2,
	accent: Color,
	tint: Color,
	who: String,
	rank: int,
	heading: String = "",
	ribbon: String = "",
	fireworks: bool = true
) -> void:
	board = on
	_accent = accent
	_fireworks = fireworks
	_heading.text = heading if heading != "" else heading_for(rank)
	_name.text = who
	_name.add_theme_color_override("font_color", tint)
	_rank.text = ribbon if ribbon != "" else "HẠNG %d" % rank
	var font: Font = XomDaoUi.display_font(800)
	var font_size: int = 34
	while (
		font_size > 22
		and font.get_string_size(who, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x > NAME_WIDTH
	):
		font_size -= 1
	_name.add_theme_font_size_override("font_size", font_size)
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_step(0.0)


## Runs the fireworks and the plaque for SECONDS, then frees itself.
func play() -> void:
	var tween: Tween = create_tween()
	tween.tween_method(_step, 0.0, SECONDS, SECONDS)
	await tween.finished
	queue_free()


func _text(label: Label, font_size: int, color: Color, outline: Color, line: int, y: float) -> void:
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_outline_color", outline)
	label.add_theme_constant_override("outline_size", line)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.clip_text = true
	label.size = Vector2(NAME_WIDTH, 44.0)
	label.position = Vector2(61.0 - NAME_WIDTH / 2.0, y - 22.0)
	_badge.add_child(label)


func _step(at: float) -> void:
	elapsed = at
	var side: float = board.size.x
	var scale_of: float = side / DESIGN
	var entrance: float = minf(1.0, at / ENTRANCE)
	var settle: float = 1.0 + sin(entrance * PI) * 0.08
	_badge.position = Vector2(
		board.position.x + side / 2.0,
		board.position.y + side * 0.15 - (1.0 - entrance) * 20.0 * scale_of
	)
	_badge.scale = Vector2.ONE * scale_of * settle
	_badge.modulate.a = entrance
	queue_redraw()


## Six bursts of sparks over the board, a third of a second apart, each fading in a second.
func _draw() -> void:
	if not _fireworks:
		return
	var side: float = board.size.x
	for burst: int in 6:
		var age: float = elapsed - burst * 0.33
		if age < 0.0 or age > 1.0:
			continue
		var middle: Vector2 = (
			board.position
			+ Vector2(0.18 + ((burst * 37) % 65) / 100.0, 0.22 + ((burst * 23) % 50) / 100.0) * side
		)
		var color: Color = SPARKS[burst % SPARKS.size()]
		color.a = 1.0 - age
		for spark: int in 18:
			var way := Vector2.from_angle(spark * TAU / 18.0)
			var tip: Vector2 = (
				middle + way * side * 0.2 * age + Vector2(0.0, side * 0.05 * age * age)
			)
			draw_line(tip, tip - way * side * 0.023, color, 3.0, true)
			draw_circle(tip, 3.0, color, true, -1.0, true)


func _round(rect: Rect2, radius: float, color: Color, line: float = 0.0) -> void:
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(int(radius))
	style.corner_detail = 8
	style.anti_aliasing = true
	if line > 0.0:
		style.draw_center = false
		style.border_color = color
		style.set_border_width_all(int(line))
	else:
		style.bg_color = color
	_badge.draw_style_box(style, rect)


func _polygon(points: Array, color: Color) -> void:
	var shape := PackedVector2Array()
	for point: Vector2 in points:
		shape.append(point)
	_badge.draw_colored_polygon(shape, color)


## The plaque, in its design units round its middle: ribbon tails, the bevelled board, the gold
## rank ribbon, a medallion with laurels and a cup, and diamond glints.
func _draw_badge() -> void:
	for side: float in [-1.0, 1.0]:
		var tail: Array = [[194, 4], [254, 20], [236, 42], [252, 68], [196, 58]]
		var front: Array = [[194, 0], [250, 16], [232, 38], [248, 64], [196, 54]]
		_polygon(_mirror(tail, side), Color("#061D24"))
		_polygon(_mirror(front, side), _accent)
		_polygon(_mirror([[196, 36], [222, 50], [196, 54]], side), Color("#08262B"))
	_round(Rect2(-224, -52, 448, 120), 24, Color(0.0, 0.063, 0.078, 0.55))
	_round(Rect2(-220, -62, 440, 124), 22, GOLD_DEEP)
	_round(Rect2(-220, -62, 440, 116), 22, GOLD_LIGHT)
	_round(Rect2(-214, -56, 428, 104), 18, TEAL)
	_round(Rect2(-208, -50, 416, 92), 15, Color("#C99A50"), 2.0)
	_badge.draw_line(Vector2(-185, -46), Vector2(185, -46), Color(1, 1, 1, 0.15), 2.0)
	_round(Rect2(-204, -46, 408, 22), 12, Color(_accent, 0.14))
	_round(Rect2(-57, 22, 236, 36), 10, GOLD_DEEP)
	_round(Rect2(-57, 18, 236, 36), 10, GOLD_LIGHT)
	_round(Rect2(-52, 22, 226, 27), 7, Color("#FFF2C5"), 1.0)
	var mx: float = -155.0
	_badge.draw_circle(Vector2(mx, 3), 55.0, Color(0.0, 0.063, 0.078, 0.35), true, -1.0, true)
	_badge.draw_circle(Vector2(mx, -3), 55.0, GOLD_LIGHT, true, -1.0, true)
	_badge.draw_circle(Vector2(mx, -3), 49.0, Color("#986226"), true, -1.0, true)
	_badge.draw_circle(Vector2(mx, -3), 45.0, Color("#173B3B"), true, -1.0, true)
	_badge.draw_arc(Vector2(mx, -3), 51.0, 0.0, TAU, 48, Color("#FFEFB2", 0.8), 2.0, true)
	for side: float in [-1.0, 1.0]:
		for leaf: int in 5:
			var angle: float = -0.9 + leaf * 0.4
			var x: float = mx + side * (29.0 + 7.0 * cos(angle))
			var y: float = -3.0 + 32.0 * sin(angle)
			_polygon(
				[
					Vector2(x, y - 8),
					Vector2(x + side * 7, y - 3),
					Vector2(x + side * 3, y + 8),
					Vector2(x - side * 3, y + 2)
				],
				GOLD_LEAF
			)
	_round(Rect2(mx - 30, -23, 60, 25), 10, GOLD_LEAF, 5.0)
	_polygon(
		[
			Vector2(mx - 23, -28),
			Vector2(mx + 23, -28),
			Vector2(mx + 18, -3),
			Vector2(mx + 8, 9),
			Vector2(mx - 8, 9),
			Vector2(mx - 18, -3)
		],
		Color("#F5C45C")
	)
	_polygon(
		[Vector2(mx - 19, -24), Vector2(mx - 8, -24), Vector2(mx - 6, 3), Vector2(mx - 12, 0)],
		Color("#FFF1AD")
	)
	_badge.draw_rect(Rect2(mx - 4, 8, 8, 14), GOLD_LEAF)
	_round(Rect2(mx - 18, 21, 36, 8), 3, GOLD_LEAF)
	for glint: Vector2 in [Vector2(-212, -51), Vector2(210, -49), Vector2(185, 45)]:
		_polygon(
			[
				glint + Vector2(0, -6),
				glint + Vector2(3, 0),
				glint + Vector2(0, 6),
				glint + Vector2(-3, 0)
			],
			Color("#FFF6D5")
		)


static func _mirror(points: Array, side: float) -> Array:
	var out: Array = []
	for point: Array in points:
		out.append(Vector2(side * float(point[0]), float(point[1])))
	return out
