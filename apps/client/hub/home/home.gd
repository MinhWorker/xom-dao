class_name HubHome
extends Control
## Nhà (docs/experience.md): a player's four pages, picked from a stack of tabs down the left side
## (HubHomeTab): Hồ sơ, Túi đồ, Thành tích and Lịch sử (your own Nhà only). The page fills a paper
## plate on the right. Hồ sơ shows their avatar in the frame they wear, their name, level and its
## progress, games played and won, and what they wear. Túi đồ is a grid of same-size cells
## (HubBagCell) under a row of kinds in the top right corner (Tất cả, Khung, Lưng bài); a tap on a
## cell slides a drawer in from the right with the item's picture, name and kind and, in your own
## Nhà, what you can do with it (Dùng for something to wear). Thành tích is a grid of tiles and
## Lịch sử a list of finished games; all scroll down.
##
## Named nodes for tests: Tab_<id> (ho-so, tui-do, thanh-tich, lich-su), Match_<i>, HomePlate,
## HomeName, HomeAvatar, HomeLevel, HomeXp, HomePlayed, HomeWon, HomeRate, HomeCardBack, HomeFrame,
## Shelf, ShelfEmpty, BagKinds, Item_<key>, ItemDrawer, ItemName, ItemKind, Equip_<key>,
## DrawerClose, AccountButton.

signal back_pressed
## Dùng on an item of Túi đồ (your own Nhà only).
signal equip_requested(item_id: String)
## Tài khoản next to ← (your own Nhà only).
signal account_pressed

## [id, label, icon], top to bottom.
const TABS: Array[Array] = [
	["ho-so", "Hồ sơ", "house"],
	["tui-do", "Túi đồ", "gift"],
	["thanh-tich", "Thành tích", "medal"],
	["lich-su", "Lịch sử", "clock"],
]
const TAB_GAP := 12.0
const GAP := 20.0
const ROUND := 28.0
const PAD := 24.0
const AVATAR := 208.0
## The kinds of Túi đồ, left to right: [slot ("" for every item), label].
const KINDS: Array[Array] = [["", "Tất cả"], ["frame", "Khung"], ["card-back", "Lưng bài"]]
const DRAWER_W := 300.0

var top: HubTopBar
var editable: bool = true
## The page on show (an id of TABS).
var tab: String = "ho-so"

var _settings: XomDaoSettings
var _profile: XomDaoProfile
## Level, achievements and ranks (`stats:get`); null until they come.
var _stats: XomDaoPlayerStats
## Game names by id, for achievements and ranks.
var _games: Dictionary = {}
## Every item (`shop:list`), for names and pictures.
var _items: Array[XomDaoShopItem] = []
## Your finished games (`history:recent`); null until they come.
var _matches: Variant = null
var _tabs := VBoxContainer.new()
var _plate := Control.new()
var _page := Control.new()
var _avatar := XomDaoAvatar.new()
var _name := Label.new()
var _level: XomDaoChip = XomDaoChip.create("Cấp 1", "star", XomDaoUi.HONEY_DARK)
var _xp := ProgressBar.new()
var _xp_text := Label.new()
var _played := Label.new()
var _won := Label.new()
var _rate := Label.new()
var _totals := HBoxContainer.new()
var _worn := HBoxContainer.new()
var _frame := TextureRect.new()
var _back := TextureRect.new()
var _heading := Label.new()
var _scroll := ScrollContainer.new()
var _grid := HFlowContainer.new()
var _empty := Label.new()
var _kinds: XomDaoChoice
## The item whose drawer is open ("" for none).
var _picked: String = ""
var _drawer := Control.new()
var _drawer_picture := TextureRect.new()
var _drawer_name := Label.new()
var _drawer_kind := Label.new()
var _drawer_foot := VBoxContainer.new()
## 0 (shut) to 1 (open): how far the drawer is out.
var _drawer_out: float = 0.0:
	set(value):
		_drawer_out = value
		_layout()
## Tài khoản, next to ← (your own Nhà only).
var _account: XomDaoIconButton = XomDaoIconButton.create("user-plus")


