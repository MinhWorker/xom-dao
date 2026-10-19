class_name HubHome
extends Control
## Nhà (docs/experience.md): a player's four pages, picked from a stack of tabs down the left side
## (HubHomeTab): Hồ sơ, Túi đồ, Thành tích and Lịch sử (your own Nhà only). The page fills a paper
## plate on the right. Hồ sơ shows their avatar in the frame they wear, their name (editable at any
## time), level and its progress, games played and won, and what they wear. Túi đồ is a grid of
## same-size cells
## (HubBagCell) under a row of kinds in the top right corner (Tất cả, Ảnh đại diện, Khung, Lưng
## bài, Biểu cảm); a tap on a cell slides a drawer in from the right with the item's picture, name
## and kind.
## In your own Nhà, it offers Dùng for something to wear. Thành tích is grouped by game with
## icon-only logo filters and a vertical progress list; Lịch sử is a list of finished games.
##
## Named nodes for tests: Tab_<id> (ho-so, tui-do, thanh-tich, lich-su), Match_<i>, HomePlate,
## HomeName, EditName, NameInput, SaveName, CancelName, HomeAvatar, HomeLevel, HomeXp, HomePlayed,
## HomeWon, HomeRate, HomeCardBack, HomeFrame, Shelf, ShelfEmpty, BagKinds, Item_<key>, ItemDrawer,
## ItemName, ItemKind, Equip_<key>,
## DrawerClose, AccountButton.

