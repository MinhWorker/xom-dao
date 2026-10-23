extends Control
## The friend select before each match, over the dimmed island: the friends along the bottom,
## the one you picked large on the left in their element's glow, and on the right a paper sheet
## with their element and role, the skill with its timings, what it does, and two little yards
## drawn side by side: a plain bomb's blast and a boosted one's. Everyone's pick and readiness
## sit in a row at the top, the seconds left beside the title. `show_view` follows the snapshot;
## `chosen` and `ready_pressed` go back to the table.
##
## Named nodes for tests: Select (the table names it), Pick_<element>, Ready, SkillName, About.

signal chosen(element: String)
signal ready_pressed

const Rules := preload("res://content/bom-nguyen-to/rules.gd")
const ART := "res://content/bom-nguyen-to/art/"
const SHEET := Color("#FBF1DC")
const SHEET_EDGE := Color("#E6D2AA")

var _view: Dictionary = {}
var _me: String = ""
var _shown: String = "fire"
var _shown_at: float = 0.0
var _portraits: Dictionary = {}
var _shade := ColorRect.new()
var _title := Label.new()
var _timer: XomDaoChip = XomDaoChip.create("20", "clock")
var _crew := Control.new()
var _stage := Control.new()
var _sheet := PanelContainer.new()
var _name := Label.new()
var _tags := HBoxContainer.new()
var _skill := Label.new()
var _timings := HBoxContainer.new()
var _about := VBoxContainer.new()
var _diagram := Control.new()
var _picks: Dictionary = {}
var _sheet_box := Rect2()
var _ready_button: XomDaoButton = XomDaoButton.create("Sẵn sàng", XomDaoUi.Kind.CONFIRM)


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	for element: String in Rules.ELEMENTS:
		_portraits[element] = load(ART + "portrait-%s.webp" % element)
	_shade.color = Color(0.1, 0.07, 0.05, 0.62)
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_shade)
	_title.text = "Chọn bạn nhỏ"
	_title.add_theme_font_override("font", XomDaoUi.display_font(800))
	_title.add_theme_font_size_override("font_size", 44)
	_title.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_title.add_theme_color_override("font_outline_color", Color("#2a180c"))
	_title.add_theme_constant_override("outline_size", 8)
	add_child(_title)
	_timer.name = "SelectClock"
	add_child(_timer)
	_crew.draw.connect(_draw_crew)
	_crew.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_crew)
	_stage.draw.connect(_draw_stage)
	_stage.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_stage)
	_build_sheet()
	for element: String in Rules.ELEMENTS:
		var pick := Button.new()
		pick.name = "Pick_" + element
		pick.flat = true
		pick.focus_mode = Control.FOCUS_NONE
		pick.draw.connect(_draw_pick.bind(pick, element))
		pick.pressed.connect(_pick.bind(element))
		add_child(pick)
		_picks[element] = pick
	_ready_button.name = "Ready"
	_ready_button.pressed.connect(_on_ready)
	add_child(_ready_button)
	resized.connect(_layout)
	_layout.call_deferred()


func _build_sheet() -> void:
	var paper: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(SHEET, SHEET_EDGE, XomDaoUi.BORDER, XomDaoUi.RADIUS)
	)
	paper.content_margin_left = 28
	paper.content_margin_right = 28
	paper.content_margin_top = 14
	paper.content_margin_bottom = 12
	_sheet.add_theme_stylebox_override("panel", paper)
	_sheet.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_sheet)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	_sheet.add_child(column)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 12)
	column.add_child(head)
	_name.add_theme_font_override("font", XomDaoUi.display_font(800))
	_name.add_theme_font_size_override("font_size", 36)
	_name.add_theme_color_override("font_color", XomDaoUi.INK)
	head.add_child(_name)
	_tags.add_theme_constant_override("separation", 8)
	_tags.alignment = BoxContainer.ALIGNMENT_END
	_tags.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_tags.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	head.add_child(_tags)
	column.add_child(XomDaoDivider.new())
	var skill_row := HBoxContainer.new()
	skill_row.add_theme_constant_override("separation", 8)
	column.add_child(skill_row)
	_skill.name = "SkillName"
	_skill.add_theme_font_override("font", XomDaoUi.display_font(800))
	_skill.add_theme_font_size_override("font_size", 32)
	skill_row.add_child(_skill)
	_timings.add_theme_constant_override("separation", 8)
	_timings.alignment = BoxContainer.ALIGNMENT_END
	_timings.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_timings.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	skill_row.add_child(_timings)
	_about.name = "About"
	_about.add_theme_constant_override("separation", 4)
	column.add_child(_about)
	_diagram.custom_minimum_size = Vector2(0, 104)
	_diagram.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_diagram.draw.connect(_draw_diagram)
	column.add_child(_diagram)


