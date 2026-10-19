extends GutTest
## The lobby: its island ring with fake catalogs of 0, 1 and 6 secondary genres, and its HUD.

const SIZES: Array[Vector2] = [Vector2(960, 720), Vector2(1560, 720), Vector2(1280, 720)]


func _settings() -> XomDaoSettings:
	var settings := XomDaoSettings.new()
	settings.path = ""
	return settings


## Cờ and Bài, then `secondary` other genres; given out of order on purpose.
func _genres(secondary: int) -> Array[XomDaoGenre]:
	var out: Array[XomDaoGenre] = []
	for i: int in secondary:
		out.append(
			_genre(
				"phu-%d" % (secondary - i), "Phụ %d" % (secondary - i), 10 + secondary - i, false
			)
		)
	out.append(_genre("bai", "Bài", 2, true))
	out.append(_genre("co", "Cờ", 1, true))
	return out


func _genre(id: String, title: String, order: int, main: bool) -> XomDaoGenre:
	return XomDaoGenre.from_dict(
		{"id": id, "name": title, "order": order, "island": id, "main": main}
	)


func _catalog(secondary: int) -> HubCatalog:
	var catalog := XomDaoCatalog.new()
	catalog.genres = _genres(secondary)
	(
		catalog
		. games
		. append(
			(
				XomDaoGameCard
				. from_dict(
					{
						"id": "tic-tac-toe",
						"name": "Caro",
						"genre": "co",
						"status": "ready",
						"minPlayers": 2,
						"maxPlayers": 2,
						"duration": {"min": 5, "max": 15},
					}
				)
			)
		)
	)
	return HubCatalog.create(catalog, ["tic-tac-toe"])


func _ids(entries: Array[Dictionary]) -> Array:
	return entries.map(func(e: Dictionary) -> String: return e["id"])


func test_main_genres_lead_and_soon_only_without_secondary() -> void:
	var none: Array[Dictionary] = HubIslandRing.entries(_genres(0), ["co"])
	assert_eq(_ids(none), ["co", "bai", HubIsland.SOON])
	assert_true(none[2]["locked"])
	assert_true(none[1]["locked"], "Bài has no ready game here")
	assert_false(none[0]["locked"])
	assert_eq(_ids(HubIslandRing.entries(_genres(1), [])), ["co", "bai", "phu-1"])
	assert_eq(
		_ids(HubIslandRing.entries(_genres(6), [])),
		["co", "bai", "phu-1", "phu-2", "phu-3", "phu-4", "phu-5", "phu-6"]
	)


func test_turning_the_ring_changes_the_selected_island() -> void:
	var ring: HubIslandRing = add_child_autofree(HubIslandRing.new())
	ring.size = Vector2(800, 400)
	ring.set_entries(HubIslandRing.entries(_genres(6), []))
	watch_signals(ring)
	assert_eq(ring.selected_id(), "co")
	assert_true(ring.islands[0].selected)
	ring.select(2, false)
	assert_eq(ring.selected_id(), "phu-1")
	assert_signal_emitted_with_parameters(ring, "selected_changed", [2])
	assert_true(ring.islands[2].selected)
	assert_false(ring.islands[0].selected)
	# The short way round: from 2 to 7 is 3 steps back, not 5 forward.
	ring.select(7, false)
	assert_eq(ring.selected_id(), "phu-6")
	assert_almost_eq(ring.turn, -1.0, 0.001)
	# The front island is the biggest and the lowest on screen.
	var front: HubIsland = ring.islands[7]
	for island: HubIsland in ring.islands:
		if island != front:
			assert_lt(island.size.x, front.size.x)
			assert_lt(island.position.y + island.size.y, front.position.y + front.size.y + 0.01)


func test_escape_opens_the_profile_from_the_lobby() -> void:
	var lobby: HubLobby = add_child_autofree(HubLobby.new(_settings()))
	watch_signals(lobby)
	var escape := InputEventAction.new()
	escape.action = "ui_cancel"
	escape.pressed = true
	lobby._unhandled_input(escape)
	assert_signal_emitted_with_parameters(lobby, "place_pressed", ["nha"])


func test_a_swipe_turns_and_a_tap_on_the_front_opens() -> void:
	var ring: HubIslandRing = add_child_autofree(HubIslandRing.new())
	ring.size = Vector2(800, 400)
	ring.set_entries(HubIslandRing.entries(_genres(1), []))
	watch_signals(ring)
	ring._gui_input(_press(Vector2(400, 300), true))
	ring._gui_input(_move(Vector2(400 - HubIslandRing.DRAG_PER_ISLAND, 300)))
	ring._gui_input(_press(Vector2(400 - HubIslandRing.DRAG_PER_ISLAND, 300), false))
	assert_eq(ring.selected, 1)
	ring.select(0, false)
	var front: HubIsland = ring.islands[0]
	var at: Vector2 = front.position + front.body_rect().get_center()
	ring._gui_input(_press(at, true))
	ring._gui_input(_press(at, false))
	assert_signal_emitted_with_parameters(ring, "opened", [0])


