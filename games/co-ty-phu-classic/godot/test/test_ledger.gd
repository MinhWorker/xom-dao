extends GutTest

const Draft := preload("res://content/co-ty-phu-classic/trade_draft.gd")
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


func test_one_round_button_opens_the_full_scene_ledger_and_blocks_board_input() -> void:
	var view := _view()
	view["properties"][1]["owner"] = 0
	var table := _table(view)
	assert_null(_node(table, "Offer"))
	assert_null(_node(table, "Assets"))
	assert_null(_node(table, "Auction"))
	(_node(table, "LedgerOpen") as Button).pressed.emit()
	var ledger: Control = _node(table, "Ledger")
	assert_true(ledger.visible)
	assert_false(bool(table.get("_can_roll")))
	assert_eq(ledger.size, table.size)
	assert_not_null(_node(table, "Estate_1"))
	(_node(table, "CloseLedger") as Button).pressed.emit()
	assert_false(ledger.visible)
	assert_true(bool(table.get("_can_roll")))


func test_assets_browse_other_seats_and_keep_management_on_the_owners_turn() -> void:
	var view := _view({"turn": 1})
	view["properties"][1]["owner"] = 0
	view["properties"][6]["owner"] = 1
	var table := _table(view)
	(_node(table, "LedgerOpen") as Button).pressed.emit()
	assert_not_null(_node(table, "Estate_1"))
	(_node(table, "Estate_1") as Button).pressed.emit()
	assert_null(_node(table, "EstateMortgage"))
	(_node(table, "LedgerPlayer_1") as Button).pressed.emit()
	assert_not_null(_node(table, "Estate_6"))
	assert_null(_node(table, "Estate_1"))


func test_mortgage_selects_multiple_actual_cards_and_emits_one_batch() -> void:
	var view := _view()
	for square: int in [1, 3, 5]:
		view["properties"][square]["owner"] = 0
	var table := _table(view)
	(_node(table, "LedgerOpen") as Button).pressed.emit()
	(_node(table, "Estate_1") as Button).pressed.emit()
	(_node(table, "EstateMortgage") as Button).pressed.emit()
	(_node(table, "Estate_3") as Button).pressed.emit()
	var ledger: Control = _node(table, "Ledger")
	assert_eq(ledger.get("_estate").get("picked"), [1, 3] as Array[int])
	assert_eq(_text(table, "EstateCommit"), "+190")
	watch_signals(ledger)
	(_node(table, "EstateCommit") as Button).pressed.emit()
	assert_signal_emitted_with_parameters(ledger, "acted", ["mortgage", {"squares": [1, 3]}])


func test_trade_selects_cards_resets_and_clears_after_a_declined_offer() -> void:
	var view := _view()
	view["properties"][1]["owner"] = 0
	view["properties"][6]["owner"] = 1
	var table := _table(view)
	(_node(table, "LedgerOpen") as Button).pressed.emit()
	(_node(table, "LedgerTrade") as Button).pressed.emit()
	(_node(table, "TradeGive_1") as Button).pressed.emit()
	(_node(table, "TradeTake_6") as Button).pressed.emit()
	var ledger: Control = _node(table, "Ledger")
	var draft: RefCounted = ledger.get("_exchange").get("draft")
	assert_eq(draft.get("give"), 1)
	assert_eq(draft.get("take"), 6)
	assert_false((_node(table, "SendTrade") as Button).disabled)
	(_node(table, "ResetTrade") as Button).pressed.emit()
	assert_eq(draft.get("give"), -1)
	assert_eq(draft.get("take"), -1)
	assert_true((_node(table, "SendTrade") as Button).disabled)
	var pending: Dictionary = view.duplicate(true)
	pending["phase"] = "trade"
	pending["trade"] = {
		"from": 1, "to": 0, "give": 6, "take": 1, "giveCash": 0, "takeCash": 0, "resume": "roll"
	}
	table.call("_show", _snapshot(pending))
	assert_not_null(_node(table, "Accept"))
	assert_true(bool(draft.get("pending")))
	table.call("_show", _snapshot(view))
	assert_false(bool(draft.get("pending")))
	assert_eq(draft.get("give"), -1)
	assert_eq(draft.get("take"), -1)
	assert_eq(draft.get("give_cash"), 0)