func _init(settings: XomDaoSettings = null, own: bool = true) -> void:
	name = "Home"
	editable = own
	_settings = settings if settings != null else XomDaoSettings.current()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSky.new())
	top = HubTopBar.new(_settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	if own:
		_account.name = "AccountButton"
		_account.pressed.connect(account_pressed.emit)
		top.add_child(_account)
	_tabs.name = "Tabs"
	_tabs.add_theme_constant_override("separation", int(TAB_GAP))
	add_child(_tabs)
	for entry: Array in TABS:
		# Only your own games are yours to read.
		if str(entry[0]) == "lich-su" and not own:
			continue
		var button: HubHomeTab = HubHomeTab.create(str(entry[0]), str(entry[1]), str(entry[2]))
		button.pressed.connect(select.bind(str(entry[0])))
		_tabs.add_child(button)
	_plate.name = "HomePlate"
	_plate.draw.connect(_draw_plate)
	add_child(_plate)
	_build_profile()
	_build_grid()
	_build_drawer()
	resized.connect(_layout)
	_settings.changed.connect(_layout)
	select(tab)


func _ready() -> void:
	_layout()


## Shows a page (an id of TABS).
func select(id: String) -> void:
	tab = id
	for button: HubHomeTab in _tabs.get_children():
		button.selected = button.name == "Tab_" + id
		if button.selected:
			_heading.text = button.label
	_page.visible = id == "ho-so"
	_kinds.visible = id == "tui-do"
	if id != "tui-do":
		_pick("")
	_heading.visible = id != "ho-so"
	if id != "ho-so":
		_show_tab_page()
	else:
		_scroll.visible = false
		_empty.visible = false
	_layout()


## Shows a player's Nhà (`inventory:get`), naming items from `items` (`shop:list`).
func show_profile(profile: XomDaoProfile, items: Array[XomDaoShopItem]) -> void:
	_profile = profile
	_items = items
	_name.text = profile.name
	_avatar.initial = profile.name
	_avatar.picture = XomDaoLooks.avatar(profile.avatar)
	_avatar.frame = profile.frame
	_frame.texture = XomDaoLooks.frame(profile.frame)
	_back.texture = XomDaoLooks.card_back(profile.card_back)
	select(tab)


## Shows their level, totals, achievements and ranks (`stats:get`); `games` names games by id.
func show_stats(stats: XomDaoPlayerStats, games: Dictionary) -> void:
	_stats = stats
	_games = games
	_level.text = "Cấp %d" % stats.level
	_xp.max_value = maxi(1, stats.next_xp - stats.level_xp)
	_xp.value = stats.xp - stats.level_xp
	_xp_text.text = "%s / %s" % [XomDaoUi.money(int(_xp.value)), XomDaoUi.money(int(_xp.max_value))]
	_played.text = "%s ván" % XomDaoUi.money(stats.played)
	_won.text = "%s thắng" % XomDaoUi.money(stats.won)
	_rate.text = "%d%% thắng" % roundi(100.0 * stats.won / maxi(1, stats.played))
	select(tab)


## Shows your finished games (`history:recent`), newest first; `games` names games by id.
func show_history(matches: Array[XomDaoMatchRecord], games: Dictionary) -> void:
	_matches = matches
	_games = games
	select(tab)


## Hồ sơ: the avatar on the left; name, level, totals and what they wear beside it.
func _build_profile() -> void:
	_page.name = "ProfilePage"
	_plate.add_child(_page)
	_avatar.name = "HomeAvatar"
	_page.add_child(_avatar)
	_name.name = "HomeName"
	_name.theme_type_variation = "TitleLabel"
	_name.clip_text = true
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_page.add_child(_name)
	_level.name = "HomeLevel"
	_page.add_child(_level)
	_xp.name = "HomeXp"
	_xp.show_percentage = false
	_xp.add_theme_stylebox_override(
		"background", XomDaoUi.box(XomDaoUi.PAPER_DARK, Color.TRANSPARENT, 0, 10.0)
	)
	_xp.add_theme_stylebox_override("fill", XomDaoUi.box(XomDaoUi.GOLD, Color.TRANSPARENT, 0, 10.0))
	_page.add_child(_xp)
	_xp_text.theme_type_variation = "SmallLabel"
	_xp_text.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.7))
	_xp_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_page.add_child(_xp_text)
	_totals.add_theme_constant_override("separation", 14)
	_page.add_child(_totals)
	var names: Array[String] = ["HomePlayed", "HomeWon", "HomeRate"]
	var starts: Array[String] = ["0 ván", "0 thắng", "0% thắng"]
	var labels: Array[Label] = [_played, _won, _rate]
	for i: int in labels.size():
		var box := PanelContainer.new()
		box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var style: StyleBoxFlat = XomDaoUi.box(Color("#FFF9EC"), XomDaoUi.PAPER_DARK, 2, 18.0)
		style.set_content_margin_all(14.0)
		box.add_theme_stylebox_override("panel", style)
		labels[i].name = names[i]
		labels[i].text = starts[i]
		labels[i].add_theme_font_override("font", XomDaoUi.display_font(800))
		labels[i].add_theme_font_size_override("font_size", 30)
		labels[i].horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		box.add_child(labels[i])
		_totals.add_child(box)
	# What they wear: the frame and the back of their cards.
	_worn.add_theme_constant_override("separation", 28)
	_page.add_child(_worn)
	_frame.name = "HomeFrame"
	_back.name = "HomeCardBack"
	var pictures: Array[TextureRect] = [_frame, _back]
	var captions: Array[String] = ["Khung", "Lưng bài"]
	for i: int in pictures.size():
		var pair := HBoxContainer.new()
		pair.add_theme_constant_override("separation", 12)
		pictures[i].expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		pictures[i].stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		pictures[i].custom_minimum_size = Vector2(72.0, 96.0)
		pictures[i].texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		pair.add_child(pictures[i])
		var caption := Label.new()
		caption.text = captions[i]
		caption.theme_type_variation = "SmallLabel"
		caption.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.75))
		pair.add_child(caption)
		_worn.add_child(pair)


