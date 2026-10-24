extends GutTest
## The hub's room screens: the room's options, the waiting room, the result's ranks and rewards,
## Luật, and what the hub remembers.


func _snapshot(winners: Array, rewards: Array) -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "tic-tac-toe",
				"hostId": "minh",
				"players":
				[
					{"id": "minh", "name": "Minh", "connected": true},
					{"id": "bot:1", "name": "Máy", "connected": true, "bot": true},
				],
				"status": "finished",
				"result": {"winners": winners, "rewards": rewards},
			}
		)
	)


func test_room_options_read_the_picked_values_and_find_the_rooms_own() -> void:
	var spec: Array = [
		{"key": "opponent", "label": "Chơi với", "options": [["Bạn bè", "human"], ["Máy", "bot"]]},
		{"key": "rounds", "label": "Số ván", "options": [["1", 1], ["3", 3]], "default": 1},
	]
	var picked: Dictionary = {
		"opponent": add_child_autofree(XomDaoChoice.create(["Bạn bè", "Máy"], 1)),
		"rounds": add_child_autofree(XomDaoChoice.create(["1", "3"], 0)),
	}
	assert_eq(HubRoomOptions.values(spec, picked), {"opponent": "bot", "rounds": 1})
	assert_eq(HubRoomOptions.index_of(spec[0], "bot"), 1)
	assert_eq(HubRoomOptions.index_of(spec[1], 3.0), 1, "the server's numbers are floats")
	assert_eq(HubRoomOptions.index_of(spec[1], "other"), 1, "its default when none holds it")
	HubRoomOptions.cache_spec("test-game", spec)
	assert_true(HubRoomOptions.has_spec("test-game"))
	assert_eq(HubRoomOptions.spec_for("test-game"), spec)


func _room(players: Array, options: Variant = null) -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "tic-tac-toe",
				"hostId": "minh",
				"players": players,
				"status": "lobby",
				"options": options,
			}
		)
	)


func _caro() -> XomDaoGameCard:
	return XomDaoGameCard.from_dict(
		{"id": "tic-tac-toe", "name": "Caro", "minPlayers": 2, "maxPlayers": 2}
	)


func _waiting_room() -> HubWaitingRoom:
	var settings := XomDaoSettings.new()
	settings.path = ""
	var room: HubWaitingRoom = add_child_autofree(HubWaitingRoom.new(settings))
	room.set_anchors_preset(Control.PRESET_TOP_LEFT)
	room.size = XomDaoFrame.SIZE
	return room


func test_the_room_seats_players_in_cards_beside_its_plate() -> void:
	var room: HubWaitingRoom = _waiting_room()
	room.show_room(
		_room([{"id": "minh", "name": "Minh", "connected": true}]), "minh", _caro(), false
	)
	assert_eq(room.find_child("RoomCode", true, false).text, "K7M2")
	assert_eq(room.find_child("RoomGame", true, false).text, "Caro")
	assert_eq(room.find_child("RoomCount", true, false).text, "1/2")
	var plate: Control = room.find_child("RoomPlate", true, false)
	var mine: HubSeatCard = room.find_child("Seat0", true, false)
	var free: HubSeatCard = room.find_child("Seat1", true, false)
	assert_true(mine.filled, "you sit in the first seat")
	assert_false(free.filled, "the second seat is empty")
	assert_gt(mine.global_position.x, plate.global_position.x + plate.size.x, "seats on the right")
	assert_almost_eq(mine.position.y, free.position.y, 0.01, "two seats on one row")
	var start: Button = room.find_child("Start", true, false)
	assert_true(start.visible, "the host starts")
	assert_true(start.disabled, "not alone")
	watch_signals(room)
	free.pressed.emit()
	assert_signal_emitted(room, "invite_pressed", "an empty seat invites")
	mine.pressed.emit()
	assert_signal_emitted_with_parameters(room, "player_pressed", ["minh"])


