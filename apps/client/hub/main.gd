extends Control
## The hub (docs/experience.md): the lobby's island ring, the game select, Bến, the waiting
## room, the game with its ☰ menu, and the result. Links: ?room=<code> joins that room;
## ?play=<id> (debug builds) is the sandbox, a real room on the server with the computer in the
## empty seats.
##
## Out of a room the hub shows the screen the player went to (lobby, select, Bến); in a room it
## follows the room: the waiting room before a game, the game while it runs, the result after.
## Every node a test taps or reads has a name (TestBridge, core/test_bridge.gd).
## ?gallery=<page> (web) or `-- --gallery=<page>` opens the UI component gallery instead.

## How long to keep trying while the server wakes up.
const WAKE_MS := 120_000
## How long a game's own screen (HubGameIntro) stays at least, between the room and the table.
const INTRO_MS := 1800
## What the curtain says on the way to each place.
const PLACE_NAMES: Dictionary = {
	"lobby": "Sảnh",
	"select": "Chọn trò",
	"nha": "Nhà",
	"cho": "Chợ",
	"dinh": "Đình",
	"ben": "Bến",
	"room": "Phòng",
}

var _client: XomDaoClient = Net.client
var _screen: Control
var _shown: String = ""
var _menu: XomDaoMenu
var _catalog: HubCatalog
## The game on CHƠI and the genre of the lobby's front island.
var _game_id: String = ""
var _genre: String = ""
## Where the player is out of a room: "lobby", "select", "ben", "nha" or "cho".
var _place: String = "lobby"
## The balance the screens show; the result rolls it up to the ledger's.
var _coins: int = 0
## Quick match is looking for players for the room we are in.
var _quick: bool = false
var _game: Control
var _game_id_shown: String = ""
var _loading: bool = false
var _result: HubResult
var _music := HubMusic.new()
var _ben: HubBen
## A shop:buy is on its way.
var _buying: bool = false
## An event:claim is on its way.
var _claiming: bool = false
var _opening_rules: bool = false
## The screen on now (the lobby, the waiting room…).
var _current: Control
## The curtain between two screens, and the screens it is about to take away.
var _transition := HubTransition.new()
var _outgoing: Array[Node] = []


func _ready() -> void:
	print("xomdao:ready")
	var page: int = gallery_page()
	if page > 0:
		var gallery: Control = load("res://hub/gallery/gallery.tscn").instantiate()
		gallery.set("page", page)
		get_tree().root.add_child.call_deferred(gallery)
		queue_free()
		return
	theme = XomDaoUi.theme()
	_screen = Control.new()
	_screen.name = "Screen"
	_screen.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_screen)
	_menu = XomDaoMenu.new()
	_menu.name = "Shell"
	_menu.button.name = "Menu"
	_menu.button.visible = false
	_menu.leave_requested.connect(_leave_game)
	_menu.rules_requested.connect(func() -> void: _show_rules(_client.snapshot.game_id))
	add_child(_menu)
	add_child(_music)
	add_child(_transition)
	_transition.covered.connect(_finish_swap)
	_client.state_changed.connect(func(_s: XomDaoRoomSnapshot) -> void: _refresh())
	_client.room_changed.connect(_on_room_changed)
	_client.rewarded.connect(_on_rewarded)
	_client.achieved.connect(_on_achieved)
	_client.event_received.connect(_on_event)
	_client.disconnected.connect(func() -> void: _say("Mất kết nối, đang nối lại"))
	_show_status("Đang kết nối")
	await _start()


## The gallery page asked for in the URL or on the command line, 0 when none.
static func gallery_page() -> int:
	var args: String = " ".join(OS.get_cmdline_user_args())
	if OS.has_feature("web"):
		args += " " + str(JavaScriptBridge.eval("window.location.search", true))
	var found: RegExMatch = RegEx.create_from_string("gallery(?:=(\\d+))?").search(args)
	if found == null:
		return 0
	return maxi(1, found.get_string(1).to_int())


