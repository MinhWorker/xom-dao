extends GutTest

const BoardSurface := preload("res://content/co-ty-phu-classic/board_surface.gd")
const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const TileActionDraw := preload("res://content/co-ty-phu-classic/tile_action_draw.gd")
const TileHud := preload("res://content/co-ty-phu-classic/tile_hud.gd")
const TileInk := preload("res://content/co-ty-phu-classic/tile_ink.gd")
const TileQuotes := preload("res://content/co-ty-phu-classic/tile_quotes.gd")
const SpecialDescription := preload("res://content/co-ty-phu-classic/special_description.gd")


func _view() -> Dictionary:
	var players: Array = []
	for _seat: int in 3:
		players.append({"cash": 1000, "jailed": false, "freeCards": [], "bankrupt": false})
	var properties: Array = []
	for _square: int in 40:
		properties.append({"owner": null, "houses": 0, "mortgaged": false})
	return {"players": players, "properties": properties, "dice": null, "round": 0, "shortages": []}


func _linear_channel(value: float) -> float:
	return value / 12.92 if value <= 0.04045 else pow((value + 0.055) / 1.055, 2.4)


func _contrast_ratio(a: Color, b: Color) -> float:
	var luminance_a: float = (
		0.2126 * _linear_channel(a.r)
		+ 0.7152 * _linear_channel(a.g)
		+ 0.0722 * _linear_channel(a.b)
	)
	var luminance_b: float = (
		0.2126 * _linear_channel(b.r)
		+ 0.7152 * _linear_channel(b.g)
		+ 0.0722 * _linear_channel(b.b)
	)
	var light: float = maxf(luminance_a, luminance_b)
	var dark: float = minf(luminance_a, luminance_b)
	return (light + 0.05) / (dark + 0.05)


func test_tile_hud_button_asset_is_crisp_and_keeps_cream_ink_contrast() -> void:
	var action_asset := load("res://content/co-ty-phu-classic/art/tile-hud-action.svg") as Texture2D
	var toggle_asset := load("res://content/co-ty-phu-classic/art/tile-hud-toggle.svg") as Texture2D
	var wide_toggle_asset := (
		load("res://content/co-ty-phu-classic/art/tile-hud-toggle-wide.svg") as Texture2D
	)
	var house_icon := load("res://content/co-ty-phu-classic/art/tile-hud-house.svg") as Texture2D
	assert_gte(action_asset.get_size().x, 1280.0, "Action button imports at high resolution")
	assert_gte(toggle_asset.get_size().x, 704.0, "Toggle button imports at high resolution")
	assert_gte(wide_toggle_asset.get_size().x, 1280.0, "Wide toggle imports at high resolution")
	assert_gte(house_icon.get_size().x, 256.0, "House action icon imports at high resolution")
	assert_almost_eq(
		float(action_asset.get_size().x) / float(action_asset.get_size().y), 2.81, 0.02
	)
	assert_almost_eq(
		float(toggle_asset.get_size().x) / float(toggle_asset.get_size().y), 0.70, 0.02
	)
	assert_almost_eq(
		float(wide_toggle_asset.get_size().x) / float(wide_toggle_asset.get_size().y), 3.22, 0.02
	)
	var tints: Array[Color] = [
		Color.WHITE,
		Color(1.08, 1.08, 1.08, 1.0),
		Color(0.78, 0.82, 0.81, 1.0),
		Color(0.65, 0.70, 0.72, 1.0),
	]
	for tint: Color in tints:
		var face: Color = TileActionDraw.BUTTON_FACE * tint
		assert_gte(
			_contrast_ratio(face, XomDaoUi.CREAM),
			4.5,
			"Cream text and icons keep readable contrast in every button state"
		)


func test_tile_quotes_keep_only_found_references_and_wrap_in_the_hud() -> void:
	assert_eq(TileQuotes.LINES.size(), Rules.SQUARES.size())
	var found: Dictionary = {
		2: "Mời đoàn mình di chuyển lên núi giúp em",
		4: "Nothing is certain except death and taxes",
		7: "May the odds be ever in your favor",
		8: "Hải Phòng là không lòng vòng",
		9: "Hà Nội không vội được đâu",
		10: "Đưa hộ lọ muối",
		12: "With great power comes great electricity bill",
		22: "May the odds be ever in your favor",
		29: "Tại sao đi Đà Lạt lại vui? Tại vì ở đó có nhiều ‘dốc’",
		30: "Do not pass Go. Do not collect $200",
	}
	for square: int in Rules.SQUARES.size():
		var quote: String = TileQuotes.for_square(square)
		assert_eq(
			quote, str(found.get(square, "")), "square %d matches the selected reference" % square
		)
		assert_false(quote.contains("\n"), "square %d stores an unwrapped source line" % square)
	var quote_font := FontVariation.new()
	quote_font.base_font = XomDaoUi.body_font(true)
	quote_font.variation_transform = Transform2D(
		Vector2(1.0, 0.0), Vector2(-0.14, 1.0), Vector2.ZERO
	)
	var quote_lines: Array[Dictionary] = SpecialDescription.layout_for_quote(
		"“%s”" % TileQuotes.for_square(12), quote_font, TileHud.PANEL_INNER
	)
	assert_gt(quote_lines.size(), 1, "Long references wrap into multiple readable lines")
	for line: Dictionary in quote_lines:
		assert_gte(float(line["height"]), 0.020, "Wrapped quote text retains a readable font size")
		assert_eq(int(line["alignment"]), HORIZONTAL_ALIGNMENT_CENTER)


