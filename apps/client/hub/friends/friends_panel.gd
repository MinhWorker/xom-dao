class_name HubFriendsPanel
extends HBoxContainer
## The Bạn bè board's Bạn bè tab (HubFriendsBoard): on the left your list (requests to you with
## Đồng ý / ✕, friends online first with where they are and their unread messages, requests you
## sent with ✕); on the right, the chat with the friend you picked, with Vào phòng when they are
## in a room and Xoá bạn (asks once more). Enter sends a message. Adding people is the Tìm kiếm
## tab's (HubFriendSearch).
##
## Named nodes for tests: FriendRow_<id>, Accept_<id>, Decline_<id>, Cancel_<id>, Unread_<id>,
## ChatTitle, Messages, Message_<n>, ChatInput, Send, WatchFriend, RemoveFriend, ChatEmpty.

## Join `code` (the friend's room; as a spectator when its game is on).
signal join_requested(code: String)

## Light paper inside the board: the panels, their rows and fields, ink for the words.
const SHEET := Color("#FFFBF1")
const LINE := Color("#E2CFA6")
const ROW := Color("#F6ECD6")
const FIELD := Color("#FFFFFF")
const TEXT := XomDaoUi.INK
const SOFT := Color(XomDaoUi.INK, 0.6)
const HEAD := XomDaoUi.HONEY_DARK
const MINE := Color("#F2D48A")
const THEIRS := Color("#DDEBF4")
const LIST_W := 340.0
const ONLINE := Color("#5BD46A")
## "Đang online" written on the paper.
const ONLINE_TEXT := Color("#2F9A45")

var _friends: HubFriends
var _me: String = ""
var _picked: String = ""
var _remove_armed: bool = false

var _left := PanelContainer.new()
var _list := VBoxContainer.new()
var _right := PanelContainer.new()
var _head := HBoxContainer.new()
var _title_avatar := XomDaoAvatar.new()
var _title := Label.new()
var _where := Label.new()
var _watch: XomDaoButton = XomDaoButton.create("Vào phòng", XomDaoUi.Kind.SOCIAL)
var _remove: XomDaoButton = XomDaoButton.create("Xoá bạn", XomDaoUi.Kind.BACK)
var _wave := XomDaoDivider.new()
var _scroll := ScrollContainer.new()
var _messages := VBoxContainer.new()
var _empty := Label.new()
var _input := LineEdit.new()
var _send: XomDaoIconButton = XomDaoIconButton.create("paper-plane-right")


func _init(friends: HubFriends, me: String) -> void:
	name = "FriendsPanel"
	_friends = friends
	_me = me
	add_theme_constant_override("separation", 16)
	_build_left()
	_build_right()
	friends.changed.connect(_show_list)
	friends.message.connect(_on_message)


func _ready() -> void:
	_show_list()
	_pick("")


## Leaving Bến: the open chat no longer reads messages as they come.
func _exit_tree() -> void:
	if is_instance_valid(_friends):
		_friends.chatting = ""


static func panel_style(margin: float) -> StyleBoxFlat:
	var style: StyleBoxFlat = XomDaoUi.box(SHEET, LINE, 2, 22.0)
	style.shadow_color = Color(XomDaoUi.HONEY_DARK, 0.18)
	style.shadow_size = 6
	style.shadow_offset = Vector2(0.0, 4.0)
	style.set_content_margin_all(margin)
	return style


static func style_field(field: LineEdit, hint: String) -> void:
	field.placeholder_text = hint
	field.custom_minimum_size.y = 64.0
	field.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	field.add_theme_font_override("font", XomDaoUi.body_font(true))
	field.add_theme_font_size_override("font_size", 24)
	field.add_theme_color_override("font_color", TEXT)
	field.add_theme_color_override("font_placeholder_color", Color(TEXT, 0.4))
	var box: StyleBoxFlat = XomDaoUi.box(FIELD, LINE, 2, 14.0)
	box.content_margin_left = 16.0
	box.content_margin_right = 16.0
	for state: String in ["normal", "focus", "read_only"]:
		field.add_theme_stylebox_override(state, box)