## Follows the snapshot: whose pick is whose, who is ready, the seconds left.
func show_view(view: Dictionary, me: String) -> void:
	_view = view
	_me = me
	var mine: Dictionary = Rules.fighter(view, me)
	var element: String = str(mine.get("element", _shown))
	if element != _shown or _name.text == "":
		_show_friend(element)
	for one: String in _picks:
		var pick: Button = _picks[one]
		pick.disabled = mine.is_empty()
		pick.queue_redraw()
	_ready_button.visible = not mine.is_empty()
	var ready: bool = bool(mine.get("ready", false))
	_ready_button.disabled = ready
	_ready_button.text = "Đã sẵn sàng" if ready else "Sẵn sàng"
	_crew.queue_redraw()
	_stage.queue_redraw()


## The seconds left to choose.
func show_time(now: float) -> void:
	var left: int = maxi(0, ceili((Rules.SELECT_TIME - now) / 1000.0))
	_timer.text = "%d giây" % left
	_timer.color = XomDaoUi.LACQUER if left <= 5 else XomDaoUi.HUD


func _process(_delta: float) -> void:
	if visible and Time.get_ticks_msec() - _shown_at < 600.0:
		_stage.queue_redraw()


func _show_friend(element: String) -> void:
	_shown = element
	_shown_at = Time.get_ticks_msec()
	var info: Dictionary = Rules.CHARACTERS[element]
	_name.text = str(info["name"])
	_clear(_tags)
	var tint: Color = Color(info["bar"]).darkened(0.25)
	_tags.add_child(XomDaoChip.create(str(info["element"]), "", tint))
	_tags.add_child(XomDaoChip.create(str(info["role"])))
	_skill.text = str(info["skill"])
	_skill.add_theme_color_override("font_color", Color(info["bar"]).darkened(0.35))
	_clear(_timings)
	_timings.add_child(XomDaoChip.create("Hồi %d giây" % (Rules.SKILL_COOLDOWN / 1000), "clock"))
	_timings.add_child(XomDaoChip.create("Kéo dài %d giây" % (Rules.SKILL_BOOST / 1000)))
	_clear(_about)
	for line: String in info["details"]:
		var label := Label.new()
		label.text = line
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.custom_minimum_size.x = maxf(0.0, _sheet_box.size.x - 56.0)
		label.add_theme_font_override("font", XomDaoUi.body_font(true))
		label.add_theme_font_size_override("font_size", 24)
		label.add_theme_color_override("font_color", XomDaoUi.INK)
		_about.add_child(label)
	_diagram.queue_redraw()
	_stage.queue_redraw()
	_fit_sheet.call_deferred()


## Empties a row at once: children only queued for deletion would still widen it this frame.
static func _clear(row: Node) -> void:
	for child: Node in row.get_children():
		row.remove_child(child)
		child.queue_free()