func _start() -> void:
	if not await _connect():
		_show_status("Không kết nối được máy chủ")
		return
	if not await Session.log_in(_client):
		if _client.refused():
			_show_update()
		else:
			_show_gate()
		return
	_client.error.connect(_say)
	_coins = _balance()
	var reply: Dictionary = await _client.request(XomDaoProtocol.CATALOG_GET)
	if reply.get("ok") != true:
		_show_status("Không tải được danh sách trò")
		return
	_catalog = HubCatalog.create(XomDaoCatalog.from_dict(reply), await ContentLoader.available())
	_pick_game(HubPrefs.selected_game(_client.user.id))
	var play: String = _query("play") if OS.is_debug_build() else ""
	var code: String = _query("room")
	if play != "" and _client.room_code == "":
		await _sandbox(play)
	elif code != "" and _client.room_code == "":
		await _client.join_room(code)
	_refresh()


## Connects, trying again while a sleeping server wakes up (a free host takes up to a minute).
func _connect() -> bool:
	var started: int = Time.get_ticks_msec()
	while not await _client.connect_to_server(Net.server_url()):
		if Time.get_ticks_msec() - started > WAKE_MS:
			return false
		_show_status("Đang đánh thức máy chủ")
		await get_tree().create_timer(2.0).timeout
	return true


## The server runs a newer version than this page: Tải lại loads it.
func _show_update() -> void:
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 24)
	center.add_child(column)
	var label := Label.new()
	label.name = "Status"
	label.text = "Đã có bản mới"
	label.theme_type_variation = "HudLabel"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(label)
	var reload: XomDaoButton = XomDaoButton.create("Tải lại", XomDaoUi.Kind.GO)
	reload.name = "Reload"
	reload.pressed.connect(_reload_page)
	column.add_child(reload)
	_set_screen("status", center)


func _reload_page() -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("location.reload()", true)
	else:
		get_tree().reload_current_scene()


## Nobody is logged in: the login board over the loading screen's pictures, until they are.
func _show_gate() -> void:
	_show_status("")
	var gate: HubAccount = HubAccount.gate()
	gate.signed_in.connect(_switch_account)
	add_child(gate)


## Tài khoản over your Nhà.
func _show_account() -> void:
	var account := HubAccount.create(_client.user)
	account.signed_in.connect(_switch_account)
	account.signed_out.connect(
		func() -> void:
			await Session.log_out(_client.token)
			await _switch_account("")
	)
	add_child(account)


## Starts again as another player: `token` ("" = nobody, back to the login board).
func _switch_account(token: String) -> void:
	Session.save_token(token)
	await _client.reset()
	get_tree().reload_current_scene()


## Debug builds: a real room for this game, the computer in the seats it can take, started.
func _sandbox(id: String) -> void:
	_show_status("Đang tải", id)
	var scene: PackedScene = await ContentLoader.load_game(id)
	if scene == null:
		_show_status("Không tải được %s" % id)
		return
	var probe: Node = scene.instantiate()
	var options: Variant = null
	if probe.has_method("sandbox_options"):
		options = probe.call("sandbox_options")
	probe.free()
	if await _client.create_room(id, options):
		await _client.start_game()


## The game on CHƠI: `wanted` when the catalog has it, else the first playable game.
func _pick_game(wanted: String) -> void:
	var card: XomDaoGameCard = _catalog.card(wanted)
	if card == null:
		for genre: XomDaoGenre in _catalog.ordered_genres():
			var cards: Array[XomDaoGameCard] = _catalog.games_of(genre.id)
			if not cards.is_empty() and (card == null or _catalog.can_play(cards[0].id)):
				card = cards[0]
				if _catalog.can_play(card.id):
					break
	_game_id = card.id if card != null else ""
	_genre = card.genre if card != null else ""


func _choose_game(game_id: String) -> void:
	_pick_game(game_id)
	if _client.user != null and _game_id != "":
		HubPrefs.set_selected_game(_client.user.id, _game_id)


