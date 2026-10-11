extends GutTest
## Real gesture ownership, selection boundaries, and lossless measured rules pagination.


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


func _carousel(count: int) -> HubGameCarousel:
	var carousel: HubGameCarousel = add_child_autofree(HubGameCarousel.new())
	carousel.size = Vector2(1000, 460)
	var catalog: HubCatalog = _catalog(count)
	carousel.show_games(catalog.catalog.games, catalog, "battleship")
	return carousel


func test_a_short_drag_is_a_tap_and_does_not_select_the_next_game() -> void:
	var carousel: HubGameCarousel = _carousel(3)
	carousel._begin(Vector2(500, 180))
	carousel._drag(Vector2(490, 183))
	carousel._release(Vector2(490, 183))
	assert_eq(carousel.selected, 0)


func test_a_swipe_snaps_once_and_cannot_become_a_tap_on_a_neighbour() -> void:
	var carousel: HubGameCarousel = _carousel(3)
	watch_signals(carousel)
	carousel._begin(Vector2(500, 180))
	carousel._drag(Vector2(330, 180))
	carousel._release(Vector2(330, 180))
	assert_eq(carousel.selected, 1)
	assert_signal_emit_count(carousel, "selected_changed", 1)
	await wait_seconds(0.35)
	assert_almost_eq(carousel.turn, 1.0, 0.01)
	assert_true(carousel.islands[1].is_processing())
	assert_false(carousel.islands[0].is_processing())
	assert_false(carousel.islands[2].is_processing())
	carousel.set_obscured(true)
	assert_false(carousel.islands[1].is_processing())


func test_vertical_scroll_does_not_change_game_and_single_game_never_duplicates() -> void:
	var carousel: HubGameCarousel = _carousel(1)
	carousel._begin(Vector2(500, 180))
	carousel._drag(Vector2(500, 300))
	assert_eq(carousel.selected, 0)
	assert_eq(carousel.islands.size(), 1)
	assert_false(carousel.find_child("NextGame", true, false).visible)
	var pair: HubGameCarousel = _carousel(2)
	assert_eq(
		pair.islands.filter(func(island: HubGameIsland) -> bool: return island.visible).size(), 2
	)


func test_native_touch_ignores_other_fingers_and_cancel_preserves_selection() -> void:
	var carousel: HubGameCarousel = _carousel(3)
	var press := InputEventScreenTouch.new()
	press.index = 2
	press.position = Vector2(500, 180)
	press.pressed = true
	carousel._gui_input(press)
	var other := InputEventScreenTouch.new()
	other.index = 3
	other.position = Vector2(100, 180)
	other.pressed = false
	carousel._input(other)
	assert_eq(carousel._touch_index, 2)
	var cancel := InputEventScreenTouch.new()
	cancel.index = 2
	cancel.canceled = true
	cancel.pressed = false
	carousel._input(cancel)
	assert_eq(carousel.selected, 0)
	assert_eq(carousel._touch_index, -1)
	assert_eq(carousel._press, Vector2.INF)


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


func test_cancel_during_a_snap_keeps_committed_focus_and_releases_pointer() -> void:
	var carousel: HubGameCarousel = _carousel(3)
	carousel.select_game("tic-tac-toe")
	carousel.turn = 0.25
	var press := InputEventScreenTouch.new()
	press.index = 2
	press.position = Vector2(500, 180)
	press.pressed = true
	carousel._gui_input(press)
	carousel._drag(Vector2(490, 300))
	assert_eq(carousel.selected, 1)
	assert_eq(carousel._touch_index, -1)
	assert_eq(carousel.turn, 1.0)


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


func test_tablet_detail_measures_long_names_and_description_before_seats() -> void:
	var select: HubGameSelect = add_child_autofree(HubGameSelect.new())
	select.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	select.size = Vector2(1036, 720)
	var catalog: HubCatalog = _catalog(1)
	catalog.card("battleship").name = "Cờ Tỷ Phú Cổ Điển"
	catalog.card("battleship").tagline = "Đoán chỗ và bắn chìm hạm đội đối phương."
	select.show_genre(catalog, "co", "battleship")
	select._layout()
	assert_gte(select._tagline.position.y, select._title.position.y + select._title.size.y)
	assert_gte(select._players.position.y, select._tagline.position.y + select._tagline.size.y)


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