signal back_pressed
## Dùng on an item of Túi đồ (your own Nhà only).
signal equip_requested(item_id: String)
## A player changed their display name on Hồ sơ.
signal name_change_requested(name: String)
## Tài khoản at the bottom of the left rail (your own Nhà only).
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
const HISTORY_LIMIT := 20
## The kinds of Túi đồ, left to right: [slot ("" for every item), label].
const KINDS: Array[Array] = [
	["", "Tất cả"],
	["avatar", "Ảnh đại diện"],
	["frame", "Khung"],
	["card-back", "Lưng bài"],
	["emote", "Biểu cảm"]
]
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
var _edit_looks: XomDaoButton = XomDaoButton.create("Đổi diện mạo", XomDaoUi.Kind.INFO)
var _name_row := VBoxContainer.new()
var _identity_line := HBoxContainer.new()
var _name := Label.new()
var _edit_name := Button.new()
var _name_input := LineEdit.new()
var _save_name := Button.new()
var _cancel_name := Button.new()
var _name_error := Label.new()
var _username := Label.new()
var _copy := Button.new()
var _username_raw: String = ""
var _name_saving: bool = false
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
var _achievement_page := Control.new()
var _achievement_count := Label.new()
var _achievement_progress := ProgressBar.new()
var _achievement_filter_scroll := ScrollContainer.new()
var _achievement_filters := HBoxContainer.new()
var _achievement_scroll := ScrollContainer.new()
var _achievement_list := VBoxContainer.new()
var _achievement_empty := Label.new()
var _achievement_filter_buttons: Dictionary = {}
var _achievement_filter: String = "all"
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
## Đăng xuất / Tài khoản, at the bottom of the left rail (your own Nhà only).
var _account: XomDaoIconButton = XomDaoIconButton.create("sign-out")


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
		_account.background = Color("#141E30")
		_account.border = 2
		_account.edge = XomDaoUi.GOLD_DARK
		_account.lit = true
		_account.pressed.connect(account_pressed.emit)
		add_child(_account)
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
	_build_achievement_page()
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
	_achievement_page.visible = id == "thanh-tich"
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
	_name_input.text = profile.name
	_username_raw = profile.username
	if _username_raw == "" and editable and Net.client != null and Net.client.user != null:
		_username_raw = Net.client.user.username
	if _username_raw != "":
		_username.text = "#" + _username_raw.trim_prefix("#")
		_username.visible = true
		_copy.visible = true
	else:
		_username.text = ""
		_username.visible = false
		_copy.visible = false
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
	_edit_looks.name = "EditLooks"
	_edit_looks.pad = 8.0
	_edit_looks.add_theme_font_size_override("font_size", 26)
	_edit_looks.visible = editable
	_edit_looks.pressed.connect(_open_looks)
	_page.add_child(_edit_looks)
	_name_row.name = "HomeNameRow"
	_name_row.add_theme_constant_override("separation", 4)
	_page.add_child(_name_row)
	_identity_line.name = "IdentityLine"
	_identity_line.add_theme_constant_override("separation", 8)
	_identity_line.custom_minimum_size.y = 56.0
	_name_row.add_child(_identity_line)
	_name.name = "HomeName"
	_name.theme_type_variation = "TitleLabel"
	_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_identity_line.add_child(_name)
	_edit_name.name = "EditName"
	_style_identity_icon(_edit_name, "pencil-simple", "Đổi tên")
	_edit_name.visible = editable
	_edit_name.pressed.connect(_begin_name_edit)
	_identity_line.add_child(_edit_name)
	_name_input.name = "NameInput"
	_name_input.max_length = 20
	_name_input.placeholder_text = "Tên trong game"
	_name_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_name_input.custom_minimum_size.y = 52.0
	_name_input.add_theme_font_size_override("font_size", 26)
	var input_style: StyleBoxFlat = XomDaoUi.box(Color("#FFFDF7"), Color("#C8B693"), 2, 14.0)
	input_style.content_margin_left = 14.0
	input_style.content_margin_right = 14.0
	var input_focus: StyleBoxFlat = XomDaoUi.box(Color("#FFFDF7"), XomDaoUi.HONEY_DARK, 2, 14.0)
	input_focus.content_margin_left = 14.0
	input_focus.content_margin_right = 14.0
	_name_input.add_theme_stylebox_override("normal", input_style)
	_name_input.add_theme_stylebox_override("focus", input_focus)
	_name_input.add_theme_color_override("font_color", XomDaoUi.INK)
	_name_input.add_theme_color_override("font_placeholder_color", Color(XomDaoUi.INK, 0.4))
	_name_input.add_theme_color_override("caret_color", XomDaoUi.LACQUER)
	_name_input.visible = false
	_name_input.text_submitted.connect(func(_text: String) -> void: _submit_name())
	_identity_line.add_child(_name_input)
	_save_name.name = "SaveName"
	_style_identity_icon(_save_name, "check-circle", "Lưu tên")
	_save_name.visible = false
	_save_name.pressed.connect(_submit_name)
	_identity_line.add_child(_save_name)
	_cancel_name.name = "CancelName"
	_style_identity_icon(_cancel_name, "x", "Hủy đổi tên")
	_cancel_name.visible = false
	_cancel_name.pressed.connect(_cancel_name_edit)
	_identity_line.add_child(_cancel_name)
	_username.name = "HomeUsername"
	var font := FontVariation.new()
	font.base_font = XomDaoUi.display_font(700)
	font.variation_transform = Transform2D(Vector2(1.0, 0.0), Vector2(0.2, 1.0), Vector2.ZERO)
	_username.add_theme_font_override("font", font)
	_username.add_theme_font_size_override("font_size", 28)
	_username.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.55))
	_username.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_username.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_username.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_username.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_identity_line.add_child(_username)
	_copy.name = "HomeCopyUsername"
	_copy.icon = XomDaoUi.icon("copy")
	_copy.expand_icon = true
	_copy.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_copy.vertical_icon_alignment = VERTICAL_ALIGNMENT_CENTER
	_copy.custom_minimum_size = Vector2(36.0, 36.0)
	_copy.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_copy.focus_mode = Control.FOCUS_NONE
	_copy.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var copy_style: StyleBoxFlat = XomDaoUi.box(
		Color(XomDaoUi.PAPER_DARK, 0.5), Color.TRANSPARENT, 0, 8.0
	)
	var copy_hover: StyleBoxFlat = XomDaoUi.box(XomDaoUi.PAPER_DARK, XomDaoUi.HONEY, 1, 8.0)
	var copy_down: StyleBoxFlat = XomDaoUi.box(XomDaoUi.HONEY_DARK, Color.TRANSPARENT, 0, 8.0)
	_copy.add_theme_stylebox_override("normal", copy_style)
	_copy.add_theme_stylebox_override("hover", copy_hover)
	_copy.add_theme_stylebox_override("pressed", copy_down)
	_copy.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	_copy.add_theme_color_override("icon_normal_color", Color(XomDaoUi.INK, 0.7))
	_copy.add_theme_color_override("icon_hover_color", XomDaoUi.INK)
	_copy.add_theme_color_override("icon_pressed_color", XomDaoUi.CREAM)
	_copy.button_down.connect(XomDaoUi.bounce.bind(_copy))
	_copy.pressed.connect(_on_copy_username)
	_identity_line.add_child(_copy)
	_name_error.name = "NameError"
	_name_error.add_theme_font_size_override("font_size", 20)
	_name_error.add_theme_color_override("font_color", XomDaoUi.DOWN_ON_PAPER)
	_name_error.custom_minimum_size.y = 36.0
	_name_error.visible = false
	_name_row.add_child(_name_error)
	_level.name = "HomeLevel"
	_page.add_child(_level)
	_xp.name = "HomeXp"
	_xp.show_percentage = false
	var xp_bg := StyleBoxFlat.new()
	xp_bg.bg_color = Color(0.2, 0.14, 0.08, 0.18)
	xp_bg.border_width_left = 1
	xp_bg.border_width_top = 1
	xp_bg.border_width_right = 1
	xp_bg.border_width_bottom = 1
	xp_bg.border_color = Color("#824F18", 0.4)
	xp_bg.set_corner_radius_all(10)
	_xp.add_theme_stylebox_override("background", xp_bg)
	var xp_fill := StyleBoxFlat.new()
	xp_fill.bg_color = Color("#F5BA31")
	xp_fill.border_width_bottom = 2
	xp_fill.border_color = Color("#9C620E")
	xp_fill.set_corner_radius_all(10)
	_xp.add_theme_stylebox_override("fill", xp_fill)
	_page.add_child(_xp)
	_xp_text.theme_type_variation = "SmallLabel"
	_xp_text.add_theme_font_override("font", XomDaoUi.display_font(800))
	_xp_text.add_theme_color_override("font_color", Color("#4A2508"))
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
		var style: StyleBoxFlat = XomDaoUi.box(Color("#FFFDF7"), Color("#C4922F", 0.8), 2, 18.0)
		style.shadow_color = XomDaoPuff.SHADE
		style.shadow_size = 4
		style.shadow_offset = Vector2(0.0, 3.0)
		style.set_content_margin_all(14.0)
		box.add_theme_stylebox_override("panel", style)
		labels[i].name = names[i]
		labels[i].text = starts[i]
		labels[i].add_theme_font_override("font", XomDaoUi.display_font(800))
		labels[i].add_theme_font_size_override("font_size", 30)
		labels[i].add_theme_color_override("font_color", Color("#3D1F08"))
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
	_heading.add_theme_color_override("font_color", XomDaoUi.INK)
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