func test_the_host_changes_the_room_options_and_guests_read_them() -> void:
	var spec: Array = [
		{"key": "opponent", "label": "Chơi với", "options": [["Bạn bè", "human"], ["Máy", "bot"]]},
		{"key": "rounds", "label": "Số ván", "options": [["1", 1], ["3", 3]]},
	]
	var players: Array = [
		{"id": "minh", "name": "Minh", "connected": true},
		{"id": "lan", "name": "Lan", "connected": true},
	]
	var held: Dictionary = {"opponent": "human", "rounds": 3.0}
	var room: HubWaitingRoom = _waiting_room()
	assert_not_null(
		room.find_child("OptionsLoading", true, false), "options plate shows loading by default"
	)
	assert_not_null(room.find_child("OptionsSpinner", true, false))
	assert_eq(room.find_child("OptionsLoadingLabel", true, false).text, "Đang tải tuỳ chọn…")
	room.show_setup_failed("tic-tac-toe")
	assert_null(room.find_child("OptionsLoading", true, false))
	assert_not_null(room.find_child("OptionsFailed", true, false))
	room.show_setup("tic-tac-toe", spec)
	assert_null(room.find_child("OptionsLoading", true, false))
	assert_null(room.find_child("OptionsFailed", true, false))
	room.show_room(_room(players, held), "minh", _caro(), false)
	var rounds: HubRoomOption = room.choices["rounds"]
	assert_eq(rounds.selected, 1, "the room's own value is the one picked")
	assert_false(rounds.locked, "the host may change it")
	watch_signals(room)
	room.choices["opponent"].choose(1)
	assert_signal_emitted_with_parameters(
		room, "options_changed", [{"opponent": "bot", "rounds": 3}]
	)
	room.show_room(_room(players, held), "lan", _caro(), false)
	assert_eq(room.choices["opponent"].selected, 0, "back on what the room holds")
	assert_true(rounds.locked, "a guest only reads")
	assert_false(room.find_child("Start", true, false).visible)
	assert_eq(room.find_child("RoomStatus", true, false).text, "Chờ chủ phòng bắt đầu")


func test_the_host_starts_once_the_guests_are_ready() -> void:
	var minh: Dictionary = {"id": "minh", "name": "Minh", "connected": true}
	var lan: Dictionary = {"id": "lan", "name": "Lan", "connected": true}
	var room: HubWaitingRoom = _waiting_room()
	room.show_room(_room([minh, lan]), "minh", _caro(), false)
	var start: Button = room.find_child("Start", true, false)
	var ready: Button = room.find_child("Ready", true, false)
	assert_true(start.visible and start.disabled, "the host waits for the guest")
	assert_false(ready.visible, "the host has no Sẵn sàng")
	assert_eq(room.find_child("RoomStatus", true, false).text, "Chờ mọi người sẵn sàng")
	room.show_room(_room([minh, lan]), "lan", _caro(), false)
	assert_true(ready.visible, "a guest says Sẵn sàng")
	assert_false(start.visible)
	assert_gt(ready.position.x, room.find_child("RoomPlate", true, false).size.x, "on the right")
	assert_gt(ready.position.y, room.size.y / 2.0, "at the bottom")
	watch_signals(room)
	ready.pressed.emit()
	assert_signal_emitted_with_parameters(room, "ready_pressed", [true])
	lan["ready"] = true
	room.show_room(_room([minh, lan]), "lan", _caro(), false)
	assert_eq(ready.text, "Huỷ sẵn sàng")
	room.show_room(_room([minh, lan]), "minh", _caro(), false)
	assert_false(start.disabled, "everyone is ready")
	watch_signals(room)
	room.find_child("RoomRules", true, false).pressed.emit()
	assert_signal_emitted(room, "rules_pressed")


