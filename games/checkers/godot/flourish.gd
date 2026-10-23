class_name CheckersFlourish
extends RefCounted
## The table's one-off motions, each drawn on `host` and freed when done: a piece's landing
## squash, the "Ăn N quân!" slip, a new king's ring and sparkles, the PHONG VUA! scroll, the
## winner's wave and the shake of a tap that cannot be played. Sizes follow `cell`, one square.

const GOLD_LIGHT := Color("#FFD56B")


## A soft round shadow for a piece (light from the top left: it falls to the bottom right).
static func shadow_texture() -> GradientTexture2D:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
	var dark := Color("#120A05")
	gradient.colors = PackedColorArray([Color(dark, 0.55), Color(dark, 0.4), Color(dark, 0.0)])
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.0, 0.5)
	texture.width = 64
	texture.height = 64
	return texture


## A short squash as a piece lands.
static func land(piece: TextureRect) -> void:
	var tween: Tween = piece.create_tween()
	tween.tween_property(piece, "scale", Vector2(1.08, 0.92), 0.06)
	tween.tween_property(piece, "scale", Vector2.ONE, 0.12).set_trans(Tween.TRANS_BACK)


## "Ăn N quân!" on a slip of paper over the landing square (under it at the top of the board):
## it pops up, rises and fades.
static func combo(host: Control, taken: int, at: Vector2, cell: float, board: Rect2) -> void:
	var slip := PanelContainer.new()
	slip.name = "Combo"
	slip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.HONEY_DARK, 3, 12.0)
	)
	style.content_margin_left = 16.0
	style.content_margin_right = 16.0
	style.content_margin_top = 2.0
	style.content_margin_bottom = 4.0
	slip.add_theme_stylebox_override("panel", style)
	var text := Label.new()
	text.text = "Ăn %d quân!" % taken
	text.add_theme_font_override("font", XomDaoUi.display_font(800))
	text.add_theme_font_size_override("font_size", 32)
	text.add_theme_color_override("font_color", XomDaoUi.LACQUER)
	slip.add_child(text)
	host.add_child(slip)
	slip.reset_size()
	var top: Vector2 = at - Vector2(slip.size.x / 2.0, cell * 0.9 + slip.size.y)
	top.x = clampf(top.x, board.position.x, board.end.x - slip.size.x)
	# Under the square when there is no room above it.
	if top.y < board.position.y:
		top.y = at.y + cell * 0.7
	slip.position = top + Vector2(0.0, 16.0)
	slip.pivot_offset = slip.size / 2.0
	slip.scale = Vector2.ONE * 0.4
	slip.rotation = -0.05
	var tween: Tween = slip.create_tween()
	tween.tween_property(slip, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_BACK)
	tween.parallel().tween_property(slip, "position:y", top.y, 0.22)
	tween.tween_interval(0.6)
	tween.tween_property(slip, "position:y", top.y - 24.0, 0.3)
	tween.parallel().tween_property(slip, "modulate:a", 0.0, 0.3)
	tween.tween_callback(slip.queue_free)


## A ring of light that widens and fades round a new king.
static func crown_ring(host: Control, at: Vector2, cell: float) -> void:
	var ring := Control.new()
	ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ring.position = at
	var radius: float = cell * 0.42
	ring.draw.connect(
		func() -> void:
			ring.draw_arc(Vector2.ZERO, radius, 0.0, TAU, 48, GOLD_LIGHT, 5.0, true)
			ring.draw_arc(
				Vector2.ZERO, radius * 0.8, 0.0, TAU, 48, Color(GOLD_LIGHT, 0.4), 3.0, true
			)
	)
	host.add_child(ring)
	var tween: Tween = ring.create_tween().set_parallel()
	tween.tween_property(ring, "scale", Vector2.ONE * 2.0, 0.5).set_trans(Tween.TRANS_CUBIC)
	tween.tween_property(ring, "modulate:a", 0.0, 0.5)
	tween.chain().tween_callback(ring.queue_free)


## Gold and cream sparkles bursting out of a new king.
static func sparkles(host: Control, at: Vector2, cell: float) -> void:
	var icon: Texture2D = XomDaoUi.icon("sparkle")
	for i: int in 8:
		var star := TextureRect.new()
		star.texture = icon
		star.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		star.mouse_filter = Control.MOUSE_FILTER_IGNORE
		star.modulate = GOLD_LIGHT if i % 2 == 0 else XomDaoUi.CREAM
		var side: float = cell * (0.28 if i % 2 == 0 else 0.2)
		star.size = Vector2.ONE * side
		star.pivot_offset = star.size / 2.0
		star.position = at - star.size / 2.0
		host.add_child(star)
		var angle: float = TAU * i / 8.0 + 0.2
		var out: Vector2 = Vector2.from_angle(angle) * cell * (0.85 if i % 2 == 0 else 0.65)
		var tween: Tween = star.create_tween().set_parallel()
		(
			tween
			. tween_property(star, "position", star.position + out, 0.55)
			. set_trans(Tween.TRANS_QUAD)
			. set_ease(Tween.EASE_OUT)
		)
		tween.tween_property(star, "rotation", 1.2, 0.55)
		tween.tween_property(star, "modulate:a", 0.0, 0.55).set_ease(Tween.EASE_IN)
		tween.chain().tween_callback(star.queue_free)