## The other pages: a heading over tiles that wrap into rows and scroll down.
func _build_grid() -> void:
	_heading.theme_type_variation = "TitleLabel"
	_heading.add_theme_font_size_override("font_size", 38)
	_plate.add_child(_heading)
	_scroll.name = "ShelfScroll"
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_plate.add_child(_scroll)
	_grid.name = "Shelf"
	_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_grid.add_theme_constant_override("h_separation", 14)
	_grid.add_theme_constant_override("v_separation", 14)
	_scroll.add_child(_grid)
	_empty.name = "ShelfEmpty"
	_empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_empty.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_empty.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.7))
	_plate.add_child(_empty)


## These tiles in the grid, or `empty` when there are none.
func _show_tiles(tiles: Array[Control], empty: String = "") -> void:
	for child: Node in _grid.get_children():
		_grid.remove_child(child)
		child.queue_free()
	for tile: Control in tiles:
		_grid.add_child(tile)
	_scroll.visible = not tiles.is_empty()
	_empty.visible = tiles.is_empty()
	_empty.text = empty


func _show_tab_page() -> void:
	if tab == "thanh-tich":
		_show_achievements()
	elif tab == "lich-su":
		_show_history()
	elif _profile != null:
		var slot: String = str(KINDS[_kinds.selected][0])
		var cells: Array[Control] = []
		# What was bought first, then what everyone has.
		for bought: bool in [true, false]:
			for item: XomDaoShopItem in _items:
				if not _profile.owned.has(item.id) or (item.price > 0) != bought:
					continue
				if slot != "" and item.slot != slot:
					continue
				var cell: HubBagCell = HubBagCell.create(item, _wears(item))
				cell.picked = item.id == _picked
				cell.pressed.connect(_pick.bind(item.id))
				cells.append(cell)
		_show_tiles(cells, "Túi đồ trống")
		_fill_drawer()


## Reached first, then the rest in their order (the hub's own, then each game's).
func _show_achievements() -> void:
	var tiles: Array[Control] = []
	if _stats != null:
		for reached: bool in [true, false]:
			for info: XomDaoAchievementInfo in _stats.achievements:
				if info.unlocked == reached:
					tiles.append(HubAchievementTile.create(info, str(_games.get(info.game_id, ""))))
	_show_tiles(tiles, "Đang tải")


## Your finished games, newest first, one row each.
func _show_history() -> void:
	var rows: Array[Control] = []
	var now: float = Time.get_unix_time_from_system() * 1000.0
	if _matches != null:
		for i: int in _matches.size():
			var record: XomDaoMatchRecord = _matches[i]
			var row: HubMatchRow = HubMatchRow.create(
				record, str(_games.get(record.game_id, record.game_id)), now
			)
			row.name = "Match_%d" % i
			rows.append(row)
	_show_tiles(rows, "Chưa chơi ván nào" if _matches != null else "Đang tải")
	_layout()


