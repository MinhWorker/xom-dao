class_name HubDinh
extends Control
## Đình (docs/experience.md): the village's rankings. One board with a tab per ranking (Cả xóm
## by experience, then each game by wins) over the top players, each a row with their place,
## avatar, name and value; your own row stays under the list when you are below the top.
## In development: clean, simple visual vignette over the sea.

signal back_pressed
## A tab was picked: the hub fetches that board (`ranking:get`).
signal board_changed(board: String)

const WIDTH := 640.0
const ROW_HEIGHT := 72.0

var top := HubTopBar.new()
var board: String = "core"

var _board: XomDaoBoard = XomDaoBoard.create("Xếp hạng")
var _tabs := HBoxContainer.new()
var _scroll := ScrollContainer.new()
var _rows := VBoxContainer.new()
var _empty := Label.new()
var _me := VBoxContainer.new()
## Tabs as [[board, label], …].
var _boards: Array = []

var _center := VBoxContainer.new()
var _art_stage := Control.new()
var _dev_art := TextureRect.new()
var _dev_art_base_y: float = 0.0


func _init(settings: XomDaoSettings = null) -> void:
	name = "Dinh"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	top = HubTopBar.new(settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	_board.name = "RankingBoard"
	_board.visible = false
	add_child(_board)
	var column: VBoxContainer = _board.content
	column.add_theme_constant_override("separation", 12)
	# Many games' tabs scroll sideways.
	var strip := ScrollContainer.new()
	strip.custom_minimum_size = Vector2(WIDTH, 84.0)
	strip.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	strip.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	column.add_child(strip)
	_tabs.name = "Tabs"
	_tabs.add_theme_constant_override("separation", 10)
	strip.add_child(_tabs)
	_scroll.name = "Ranking"
	_scroll.custom_minimum_size = Vector2(WIDTH, ROW_HEIGHT * 5.0)
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(_scroll)
	_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_rows.add_theme_constant_override("separation", 6)
	_scroll.add_child(_rows)
	_empty.name = "RankingEmpty"
	_empty.text = "Đang tải"
	_empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_empty.custom_minimum_size = Vector2(WIDTH, ROW_HEIGHT)
	column.add_child(_empty)
	column.add_child(_me)
	_build_visual()
	resized.connect(_layout)


func _ready() -> void:
	_start_anim()
	_layout()


func _build_visual() -> void:
	_center.name = "DevCenter"
	_center.alignment = BoxContainer.ALIGNMENT_CENTER
	_center.add_theme_constant_override("separation", 14)
	add_child(_center)

	_art_stage.custom_minimum_size = Vector2(320.0, 260.0)
	_art_stage.draw.connect(_draw_shadow)
	_center.add_child(_art_stage)

	_dev_art.name = "DevArt"
	_dev_art.texture = preload("res://hub/dinh/dev-dinh.webp")
	_dev_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_dev_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_dev_art.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_dev_art.size = Vector2(300.0, 250.0)
	_dev_art.position = Vector2(10.0, 0.0)
	_art_stage.add_child(_dev_art)

	var title := Label.new()
	title.name = "DevTitle"
	title.text = "Đình làng đang trùng tu"
	title.add_theme_font_override("font", XomDaoUi.display_font(800))
	title.add_theme_font_size_override("font_size", 38)
	title.add_theme_color_override("font_color", XomDaoUi.CREAM)
	title.add_theme_color_override("font_outline_color", Color("#3A1F0D", 0.95))
	title.add_theme_constant_override("outline_size", 10)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_center.add_child(title)

	var badge := XomDaoChip.create("Sắp ra mắt trên Xóm Đảo", "clock", Color("#16233F", 0.88))
	badge.name = "DevBadge"
	badge.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_center.add_child(badge)


func _draw_shadow() -> void:
	# Soft grounding shadow under the diorama on the water
	var shadow_color := Color(0.06, 0.12, 0.20, 0.32)
	var pts := PackedVector2Array()
	var cx: float = 160.0
	var cy: float = 236.0
	var rx: float = 120.0
	var ry: float = 38.0
	for i: int in 24:
		var a: float = float(i) * TAU / 24.0
		pts.append(Vector2(cx + cos(a) * rx, cy + sin(a) * ry))
	_art_stage.draw_colored_polygon(pts, shadow_color)


func _start_anim() -> void:
	if not is_inside_tree():
		return
	var t := create_tween().set_loops()
	(
		t
		. tween_property(_dev_art, "position:y", _dev_art_base_y - 6.0, 2.0)
		. set_trans(Tween.TRANS_SINE)
		. set_ease(Tween.EASE_IN_OUT)
	)
	(
		t
		. tween_property(_dev_art, "position:y", _dev_art_base_y + 3.0, 2.0)
		. set_trans(Tween.TRANS_SINE)
		. set_ease(Tween.EASE_IN_OUT)
	)


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
		button.custom_minimum_size = Vector2(150.0, 72.0)
		button.pressed.connect(_on_tab.bind(str(pair[0])))
		_tabs.add_child(button)
	board_changed.emit(id)
	_layout.call_deferred()


## Shows a board's top players and, when it is not among them, your row below.
func show_ranking(ranking: XomDaoRanking, me: String) -> void:
	if ranking.board != board:
		return
	for parent: Node in [_rows, _me]:
		for child: Node in parent.get_children():
			parent.remove_child(child)
			child.queue_free()
	var unit: String = "kinh nghiệm" if board == "core" else "thắng"
	for entry: XomDaoRankingEntry in ranking.entries:
		_rows.add_child(_row(entry, unit, entry.id == me))
	_scroll.visible = not ranking.entries.is_empty()
	_empty.visible = ranking.entries.is_empty()
	_empty.text = "Chưa có ai"
	var listed: bool = ranking.entries.any(func(e: XomDaoRankingEntry) -> bool: return e.id == me)
	if ranking.me != null and not listed:
		var row: Control = _row(ranking.me, unit, true)
		row.name = "RankMe"
		_me.add_child(row)
	_layout.call_deferred()


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
	var place := XomDaoChip.create(
		str(entry.rank),
		"crown" if entry.rank == 1 else "",
		XomDaoUi.GOLD_DARK if entry.rank == 1 else XomDaoUi.HUD
	)
	place.compact()
	place.custom_minimum_size.x = 84.0
	place.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(place)
	var avatar := XomDaoAvatar.new()
	avatar.custom_minimum_size = Vector2(56.0, 56.0)
	avatar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	avatar.initial = entry.name
	avatar.frame = entry.frame
	line.add_child(avatar)
	var name_label := Label.new()
	name_label.name = "Name"
	name_label.text = entry.name
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	name_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	line.add_child(name_label)
	var value := XomDaoChip.create("%s %s" % [XomDaoUi.money(entry.value), unit])
	value.name = "Value"
	value.compact()
	value.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(value)
	return row


func _on_tab(id: String) -> void:
	if id != board:
		select(id)


func _layout() -> void:
	if not is_inside_tree():
		return
	top._layout()
	var top_y: float = top.bottom() + 10.0
	var edge: float = XomDaoSettings.current().margin
	var avail_h: float = maxf(100.0, size.y - top_y - edge)
	var avail_w: float = maxf(100.0, size.x - 2.0 * edge)

	_center.reset_size()
	var base_w: float = maxf(_center.size.x, 360.0)
	var base_h: float = maxf(_center.size.y, 380.0)
	var k: float = minf(1.0, minf(avail_w / base_w, avail_h / base_h))
	_center.scale = Vector2.ONE * maxf(k, 0.2)
	_center.position = Vector2(
		(size.x - base_w * _center.scale.x) / 2.0,
		top_y + (avail_h - base_h * _center.scale.y) / 2.0
	)
	_board.reset_size()
	_board.scale = _center.scale
	_board.position = _center.position