## Thành tích: compact overall progress, game logos as filters, and full-width rows below them.
func _build_achievement_page() -> void:
	_achievement_page.name = "AchievementPage"
	_achievement_page.visible = false
	_plate.add_child(_achievement_page)
	_achievement_count.name = "AchievementCount"
	_achievement_count.theme_type_variation = "SmallLabel"
	_achievement_count.add_theme_font_override("font", XomDaoUi.display_font(800))
	_achievement_count.add_theme_font_size_override("font_size", 20)
	_achievement_count.add_theme_color_override("font_color", XomDaoUi.INK)
	_achievement_count.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_achievement_page.add_child(_achievement_count)
	_achievement_progress.name = "AchievementOverallProgress"
	_achievement_progress.show_percentage = false
	var track := StyleBoxFlat.new()
	track.bg_color = Color(XomDaoUi.PAPER_DARK, 0.72)
	track.set_corner_radius_all(7)
	_achievement_progress.add_theme_stylebox_override("background", track)
	var fill := StyleBoxFlat.new()
	fill.bg_color = XomDaoUi.GOLD
	fill.set_corner_radius_all(7)
	_achievement_progress.add_theme_stylebox_override("fill", fill)
	_achievement_page.add_child(_achievement_progress)
	_achievement_filter_scroll.name = "AchievementFiltersScroll"
	_achievement_filter_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	_achievement_filter_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_achievement_page.add_child(_achievement_filter_scroll)
	_achievement_filters.name = "AchievementFilters"
	_achievement_filters.add_theme_constant_override("separation", 10)
	_achievement_filter_scroll.add_child(_achievement_filters)
	_achievement_scroll.name = "AchievementScroll"
	_achievement_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_achievement_page.add_child(_achievement_scroll)
	_achievement_list.name = "AchievementList"
	_achievement_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_achievement_list.add_theme_constant_override("separation", 10)
	_achievement_scroll.add_child(_achievement_list)
	_achievement_empty.name = "AchievementEmpty"
	_achievement_empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_achievement_empty.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_achievement_empty.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.7))
	_achievement_page.add_child(_achievement_empty)


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
		return
	_achievement_page.visible = false
	if tab == "lich-su":
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