func test_money_pad_edits_an_exact_amount_and_caps_it_at_the_actual_cash() -> void:
	var pad: Control = add_child_autofree(
		preload("res://content/co-ty-phu-classic/money_pad.gd").new()
	)
	pad.set("amount", 130)
	pad.set("maximum", 1000)
	pad.call("_key", "1")
	pad.call("_key", "8")
	pad.call("_key", "0")
	assert_eq(pad.get("amount"), 180)
	pad.call("_key", "0")
	assert_eq(pad.get("amount"), 1000)
	pad.call("_key", "⌫")
	assert_eq(pad.get("amount"), 100)


func test_ticket_sale_and_every_finished_offer_clear_the_single_draft() -> void:
	var draft: RefCounted = Draft.new()
	draft.call("choose", 0, 1)
	draft.call("choose", 1, -2)
	assert_eq(draft.get("give"), -1)
	assert_eq(draft.get("take"), -2)
	assert_eq(draft.get("give_cash"), 200)
	draft.call(
		"observe", {"from": 0, "to": 1, "give": null, "take": null, "giveCash": 180, "takeCash": 0}
	)
	draft.call("choose", 0, 3)
	assert_eq(draft.get("give"), -1, "A pending offer cannot be edited")
	draft.call("observe", null)
	assert_eq(draft.get("give_cash"), 0)
	assert_eq(draft.get("take"), -1)


func test_drag_targets_accept_only_the_corresponding_players_inventory() -> void:
	var tray: Control = add_child_autofree(
		preload("res://content/co-ty-phu-classic/offer_tray.gd").new()
	)
	tray.set("seat", 1)
	tray.set("side", 1)
	assert_true(
		bool(tray.call("_can_drop_data", Vector2.ZERO, {"estate": 6, "seat": 1, "side": 1}))
	)
	assert_false(
		bool(tray.call("_can_drop_data", Vector2.ZERO, {"estate": 6, "seat": 0, "side": 0}))
	)
	tray.set("locked", true)
	assert_false(
		bool(tray.call("_can_drop_data", Vector2.ZERO, {"estate": 6, "seat": 1, "side": 1}))
	)


func test_detail_actions_fit_inside_the_book_with_three_available_actions() -> void:
	var view := _view({"phase": "end", "buildable": 1})
	view["players"][0]["position"] = 1
	view["properties"][1] = {"owner": 0, "houses": 2, "mortgaged": false}
	var table := _table(view)
	table.set_anchors_preset(Control.PRESET_TOP_LEFT)
	table.size = Vector2(1280, 720)
	(_node(table, "LedgerOpen") as Button).pressed.emit()
	(_node(table, "Estate_1") as Button).pressed.emit()
	await wait_process_frames(3)
	var ledger: Control = _node(table, "Ledger")
	var book: Control = ledger.get("_book")
	var build: Control = _node(table, "EstateBuild")
	assert_true(
		book.get_global_rect().encloses(build.get_global_rect()),
		"Last action stays inside the book on a 16:9 frame"
	)
	assert_true(_node(table, "EstateSellHouse").visible)
	assert_true(_node(table, "EstateMortgage").visible)


func test_trade_prices_autofill_for_sales_purchases_swaps_and_selection_changes() -> void:
	var draft: RefCounted = Draft.new()
	draft.call("choose", 0, 1)
	assert_eq(draft.get("give_cash"), 0)
	assert_eq(draft.get("take_cash"), 200)
	draft.call("choose", 1, 6)
	assert_eq(draft.get("give_cash"), 80)
	assert_eq(draft.get("take_cash"), 0)
	draft.set("give_cash", 30)
	assert_eq(draft.get("give_cash"), 30, "The suggested price remains editable")
	draft.call("choose", 0, 1)
	assert_eq(draft.get("give_cash"), 280, "Removing the offered deed recomputes a purchase")
	draft.call("reset")
	assert_eq(draft.get("give_cash"), 0)
	assert_eq(draft.get("take_cash"), 0)
