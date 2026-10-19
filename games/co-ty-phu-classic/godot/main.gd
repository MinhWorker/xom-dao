## Room snapshots drive the board; visual jobs preserve the order of movement and money.
extends Control

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const Texts := preload("res://content/co-ty-phu-classic/texts.gd")
const PieceProjection := preload("res://content/co-ty-phu-classic/piece_projection.gd")
const BoardSurface := preload("res://content/co-ty-phu-classic/board_surface.gd")
const PawnMotion := preload("res://content/co-ty-phu-classic/pawn_motion.gd")
const Actions := preload("res://content/co-ty-phu-classic/actions.gd")
const Victory := preload("res://content/co-ty-phu-classic/victory.gd")
const TileHud := preload("res://content/co-ty-phu-classic/tile_hud.gd")
const TileSelection := preload("res://content/co-ty-phu-classic/tile_selection.gd")
const DiceHotkey := preload("res://content/co-ty-phu-classic/dice_hotkey.gd")
const SOUNDS := (
	"bankrupt.wav build.wav buy.wav card-flip.wav coin.wav dice.wav jail.wav plane.wav"
	+ " release.wav rent.wav step.wav turn.wav win.mp3 item-receive.mp3 trade-request.mp3"
)
const INKS: Array[Color] = [Color("#DF6554"), Color("#5793D3"), Color("#60AF72"), Color("#E6BE52")]
const PAWNS: Array[String] = ["red", "blue", "green", "yellow"]
const SEEN := Rect2(0.07, 0.048, 0.86, 0.822)
const SIDE_HUD_WIDTH := 276.0
const STEP_SECONDS := 0.14
const FLY_SECONDS := 0.7
const GOLD := Color("#FFE2A0")
const FIELD_INK := Color("#2F4A3A")
var _client: XomDaoClient
var _snapshot_at: int = 0
var _snapshot: XomDaoRoomSnapshot
## Latest authoritative rules snapshot; actions use this even while older UI is animating.
var _view: Dictionary = {}
## The snapshot currently committed to the visible table after its animation jobs finish.
var _presented_view: Dictionary = {}
var _me: int = -1

var _table := Control.new()
var _game_hud: Array[Control] = []
var _cloth: Control = preload("res://content/co-ty-phu-classic/background.gd").new()
var _board := TextureRect.new()
var _marks: Control = preload("res://content/co-ty-phu-classic/marks.gd").new()
var _squares: Array[Control] = []
var _pawns: Array[TextureRect] = []
var _dice: Array[TextureRect] = []
var _turn_pawn := TextureRect.new()
var _turn_name := Label.new()
var _turn_cash := Label.new()
var _notice := Label.new()
var _status := Label.new()
var _row := HBoxContainer.new()
var _buttons: Dictionary = {}
var _card := PanelContainer.new()
var _card_title := Label.new()
var _card_text := Label.new()
var _card_row := HBoxContainer.new()
var _slots: Array[XomDaoPlayerSlot] = []
var _ledger: Control = preload("res://content/co-ty-phu-classic/ledger.gd").new()
var _ledger_open: XomDaoIconButton = XomDaoIconButton.create("book-open")
var _throw: Control = preload("res://content/co-ty-phu-classic/dice.gd").new()
var _gate: Control = preload("res://content/co-ty-phu-classic/gate.gd").new()
var _victory: Control = Victory.new()
var _fx := Control.new()
var _sounds: Dictionary = {}
var _textures: Array[Texture2D] = []

var _focus: int = -1
var _shown: Array[int] = []
var _cash: Array[int] = []
var _jobs: Array[Callable] = []
var _running: bool = false
var _readied: int = -1
var _sent: bool = false
var _can_roll: bool = false
var _field_ink: Control = preload("res://content/co-ty-phu-classic/field_ink.gd").new()
var _field := Rect2()
var _surface: Control = BoardSurface.new()
var _exchange: Control = preload("res://content/co-ty-phu-classic/turn_exchange.gd").new()
var _tile_hud: Control = TileHud.new()
var _tile_selection: RefCounted = TileSelection.new()


func sandbox_options() -> Dictionary:
	return {"bots": 3, "turnSeconds": 30}


func room_setup() -> Array:
	return [
		{
			"key": "bots",
			"label": "Máy chơi cùng",
			"options": [["Không", 0], ["1", 1], ["2", 2], ["3", 3]],
		},
		{
			"key": "turnSeconds",
			"label": "Thời gian mỗi lượt",
			"options": [["15 giây", 15], ["30 giây", 30], ["60 giây", 60]],
			"default": 1,
		},
	]


