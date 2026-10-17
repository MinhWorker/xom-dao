extends GutTest

const Model := preload("res://content/co-ty-phu-classic/banknote_model.gd")
const Exchange := preload("res://content/co-ty-phu-classic/turn_exchange.gd")


func _view() -> Dictionary:
	var properties: Array = []
	for i: int in 40:
		properties.append({"owner": null, "houses": 0, "mortgaged": false})
	return {
		"players": [{"jailed": false, "jailRolls": 0, "freeCards": []}],
		"properties": properties,
		"stationAuctions": {}
	}


func test_pov_is_fixed_for_every_seat_and_spectator() -> void:
	for seat: int in 4:
		var order: Array[int] = Model.seats(seat, 4)
		assert_eq(order[0], seat)
		assert_eq(order.size(), 4)
		var expected: Array[int] = []
		for other: int in 4:
			if other != seat:
				expected.append(other)
		assert_eq(order.slice(1), expected)
	assert_eq(Model.seats(-1, 4), [0, 1, 2, 3])
	assert_eq(Model.seats(2, 2), [0, 1])
	assert_eq(Model.seats(0, 0), [])
	for index: int in range(1, 4):
		assert_false(Model.LOCAL.intersects(Model.slot(index)))
		assert_lt(Model.slot(index).end.y, 0.365)


func test_numeric_zeroes_remain_but_inactive_states_are_absent() -> void:
	var totals: Dictionary = Model.summary(_view(), 0)
	for key: String in Model.NUMBERS:
		assert_eq(totals[key], 0)
	for key: String in Model.STATES:
		assert_false(totals.has(key), key)


func test_jail_countdown_and_ownership_states_disappear_when_no_longer_active() -> void:
	var view: Dictionary = _view()
	view["players"][0].assign({"jailed": true, "jailRolls": 1, "freeCards": ["chance", "chest"]})
	view["properties"][12]["owner"] = 0
	view["properties"][28]["owner"] = 0
	var totals: Dictionary = Model.summary(view, 0)
	assert_eq(totals["jail"], 2)
	assert_eq(totals["tickets"], 2)
	assert_eq(totals["power"], 1)
	assert_eq(totals["water"], 1)
	view["players"][0]["jailRolls"] = 2
	assert_eq(Model.summary(view, 0)["jail"], 1)
	view["players"][0]["jailed"] = false
	view["players"][0]["freeCards"] = []
	view["properties"][12]["owner"] = 1
	view["properties"][28]["owner"] = null
	totals = Model.summary(view, 0)
	for key: String in ["jail", "tickets", "power", "water"]:
		assert_false(totals.has(key), key)


func test_deed_and_building_totals_and_pending_station_contribution() -> void:
	var view: Dictionary = _view()
	for square: int in [1, 2, 5, 12]:
		view["properties"][square]["owner"] = 0
	view["properties"][1]["houses"] = 4
	view["properties"][2]["houses"] = 5
	view["stationAuctions"] = {"5": {"bids": [50]}, "15": {"bids": [0]}}
	view["auction"] = {"square": 5, "bids": [100]}
	var totals: Dictionary = Model.summary(view, 0)
	assert_eq(totals["land"], 2)
	assert_eq(totals["houses"], 4)
	assert_eq(totals["hotels"], 1)
	assert_eq(totals["stations"], 1)
	assert_eq(totals["contributing"], 1, "The current station overrides its saved deposit")
	view["auction"]["bids"] = [0]
	assert_false(Model.summary(view, 0).has("contributing"))


func test_every_transfer_counts_both_balances_together_without_creating_bank_cash() -> void:
	var cash: Array[int] = [1000, 750, 500, 300]
	for pair: Array in [[0, 1], [1, 2], [3, 0], [null, 2], [1, null]]:
		var transfer: Dictionary = {"from": pair[0], "to": pair[1], "amount": 240}
		for step: int in 11:
			var progress: float = step / 10.0
			var outgoing: int = 0
			var incoming: int = 0
			for seat: int in 4:
				var delta: int = Model.balance(cash, transfer, seat, progress) - cash[seat]
				if delta < 0:
					outgoing -= delta
				else:
					incoming += delta
				if seat != pair[0] and seat != pair[1]:
					assert_eq(delta, 0)
			if pair[0] != null and pair[1] != null:
				assert_eq(outgoing, incoming)
		assert_eq(Model.endpoint(transfer, "from"), -1 if pair[0] == null else int(pair[0]))
	assert_eq(cash, [1000, 750, 500, 300])


func test_exchange_commits_each_transfer_once_and_does_not_reorder_cards() -> void:
	var exchange: Control = add_child_autofree(Exchange.new())
	var labels: Array[String] = ["Minh", "Lan", "Nam", "An"]
	var cash: Array[int] = [1000, 750, 500, 300]
	var pictures: Array[Texture2D] = []
	var slots: Array[XomDaoPlayerSlot] = []
	exchange.call("refresh", 1, labels, cash, pictures, slots, 2, _view())
	assert_eq(exchange.get("order"), [2, 0, 1, 3])
	exchange.call(
		"play", [{"from": 0, "to": 3, "amount": 100}, {"from": null, "to": 2, "amount": 50}]
	)
	assert_true(bool(exchange.get("busy")))
	exchange.call("refresh", 3, labels, cash, pictures, slots, 2, _view())
	assert_eq(exchange.get("balances"), cash, "A snapshot cannot jump balances during a transfer")
	await get_tree().create_timer(1.9).timeout
	assert_false(bool(exchange.get("busy")))
	assert_eq(exchange.get("balances"), [900, 750, 550, 400])
	assert_eq(exchange.get("order"), [2, 0, 1, 3])


func test_countdown_follows_the_card_border_and_disappears_without_a_clock() -> void:
	var card: XomDaoPlayerSlot = add_child_autofree(
		preload("res://content/co-ty-phu-classic/player_card.gd").new()
	)
	card.start_turn(20.0, 5.0)
	assert_eq(card.avatar.turn, -1.0, "The avatar never draws a second countdown ring")
	assert_almost_eq(float(card.call("countdown_fraction")), 0.75, 0.001)
	card.show_turn()
	assert_eq(float(card.call("countdown_fraction")), -1.0)
	card.end_turn()
	assert_eq(float(card.call("countdown_fraction")), -1.0)
	for index: int in 4:
		var bounds: Rect2 = Model.slot(index)
		var full: PackedVector2Array = Model.countdown_path(bounds, 1.0)
		assert_eq(full[0], full[-1], "Full clock closes the entire card border")
		var half: PackedVector2Array = Model.countdown_path(bounds, 0.5)
		assert_almost_eq(
			half[-1], Vector2(bounds.get_center().x, bounds.end.y), Vector2.ONE * 0.0001
		)
		assert_eq(Model.countdown_path(bounds, 0.0)[-1], full[0])
