extends GutTest
## The hub's room screens: Tạo phòng options, the waiting room, the result's ranks and rewards,
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


func test_setup_sends_the_picked_options() -> void:
	var setup: HubRoomSetup = add_child_autofree(HubRoomSetup.new())
	(
		setup
		. show_setup(
			"Caro",
			[
				{
					"key": "opponent",
					"label": "Chơi với",
					"options": [["Bạn bè", "human"], ["Máy", "bot"]]
				},
				{"key": "level", "label": "Máy chơi", "options": [["Dễ", "easy"], ["Khó", "hard"]]},
			]
		)
	)
	assert_eq(setup.options(), {"opponent": "human", "level": "easy"})
	setup.choices["opponent"].choose(1)
	setup.choices["level"].choose(1)
	watch_signals(setup)
	setup.find_child("ConfirmCreate", true, false).pressed.emit()
	assert_signal_emitted_with_parameters(setup, "created", [{"opponent": "bot", "level": "hard"}])


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
	room.show_setup("tic-tac-toe", spec)
	room.show_room(_room(players, held), "minh", _caro(), false)
	var rounds: XomDaoChoice = room.choices["rounds"]
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


func test_seats_fill_rows_by_how_many_there_are() -> void:
	assert_eq(HubWaitingRoom.columns_for(2), 2)
	assert_eq(HubWaitingRoom.columns_for(4), 2)
	assert_eq(HubWaitingRoom.columns_for(6), 3)
	assert_eq(HubWaitingRoom.columns_for(8), 4)


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
	DirAccess.remove_absolute(path)
