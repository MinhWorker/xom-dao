extends GutTest
## Cờ tỷ phú Classic's table against made-up room snapshots (no server).

const TileHud := preload("res://content/co-ty-phu-classic/tile_hud.gd")
const BoardSurface := preload("res://content/co-ty-phu-classic/board_surface.gd")
const DiceHotkey := preload("res://content/co-ty-phu-classic/dice_hotkey.gd")


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


func _rules_script() -> GDScript:
	return load("res://content/co-ty-phu-classic/rules.gd")


func _marks_script() -> GDScript:
	return load("res://content/co-ty-phu-classic/marks.gd")


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


func test_your_turn_offers_the_dice_and_jail_ways_out() -> void:
	var table := _table(_view())
	assert_null(_node(table, "Roll"))
	assert_true(bool(table.get("_can_roll")))
	assert_false(_node(table, "Bail").visible)
	assert_eq(_text(table, "Status"), "Chạm xúc xắc để gieo")
	assert_eq(_text(table, "TurnName"), "Bạn")
	assert_eq((_node(table, "Seat_1") as XomDaoPlayerSlot).extra, "1.000 ₫")
	var view := _view()
	view["players"][0]["jailed"] = true
	view["players"][0]["position"] = 10
	table = _table(view)
	assert_true(_node(table, "Bail").visible)
	assert_false(_node(table, "UseCard").visible)


func test_space_is_a_roll_hotkey_only_for_a_fresh_press_when_roll_is_allowed() -> void:
	var space := InputEventKey.new()
	space.keycode = KEY_SPACE
	space.pressed = true
	assert_true(DiceHotkey.should_roll(space, true))
	assert_false(DiceHotkey.should_roll(space, false))
	space.echo = true
	assert_false(DiceHotkey.should_roll(space, true), "Key repeat does not send another roll")
	space.echo = false
	space.pressed = false
	assert_false(DiceHotkey.should_roll(space, true), "Releasing Space does not roll")
	space.pressed = true
	space.keycode = KEY_ENTER
	assert_false(DiceHotkey.should_roll(space, true), "Only Space is a dice shortcut")


func test_buying_phase_and_square_touch_does_not_open_card() -> void:
	var view := _view({"phase": "buy", "pending": 6, "dice": [2, 4]})
	view["players"][0]["position"] = 6
	view["properties"][1]["owner"] = 0
	view["properties"][1]["houses"] = 2
	var table := _table(view)
	assert_eq(_text(table, "Buy"), "Mua 280")
	assert_true(_node(table, "Skip").visible)
	_tap(_node(table, "Square_1"))
	assert_false(_node(table, "Card").visible)


func test_build_is_offered_after_doubles_on_your_own_street() -> void:
	var view := _view({"phase": "roll", "dice": [3, 3], "doubles": 1, "buildable": 1})
	view["players"][0]["position"] = 1
	view["properties"][1]["owner"] = 0
	var rules: GDScript = _rules_script()
	var squares: Array = rules.get("SQUARES")
	for i: int in 40:
		if squares[i]["kind"] == "street" and i != 1:
			view["properties"][i]["houses"] = 4
	var table := _table(view)
	assert_true(_node(table, "Build").visible)
	assert_false((_node(table, "Build") as Button).disabled)
	assert_eq(_text(table, "Build"), "Xây nhà 100")
	assert_true(bool(table.get("_can_roll")))


func test_right_sidebar_shows_the_tile_hud_instead_of_player_cards() -> void:
	var table := _table(_view())
	assert_false(_node(table, "Seat_0").visible)
	assert_false(_node(table, "Seat_1").visible)
	var tile_hud: Control = _node(table, "TileHud")
	assert_true(tile_hud.visible)
	assert_eq(int(tile_hud.get("current_square")), 0)
	assert_eq(tile_hud.get("details")["name"], "Xuất phát")


func test_tile_hud_summarizes_owner_price_rent_and_monopoly_progress() -> void:
	var view := _view()
	view["properties"][1]["owner"] = 0
	view["properties"][2]["owner"] = 0
	view["properties"][3]["owner"] = 1
	var names: Array[String] = ["Bạn", "Máy 1", "Máy 2"]
	var details: Dictionary = TileHud.summary(view, 1, names, 0)
	var marks: GDScript = _marks_script()
	assert_eq(details["name"], "Phú Quốc")
	assert_eq(details["price"], 200)
	assert_eq(details["rent"], 20)
	assert_eq(details["owner_name"], "Bạn")
	assert_eq(details["group_name"], "Nâu")
	assert_eq(details["group_count"], 2)
	assert_eq(details["group_size"], 3)
	assert_eq(details["title_ink"], marks.call("owner_ink", 0))