func _wears(item: XomDaoShopItem) -> bool:
	return (
		(item.slot == "frame" and item.look == _profile.frame)
		or (item.slot == "card-back" and item.look == _profile.card_back)
	)


## Opens the drawer on an item of Túi đồ; the same item again, or "", shuts it.
func _pick(item_id: String) -> void:
	_picked = "" if item_id == _picked else item_id
	for child: Node in _grid.get_children():
		if child is HubBagCell:
			child.picked = child.item.id == _picked
	_fill_drawer()
	var out: float = 1.0 if _picked != "" else 0.0
	if is_inside_tree() and not is_equal_approx(out, _drawer_out):
		(
			create_tween()
			. tween_property(self, "_drawer_out", out, 0.2)
			. set_trans(Tween.TRANS_CUBIC)
			. set_ease(Tween.EASE_OUT)
		)
	else:
		_drawer_out = out


## The drawer's words and what can be done with the item: something to wear has Dùng (your own
## Nhà), or says it is worn; other kinds of item have no action yet.
func _fill_drawer() -> void:
	for child: Node in _drawer_foot.get_children():
		_drawer_foot.remove_child(child)
		child.queue_free()
	var item: XomDaoShopItem = null
	for candidate: XomDaoShopItem in _items:
		if candidate.id == _picked:
			item = candidate
	if item == null or _profile == null:
		return
	_drawer_picture.texture = XomDaoLooks.preview(item.slot, item.look)
	_drawer_name.text = item.name
	var kind: String = "Vật phẩm"
	for entry: Array in KINDS:
		if str(entry[0]) == item.slot:
			kind = str(entry[1])
	_drawer_kind.text = kind
	var wearable: bool = item.slot == "frame" or item.slot == "card-back"
	var worn: bool = _wears(item)
	if wearable and editable:
		var button: XomDaoButton = XomDaoButton.create(
			"Đang dùng" if worn else "Dùng", XomDaoUi.Kind.CONFIRM if worn else XomDaoUi.Kind.GO
		)
		button.name = "Equip_" + HubItemTile.key_of(item.id)
		button.custom_minimum_size = Vector2(0.0, 72.0)
		button.disabled = worn
		button.pressed.connect(func() -> void: equip_requested.emit(item.id))
		_drawer_foot.add_child(button)
	elif worn:
		var chip := XomDaoChip.create("Đang dùng", "check-circle", XomDaoUi.BAMBOO_DARK)
		chip.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		_drawer_foot.add_child(chip)


## The drawer: a darker sheet of paper on the plate's right side, the item big on it.
func _build_drawer() -> void:
	_kinds = XomDaoChoice.create(["Tất cả", "Khung", "Lưng bài"])
	_kinds.name = "BagKinds"
	_kinds.compact = true
	_kinds.changed.connect(func(_index: int) -> void: _show_tab_page())
	_plate.add_child(_kinds)
	_drawer.name = "ItemDrawer"
	_drawer.clip_contents = true
	_drawer.draw.connect(
		func() -> void:
			var sheet: StyleBoxFlat = XomDaoUi.box(XomDaoUi.SAND, XomDaoUi.PAPER_DARK, 2, 20.0)
			_drawer.draw_style_box(sheet, Rect2(Vector2.ZERO, Vector2(DRAWER_W, _drawer.size.y)))
	)
	_plate.add_child(_drawer)
	var close: XomDaoIconButton = XomDaoIconButton.create("x")
	close.name = "DrawerClose"
	close.scale = Vector2.ONE * 0.6
	close.position = Vector2(DRAWER_W - XomDaoIconButton.SIZE * 0.6 - 10.0, 10.0)
	close.pressed.connect(_pick.bind(""))
	_drawer.add_child(close)
	_drawer_picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_drawer_picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_drawer_picture.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_drawer_picture.position = Vector2(50.0, 56.0)
	_drawer_picture.size = Vector2(DRAWER_W - 100.0, 180.0)
	_drawer.add_child(_drawer_picture)
	_drawer_name.name = "ItemName"
	_drawer_name.theme_type_variation = "TitleLabel"
	_drawer_name.add_theme_font_size_override("font_size", 32)
	_drawer_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_drawer_name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_drawer_name.position = Vector2(16.0, 250.0)
	_drawer_name.size = Vector2(DRAWER_W - 32.0, 84.0)
	_drawer.add_child(_drawer_name)
	_drawer_kind.name = "ItemKind"
	_drawer_kind.theme_type_variation = "SmallLabel"
	_drawer_kind.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.7))
	_drawer_kind.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_drawer_kind.position = Vector2(16.0, 336.0)
	_drawer_kind.size = Vector2(DRAWER_W - 32.0, 32.0)
	_drawer.add_child(_drawer_kind)
	_drawer_foot.alignment = BoxContainer.ALIGNMENT_END
	_drawer.add_child(_drawer_foot)


