class_name HubFriendsBoard
extends Control
## Bạn bè, over the lobby (the people button at the top right): a board with two tabs. Bạn bè
## (HubFriendsPanel) lists your friends with where they are now, requests to you and the chat;
## its tab counts what waits for you ("Bạn bè (2)"). Tìm kiếm (HubFriendSearch) suggests people
## and looks one up by username. Vào phòng joins a friend's room and closes the board. Tapping
## the shade or the close mark closes it.
##
## Named for tests: FriendsBoard, FriendsTabs, FriendsPanel, FriendSearch.

const PAGE := Vector2(900.0, 480.0)

var _friends: HubFriends
var _board: XomDaoBoard = XomDaoBoard.create("Bạn bè", true)
var _tabs: XomDaoChoice = XomDaoChoice.create(["Bạn bè", "Tìm kiếm"])
var _panel: HubFriendsPanel
var _search: HubFriendSearch
var _searched: bool = false


func _init(friends: HubFriends, me: String, tab: int = 0) -> void:
	name = "FriendsBoard"
	_friends = friends
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.color = Color(XomDaoUi.INK, 0.45)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.gui_input.connect(
		func(event: InputEvent) -> void:
			if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
				queue_free()
	)
	add_child(shade)
	_board.closed.connect(queue_free)
	add_child(_board)
	_tabs.name = "FriendsTabs"
	_tabs.compact = true
	_tabs.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_tabs.changed.connect(_show_tab)
	_board.content.add_child(_tabs)
	var page := Control.new()
	page.custom_minimum_size = PAGE
	_board.content.add_child(page)
	_panel = HubFriendsPanel.new(friends, me)
	_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_panel.join_requested.connect(
		func(code: String) -> void:
			friends.join_requested.emit(code)
			queue_free()
	)
	page.add_child(_panel)
	_search = HubFriendSearch.new(friends)
	_search.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	page.add_child(_search)
	friends.changed.connect(_count_tab)
	_count_tab()
	_tabs.selected = tab
	resized.connect(_place)


func _ready() -> void:
	_show_tab(_tabs.selected)
	_place()
	_board.open()


## Which tab is on: 0 Bạn bè, 1 Tìm kiếm.
func tab() -> int:
	return _tabs.selected


func choose(index: int) -> void:
	_tabs.choose(index)


func _show_tab(index: int) -> void:
	_panel.visible = index == 0
	_search.visible = index == 1
	if index != 0:
		_friends.chatting = ""
	# The suggestions load the first time Tìm kiếm opens.
	if index == 1 and not _searched:
		_searched = true
		_search.suggest()


## "Bạn bè (2)" while requests or messages wait for you.
func _count_tab() -> void:
	var waiting: int = _friends.attention()
	var label: String = "Bạn bè (%d)" % waiting if waiting > 0 else "Bạn bè"
	if _tabs.options[0] != label:
		var at: int = _tabs.selected
		_tabs.options = [label, "Tìm kiếm"]
		_tabs.selected = at


func _place() -> void:
	_board.reset_size()
	var fit: float = minf(
		1.0,
		minf((size.y - 32.0) / maxf(_board.size.y, 1.0), (size.x - 32.0) / maxf(_board.size.x, 1.0))
	)
	_board.pivot_offset = _board.size / 2.0
	_board.scale = Vector2.ONE * fit
	_board.position = (size - _board.size) / 2.0
