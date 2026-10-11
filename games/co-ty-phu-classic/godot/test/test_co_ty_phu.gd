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


func test_your_turn_offers_the_dice_and_jail_ways_out() -> void:
	var table := _table(_view())
	assert_true(_node(table, "Roll").visible)
	assert_false(_node(table, "Bail").visible)
	assert_eq(_text(table, "Status"), "Lượt bạn")
	assert_eq(_text(table, "TurnName"), "Bạn")
	assert_eq((_node(table, "Seat_1") as XomDaoPlayerSlot).extra, "1.000 ₫")
	var view := _view()
	view["players"][0]["jailed"] = true
	view["players"][0]["position"] = 10
	table = _table(view)
	assert_true(_node(table, "Bail").visible)
	assert_false(_node(table, "UseCard").visible)


func test_buying_and_the_square_card() -> void:
	var view := _view({"phase": "buy", "pending": 6, "dice": [2, 4]})
	view["players"][0]["position"] = 6
	view["properties"][1]["owner"] = 0
	view["properties"][1]["houses"] = 2
	var table := _table(view)
	assert_eq(_text(table, "Buy"), "Mua 280")
	assert_true(_node(table, "Skip").visible)
	_tap(_node(table, "Square_1"))
	assert_true(_node(table, "Card").visible)
	assert_eq(_text(table, "CardTitle"), "Phú Quốc")
	assert_string_contains(_text(table, "CardText"), "Chủ: Bạn · 2 nhà")
	assert_string_contains(_text(table, "CardText"), "Thuê bây giờ 220 ₫")
	assert_eq(_text(table, "Mortgage"), "Thế chấp +200")
	assert_eq(_text(table, "SellHouse"), "Bán nhà +50")
	_tap(_node(table, "Square_1"))
	assert_false(_node(table, "Card").visible)


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
	assert_true(_node(table, "Card").visible)
	assert_eq(_text(table, "CardTitle"), "Cơ hội")
	assert_eq(_text(table, "CardText"), "Nhận cổ tức 100.")
	assert_true(_node(table, "Confirm").visible)
	assert_false(_node(table, "Roll").visible)


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
	var auction: Dictionary = {
		"square": 5, "highest": 50, "leader": 1, "passed": [], "bids": [0, 50, 0], "bidder": 0
	}
	var view := _view({"phase": "auction", "auction": auction, "pending": 5})
	view["players"][0]["position"] = 5
	var table := _table(view)
	assert_eq(_text(table, "Bid"), "Góp 50")
	assert_false((_node(table, "Bid") as Button).disabled)
	assert_eq(_text(table, "Pass"), "Từ bỏ")
	assert_eq(_text(table, "Status"), "Bến Bắc: 50 ₫")


func test_an_offer_steps_through_your_deeds_and_cash() -> void:
	var view := _view()
	view["properties"][1]["owner"] = 0
	view["properties"][6]["owner"] = 1
	var table := _table(view)
	assert_true(_node(table, "Offer").visible)
	(_node(table, "Offer") as Button).pressed.emit()
	var trade: Control = _node(table, "Trade")
	assert_true(trade.visible)
	assert_false(_node(table, "Roll").visible)
	assert_eq(
		(_node(table, "TradeWith") as XomDaoChoice).options, ["Máy 1", "Máy 2"] as Array[String]
	)
	assert_true((_node(table, "SendTrade") as Button).disabled)
	(_node(table, "GiveDeed") as Button).pressed.emit()
	(_node(table, "TakeDeed") as Button).pressed.emit()
	(_node(table, "TakeCash") as Button).pressed.emit()
	assert_eq(_text(table, "GiveDeed"), "Phú Quốc")
	assert_eq(_text(table, "TakeDeed"), "Hạ Long")
	assert_eq(_text(table, "TakeCash"), "50 ₫")
	watch_signals(trade)
	(_node(table, "SendTrade") as Button).pressed.emit()
	assert_signal_emitted_with_parameters(
		trade, "offered", [{"to": 1, "give": 1, "take": 6, "giveCash": 0, "takeCash": 50}]
	)


