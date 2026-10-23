class_name HubBen
extends Control
## Bến, the harbour (docs/experience.md): browse active game rooms and join them,
## or enter a room code directly to jump in.
##
## Left side: two-level collapsable list of games grouped by category/genre.
## Right side: header uniting active game title, room count and direct room code input,
## with the open rooms list (HubBenRoomCard) below.
##
## Two tabs at the top: Phòng (the above) and Bạn bè (HubFriendsPanel: friends, requests and
## chat), once `setup_friends` gave it the hub's HubFriends; the Bạn bè tab counts what waits
## for you.
##
## Named nodes for tests: BenTabs, FriendsPanel, CodeInput, Join, RoomsHeading, Rooms,
## Room_<code >, Enter_<code >, Watch_<code >, NoRooms, GameList, GameCard_<id>, Category_<genre>.

signal back_pressed
signal join_requested(code: String)
signal watch_requested(code: String)
signal game_selected(game_id: String)

var top := HubTopBar.new()
var code_input := LineEdit.new()
var join_button: XomDaoButton

var _catalog: HubCatalog
var _game_id: String = ""
var _game_name: String = ""
var _rooms: Array[XomDaoRoomSummary] = []

var _main_box := HBoxContainer.new()
var _left_panel := PanelContainer.new()
var _game_scroll := ScrollContainer.new()
var _category_container := VBoxContainer.new()
var _category_boxes: Dictionary = {}
var _category_headers: Dictionary = {}

var _right_panel := PanelContainer.new()
var _tabs: XomDaoChoice = XomDaoChoice.create(["Phòng", "Bạn bè"])
var _friends: HubFriends
var _friends_panel: HubFriendsPanel
var _heading := Label.new()
var _room_count_chip: XomDaoChip
var _scroll := ScrollContainer.new()
var _list := VBoxContainer.new()


func _init(settings: XomDaoSettings = null) -> void:
	name = "Ben"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())

	var veil := ColorRect.new()
	veil.color = Color(0.06, 0.10, 0.18, 0.35)
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	veil.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(veil)

	top = HubTopBar.new(settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)

	_main_box.name = "MainBox"
	_main_box.add_theme_constant_override("separation", 16)
	add_child(_main_box)

	_build_left_panel()
	_build_right_panel()

	_main_box.add_child(_left_panel)
	_main_box.add_child(_right_panel)

	_tabs.name = "BenTabs"
	_tabs.compact = true
	_tabs.visible = false
	_tabs.changed.connect(_show_tab)
	add_child(_tabs)

	resized.connect(_layout)
	XomDaoSettings.current().changed.connect(_layout)


func _ready() -> void:
	_layout()


## Adds the Bạn bè tab (and opens it with `open`).
func setup_friends(friends: HubFriends, me: String, open: bool = false) -> void:
	_friends = friends
	_friends_panel = HubFriendsPanel.new(friends, me)
	_friends_panel.join_requested.connect(join_requested.emit)
	_friends_panel.visible = false
	add_child(_friends_panel)
	_tabs.visible = true
	friends.changed.connect(_count_tab)
	_count_tab()
	if open:
		_tabs.choose(1)
	_layout()


func _show_tab(index: int) -> void:
	_main_box.visible = index == 0
	if _friends_panel != null:
		_friends_panel.visible = index == 1
		if index != 1:
			_friends.chatting = ""
	_layout()


## "Bạn bè (2)" while requests or messages wait for you.
func _count_tab() -> void:
	var waiting: int = _friends.attention()
	var label: String = "Bạn bè (%d)" % waiting if waiting > 0 else "Bạn bè"
	if _tabs.options[1] != label:
		var at: int = _tabs.selected
		_tabs.options = ["Phòng", label]
		_tabs.selected = at


func setup(catalog: HubCatalog, selected_game_id: String = "") -> void:
	_catalog = catalog
	_game_id = selected_game_id
	_rebuild_categories()
	_update_selected_card()


func select_game(game_id: String) -> void:
	if _game_id == game_id:
		return
	_game_id = game_id
	_update_selected_card()
	_ensure_category_expanded(game_id)
	game_selected.emit(game_id)


