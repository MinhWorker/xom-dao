class_name HubDinh
extends Control
## Đình (docs/experience.md): the village's rankings. The đình itself floats on the sea at the
## left under its name plaque; at the right a wooden board has a tab per ranking (Cả xóm by
## experience, then each game by wins), a podium for the top three, the rest as rows, and your
## own row under the list when you are below the top. Named for tests: RankingBoard, Tab_<id>,
## Podium, Rank_<n> (Name, Value), RankMe, RankingEmpty.

signal back_pressed
## A tab was picked: the hub fetches that board (`ranking:get`).
signal board_changed(board: String)

const WIDTH := 600.0
const ROW_HEIGHT := 64.0
const ART := Vector2(400.0, 370.0)
const GAP := 28.0
## Podium steps: height by slot, face colour by rank (tied players share a colour).
const STEPS := {
	1: [76.0, Color("#E7B53C")], 2: [56.0, Color("#C9CED6")], 3: [40.0, Color("#D08A55")]
}

var top := HubTopBar.new()
var board: String = "core"

var _stage := Control.new()
var _art_side := VBoxContainer.new()
var _art_stage := Control.new()
var _art := TextureRect.new()
var _board: XomDaoBoard = XomDaoBoard.create("Xếp hạng")
var _tabs := HBoxContainer.new()
var _scroll := ScrollContainer.new()
var _list := VBoxContainer.new()
var _podium := HBoxContainer.new()
var _rows := VBoxContainer.new()
var _empty := Label.new()
var _me := VBoxContainer.new()
## Tabs as [[board, label], …].
var _boards: Array = []


func _init(settings: XomDaoSettings = null) -> void:
	name = "Dinh"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	add_child(_stage)
	_build_art()
	_build_board()
	top = HubTopBar.new(settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	resized.connect(_layout)


func _ready() -> void:
	_bob()
	_layout()


func _build_art() -> void:
	_art_side.name = "DinhArt"
	_art_side.add_theme_constant_override("separation", 0)
	_stage.add_child(_art_side)
	_art_stage.custom_minimum_size = ART
	_art_stage.draw.connect(_draw_shadow)
	_art_side.add_child(_art_stage)
	_art.texture = preload("res://hub/dinh/dinh.webp")
	_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_art.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_art.size = ART
	_art_stage.add_child(_art)
	# A lacquered name plaque, like the board over a đình's gate.
	var plaque := PanelContainer.new()
	plaque.name = "DinhPlaque"
	plaque.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var box: StyleBoxFlat = XomDaoUi.box(XomDaoUi.LACQUER, XomDaoUi.GOLD, 3, 10.0)
	box.content_margin_left = 26.0
	box.content_margin_right = 26.0
	box.content_margin_top = 4.0
	box.content_margin_bottom = 6.0
	box.shadow_color = XomDaoUi.SHADOW
	box.shadow_size = 6
	box.shadow_offset = Vector2(0.0, 4.0)
	plaque.add_theme_stylebox_override("panel", box)
	var title := Label.new()
	title.text = "Đình làng"
	title.add_theme_font_override("font", XomDaoUi.display_font(800))
	title.add_theme_font_size_override("font_size", 34)
	title.add_theme_color_override("font_color", XomDaoUi.SUN)
	plaque.add_child(title)
	_art_side.add_child(plaque)


func _build_board() -> void:
	_board.name = "RankingBoard"
	_stage.add_child(_board)
	var column: VBoxContainer = _board.content
	column.add_theme_constant_override("separation", 10)
	# Many games' tabs scroll sideways.
	var strip := ScrollContainer.new()
	strip.custom_minimum_size = Vector2(WIDTH, 76.0)
	strip.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	strip.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	column.add_child(strip)
	_tabs.name = "Tabs"
	_tabs.add_theme_constant_override("separation", 10)
	strip.add_child(_tabs)
	_scroll.name = "Ranking"
	_scroll.custom_minimum_size = Vector2(WIDTH, 400.0)
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(_scroll)
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 6)
	_scroll.add_child(_list)
	_podium.name = "Podium"
	_podium.alignment = BoxContainer.ALIGNMENT_CENTER
	_podium.add_theme_constant_override("separation", 8)
	_list.add_child(_podium)
	_rows.add_theme_constant_override("separation", 6)
	_list.add_child(_rows)
	_empty.name = "RankingEmpty"
	_empty.text = "Đang tải"
	_empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_empty.custom_minimum_size = Vector2(WIDTH, ROW_HEIGHT)
	column.add_child(_empty)
	column.add_child(_me)