func test_an_option_is_drawn_as_what_suits_it_and_fits_the_plate() -> void:
	var width: float = HubWaitingRoom.OPTIONS_W
	var specs: Array = [
		{"key": "ff", "label": "Sát thương đồng đội", "options": [["Tắt", false], ["Bật", true]]},
		{"key": "bots", "label": "Máy chơi cùng", "options": [["Không", 0], ["1", 1], ["2", 2]]},
		{"key": "level", "label": "Máy chơi", "options": [["Dễ", "easy"], ["Khó", "hard"]]},
		{
			"key": "swap",
			"label": "Lượt bắn",
			"options": [["Bạn bắn trước", false], ["Đối thủ bắn trước", true]]
		},
	]
	var kinds: Array = [
		HubRoomOption.Kind.SWITCH,
		HubRoomOption.Kind.STEPPER,
		HubRoomOption.Kind.SEGMENTS,
		HubRoomOption.Kind.PICKER,
	]
	for i: int in specs.size():
		var row: HubRoomOption = add_child_autofree(HubRoomOption.create(specs[i], width))
		assert_eq(row.kind, kinds[i], str(specs[i]["key"]))
		assert_lte(row.get_combined_minimum_size().x, width, "%s fits" % specs[i]["key"])
		assert_not_null(row.find_child("Option_" + str(specs[i]["key"]), true, false))
	var bots: HubRoomOption = add_child_autofree(HubRoomOption.create(specs[1], width))
	watch_signals(bots)
	bots._step(-1)
	assert_signal_not_emitted(bots, "changed", "a stepper stops at its first value")
	bots._step(1)
	assert_signal_emitted_with_parameters(bots, "changed", [1])
	var swap: HubRoomOption = add_child_autofree(HubRoomOption.create(specs[3], width))
	swap._step(-1)
	assert_eq(swap.selected, 1, "a picker goes round")
	swap.locked = true
	swap._step(1)
	assert_eq(swap.selected, 1, "a locked row stays")


func test_seats_fill_rows_by_how_many_there_are() -> void:
	assert_eq(HubWaitingRoom.columns_for(2), 2)
	assert_eq(HubWaitingRoom.columns_for(4), 2)
	assert_eq(HubWaitingRoom.columns_for(6), 3)
	assert_eq(HubWaitingRoom.columns_for(8), 4)


func test_escape_activates_the_top_bar_back_button() -> void:
	var settings := XomDaoSettings.new()
	settings.path = ""
	var top: HubTopBar = add_child_autofree(HubTopBar.new(settings))
	watch_signals(top)
	var escape := InputEventAction.new()
	escape.action = "ui_cancel"
	escape.pressed = true
	top._unhandled_input(escape)
	assert_signal_emitted(top, "back_pressed")


func test_the_curtain_covers_then_lifts() -> void:
	var curtain: HubTransition = add_child_autofree(HubTransition.new())
	watch_signals(curtain)
	curtain.play("Chọn trò")
	assert_true(curtain.running and curtain.visible)
	assert_eq(curtain.mouse_filter, Control.MOUSE_FILTER_STOP, "no taps on the screen being left")
	await wait_seconds(HubTransition.IN + 0.1)
	assert_signal_emit_count(curtain, "covered", 1, "the screens swap under it")
	assert_eq(curtain.mouse_filter, Control.MOUSE_FILTER_IGNORE, "the new screen takes taps")
	# Another screen while it is still up: it covers again at once.
	curtain.play("Phòng")
	await wait_process_frames(2)
	assert_signal_emit_count(curtain, "covered", 2)
	await wait_seconds(HubTransition.HOLD + HubTransition.OUT + 0.15)
	assert_false(curtain.running or curtain.visible, "gone")


func test_a_game_has_its_own_screen_on_the_way_in() -> void:
	var intro: HubGameIntro = add_child_autofree(HubGameIntro.new("tien-len", "Tiến Lên"))
	assert_eq((intro.find_child("IntroName", true, false) as Label).text, "Tiến Lên")
	assert_eq((intro.find_child("Status", true, false) as Label).text, "Đang tải")
	assert_not_null(HubGameArt.splash("tien-len"))


func test_loading_tells_a_game_story_and_turns_its_slides() -> void:
	var loading: HubLoading = add_child_autofree(HubLoading.new("tien-len"))
	loading.status = "Đang tải"
	assert_eq(loading.find_child("Status", true, false).text, "Đang tải")
	var spinner: Control = loading.find_child("Spinner", true, false)
	assert_true(spinner.visible, "it spins while it works")
	loading.busy = false
	assert_false(spinner.visible, "and stops on an end")
	var title: Label = loading.find_child("LoadingName", true, false)
	var story: Label = loading.find_child("LoadingStory", true, false)
	assert_eq(title.text, "Tiến Lên", "it opens on the game being loaded")
	assert_string_contains(story.text, "Thirteen")
	var first: int = loading.slide
	loading.turn(1)
	assert_ne(loading.slide, first, "the next slide")
	assert_ne(title.text, "Tiến Lên")
	loading.turn(-1)
	assert_eq(loading.slide, first, "and back")
	for entry: Array in HubLoading.SLIDES:
		assert_not_null(HubGameArt.splash(str(entry[0])), "%s has art" % entry[0])