## PHONG VUA!: a paper scroll with the new king unrolls over the board and rolls away. It never
## takes a tap.
static func cut_in(host: Control, king: Texture2D, board: Rect2) -> void:
	var scroll := PanelContainer.new()
	scroll.name = "CutIn"
	scroll.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.box(Color("#F3E6C8"), Color("#5C2D12"), 6, 10.0)
	style.content_margin_left = 24.0
	style.content_margin_right = 36.0
	style.content_margin_top = 10.0
	style.content_margin_bottom = 10.0
	style.shadow_color = Color(0.0, 0.0, 0.0, 0.35)
	style.shadow_size = 10
	style.shadow_offset = Vector2(4.0, 8.0)
	scroll.add_theme_stylebox_override("panel", style)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	scroll.add_child(row)
	var piece := TextureRect.new()
	piece.texture = king
	piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	piece.custom_minimum_size = Vector2(88.0, 88.0)
	row.add_child(piece)
	var text := Label.new()
	text.text = "PHONG VUA!"
	text.add_theme_font_override("font", XomDaoUi.display_font(800))
	text.add_theme_font_size_override("font_size", 48)
	text.add_theme_color_override("font_color", XomDaoUi.GOLD_DARK)
	text.add_theme_color_override("font_outline_color", Color("#5C2D12"))
	text.add_theme_constant_override("outline_size", 6)
	text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(text)
	host.add_child(scroll)
	scroll.reset_size()
	scroll.position = board.position + (board.size - scroll.size) / 2.0
	scroll.pivot_offset = scroll.size / 2.0
	scroll.scale = Vector2(0.05, 1.0)
	var tween: Tween = scroll.create_tween()
	tween.tween_property(scroll, "scale", Vector2.ONE, 0.26).set_trans(Tween.TRANS_CUBIC)
	tween.tween_interval(0.85)
	tween.tween_property(scroll, "scale", Vector2(0.05, 1.0), 0.2).set_trans(Tween.TRANS_CUBIC)
	tween.tween_callback(scroll.queue_free)


## The winner's piece jumps once, after `delay` seconds.
static func hop(piece: TextureRect, delay: float, height: float) -> void:
	var rest: float = piece.position.y
	var tween: Tween = piece.create_tween()
	tween.tween_interval(delay)
	tween.tween_property(piece, "position:y", rest - height, 0.16).set_ease(Tween.EASE_OUT)
	tween.tween_property(piece, "position:y", rest, 0.2).set_trans(Tween.TRANS_BOUNCE)


## A quick side to side shake back to `rest_x`.
static func shake(piece: TextureRect, rest_x: float) -> void:
	var tween: Tween = piece.create_tween()
	for dx: float in [-5.0, 5.0, -3.0, 0.0]:
		tween.tween_property(piece, "position:x", rest_x + dx, 0.05)


## A taken piece jolts from the blow, then flies in an arc into the taker's tray as the
## `index`-th disc (its picture's disc is 82% of it); the tray grows when it lands.
static func knock_off(
	victim: TextureRect, shadow: TextureRect, tray: CheckersTakenTray, index: int, rise: float
) -> void:
	var start: Vector2 = victim.position
	victim.move_to_front()
	var goal_center: Vector2 = tray.position + tray.slot_center(index)
	var goal: Vector2 = goal_center - victim.size / 2.0
	var shrink: float = tray.disc_size() / (victim.size.x * 0.82)
	var fly: Callable = func(t: float) -> void:
		victim.position = start.lerp(goal, t) - Vector2(0.0, sin(PI * t) * rise)
		victim.scale = Vector2.ONE * lerpf(1.15, shrink, t)
		victim.rotation = t * TAU * 0.5
	var tween: Tween = victim.create_tween()
	tween.tween_property(victim, "scale", Vector2.ONE * 1.15, 0.07)
	tween.parallel().tween_property(shadow, "modulate:a", 0.0, 0.15)
	tween.tween_method(fly, 0.0, 1.0, 0.45).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	tween.tween_callback(
		func() -> void:
			victim.queue_free()
			shadow.queue_free()
			if tray.count < index + 1:
				tray.count = index + 1
				XomDaoUi.bounce(tray)
	)


## Whether the table's motion is on (Hiệu ứng), as saved in `file`; on by default.
static func load_effects(file: String) -> bool:
	var config := ConfigFile.new()
	if config.load(file) != OK:
		return true
	return bool(config.get_value("checkers", "effects", true))


static func save_effects(file: String, on: bool) -> void:
	var config := ConfigFile.new()
	config.set_value("checkers", "effects", on)
	config.save(file)