## Wrapping lines measure themselves at the sheet's width, then the sheet takes its box (a label
## measured at no width would count a line per word and stretch the sheet).
func _fit_sheet() -> void:
	if _sheet_box.size.x <= 0.0:
		return
	for label: Node in _about.get_children():
		(label as Control).custom_minimum_size.x = _sheet_box.size.x - 56.0
	_sheet.custom_minimum_size = Vector2(_sheet_box.size.x, 0)
	_sheet.position = _sheet_box.position
	_sheet.size = Vector2(_sheet_box.size.x, 0)
	_sheet.size = Vector2(_sheet_box.size.x, maxf(_sheet_box.size.y, _sheet.size.y))


func _pick(element: String) -> void:
	if Rules.fighter(_view, _me).is_empty():
		return
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	_show_friend(element)
	chosen.emit(element)


func _on_ready() -> void:
	_ready_button.disabled = true
	ready_pressed.emit()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


func _layout() -> void:
	if not is_inside_tree():
		return
	_shade.size = size
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var top: float = edge
	var bottom: float = size.y - edge
	# Top row: the title after the hub's ☰, the seconds, everyone's picks on the right.
	_title.position = Vector2(left + 100.0, top + 12.0)
	_title.size = Vector2(320.0, 60.0)
	_timer.position = Vector2(
		left + 100.0 + _title.get_combined_minimum_size().x + 16.0, top + 18.0
	)
	var crew_w: float = minf(420.0, right - _timer.position.x - 220.0)
	_crew.position = Vector2(right - crew_w, top)
	_crew.size = Vector2(crew_w, 92.0)
	# Bottom row: the five friends and Sẵn sàng.
	var tile := Vector2(118.0, 132.0)
	var gap: float = 10.0
	var ready_w: float = 260.0
	var row_w: float = tile.x * 5.0 + gap * 4.0
	var row_left: float = left + maxf(0.0, (right - left - ready_w - 24.0 - row_w) / 2.0)
	for i: int in Rules.ELEMENTS.size():
		var pick: Button = _picks[Rules.ELEMENTS[i]]
		pick.position = Vector2(row_left + i * (tile.x + gap), bottom - tile.y)
		pick.size = tile
	_ready_button.size = Vector2(ready_w, XomDaoButton.HEIGHT)
	_ready_button.position = Vector2(right - ready_w, bottom - XomDaoButton.HEIGHT - 20.0)
	# Middle: the friend on the left, the sheet on the right.
	var mid_top: float = top + 96.0
	var mid_bottom: float = bottom - tile.y - 14.0
	# The sheet stops above Sẵn sàng; its yards take what height is left.
	var sheet_bottom: float = _ready_button.position.y - 14.0
	var sheet_w: float = clampf((right - left) * 0.56, 560.0, 760.0)
	_sheet_box = Rect2(right - sheet_w, mid_top, sheet_w, sheet_bottom - mid_top)
	_fit_sheet()
	_stage.position = Vector2(left, mid_top)
	_stage.size = Vector2(right - sheet_w - left - 16.0, mid_bottom - mid_top)


# ── Drawing ───────────────────────────────────────────────────────────────────────────────


func _draw_stage() -> void:
	var info: Dictionary = Rules.CHARACTERS[_shown]
	var picture: Texture2D = _portraits[_shown]
	var box := Rect2(Vector2.ZERO, _stage.size)
	var t: float = clampf((Time.get_ticks_msec() - _shown_at) / 380.0, 0.0, 1.0)
	var pop: float = 1.0 + 0.08 * sin(t * PI) * (1.0 - t)
	var centre: Vector2 = box.get_center() + Vector2(0, -6.0)
	# The friend's element glows behind them: soft rings, brighter toward the middle.
	var glow: float = minf(box.size.x, box.size.y) * 0.62
	var ink: Color = info["color"]
	for i: int in 28:
		var f: float = 1.0 - float(i) / 28.0
		ink.a = 0.036
		_stage.draw_circle(centre, glow * f, ink)
	# A round stone pedestal under the friend.
	var foot := Vector2(centre.x, box.end.y - 40.0)
	var pedestal := Vector2(box.size.x * 0.34, 26.0)
	_ellipse(_stage, foot + Vector2(0, 10.0), pedestal, Color("#4a3a30"))
	_ellipse(_stage, foot, pedestal, Color("#8d99a5"))
	_ellipse(_stage, foot - Vector2(0, 3.0), pedestal * 0.92, Color("#a8b2bb"))
	var height: float = (box.size.y - 40.0) * pop
	var k: float = height / picture.get_height()
	var shown: Vector2 = picture.get_size() * k
	if shown.x > box.size.x:
		shown *= box.size.x / shown.x
	_stage.draw_texture_rect(
		picture, Rect2(Vector2(centre.x - shown.x / 2.0, foot.y - shown.y + 8.0), shown), false
	)


