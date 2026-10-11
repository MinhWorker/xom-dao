extends GutTest
## The select screen's rail of posters (a drag slides, a tap picks) and genre row, and lossless
## measured rules pagination.


func _catalog(count: int) -> HubCatalog:
	var catalog := XomDaoCatalog.new()
	var ids: Array[String] = ["battleship", "tic-tac-toe", "co-ca-ngua"]
	for i: int in count:
		catalog.games.append(
			XomDaoGameCard.from_dict(
				{"id": ids[i], "name": ids[i], "status": "ready", "genre": "co"}
			)
		)
	return HubCatalog.create(catalog, ids)


func _strip(count: int) -> HubGameStrip:
	var strip: HubGameStrip = add_child_autofree(HubGameStrip.new())
	strip.size = Vector2(700, 480)
	var catalog: HubCatalog = _catalog(count)
	strip.show_games(catalog.catalog.games, catalog)
	return strip


func _middle(strip: HubGameStrip, index: int) -> Vector2:
	return strip.posters[index].position + strip.posters[index].size / 2.0


func test_a_tap_picks_the_poster_under_it() -> void:
	var strip: HubGameStrip = _strip(3)
	watch_signals(strip)
	var at: Vector2 = _middle(strip, 1)
	strip._begin(at)
	strip._drag(at + Vector2(6, 3))
	strip._release(at + Vector2(6, 3))
	assert_signal_emitted_with_parameters(strip, "picked", ["tic-tac-toe"])
	assert_eq(strip.scroll, 0.0, "a tap does not slide the row")


func test_a_drag_slides_the_row_and_picks_nothing() -> void:
	var strip: HubGameStrip = _strip(3)
	watch_signals(strip)
	assert_gt(strip.max_scroll(), 0.0, "three posters are wider than the strip")
	var first: float = strip.posters[0].position.x
	var at: Vector2 = _middle(strip, 1)
	strip._begin(at)
	strip._drag(at - Vector2(200, 0))
	strip._release(at - Vector2(200, 0))
	assert_signal_not_emitted(strip, "picked")
	assert_almost_eq(strip.posters[0].position.x, first - 200.0, 0.01)
	strip.scroll = 99999.0
	assert_almost_eq(strip.scroll, strip.max_scroll(), 0.01, "it stops at the last poster")
	strip.reveal("battleship")
	assert_eq(strip.scroll, 0.0, "the first poster is back in view")


func test_a_short_row_sits_in_the_middle_and_stays() -> void:
	var strip: HubGameStrip = _strip(1)
	assert_eq(strip.max_scroll(), 0.0)
	var poster: HubGamePoster = strip.posters[0]
	assert_almost_eq(poster.position.x + poster.size.x / 2.0, strip.size.x / 2.0, 0.01)
	assert_eq(poster.name, "Card_battleship")
	assert_not_null(HubGameArt.logo("battleship"), "every poster carries a logo")


func test_select_plays_a_tapped_game_and_keeps_genres_in_the_bottom_left() -> void:
	var select: HubGameSelect = add_child_autofree(HubGameSelect.new())
	select.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	select.size = Vector2(1280, 720)
	var catalog: HubCatalog = _catalog(2)
	var genre := XomDaoGenre.new()
	genre.id = "co"
	genre.name = "Cờ"
	genre.island = "co"
	catalog.catalog.genres.append(genre)
	select.show_genre(catalog, "co")
	watch_signals(select)
	(select.find_child("Card_tic-tac-toe", true, false) as Button).pressed.emit()
	assert_signal_emitted_with_parameters(select, "play_pressed", ["tic-tac-toe"])
	var tab: HubGenreTab = select.find_child("Tab_co", true, false)
	assert_true(tab.selected)
	assert_lt(tab.global_position.x, select.size.x / 3.0, "on the left")
	assert_gt(tab.global_position.y, select.strip.position.y + select.strip.size.y - 1.0, "below")
	assert_gt(HubGenreTab.OBJECT, HubGenreTab.PLATE_H, "the object stands out of its plate")


func test_long_rules_are_split_without_losing_text() -> void:
	var body: String = "Một câu luật với đầy đủ dấu tiếng Việt. ".repeat(60).strip_edges()
	var source: Array[Dictionary] = HubRulesBoard.sections("# Luật\n\n## Xếp tàu\n" + body)
	var pages: Array[Dictionary] = HubRulesBoard.paginate(source, 320, 220, 26)
	assert_gt(pages.size(), 1)
	var restored: PackedStringArray = []
	for page: Dictionary in pages:
		assert_eq(page["title"], "Xếp tàu")
		restored.append(page["body"])
		var measured: Vector2 = XomDaoUi.body_font().get_multiline_string_size(
			page["body"], HORIZONTAL_ALIGNMENT_LEFT, 320, 26
		)
		assert_lte(measured.y, 220.0)
	assert_eq(" ".join(restored), body)


func test_paged_rules_disable_endpoints_and_support_optional_illustrations() -> void:
	var picture := ImageTexture.create_from_image(Image.create(8, 8, false, Image.FORMAT_RGBA8))
	var rules: HubRulesBoard = add_child_autofree(
		HubRulesBoard.create("Luật", "## Đầu\nTrang đầu.\n## Cuối\nTrang cuối.", {"Cuối": picture})
	)
	rules.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	rules.size = Vector2(1280, 720)
	rules._layout()
	assert_true(rules._previous.disabled)
	assert_true(rules._placeholder.visible)
	rules._turn_page(1)
	assert_eq(rules._counter.text, "2 / 2")
	assert_true(rules._next.disabled)
	assert_true(rules._image.visible)
	assert_false(rules._placeholder.visible)
	rules._turn_page(1)
	assert_eq(rules._page, 1)


func test_repeated_button_feedback_preserves_user_hud_scale() -> void:
	var button: XomDaoButton = add_child_autofree(XomDaoButton.create("Luật"))
	button.scale = Vector2.ONE * 1.3
	XomDaoUi.bounce(button)
	await wait_seconds(0.04)
	XomDaoUi.bounce(button)
	await wait_seconds(0.35)
	assert_almost_eq(button.scale.x, 1.3, 0.001)


func test_pagination_keeps_paragraphs_and_bullet_line_breaks() -> void:
	var body: String = "Đặt quân.\n\n• Đi một ô.\n• Giữ lượt."
	var source: Array[Dictionary] = HubRulesBoard.sections("## Luật\n" + body)
	var pages: Array[Dictionary] = HubRulesBoard.paginate(source, 520, 420, 26)
	assert_eq(pages.size(), 1)
	assert_eq(pages[0]["body"], body)


func test_rules_reserve_space_for_wrapped_section_headings() -> void:
	var title: String = "Công trình và cách tính tiền thuê đất phố"
	var rules: HubRulesBoard = add_child_autofree(
		HubRulesBoard.create("Luật", "## " + title + "\nNội dung luật không chồng tiêu đề.")
	)
	rules.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	rules.size = Vector2(1036, 720)
	rules._layout()
	var measured: Vector2 = XomDaoUi.display_font().get_multiline_string_size(
		title, HORIZONTAL_ALIGNMENT_LEFT, rules._heading.size.x, 40
	)
	assert_gte(rules._heading.size.y, measured.y)
	assert_gte(rules._text.position.y, rules._heading.size.y)
