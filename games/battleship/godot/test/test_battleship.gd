extends GutTest
## Bắn Tàu's table against made-up room snapshots (no server), and the fleet rules it mirrors.

const Rules := preload("res://content/battleship/rules.gd")
const FLEET: Array = [[0, 1, 2, 3, 4], [20, 21, 22, 23], [40, 41, 42], [60, 61, 62], [80, 81]]


func _ships(fleet: Array) -> Array:
	return fleet.map(func(cells: Array) -> Dictionary: return {"cells": cells})


func _snapshot(view: Dictionary) -> XomDaoRoomSnapshot:
	var people: Array = [{"id": "me", "name": "Minh"}, {"id": "b1", "name": "Máy", "bot": true}]
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "battleship",
				"hostId": "me",
				"players": people,
				"spectators": [],
				"seats": people,
				"status": "playing",
				"view": view,
				"options": {"spacing": true},
				"result": null,
				"score": {"wins": [0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func _view(extra: Dictionary = {}) -> Dictionary:
	var view: Dictionary = {
		"players": ["me", "b1"],
		"phase": "setup",
		"ready": [false, true],
		"turn": 0,
		"last": null,
		"end": null,
		"waters":
		[
			{"ships": _ships(FLEET), "shots": [], "sunk": []},
			{"ships": [], "shots": [], "sunk": []},
		],
	}
	view.merge(extra, true)
	return view


func _table(view: Dictionary) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view)
	var table: Control = add_child_autofree(
		load("res://content/battleship/main.tscn").instantiate()
	)
	table.call("bind", client)
	return table


func _text(table: Control, name_of: String) -> String:
	return (table.find_child(name_of, true, false) as Label).text


func test_emote_picker_title_does_not_overlap_close_button_with_one_emote() -> void:
	var frame := Control.new()
	frame.set_anchors_preset(Control.PRESET_TOP_LEFT)
	frame.size = Vector2(1280.0, 720.0)
	add_child_autofree(frame)
	var picker := BattleshipEmotePicker.new()
	frame.add_child(picker)
	var avatar := Control.new()
	avatar.position = Vector2(40.0, 500.0)
	avatar.size = Vector2(96.0, 96.0)
	frame.add_child(avatar)
	var owned: Array[String] = ["happy"]
	picker.set("_owned", owned)
	picker.call("_rebuild")
	picker.toggle(avatar)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(0.35).timeout

	var board: XomDaoBoard = picker.find_child("EmotePanel", true, false)
	var title: Label = board.get("_title")
	var font: Font = title.get_theme_font("font")
	var title_width: float = (
		font.get_string_size(title.text, HORIZONTAL_ALIGNMENT_CENTER, -1, XomDaoUi.TITLE).x
	)
	var title_left: float = title.global_position.x + (title.size.x - title_width) / 2.0
	var title_right: float = title_left + title_width
	var close_rect: Rect2 = board.close_button.get_global_rect()
	assert_true(
		title_right <= close_rect.position.x or title_left >= close_rect.end.x,
		(
			"The emote title stays clear of the close mark when only one emote is owned "
			+ (
				"(panel %s, title %s..%s, close %s)"
				% [board.size, title_left, title_right, close_rect]
			)
		)
	)
	var grid: GridContainer = board.find_child("Emotes", true, false)
	var sticker: Control = grid.get_child(0)
	var sticker_center: float = sticker.get_global_rect().get_center().x
	var panel_center: float = board.get_global_rect().get_center().x
	assert_almost_eq(
		sticker_center, panel_center, 1.0, "A single emote stays centered in the wider picker"
	)


func test_fleet_rules() -> void:
	assert_eq(Rules.cell_name(14), "E2")
	assert_eq(Rules.ship_at(0, 8, 3, false), [])
	assert_eq(Rules.ship_at(7, 0, 3, true), [70, 80, 90])
	assert_false(Rules.fits([10, 11], [[0, 1]], true))
	assert_true(Rules.fits([10, 11], [[0, 1]], false))
	assert_false(Rules.fits([1, 2], [[0, 1]], false))


func test_arranging_picks_and_turns_a_ship() -> void:
	var table := _table(_view())
	assert_eq(_text(table, "Status"), "Xếp tàu")
	assert_true((table.find_child("Ready", true, false) as Control).visible)
	assert_false((table.find_child("Small", true, false) as Control).visible)
	var big: Control = table.find_child("Big", true, false)
	var at: Vector2 = big.call("cell_position", 80) + Vector2.ONE * 5.0
	for times: int in 2:
		for pressed: bool in [true, false]:
			var tap := InputEventMouseButton.new()
			tap.button_index = MOUSE_BUTTON_LEFT
			tap.pressed = pressed
			tap.position = at
			big.gui_input.emit(tap)
	# Picked, then turned down the sea from its first cell.
	assert_eq(big.get("ships")[4], [80, 90])


func test_battle_shows_the_turn_and_sunk_ships() -> void:
	var view := _view(
		{
			"phase": "battle",
			"ready": [true, true],
			"last": {"by": 0, "cell": 81, "hit": true, "sunk": [80, 81]},
		}
	)
	view["waters"][1] = {
		"ships": [{"cells": [80, 81]}],
		"shots": [{"cell": 80, "hit": true}, {"cell": 81, "hit": true}, {"cell": 5, "hit": false}],
		"sunk": [2],
	}
	var table := _table(view)
	assert_eq(_text(table, "Status"), "Lượt bạn")
	assert_eq(_text(table, "Shot"), "B9: Chìm Khu trục hạm")
	assert_true((table.find_child("Small", true, false) as Control).visible)
	assert_almost_eq((table.find_child("Fleet_4", true, false) as Control).modulate.a, 0.35, 0.01)
	assert_almost_eq((table.find_child("Fleet_0", true, false) as Control).modulate.a, 1.0, 0.01)


func test_the_end_names_the_winner() -> void:
	var table := _table(
		_view({"phase": "battle", "ready": [true, true], "end": {"reason": "resign", "winner": 0}})
	)
	assert_eq(_text(table, "Status"), "Máy đầu hàng")
	assert_false((table.find_child("Resign", true, false) as Control).visible)


func test_a_live_win_runs_up_the_signal_flags_before_the_result() -> void:
	var table := _table(_view({"phase": "battle", "ready": [true, true]}))
	var client: XomDaoClient = table.get("_client")
	var over := _snapshot(
		_view({"phase": "battle", "ready": [true, true], "end": {"reason": "resign", "winner": 0}})
	)
	over.status = "finished"
	over.result = XomDaoGameResult.from_dict({"winners": ["me"], "rewards": []})
	client.snapshot = over
	var waited: Array[bool] = [false]
	var waiter: Callable = func() -> void:
		await table.call("wait_for_result_panel")
		waited[0] = true
	waiter.call()
	await wait_seconds(1.6)
	assert_true(table.find_child("EndStrip", true, false).visible)
	assert_eq(_text(table, "EndHeadline"), "Thắng rồi!")
	assert_eq(_text(table, "EndLine"), "Máy đầu hàng")
	assert_false(waited[0], "the result board waits for the beat")
	await wait_seconds(1.8)
	assert_true(waited[0])
	var rows: Array = (table.call("result_detail") as Dictionary)["rows"]
	assert_eq(rows[0], ["Bạn bắn", "0 phát"], "each figure on its own row")
	assert_true(table.call("table_skin") is XomDaoTableSkin)


func test_arrow_keys_aim_on_your_turn() -> void:
	var table := _table(_view({"phase": "battle", "ready": [true, true], "turn": 0}))
	var big: Control = table.find_child("Big", true, false)
	for code: Key in [KEY_RIGHT, KEY_RIGHT, KEY_DOWN]:
		var key := InputEventKey.new()
		key.keycode = code
		key.pressed = true
		table.call("_unhandled_key_input", key)
	assert_eq(big.get("aim"), 55, "the sight starts mid-sea and follows the arrows")
	assert_true(big.get("aiming"))
