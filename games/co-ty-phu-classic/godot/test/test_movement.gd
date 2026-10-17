extends GutTest
## Cờ tỷ phú Classic's table against made-up room snapshots (no server).


func _snapshot(view: Dictionary) -> XomDaoRoomSnapshot:
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
				"gameId": "co-ty-phu-classic",
				"hostId": "me",
				"players": people,
				"spectators": [],
				"seats": people,
				"status": "playing",
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
	var players: Array = []
	for seat: int in 3:
		(
			players
			. append(
				{
					"cash": 1000,
					"position": 0,
					"jailed": false,
					"jailRolls": 0,
					"freeCards": [],
					"bankrupt": false,
				}
			)
		)
	var properties: Array = []
	for i: int in 40:
		properties.append({"owner": null, "houses": 0, "mortgaged": false})
	var view: Dictionary = {
		"lastAutoAction": null,
		"specialEvent": null,
		"moneySequence": 3,
		"transfers": [],
		"players": players,
		"properties": properties,
		"turn": 0,
		"playerTurns": [1, 0, 0],
		"round": 0,
		"shortages": [],
		"phase": "roll",
		"after": "end",
		"doubles": 0,
		"dice": null,
		"pending": null,
		"buildable": null,
		"auction": null,
		"stationAuctions": {},
		"debt": null,
		"trade": null,
		"notice": "Bắt đầu ván mới.",
		"lastCard": null,
		"winner": null,
	}
	view.merge(extra, true)
	return view


func _table(view: Dictionary) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view)
	var table: Control = add_child_autofree(
		load("res://content/co-ty-phu-classic/main.tscn").instantiate()
	)
	table.call("bind", client)
	return table


func _node(table: Control, name_of: String) -> Control:
	return table.find_child(name_of, true, false) as Control


func _text(table: Control, name_of: String) -> String:
	var node: Control = _node(table, name_of)
	return (node as Label).text if node is Label else (node as Button).text


func _tap(node: Control) -> void:
	var up := InputEventMouseButton.new()
	up.button_index = MOUSE_BUTTON_LEFT
	up.pressed = false
	node.gui_input.emit(up)


func test_card_destination_walks_clockwise_through_intermediate_squares() -> void:
	var before := _view(
		{
			"phase": "event",
			"specialEvent":
			{
				"kind": "card",
				"id": 3,
				"ready": true,
				"deck": "chance",
				"roll": 4,
				"card": {"kind": "move", "target": 24, "text": "Đến Hội An"}
			}
		}
	)
	before["players"][0]["position"] = 7
	var table := _table(before)
	var after: Dictionary = before.duplicate(true)
	after["specialEvent"] = null
	after["phase"] = "buy"
	after["pending"] = 24
	after["players"][0]["position"] = 24
	table.call("_show", _snapshot(after))
	await wait_seconds(0.35)
	assert_between(int(table.get("_shown")[0]), 8, 11, "A long card move visits the clockwise path")
	assert_lt(float(_node(table, "Pawn_0").get("elevation")), 0.06, "Walks rather than flying")
	await wait_seconds(2.6)
	assert_eq(int(table.get("_shown")[0]), 24)
	assert_false(bool(table.get("_running")))


func test_start_reward_plays_when_pawn_reaches_start_before_its_destination() -> void:
	var before := _view({"phase": "end"})
	before["players"][0]["position"] = 39
	var table := _table(before)
	var after: Dictionary = before.duplicate(true)
	after["players"][0]["position"] = 5
	after["players"][0]["cash"] = 1200
	after["moneySequence"] = 4
	after["transfers"] = [{"from": null, "to": 0, "amount": 200, "reason": "Qua Xuất phát"}]
	table.call("_show", _snapshot(after))
	await wait_seconds(0.40)
	assert_eq(int(table.get("_shown")[0]), 0)
	var exchange: Control = table.get("_exchange")
	assert_true(bool(exchange.get("busy")), "Reward begins on arrival at Start")
	await wait_seconds(0.85)
	assert_eq(int(table.get("_cash")[0]), 1200, "Cash credited before the destination")
	assert_eq(int(table.get("_shown")[0]), 0)
	await wait_seconds(1.8)
	assert_eq(int(table.get("_shown")[0]), 5)
	assert_eq(int(table.get("_cash")[0]), 1200, "Reward is counted once")