func _refresh() -> void:
	if _catalog == null:
		return
	var snapshot: XomDaoRoomSnapshot = _client.snapshot
	var playing: bool = snapshot != null and snapshot.status != "lobby"
	# ☰ belongs to the table: not over the game's own screen on the way in.
	_menu.button.visible = playing and _shown == "game"
	if not playing and _menu.is_open() and _shown != "lobby":
		_menu.close()
	if _client.room_code == "":
		_drop_game()
		_show_place()
	elif snapshot == null or snapshot.status == "lobby":
		_drop_game()
		_show_waiting_room(snapshot)
	else:
		_quick = false
		_show_game(snapshot)


func _on_room_changed(code: String) -> void:
	if code == "":
		_quick = false
	_refresh()


# ── Out of a room ─────────────────────────────────────────────────────────────────────────


func _show_place() -> void:
	match _place:
		"select":
			_show_select(_genre)
		"ben":
			_show_ben()
		"nha":
			_show_home()
		"cho":
			_show_shop()
		"dinh":
			_show_dinh()
		_:
			_show_lobby()


func _show_lobby() -> void:
	_place = "lobby"
	if _shown == "lobby":
		return
	var lobby := HubLobby.new()
	_set_screen("lobby", lobby)
	lobby.show_user(_client.user)
	_fill_level(lobby)
	lobby.money.show_balance(_coins)
	lobby.money.settings_pressed.connect(_menu.open_settings)
	lobby.show_catalog(_catalog, _genre)
	lobby.show_game(_catalog.card(_game_id), _catalog.can_play(_game_id))
	lobby.genre_changed.connect(_on_genre_changed.bind(lobby))
	lobby.play_pressed.connect(_play)
	lobby.select_opened.connect(_show_select)
	lobby.place_pressed.connect(_on_place)
	lobby.event_pressed.connect(
		func(id: String) -> void:
			_choose_game(id)
			_show_select(_genre)
	)


func _on_genre_changed(genre_id: String, lobby: HubLobby) -> void:
	var cards: Array[XomDaoGameCard] = _catalog.games_of(genre_id)
	if cards.is_empty():
		_genre = genre_id
		lobby.show_game(null, false)
		return
	_choose_game(cards[0].id)
	lobby.show_game(cards[0], _catalog.can_play(cards[0].id))


func _on_place(place: String) -> void:
	match place:
		"ben":
			_show_ben()
		"nha":
			_show_home()
		"cho":
			_show_shop()
		"dinh":
			_show_dinh()
		_:
			XomDaoToast.show_on(self, "Sắp có", "lock-simple")


## Nhà: your profile card and Túi đồ, where you wear what you own.
func _show_home() -> void:
	_place = "nha"
	if _shown == "nha":
		return
	var home := HubHome.new()
	_set_screen("nha", home)
	home.top.money.show_balance(_coins)
	home.top.money.settings_pressed.connect(_menu.open_settings)
	home.back_pressed.connect(_back_to_lobby)
	home.equip_requested.connect(_equip.bind(home))
	home.account_pressed.connect(_show_account)
	await _fill_home(home, "")


## Someone's Nhà over the screen, read-only (tap a player in the waiting room).
func _show_profile_of(user_id: String) -> void:
	if user_id == _client.player_id:
		return
	var home := HubHome.new(null, false)
	home.name = "OtherHome"
	add_child(home)
	home.top.money.show_balance(_coins)
	home.top.money.settings_pressed.connect(_menu.open_settings)
	home.back_pressed.connect(home.queue_free)
	if not await _fill_home(home, user_id):
		home.queue_free()


