extends GutTest
## Cờ tỷ phú Classic's table against made-up room snapshots (no server).

const Texts := preload("res://content/co-ty-phu-classic/texts.gd")
const TileHud := preload("res://content/co-ty-phu-classic/tile_hud.gd")


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


func test_tile_hud_shows_a_running_ink_figure_until_the_local_pawn_stops() -> void:
	var table := _table(_view())
	var hud: Control = _node(table, "TileHud")
	assert_eq(int(hud.get("current_square")), 0)
	table.call("_walk", 0, 0, 2)
	assert_true(hud.visible, "The tile HUD stays visible during the walk")
	assert_true(bool(hud.get("_paused_for_motion")), "The HUD switches to its runner animation")
	await wait_until(func() -> bool: return int(table.get("_shown")[0]) == 1, 1.0)
	assert_eq(int(hud.get("current_square")), 0, "Passing a square does not change the HUD")
	assert_true(bool(hud.get("_paused_for_motion")))
	await wait_until(func() -> bool: return int(table.get("_shown")[0]) == 2, 1.0)
	await wait_until(func() -> bool: return not bool(hud.get("_paused_for_motion")), 2.0)
	assert_true(hud.visible, "The tile HUD remains visible after the pawn settles")
	assert_eq(int(hud.get("current_square")), 2)


func test_floating_money_changes_use_gold_for_gains_and_red_orange_for_losses() -> void:
	assert_eq(Texts.money_change_color(200), Color("#FFD34E"))
	assert_eq(Texts.money_change_color(-50), Color("#F05A43"))


func test_owned_street_opens_a_projected_build_price_drawer() -> void:
	var view := _view()
	view["players"][0]["position"] = 1
	for square: int in [1, 2, 3]:
		view["properties"][square]["owner"] = 0
	view["properties"][1]["houses"] = 2
	var table := _table(view)
	var hud: Control = _node(table, "TileHud")
	var button: XomDaoButton = _node(table, "BuildPriceDrawerButton")
	assert_true(button.visible, "The owner sees the build price button on their street")
	assert_eq(
		TileHud.summary(view, 1, ["Minh", "Máy 1", "Máy 2"], 0)["rent_ladder"],
		[60, 240, 660, 1800, 2400, 3000],
		"The displayed ladder includes the current complete-set multiplier"
	)
	button.pressed.emit()
	await wait_until(func() -> bool: return float(hud.get("_drawer_progress")) >= 0.99, 1.0)
	assert_true(bool(hud.get("_drawer_open")))
	assert_eq(button.text, "v")
	button.pressed.emit()
	await wait_until(func() -> bool: return float(hud.get("_drawer_progress")) <= 0.01, 1.0)
	assert_false(bool(hud.get("_drawer_open")))


func test_build_price_button_is_hidden_for_a_street_owned_by_another_player() -> void:
	var view := _view()
	view["players"][0]["position"] = 1
	view["properties"][1]["owner"] = 1
	var table := _table(view)
	assert_false(_node(table, "BuildPriceDrawerButton").visible)


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


func test_leaving_jail_without_moving_does_not_call_the_aircraft() -> void:
	var before := _view({"phase": "roll"})
	before["players"][0]["position"] = 10
	before["players"][0]["jailed"] = true
	var table := _table(before)
	var after: Dictionary = before.duplicate(true)
	after["players"][0]["jailed"] = false
	after["players"][0]["cash"] = 950
	after["moneySequence"] = 4
	after["transfers"] = [{"from": 0, "to": null, "amount": 50, "reason": "Ra tù"}]
	table.call("_show", _snapshot(after))
	await wait_seconds(1.0)
	var stage: Control = table.get("_throw").get("stage")
	var aircraft: Node3D = stage.get("aircraft")
	assert_false(aircraft.visible, "Paying to leave jail must not call the airport aircraft")
	assert_eq(int(table.get("_shown")[0]), 10, "The pawn stays at the jail square until a roll")


func test_background_retries_video_after_pointer_input() -> void:
	var table := _table(_view())
	var background: Control = table.find_child("Background", true, false)
	var video: VideoStreamPlayer = background.find_child("BackgroundVideo", true, false)
	video.stop()
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	background.call("_input", click)
	assert_true(video.is_playing(), "A user click should start the background video")


func test_bot_ownership_waits_until_the_pawn_arrives() -> void:
	var before := _view({"turn": 1, "phase": "buy"})
	var table := _table(before)
	await wait_until(func() -> bool: return not bool(table.get("_running")), 3.0)
	var after: Dictionary = before.duplicate(true)
	after["players"][1]["position"] = 1
	after["properties"][1]["owner"] = 1
	after["phase"] = "end"
	table.call("_show", _snapshot(after))
	await wait_seconds(0.04)
	var marks: Control = table.get("_marks")
	var marks_view: Dictionary = marks.get("view")
	assert_null(
		marks_view["properties"][1]["owner"],
		"The deed stays neutral while the bot's pawn is still moving"
	)
	await wait_seconds(0.35)
	marks_view = marks.get("view")
	assert_eq(marks_view["properties"][1]["owner"], 1, "The deed changes after the bot arrives")