static func small_label(text: String, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_override("font", XomDaoUi.body_font(true))
	label.add_theme_font_size_override("font_size", 19)
	label.add_theme_color_override("font_color", color)
	return label


func _build_left() -> void:
	_left.name = "FriendsList"
	_left.custom_minimum_size.x = LIST_W
	_left.add_theme_stylebox_override("panel", panel_style(14.0))
	add_child(_left)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_left.add_child(scroll)
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_list)


func _build_right() -> void:
	_right.name = "Chat"
	_right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_right.add_theme_stylebox_override("panel", panel_style(16.0))
	add_child(_right)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	_right.add_child(column)
	_head.add_theme_constant_override("separation", 14)
	column.add_child(_head)
	_title_avatar.custom_minimum_size = Vector2.ONE * 64.0
	_head.add_child(_title_avatar)
	var words := VBoxContainer.new()
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	words.add_theme_constant_override("separation", -4)
	_head.add_child(words)
	_title.name = "ChatTitle"
	_title.add_theme_font_override("font", XomDaoUi.display_font(800))
	_title.add_theme_font_size_override("font_size", 30)
	_title.add_theme_color_override("font_color", TEXT)
	_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	words.add_child(_title)
	_where = small_label("", SOFT)
	words.add_child(_where)
	for button: XomDaoButton in [_watch, _remove]:
		button.custom_minimum_size = Vector2(0.0, 72.0)
		button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		_head.add_child(button)
	_watch.name = "WatchFriend"
	_watch.pressed.connect(_watch_friend)
	_remove.name = "RemoveFriend"
	_remove.pressed.connect(_remove_friend)
	_wave.color = Color(HEAD, 0.45)
	column.add_child(_wave)
	_scroll.name = "MessagesScroll"
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(_scroll)
	_messages.name = "Messages"
	_messages.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_messages.add_theme_constant_override("separation", 8)
	_scroll.add_child(_messages)
	_empty.name = "ChatEmpty"
	_empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_empty.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_empty.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_empty.add_theme_font_override("font", XomDaoUi.display_font(800))
	_empty.add_theme_color_override("font_color", Color(TEXT, 0.45))
	column.add_child(_empty)
	var say := HBoxContainer.new()
	say.add_theme_constant_override("separation", 8)
	column.add_child(say)
	_input.name = "ChatInput"
	style_field(_input, "Nhắn tin")
	_input.max_length = 300
	_input.text_submitted.connect(func(_text: String) -> void: _say())
	say.add_child(_input)
	_send.name = "Send"
	_send.tooltip_text = "Gửi (Enter)"
	_send.pressed.connect(_say)
	say.add_child(_send)


# ── The list ──────────────────────────────────────────────────────────────────────────────


func _show_list() -> void:
	for child: Node in _list.get_children():
		_list.remove_child(child)
		child.queue_free()
	var sections: Array = [
		["incoming", "Lời mời kết bạn"], ["friend", "Bạn bè"], ["outgoing", "Đã gửi lời mời"]
	]
	for section: Array in sections:
		var people: Array[XomDaoFriend] = _friends.list.filter(
			func(one: XomDaoFriend) -> bool: return one.state == section[0]
		)
		if people.is_empty():
			continue
		var heading := small_label("%s (%d)" % [section[1], people.size()], HEAD)
		_list.add_child(heading)
		for one: XomDaoFriend in people:
			_list.add_child(_row(one))
	if _friends.list.is_empty():
		var nobody := small_label("Chưa có bạn bè", Color(TEXT, 0.45))
		nobody.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_list.add_child(nobody)
	_empty.text = "Chưa chọn ai" if not _friends.friends().is_empty() else "Chưa có bạn bè"
	if _picked != "" and _friends.friend(_picked) == null:
		_pick("")
	elif _picked != "":
		_show_head(_friends.friend(_picked))