func test_names_fit_on_their_squares() -> void:
	var marks: GDScript = load("res://content/co-ty-phu-classic/marks.gd")
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
	var rules: GDScript = load("res://content/co-ty-phu-classic/rules.gd")
	var view := _view()
	view["properties"][1]["owner"] = 0
	view["properties"][1]["houses"] = 2
	view["properties"][5]["owner"] = 0
	view["properties"][9]["owner"] = 0
	view["properties"][9]["mortgaged"] = true
	view["players"][0]["freeCards"] = ["chance"]
	assert_eq(rules.call("mortgage_squares", view["properties"], 0), [1, 5] as Array[int])
	# 1000 cash + 200 ticket + (200 + 2 × 100) + 200 + 350 − ceil(175 × 1.1)
	assert_eq(rules.call("asset_value", view, 0), 1000 + 200 + 400 + 200 + 350 - 193)


func test_the_mortgage_board_takes_several_deeds() -> void:
	var view := _view()
	for i: int in [1, 3, 5, 9]:
		view["properties"][i]["owner"] = 0
	view["properties"][9]["mortgaged"] = true
	var table := _table(view)
	assert_true(_node(table, "Assets").visible)
	(_node(table, "Assets") as Button).pressed.emit()
	var board: Control = _node(table, "MortgageBoard")
	assert_true(board.visible)
	assert_false(_node(table, "Roll").visible)
	assert_not_null(_node(table, "MortgageRow_5"))
	assert_null(_node(table, "MortgageRow_9"))
	assert_false(_node(table, "MortgageNext").visible)
	assert_true((_node(table, "MortgageConfirm") as Button).disabled)
	(_node(table, "MortgageRow_1") as Button).pressed.emit()
	(_node(table, "MortgageRow_5") as Button).pressed.emit()
	assert_eq(_text(table, "MortgageTotal"), "2 tài sản · Nhận 200 ₫")
	assert_eq(_text(table, "MortgageConfirm"), "Xác nhận +200 ₫")
	(_node(table, "MortgageRow_5") as Button).pressed.emit()
	(_node(table, "MortgageRow_3") as Button).pressed.emit()
	watch_signals(board)
	(_node(table, "MortgageConfirm") as Button).pressed.emit()
	assert_signal_emitted_with_parameters(board, "chosen", [[1, 3] as Array[int]])
	assert_false(board.visible)


func test_a_deeds_mortgage_opens_the_board_with_it_picked() -> void:
	var view := _view({"phase": "end"})
	for i: int in [1, 3, 6, 8, 9, 11, 13]:
		view["properties"][i]["owner"] = 0
	var table := _table(view)
	_tap(_node(table, "Square_13"))
	(_node(table, "Mortgage") as Button).pressed.emit()
	var board: Control = _node(table, "MortgageBoard")
	assert_true(board.visible)
	assert_eq(board.call("picked"), [13] as Array[int])
	assert_eq(_text(table, "MortgagePage"), "2 / 2")
	assert_true(_node(table, "MortgagePrevious").visible)
	(_node(table, "MortgagePrevious") as Button).pressed.emit()
	assert_not_null(_node(table, "MortgageRow_1"))
	assert_null(_node(table, "MortgageRow_13"))
	# Not your turn: no Tài sản.
	var others := _view({"turn": 1})
	others["properties"][1]["owner"] = 0
	table = _table(others)
	assert_false(_node(table, "Assets").visible)


func test_the_dice_paths_end_still() -> void:
	var dice: GDScript = load("res://content/co-ty-phu-classic/dice.gd")
	for motion: String in ["tumble", "arc", "skipping", "spiral"]:
		for k: int in 2:
			var start: Dictionary = dice.call("pose", motion, k, 0.0)
			var end: Dictionary = dice.call("pose", motion, k, 1.0)
			assert_gt(float(start["spin"]), TAU * 2.0, motion)
			assert_eq([end["x"], end["lift"], end["spin"]], [0.0, 0.0, 0.0], motion)
	assert_eq(dice.call("sum_text", [3, 4]), "3 + 4 = 7")
	var victory: GDScript = load("res://content/co-ty-phu-classic/victory.gd")
	assert_eq(victory.call("assets_text", 2450), "Tổng tài sản\n2.450 ₫")


func test_the_result_counts_the_winners_assets() -> void:
	var view := _view({"winner": 0})
	view["properties"][1]["owner"] = 0
	var table := _table(view)
	var detail: Dictionary = table.call("result_detail")
	assert_eq(detail["rows"][1], ["Tổng tài sản", "1.200 ₫"])
