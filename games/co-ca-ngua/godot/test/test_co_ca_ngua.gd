extends GutTest
## Cờ Cá Ngựa's table against made-up room snapshots (no server), and the moves it mirrors.

const Rules := preload("res://content/co-ca-ngua/rules.gd")
const RulesPanel := preload("res://content/co-ca-ngua/rules_panel.gd")
const Celebration := preload("res://content/co-ca-ngua/celebration.gd")


func _team(positions: Array) -> Array:
	return positions.map(func(at: int) -> Dictionary: return {"position": at, "finished": at >= 55})


func _state(extra: Dictionary = {}) -> Dictionary:
	var state: Dictionary = {
		"horses": [_team([-1, -1, -1, -1]), _team([-1, -1, -1, -1])],
		"colors": [0, 2],
		"turn": 0,
		"phase": "roll",
		"dice": null,
		"lastRoll": null,
		"lastMove": null,
		"notice": "",
		"moves": 0,
		"winner": null,
		"rankings": [],
	}
	state.merge(extra, true)
	return state


func _table(view: Dictionary) -> Control:
	var people: Array = [{"id": "me", "name": "Minh"}, {"id": "b1", "name": "Máy 1", "bot": true}]
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "co-ca-ngua",
				"hostId": "me",
				"players": people,
				"spectators": [],
				"seats": people,
				"status": "playing",
				"view": view,
				"result": null,
				"score": {"wins": [0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)
	var table: Control = add_child_autofree(
		load("res://content/co-ca-ngua/main.tscn").instantiate()
	)
	table.call("bind", client)
	return table


func test_the_track_and_the_moves() -> void:
	assert_eq(Rules.point([0], 0, 0, 0), Vector2(0, 6))
	assert_eq(Rules.point([2], 0, 0, 0), Vector2(14, 8))
	assert_eq(Rules.point([0], 0, 0, 53), Vector2(2, 7))
	# A 6 lets every horse out of the paddock; a 3 lets none.
	assert_eq(Rules.legal_moves(_state({"phase": "choose", "dice": 6})).size(), 4)
	assert_eq(Rules.legal_moves(_state({"phase": "choose", "dice": 3})).size(), 0)
	# A horse may not pass another, and kicks one it lands on.
	var state := _state({"phase": "choose", "dice": 3})
	state["horses"][0] = _team([0, 2, -1, -1])
	var moves: Array = Rules.legal_moves(state)
	assert_eq(moves.size(), 1)
	assert_eq(int(moves[0]["horse"]), 1)
	state["horses"][1] = _team([-1, -1, -1, -1])
	state["horses"][1][0]["position"] = 31
	state["dice"] = 3
	state["horses"][0] = _team([2, -1, -1, -1])
	moves = Rules.legal_moves(state)
	assert_eq(int(moves[0]["capture"]["seat"]), 1)


func test_the_table_shows_the_turn_and_the_horses() -> void:
	var table := _table(_state())
	assert_eq((table.find_child("Status", true, false) as Label).text, "Lượt bạn")
	await wait_frames(2)
	var red: Control = table.find_child("Horse_0_0", true, false)
	var yellow: Control = table.find_child("Horse_1_0", true, false)
	assert_true(red.position.x < yellow.position.x)
	assert_true(red.position.y < yellow.position.y)


func test_the_winner_is_named() -> void:
	var state := _state({"winner": 1, "rankings": [1]})
	state["horses"][1] = _team([57, 56, 55, 54])
	var table := _table(state)
	assert_eq((table.find_child("Status", true, false) as Label).text, "Máy 1 thắng!")


func test_the_rules_panel_turns_its_pages() -> void:
	var table := _table(_state())
	await wait_frames(2)
	var panel: Control = table.find_child("RulesPanel", true, false)
	assert_false(panel.visible)
	(table.find_child("RulesButton", true, false) as Button).pressed.emit()
	assert_true(panel.visible)
	var count: Label = panel.find_child("RulesPage", true, false)
	assert_eq(count.text, "1 / %d" % RulesPanel.PAGES.size())
	assert_true((panel.find_child("RulesPrev", true, false) as Button).disabled)
	assert_true((panel.find_child("RulesArt", true, false) as Control).visible)
	(panel.find_child("RulesNext", true, false) as Button).pressed.emit()
	assert_eq(count.text, "2 / %d" % RulesPanel.PAGES.size())
	panel.call("turn", 99)
	assert_eq(count.text, "%d / %d" % [RulesPanel.PAGES.size(), RulesPanel.PAGES.size()])
	assert_true((panel.find_child("RulesNext", true, false) as Button).disabled)
	assert_false((panel.find_child("RulesArt", true, false) as Control).visible)
	(panel.find_child("RulesClose", true, false) as Button).pressed.emit()
	assert_false(panel.visible)


func test_the_rules_pictures() -> void:
	var spawn: Array[Dictionary] = RulesPanel.art("spawn")
	assert_eq(spawn.map(func(item: Dictionary) -> Variant: return item["value"]), [1, "hoặc", 6])
	var finish: Array[Dictionary] = RulesPanel.art("finish")
	var squares: Array = finish.filter(
		func(item: Dictionary) -> bool: return item["kind"] == "square"
	)
	assert_eq(squares.map(func(item: Dictionary) -> Variant: return item["value"]), [6, 5, 4, 3])
	assert_eq(RulesPanel.art("none"), [] as Array[Dictionary])


func test_the_plaque_names_the_place() -> void:
	var party: Control = add_child_autofree(Celebration.new())
	party.call("setup", Rect2(0, 0, 640, 640), Color.RED, Color.PINK, "Minh", 1)
	assert_eq((party.find_child("BadgeHeading", true, false) as Label).text, "CHIẾN THẮNG!")
	assert_eq((party.find_child("BadgeRank", true, false) as Label).text, "HẠNG 1")
	assert_eq((party.find_child("BadgeName", true, false) as Label).text, "Minh")
	party.call("setup", Rect2(0, 0, 640, 640), Color.RED, Color.PINK, "Máy 2", 3)
	assert_eq((party.find_child("BadgeHeading", true, false) as Label).text, "VỀ ĐÍCH!")
	assert_eq((party.find_child("BadgeRank", true, false) as Label).text, "HẠNG 3")


func test_a_team_home_gets_its_plaque() -> void:
	var state := _state({"turn": 1, "moves": 20})
	state["horses"][1] = _team([57, 56, 55, 53])
	var table := _table(state)
	await wait_frames(2)
	var done := state.duplicate(true)
	done["horses"][1] = _team([57, 56, 55, 54])
	done["moves"] = 21
	done["rankings"] = [1]
	done["winner"] = 1
	done["lastMove"] = {
		"seat": 1, "horse": 3, "from": 53, "to": 54, "path": [54], "capture": null, "finish": true
	}
	var client: XomDaoClient = table.get("_client")
	var snapshot: XomDaoRoomSnapshot = client.snapshot
	snapshot.view = done
	client.state_changed.emit(snapshot)
	await wait_seconds(0.5)
	var rank: Label = table.find_child("BadgeRank", true, false)
	assert_not_null(rank)
	if rank != null:
		assert_eq(rank.text, "HẠNG 1")
		assert_eq((table.find_child("BadgeName", true, false) as Label).text, "Máy 1")
	assert_eq(table.find_children("Celebration", "", true, false).size(), 1)
	assert_eq(table.call("rank_of", done, 0), 0)
