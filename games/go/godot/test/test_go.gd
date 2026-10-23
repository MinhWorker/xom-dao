extends GutTest
## Cờ Vây's table against made-up room snapshots (no server).


func _snapshot(view: Dictionary, status: String = "playing") -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "go",
				"hostId": "me",
				"players":
				[{"id": "me", "name": "Minh"}, {"id": "bot", "name": "Máy", "bot": true}],
				"spectators": [],
				"seats": [{"id": "me", "name": "Minh"}, {"id": "bot", "name": "Máy", "bot": true}],
				"status": status,
				"view": view,
				"result": null,
				"score": {"wins": [1, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func _board(stones: Dictionary) -> String:
	var board: String = ".".repeat(361)
	for p: int in stones:
		board[p] = stones[p]
	return board


func _view(players: Array, turn: String, extra: Dictionary = {}) -> Dictionary:
	var view: Dictionary = {
		"size": 19,
		"board": _board({72: "b", 288: "w"}),
		"players": players,
		"turn": turn,
		"last": {"side": "w", "point": 288, "captured": []},
		"ko": null,
		"prisoners": {"b": 0, "w": 0},
		"passes": 0,
		"plies": 2,
		"phase": "play",
		"dead": [],
		"guess": [],
		"accepted": [],
		"end": null,
		"moves": [0, 1, 2],
		"count": null,
	}
	view.merge(extra, true)
	return view


func _table(view: Dictionary, status: String = "playing") -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view, status)
	var table: Control = add_child_autofree(load("res://content/go/main.tscn").instantiate())
	table.call("bind", client)
	return table


func test_shows_the_stones_and_whose_turn() -> void:
	var table := _table(_view(["me", "bot"], "b", {"prisoners": {"b": 2, "w": 1}}))
	assert_not_null(table.find_child("Stone_72", true, false), "a black stone")
	assert_not_null(table.find_child("Stone_288", true, false), "a white stone")
	assert_null(table.find_child("Stone_0", true, false), "the corner is empty")
	assert_eq((table.find_child("Status", true, false) as Label).text, "Lượt bạn")
	assert_eq((table.find_child("Details", true, false) as Label).text, "Nước 2")
	assert_eq((table.find_child("Seat_0", true, false) as GoPlayerCard).stats, "Thắng: 1")
	assert_eq((table.find_child("PrisonerCount_0", true, false) as Label).text, "2")
	assert_false((table.find_child("Pass", true, false) as Button).disabled)


func test_white_waits_and_cannot_pass() -> void:
	var table := _table(_view(["bot", "me"], "b", {"moves": []}))
	assert_eq((table.find_child("Status", true, false) as Label).text, "Lượt Máy")
	assert_true((table.find_child("Pass", true, false) as Button).disabled)


func test_counting_shows_the_count_and_its_buttons() -> void:
	var count: Dictionary = {"b": 181, "w": 187.5, "owner": "b".repeat(181) + "w".repeat(180)}
	var table := _table(
		_view(
			["me", "bot"],
			"b",
			{"phase": "scoring", "moves": [], "accepted": ["w"], "dead": [72], "count": count}
		)
	)
	assert_eq((table.find_child("Status", true, false) as Label).text, "Đếm điểm")
	assert_eq(
		(table.find_child("Details", true, false) as Label).text, "Đen 181\nTrắng 187,5\nĐã đồng ý"
	)
	assert_true((table.find_child("Accept", true, false) as Control).visible)
	assert_true((table.find_child("Resume", true, false) as Control).visible)
	assert_false((table.find_child("Pass", true, false) as Control).visible)
	await wait_frames(2)
	var dead: Control = table.find_child("Stone_72", true, false)
	assert_almost_eq(dead.modulate.a, 0.4, 0.01, "the dead stone fades")


func test_the_end_fills_the_result_board() -> void:
	var counted := _table(
		_view(
			["me", "bot"],
			"b",
			{
				"moves": [],
				"prisoners": {"b": 3, "w": 1},
				"end": {"reason": "score", "winner": "w", "score": {"b": 180, "w": 188.5}},
			}
		),
		"finished"
	)
	var detail: Dictionary = counted.call("result_detail")
	assert_eq(detail["reason"], "Máy thắng 8,5 điểm")
	assert_eq(
		detail["rows"],
		[
			["Số nước", "2"],
			["Đen bắt", "3 quân"],
			["Trắng bắt", "1 quân"],
			["Điểm Đen", "180"],
			["Điểm Trắng", "188,5"]
		]
	)
	assert_false((counted.find_child("Resign", true, false) as Control).visible)
	var resigned := _table(
		_view(["me", "bot"], "b", {"end": {"reason": "resign", "winner": "b", "score": null}}),
		"finished"
	)
	assert_eq(resigned.call("result_detail")["reason"], "Máy đầu hàng")


func test_resign_asks_first() -> void:
	var table := _table(_view(["me", "bot"], "b"))
	(table.find_child("Resign", true, false) as Button).pressed.emit()
	assert_true((table.find_child("ResignDialog", true, false) as Control).visible)
	(table.find_child("KeepPlaying", true, false) as Button).pressed.emit()
	assert_false((table.find_child("ResignDialog", true, false) as Control).visible)


func test_a_counted_ending_reveals_the_count_before_the_result() -> void:
	var table := _table(_view(["me", "bot"], "b"))
	var client: XomDaoClient = table.get("_client")
	var owner: String = "b".repeat(180) + "w".repeat(181)
	var counted := _view(
		["me", "bot"],
		"b",
		{
			"moves": [],
			"count": {"b": 180, "w": 188.5, "owner": owner},
			"end": {"reason": "score", "winner": "w", "score": {"b": 180, "w": 188.5}},
		}
	)
	client.snapshot = _snapshot(counted, "finished")
	var waited: Array[bool] = [false]
	var waiter: Callable = func() -> void:
		await table.call("wait_for_result_panel")
		waited[0] = true
	waiter.call()
	await wait_seconds(0.5)
	var plaque: Control = table.find_child("EndPlaque", true, false)
	assert_false(plaque.visible, "the territory comes first")
	await wait_seconds(1.3)
	assert_true(plaque.visible)
	assert_eq((plaque.find_child("EndHeadline", true, false) as Label).text, "Thua rồi")
	assert_eq((plaque.find_child("EndLine", true, false) as Label).text, "Hơn 8,5 điểm")
	assert_eq((plaque.find_child("EndCount_w", true, false) as Label).text, "188,5")
	assert_false(waited[0], "the result board waits for the beat")
	await wait_seconds(1.6)
	assert_true(waited[0])
	assert_eq((table.call("result_theme") as Dictionary)["title"], "Đếm mục")