## Fills a Nhà with `inventory:get` (yours for ""), naming the items from `shop:list`, then
## its level and achievements (`stats:get`) and, in your own, your finished games
## (`history:recent`).
func _fill_home(home: HubHome, user_id: String) -> bool:
	var data: Dictionary = {} if user_id == "" else {"userId": user_id}
	var reply: Dictionary = await _client.request(XomDaoProtocol.INVENTORY_GET, data)
	var list: Dictionary = await _client.request(XomDaoProtocol.SHOP_LIST)
	if reply.get("ok") != true or list.get("ok") != true:
		_say(str(reply.get("error", list.get("error", "Không tải được"))))
		return false
	if not is_instance_valid(home):
		return true
	home.show_profile(XomDaoProfile.from_dict(reply), XomDaoShopList.from_dict(list).items)
	var stats: Dictionary = await _client.request(XomDaoProtocol.STATS_GET, data)
	if stats.get("ok") == true and is_instance_valid(home):
		home.show_stats(XomDaoPlayerStats.from_dict(stats), _catalog.names())
	if user_id == "" and is_instance_valid(home):
		var history: Dictionary = await _client.request(XomDaoProtocol.HISTORY_RECENT)
		if history.get("ok") == true and is_instance_valid(home):
			var matches: Array[XomDaoMatchRecord] = []
			for item: Variant in history.get("matches", []):
				if item is Dictionary:
					matches.append(XomDaoMatchRecord.from_dict(item))
			home.show_history(matches, _catalog.names())
	return true


## The level chip and EXP bar by your name in the lobby.
func _fill_level(lobby: HubLobby) -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.STATS_GET)
	if reply.get("ok") == true and is_instance_valid(lobby):
		var stats: XomDaoPlayerStats = XomDaoPlayerStats.from_dict(reply)
		lobby.show_level(stats.level, stats.xp, stats.level_xp, stats.next_xp)


## Đình: the rankings, Cả xóm first.
func _show_dinh() -> void:
	_place = "dinh"
	if _shown == "dinh":
		return
	var dinh := HubDinh.new()
	_set_screen("dinh", dinh)
	dinh.top.money.show_balance(_coins)
	dinh.top.money.settings_pressed.connect(_menu.open_settings)
	dinh.back_pressed.connect(_back_to_lobby)
	dinh.board_changed.connect(_fill_ranking.bind(dinh))
	dinh.set_boards(_catalog.ranked_games())


func _fill_ranking(board: String, dinh: HubDinh) -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.RANKING_GET, {"board": board})
	if reply.get("ok") != true:
		_say(str(reply.get("error", "Không tải được")))
		return
	if is_instance_valid(dinh):
		dinh.show_ranking(
			XomDaoRanking.from_dict(reply), _client.user.id if _client.user != null else ""
		)


func _equip(item_id: String, home: HubHome) -> void:
	var reply: Dictionary = await _client.request(
		XomDaoProtocol.INVENTORY_EQUIP, {"itemId": item_id}
	)
	if reply.get("ok") != true:
		_say(str(reply.get("error", "")))
		return
	_client.user = XomDaoUser.from_dict(reply["user"])
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	if is_instance_valid(home):
		await _fill_home(home, "")


## Chợ: the items for sale; Mua pays through the ledger on the server.
func _show_shop() -> void:
	_place = "cho"
	if _shown == "cho":
		return
	_coins = _balance()
	var shop := HubShop.new()
	_set_screen("cho", shop)
	shop.top.money.show_balance(_coins)
	shop.top.money.settings_pressed.connect(_menu.open_settings)
	shop.back_pressed.connect(_back_to_lobby)
	shop.buy_requested.connect(_buy.bind(shop))
	await _fill_shop(shop)


func _fill_shop(shop: HubShop) -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.SHOP_LIST)
	if reply.get("ok") != true:
		_say(str(reply.get("error", "Không tải được")))
		return
	if is_instance_valid(shop):
		shop.show_items(XomDaoShopList.from_dict(reply).items, _coins)


