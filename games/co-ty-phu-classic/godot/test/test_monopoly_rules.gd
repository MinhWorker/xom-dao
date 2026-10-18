extends GutTest

const BoardSurface := preload("res://content/co-ty-phu-classic/board_surface.gd")
const TileHud := preload("res://content/co-ty-phu-classic/tile_hud.gd")
const TileInk := preload("res://content/co-ty-phu-classic/tile_ink.gd")


func _view() -> Dictionary:
	var players: Array = []
	for _seat: int in 3:
		players.append({"cash": 1000, "jailed": false, "freeCards": [], "bankrupt": false})
	var properties: Array = []
	for _square: int in 40:
		properties.append({"owner": null, "houses": 0, "mortgaged": false})
	return {"players": players, "properties": properties, "dice": null, "round": 0, "shortages": []}


func test_station_hud_uses_its_auction_contribution_as_purchase_value() -> void:
	var view := _view()
	var names: Array[String] = ["Bạn", "Máy 1", "Máy 2"]
	assert_eq(TileHud.summary(view, 5, names, 0)["price"], 50)
	view["properties"][5]["owner"] = 0
	view["properties"][5]["acquisitionCost"] = 150
	assert_eq(TileHud.summary(view, 5, names, 0)["price"], 150)


func test_owned_utility_tile_shows_its_dice_multiplier() -> void:
	var view := _view()
	view["properties"][12]["owner"] = 0
	var ink: Control = add_child_autofree(TileInk.new())
	ink.set("view", view)
	assert_eq(ink.call("deed_amount_text", 12), "×4")
	view["properties"][28]["owner"] = 0
	assert_eq(ink.call("deed_amount_text", 12), "×10")
	for square: int in [12, 28]:
		var layout: Dictionary = TileInk.rows(square)
		var indicator: Dictionary = TileInk.utility_indicator_layout(layout)
		assert_lt(
			float(indicator["icon_right"]),
			float(indicator["text_left"]),
			"Utility die and multiplier have separate reserved regions"
		)
		assert_true(float(indicator["icon_left"]) >= float(indicator["left"]))
		assert_true(float(indicator["text_right"]) <= float(indicator["right"]))
		assert_true(
			float(indicator["icon_center"]) > 0.0 and float(indicator["icon_center"]) < 1.0,
			"Utility die icon center is in normalized UV"
		)
		assert_true(
			float(indicator["text_center"]) > 0.0 and float(indicator["text_center"]) < 1.0,
			"Utility text multiplier center is in normalized UV"
		)


func test_station_hud_lists_contributions_and_the_active_bidder() -> void:
	var view := _view()
	view.merge(
		{
			"stationAuctions":
			{
				"5":
				{
					"square": 5,
					"highest": 250,
					"leader": 0,
					"passed": [],
					"bids": [250, 100, 0],
					"contributions": [2, 1, 0]
				}
			},
			"auction":
			{
				"square": 5,
				"bidder": 1,
				"highest": 250,
				"leader": 0,
				"passed": [],
				"bids": [250, 100, 0],
				"contributions": [2, 1, 0]
			}
		},
		true
	)
	var result: Dictionary = TileHud.summary(view, 5, ["Minh", "Máy 1", "Máy 2"], 0)
	assert_eq(result["station_turn"], "Máy 1")
	var rows: Array = result["station_rows"]
	assert_eq(rows.size(), 2)
	assert_eq(rows[0]["name"], "Minh")
	assert_eq(rows[0]["amount"], 250)
	assert_eq(rows[0]["count"], 2)
	assert_true(bool(rows[0]["leading"]))
	assert_eq(rows[1]["amount"], 100)
	assert_eq(rows[1]["count"], 1)


func test_board_event_details_do_not_repeat_their_heading() -> void:
	assert_eq(
		BoardSurface.description(
			{"kind": "tax", "reason": "Thuế thu nhập", "amount": 100},
			"Thuế thu nhập: cần nộp 100 ₫."
		),
		"Cần nộp 100 ₫."
	)
	assert_eq(
		BoardSurface.description({"kind": "jail", "reason": "Bị đưa vào tù!"}, "Bị đưa vào tù!"), ""
	)
	assert_eq(
		BoardSurface.description(
			{"kind": "card", "card": {"kind": "cash", "text": "Phí khám bệnh 50.", "amount": -50}},
			"Phí khám bệnh 50: −50"
		),
		"Nộp 50 ₫"
	)
