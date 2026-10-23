extends GutTest
## Bài Cào's table against made-up room snapshots (no server).


func _snapshot(view: Dictionary, status: String = "playing") -> XomDaoRoomSnapshot:
	var people: Array = [
		{"id": "me", "name": "Minh"},
		{"id": "b1", "name": "Máy 1", "bot": true},
		{"id": "b2", "name": "Máy 2", "bot": true},
	]
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "bai-cao",
				"hostId": "me",
				"players": people,
				"spectators": [],
				"seats": people,
				"status": status,
				"view": view,
				"result": null,
				"score": {"wins": [0, 0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func _view(extra: Dictionary = {}) -> Dictionary:
	var view: Dictionary = {
		"round": 2,
		"rounds": 10,
		"phase": "bet",
		"dealer": 1,
		"points": [15, -5, -10],
		"bets": [null, null, 10],
		"hands": [[], [], []],
		"revealed": [false, false, false],
		"gone": [],
		"results": null,
	}
	view.merge(extra, true)
	return view


func _table(view: Dictionary) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view)
	var table: Control = add_child_autofree(load("res://content/bai-cao/main.tscn").instantiate())
	table.call("bind", client)
	return table


func _text(table: Control, name_of: String) -> String:
	return (table.find_child(name_of, true, false) as Label).text


func test_betting_shows_the_bets_and_the_dealer() -> void:
	var table := _table(_view())
	assert_eq(_text(table, "Round"), "Ván 2/10")
	assert_eq(_text(table, "Dealer"), "Cái: Máy 1")
	assert_eq(_text(table, "Status"), "Đặt cược")
	assert_eq(_text(table, "Info"), "Đã cược 1/2")
	assert_true((table.find_child("Bet_10", true, false) as Control).visible)
	assert_false((table.find_child("Reveal", true, false) as Control).visible)
	assert_eq(_text(table, "Tag_1"), "Nhà cái")
	assert_eq(_text(table, "Tag_2"), "Cược 10")


func test_your_cards_open_one_by_one_then_turn_over() -> void:
	# 9♣ 10♠ K♥ for you; the others' cards are still face down (null).
	var table := _table(
		_view({"phase": "reveal", "bets": [5, null, 10], "hands": [[32, 37, 50], null, null]})
	)
	assert_true((table.find_child("Mine_0", true, false) as Control).visible)
	assert_true((table.find_child("Reveal", true, false) as Control).visible)
	assert_eq(_text(table, "Status"), "Đã nặn 0/3")
	var tap := InputEventMouseButton.new()
	tap.button_index = MOUSE_BUTTON_LEFT
	tap.pressed = true
	(table.find_child("Mine_0", true, false) as Control).gui_input.emit(tap)
	var up := InputEventMouseButton.new()
	up.button_index = MOUSE_BUTTON_LEFT
	up.pressed = false
	(table.find_child("Mine_0", true, false) as Control).gui_input.emit(up)
	assert_eq(_text(table, "Status"), "Đã nặn 1/3")


func test_the_count_shows_hands_and_points() -> void:
	var table := _table(
		_view(
			{
				"phase": "showdown",
				"bets": [5, null, 10],
				"hands": [[40, 44, 48], [0, 4, 8], [32, 37, 50]],
				"revealed": [true, true, true],
				"results":
				[{"seat": 0, "delta": 10}, {"seat": 1, "delta": -20}, {"seat": 2, "delta": 10}],
			}
		)
	)
	assert_eq(_text(table, "Status"), "+10 điểm")
	assert_eq(_text(table, "Delta_1"), XomDaoUi.delta(-20))
	assert_eq((table.find_child("Card_1_0", true, false) as XomDaoCard).rank, "A")


func _finished(points: Array, winners: Array) -> XomDaoRoomSnapshot:
	var over := _snapshot(_view({"phase": "showdown", "points": points}), "finished")
	over.result = XomDaoGameResult.from_dict({"winners": winners, "rewards": []})
	return over


func test_a_live_end_slides_the_chips_to_the_winner_before_the_result() -> void:
	var table := _table(_view())
	var client: XomDaoClient = table.get("_client")
	client.snapshot = _finished([20, -5, -15], ["me"])
	var waited: Array[bool] = [false]
	var waiter: Callable = func() -> void:
		await table.call("wait_for_result_panel")
		waited[0] = true
	waiter.call()
	await wait_seconds(1.8)
	assert_true(table.find_child("EndStrip", true, false).visible, "the strip says it")
	assert_eq(_text(table, "EndHeadline"), "Thắng rồi!")
	assert_eq(_text(table, "EndLine"), "Nhiều điểm nhất, 20 điểm")
	assert_false(waited[0], "the result board waits for the beat")
	await wait_seconds(2.0)
	assert_true(waited[0])


func test_the_result_board_places_everyone_by_points() -> void:
	var table := _table(_view())
	(table.get("_client") as XomDaoClient).snapshot = _finished([-5, 10, 10], ["b1", "b2"])
	var detail: Dictionary = table.call("result_detail")
	assert_eq(detail["ranks"], {"b1": 1, "b2": 1, "me": 3}, "level points share a place")
	assert_eq(detail["scores"]["me"], "-5 điểm")
	assert_eq((table.call("result_theme") as Dictionary)["title"], "Tàn canh")
	assert_true(table.call("table_skin") is XomDaoTableSkin)


func test_keys_bet_and_open_cards() -> void:
	var table := _table(_view())
	assert_true((table.find_child("Bet_10", true, false) as Control).is_visible_in_tree())
	var two := InputEventKey.new()
	two.keycode = KEY_2
	two.pressed = true
	table.call("_unhandled_key_input", two)
	assert_false(
		(table.find_child("BetTray", true, false) as Control).visible, "2 bets 10: the chips go"
	)
	var squeezing := _table(
		_view({"phase": "reveal", "bets": [5, null, 10], "hands": [[32, 37, 50], null, null]})
	)
	var one := InputEventKey.new()
	one.keycode = KEY_1
	one.pressed = true
	squeezing.call("_unhandled_key_input", one)
	assert_eq(_text(squeezing, "Status"), "Đã nặn 1/3", "1 opens the first card")