func test_airport_plane_collects_carries_and_drops_the_pawn() -> void:
	var before := _view(
		{
			"phase": "event",
			"specialEvent":
			{"kind": "airport", "id": 3, "ready": true, "roll": 4, "reason": "Chuyến bay"}
		}
	)
	before["players"][0]["position"] = 20
	var table := _table(before)
	var pawn: Control = _node(table, "Pawn_0")
	var start: Vector2 = pawn.position
	var after: Dictionary = before.duplicate(true)
	after["specialEvent"] = null
	after["phase"] = "end"
	after["players"][0]["position"] = 1
	table.call("_show", _snapshot(after))
	await wait_seconds(0.2)
	var stage: Control = table.get("_throw").get("stage")
	var aircraft: Node3D = stage.get("aircraft")
	assert_true(aircraft.visible)
	assert_almost_eq(pawn.position, start, Vector2.ONE * 0.01, "Pawn waits for pickup")
	await wait_seconds(0.9)
	assert_gt(float(pawn.get("elevation")), 0.25, "Pawn is carried under the plane")
	assert_gt(pawn.position.distance_to(start), 1.0)
	await wait_seconds(1.1)
	assert_almost_eq(float(pawn.get("elevation")), 0.0, 0.01, "Pawn drops before plane departs")
	await wait_seconds(0.7)
	assert_false(aircraft.visible)
	assert_eq(int(table.get("_shown")[0]), 1)


func test_nearest_utility_card_walks_forward_across_start() -> void:
	var before := _view(
		{
			"phase": "event",
			"specialEvent":
			{
				"kind": "card",
				"id": 3,
				"ready": true,
				"deck": "chance",
				"roll": 4,
				"card": {"kind": "nearest", "target": "utility", "text": "Đến tiện ích gần nhất"}
			}
		}
	)
	before["players"][0]["position"] = 28
	var table := _table(before)
	var after: Dictionary = before.duplicate(true)
	after["specialEvent"] = null
	after["phase"] = "buy"
	after["pending"] = 12
	after["players"][0]["position"] = 12
	table.call("_show", _snapshot(after))
	await wait_seconds(0.35)
	assert_between(int(table.get("_shown")[0]), 29, 32)
	await wait_seconds(3.7)
	assert_eq(int(table.get("_shown")[0]), 12)
	assert_false(bool(table.get("_running")))


func test_airport_start_reward_begins_at_drop_before_departure_finishes() -> void:
	var before := _view(
		{
			"phase": "event",
			"specialEvent":
			{"kind": "airport", "id": 3, "ready": true, "roll": 4, "reason": "Chuyến bay"}
		}
	)
	before["players"][0]["position"] = 20
	var table := _table(before)
	var after: Dictionary = before.duplicate(true)
	after["specialEvent"] = null
	after["phase"] = "end"
	after["players"][0]["position"] = 0
	after["players"][0]["cash"] = 1200
	after["moneySequence"] = 4
	after["transfers"] = [{"from": null, "to": 0, "amount": 200, "reason": "Đáp Xuất phát"}]
	table.call("_show", _snapshot(after))
	await wait_seconds(2.3)
	assert_almost_eq(float(_node(table, "Pawn_0").get("elevation")), 0.0, 0.001)
	assert_true(bool(table.get("_exchange").get("busy")), "Reward begins immediately after drop")
	await wait_seconds(2.1)
	assert_eq(int(table.get("_cash")[0]), 1200)
	assert_false(bool(table.get("_running")))


func test_removing_the_timer_clears_the_countdown_without_changing_turn() -> void:
	var view := _view({"phase": "end"})
	var table := _table(view)
	var snapshot: XomDaoRoomSnapshot = _snapshot(view)
	snapshot.timer = XomDaoRoomTimer.from_dict(
		{"event": "turn-timeout", "ms": 20000, "left": 10000}
	)
	table.call("_show", snapshot)
	var card: XomDaoPlayerSlot = _node(table, "Seat_0")
	assert_almost_eq(float(card.call("countdown_fraction")), 0.5, 0.01)
	snapshot = _snapshot(view)
	table.call("_show", snapshot)
	assert_eq(float(card.call("countdown_fraction")), -1.0)
	assert_true(card.is_turn())
