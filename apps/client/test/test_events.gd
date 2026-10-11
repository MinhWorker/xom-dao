extends GutTest
## Events in the hub against a made-up catalog (no server): the lobby's banner and island, and
## the event's board in the game select.


func _catalog(with_event: bool) -> HubCatalog:
	var catalog := XomDaoCatalog.new()
	for genre: Array in [["co", "Cờ", 1, true], ["su-kien", "Sự kiện", 3, false]]:
		catalog.genres.append(
			XomDaoGenre.from_dict(
				{"id": genre[0], "name": genre[1], "order": genre[2], "island": genre[0]}.merged(
					{"main": genre[3]}
				)
			)
		)
	var cards: Array = [
		{
			"id": "tic-tac-toe",
			"name": "Caro",
			"kind": "table",
			"genre": "co",
			"status": "ready",
			"minPlayers": 2,
			"maxPlayers": 2,
			"duration": {"min": 5, "max": 15},
		}
	]
	if with_event:
		(
			cards
			. append(
				{
					"id": "trung-thu",
					"name": "Trung Thu: câu cá",
					"kind": "event",
					"genre": "su-kien",
					"status": "ready",
					"minPlayers": 1,
					"maxPlayers": 1,
					"duration": {"min": 1, "max": 2},
					"closesIn": 2 * 86_400_000 + 5000,
					"event":
					{
						"opensAt": "2026-09-18T00:00:00+07:00",
						"closesAt": "2026-10-04T00:00:00+07:00",
						"color": "#B3261E",
						"tiers":
						[
							{"points": 10, "reward": {"core:coin": 50}},
							{"points": 25, "reward": {"core:coin": 100}},
						],
					},
				}
			)
		)
	for card: Dictionary in cards:
		catalog.games.append(XomDaoGameCard.from_dict(card))
	return HubCatalog.create(catalog, ["tic-tac-toe", "trung-thu"])


func test_an_open_event_lights_its_shortcut_and_its_island() -> void:
	var lobby: HubLobby = add_child_autofree(HubLobby.new())
	lobby.show_catalog(_catalog(true), "co")
	var tag: XomDaoChip = lobby.find_child("EventTag", true, false)
	assert_true(tag.visible)
	assert_eq(tag.text, "Còn 3 ngày")
	var shortcut: Button = lobby.find_child("Shortcut_su-kien", true, false)
	assert_not_null(shortcut.get_node_or_null("Dot"), "the red dot")
	var island: HubIsland = lobby.find_child("Island_su-kien", true, false)
	assert_eq(island.days_left, 3)
	assert_false(island.locked)
	watch_signals(lobby)
	shortcut.pressed.emit()
	assert_signal_emitted_with_parameters(lobby, "event_pressed", ["trung-thu"])


func test_without_an_event_the_shortcut_is_quiet_and_the_island_is_fogged() -> void:
	var lobby: HubLobby = add_child_autofree(HubLobby.new())
	lobby.show_catalog(_catalog(false), "co")
	assert_false((lobby.find_child("EventTag", true, false) as Control).visible)
	var island: HubIsland = lobby.find_child("Island_su-kien", true, false)
	assert_true(island.locked)
	watch_signals(lobby)
	(lobby.find_child("Shortcut_su-kien", true, false) as Button).pressed.emit()
	assert_signal_not_emitted(lobby, "event_pressed")
	(lobby.find_child("Shortcut_cho", true, false) as Button).pressed.emit()
	assert_signal_emitted_with_parameters(lobby, "place_pressed", ["cho"])


func test_the_event_board_shows_tiers_and_claims() -> void:
	var select: HubGameSelect = add_child_autofree(HubGameSelect.new())
	select.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	select.size = Vector2(1036, 720)
	watch_signals(select)
	var catalog: HubCatalog = _catalog(true)
	catalog.card("trung-thu").tagline = "Thả câu dưới trăng rằm, gom điểm nhận quà."
	select.show_genre(catalog, "su-kien", "trung-thu")
	assert_signal_emitted_with_parameters(select, "progress_needed", ["trung-thu"])
	assert_true((select.find_child("JoinEvent", true, false) as Control).visible)
	assert_false((select.find_child("SelectCreate", true, false) as Control).visible)
	select.show_progress(
		XomDaoEventProgress.from_dict({"eventId": "trung-thu", "points": 12, "claimed": []})
	)
	assert_eq((select.find_child("EventPoints", true, false) as Label).text, "12 điểm")
	var first: XomDaoButton = select.find_child("Claim_0", true, false)
	var second: XomDaoButton = select.find_child("Claim_1", true, false)
	assert_false(first.disabled)
	assert_true(second.disabled, "25 points not reached")
	first.pressed.emit()
	assert_signal_emitted_with_parameters(select, "claim_pressed", ["trung-thu", 0])
	select.show_progress(
		XomDaoEventProgress.from_dict({"eventId": "trung-thu", "points": 12, "claimed": [0]})
	)
	await wait_process_frames(1)
	assert_not_null(select.find_child("Claimed_0", true, false))
	select._layout()
	assert_lte(select._tiers.get_combined_minimum_size().x, select._event_scroll.size.x)
	var pending: Control = select.find_child("Claim_1", true, false)
	assert_lte(select._points.size.y + 8 + pending.size.y / 2, select._event_scroll.size.y)


func test_a_table_game_keeps_its_buttons() -> void:
	var select: HubGameSelect = add_child_autofree(HubGameSelect.new())
	select.show_genre(_catalog(true), "co", "tic-tac-toe")
	assert_true((select.find_child("SelectCreate", true, false) as Control).visible)
	assert_false((select.find_child("JoinEvent", true, false) as Control).visible)
	assert_false((select.find_child("EventTiers", true, false) as Control).is_visible_in_tree())