func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	var detail: Dictionary = Victory.result_detail(_view)
	return detail


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	_cloth.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_cloth)
	_board.name = "Board"
	_board.texture = load("res://content/co-ty-phu-classic/art/board.webp")
	_board.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_board.mouse_filter = Control.MOUSE_FILTER_STOP
	_tile_selection.call("bind", _board)
	_tile_selection.connect("focus_changed", _on_tile_focus_changed)
	add_child(_board)
	_marks.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_marks)
	add_child(_surface)
	add_child(_exchange)
	_tile_hud.name = "TileHud"
	add_child(_tile_hud)
	_tile_hud.connect("acted", _on_ledger_action)
	for i: int in Rules.SQUARES.size():
		var square := Control.new()
		square.name = "Square_%d" % i
		square.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(square)
		_squares.append(square)
	add_child(_throw)
	_throw.set("board", _board)
	for k: int in 2:
		var die: TextureRect = preload("res://content/co-ty-phu-classic/die_mesh.gd").new()
		die.name = "Die_%d" % k
		die.set("value", 1)
		die.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		die.mouse_filter = Control.MOUSE_FILTER_STOP
		die.gui_input.connect(_on_dice_input)
		add_child(die)
		_dice.append(die)
	_throw.set("dice", _dice)
	_throw.set("pawns", _pawns)
	for color: String in PAWNS:
		_textures.append(load("res://content/co-ty-phu-classic/art/pawn-%s.webp" % color))
	_turn_pawn.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_turn_pawn.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_turn_pawn.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_turn_pawn.hide()
	add_child(_turn_pawn)
	for label: Label in [_turn_name, _turn_cash]:
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		label.add_theme_font_override("font", XomDaoUi.display_font(800))
		label.add_theme_color_override("font_color", XomDaoUi.INK)
		label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		label.self_modulate.a = 0.0
		add_child(label)
	_turn_name.name = "TurnName"
	_turn_cash.name = "TurnCash"
	_turn_cash.add_theme_color_override("font_color", Color("#3B7267"))
	_notice.name = "Notice"
	_status.name = "Status"
	for label: Label in [_notice, _status]:
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.add_theme_font_override("font", XomDaoUi.display_font(800))
		label.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
		add_child(label)
	_notice.self_modulate.a = 0.0
	_status.self_modulate.a = 0.0
	_field_ink.set("status_source", _status)
	_field_ink.set("source", _notice)
	_throw.add_child(_field_ink)
	_throw.move_child(_field_ink, 0)
	_throw.set("prompt", _status)
	_notice.add_theme_color_override("font_color", FIELD_INK)
	_status.add_theme_color_override("font_color", XomDaoUi.LACQUER_DARK)
	_row.name = "Actions"
	_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_row.add_theme_constant_override("separation", 10)
	add_child(_row)
	for action: Array in Actions.FIELD_BUTTONS:
		_row.add_child(_action_button(action))
	_build_card()
	_surface.call("attach", _buttons)
	_ledger_open.name = "LedgerOpen"
	_ledger_open.custom_minimum_size = Vector2(112, 112)
	_ledger_open.background = XomDaoUi.SEA_DEEP
	_ledger_open.get("_body").set("radius", 56.0)
	_ledger_open.pressed.connect(func() -> void: _ledger.call("open"))
	add_child(_ledger_open)
	_ledger.connect("acted", _on_ledger_action)
	_ledger.visibility_changed.connect(_refresh)
	_fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx)
	add_child(_victory)
	add_child(_gate)
	add_child(_ledger)
	for sound: String in SOUNDS.split(" "):
		var player := AudioStreamPlayer.new()
		player.bus = XomDaoSettings.SFX_BUS
		player.stream = load("res://content/co-ty-phu-classic/sounds/%s" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound.get_basename()] = player
	_table.name = "Table"
	_table.position = Vector2.ZERO
	_table.size = size
	_table.mouse_filter = Control.MOUSE_FILTER_STOP
	_table.clip_contents = true
	_game_hud = [
		_surface,
		_exchange,
		_tile_hud,
		_row,
		_card,
		_ledger_open,
		_ledger,
		_turn_pawn,
		_turn_name,
		_turn_cash,
		_notice,
		_status,
		_field_ink,
		_fx,
	]
	_victory.call("wrap_table", self, _table)
	resized.connect(_layout)
	_layout.call_deferred()