func test_a_drawn_card_waits_for_you() -> void:
	var event: Dictionary = {
		"kind": "card",
		"card": {"text": "Nhận cổ tức 100.", "kind": "cash", "amount": 100},
		"deck": "chance",
		"roll": 7,
		"id": 3,
		"ready": true,
	}
	var table := _table(
		_view({"phase": "event", "specialEvent": event, "notice": "Nhận cổ tức 100."})
	)
	assert_false(_node(table, "Card").visible)
	assert_false(_node(table, "Die_0").visible)
	assert_eq(_text(table, "CardTitle"), "Cổ tức")
	assert_eq(_text(table, "CardText"), "Nhận 100 ₫")
	assert_true(_node(table, "Confirm").visible)
	assert_false(bool(table.get("_can_roll")))


func test_debt_offers_bankruptcy_when_short() -> void:
	var view := _view(
		{
			"phase": "debt",
			"debt": {"amount": 300, "creditor": 1, "reason": "Tiền thuê Hà Nội", "after": "end"}
		}
	)
	view["players"][0]["cash"] = 120
	var table := _table(view)
	assert_eq(_text(table, "Status"), "Thiếu 180 ₫")
	assert_true((_node(table, "PayDebt") as Button).disabled)
	assert_true(_node(table, "Bankrupt").visible)


func test_a_station_contribution() -> void:
	var rules: GDScript = _rules_script()
	assert_eq(rules.call("bid_amount", _view({"auction": {"highest": 0}})), 50)
	assert_eq(rules.call("bid_amount", _view({"auction": {"highest": 50}})), 100)
	assert_eq(rules.call("bid_amount", _view({"auction": {"highest": 100}})), 200)
	var auction: Dictionary = {
		"square": 5, "highest": 50, "leader": 1, "passed": [], "bids": [0, 50, 0], "bidder": 0
	}
	var view := _view({"phase": "auction", "auction": auction, "pending": 5})
	view["players"][0]["position"] = 5
	var table := _table(view)
	assert_eq(_text(table, "Bid"), "Góp 100")
	assert_false((_node(table, "Bid") as Button).disabled)
	assert_eq(_text(table, "Pass"), "Từ bỏ")
	assert_eq(_text(table, "Status"), "Bến Bắc: 50 ₫")
	auction["highest"] = 100
	table = _table(view)
	assert_eq(_text(table, "Bid"), "Góp 200")


func test_names_fit_on_their_squares() -> void:
	var marks: GDScript = _marks_script()
	var font: Font = XomDaoUi.display_font(800)
	var short: Dictionary = marks.call("fit_name", "Huế", font, Vector2(200.0, 40.0), 18)
	assert_eq(short["lines"], ["Huế"])
	assert_eq(int(short["size"]), 18)
	var long: Dictionary = marks.call("fit_name", "Thuế thu nhập", font, Vector2(60.0, 40.0), 18)
	assert_eq((long["lines"] as Array).size(), 2)
	assert_lte(int(long["size"]), 18)
	var widest: float = 0.0
	for line: String in long["lines"]:
		widest = maxf(widest, font.get_string_size(line, 0, -1, int(long["size"])).x)
	assert_lte(widest, 60.0)


func test_assets_and_what_mortgaging_brings() -> void:
	var rules: GDScript = _rules_script()
	var view := _view()
	view["properties"][1]["owner"] = 0
	view["properties"][1]["houses"] = 2
	view["properties"][5]["owner"] = 0
	view["properties"][9]["owner"] = 0
	view["properties"][9]["mortgaged"] = true
	view["players"][0]["freeCards"] = ["chance"]
	assert_eq(rules.call("mortgage_squares", view["properties"], 0), [1, 5] as Array[int])
	# 1000 cash + 200 ticket + (200 + 2 × 100) + 50 + 350 − ceil(175 × 1.1)
	assert_eq(rules.call("asset_value", view, 0), 1000 + 200 + 400 + 50 + 350 - 193)


func test_the_dice_paths_end_still() -> void:
	var dice: GDScript = load("res://content/co-ty-phu-classic/dice.gd")
	for motion: String in ["tumble", "arc", "skipping", "spiral"]:
		for k: int in 2:
			var start: Dictionary = dice.call("pose", motion, k, 0.0)
			var end: Dictionary = dice.call("pose", motion, k, 1.0)
			assert_gt(float(start["spin"]), TAU * 2.0, motion)
			assert_eq([end["x"], end["lift"], end["spin"]], [0.0, 0.0, 0.0], motion)
	assert_eq(dice.call("sum_text", [3, 4]), "3 + 4 = 7")


