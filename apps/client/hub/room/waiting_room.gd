class_name HubWaitingRoom
extends Control
## The room before its game starts (docs/experience.md, "Phòng"), where CHƠI lands. Left, a
## paper plate with everything about the room: the game's art and name, the code to share with
## Mời bạn, a scroll that opens the game's rules, and the game's own options (the host changes
## them, the others read them). Right, the seats as a grid of cards (HubSeatCard) under a count
## and a status, and in the bottom right corner the one big button: Bắt đầu for the host, once
## everyone else is ready, and Sẵn sàng for the others. A quick-match room says it is still
## looking for players and has neither. ← in the top bar leaves.
##
##   room.show_setup("tien-len", spec)     # the game's `room_setup()` rows
##   room.show_room(snapshot, me, card, false)
##
## Named nodes for tests: RoomPlate, RoomGame, RoomRules, RoomCode, Invite, Option_<key>,
## RoomCount, RoomStatus, Seat<i>, Start, Ready.

signal leave_pressed
signal invite_pressed
signal start_pressed
## A guest said Sẵn sàng (true) or took it back.
signal ready_pressed(ready: bool)
## The scroll on the plate: the game's rules.
signal rules_pressed
## A seated player was tapped: their Nhà opens.
signal player_pressed(user_id: String)
## The host picked another option: every option's value, for `room:options`.
signal options_changed(options: Dictionary)

const GLASS: Shader = preload("res://hub/lobby/glass.gdshader")
const PLATE_W := 452.0
const ROUND := 28.0
const PAD := 20.0
const ART_H := 116.0
const CODE_H := 72.0
const GAP := 20.0
const SEAT_GAP := 14.0
const HEAD_H := 44.0
const ACTION := Vector2(320.0, 104.0)
## The room an option's row has: the plate less its padding and the scroll bar.
const OPTIONS_W := PLATE_W - PAD * 2.0 - 14.0
## A seat card is never wider or taller than this, however few seats there are.
const SEAT_MAX := Vector2(360.0, 430.0)

var top: HubTopBar

## The game whose options the plate shows ("" until show_setup).
var setup_game: String = ""
## The game whose options are on their way (the hub loads its pack first).
var loading_game: String = ""
## Each option's row (HubRoomOption), by key.
var choices: Dictionary = {}

var _settings: XomDaoSettings
var _plate := Control.new()
var _art := ColorRect.new()
var _game := Label.new()
var _code := Label.new()
var _invite: XomDaoButton = XomDaoButton.create("Mời bạn", XomDaoUi.Kind.SOCIAL)
var _scroll := ScrollContainer.new()
var _options := VBoxContainer.new()
var _rules: XomDaoIconButton = XomDaoIconButton.create("scroll")
var _start: XomDaoButton = XomDaoButton.create("Bắt đầu", XomDaoUi.Kind.PLAY)
var _ready_button: XomDaoButton = XomDaoButton.create("Sẵn sàng", XomDaoUi.Kind.GO)
var _is_ready: bool = false
var _heading := Label.new()
var _count := Label.new()
var _status := Label.new()
var _seats := Control.new()
var _cards: Array[HubSeatCard] = []
var _spec: Array = []
var _picture: Texture2D
var _can_change: bool = false
var _room_options: Variant = null


## How many seats go on one row.
static func columns_for(seats: int) -> int:
	if seats <= 3:
		return seats
	if seats == 4:
		return 2
	if seats <= 6:
		return 3
	if seats <= 8:
		return 4
	return 5


func _init(settings: XomDaoSettings = null) -> void:
	_settings = settings if settings != null else XomDaoSettings.current()
	name = "WaitingRoom"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSky.new())
	top = HubTopBar.new(_settings)
	top.back_pressed.connect(leave_pressed.emit)
	add_child(top)
	_build_plate()
	_build_seats()
	resized.connect(_layout)
	_settings.changed.connect(_layout)


func _ready() -> void:
	_layout()