func test_no_island_overlaps_the_hud() -> void:
	for secondary: int in [0, 1, 6]:
		for view: Vector2 in SIZES:
			var lobby: HubLobby = add_child_autofree(HubLobby.new(_settings()))
			lobby.set_anchors_preset(Control.PRESET_TOP_LEFT)
			lobby.size = view
			var catalog: HubCatalog = _catalog(secondary)
			lobby.show_catalog(catalog, "co")
			lobby.show_game(catalog.card("tic-tac-toe"), true)
			await wait_process_frames(2)
			lobby._layout()
			for turn: float in [0.0, 0.5, 1.0, 2.5]:
				lobby.ring.turn = turn
				for island: HubIsland in lobby.ring.islands:
					var box := Rect2(lobby.ring.position + island.position, island.size)
					assert_true(
						Rect2(Vector2.ZERO, view).encloses(box), "%s on screen" % island.name
					)
					for hud: Rect2 in lobby.hud_rects():
						assert_false(
							box.intersects(hud),
							"%d genres, %s: %s over %s" % [secondary, view, island.name, hud]
						)


func test_picking_a_game_again_keeps_the_hud_where_it_was() -> void:
	var lobby: HubLobby = add_child_autofree(HubLobby.new(_settings()))
	lobby.set_anchors_preset(Control.PRESET_TOP_LEFT)
	lobby.size = Vector2(1280, 720)
	var catalog: HubCatalog = _catalog(1)
	lobby.show_catalog(catalog, "co")
	lobby.show_game(catalog.card("tic-tac-toe"), true)
	await wait_process_frames(2)
	var before: Array[Rect2] = lobby.hud_rects()
	lobby.show_game(catalog.card("tic-tac-toe"), true)
	await wait_process_frames(2)
	assert_eq(lobby.play.seats, "2 người")
	var after: Array[Rect2] = lobby.hud_rects()
	for i: int in before.size():
		assert_almost_eq(after[i].position, before[i].position, Vector2.ONE * 0.01)
		assert_almost_eq(after[i].size, before[i].size, Vector2.ONE * 0.01)


func test_a_long_name_is_written_smaller_not_cut() -> void:
	var card: HubGameCard = add_child_autofree(HubGameCard.new())
	card.show_title("Cờ")
	assert_eq(card.title.get_theme_font_size("font_size"), HubGameCard.TITLE_SIZE)
	card.show_title("Cờ tỷ phú Classic phiên bản đặc biệt")
	assert_lt(card.title.get_theme_font_size("font_size"), HubGameCard.TITLE_SIZE)
	assert_eq(card.title.text_overrun_behavior, TextServer.OVERRUN_NO_TRIMMING)


func test_the_card_follows_what_can_be_played() -> void:
	var lobby: HubLobby = add_child_autofree(HubLobby.new(_settings()))
	var catalog: HubCatalog = _catalog(0)
	lobby.show_game(catalog.card("tic-tac-toe"), true)
	assert_eq(lobby._card.title.text, "Caro")
	assert_false(lobby.play.disabled)
	lobby.show_game(null, false)
	assert_eq(lobby._card.title.text, "Sắp có")
	assert_true(lobby.play.disabled)
	assert_eq(catalog.games_of("co").size(), 1)
	assert_eq(catalog.ready_genres(), ["co"] as Array[String])


func _press(at: Vector2, down: bool) -> InputEventMouseButton:
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = down
	event.position = at
	return event


func _move(at: Vector2) -> InputEventMouseMotion:
	var event := InputEventMouseMotion.new()
	event.position = at
	return event


func test_the_hud_parts_stay_on_screen_and_apart() -> void:
	for scale: float in XomDaoSettings.SCALES:
		for view: Vector2 in SIZES:
			var settings: XomDaoSettings = _settings()
			settings.ui_scale = scale
			var lobby: HubLobby = add_child_autofree(HubLobby.new(settings))
			lobby.set_anchors_preset(Control.PRESET_TOP_LEFT)
			lobby.size = view
			var catalog: HubCatalog = _catalog(1)
			lobby.show_catalog(catalog, "co")
			lobby.show_game(catalog.card("tic-tac-toe"), true)
			lobby.show_level(2, 140, 100, 250)
			await wait_process_frames(2)
			lobby._layout()
			var parts: Array[Rect2] = lobby.hud_rects()
			for i: int in parts.size():
				assert_true(
					Rect2(Vector2.ZERO, view).grow(0.5).encloses(parts[i]),
					"%s ×%s: part %d %s on screen" % [view, scale, i, parts[i]]
				)
				for j: int in range(i + 1, parts.size()):
					assert_false(
						parts[i].intersects(parts[j]),
						"%s ×%s: parts %d and %d overlap" % [view, scale, i, j]
					)


func test_the_exp_bar_shows_progress_in_this_level() -> void:
	var lobby: HubLobby = add_child_autofree(HubLobby.new(_settings()))
	lobby.show_level(2, 140, 100, 250)
	var bar: ProgressBar = lobby.find_child("LobbyExp", true, false)
	assert_true(bar.visible)
	assert_eq(bar.value, 40.0)
	assert_eq(bar.max_value, 150.0)
	assert_eq((lobby.find_child("LobbyExpText", true, false) as Label).text, "40/150")