func _action_button(action: Array) -> XomDaoButton:
	var button: XomDaoButton = XomDaoButton.create(str(action[1]), action[3])
	button.name = str(action[0])
	button.visible = false
	button.pressed.connect(_on_action.bind(str(action[0]), str(action[2])))
	_buttons[str(action[0])] = button
	return button


func _build_card() -> void:
	_card.name = "Card"
	_card.visible = false
	_card.mouse_filter = Control.MOUSE_FILTER_STOP
	var paper: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.HONEY_DARK, XomDaoUi.BORDER, 18.0)
	)
	paper.set_content_margin_all(16.0)
	_card.add_theme_stylebox_override("panel", paper)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	_card.add_child(column)
	_card_title.name = "CardTitle"
	_card_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_card_title.add_theme_font_override("font", XomDaoUi.display_font(800))
	_card_title.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	_card_title.add_theme_color_override("font_color", XomDaoUi.INK)
	column.add_child(_card_title)
	_card_text.name = "CardText"
	_card_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_card_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_card_text.add_theme_font_override("font", XomDaoUi.body_font(true))
	_card_text.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_card_text.add_theme_color_override("font_color", XomDaoUi.INK)
	column.add_child(_card_text)
	_card_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_card_row.add_theme_constant_override("separation", 10)
	column.add_child(_card_row)
	for action: Array in Actions.CARD_BUTTONS:
		_card_row.add_child(_action_button(action))
	add_child(_card)


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	_snapshot_at = Time.get_ticks_msec()
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	_me = -1
	for i: int in snapshot.seats.size():
		if snapshot.seats[i].id == _client.player_id:
			_me = i
	var players: Array = view["players"]
	if players.size() != _slots.size():
		_build(players.size(), view)
	if _view.is_empty():
		_view = view.duplicate(true)
		_presented_view = _view.duplicate(true)
		_marks.call("set_view", _presented_view)
		_place_all()
		_refresh()
		if view.get("winner") != null:
			_enqueue(_win.bind(_view.duplicate(true)))
		return
	var before: Dictionary = _view
	if before.get("winner") != null and view.get("winner") == null:
		_victory.call("reset")
		_ledger.hide()
		_turn_pawn.hide()
	if BoardSurface.event_changed(before.get("specialEvent"), view.get("specialEvent")):
		_readied = -1
	_view = view.duplicate(true)
	_sent = false
	if before == _view:
		if not _running:
			_refresh()
		return
	_animate(before, _view)


func _build(count: int, view: Dictionary) -> void:
	for slot: XomDaoPlayerSlot in _slots:
		slot.queue_free()
	for pawn: TextureRect in _pawns:
		pawn.queue_free()
	_slots.clear()
	_pawns.clear()
	_shown.clear()
	_cash.clear()
	for seat: int in count:
		var slot: XomDaoPlayerSlot = preload("res://content/co-ty-phu-classic/player_card.gd").new()
		slot.name = "Seat_%d" % seat
		slot.set("accent", INKS[seat % INKS.size()])
		_table.add_child(slot)
		slot.hide()
		_table.move_child(slot, _card.get_index())
		_slots.append(slot)
		var pawn: TextureRect = preload("res://content/co-ty-phu-classic/pawn_piece.gd").new()
		pawn.name = "Pawn_%d" % seat
		pawn.texture = _textures[seat % 4]
		pawn.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		pawn.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_table.add_child(pawn)
		_table.move_child(pawn, _dice[0].get_index())
		_pawns.append(pawn)
		var player: Dictionary = view["players"][seat]
		_shown.append(int(player["position"]))
		_cash.append(int(player["cash"]))
	_layout()


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	if _snapshot != null and seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "Người %d" % (seat + 1)


func _player(seat: int) -> Dictionary:
	return _presented_view["players"][seat]