func _buy(item_id: String, shop: HubShop) -> void:
	# A second tap while the first is on its way asks nothing more (the server pays once anyway).
	if _buying:
		return
	_buying = true
	var reply: Dictionary = await _client.request(XomDaoProtocol.SHOP_BUY, {"itemId": item_id})
	_buying = false
	if reply.get("ok") != true:
		_say(str(reply.get("error", "")))
		return
	var purchase := XomDaoPurchase.from_dict(reply)
	_client.balances = purchase.balances
	_coins = _balance()
	XomDaoUi.play(self, XomDaoUi.SOUND_COIN)
	XomDaoToast.show_on(self, "Đã mua %s" % purchase.item.name, "check-circle")
	if is_instance_valid(shop):
		shop.top.money.show_balance(_coins)
		await _fill_shop(shop)


func _show_select(genre_id: String) -> void:
	_place = "select"
	if _shown == "select":
		return
	var select := HubGameSelect.new()
	_set_screen("select", select)
	select.top.money.show_balance(_coins)
	select.top.money.settings_pressed.connect(_menu.open_settings)
	select.back_pressed.connect(_back_to_lobby)
	select.play_pressed.connect(_play)
	select.progress_needed.connect(_fill_progress.bind(select))
	select.join_pressed.connect(_quick_match)
	select.claim_pressed.connect(_claim.bind(select))
	select.show_genre(_catalog, genre_id, _game_id)


## An event's progress (`event:get`) on the select's detail board.
func _fill_progress(game_id: String, select: HubGameSelect) -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.EVENT_GET, {"eventId": game_id})
	if reply.get("ok") == true and is_instance_valid(select):
		select.show_progress(XomDaoEventProgress.from_dict(reply))


## Nhận: an event tier's reward, paid by the server once.
func _claim(game_id: String, tier: int, select: HubGameSelect) -> void:
	if _claiming:
		return
	_claiming = true
	var reply: Dictionary = await _client.request(
		XomDaoProtocol.EVENT_CLAIM, {"eventId": game_id, "tier": tier}
	)
	_claiming = false
	if reply.get("ok") != true:
		_say(str(reply.get("error", "")))
		return
	var claim := XomDaoEventClaim.from_dict(reply)
	var gained: int = int(claim.balances.get("core:coin", 0)) - _coins
	_client.balances = claim.balances
	_coins = _balance()
	XomDaoUi.play(self, XomDaoUi.SOUND_COIN)
	XomDaoToast.show_on(self, "Nhận %s xu" % XomDaoUi.money(gained), "gift")
	if is_instance_valid(select):
		select.top.money.show_balance(_coins)
		select.show_progress(claim.progress)


func _show_ben() -> void:
	_place = "ben"
	if _shown == "ben":
		return
	_ben = HubBen.new()
	_set_screen("ben", _ben)
	_ben.top.money.show_balance(_coins)
	_ben.top.money.settings_pressed.connect(_menu.open_settings)
	_ben.back_pressed.connect(_back_to_lobby)
	_ben.join_requested.connect(func(code: String) -> void: _client.join_room(code))
	var card: XomDaoGameCard = _catalog.card(_game_id)
	var title: String = card.name if card != null else ""
	_ben.show_rooms(title, [])
	if _game_id == "":
		return
	var reply: Dictionary = await _client.request(XomDaoProtocol.LOBBY_WATCH, {"gameId": _game_id})
	if reply.get("ok") == true and _ben != null and is_instance_valid(_ben):
		_ben.show_rooms(title, XomDaoRoomList.from_dict(reply).rooms)


func _on_event(_event: String, data: Variant) -> void:
	if data is XomDaoLobbyRooms and _shown == "ben" and data.game_id == _game_id:
		var card: XomDaoGameCard = _catalog.card(_game_id)
		_ben.show_rooms(card.name if card != null else "", data.rooms)


func _back_to_lobby() -> void:
	if _shown == "ben":
		_client.request(XomDaoProtocol.LOBBY_UNWATCH)
	_place = "lobby"
	_show_lobby()


## CHƠI: a room of your own for this game, with its usual options. The room's screen is where
## they change, friends come in and the host starts.
func _play(game_id: String) -> void:
	_choose_game(game_id)
	await _client.create_room(game_id)