## Game logos act as the category labels; the individual rows need no type text.
func _show_achievements() -> void:
	_scroll.visible = false
	_empty.visible = false
	_achievement_page.visible = true
	_achievement_filter_buttons.clear()
	for child: Node in _achievement_filters.get_children():
		_achievement_filters.remove_child(child)
		child.queue_free()
	for child: Node in _achievement_list.get_children():
		_achievement_list.remove_child(child)
		child.queue_free()
	if _stats == null:
		_achievement_count.text = "0 / 0 đã đạt"
		_achievement_progress.max_value = 1.0
		_achievement_progress.value = 0.0
		_achievement_filter = "all"
		_achievement_empty.text = "Đang tải"
		_achievement_empty.visible = true
		_achievement_scroll.visible = false
		_achievement_filter_scroll.visible = false
		return
	var categories: Array[String] = ["all"]
	var totals: Dictionary = {"all": _stats.achievements.size()}
	var reached: Dictionary = {"all": 0}
	for info: XomDaoAchievementInfo in _stats.achievements:
		var category: String = "core" if info.game_id == "" else info.game_id
		if not totals.has(category):
			categories.append(category)
			totals[category] = 0
			reached[category] = 0
		totals[category] = int(totals[category]) + 1
		if info.unlocked:
			reached[category] = int(reached[category]) + 1
			reached["all"] = int(reached["all"]) + 1
	var all_total: int = int(totals.get("all", 0))
	var all_reached: int = int(reached.get("all", 0))
	_achievement_count.text = (
		"%s / %s đã đạt" % [XomDaoUi.money(all_reached), XomDaoUi.money(all_total)]
	)
	_achievement_progress.max_value = maxi(1, all_total)
	_achievement_progress.value = all_reached
	if not categories.has(_achievement_filter):
		_achievement_filter = "all"
	for category: String in categories:
		var title: String = "Tất cả"
		var texture: Texture2D = XomDaoUi.icon("trophy")
		if category == "core":
			title = "Xóm Đảo"
			texture = XomDaoUi.icon("house")
		elif category != "all":
			title = str(_games.get(category, category))
			texture = HubAchievementFilter.logo_for_game(category)
		var filter := HubAchievementFilter.create(
			category,
			texture,
			title,
			int(reached.get(category, 0)),
			int(totals.get(category, 0)),
			category == _achievement_filter
		)
		filter.name = "AchievementFilter_" + category
		filter.pressed.connect(_select_achievement_filter.bind(category))
		_achievement_filters.add_child(filter)
		_achievement_filter_buttons[category] = filter
	_achievement_filter_scroll.visible = not categories.is_empty()
	_achievement_scroll.visible = not _stats.achievements.is_empty()
	_achievement_empty.visible = _stats.achievements.is_empty()
	_achievement_empty.text = "Chưa có thành tích"
	if not _stats.achievements.is_empty():
		_show_achievement_rows()
	_layout()


func _select_achievement_filter(category: String) -> void:
	_achievement_filter = category
	for key: Variant in _achievement_filter_buttons:
		var filter: HubAchievementFilter = _achievement_filter_buttons[key]
		filter.active = str(key) == category
	_show_achievement_rows()


func _show_achievement_rows() -> void:
	for child: Node in _achievement_list.get_children():
		_achievement_list.remove_child(child)
		child.queue_free()
	if _stats == null:
		return
	for unlocked: bool in [true, false]:
		for info: XomDaoAchievementInfo in _stats.achievements:
			var category: String = "core" if info.game_id == "" else info.game_id
			if info.unlocked != unlocked:
				continue
			if _achievement_filter != "all" and category != _achievement_filter:
				continue
			var game_name: String = (
				"Xóm Đảo" if info.game_id == "" else str(_games.get(info.game_id, info.game_id))
			)
			var row := HubAchievementTile.create(info, game_name)
			row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			_achievement_list.add_child(row)
	_achievement_list.queue_sort()