## Queue the dice, clockwise paths or airport transport, then the remaining transfers.
func _animate(before: Dictionary, view: Dictionary) -> void:
	var turn: int = int(before["turn"])
	var dice: Variant = view.get("dice")
	var rolled: bool = (
		str(before["phase"]) == "roll"
		and dice is Array
		and (
			before.get("dice") != dice
			or int(before["players"][turn]["position"]) != int(view["players"][turn]["position"])
			or int(view["players"][turn]["jailRolls"]) != int(before["players"][turn]["jailRolls"])
		)
	)
	var freed: bool = (
		_me >= 0
		and bool(before["players"][_me]["jailed"])
		and not bool(view["players"][_me]["jailed"])
	)
	if rolled:
		_enqueue(_roll.bind((dice as Array).duplicate(), turn))
	if freed:
		_enqueue(_gate_job.bind(false))
	var transfers: Array = (
		view.get("transfers", []).duplicate(true)
		if int(view.get("moneySequence", 0)) != int(before.get("moneySequence", 0))
		else []
	)
	var players: Array = view["players"]
	for seat: int in players.size():
		var was: Dictionary = before["players"][seat]
		var now: Dictionary = players[seat]
		var to: int = int(now["position"])
		if bool(now["bankrupt"]) and not bool(was["bankrupt"]):
			_enqueue(_sfx_job.bind("bankrupt"))
		if (now["freeCards"] as Array).size() > (was["freeCards"] as Array).size():
			_enqueue(_sfx_job.bind("item-receive"))
		if to == int(was["position"]) and bool(now["jailed"]) == bool(was["jailed"]):
			continue
		var steps: int = posmod(to - int(was["position"]), 40)
		var reward: Array = []
		for entry: Dictionary in transfers.duplicate():
			if (
				entry.get("from") == null
				and entry.get("to") == seat
				and entry.get("reason") in ["Qua Xuất phát", "Đáp Xuất phát"]
			):
				reward.append(entry)
				transfers.erase(entry)
		var jailing: bool = bool(now["jailed"]) and not bool(was["jailed"])
		if jailing:
			if int(was["position"]) == 30 and to == 10:
				_enqueue(_jail_spotlight.bind(seat))
			if seat == _me:
				_enqueue(_gate_job.bind(true))
			_enqueue(_fly.bind(seat, to, "jail"))
		elif bool(was["jailed"]) and not bool(now["jailed"]) and steps == 0:
			if seat != _me:
				_enqueue(_sfx_job.bind("release"))
		elif (
			steps > 0
			and not (
				str(before["phase"]) == "event"
				and before.get("specialEvent") is Dictionary
				and before["specialEvent"].get("kind") == "airport"
			)
		):
			_enqueue(_walk.bind(seat, int(was["position"]), steps, reward))
		else:
			_enqueue(_fly.bind(seat, to, "plane", reward))
	if int(view.get("moneySequence", 0)) != int(before.get("moneySequence", 0)):
		if not transfers.is_empty():
			_enqueue(_money.bind(transfers.duplicate(true)))
	if (
		view.get("specialEvent") is Dictionary
		and BoardSurface.event_changed(before.get("specialEvent"), view.get("specialEvent"))
	):
		var revealed: Dictionary = view["specialEvent"]
		if revealed.get("kind") == "card":
			_enqueue(_draw_event.bind(revealed.duplicate(true)))
	if view["phase"] == "trade" and before["phase"] != "trade" and Rules.decision_seat(view) == _me:
		_enqueue(_sfx_job.bind("trade-request"))
	var houses_before: int = 0
	var houses_now: int = 0
	for i: int in 40:
		houses_before += int(before["properties"][i]["houses"])
		houses_now += int(view["properties"][i]["houses"])
	if houses_now > houses_before:
		_enqueue(_sfx_job.bind("build"))
	if view.get("winner") != null and before.get("winner") == null:
		_enqueue(_win.bind(view.duplicate(true)))
	elif int(view["turn"]) != turn and int(view["turn"]) == _me:
		_enqueue(_sfx_job.bind("turn"))
	_enqueue(_present_view.bind(view.duplicate(true)))


func _enqueue(job: Callable) -> void:
	_jobs.append(job)
	if not _running:
		_run()


func _run() -> void:
	_running = true
	_refresh()
	while not _jobs.is_empty():
		var job: Callable = _jobs.pop_front()
		await job.call()
		if not is_inside_tree():
			return
	_running = false
	_place_all()
	_refresh()


func _present_view(view: Dictionary) -> void:
	_presented_view = view
	for seat: int in _cash.size():
		_cash[seat] = int(_player(seat)["cash"])
	_marks.call("set_view", _presented_view)
	_refresh()


func _draw_event(event: Dictionary) -> void:
	for die: TextureRect in _dice:
		die.hide()
	_sfx("card-flip")
	await _surface.call("reveal", event)


func _sfx_job(sound: String) -> void:
	_sfx(sound)
	await get_tree().process_frame


func _roll(values: Array, seat: int) -> void:
	_sfx("dice")
	await _throw.call("roll", values, _notice, _seat_name(seat))


func _gate_job(shut: bool) -> void:
	if shut:
		_gate.call("slam")
		await get_tree().process_frame
	else:
		_sfx("release")
		await _gate.call("open")