func test_the_result_counts_the_winners_assets() -> void:
	var view := _view({"winner": 0})
	view["properties"][1]["owner"] = 0
	var table := _table(view)
	var detail: Dictionary = table.call("result_detail")
	assert_eq(detail["rows"][1], ["Tổng tài sản", "1.200 ₫"])


func test_dice_input_waits_for_your_turn_and_unblocked_table() -> void:
	var table := _table(_view({"turn": 1}))
	assert_false(bool(table.get("_can_roll")), "Another seat cannot roll your dice")
	table = _table(_view())
	for lock: String in ["_sent", "_running"]:
		table.set(lock, true)
		table.call("_show_actions")
		assert_false(bool(table.get("_can_roll")), lock + " prevents a second throw")
		table.set(lock, false)
		table.call("_show_actions")
		assert_true(bool(table.get("_can_roll")))
	table = _table(_view({"phase": "end"}))
	assert_false(bool(table.get("_can_roll")), "Dice cannot bypass the end of a turn")


func test_idle_dice_do_not_move_with_buttons_or_notice_length() -> void:
	var table := _table(_view())
	await get_tree().process_frame
	table.call("_layout")
	var rest: Vector2 = _node(table, "Die_0").position
	var view: Dictionary = table.get("_presented_view")
	for phase: String in ["buy", "end", "roll"]:
		view["phase"] = phase
		view["pending"] = 6
		view["notice"] = "Thông báo dài về việc mua đất và thu tiền thuê trên bàn chơi. ".repeat(4)
		table.call("_refresh")
		await get_tree().process_frame
		table.call("_layout")
		assert_eq(_node(table, "Die_0").position, rest, phase)


func test_hidden_player_slots_keep_avatar_data_for_banknote() -> void:
	var table := _table(_view())
	await get_tree().process_frame
	table.call("_layout")
	var mine: Control = _node(table, "Seat_0")
	var others: Control = _node(table, "Seat_1")
	assert_false(mine.visible)
	assert_false(others.visible)
	assert_true(bool(mine.get("local_player")))
	assert_not_null(others.get("picture"))
	var ink: Control = table.get("_field_ink")
	var thrower: Control = table.get("_throw")
	assert_eq(ink.get_parent(), thrower)
	assert_eq(ink.get_index(), 0, "Printed text is drawn underneath the 3D stage")


func test_dice_touch_includes_side_faces_and_padding() -> void:
	var table := _table(_view())
	var die: Control = _node(table, "Die_0")
	die.size = Vector2(80, 80)
	assert_true(bool(die.call("_has_point", Vector2(85, 90))))
	assert_true(bool(die.call("_has_point", Vector2(-20, 40))))
	assert_false(bool(die.call("_has_point", Vector2(150, 150))))


func test_primary_board_action_keeps_its_slot_across_phases() -> void:
	var table := _table(_view({"phase": "buy", "pending": 6}))
	await get_tree().process_frame
	table.call("_layout")
	var buy: Control = _node(table, "Buy")
	var at: Vector2 = buy.position
	var view: Dictionary = table.get("_presented_view")
	view["phase"] = "end"
	table.call("_refresh")
	await get_tree().process_frame
	table.call("_layout")
	assert_eq(_node(table, "EndTurn").position, at)
	var draw: GDScript = load("res://content/co-ty-phu-classic/surface_draw.gd")
	assert_eq(draw.call("clean", "Nhận 1.000 ₫."), "Nhận 1.000 ₫")


func test_ready_echo_does_not_repeat_a_reveal_but_a_new_event_does() -> void:
	var before: Dictionary = {"kind": "airport", "id": 3, "ready": false}
	var echo: Dictionary = before.duplicate()
	echo["ready"] = true
	assert_false(BoardSurface.event_changed(before, echo))
	assert_true(BoardSurface.event_changed(before, {"kind": "card", "id": 3}))


func test_event_snapshot_keeps_dice_visible_until_queued_roll_finishes() -> void:
	var table := _table(_view())
	var view: Dictionary = table.get("_presented_view")
	view["phase"] = "event"
	table.set("_running", true)
	table.call("_roll", [3, 4], 0)
	table.call("_refresh")
	for die: TextureRect in table.get("_dice"):
		assert_true(die.visible, "An event snapshot must not hide dice during the queued throw")
	await get_tree().create_timer(1.9).timeout
	table.set("_running", false)
	table.call("_refresh")
	for die: TextureRect in table.get("_dice"):
		assert_false(die.visible, "Event confirmation hides dice after the animation queue")