## Your 20 most recent finished games, newest first, one row each.
func _show_history() -> void:
	var rows: Array[Control] = []
	var now: float = Time.get_unix_time_from_system() * 1000.0
	if _matches != null:
		var recent: Array[XomDaoMatchRecord] = []
		for item: Variant in _matches:
			if item is XomDaoMatchRecord:
				recent.append(item as XomDaoMatchRecord)
		recent.sort_custom(
			func(a: XomDaoMatchRecord, b: XomDaoMatchRecord) -> bool: return a.ended_at > b.ended_at
		)
		for i: int in mini(recent.size(), HISTORY_LIMIT):
			var record: XomDaoMatchRecord = recent[i]
			var row: HubMatchRow = HubMatchRow.create(
				record, str(_games.get(record.game_id, record.game_id)), now
			)
			row.name = "Match_%d" % i
			rows.append(row)
	_show_tiles(rows, "Chưa chơi ván nào" if _matches != null else "Đang tải")
	_layout()


func _wears(item: XomDaoShopItem) -> bool:
	return (
		(item.slot == "avatar" and item.look == _profile.avatar)
		or (item.slot == "frame" and item.look == _profile.frame)
		or (item.slot == "card-back" and item.look == _profile.card_back)
	)


## Opens Túi đồ so the player can choose another avatar or frame.
func _open_looks() -> void:
	select("tui-do")
	_kinds.choose(0)


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
	var wearable: bool = item.slot in ["avatar", "frame", "card-back"]
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
	_kinds = XomDaoChoice.create(["Tất cả", "Ảnh đại diện", "Khung", "Lưng bài", "Biểu cảm"])
	_kinds.name = "BagKinds"
	_kinds.compact = true
	_kinds.changed.connect(func(_index: int) -> void: _show_tab_page())
	for i: int in KINDS.size():
		var slot: String = str(KINDS[i][0])
		_kinds.get_child(i).name = "BagKind_" + (slot if slot != "" else "all")
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
		Color("#FDF6E8"),
		Color("#824F18"),
		ROUND,
		8.0,
		false,
		3,
		false,
		true
	)
	var inset := 18.0
	var w: float = _plate.size.x
	var h: float = _plate.size.y
	_draw_plate_rivet(Vector2(inset, inset))
	_draw_plate_rivet(Vector2(w - inset, inset))
	_draw_plate_rivet(Vector2(inset, h - inset))
	_draw_plate_rivet(Vector2(w - inset, h - inset))


func _draw_plate_rivet(pos: Vector2) -> void:
	var rivet_color := Color("#C4922F")
	var rivet_dark := Color("#5A3A0B")
	var rivet_shine := Color("#FFEAA7")
	_plate.draw_circle(pos + Vector2(0.0, 1.0), 3.5, rivet_dark)
	_plate.draw_circle(pos, 3.0, rivet_color)
	_plate.draw_circle(pos - Vector2(0.8, 0.8), 1.0, rivet_shine)


func _layout() -> void:
	if not is_inside_tree():
		return
	top._layout()
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = _settings.margin
	var k: float = _settings.ui_scale
	var left: float = inset.x + edge
	var up: float = top.bottom() + 12.0
	var down: float = size.y - inset.y - edge
	if editable:
		_account.scale = Vector2.ONE * k
		_account.position = Vector2(
			left + (HubHomeTab.SIZE.x - XomDaoIconButton.SIZE * k) / 2.0,
			down - XomDaoIconButton.SIZE * k
		)
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
	_achievement_page.position = inner.position
	_achievement_page.size = inner.size
	_achievement_count.position = Vector2(0.0, 52.0)
	_achievement_count.size = Vector2(minf(210.0, inner.size.x * 0.42), 30.0)
	_achievement_progress.position = Vector2(_achievement_count.size.x + 12.0, 60.0)
	_achievement_progress.size = Vector2(
		maxf(0.0, inner.size.x - _achievement_count.size.x - 12.0), 16.0
	)
	_achievement_filter_scroll.position = Vector2(0.0, 92.0)
	_achievement_filter_scroll.size = Vector2(inner.size.x, 76.0)
	_achievement_scroll.position = Vector2(0.0, 174.0)
	_achievement_scroll.size = Vector2(inner.size.x, maxf(0.0, inner.size.y - 174.0))
	_achievement_empty.position = _achievement_scroll.position
	_achievement_empty.size = _achievement_scroll.size
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


func _on_copy_username() -> void:
	if _username_raw == "":
		return
	DisplayServer.clipboard_set(_username_raw.trim_prefix("#"))
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	XomDaoToast.show_on(self, "Đã sao chép #%s" % _username_raw.trim_prefix("#"), "check-circle")