func _jail_spotlight(seat: int) -> void:
	var pawn: TextureRect = _pawns[seat]
	var foot: Vector2 = pawn.position + Vector2(pawn.size.x / 2.0, pawn.size.y * 0.92)
	await _gate.call("spotlight", foot, _board.size.x * 0.075)


func _win(view: Dictionary) -> void:
	var seat: int = int(view["winner"])
	_can_roll = false
	_sfx("win")
	await _victory.call(
		"play",
		_table,
		_pawns[seat],
		Vector2(size.x * 0.43, size.y * 0.52),
		_game_hud,
		_buttons.values(),
		_slots,
		_dice,
		_throw
	)


func wait_for_result_panel() -> void:
	await _victory.call("wait_for_panel")


func set_result_view(looking: bool) -> void:
	_victory.call("set_board_view", looking)


func can_declare_bankruptcy() -> bool:
	return (
		not _view.is_empty()
		and _me >= 0
		and _me < _view["players"].size()
		and _view.get("winner") == null
		and not bool(_view["players"][_me]["bankrupt"])
	)


func declare_bankruptcy() -> bool:
	if _client == null or _sent or not can_declare_bankruptcy():
		return false
	_sent = true
	_refresh()
	var accepted: bool = await _client.send("bankrupt", {})
	if not accepted:
		_sent = false
		if is_inside_tree():
			_refresh()
	return accepted


func _walk(seat: int, from: int, steps: int, reward: Array = []) -> void:
	_tile_selection.call("clear_focus")
	_tile_hud.call("movement_started", seat, _me)
	for k: int in steps:
		var square: int = (from + k + 1) % 40
		_shown[seat] = square
		var pawn: TextureRect = _pawns[seat]
		var target: Vector2 = _pawn_position(seat, square, false)
		_sfx("step")
		await PawnMotion.move(self, pawn, target, STEP_SECONDS, 0.045)
		if not is_inside_tree():
			return
		if square == 0 and not reward.is_empty():
			await _money(reward)
	_place_pawns()
	_tile_hud.call("movement_stopped", seat, _presented_view, _shown, _names(), _me, _me >= 0)


## The airport carries the pawn; jail retains its separate transport.
func _fly(seat: int, to: int, sound: String, reward: Array = []) -> void:
	_tile_selection.call("clear_focus")
	_tile_hud.call("movement_started", seat, _me)
	_sfx(sound)
	_shown[seat] = to
	var pawn: TextureRect = _pawns[seat]
	var target: Vector2 = _pawn_position(seat, to, sound == "jail")
	if sound == "plane":
		await _throw.call(
			"fly", pawn, target, _money.bind(reward) if not reward.is_empty() else Callable()
		)
	else:
		await PawnMotion.move(self, pawn, target, FLY_SECONDS, 0.65)
	if is_inside_tree():
		_place_pawns()
		_tile_hud.call("movement_stopped", seat, _presented_view, _shown, _names(), _me, _me >= 0)


func _money(transfers: Array) -> void:
	_sfx(Rules.money_sound(transfers))
	for transfer: Dictionary in transfers:
		if transfer.get("reason") not in ["Qua Xuất phát", "Đáp Xuất phát"]:
			continue
		var recipient: Variant = transfer.get("to")
		if recipient != null and int(recipient) < _pawns.size():
			Texts.start_reward_burst(_fx, _pawns[int(recipient)])
	var net: Dictionary = Rules.net_changes(transfers)
	for seat: Variant in net:
		var change: int = int(net[seat])
		if change == 0 or int(seat) >= _slots.size():
			continue
		Texts.float_money_change(_fx, _pawns[int(seat)], change, int(seat))
	await _exchange.call("play", transfers)
	for seat: Variant in net:
		var change: int = int(net[seat])
		if change == 0 or int(seat) >= _slots.size():
			continue
		_cash[int(seat)] += change
		var slot: XomDaoPlayerSlot = _slots[int(seat)]
		slot.call("change_cash", _cash[int(seat)], change)
	await get_tree().create_timer(1.04).timeout
	_show_slots()


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sfx and is_inside_tree():
		player.play()


static func _is_tap(event: InputEvent) -> bool:
	if event is InputEventMouseButton:
		var mouse: InputEventMouseButton = event
		return mouse.button_index == MOUSE_BUTTON_LEFT and not mouse.pressed
	if event is InputEventScreenTouch:
		return not (event as InputEventScreenTouch).pressed
	return false