func test_result_ranks_and_rewards() -> void:
	var won: XomDaoRoomSnapshot = _snapshot(
		["minh"], [{"player": "minh", "resource": "core:coin", "amount": 20}]
	)
	assert_eq(HubResult.ranks(won), {"minh": 1, "bot:1": 2})
	assert_eq(HubResult.coins(won), {"minh": 20})
	assert_eq(HubResult.ranks(_snapshot([], [])), {"minh": 0, "bot:1": 0})
	var settings := XomDaoSettings.new()
	settings.path = ""
	var result: HubResult = add_child_autofree(HubResult.new(settings))
	result.show_result(won, "minh", 100)
	assert_eq(result.find_child("ResultTitle", true, false).text, "Bạn thắng!")
	assert_eq(result.find_child("Reward", true, false).amount, 20)
	assert_eq(result.money.coins.amount, 100)
	assert_true(result.find_child("Again", true, false).visible, "the host plays again")
	result.receive(120)
	await wait_seconds(1.5)
	assert_eq(result.money.coins.text, "120")


func test_escape_returns_to_result_then_leaves_the_finished_room() -> void:
	var settings := XomDaoSettings.new()
	settings.path = ""
	var result: HubResult = add_child_autofree(HubResult.new(settings))
	result.show_result(_snapshot(["minh"], []), "minh", 100)
	result.show_board(true)
	watch_signals(result)
	var escape := InputEventAction.new()
	escape.action = "ui_cancel"
	escape.pressed = true
	result._unhandled_input(escape)
	assert_false(result.looking(), "Escape returns from the table to its result")
	result._unhandled_input(escape)
	assert_signal_emitted(result, "home_pressed", "Escape leaves from the result")


func test_right_result_panel_stays_inside_viewport_after_scaling() -> void:
	var won: XomDaoRoomSnapshot = _snapshot(["minh"], [])
	var settings := XomDaoSettings.new()
	settings.path = ""
	var result: HubResult = add_child_autofree(HubResult.new(settings))
	result.set_anchors_preset(Control.PRESET_TOP_LEFT)
	result.size = XomDaoFrame.SIZE
	(
		result
		. show_result(
			won,
			"minh",
			100,
			false,
			{
				"reason": "Các đối thủ đã phá sản",
				"rows": [["Thời gian", "0:12"], ["Số vòng", "1"], ["Tổng tài sản", "1.000 ₫"]],
				"layout": "right",
			}
		)
	)
	await wait_process_frames(2)
	var panel: Control = result.find_child("ResultBoard", true, false)
	var shade: ColorRect = result.get("_shade")
	assert_eq(
		result.mouse_filter,
		Control.MOUSE_FILTER_IGNORE,
		"the side result panel leaves the game table interactive"
	)
	assert_eq(
		panel.mouse_filter,
		Control.MOUSE_FILTER_STOP,
		"the result panel itself still receives input"
	)
	assert_eq(
		shade.mouse_filter,
		Control.MOUSE_FILTER_IGNORE,
		"the side result shade does not block the game table"
	)
	var top_left: Vector2 = panel.position + panel.pivot_offset * (Vector2.ONE - panel.scale)
	var bottom_right: Vector2 = top_left + panel.size * panel.scale
	assert_gte(top_left.x, settings.margin, "the panel stays inside the left edge")
	assert_gte(top_left.y, settings.margin, "the panel stays inside the top edge")
	assert_lte(
		bottom_right.x, result.size.x - settings.margin, "the panel stays inside the right edge"
	)
	assert_lte(
		bottom_right.y, result.size.y - settings.margin, "the panel stays inside the bottom edge"
	)
	result.show_board(true)
	await wait_process_frames(2)
	var reopen: Control = result.find_child("ShowResult", true, false)
	assert_gte(reopen.position.x, result.size.x * 0.5, "the reopen button sits on the right")
	assert_gte(reopen.position.y, result.size.y * 0.5, "the reopen button sits at the bottom")
	assert_lte(
		reopen.position.x + reopen.size.x,
		result.size.x - settings.margin,
		"the reopen button stays inside the right edge"
	)
	assert_lte(
		reopen.position.y + reopen.size.y,
		result.size.y - settings.margin,
		"the reopen button stays inside the bottom edge"
	)
	assert_eq(
		result.mouse_filter,
		Control.MOUSE_FILTER_IGNORE,
		"putting the result away keeps the game table interactive"
	)
	result.show_board(false)
	assert_eq(
		result.mouse_filter,
		Control.MOUSE_FILTER_IGNORE,
		"reopening a side result leaves the game table interactive"
	)
	var docked := HubResult.new(settings)
	docked.set_anchors_preset(Control.PRESET_TOP_LEFT)
	docked.size = XomDaoFrame.SIZE
	docked.dock(func() -> Rect2: return Rect2(Vector2(24.0, 24.0), Vector2(400.0, 400.0)))
	add_child_autofree(docked)
	docked.show_result(won, "minh", 100)
	assert_eq(
		docked.mouse_filter,
		Control.MOUSE_FILTER_IGNORE,
		"a result docked by the game leaves uncovered controls interactive"
	)