func _draw_plate() -> void:
	XomDaoPuff.paint(
		_plate,
		Rect2(Vector2.ZERO, _plate.size),
		XomDaoUi.PAPER,
		XomDaoUi.HONEY_DARK,
		ROUND,
		8.0,
		false,
		3,
		false,
		false
	)


func _layout() -> void:
	if not is_inside_tree():
		return
	top._layout()
	_account.scale = top.back.scale
	_account.position = (
		top.back.position + Vector2((XomDaoIconButton.SIZE + 12.0) * _account.scale.x, 0.0)
	)
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = _settings.margin
	var left: float = inset.x + edge
	var up: float = top.bottom() + 12.0
	var down: float = size.y - inset.y - edge
	_tabs.position = Vector2(left, up)
	_tabs.size = Vector2(HubHomeTab.SIZE.x, 0.0)
	var plate_left: float = left + HubHomeTab.SIZE.x + GAP
	_plate.position = Vector2(plate_left, up)
	_plate.size = Vector2(size.x - inset.x - edge - plate_left, down - up)
	_plate.queue_redraw()
	var inner := Rect2(PAD, PAD, _plate.size.x - PAD * 2.0, _plate.size.y - 8.0 - PAD * 2.0)
	_page.position = inner.position
	_page.size = inner.size
	_layout_profile(inner.size)
	_heading.position = inner.position
	_heading.size = Vector2(inner.size.x, 48.0)
	_kinds.reset_size()
	_kinds.position = Vector2(inner.end.x - _kinds.size.x, inner.position.y - 6.0)
	# The drawer comes out of the right edge and the grid makes room for it.
	var out: float = (DRAWER_W + 16.0) * _drawer_out
	_scroll.position = inner.position + Vector2(0.0, 72.0)
	_scroll.size = inner.size - Vector2(out, 72.0)
	_drawer.visible = _drawer_out > 0.0
	_drawer.position = Vector2(inner.end.x - DRAWER_W * _drawer_out, _scroll.position.y)
	_drawer.size = Vector2(DRAWER_W * _drawer_out, _scroll.size.y)
	_drawer_foot.position = Vector2(20.0, _drawer.size.y - 20.0 - 80.0)
	_drawer_foot.size = Vector2(DRAWER_W - 40.0, 80.0)
	# A row of Lịch sử is as wide as the page.
	for child: Node in _grid.get_children():
		if child is HubMatchRow:
			child.custom_minimum_size.x = _scroll.size.x - 18.0
	_empty.position = _scroll.position
	_empty.size = _scroll.size


func _layout_profile(room: Vector2) -> void:
	_avatar.size = Vector2.ONE * AVATAR
	_avatar.position = Vector2(8.0, 8.0)
	var x: float = AVATAR + 40.0
	var wide: float = room.x - x
	_name.position = Vector2(x, 0.0)
	_name.size = Vector2(wide, 60.0)
	_level.reset_size()
	_level.position = Vector2(x, 72.0)
	var bar_left: float = x + _level.size.x + 14.0
	_xp.position = Vector2(bar_left, 72.0 + (_level.size.y - 20.0) / 2.0)
	_xp.size = Vector2(room.x - bar_left, 20.0)
	_xp_text.position = Vector2(bar_left, _xp.position.y + 24.0)
	_xp_text.size = Vector2(_xp.size.x, 28.0)
	_totals.position = Vector2(x, 72.0 + _level.size.y + 44.0)
	_totals.size = Vector2(wide, 0.0)
	_totals.reset_size()
	_totals.size.x = wide
	_worn.position = Vector2(8.0, maxf(AVATAR + 36.0, _totals.position.y + _totals.size.y + 28.0))
	_worn.reset_size()