func _on_tile_focus_changed(square: int) -> void:
	_focus = square
	_refresh()


func _on_dice_input(event: InputEvent) -> void:
	if _view.get("winner") == null and _is_tap(event) and _can_roll:
		_on_action("Roll", "roll")


func _unhandled_key_input(event: InputEvent) -> void:
	if _view.get("winner") == null and DiceHotkey.should_roll(event, _can_roll):
		get_viewport().set_input_as_handled()
		_on_action("Roll", "roll")


func _on_action(button: String, event: String) -> void:
	if _client == null or _sent or _view.get("winner") != null:
		return
	if button == "Mortgage":
		_ledger.call("open", 0, _focus)
		_ledger.get("_estate").call("_batch")
		return
	var payload: Dictionary = {}
	match button:
		"Build":
			payload = {"square": int(_view["buildable"])}
		"Redeem", "SellHouse":
			payload = {"square": _focus}
	_sent = true
	_refresh()
	var ok: bool = await _client.send(event, payload)
	if not ok:
		_sent = false
		if is_inside_tree():
			_refresh()


func _on_ledger_action(event: String, payload: Dictionary) -> void:
	if _client == null or _sent or _view.get("winner") != null:
		return
	_sent = true
	_refresh()
	if await _client.send(event, payload):
		if event == "bankrupt":
			_ledger.hide()
	else:
		_sent = false
		if is_inside_tree():
			_refresh()


func _refresh() -> void:
	if _presented_view.is_empty() or not is_inside_tree():
		return
	_tile_selection.call(
		"set_enabled",
		_me >= 0 and _presented_view.get("winner") == null and not _running and not _sent
	)
	if not _running:
		for seat: int in _cash.size():
			_cash[seat] = int(_player(seat)["cash"])
		_ready_event()
	_tile_hud.call("follow", _presented_view, _shown, _names(), _me, _focus, _me >= 0)
	_tile_hud.call("set_interaction_locked", _running or _sent or _ledger.visible)
	_show_slots()
	_show_panel()
	_show_actions()
	_show_card()
	var confirming: bool = str(_presented_view["phase"]) == "event" and not _running
	_field_ink.set("confirmation", confirming)
	_field_ink.set("heading", _card_title.text)
	_field_ink.set("description", _card_text.text)
	for die: TextureRect in _dice:
		die.visible = (
			_presented_view.get("winner") == null
			and (
				str(_presented_view["phase"]) != "event"
				or not str(_throw.get("_motion")).is_empty()
			)
		)
	_throw.visible = not _ledger.visible
	_marks.call("set_focus", _focus)
	_layout()


func _ready_event() -> void:
	var event: Variant = _view.get("specialEvent")
	if event is not Dictionary or str(_view["phase"]) != "event" or int(_view["turn"]) != _me:
		return
	var id: int = int((event as Dictionary)["id"])
	if bool((event as Dictionary)["ready"]) or id == _readied:
		return
	_readied = id
	_client.send("event-ready", {"id": id})


func _show_slots() -> void:
	var timer: XomDaoRoomTimer = _snapshot.timer
	var winner: Variant = _presented_view.get("winner")
	var acting: int = Rules.decision_seat(_presented_view)
	for seat: int in _slots.size():
		var slot: XomDaoPlayerSlot = _slots[seat]
		var player: Dictionary = _player(seat)
		var info: XomDaoPlayerInfo = (
			_snapshot.seats[seat] if seat < _snapshot.seats.size() else null
		)
		slot.player_name = info.name if info != null else _seat_name(seat)
		slot.set("local_player", seat == _me)
		if info != null:
			slot.picture = XomDaoLooks.avatar("bot" if info.bot else info.avatar)
			slot.frame = info.frame
			slot.host = info.id != "" and info.id == str(_snapshot.host_id)
		if bool(player["bankrupt"]):
			slot.extra = "Phá sản"
		elif bool(player["jailed"]):
			slot.extra = "Tù · %s" % XomDaoUi.money(_cash[seat])
		else:
			slot.extra = XomDaoUi.money(_cash[seat]) + " ₫"
		slot.call(
			"set_cash",
			_cash[seat],
			"Phá sản" if bool(player["bankrupt"]) else ("Tù" if bool(player["jailed"]) else "")
		)
		slot.modulate.a = 0.45 if bool(player["bankrupt"]) else 1.0
		_pawns[seat].visible = not bool(player["bankrupt"])
		var on_turn: bool = winner == null and seat == acting
		if on_turn and not _running and timer != null and timer.ms > 0.0:
			slot.start_turn(
				timer.ms / 1000.0,
				maxf(0.0, (timer.ms - timer.left + Time.get_ticks_msec() - _snapshot_at) / 1000.0)
			)
		elif on_turn:
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()