func _quick_match(game_id: String) -> void:
	_choose_game(game_id)
	_quick = true
	if not await _client.quick_match(game_id):
		_quick = false


func _show_rules(game_id: String) -> void:
	if _opening_rules or has_node("RulesBoard"):
		return
	var card: XomDaoGameCard = _catalog.card(game_id)
	if card == null:
		return
	_opening_rules = true
	var origin: Node = _current
	var text: String = card.tagline
	if _catalog.can_play(game_id) and await ContentLoader.load_game(game_id) != null:
		var rules: String = "res://content/%s/RULES.md" % game_id
		if FileAccess.file_exists(rules):
			text = FileAccess.get_file_as_string(rules)
	_opening_rules = false
	if not is_instance_valid(origin) or origin != _current:
		return
	var board: HubRulesBoard = HubRulesBoard.create("Luật %s" % card.name, text)
	add_child(board)


# ── In a room ─────────────────────────────────────────────────────────────────────────────


func _show_waiting_room(snapshot: XomDaoRoomSnapshot) -> void:
	var room: HubWaitingRoom = _current as HubWaitingRoom if _shown == "room" else null
	if room == null:
		room = HubWaitingRoom.new()
		_set_screen("room", room)
		room.top.money.show_balance(_coins)
		room.top.money.settings_pressed.connect(_menu.open_settings)
		room.leave_pressed.connect(_leave)
		room.invite_pressed.connect(_invite)
		room.start_pressed.connect(_client.start_game)
		room.player_pressed.connect(_show_profile_of)
		room.options_changed.connect(_set_options)
		room.ready_pressed.connect(_set_ready)
		room.rules_pressed.connect(_toggle_room_rules)
	if snapshot == null:
		return
	room.show_room(snapshot, _client.player_id, _catalog.card(snapshot.game_id), _quick)
	if snapshot.game_id != _game_id:
		_choose_game(snapshot.game_id)
	if room.setup_game != snapshot.game_id:
		_load_setup(room, snapshot.game_id)


## Fills the room's plate with the game's own options, once its pack is loaded.
func _load_setup(room: HubWaitingRoom, game_id: String) -> void:
	if room.loading_game == game_id:
		return
	room.loading_game = game_id
	var scene: PackedScene = await ContentLoader.load_game(game_id)
	# Gone, or in another game's room by now.
	if not is_instance_valid(room) or room.loading_game != game_id:
		return
	if scene == null:
		room.loading_game = ""
		return
	var probe: Node = scene.instantiate()
	var spec: Array = probe.call("room_setup") if probe.has_method("room_setup") else []
	probe.free()
	room.show_setup(game_id, spec)


func _set_ready(ready: bool) -> void:
	var ack: Dictionary = await _client.request(XomDaoProtocol.ROOM_READY, {"ready": ready})
	if not ack.get("ok", false):
		_say(str(ack.get("error", "Không đổi được")))


## The scroll in the room: the game's Luật board, or away with it when it is up.
func _toggle_room_rules() -> void:
	var board: Node = get_node_or_null("RulesBoard")
	if board != null:
		board.queue_free()
	elif _client.snapshot != null:
		_show_rules(_client.snapshot.game_id)


## The host picked another option in the room. A refusal puts the choices back.
func _set_options(options: Dictionary) -> void:
	var ack: Dictionary = await _client.request(XomDaoProtocol.ROOM_OPTIONS, {"options": options})
	if not ack.get("ok", false):
		_say(str(ack.get("error", "Không đổi được")))
	if _shown == "room":
		_refresh()