func _style_identity_icon(button: Button, icon_name: String, hint: String) -> void:
	button.text = ""
	button.icon = XomDaoUi.icon(icon_name)
	button.expand_icon = true
	button.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	button.vertical_icon_alignment = VERTICAL_ALIGNMENT_CENTER
	button.tooltip_text = hint
	button.custom_minimum_size = Vector2(40.0, 40.0)
	button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.add_theme_stylebox_override(
		"normal", XomDaoUi.box(Color(XomDaoUi.PAPER_DARK, 0.5), Color.TRANSPARENT, 0, 10.0)
	)
	button.add_theme_stylebox_override(
		"hover", XomDaoUi.box(XomDaoUi.PAPER_DARK, XomDaoUi.HONEY, 1, 10.0)
	)
	button.add_theme_stylebox_override(
		"pressed", XomDaoUi.box(XomDaoUi.HONEY_DARK, Color.TRANSPARENT, 0, 10.0)
	)
	button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	button.add_theme_color_override("icon_normal_color", Color(XomDaoUi.INK, 0.75))
	button.add_theme_color_override("icon_hover_color", XomDaoUi.INK)
	button.add_theme_color_override("icon_pressed_color", XomDaoUi.CREAM)
	button.add_theme_color_override("icon_disabled_color", Color(XomDaoUi.INK, 0.4))
	button.button_down.connect(XomDaoUi.bounce.bind(button))


func _begin_name_edit() -> void:
	if not editable or _profile == null:
		return
	_name_input.text = _profile.name
	_name_error.text = ""
	_name_saving = false
	_name_input.editable = true
	_save_name.disabled = false
	_cancel_name.disabled = false
	_name.visible = false
	_edit_name.visible = false
	_name_input.visible = true
	_save_name.visible = true
	_cancel_name.visible = true
	_name_error.visible = false
	_name_input.grab_focus()
	_name_input.select_all()


func _submit_name() -> void:
	if _name_saving:
		return
	var value: String = _name_input.text.strip_edges()
	if value.is_empty():
		name_change_failed("Bạn cần nhập tên")
		return
	if _profile != null and value == _profile.name:
		_cancel_name_edit()
		return
	_name_error.visible = false
	_name_saving = true
	_name_input.editable = false
	_save_name.disabled = true
	_cancel_name.disabled = true
	name_change_requested.emit(value)


func set_name_saving(saving: bool) -> void:
	_name_saving = saving
	_name_input.editable = not saving
	_save_name.disabled = saving
	_cancel_name.disabled = saving


func name_change_failed(message: String) -> void:
	set_name_saving(false)
	_name_error.text = message
	_name_error.visible = true


func name_change_succeeded(name: String) -> void:
	if _profile != null:
		_profile.name = name
	_name.text = name
	_name_input.text = name
	_avatar.initial = name
	_cancel_name_edit()


func _cancel_name_edit() -> void:
	_name_input.text = _profile.name if _profile != null else _name.text
	_name_saving = false
	_name_input.editable = true
	_save_name.disabled = false
	_cancel_name.disabled = false
	_name.visible = true
	_edit_name.visible = editable
	_name_input.visible = false
	_save_name.visible = false
	_cancel_name.visible = false
	_name_error.visible = false


func _layout_profile(room: Vector2) -> void:
	_avatar.size = Vector2.ONE * AVATAR
	_avatar.position = Vector2(8.0, 8.0)
	_edit_looks.position = Vector2(8.0, AVATAR + 16.0)
	_edit_looks.size = Vector2(AVATAR, 88.0)
	var x: float = AVATAR + 40.0
	var wide: float = room.x - x
	_name_row.position = Vector2(x, 0.0)
	_name_row.size = Vector2(wide, 96.0)
	_level.reset_size()
	_level.position = Vector2(x, 108.0)
	var bar_left: float = x + _level.size.x + 14.0
	_xp.position = Vector2(bar_left, 108.0 + (_level.size.y - 20.0) / 2.0)
	_xp.size = Vector2(room.x - bar_left, 20.0)
	_xp_text.position = Vector2(bar_left, _xp.position.y + 24.0)
	_xp_text.size = Vector2(_xp.size.x, 28.0)
	_totals.position = Vector2(x, 108.0 + _level.size.y + 44.0)
	_totals.size = Vector2(wide, 0.0)
	_totals.reset_size()
	_totals.size.x = wide
	_worn.position = Vector2(x, _totals.position.y + _totals.size.y + 28.0)
	_worn.reset_size()