class HookGame:
	extends Node
	var calls: int = 0
	var hold: float = 0.0

	func wait_for_result_panel() -> void:
		calls += 1
		if hold > 0.0:
			await get_tree().create_timer(hold).timeout


func _still() -> bool:
	return true


func test_the_hub_waits_for_a_games_own_end_beat_on_every_ending() -> void:
	var host: Control = add_child_autofree(Control.new())
	var game: HookGame = add_child_autofree(HookGame.new())
	game.hold = 0.2
	for winners: Array in [[], ["bot:1"], ["minh"]]:
		var began: int = Time.get_ticks_msec()
		await HubEndBeat.run(host, game, _snapshot(winners, []), "minh", _still)
		assert_gte(Time.get_ticks_msec() - began, 150, "waited for the game (%s)" % [winners])
		assert_null(host.find_child("EndBeat", true, false), "no hub ribbon over the game's own")
	assert_eq(game.calls, 3, "a draw and a loss wait too, not only a win")


func test_a_games_end_beat_is_capped_and_dropped_when_the_ending_goes() -> void:
	assert_eq(HubEndBeat.WAIT_CAP, 8.0)
	var host: Control = add_child_autofree(Control.new())
	var game: HookGame = add_child_autofree(HookGame.new())
	game.hold = 30.0
	var began: int = Time.get_ticks_msec()
	var said: bool = await HubEndBeat.wait_for_game(host, game, _still, 0.3)
	assert_false(said, "the game never said it was ready")
	assert_between(Time.get_ticks_msec() - began, 250, 1000, "gave up at the cap")
	began = Time.get_ticks_msec()
	await HubEndBeat.wait_for_game(host, game, func() -> bool: return false)
	assert_lt(Time.get_ticks_msec() - began, 100, "stops once the room left its ending")


func test_a_game_without_its_own_gets_the_hubs_ribbon() -> void:
	var host: Control = add_child_autofree(Control.new())
	host.size = XomDaoFrame.SIZE
	var game: Node = add_child_autofree(Node.new())
	var won: XomDaoRoomSnapshot = _snapshot(["minh"], [])
	HubEndBeat.run(host, game, won, "minh", _still)
	await wait_process_frames(2)
	var beat: HubEndBeat = host.find_child("EndBeat", true, false)
	assert_not_null(beat, "the default beat plays")
	assert_eq(beat.headline, "Thắng rồi!")
	assert_false(beat.find_child("EndRibbon", true, false).visible, "a pause first")
	await wait_seconds(HubEndBeat.PAUSE + 0.2)
	assert_true(beat.find_child("EndRibbon", true, false).visible, "then the ribbon")
	var tap := InputEventMouseButton.new()
	tap.button_index = MOUSE_BUTTON_LEFT
	tap.pressed = true
	beat._gui_input(tap)
	assert_false(beat.running, "a tap skips it")
	await wait_seconds(0.8)
	assert_null(host.find_child("EndBeat", true, false), "gone for the board")
	assert_eq(HubEndBeat.headline_for(_snapshot(["bot:1"], []), "minh"), "Thua rồi")
	assert_eq(HubEndBeat.headline_for(_snapshot([], []), "minh"), "Hoà")
	assert_eq(HubEndBeat.headline_for(won, "lan"), "Minh thắng", "someone watching")
	assert_eq(HubEndBeat.outcome_for(won, "lan"), "watch")


