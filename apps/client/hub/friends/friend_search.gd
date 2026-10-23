class_name HubFriendSearch
extends PanelContainer
## The Bạn bè board's Tìm kiếm tab (HubFriendsBoard): a box for a username and Tìm, then a list
## of people. With the box empty it shows Gợi ý (`friends:suggest`: people you played with
## lately, tagged "Vừa chơi cùng", then others online); Tìm looks up exactly that username
## (`friends:find`). Each row says where they stand with you: Kết bạn, Đồng ý for a request to
## you, "Đã mời" or "Bạn bè".
##
## Named nodes for tests: SearchInput, Search, PeopleHeading, People, Person_<id>, Add_<id>,
## Accept_<id>, PeopleEmpty.

var _friends: HubFriends
var _input := LineEdit.new()
var _heading := Label.new()
var _list := VBoxContainer.new()
var _empty := Label.new()
## What the list shows: the suggestions, or the search's result.
var _people: Array[XomDaoPerson] = []
## The username searched for ("" while showing suggestions).
var _searched: String = ""
## Bumped by every load, so a late reply does not overwrite a newer one.
var _load: int = 0


func _init(friends: HubFriends) -> void:
	name = "FriendSearch"
	_friends = friends
	add_theme_stylebox_override("panel", HubFriendsPanel.panel_style(16.0))
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	add_child(column)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	column.add_child(row)
	_input.name = "SearchInput"
	HubFriendsPanel.style_field(_input, "Tên đăng nhập")
	_input.max_length = 20
	_input.text_submitted.connect(func(_text: String) -> void: search())
	_input.text_changed.connect(_on_typed)
	row.add_child(_input)
	var go: XomDaoButton = XomDaoButton.create("Tìm", XomDaoUi.Kind.SOCIAL)
	go.name = "Search"
	go.custom_minimum_size = Vector2(140.0, 64.0)
	go.pressed.connect(search)
	row.add_child(go)
	_heading.name = "PeopleHeading"
	_heading.add_theme_font_override("font", XomDaoUi.body_font(true))
	_heading.add_theme_font_size_override("font_size", 20)
	_heading.add_theme_color_override("font_color", HubFriendsPanel.HEAD)
	column.add_child(_heading)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(scroll)
	_list.name = "People"
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_list)
	_empty.name = "PeopleEmpty"
	_empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_empty.add_theme_font_override("font", XomDaoUi.display_font(800))
	_empty.add_theme_font_size_override("font_size", 24)
	_empty.add_theme_color_override("font_color", Color(HubFriendsPanel.TEXT, 0.45))
	_empty.visible = false
	_list.add_child(_empty)
	friends.changed.connect(_show)


## Loads the suggestions (the box empty).
func suggest() -> void:
	_load += 1
	var mine: int = _load
	_searched = ""
	_heading.text = "Gợi ý"
	var people: Array[XomDaoPerson] = await _friends.suggest()
	if mine != _load or not is_inside_tree():
		return
	show_people(people)


## Looks up the username in the box; an empty box goes back to the suggestions.
func search() -> void:
	var wanted: String = _input.text.strip_edges().trim_prefix("@")
	if wanted == "":
		await suggest()
		return
	_load += 1
	var mine: int = _load
	_searched = wanted
	_heading.text = "Kết quả"
	var found: XomDaoPerson = await _friends.find(wanted)
	if mine != _load or not is_inside_tree():
		return
	var people: Array[XomDaoPerson] = []
	if found != null:
		people.append(found)
	show_people(people)


## Shows `people` in the list (the reply of `suggest` or `search`).
func show_people(people: Array[XomDaoPerson]) -> void:
	_people = people
	_show()


func _on_typed(text: String) -> void:
	if text.strip_edges() == "" and _searched != "":
		suggest()


func _show() -> void:
	for child: Node in _list.get_children():
		if child != _empty:
			_list.remove_child(child)
			child.queue_free()
	_empty.visible = _people.is_empty()
	if _searched != "":
		_empty.text = "Không có ai tên đăng nhập @%s" % _searched
	else:
		_empty.text = "Chưa có ai để gợi ý"
	for one: XomDaoPerson in _people:
		_list.add_child(_row(one))


func _row(one: XomDaoPerson) -> Control:
	var row := PanelContainer.new()
	row.name = "Person_%s" % one.id
	var style: StyleBoxFlat = XomDaoUi.box(HubFriendsPanel.ROW, Color.TRANSPARENT, 0, 14.0)
	style.set_content_margin_all(8.0)
	row.add_theme_stylebox_override("panel", style)
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 12)
	row.add_child(line)
	line.add_child(HubFriendsPanel.avatar_of(one.name, one.avatar, one.frame, one.online))
	line.add_child(HubFriendsPanel.name_block(one.name, "@" + one.username, HubFriendsPanel.SOFT))
	var tag: String = "Vừa chơi cùng" if one.recent else ("Đang online" if one.online else "")
	if tag != "":
		var chip := XomDaoChip.create(tag, "clock" if one.recent else "", XomDaoUi.SEA_DEEP)
		chip.compact()
		chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		line.add_child(chip)
	line.add_child(_action(one))
	return row


## Kết bạn, Đồng ý, or a word for where you already stand.
func _action(one: XomDaoPerson) -> Control:
	var state: String = _friends.state_of(one.id)
	if state == "friend" or state == "outgoing":
		var said: Label = HubFriendsPanel.small_label(
			"Bạn bè" if state == "friend" else "Đã mời", HubFriendsPanel.HEAD
		)
		said.custom_minimum_size.x = 150.0
		said.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		said.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		return said
	var incoming: bool = state == "incoming"
	var button: XomDaoButton = XomDaoButton.create(
		"Đồng ý" if incoming else "Kết bạn", XomDaoUi.Kind.CONFIRM
	)
	button.name = ("Accept_%s" if incoming else "Add_%s") % one.id
	button.custom_minimum_size = Vector2(150.0, 60.0)
	button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	button.pressed.connect(_add.bind(one))
	return button


## Asks them (or accepts their request: `friends:add` does both).
func _add(one: XomDaoPerson) -> void:
	var refused: String = await _friends.add(one.username)
	if not is_inside_tree():
		return
	if refused != "":
		XomDaoToast.show_on(self, refused, "warning")
		return
	var now_friends: bool = _friends.state_of(one.id) == "friend"
	XomDaoToast.show_on(
		self, "Đã thành bạn bè" if now_friends else "Đã gửi lời mời kết bạn", "user-plus"
	)
