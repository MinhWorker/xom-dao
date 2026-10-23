extends GutTest
## A game dressing the shared pieces: its table skin on the kit, its places on the result board.


func _snapshot(winners: Array) -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "bai-cao",
				"hostId": "minh",
				"players":
				[
					{"id": "minh", "name": "Minh", "connected": true},
					{"id": "bot:1", "name": "Máy", "connected": true, "bot": true},
				],
				"status": "finished",
				"result": {"winners": winners, "rewards": []},
			}
		)
	)


func test_a_game_places_everyone_and_shows_their_scores_on_the_result() -> void:
	var settings := XomDaoSettings.new()
	settings.path = ""
	var result: HubResult = add_child_autofree(HubResult.new(settings))
	var detail: Dictionary = {
		"rows": [],
		"ranks": {"minh": 1, "bot:1": 1},
		"scores": {"minh": "12 điểm", "bot:1": "12 điểm"},
	}
	result.show_result(_snapshot(["minh", "bot:1"]), "minh", 100, false, detail)
	var scores: Array[Node] = result.find_children("Score", "Label", true, false)
	assert_eq(scores.size(), 2, "a score on every row")
	assert_eq((scores[0] as Label).text, "12 điểm")
	var places: Array[String] = []
	for chip: Node in result.find_children("*", "XomDaoChip", true, false):
		places.append(str(chip.get("text")))
	assert_eq(places.count("Hạng 1"), 2, "level points share the first place")


func test_a_table_skin_dresses_the_kit_pieces() -> void:
	var skin := XomDaoTableSkin.new()
	skin.plate = Color("#13283C")
	skin.edge = Color("#C9A24E")
	skin.timer = Color("#C9A24E")
	skin.primary = [Color("#B8352B"), Color("#C9A24E"), Color("#F1E9D2")]
	skin.round_button = [Color("#13283C"), Color("#C9A24E"), Color("#F1E9D2")]
	var slot: XomDaoPlayerSlot = add_child_autofree(XomDaoPlayerSlot.new())
	slot.skin = skin
	assert_eq(slot.avatar.timer_color, skin.timer, "the turn timer in the table's metal")
	var button: XomDaoButton = add_child_autofree(XomDaoButton.create("Đánh"))
	skin.dress_button(button, "primary")
	assert_eq(button.body.face, skin.primary[0])
	button.kind = XomDaoUi.Kind.DANGER
	assert_eq(button.body.face, skin.primary[0], "a dressed button keeps its dress")
	var menu: XomDaoIconButton = add_child_autofree(XomDaoIconButton.create("list"))
	skin.dress_icon_button(menu)
	assert_eq(menu.background, skin.round_button[0])
	XomDaoTableSkin.undress_icon_button(menu)
	assert_eq(menu.background, XomDaoUi.HUD, "back in the kit's disc for the next game")


func test_places_by_points_and_the_end_words() -> void:
	var lost: XomDaoRoomSnapshot = _snapshot(["bot:1"])
	var detail: Dictionary = XomDaoPlaces.by_points(lost, [4, 9], [])
	assert_eq(detail["ranks"], {"bot:1": 1, "minh": 2})
	assert_eq(detail["scores"], {"bot:1": "9 điểm", "minh": "4 điểm"})
	var left: Dictionary = XomDaoPlaces.by_points(lost, [12, 9], [0])
	assert_eq(left["ranks"]["minh"], 2, "whoever left comes last, whatever their points")
	assert_eq(XomDaoPlaces.outcome(lost, "minh"), "lose")
	assert_eq(XomDaoPlaces.outcome(lost, "guest"), "watch")
	assert_eq(XomDaoPlaces.outcome(_snapshot([]), "minh"), "draw")
	var names: Array[String] = ["Máy"]
	assert_eq(XomDaoPlaces.words("lose", names, 9), ["Thua rồi", "Máy nhiều điểm nhất, 9 điểm"])