func test_a_game_skins_the_result_board() -> void:
	var settings := XomDaoSettings.new()
	settings.path = ""
	var result: HubResult = add_child_autofree(HubResult.new(settings))
	var emblem := PlaceholderTexture2D.new()
	emblem.size = Vector2(96.0, 96.0)
	var accent := Color("#2E6B4A")
	(
		result
		. apply_theme(
			{
				"paper": Color("#EFE6CF"),
				"ink": Color("#20302A"),
				"accent": accent,
				"shade": Color(0.0, 0.1, 0.05, 0.5),
				"title": "Tàn cuộc",
				"emblem": emblem,
			}
		)
	)
	result.show_result(_snapshot(["minh"], []), "minh", 100)
	var board: XomDaoBoard = result.find_child("ResultBoard", true, false)
	assert_eq(board.title, "Tàn cuộc")
	assert_true(result.find_child("ResultEmblem", true, false).visible)
	assert_eq((result.get("_shade") as ColorRect).color, Color(0.0, 0.1, 0.05, 0.5))
	var title: Label = result.find_child("ResultTitle", true, false)
	assert_eq(title.get_theme_color("font_color"), accent)
	assert_not_null(result.find_child("MyRow", true, false), "your row stands out")
	var paper: StyleBoxFlat = board.content.get_parent().get_theme_stylebox("panel")
	assert_eq(paper.bg_color, Color("#EFE6CF"))


func test_the_board_arrives_before_the_coins_fly() -> void:
	var settings := XomDaoSettings.new()
	settings.path = ""
	var result: HubResult = add_child_autofree(HubResult.new(settings))
	result.set_anchors_preset(Control.PRESET_TOP_LEFT)
	result.size = XomDaoFrame.SIZE
	var won: XomDaoRoomSnapshot = _snapshot(
		["minh"], [{"player": "minh", "resource": "core:coin", "amount": 20}]
	)
	result.show_result(won, "minh", 100)
	result.present()
	result.receive(120)
	assert_true(result.arriving())
	assert_eq(result.money.coins.amount, 100, "the coins wait for the board")
	await wait_seconds(0.7)
	assert_false(result.arriving(), "in place within about half a second")
	await wait_seconds(1.5)
	assert_eq(result.money.coins.text, "120")


func test_rules_read_as_plain_text() -> void:
	var text: String = HubRulesBoard.plain(
		"# Luật Caro\n\nHai người **lần lượt**.\n\n## Thắng\n\n- Đủ `5` quân thì thắng."
	)
	assert_eq(text, "Hai người lần lượt.\n\nThắng\n\n• Đủ 5 quân thì thắng.")


func test_the_selected_game_is_kept_per_account() -> void:
	var path: String = "user://test_hub.cfg"
	HubPrefs.set_selected_game("u1", "tic-tac-toe", path)
	HubPrefs.set_selected_game("u2", "tien-len", path)
	assert_eq(HubPrefs.selected_game("u1", path), "tic-tac-toe")
	assert_eq(HubPrefs.selected_game("u2", path), "tien-len")
	assert_eq(HubPrefs.selected_game("u3", path), "")
	var stats1: Dictionary = {"level": 5, "xp": 1200, "levelXp": 1000, "nextXp": 1500}
	var stats2: Dictionary = {"level": 2, "xp": 150, "levelXp": 100, "nextXp": 300}
	HubPrefs.set_player_stats("u1", stats1, path)
	HubPrefs.set_player_stats("u2", stats2, path)
	assert_eq(HubPrefs.player_stats("u1", path), stats1)
	assert_eq(HubPrefs.player_stats("u2", path), stats2)
	assert_eq(HubPrefs.player_stats("u3", path), {})
	DirAccess.remove_absolute(path)