## Fixed viewer cards and bank seal; the acting seat only changes the highlight.
func _show_panel() -> void:
	var seat: int = Rules.decision_seat(_presented_view)
	if _presented_view.get("winner") != null:
		seat = int(_presented_view["winner"])
	_exchange.call("refresh", seat, _names(), _cash, _textures, _slots, _me, _presented_view)
	_turn_pawn.texture = _textures[seat % 4]
	_turn_name.text = _seat_name(seat)
	_turn_cash.text = XomDaoUi.money(_cash[seat]) + " ₫"


func _show_actions() -> void:
	_can_roll = false
	for name_of: String in _buttons:
		(_buttons[name_of] as Control).visible = false
	if _presented_view.get("winner") != null:
		_notice.text = ""
		_status.text = ""
		_ledger_open.hide()
		_ledger.hide()
		_throw.set("can_roll", false)
		return
	_notice.text = "" if _running else str(_presented_view.get("notice", ""))
	_status.text = "" if _running else Texts.status(_presented_view, _me, _names())
	var dice: Variant = _presented_view.get("dice")
	if dice is Array and not _running:
		for k: int in 2:
			_dice[k].set("value", clampi(int(dice[k]), 1, 6))
	_ledger_open.visible = not _presented_view.is_empty()
	_ledger.call("refresh", _presented_view, _me, _names(), _slots, _running or _sent)
	if not (_running or _sent or _ledger.visible):
		_offer_all(Actions.phase_actions(_presented_view, _me))
	_throw.set("can_roll", _can_roll)
	if _can_roll:
		_status.text = "Chạm xúc xắc để gieo"


func _offer(button: String, label: String = "", enabled: bool = true) -> void:
	if button == "Roll":
		_can_roll = enabled
		return
	var node: XomDaoButton = _buttons[button]
	if label != "":
		node.text = label
	node.disabled = not enabled
	node.visible = true


func _offer_all(actions: Array) -> void:
	for action: Array in actions:
		_offer(str(action[0]), str(action[1]), bool(action[2]))


func _show_card() -> void:
	for action: Array in Actions.CARD_BUTTONS:
		(_buttons[str(action[0])] as Control).visible = false
	if _presented_view.get("winner") != null:
		_card.hide()
		return
	var event: Variant = _presented_view.get("specialEvent")
	_card.visible = true
	if event is Dictionary and str(_presented_view["phase"]) == "event" and not _running:
		_show_event(event)
	else:
		_card.visible = false


func _show_event(event: Dictionary) -> void:
	_card.hide()
	_card_title.text = BoardSurface.title(event)
	_card_text.text = BoardSurface.description(event, str(_presented_view.get("notice", "")))
	if int(_presented_view["turn"]) == _me and not _sent:
		_offer("Confirm")


func _names() -> Array[String]:
	var out: Array[String] = []
	for seat: int in _slots.size():
		out.append(_seat_name(seat))
	return out


func _at(fraction: Vector2) -> Vector2:
	return _board.position + fraction * _board.size


func _quad(i: int) -> PackedVector2Array:
	var out := PackedVector2Array()
	for corner: Vector2 in Rules.CELLS[i]:
		out.append(_at(corner))
	return out


func _pawn_position(seat: int, square: int, jailed: bool) -> Vector2:
	return PieceProjection.pawn_position(seat, square, _board, _pawns[seat].size, jailed)


func _place_all() -> void:
	for seat: int in _shown.size():
		_shown[seat] = int(_player(seat)["position"])
	_place_pawns()


func _place_pawns() -> void:
	if _pawns.is_empty() or _presented_view.is_empty():
		return
	var height: float = _board.size.y * 0.040
	for seat: int in _pawns.size():
		var pawn: TextureRect = _pawns[seat]
		pawn.size = Vector2(height * 0.75, height)
		pawn.position = _pawn_position(seat, _shown[seat], bool(_player(seat)["jailed"]))
	# Lower pawns stand in front.
	var order: Array[int] = []
	for seat: int in _pawns.size():
		order.append(seat)
	order.sort_custom(
		func(a: int, b: int) -> bool: return _pawns[a].position.y < _pawns[b].position.y
	)
	for seat: int in order:
		_table.move_child(_pawns[seat], _dice[0].get_index() - 1)