## The game's own options (`room_setup()` rows, [] for none), one row of choices each.
func show_setup(game_id: String, spec: Array) -> void:
	_clear_options()
	setup_game = game_id
	_spec = spec
	for option: Variant in spec:
		if option is not Dictionary:
			continue
		var row: HubRoomOption = HubRoomOption.create(option, OPTIONS_W)
		row.changed.connect(_on_choice.unbind(1))
		choices[str(option.get("key", ""))] = row
		_options.add_child(row)
	if choices.is_empty():
		var none := Label.new()
		none.text = "Phòng thường, không có tuỳ chọn."
		none.theme_type_variation = "SmallLabel"
		none.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		none.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.75))
		_options.add_child(none)
	_show_options()


## `me` is your member id; `card` the room's game (null when the catalog lacks it); `quick`
## while quick match looks for players.
func show_room(snapshot: XomDaoRoomSnapshot, me: String, card: XomDaoGameCard, quick: bool) -> void:
	_code.text = snapshot.code
	if setup_game != "" and setup_game != snapshot.game_id:
		# Another game's room now: its options come with show_setup.
		_clear_options()
		setup_game = ""
	_game.text = card.name if card != null else ""
	_show_art(HubGameArt.splash(snapshot.game_id))
	var host: bool = snapshot.host_id == me
	var seats: int = maxi(card.max_players if card != null else 2, snapshot.players.size())
	while _cards.size() > seats:
		var gone: HubSeatCard = _cards.pop_back()
		_seats.remove_child(gone)
		gone.queue_free()
	while _cards.size() < seats:
		var seat := HubSeatCard.new()
		seat.name = "Seat%d" % _cards.size()
		seat.pressed.connect(_on_seat.bind(seat))
		_seats.add_child(seat)
		_cards.append(seat)
	for i: int in seats:
		if i < snapshot.players.size():
			var player: XomDaoPlayerInfo = snapshot.players[i]
			_cards[i].show_player(player, player.id == snapshot.host_id, player.id == me)
		else:
			_cards[i].show_empty()
	_count.text = "%d/%d" % [snapshot.players.size(), seats]
	var waiting: int = 0
	var seated: bool = false
	for player: XomDaoPlayerInfo in snapshot.players:
		if player.id == me:
			seated = true
			_is_ready = player.ready
		elif not player.bot and player.id != snapshot.host_id and not player.ready:
			waiting += 1
	var few: bool = snapshot.players.size() < (card.min_players if card != null else 2)
	_start.visible = host and not quick
	_start.disabled = few or waiting > 0
	_ready_button.visible = seated and not host and not quick
	_ready_button.text = "Huỷ sẵn sàng" if _is_ready else "Sẵn sàng"
	_ready_button.kind = XomDaoUi.Kind.BACK if _is_ready else XomDaoUi.Kind.GO
	if quick:
		_status.text = "Đang tìm người chơi"
	elif not host:
		_status.text = "Chờ chủ phòng bắt đầu"
	elif waiting > 0:
		_status.text = "Chờ mọi người sẵn sàng"
	elif not snapshot.spectators.is_empty():
		_status.text = "%d người xem" % snapshot.spectators.size()
	else:
		_status.text = ""
	_can_change = host and not quick
	_room_options = snapshot.options
	_show_options()
	_layout()


