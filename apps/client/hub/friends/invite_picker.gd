class_name HubInvitePicker
extends Control
## Mời bạn in a waiting room: a board over a shade listing your friends, the ones online first
## with Mời (then "Đã mời"), the others dimmed; and Sao chép link to share the room another way.
## Tapping the shade or the close mark closes it. Named for tests: InvitePicker, Invite_<id>,
## CopyLink, InviteEmpty.

const WIDTH := 640.0

var _friends: HubFriends
var _code: String = ""
var _board: XomDaoBoard = XomDaoBoard.create("Mời bạn", true)
var _rows := VBoxContainer.new()


func _init(friends: HubFriends, code: String) -> void:
	name = "InvitePicker"
	_friends = friends
	_code = code
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
	_board.custom_minimum_size.x = WIDTH
	add_child(_board)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.custom_minimum_size.y = 300.0
	scroll.add_child(_rows)
	_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_rows.add_theme_constant_override("separation", 8)
	_board.content.add_child(scroll)
	var copy: XomDaoButton = XomDaoButton.create("Sao chép link", XomDaoUi.Kind.SOCIAL)
	copy.name = "CopyLink"
	copy.icon = XomDaoUi.icon("link")
	copy.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	copy.pressed.connect(_copy)
	_board.content.add_child(copy)
	friends.changed.connect(_fill)
	resized.connect(_place)


func _ready() -> void:
	_fill()
	_place()
	_board.open()


func _place() -> void:
	_board.reset_size()
	var fit: float = minf(1.0, (size.y - 32.0) / maxf(_board.size.y, 1.0))
	_board.pivot_offset = _board.size / 2.0
	_board.scale = Vector2.ONE * fit
	_board.position = (size - _board.size) / 2.0


func _fill() -> void:
	for child: Node in _rows.get_children():
		child.queue_free()
	var friends: Array[XomDaoFriend] = _friends.friends()
	if friends.is_empty():
		var empty := Label.new()
		empty.name = "InviteEmpty"
		empty.text = "Chưa có bạn bè"
		empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_rows.add_child(empty)
		return
	for friend: XomDaoFriend in friends:
		_rows.add_child(_row(friend))


func _row(friend: XomDaoFriend) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	row.modulate.a = 1.0 if friend.online else 0.5
	var avatar := XomDaoAvatar.new()
	avatar.custom_minimum_size = Vector2.ONE * 56.0
	avatar.initial = friend.name
	avatar.picture = XomDaoLooks.avatar(friend.avatar)
	avatar.frame = friend.frame
	row.add_child(avatar)
	var words := VBoxContainer.new()
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	words.add_theme_constant_override("separation", -4)
	row.add_child(words)
	var who := Label.new()
	who.text = friend.name
	who.add_theme_font_override("font", XomDaoUi.display_font(800))
	words.add_child(who)
	var where := Label.new()
	where.theme_type_variation = "SmallLabel"
	where.text = "Đang ở phòng này" if friend.room_code == _code else _friends.where_text(friend)
	words.add_child(where)
	var ask: XomDaoButton = XomDaoButton.create("Mời", XomDaoUi.Kind.CONFIRM)
	ask.name = "Invite_%s" % friend.id
	ask.disabled = not friend.online or friend.room_code == _code
	ask.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	ask.pressed.connect(_ask.bind(friend.id, ask))
	row.add_child(ask)
	return row


func _ask(id: String, button: XomDaoButton) -> void:
	button.disabled = true
	var refused: String = await _friends.invite(id)
	if refused != "":
		button.disabled = false
		XomDaoToast.show_on(self, refused, "warning")
		return
	button.text = "Đã mời"


func _copy() -> void:
	DisplayServer.clipboard_set(HubLaunch.room_link(_code))
	XomDaoToast.show_on(self, "Đã sao chép link mời")