func test_station_hud_uses_its_fixed_purchase_price() -> void:
	var view := _view()
	var names: Array[String] = ["Bạn", "Máy 1", "Máy 2"]
	var summary: Dictionary = TileHud.summary(view, 5, names, 0)
	assert_eq(summary["price"], 200)
	view["properties"][5]["owner"] = 0
	summary = TileHud.summary(view, 5, names, 0)
	assert_eq(summary["price"], 200)
	assert_eq(summary["rent_text"], "50 ₫")
	view["properties"][15]["owner"] = 0
	assert_eq(TileHud.summary(view, 5, names, 0)["rent_text"], "50 × 2 ₫")
	var ink: Control = add_child_autofree(TileInk.new())
	ink.set("view", view)
	assert_eq(ink.call("deed_amount_text", 5), "50×2")


func test_tax_hud_explains_the_current_tax_formula() -> void:
	var view := _view()
	var names: Array[String] = ["Bạn", "Máy 1", "Máy 2"]
	view["players"][0]["cash"] = 1500
	var income: Dictionary = TileHud.summary(view, 4, names, 0)
	assert_eq(income["info_value"], "150 ₫")
	assert_eq(
		income["description"], "Nộp 10% tiền mặt hiện có, tối thiểu 100 ₫. Số tiền làm tròn xuống."
	)
	var luxury: Dictionary = TileHud.summary(view, 38, names, 0)
	assert_eq(luxury["info_value"], "200 ₫")
	assert_eq(
		luxury["description"], "Nộp 10% tiền mặt hiện có, tối thiểu 200 ₫. Số tiền làm tròn xuống."
	)
	var lines: Array[Dictionary] = SpecialDescription.layout_for_hud(
		luxury["description"], XomDaoUi.body_font(true), TileHud.PANEL_INNER
	)
	assert_false(lines.is_empty())
	assert_eq(
		int(lines[0]["alignment"]),
		HORIZONTAL_ALIGNMENT_LEFT,
		"Tax copy reads like a card description, aligned to its left edge"
	)
	var first_line_bounds: Rect2 = lines[0]["bounds"]
	assert_gte(first_line_bounds.position.y, 0.505, "Description starts below the divider")
	var last_line_bounds: Rect2 = lines[-1]["bounds"]
	assert_lte(last_line_bounds.end.y, 0.760, "Description stays within the card body")


func test_owned_utility_tile_shows_its_dice_multiplier() -> void:
	var view := _view()
	view["properties"][12]["owner"] = 0
	var ink: Control = add_child_autofree(TileInk.new())
	ink.set("view", view)
	assert_eq(ink.call("deed_amount_text", 12), "×4")
	view["properties"][28]["owner"] = 0
	assert_eq(ink.call("deed_amount_text", 12), "×10")
	view["players"][0]["jailed"] = true
	assert_eq(ink.call("deed_amount_text", 12), "×0")
	assert_eq(ink.call("deed_amount_text", 28), "×0")
	for square: int in [12, 28]:
		var layout: Dictionary = TileInk.rows(square)
		var indicator: Dictionary = TileInk.utility_indicator_layout(layout)
		if square == 12:
			assert_lt(
				float(indicator["text_right"]),
				0.80,
				"The multiplier stays clear of the side tile's owner badge"
			)
			assert_gt(
				float(indicator["icon_left"]),
				float(layout["symbol"].x) + 0.07,
				"The dice pair stays clear of the power mark"
			)
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
		assert_lt(
			float(indicator["gap"]),
			(float(indicator["right"]) - float(indicator["left"])) * float(layout["span"].x) * 0.02,
			"The dice pair sits close to its multiplier"
		)
		assert_gt(
			float(indicator["icon_width"]),
			(float(indicator["right"]) - float(indicator["left"])) * float(layout["span"].x) * 0.20,
			"The two-dice mark has enough width to read"
		)
	var dice_pair := load("res://content/co-ty-phu-classic/art/tile-dice-pair.svg") as Texture2D
	assert_gt(dice_pair.get_size().x, dice_pair.get_size().y)


func test_station_amount_layout_separates_the_price_from_its_symbol() -> void:
	var north: Dictionary = TileInk.rows(25)
	var south: Dictionary = TileInk.rows(5)
	var east: Dictionary = TileInk.rows(35)
	var west: Dictionary = TileInk.rows(15)
	assert_gt(float(north["number"].y), 0.68)
	assert_gt(float(south["number"].y), 0.62)
	assert_gt(float(east["number_size"]), minf(24.0, float(east["span"].y) * 0.20))
	assert_gt(float(west["number_size"]), minf(24.0, float(west["span"].y) * 0.20))


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