## The open rooms of the game `game_name` (its `lobby:watch` list).
func show_rooms(game_name: String, rooms: Array[XomDaoRoomSummary], game_id: String = "") -> void:
	_game_name = game_name
	if game_id != "":
		_game_id = game_id
		_update_selected_card()
		_ensure_category_expanded(game_id)
	_rooms = rooms
	_heading.text = "Phòng %s đang mở" % _game_name

	_room_count_chip.text = "%d phòng" % rooms.size()

	for child: Node in _list.get_children():
		child.queue_free()

	var shown: int = 0
	for summary: XomDaoRoomSummary in rooms:
		var room_card: HubBenRoomCard = HubBenRoomCard.create(summary, _game_name, _game_id)
		room_card.join_pressed.connect(join_requested.emit)
		room_card.watch_pressed.connect(watch_requested.emit)
		_list.add_child(room_card)
		shown += 1

	if shown == 0:
		var empty := VBoxContainer.new()
		empty.name = "NoRooms"
		empty.alignment = BoxContainer.ALIGNMENT_CENTER
		empty.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		empty.size_flags_vertical = Control.SIZE_EXPAND_FILL
		empty.custom_minimum_size.y = 220.0
		empty.add_theme_constant_override("separation", 10)

		var empty_lbl := Label.new()
		empty_lbl.text = "Chưa có phòng nào đang mở cho %s" % _game_name
		empty_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		empty_lbl.add_theme_font_override("font", XomDaoUi.display_font(800))
		empty_lbl.add_theme_font_size_override("font_size", 26)
		empty_lbl.add_theme_color_override("font_color", XomDaoUi.CREAM)
		empty.add_child(empty_lbl)

		var empty_sub := Label.new()
		empty_sub.text = "Nhập mã ở trên để vào ngay, hoặc quay lại Sảnh để tạo phòng mới!"
		empty_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		empty_sub.add_theme_font_override("font", XomDaoUi.body_font())
		empty_sub.add_theme_font_size_override("font_size", 20)
		empty_sub.add_theme_color_override("font_color", Color(XomDaoUi.CREAM, 0.65))
		empty.add_child(empty_sub)

		_list.add_child(empty)


func _build_left_panel() -> void:
	_left_panel.name = "LeftPanel"
	_left_panel.size_flags_horizontal = 0
	_left_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var panel_style: StyleBoxFlat = XomDaoUi.box(
		Color("#0E1626", 0.94), Color("#273C5C", 0.8), 2, 22.0
	)
	panel_style.shadow_color = Color(0.0, 0.0, 0.0, 0.32)
	panel_style.shadow_size = 6
	panel_style.shadow_offset = Vector2(0.0, 4.0)
	panel_style.set_content_margin_all(14.0)
	_left_panel.add_theme_stylebox_override("panel", panel_style)

	_game_scroll.name = "GameScroll"
	_game_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_game_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	_game_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_game_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_left_panel.add_child(_game_scroll)

	_category_container.name = "GameList"
	_category_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_category_container.add_theme_constant_override("separation", 10)
	_game_scroll.add_child(_category_container)


func _build_right_panel() -> void:
	_right_panel.name = "RightPanel"
	_right_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_right_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var panel_style: StyleBoxFlat = XomDaoUi.box(
		Color("#0E1626", 0.94), Color("#273C5C", 0.8), 2, 22.0
	)
	panel_style.shadow_color = Color(0.0, 0.0, 0.0, 0.32)
	panel_style.shadow_size = 6
	panel_style.shadow_offset = Vector2(0.0, 4.0)
	panel_style.set_content_margin_all(16.0)
	_right_panel.add_theme_stylebox_override("panel", panel_style)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	_right_panel.add_child(column)

	# Clean united top row: Left (Title + Room Count) | Right (CodeInput + Join)
	var top_row := HBoxContainer.new()
	top_row.name = "RoomsTopRow"
	top_row.add_theme_constant_override("separation", 10)
	column.add_child(top_row)

	var title_box := HBoxContainer.new()
	title_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_box.add_theme_constant_override("separation", 10)
	top_row.add_child(title_box)

	_heading.name = "RoomsHeading"
	_heading.text = "Phòng đang mở"
	_heading.add_theme_font_override("font", XomDaoUi.display_font(800))
	_heading.add_theme_font_size_override("font_size", 26)
	_heading.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_heading.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_heading.clip_text = true
	_heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_heading.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	title_box.add_child(_heading)

	_room_count_chip = XomDaoChip.create("0 phòng", "anchor", Color("#142338"))
	_room_count_chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	title_box.add_child(_room_count_chip)

	# Compact Code Input + Join Button
	code_input.name = "CodeInput"
	code_input.placeholder_text = "Mã phòng"
	code_input.max_length = 4
	code_input.alignment = HORIZONTAL_ALIGNMENT_CENTER
	code_input.custom_minimum_size = Vector2(128.0, 48.0)
	code_input.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_DEFAULT
	code_input.add_theme_font_override("font", XomDaoUi.display_font(800))
	code_input.add_theme_font_size_override("font_size", 24)
	code_input.add_theme_color_override("font_color", XomDaoUi.CREAM)
	code_input.add_theme_color_override("font_placeholder_color", Color(XomDaoUi.CREAM, 0.45))
	code_input.add_theme_color_override("caret_color", XomDaoUi.GOLD)
	code_input.add_theme_color_override("selection_color", Color(XomDaoUi.GOLD, 0.35))

	var input_box: StyleBoxFlat = XomDaoUi.box(Color("#17243B", 0.95), XomDaoUi.NAVY_LINE, 2, 14.0)
	input_box.content_margin_left = 10.0
	input_box.content_margin_right = 10.0
	var input_focus: StyleBoxFlat = input_box.duplicate()
	input_focus.border_color = XomDaoUi.GOLD
	code_input.add_theme_stylebox_override("normal", input_box)
	code_input.add_theme_stylebox_override("focus", input_focus)

	code_input.text_changed.connect(_on_code_changed)
	code_input.text_submitted.connect(func(_t: String) -> void: _join_typed())
	top_row.add_child(code_input)

	join_button = XomDaoButton.create("Vào", XomDaoUi.Kind.SOCIAL)
	join_button.name = "Join"
	join_button.pad = 16.0
	join_button.custom_minimum_size = Vector2(80.0, 48.0)
	join_button.add_theme_font_size_override("font_size", 24)
	join_button.pressed.connect(_join_typed)
	top_row.add_child(join_button)

	column.add_child(XomDaoDivider.new())

	# Rooms scroll
	_scroll.name = "RoomsScroll"
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(_scroll)

	_list.name = "Rooms"
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 10)
	_scroll.add_child(_list)