func _build_plate() -> void:
	_plate.name = "RoomPlate"
	_plate.draw.connect(_draw_plate)
	add_child(_plate)
	var glass := ShaderMaterial.new()
	glass.shader = GLASS
	glass.set_shader_parameter("radii", Vector4(ROUND - 3.0, ROUND - 3.0, 0.0, 0.0))
	glass.set_shader_parameter("shade_bottom", 0.6)
	_art.material = glass
	_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_plate.add_child(_art)
	_game.name = "RoomGame"
	_game.theme_type_variation = "HudLabel"
	_game.add_theme_font_size_override("font_size", 36)
	_game.add_theme_color_override("font_outline_color", Color(XomDaoUi.NAVY, 0.75))
	_game.add_theme_constant_override("outline_size", 6)
	_game.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	_game.clip_text = true
	_plate.add_child(_game)
	_code.name = "RoomCode"
	_code.theme_type_variation = "TitleLabel"
	_code.add_theme_font_size_override("font_size", 56)
	_code.add_theme_color_override("font_color", XomDaoUi.LACQUER)
	_code.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_plate.add_child(_code)
	_invite.name = "Invite"
	_invite.icon = XomDaoUi.icon("link")
	_invite.pressed.connect(invite_pressed.emit)
	_plate.add_child(_invite)
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_plate.add_child(_scroll)
	# Narrower than the scroll, so its bar never covers a row.
	_options.custom_minimum_size.x = OPTIONS_W
	_options.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_options.add_theme_constant_override("separation", 12)
	_scroll.add_child(_options)
	_rules.name = "RoomRules"
	_rules.pressed.connect(rules_pressed.emit)
	_plate.add_child(_rules)


func _build_seats() -> void:
	_heading.text = "Người chơi"
	_heading.theme_type_variation = "HudLabel"
	_count.name = "RoomCount"
	_count.theme_type_variation = "HudLabel"
	_count.add_theme_color_override("font_color", XomDaoUi.SUN)
	_status.name = "RoomStatus"
	_status.theme_type_variation = "HudLabel"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	for label: Label in [_heading, _count, _status]:
		label.add_theme_font_size_override("font_size", 30)
		label.add_theme_color_override("font_outline_color", Color(XomDaoUi.NAVY, 0.75))
		label.add_theme_constant_override("outline_size", 6)
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		add_child(label)
	_status.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_seats.name = "Seats"
	_seats.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_seats)
	_start.name = "Start"
	_start.pressed.connect(start_pressed.emit)
	add_child(_start)
	_ready_button.name = "Ready"
	_ready_button.pressed.connect(func() -> void: ready_pressed.emit(not _is_ready))
	add_child(_ready_button)


## Each choice on the room's value; only the host of a room that is not matching may change it.
func _show_options() -> void:
	var held: Dictionary = _room_options if _room_options is Dictionary else {}
	for option: Variant in _spec:
		if option is not Dictionary:
			continue
		var key: String = str(option.get("key", ""))
		var choice: HubRoomOption = choices.get(key)
		if choice == null:
			continue
		if held.has(key):
			choice.selected = HubRoomOptions.index_of(option, held[key])
		choice.locked = not _can_change


func _clear_options() -> void:
	_spec = []
	choices.clear()
	for child: Node in _options.get_children():
		_options.remove_child(child)
		child.queue_free()


func _on_choice() -> void:
	options_changed.emit(HubRoomOptions.values(_spec, choices))


func _on_seat(seat: HubSeatCard) -> void:
	if not seat.filled:
		invite_pressed.emit()
	elif seat.player_id != "":
		player_pressed.emit(seat.player_id)


func _show_art(picture: Texture2D) -> void:
	if picture == _picture and picture != null:
		return
	_picture = picture
	var glass: ShaderMaterial = _art.material
	glass.set_shader_parameter("has_art", picture != null)
	if picture != null:
		glass.set_shader_parameter("art", picture)


func _draw_plate() -> void:
	var box := Rect2(Vector2.ZERO, _plate.size)
	XomDaoPuff.paint(
		_plate, box, XomDaoUi.PAPER, XomDaoUi.HONEY_DARK, ROUND, 8.0, false, 3, false, false
	)
	# A line between the code and the options.
	var y: float = ART_H + CODE_H + 24.0
	_plate.draw_line(
		Vector2(PAD, y), Vector2(_plate.size.x - PAD, y), Color(XomDaoUi.PAPER_DARK, 0.9), 2.0
	)


