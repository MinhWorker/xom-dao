extends GutTest
## Tests for HubBen: two-level collapsable game list, rooms on the right, direct code input.


func _catalog() -> HubCatalog:
	var catalog := XomDaoCatalog.new()
	var genre := XomDaoGenre.new()
	genre.id = "co"
	genre.name = "Cờ"
	genre.island = "co"
	catalog.genres.append(genre)

	var ids: Array[String] = ["battleship", "tic-tac-toe", "co-ca-ngua"]
	for id: String in ids:
		var card := XomDaoGameCard.new()
		card.id = id
		card.name = id.capitalize()
		card.genre = "co"
		card.status = "ready"
		card.min_players = 2
		card.max_players = 2
		catalog.games.append(card)
	return HubCatalog.create(catalog, ids)


func _room(code: String, host: String = "An", can_join: bool = true) -> XomDaoRoomSummary:
	var r := XomDaoRoomSummary.new()
	r.code = code
	r.host_name = host
	r.players = 1
	r.max_players = 2
	r.spectators = 0
	r.status = "waiting"
	r.can_join = can_join
	return r


func test_ben_displays_game_cards_and_emits_game_selected() -> void:
	var ben: HubBen = add_child_autofree(HubBen.new())
	ben.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	ben.size = Vector2(1280, 720)
	var catalog: HubCatalog = _catalog()
	ben.setup(catalog, "battleship")
	watch_signals(ben)

	var card_battleship: HubBenGameCard = ben.find_child("GameCard_battleship", true, false)
	var card_tic: HubBenGameCard = ben.find_child("GameCard_tic-tac-toe", true, false)

	assert_not_null(card_battleship, "GameCard_battleship exists")
	assert_not_null(card_tic, "GameCard_tic-tac-toe exists")
	assert_true(card_battleship.selected, "Initial game selected")
	assert_false(card_tic.selected, "Other game not selected")

	card_tic.pressed.emit()
	assert_signal_emitted_with_parameters(ben, "game_selected", ["tic-tac-toe"])
	assert_true(card_tic.selected, "Game selection updated")


func test_ben_collapsible_category_toggles_games() -> void:
	var ben: HubBen = add_child_autofree(HubBen.new())
	ben.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	ben.size = Vector2(1280, 720)
	var catalog: HubCatalog = _catalog()
	ben.setup(catalog, "battleship")

	var header: HubBenCategoryHeader = ben.find_child("Category_co", true, false)
	assert_not_null(header, "Category_co header exists")
	assert_false(header.collapsed, "Selected game's category is expanded")

	var games_box: Control = ben.find_child("CategoryGames_co", true, false)
	assert_not_null(games_box, "CategoryGames_co exists")
	assert_true(games_box.visible, "Games are visible when expanded")

	header.pressed.emit()
	assert_true(header.collapsed, "Category is now collapsed")
	assert_false(games_box.visible, "Games are hidden when collapsed")

	header.pressed.emit()
	assert_false(header.collapsed, "Category is expanded again")
	assert_true(games_box.visible, "Games are visible again")


func test_ben_shows_rooms_and_joins_on_click() -> void:
	var ben: HubBen = add_child_autofree(HubBen.new())
	ben.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	ben.size = Vector2(1280, 720)
	var catalog: HubCatalog = _catalog()
	ben.setup(catalog, "battleship")
	watch_signals(ben)

	var r1: XomDaoRoomSummary = _room("ABCD", "An", true)
	var r2: XomDaoRoomSummary = _room("XYZW", "Binh", false)
	ben.show_rooms("Bắn Tàu", [r1, r2], "battleship")

	var room_node: Control = ben.find_child("Room_ABCD", true, false)
	assert_not_null(room_node, "Room_ABCD row exists")

	var enter_btn: XomDaoButton = ben.find_child("Enter_ABCD", true, false)
	assert_not_null(enter_btn, "Enter_ABCD button exists")
	assert_false(enter_btn.disabled, "Can join room")

	enter_btn.pressed.emit()
	assert_signal_emitted_with_parameters(ben, "join_requested", ["ABCD"])

	var enter_btn2: XomDaoButton = ben.find_child("Enter_XYZW", true, false)
	assert_not_null(enter_btn2, "Enter_XYZW exists")
	assert_true(enter_btn2.disabled, "Full room is disabled")


func test_ben_empty_state_shows_no_rooms() -> void:
	var ben: HubBen = add_child_autofree(HubBen.new())
	ben.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	ben.size = Vector2(1280, 720)
	ben.show_rooms("Caro", [], "tic-tac-toe")

	var no_rooms: Node = ben.find_child("NoRooms", true, false)
	assert_not_null(no_rooms, "NoRooms message exists when room list is empty")


func test_ben_direct_code_input() -> void:
	var ben: HubBen = add_child_autofree(HubBen.new())
	ben.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	ben.size = Vector2(1280, 720)
	watch_signals(ben)

	var input: LineEdit = ben.find_child("CodeInput", true, false)
	var join: XomDaoButton = ben.find_child("Join", true, false)
	assert_not_null(input, "CodeInput exists")
	assert_not_null(join, "Join button exists")

	input.text = "game"
	input.text_changed.emit("game")
	assert_eq(input.text, "GAME", "Auto-uppercased")

	join.pressed.emit()
	assert_signal_emitted_with_parameters(ben, "join_requested", ["GAME"])

	input.text = "test"
	input.text_submitted.emit("test")
	assert_signal_emitted_with_parameters(ben, "join_requested", ["TEST"])