func _draw_shadow() -> void:
	# The đình's reflection-dark patch on the water grounds it.
	var pts := PackedVector2Array()
	var middle := Vector2(ART.x / 2.0, ART.y - 60.0)
	for i: int in 28:
		var a: float = float(i) * TAU / 28.0
		pts.append(middle + Vector2(cos(a) * 170.0, sin(a) * 44.0))
	_art_stage.draw_colored_polygon(pts, Color(0.06, 0.12, 0.2, 0.3))


func _bob() -> void:
	var bob := create_tween().set_loops()
	bob.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	bob.tween_property(_art, "position:y", -6.0, 2.0)
	bob.tween_property(_art, "position:y", 3.0, 2.0)


## The tabs: Cả xóm, then `games` ([[id, name], …]); the first is picked.
func set_boards(games: Array) -> void:
	_boards = [["core", "Cả xóm"]]
	_boards.append_array(games)
	select("core")


func select(id: String) -> void:
	board = id
	for child: Node in _tabs.get_children():
		_tabs.remove_child(child)
		child.queue_free()
	for pair: Array in _boards:
		var button: XomDaoButton = XomDaoButton.create(
			str(pair[1]), XomDaoUi.Kind.GO if pair[0] == id else XomDaoUi.Kind.BACK
		)
		button.name = "Tab_" + str(pair[0])
		button.custom_minimum_size = Vector2(140.0, 64.0)
		button.pressed.connect(_on_tab.bind(str(pair[0])))
		_tabs.add_child(button)
	_clear()
	_empty.visible = true
	_empty.text = "Đang tải"
	_scroll.visible = false
	board_changed.emit(id)
	_layout.call_deferred()


## Shows a board: the top three on the podium, the rest as rows, and your row below when you
## are not among them.
func show_ranking(ranking: XomDaoRanking, me: String) -> void:
	if ranking.board != board:
		return
	_clear()
	var unit: String = "kinh nghiệm" if board == "core" else "thắng"
	var entries: Array[XomDaoRankingEntry] = ranking.entries
	# Podium order: second, first, third.
	for index: int in [1, 0, 2]:
		if index < entries.size():
			_podium.add_child(_step(entries[index], index + 1, unit, entries[index].id == me))
	for index: int in range(3, entries.size()):
		_rows.add_child(_row(entries[index], unit, entries[index].id == me))
	_scroll.visible = not entries.is_empty()
	_empty.visible = entries.is_empty()
	_empty.text = "Chưa có ai"
	var listed: bool = entries.any(func(e: XomDaoRankingEntry) -> bool: return e.id == me)
	if ranking.me != null and not listed:
		var row: Control = _row(ranking.me, unit, true)
		row.name = "RankMe"
		_me.add_child(row)
	_layout.call_deferred()


func _clear() -> void:
	for parent: Node in [_podium, _rows, _me]:
		for child: Node in parent.get_children():
			parent.remove_child(child)
			child.queue_free()


## One podium column: avatar, name and value over a step whose height and colour follow the
## place (`slot` 1–3; tied players keep their shared rank on the step).
func _step(entry: XomDaoRankingEntry, slot: int, unit: String, mine: bool) -> Control:
	var column := VBoxContainer.new()
	column.name = "Rank_%d" % entry.rank
	column.custom_minimum_size.x = 180.0
	column.size_flags_vertical = Control.SIZE_SHRINK_END
	column.add_theme_constant_override("separation", 4)
	var avatar: XomDaoAvatar = _avatar(entry, 84.0 if slot == 1 else 68.0)
	avatar.crown = entry.rank == 1
	avatar.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(avatar)
	var who: Label = _name(entry, mine)
	who.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	who.add_theme_color_override("font_color", XomDaoUi.HONEY_DARK if mine else XomDaoUi.INK)
	column.add_child(who)
	var value: XomDaoChip = _value(entry, unit)
	value.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(value)
	var step := PanelContainer.new()
	step.custom_minimum_size.y = float(STEPS[slot][0])
	var face: Color = STEPS[mini(entry.rank, 3)][1]
	var box: StyleBoxFlat = XomDaoUi.box(face, face.darkened(0.35), 3, 10.0)
	box.corner_radius_bottom_left = 0
	box.corner_radius_bottom_right = 0
	box.border_width_bottom = 0
	step.add_theme_stylebox_override("panel", box)
	var place := Label.new()
	place.text = str(entry.rank)
	place.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	place.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	place.add_theme_font_override("font", XomDaoUi.display_font(800))
	place.add_theme_font_size_override("font_size", 40 if slot == 1 else 32)
	place.add_theme_color_override("font_color", face.darkened(0.55))
	step.add_child(place)
	column.add_child(step)
	return column