func _layout() -> void:
	if not is_inside_tree():
		return
	top._layout()
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = _settings.margin
	var left: float = inset.x + edge
	var up: float = top.bottom() + 12.0
	var down: float = size.y - inset.y - edge
	_plate.position = Vector2(left, up)
	_plate.size = Vector2(PLATE_W, down - up)
	_layout_plate()
	var seats_left: float = left + PLATE_W + GAP
	var seats_w: float = size.x - inset.x - edge - seats_left
	_heading.position = Vector2(seats_left + 4.0, up)
	_heading.size = Vector2(_heading.get_minimum_size().x, HEAD_H)
	_count.position = Vector2(_heading.position.x + _heading.size.x + 12.0, up)
	_count.size = Vector2(_count.get_minimum_size().x, HEAD_H)
	var status_left: float = _count.position.x + _count.size.x + 16.0
	_status.position = Vector2(status_left, up)
	_status.size = Vector2(seats_left + seats_w - 4.0 - status_left, HEAD_H)
	_seats.position = Vector2(seats_left, up + HEAD_H + 8.0)
	_seats.size = Vector2(seats_w, down - ACTION.y - GAP - _seats.position.y)
	for action: XomDaoButton in [_start, _ready_button]:
		action.size = ACTION
		action.position = Vector2(seats_left + seats_w - ACTION.x, down - ACTION.y)
	_layout_seats()
	_plate.queue_redraw()


func _layout_plate() -> void:
	var box: Vector2 = _plate.size
	var face_h: float = box.y - 8.0
	_art.position = Vector2(3.0, 3.0)
	_art.size = Vector2(box.x - 6.0, ART_H)
	var glass: ShaderMaterial = _art.material
	glass.set_shader_parameter("box", _art.size)
	if _picture != null:
		var k: float = maxf(_art.size.x / _picture.get_width(), _art.size.y / _picture.get_height())
		var span: Vector2 = _art.size / (_picture.get_size() * k)
		glass.set_shader_parameter("uv_span", span)
		glass.set_shader_parameter("uv_origin", (Vector2.ONE - span) / 2.0)
	_rules.scale = Vector2.ONE * 0.7
	_rules.reset_size()
	_rules.position = Vector2(box.x - 12.0 - _rules.size.x * 0.7, 12.0)
	_game.position = Vector2(PAD, 3.0)
	_game.size = Vector2(box.x - PAD * 2.0, ART_H - 6.0)
	var row: float = ART_H + 14.0
	_invite.custom_minimum_size = Vector2(0.0, CODE_H)
	_invite.reset_size()
	_invite.position = Vector2(box.x - PAD - _invite.size.x, row)
	_code.position = Vector2(PAD, row)
	_code.size = Vector2(_invite.position.x - PAD * 2.0, CODE_H)
	var options_top: float = ART_H + CODE_H + 36.0
	var options_bottom: float = face_h - PAD
	_scroll.position = Vector2(PAD, options_top)
	_scroll.size = Vector2(box.x - PAD * 2.0, maxf(0.0, options_bottom - options_top))


## The seats in rows that fill the right side: as few columns as keep the cards a good shape.
func _layout_seats() -> void:
	var count: int = _cards.size()
	if count == 0:
		return
	var columns: int = columns_for(count)
	var rows: int = ceili(float(count) / columns)
	var room: Vector2 = _seats.size
	var card := Vector2(
		minf((room.x - SEAT_GAP * (columns - 1)) / columns, SEAT_MAX.x),
		minf((room.y - SEAT_GAP * (rows - 1)) / rows, SEAT_MAX.y)
	)
	card.y = minf(card.y, card.x * 1.3)
	var grid := Vector2(
		card.x * columns + SEAT_GAP * (columns - 1), card.y * rows + SEAT_GAP * (rows - 1)
	)
	var origin := Vector2((room.x - grid.x) / 2.0, maxf(0.0, (room.y - grid.y) / 2.0))
	for i: int in count:
		var cell := Vector2(i % columns, floorf(float(i) / columns))
		# A last row with fewer cards sits in the middle.
		var in_row: int = mini(columns, count - int(cell.y) * columns)
		var shift: float = (columns - in_row) * (card.x + SEAT_GAP) / 2.0
		_cards[i].position = origin + cell * (card + Vector2.ONE * SEAT_GAP) + Vector2(shift, 0.0)
		_cards[i].size = card
		_cards[i].pivot_offset = card / 2.0