func _draw_crew() -> void:
	var fighters: Array = _view.get("fighters", [])
	if fighters.is_empty():
		return
	var font: Font = XomDaoUi.display_font(800)
	var slot: float = minf(104.0, _crew.size.x / fighters.size())
	var x: float = _crew.size.x - slot * fighters.size()
	for one: Dictionary in fighters:
		var element: String = str(one["element"])
		var info: Dictionary = Rules.CHARACTERS[element]
		var centre := Vector2(x + slot / 2.0, 34.0)
		var r: float = 30.0
		var mine: bool = str(one["id"]) == _me
		_crew.draw_circle(
			centre, r + 3.0, XomDaoUi.GOLD if mine else Color(info["bar"]).darkened(0.3)
		)
		_crew.draw_circle(centre, r, info["pastel"])
		var picture: Texture2D = _portraits[element]
		var fit: float = (r * 2.0 - 6.0) / maxf(picture.get_width(), picture.get_height())
		var pic: Vector2 = picture.get_size() * fit
		_crew.draw_texture_rect(picture, Rect2(centre - pic / 2.0, pic), false)
		if bool(one["ready"]):
			var tick := centre + Vector2(r * 0.72, r * 0.72)
			_crew.draw_circle(tick, 13.0, XomDaoUi.BAMBOO_DARK)
			_crew.draw_polyline(
				PackedVector2Array(
					[tick + Vector2(-6, 0), tick + Vector2(-1, 5), tick + Vector2(7, -5)]
				),
				XomDaoUi.CREAM,
				3.5,
				true
			)
		var title: String = "Bạn" if mine else str(one["name"])
		if bool(one["bot"]):
			title = "Máy"
		title = _fit(font, title, slot - 6.0, 24)
		var w: float = font.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
		var spot := Vector2(centre.x - w / 2.0, 88.0)
		_crew.draw_string_outline(
			font, spot, title, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, 6, Color("#2a180c")
		)
		_crew.draw_string(font, spot, title, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, XomDaoUi.CREAM)
		x += slot


func _draw_pick(pick: Button, element: String) -> void:
	var mine: Dictionary = Rules.fighter(_view, _me) if not _view.is_empty() else {}
	var chosen_one: bool = not mine.is_empty() and str(mine["element"]) == element
	var info: Dictionary = Rules.CHARACTERS[element]
	var lift: float = -8.0 if chosen_one else 0.0
	var box := Rect2(Vector2(4, 4 + lift), pick.size - Vector2(8, 8))
	var style := StyleBoxFlat.new()
	style.bg_color = info["pastel"]
	style.border_color = XomDaoUi.GOLD if chosen_one else Color(info["bar"]).darkened(0.35)
	style.set_border_width_all(5 if chosen_one else 3)
	style.set_corner_radius_all(20)
	style.shadow_color = Color(0.16, 0.09, 0.05, 0.4)
	style.shadow_offset = Vector2(0, 5)
	style.shadow_size = 3
	pick.draw_style_box(style, box)
	var picture: Texture2D = _portraits[element]
	var fit: float = (box.size.y - 40.0) / maxf(picture.get_width(), picture.get_height())
	var size_of: Vector2 = picture.get_size() * fit
	pick.draw_texture_rect(
		picture,
		Rect2(Vector2((pick.size.x - size_of.x) / 2.0, box.position.y + 6.0), size_of),
		false
	)
	var font: Font = XomDaoUi.display_font(800)
	var title: String = str(info["element"])
	var w: float = font.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
	pick.draw_string(
		font,
		Vector2((pick.size.x - w) / 2.0, box.end.y - 10.0),
		title,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		24,
		XomDaoUi.INK
	)