func _row(entry: XomDaoRankingEntry, unit: String, mine: bool) -> Control:
	var row := PanelContainer.new()
	row.name = "Rank_%d" % entry.rank if not mine else "RankMine"
	row.custom_minimum_size = Vector2(WIDTH - 20.0, ROW_HEIGHT)
	var box: StyleBoxFlat = XomDaoUi.box(
		XomDaoUi.SAND if mine else XomDaoUi.CREAM, XomDaoUi.PAPER_DARK, 2, 14.0
	)
	box.content_margin_left = 12.0
	box.content_margin_right = 12.0
	row.add_theme_stylebox_override("panel", box)
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 14)
	row.add_child(line)
	var place := Label.new()
	place.text = str(entry.rank)
	place.custom_minimum_size.x = 56.0
	place.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	place.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	place.add_theme_font_override("font", XomDaoUi.display_font(800))
	place.add_theme_font_size_override("font_size", 30)
	place.add_theme_color_override("font_color", XomDaoUi.HONEY_DARK)
	line.add_child(place)
	var avatar: XomDaoAvatar = _avatar(entry, 50.0)
	avatar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(avatar)
	var who: Label = _name(entry, mine)
	who.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	who.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	line.add_child(who)
	var value: XomDaoChip = _value(entry, unit)
	value.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(value)
	return row


func _avatar(entry: XomDaoRankingEntry, side: float) -> XomDaoAvatar:
	var avatar := XomDaoAvatar.new()
	avatar.custom_minimum_size = Vector2.ONE * side
	avatar.initial = entry.name
	avatar.picture = XomDaoLooks.avatar(entry.avatar)
	avatar.frame = entry.frame
	return avatar


func _name(entry: XomDaoRankingEntry, mine: bool) -> Label:
	var who := Label.new()
	who.name = "Name"
	who.text = "%s (bạn)" % entry.name if mine else entry.name
	who.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	who.add_theme_font_override("font", XomDaoUi.display_font(800))
	return who


func _value(entry: XomDaoRankingEntry, unit: String) -> XomDaoChip:
	var value := XomDaoChip.create("%s %s" % [XomDaoUi.money(entry.value), unit])
	value.name = "Value"
	value.compact()
	return value


func _on_tab(id: String) -> void:
	if id != board:
		select(id)


## The đình and the board side by side, scaled together to fit under the top bar.
func _layout() -> void:
	if not is_inside_tree():
		return
	top._layout()
	var top_y: float = top.bottom() + 8.0
	var edge: float = XomDaoSettings.current().margin
	var room := Vector2(maxf(100.0, size.x - 2.0 * edge), maxf(100.0, size.y - top_y - edge))
	_art_side.reset_size()
	_board.reset_size()
	var art: Vector2 = _art_side.size
	var plank: Vector2 = _board.size
	var whole := Vector2(art.x + GAP + plank.x, maxf(art.y, plank.y))
	var k: float = clampf(minf(room.x / whole.x, room.y / whole.y), 0.2, 1.0)
	_stage.scale = Vector2.ONE * k
	_stage.position = Vector2(
		edge + (room.x - whole.x * k) / 2.0, top_y + (room.y - whole.y * k) / 2.0
	)
	_art_side.position = Vector2(0.0, (whole.y - art.y) / 2.0)
	_board.position = Vector2(art.x + GAP, (whole.y - plank.y) / 2.0)