func test_auction_and_destination_wait_for_dice_and_movement() -> void:
	var before := _view()
	var table := _table(before)
	var after: Dictionary = before.duplicate(true)
	after["phase"] = "auction"
	after["pending"] = 5
	after["dice"] = [2, 3]
	after["players"][0]["position"] = 5
	after["auction"] = {
		"square": 5,
		"highest": 0,
		"leader": null,
		"bidder": 0,
		"passed": [],
		"bids": [0, 0, 0],
		"contributions": [0, 0, 0],
	}
	table.call("_show", _snapshot(after))
	await wait_seconds(0.06)
	assert_eq(
		table.get("_presented_view")["phase"], "roll", "The new phase waits behind its animation"
	)
	assert_null(table.get("_marks").get("view")["pending"])
	assert_false(_node(table, "Bid").visible, "Auction actions wait until arrival")
	await wait_seconds(1.2)
	assert_eq(
		table.get("_presented_view")["phase"], "roll", "The destination stays hidden mid-roll"
	)
	assert_null(table.get("_marks").get("view")["pending"])
	await wait_until(func() -> bool: return not bool(table.get("_running")), 6.0)
	assert_eq(table.get("_presented_view")["phase"], "auction")
	assert_eq(table.get("_marks").get("view")["pending"], 5)
	assert_true(_node(table, "Bid").visible, "Auction actions appear after the pawn arrives")


func test_bot_purchase_snapshot_waits_behind_its_landing_animation() -> void:
	var before := _view({"turn": 1})
	var table := _table(before)
	var landing: Dictionary = before.duplicate(true)
	landing["phase"] = "buy"
	landing["pending"] = 3
	landing["dice"] = [1, 2]
	landing["moneySequence"] = 4
	landing["players"][1]["position"] = 3
	table.call("_show", _snapshot(landing))
	var purchased: Dictionary = landing.duplicate(true)
	purchased["phase"] = "end"
	purchased["pending"] = null
	purchased["moneySequence"] = 5
	purchased["transfers"] = [{"from": 1, "to": null, "amount": 200, "reason": "Mua Việt Trì"}]
	purchased["players"][1]["cash"] = 800
	purchased["properties"][3]["owner"] = 1
	table.call("_show", _snapshot(purchased))
	await wait_seconds(0.06)
	assert_eq(table.get("_view")["phase"], "end", "Rules accept the bot's purchase immediately")
	assert_eq(table.get("_presented_view")["phase"], "roll", "The table still presents the roll")
	assert_null(table.get("_marks").get("view")["properties"][3]["owner"])
	await wait_until(
		func() -> bool: return str(table.get("_presented_view")["phase"]) == "buy", 6.0
	)
	assert_null(
		table.get("_marks").get("view")["properties"][3]["owner"],
		"The deed stays neutral while the bot's payment animates"
	)
	await wait_until(func() -> bool: return not bool(table.get("_running")), 6.0)
	assert_eq(table.get("_presented_view")["phase"], "end")
	assert_eq(table.get("_marks").get("view")["properties"][3]["owner"], 1)


func test_jail_rent_status_changes_after_the_pawn_enters_jail() -> void:
	var before := _view(
		{
			"phase": "event",
			"specialEvent": {"kind": "jail", "id": 8, "ready": true, "reason": "Bị đưa vào tù!"}
		}
	)
	before["players"][0]["position"] = 30
	before["properties"][1]["owner"] = 0
	var table := _table(before)
	var after: Dictionary = before.duplicate(true)
	after["phase"] = "end"
	after["specialEvent"] = null
	after["players"][0]["position"] = 10
	after["players"][0]["jailed"] = true
	table.call("_show", _snapshot(after))
	await wait_seconds(0.08)
	var shown: Dictionary = table.get("_presented_view")
	assert_false(
		bool(shown["players"][0]["jailed"]), "The player remains free during jail transport"
	)
	assert_true(
		Texts.square(shown, 1, table.call("_names")).contains("Thuê bây giờ 20 ₫"),
		"Rent remains active until the pawn enters jail"
	)
	await wait_until(func() -> bool: return not bool(table.get("_running")), 6.0)
	shown = table.get("_presented_view")
	assert_true(bool(shown["players"][0]["jailed"]))
	assert_true(
		Texts.square(shown, 1, table.call("_names")).contains("Thuê bây giờ 0 ₫"),
		"Rent becomes zero when the jail movement finishes"
	)


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