func _row(one: XomDaoFriend) -> Control:
	var row := PanelContainer.new()
	row.name = "FriendRow_%s" % one.id
	var picked: bool = one.id == _picked
	var style: StyleBoxFlat = XomDaoUi.box(
		Color(XomDaoUi.GOLD, 0.35) if picked else ROW,
		XomDaoUi.GOLD_DARK if picked else Color.TRANSPARENT,
		2,
		14.0
	)
	style.set_content_margin_all(8.0)
	row.add_theme_stylebox_override("panel", style)
	row.mouse_filter = Control.MOUSE_FILTER_STOP
	if one.state == "friend":
		row.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		row.gui_input.connect(
			func(event: InputEvent) -> void:
				if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
					_pick(one.id)
		)
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 10)
	row.add_child(line)
	line.add_child(avatar_of(one.name, one.avatar, one.frame, one.online))
	var under: String = "@" + one.username if one.state != "friend" else _friends.where_text(one)
	var under_color: Color = ONLINE_TEXT if one.online else SOFT
	line.add_child(name_block(one.name, under, under_color))
	match one.state:
		"incoming":
			line.add_child(
				mini_button("check-circle", "Accept_%s" % one.id, _answer.bind(one.id, true))
			)
			line.add_child(mini_button("x", "Decline_%s" % one.id, _answer.bind(one.id, false)))
		"outgoing":
			line.add_child(mini_button("x", "Cancel_%s" % one.id, _cancel.bind(one.id)))
		_:
			if one.unread > 0:
				var count := XomDaoChip.create(str(one.unread), "", XomDaoUi.LACQUER)
				count.name = "Unread_%s" % one.id
				count.compact()
				count.size_flags_vertical = Control.SIZE_SHRINK_CENTER
				line.add_child(count)
	return row


## A person's picture for a row, with a green bead on its lower right while they are online.
static func avatar_of(who: String, look: String, frame: String, online: bool) -> XomDaoAvatar:
	var avatar := XomDaoAvatar.new()
	avatar.custom_minimum_size = Vector2.ONE * 52.0
	avatar.initial = who
	avatar.picture = XomDaoLooks.avatar(look)
	avatar.frame = frame
	if online:
		var bead := Panel.new()
		bead.name = "Online"
		bead.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bead.add_theme_stylebox_override("panel", XomDaoUi.box(ONLINE, Color.WHITE, 3, 9.0))
		bead.size = Vector2.ONE * 18.0
		bead.position = Vector2(36.0, 36.0)
		avatar.add_child(bead)
	return avatar


## A row's name over a smaller line (where they are, their username).
static func name_block(who: String, under: String, under_color: Color) -> VBoxContainer:
	var words := VBoxContainer.new()
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	words.add_theme_constant_override("separation", -4)
	var title := Label.new()
	title.text = who
	title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	title.custom_minimum_size.x = 80.0
	title.add_theme_font_override("font", XomDaoUi.display_font(800))
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", TEXT)
	words.add_child(title)
	var line: Label = small_label(under, under_color)
	line.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	words.add_child(line)
	return words


## A small round button for a row (Đồng ý, ✕).
static func mini_button(icon: String, node_name: String, action: Callable) -> XomDaoIconButton:
	var button: XomDaoIconButton = XomDaoIconButton.create(icon)
	button.name = node_name
	button.custom_minimum_size = Vector2.ONE * 64.0
	button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	button.pressed.connect(action)
	return button


func _answer(id: String, accept: bool) -> void:
	var refused: String = await _friends.answer(id, accept)
	if refused != "":
		XomDaoToast.show_on(self, refused, "warning")


func _cancel(id: String) -> void:
	await _friends.remove(id)