## Two small yards side by side: a plain bomb's cross and the boosted blast of this friend
## (facing right), the bomb in the middle.
func _draw_diagram() -> void:
	var info: Dictionary = Rules.CHARACTERS[_shown]
	var font: Font = XomDaoUi.body_font(true)
	var half: float = _diagram.size.x / 2.0
	var cell: float = minf(18.0, (_diagram.size.y - 34.0) / 7.0)
	var plain: Array[Vector2i] = _shape("cross")
	var boosted: Array[Vector2i] = _shape(str(info["shape"]))
	for side: int in 2:
		var title: String = "Bom thường" if side == 0 else "Khi dùng kỹ năng"
		var grid := Vector2(cell * 9.0, cell * 7.0)
		var at := Vector2(half * side + (half - grid.x) / 2.0, 30.0)
		var w: float = font.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
		_diagram.draw_string(
			font,
			Vector2(half * side + (half - w) / 2.0, 22.0),
			title,
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			24,
			XomDaoUi.INK
		)
		var cells: Array[Vector2i] = plain if side == 0 else boosted
		var ink: Color = Color("#ff8256") if side == 0 else info["color"]
		for y: int in 7:
			for x: int in 9:
				var rect := Rect2(at + Vector2(x, y) * cell, Vector2(cell, cell)).grow(-1.5)
				var hit: bool = cells.has(Vector2i(x - 4, y - 3))
				var fill: Color = ink if hit else SHEET_EDGE
				if hit and side == 1 and not plain.has(Vector2i(x - 4, y - 3)):
					fill = ink.darkened(0.15)
				_diagram.draw_rect(rect, fill)
		var bomb: Vector2 = at + Vector2(4.5, 3.5) * cell
		_diagram.draw_circle(bomb, cell * 0.36, XomDaoUi.INK)
		if side == 1 and ["band", "line", "gust"].has(str(info["shape"])):
			var tip: Vector2 = bomb + Vector2(cell * 0.9, 0)
			_diagram.draw_colored_polygon(
				PackedVector2Array(
					[tip + Vector2(4, 0), tip + Vector2(-3, -5), tip + Vector2(-3, 5)]
				),
				XomDaoUi.INK
			)


## The cells a blast shape covers, around (0, 0) facing right.
static func _shape(kind: String) -> Array[Vector2i]:
	var out: Array[Vector2i] = [Vector2i.ZERO]
	match kind:
		"long-cross":
			for i: int in range(1, 4):
				out.append_array([Vector2i(i, 0), Vector2i(-i, 0), Vector2i(0, i), Vector2i(0, -i)])
		"band":
			for row: int in [-1, 0, 1]:
				for i: int in range(-2, 3):
					out.append(Vector2i(i, row))
		"line":
			for i: int in range(-4, 5):
				out.append(Vector2i(i, 0))
		_:
			for i: int in range(1, 3):
				out.append_array([Vector2i(i, 0), Vector2i(-i, 0), Vector2i(0, i), Vector2i(0, -i)])
	return out


static func _ellipse(on: CanvasItem, at: Vector2, radii: Vector2, ink: Color) -> void:
	var points := PackedVector2Array()
	for i: int in 33:
		var angle: float = TAU * i / 32.0
		points.append(at + Vector2(cos(angle) * radii.x, sin(angle) * radii.y))
	on.draw_colored_polygon(points, ink)


static func _fit(font: Font, text: String, width: float, font_size: int) -> String:
	var out: String = text
	while (
		out.length() > 1
		and font.get_string_size(out, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x > width
	):
		out = out.left(out.length() - 2) + "…"
	return out