func _show_game(snapshot: XomDaoRoomSnapshot) -> void:
	# The rules opened in the waiting room do not follow the players to the table.
	var rules: Node = get_node_or_null("RulesBoard")
	if rules != null and _shown == "room":
		rules.queue_free()
	if _game_id_shown != snapshot.game_id:
		_drop_game()
		_game_id_shown = snapshot.game_id
		if snapshot.game_id != _game_id:
			_choose_game(snapshot.game_id)
	if _game == null:
		if _loading:
			return
		_loading = true
		var began: int = Time.get_ticks_msec()
		var card: XomDaoGameCard = _catalog.card(snapshot.game_id)
		_set_screen("status", HubGameIntro.new(snapshot.game_id, card.name if card != null else ""))
		var scene: PackedScene = await ContentLoader.load_game(snapshot.game_id)
		# The game's own screen stays long enough to be seen, however fast the pack came.
		var left: int = INTRO_MS - (Time.get_ticks_msec() - began)
		if left > 0:
			await get_tree().create_timer(left / 1000.0).timeout
		_loading = false
		if scene == null:
			_show_status("Không tải được trò chơi")
			return
		_game = scene.instantiate()
		_set_screen("game", _game)
		_music.play_for(snapshot.game_id)
		if _game.has_method("bind"):
			_game.call("bind", _client)
		_refresh()
		return
	if _shown != "game":
		_set_screen("game", _game)
	if snapshot.status == "finished":
		if _result == null:
			_show_result(snapshot)
	elif _result != null:
		_result.queue_free()
		_result = null


func _show_result(snapshot: XomDaoRoomSnapshot) -> void:
	_result = HubResult.new()
	_screen.add_child(_result)
	_result.money.settings_pressed.connect(_menu.open_settings)
	_result.again_pressed.connect(_client.start_game)
	_result.home_pressed.connect(_leave)
	var card: XomDaoGameCard = _catalog.card(snapshot.game_id)
	var detail: Variant = _game.call("result_detail") if _game.has_method("result_detail") else {}
	_result.show_result(
		snapshot,
		_client.player_id,
		_coins,
		card != null and card.kind == "event",
		detail if detail is Dictionary else {}
	)
	# The ledger may have paid before the board came up.
	if _balance() != _coins:
		_on_rewarded(null)


## Achievements a game got you: one notice naming them; their coins join the balance.
func _on_achieved(notice: XomDaoAchievementNotice) -> void:
	var names: Array[String] = []
	for info: XomDaoAchievementInfo in notice.achievements:
		names.append(info.name)
	var toast: XomDaoToast = XomDaoToast.show_on(self, "Thành tích: " + ", ".join(names), "trophy")
	toast.name = "AchievementToast"
	XomDaoUi.play(self, XomDaoUi.SOUND_COIN)
	_on_rewarded(null)


func _on_rewarded(_notice: XomDaoRewardNotice) -> void:
	var balance: int = _balance()
	if _result != null and is_instance_valid(_result):
		_result.receive(balance)
	_coins = balance


## ☰ → Rời phòng: in the middle of a game, ask first.
func _leave_game() -> void:
	if _client.snapshot == null or _client.snapshot.status != "playing":
		await _leave()
		return
	var confirm: XomDaoBoard = XomDaoBoard.create("Rời ván?", true)
	confirm.name = "ConfirmBoard"
	var shade := ColorRect.new()
	shade.color = Color(XomDaoUi.INK, 0.45)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.add_child(center)
	center.add_child(confirm)
	var note := Label.new()
	note.text = "Ván đang chơi sẽ dừng."
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	confirm.content.add_child(note)
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 16)
	confirm.content.add_child(buttons)
	var stay: XomDaoButton = XomDaoButton.create("Ở lại", XomDaoUi.Kind.BACK)
	stay.name = "Stay"
	stay.pressed.connect(shade.queue_free)
	buttons.add_child(stay)
	var leave: XomDaoButton = XomDaoButton.create("Rời phòng", XomDaoUi.Kind.DANGER)
	leave.name = "ConfirmLeave"
	leave.pressed.connect(
		func() -> void:
			shade.queue_free()
			_leave()
	)
	buttons.add_child(leave)
	confirm.closed.connect(shade.queue_free)
	confirm.open()