func _layout() -> void:
	if not is_inside_tree():
		return
	_table.size = size
	_cloth.size = size
	_victory.call("layout_background", size)
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var top: float = edge
	var bottom: float = size.y - edge

	# The board: its drawn part as big as the room left of the column allows, clear of ☰.
	var room_right: float = right - SIDE_HUD_WIDTH - 12.0
	var ratio: float = Rules.IMAGE_RATIO
	var width: float = minf((room_right - left) / SEEN.size.x, (bottom - top) / SEEN.size.y * ratio)
	var seen_w: float = width * SEEN.size.x
	var seen_left: float = left + (room_right - left - seen_w) / 2.0
	var corner_x: float = seen_left + width * (Rules.CELLS[20][0].x - SEEN.position.x)
	var menu: float = edge + XomDaoUi.TOUCH + 8.0
	var seen_top: float = top
	if corner_x < menu:
		width = minf(width, (bottom - menu) / SEEN.size.y * ratio)
		seen_w = width * SEEN.size.x
		seen_left = left + (room_right - left - seen_w) / 2.0
		seen_top = menu
	var height: float = width / ratio
	seen_top += maxf(0.0, (bottom - seen_top - height * SEEN.size.y) / 2.0)
	_board.size = Vector2(width, height)
	_board.position = Vector2(
		seen_left - width * SEEN.position.x, seen_top - height * SEEN.position.y
	)
	_marks.position = _board.position
	_marks.size = _board.size
	for i: int in 40:
		var quad: PackedVector2Array = _quad(i)
		var low := Vector2(INF, INF)
		var high := Vector2(-INF, -INF)
		for point: Vector2 in quad:
			low = low.min(point)
			high = high.max(point)
		_squares[i].position = low
		_squares[i].size = high - low

	_surface.call("arrange", _board)
	_exchange.position = _board.position
	_exchange.size = _board.size
	_field_ink.position = _board.position
	_field_ink.size = _board.size
	# The field: notice on top, the dice, your actions at the bottom.
	var field_top: Vector2 = _at(Rules.plane_point(Rules.FIELD.position))
	var field_end: Vector2 = _at(Rules.plane_point(Rules.FIELD.end))
	var field_right: Vector2 = _at(
		Rules.plane_point(Vector2(Rules.FIELD.end.x, Rules.FIELD.position.y))
	)
	_field = Rect2(field_top, Vector2(field_right.x - field_top.x, field_end.y - field_top.y))
	_notice.size = Vector2(_field.size.x - 24.0, 0.0)
	_notice.reset_size()
	_notice.size.x = _field.size.x - 24.0
	_notice.position = Vector2(_field.position.x + 12.0, _field.position.y + 8.0)
	_row.reset_size()
	_row.position = Vector2(
		_field.get_center().x - _row.size.x / 2.0, _field.end.y - _row.size.y - 10.0
	)
	_status.size = Vector2(_field.size.x - 24.0, 0.0)
	_status.reset_size()
	_status.size.x = _field.size.x - 24.0
	_status.position = Vector2(_field.position.x + 12.0, _row.position.y - _status.size.y - 2.0)
	var die: float = clampf(_field.size.y * 0.3, 44.0, 96.0)
	# Fixed contact points on the board, independent of notices and action buttons.
	var dice_y: float = _at(Rules.plane_point(Vector2(0.5, 0.59))).y - die * 0.96
	for k: int in 2:
		_dice[k].size = Vector2.ONE * die
		_dice[k].pivot_offset = Vector2.ONE * die / 2.0
		_dice[k].position = Vector2(_field.get_center().x + (k - 1) * (die + 10.0) + 5.0, dice_y)

	# The card: over the field, a little wider than it.
	var card_width: float = clampf(_field.size.x + 40.0, 360.0, 560.0)
	_card_text.custom_minimum_size.x = card_width - 32.0
	_card.custom_minimum_size.x = card_width
	_card.size = Vector2.ZERO
	_card.reset_size()
	_card.position = Vector2(
		clampf(_field.get_center().x - _card.size.x / 2.0, left, right - _card.size.x),
		clampf(_field.get_center().y - _card.size.y / 2.0, top, bottom - _card.size.y)
	)

	_ledger_open.size = Vector2(112, 112)
	_ledger_open.position = Vector2(right - 112, top)
	_tile_hud.call("layout_on_board", _board)
	_throw.queue_redraw()

	if not _running:
		_place_pawns()