func _rebuild_categories() -> void:
	for child: Node in _category_container.get_children():
		child.queue_free()
	_category_boxes.clear()
	_category_headers.clear()

	if _catalog == null:
		return

	for genre: XomDaoGenre in _catalog.ordered_genres():
		var genre_games: Array[XomDaoGameCard] = []
		for card: XomDaoGameCard in _catalog.games_of(genre.id):
			if _catalog.can_play(card.id):
				genre_games.append(card)

		if genre_games.is_empty():
			continue

		var group := VBoxContainer.new()
		group.name = "Group_" + genre.id
		group.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		group.add_theme_constant_override("separation", 6)
		_category_container.add_child(group)

		# Check if this category contains the active game
		var has_active: bool = false
		for card: XomDaoGameCard in genre_games:
			if card.id == _game_id:
				has_active = true
				break

		# Collapsible category header
		var is_collapsed: bool = not has_active
		var header: HubBenCategoryHeader = HubBenCategoryHeader.create(
			genre.id, genre.name, genre_games.size(), is_collapsed
		)
		_category_headers[genre.id] = header
		group.add_child(header)

		# Games sub-list container
		var items_box := VBoxContainer.new()
		items_box.name = "CategoryGames_" + genre.id
		items_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		items_box.add_theme_constant_override("separation", 8)
		items_box.visible = not is_collapsed
		_category_boxes[genre.id] = items_box
		group.add_child(items_box)

		header.category_toggled.connect(
			func(collapsed: bool) -> void: items_box.visible = not collapsed
		)

		for card: XomDaoGameCard in genre_games:
			var item: HubBenGameCard = HubBenGameCard.create(card, true)
			item.selected = card.id == _game_id
			item.pressed.connect(select_game.bind(card.id))
			items_box.add_child(item)


func _update_selected_card() -> void:
	for box: VBoxContainer in _category_boxes.values():
		for child: Node in box.get_children():
			var item := child as HubBenGameCard
			if item != null and item.card != null:
				item.selected = item.card.id == _game_id


func _ensure_category_expanded(game_id: String) -> void:
	if _catalog == null:
		return
	var card: XomDaoGameCard = _catalog.card(game_id)
	if card == null:
		return
	var genre_id: String = card.genre
	var header: HubBenCategoryHeader = _category_headers.get(genre_id)
	var box: VBoxContainer = _category_boxes.get(genre_id)
	if header != null and box != null:
		header.collapsed = false
		box.visible = true


func _on_code_changed(new_text: String) -> void:
	var upper := new_text.to_upper()
	if upper != new_text:
		var caret: int = code_input.caret_column
		code_input.text = upper
		code_input.caret_column = caret


func _join_typed() -> void:
	var code: String = code_input.text.strip_edges().to_upper()
	if code != "":
		join_requested.emit(code)


func _layout() -> void:
	if not is_inside_tree() or size.x <= 0.0:
		return
	top._layout()
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = XomDaoSettings.current().margin
	var top_y: float = top.bottom() + 10.0
	var avail_h: float = maxf(100.0, size.y - top_y - edge - inset.y)
	var avail_w: float = maxf(200.0, size.x - 2.0 * edge - inset.x * 2.0)
	var left_x: float = inset.x + edge

	_main_box.position = Vector2(left_x, top_y)
	_main_box.size = Vector2(avail_w, avail_h)

	var left_w: float = clampf(avail_w * 0.32, 260.0, 320.0)
	_left_panel.custom_minimum_size = Vector2(left_w, 0.0)
	# The tabs sit in the top bar's middle, between ← and the coins.
	_tabs.reset_size()
	_tabs.position = Vector2((size.x - _tabs.size.x) / 2.0, top.bottom() - _tabs.size.y - 4.0)
	if _friends_panel != null:
		_friends_panel.fit(Rect2(Vector2(left_x, top_y), Vector2(avail_w, avail_h)))