func _leave() -> void:
	_menu.close()
	# Out of an event's game, back to its board (your points and tiers); else the lobby.
	var snapshot: XomDaoRoomSnapshot = _client.snapshot
	var card: XomDaoGameCard = _catalog.card(snapshot.game_id) if snapshot != null else null
	_place = "select" if card != null and card.kind == "event" else "lobby"
	await _client.leave_room()


func _invite() -> void:
	var link: String = _client.room_code
	if OS.has_feature("web"):
		var page: String = str(JavaScriptBridge.eval("location.origin + location.pathname", true))
		link = "%s?room=%s" % [page, _client.room_code]
	DisplayServer.clipboard_set(link)
	XomDaoToast.show_on(self, "Đã sao chép link mời")


# ── Screens ───────────────────────────────────────────────────────────────────────────────


## The loading screen (HubLoading) with `text` in its corner; it opens on `game_id`'s slide. One
## already up keeps turning its slides and only changes its text.
func _show_status(text: String, game_id: String = "") -> void:
	var loading: HubLoading = _current as HubLoading if _shown == "status" else null
	if loading == null:
		loading = HubLoading.new(game_id)
		_set_screen("status", loading)
	loading.status = text
	loading.busy = text.begins_with("Đang")


## Puts `screen` on in place of the one before (the game stays: it lives across rounds).
## Transitions (HubTransition) are reserved for entering a room or game; navigation between hub
## places (Sảnh, Chọn trò, Nhà, Chợ, Đình, Bến) and back buttons swap instantly.
func _set_screen(shown: String, screen: Control) -> void:
	var before: String = _shown
	_shown = shown
	_current = screen
	for child: Node in _screen.get_children():
		if child != _game and child != screen and not _outgoing.has(child):
			_outgoing.append(child)
	if _result != null and not is_instance_valid(_result):
		_result = null
	if shown != "game" and _result != null:
		_result = null
	if _ben != null and shown != "ben":
		_ben = null
	if screen.get_parent() == null:
		_screen.add_child(screen)
	# Nothing to leave (the first screen), or only words changing: no curtain.
	if before == "" or not is_inside_tree() or (before == "status" and screen is HubLoading):
		_finish_swap()
		return
	if shown == "game":
		screen.visible = false
		_transition.play("", null, HubTransition.Style.FADE)
		return
	var card: XomDaoGameCard = null
	if shown == "room" and _catalog != null and _client.snapshot != null:
		card = _catalog.card(_client.snapshot.game_id)
	if shown == "room" and card == null and _catalog != null:
		card = _catalog.card(_game_id)
	if card != null:
		screen.visible = false
		_transition.play(card.name, HubGameArt.logo(card.id))
	elif shown == "room":
		screen.visible = false
		_transition.play(str(PLACE_NAMES.get("room", "Phòng")))
	else:
		if _transition.running:
			_transition.stop()
		_finish_swap()


## The curtain covers everything (or there is none): the old screens go, the new one shows.
func _finish_swap() -> void:
	for old: Node in _outgoing:
		if is_instance_valid(old) and old != _current:
			old.queue_free()
	_outgoing.clear()
	if is_instance_valid(_current):
		_current.visible = true
	if _game != null:
		_game.visible = _shown == "game"
	if _shown == "game":
		_menu.button.visible = true
	TestBridge.scene = _shown if _shown != "game" else _game_id_shown


func _drop_game() -> void:
	_music.quiet()
	if _game != null:
		_game.queue_free()
		_game = null
	_game_id_shown = ""
	_result = null


func _balance() -> int:
	return int(_client.balances.get("core:coin", 0))


func _say(text: String) -> void:
	XomDaoToast.show_on(self, text, "warning")


## A query parameter of the page's URL (web only).
func _query(key: String) -> String:
	if not OS.has_feature("web"):
		return ""
	var js: String = "new URLSearchParams(location.search).get('%s') || ''" % key
	return str(JavaScriptBridge.eval(js, true))