# ── The chat ──────────────────────────────────────────────────────────────────────────────


func _pick(id: String) -> void:
	_picked = id
	_friends.chatting = id
	_remove_armed = false
	_remove.text = "Xoá bạn"
	var one: XomDaoFriend = _friends.friend(id)
	for node: Control in [_head, _wave, _scroll, _input, _send]:
		node.visible = one != null
	_empty.visible = one == null
	_empty.text = "Chưa chọn ai" if not _friends.friends().is_empty() else "Chưa có bạn bè"
	_show_list()
	for child: Node in _messages.get_children():
		child.queue_free()
	if one == null:
		return
	_show_head(one)
	var messages: Array[XomDaoChatMessage] = await _friends.history(id)
	if _picked != id or not is_inside_tree():
		return
	for said: XomDaoChatMessage in messages:
		_messages.add_child(_bubble(said))
	_scroll_down()
	_input.grab_focus.call_deferred()


func _show_head(one: XomDaoFriend) -> void:
	if one == null:
		return
	_title_avatar.initial = one.name
	_title_avatar.picture = XomDaoLooks.avatar(one.avatar)
	_title_avatar.frame = one.frame
	_title.text = one.name
	_where.text = _friends.where_text(one)
	_watch.visible = one.online and one.room_code != ""


func _bubble(said: XomDaoChatMessage) -> Control:
	var mine: bool = said.from == _me
	var holder := HBoxContainer.new()
	holder.name = "Message_%d" % _messages.get_child_count()
	holder.alignment = BoxContainer.ALIGNMENT_END if mine else BoxContainer.ALIGNMENT_BEGIN
	var bubble := PanelContainer.new()
	var style: StyleBoxFlat = XomDaoUi.box(MINE if mine else THEIRS, Color.TRANSPARENT, 0, 18.0)
	style.content_margin_left = 16.0
	style.content_margin_right = 16.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	if mine:
		style.corner_radius_bottom_right = 4
	else:
		style.corner_radius_bottom_left = 4
	bubble.add_theme_stylebox_override("panel", style)
	var words := Label.new()
	words.text = said.text
	words.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	words.custom_minimum_size.x = minf(420.0, 24.0 + said.text.length() * 13.0)
	words.add_theme_font_override("font", XomDaoUi.body_font(true))
	words.add_theme_font_size_override("font_size", 24)
	words.add_theme_color_override("font_color", TEXT)
	bubble.add_child(words)
	holder.add_child(bubble)
	holder.tooltip_text = Time.get_datetime_string_from_unix_time(int(said.at / 1000.0), true)
	return holder


func _on_message(said: XomDaoChatMessage) -> void:
	var with: String = said.to if said.from == _me else said.from
	if with != _picked or not is_inside_tree():
		return
	_messages.add_child(_bubble(said))
	_scroll_down()


func _scroll_down() -> void:
	await get_tree().process_frame
	if is_inside_tree():
		_scroll.scroll_vertical = int(_scroll.get_v_scroll_bar().max_value)


func _say() -> void:
	var text: String = _input.text.strip_edges()
	if text == "" or _picked == "":
		return
	_input.text = ""
	var refused: String = await _friends.send(_picked, text)
	if refused != "":
		_input.text = text
		XomDaoToast.show_on(self, refused, "warning")


func _watch_friend() -> void:
	var one: XomDaoFriend = _friends.friend(_picked)
	if one != null and one.room_code != "":
		join_requested.emit(one.room_code)


## Xoá bạn asks once more ("Chắc chưa?") for three seconds.
func _remove_friend() -> void:
	if not _remove_armed:
		_remove_armed = true
		_remove.text = "Chắc chưa?"
		await get_tree().create_timer(3.0).timeout
		if is_inside_tree() and _remove_armed:
			_remove_armed = false
			_remove.text = "Xoá bạn"
		return
	var gone: String = _picked
	_pick("")
	await _friends.remove(gone)
