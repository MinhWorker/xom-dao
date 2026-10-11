extends GutTest
## Mậu Binh's table against made-up room snapshots (no server), and the rules it mirrors.

const Rules := preload("res://content/mau-binh/rules.gd")
## A A K K Q J 10 9 8 7 5 4 2: strongest first puts a straight over two pairs (binh lủng).
const HAND: Array = [1, 10, 13, 20, 27, 30, 33, 36, 40, 44, 45, 48, 49]


func _snapshot(view: Dictionary) -> XomDaoRoomSnapshot:
	var people: Array = [{"id": "me", "name": "Minh"}, {"id": "b1", "name": "Máy 1", "bot": true}]
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "mau-binh",
				"hostId": "me",
				"players": people,
				"spectators": [],
				"seats": people,
				"status": "playing",
				"view": view,
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
		"round": 1,
		"rounds": 3,
		"phase": "arrange",
		"inRound": [true, true],
		"forfeits": [],
		"gone": [],
		"points": [0, 0],
		"results": [],
		"hand": HAND,
		"mine": null,
		"ready": [false, true],
	}
	view.merge(extra, true)
	return view


func _table(view: Dictionary) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view)
	var table: Control = add_child_autofree(load("res://content/mau-binh/main.tscn").instantiate())
	table.call("bind", client)
	return table


func _text(table: Control, name_of: String) -> String:
	return (table.find_child(name_of, true, false) as Label).text


func _rank(table: Control, name_of: String) -> String:
	return (table.find_child(name_of, true, false) as XomDaoCard).rank


func _tap(table: Control, name_of: String) -> void:
	for down: bool in [true, false]:
		var tap := InputEventMouseButton.new()
		tap.button_index = MOUSE_BUTTON_LEFT
		tap.pressed = down
		(table.find_child(name_of, true, false) as Control).gui_input.emit(tap)


## A mouse event on `card` with the pointer at `at` on the table.
func _point(card: XomDaoCard, event: InputEventMouse, at: Vector2) -> void:
	event.position = card.get_transform().affine_inverse() * at
	card.gui_input.emit(event)


func _press(card: XomDaoCard, at: Vector2, down: bool) -> void:
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = down
	_point(card, press, at)


func _press_button(table: Control, name_of: String) -> void:
	(table.find_child(name_of, true, false) as XomDaoButton).pressed.emit()


func _shown(table: Control, name_of: String) -> bool:
	var node: Control = table.find_child(name_of, true, false)
	return node != null and node.is_visible_in_tree()


## Every label's text under `node`, joined.
func _texts(node: Node) -> String:
	var out: String = ""
	for child: Node in node.find_children("*", "Label", true, false):
		out += (child as Label).text + "\n"
	return out


func _result() -> Dictionary:
	var mine: Array = [[48, 49, 44, 45, 40], [36, 33, 30, 27, 20], [13, 10, 1]]
	var theirs: Array = [[0, 4, 8, 12, 16], [2, 6, 11, 14, 18], [21, 25, 29]]
	return {
		"rows": [mine, theirs],
		"fouls": [true, false],
		"forfeits": [false, false],
		"auto": [false, false],
		"specials": [null, null],
		"duels": [{"a": 0, "b": 1, "kind": "foul", "chi": [], "scoop": 0, "points": -6}],
		"points": [-6, 6],
	}


func test_hands_and_binh_lung() -> void:
	assert_eq(Rules.hand_name([48, 49, 44, 45, 40]), "Thú")
	assert_eq(Rules.hand_name([36, 33, 30, 27, 20]), "Sảnh")
	assert_eq(Rules.hand_name([48, 1, 5, 9, 13]), "Sảnh")
	assert_eq(Rules.hand_name([0, 4, 8, 12, 16]), "Thùng phá sảnh")
	assert_eq(Rules.hand_name([1, 2, 3]), "Sám cô")
	var rows: Array = Rules.rows_of([48, 49, 44, 45, 40, 36, 33, 30, 27, 20, 13, 10, 1])
	assert_eq(Rules.foul_of(rows), "Chi 2 mạnh hơn chi 1")
	var best: Array = Rules.best_order(HAND)
	assert_eq(best.size(), 13)
	assert_eq(Rules.foul_of(Rules.rows_of(best)), "")


func test_arranging_shows_your_rows_and_swaps_cards() -> void:
	var table := _table(_view())
	assert_eq(_text(table, "Round"), "Vòng 1/3")
	assert_eq(_text(table, "Info"), "Xong 1/2")
	assert_eq(_text(table, "Status"), "Binh lủng")
	assert_eq(_text(table, "Row_1"), "Chi 1 · Thú")
	assert_eq(_text(table, "Row_2"), "Chi 2 · Sảnh")
	assert_eq(_text(table, "Tag_1"), "Xong")
	assert_true((table.find_child("Done", true, false) as Control).visible)
	assert_eq(_rank(table, "Mine_0"), "A")
	assert_eq(_rank(table, "Mine_9"), "7")
	_tap(table, "Mine_0")
	_tap(table, "Mine_9")
	assert_eq(_rank(table, "Mine_0"), "7")
	assert_eq(_rank(table, "Mine_9"), "A")
	(table.find_child("Undo", true, false) as XomDaoButton).pressed.emit()
	assert_eq(_rank(table, "Mine_0"), "A")
	(table.find_child("Auto", true, false) as XomDaoButton).pressed.emit()
	assert_eq(_text(table, "Status"), "Đang xếp")


func test_the_reveal_shows_everyones_rows_and_points() -> void:
	var result: Dictionary = _result()
	var table := _table(
		_view({"phase": "show", "points": [-6, 6], "results": [result], "ready": [true, true]})
	)
	assert_eq(_text(table, "Tag_0"), "Binh lủng")
	assert_eq(_text(table, "Total_1"), "+6")
	assert_eq(_text(table, "Status"), "%s điểm" % XomDaoUi.delta(-6))
	assert_eq(_rank(table, "Card_1_0"), "2")
	assert_true((table.find_child("Card_1_12", true, false) as XomDaoCard).is_face_up())


func test_drag_a_card_onto_another_swaps_them() -> void:
	var table := _table(_view())
	var one: XomDaoCard = table.find_child("Mine_0", true, false)
	var ten: XomDaoCard = table.find_child("Mine_9", true, false)
	var start: Vector2 = one.position + Vector2(10.0, 10.0)
	var over: Vector2 = ten.position + Vector2(10.0, 10.0)
	_press(one, start, true)
	for at: Vector2 in [start + Vector2(30.0, 0.0), over]:
		var move := InputEventMouseMotion.new()
		move.button_mask = MOUSE_BUTTON_MASK_LEFT
		_point(one, move, at)
	assert_true(ten.picked, "the card it would swap with lights up")
	assert_eq(_rank(table, "Mine_0"), "A", "nothing moves before the drop")
	_press(one, over, false)
	assert_eq(_rank(table, "Mine_0"), "7")
	assert_eq(_rank(table, "Mine_9"), "A")
	assert_false(ten.picked)
	# Dropped back on its own place (once the cards have slid home): no swap.
	await wait_seconds(0.3)
	var back: Vector2 = one.position + Vector2(10.0, 10.0)
	_press(one, back, true)
	var shake := InputEventMouseMotion.new()
	_point(one, shake, back + Vector2(0.0, 20.0))
	_point(one, shake, back)
	_press(one, back, false)
	assert_eq(_rank(table, "Mine_0"), "7")
	(table.find_child("Undo", true, false) as XomDaoButton).pressed.emit()
	assert_eq(_rank(table, "Mine_0"), "A")


func test_chi_won_against_everyone_and_one_seat() -> void:
	var result: Dictionary = {
		"duels":
		[
			{"a": 0, "b": 1, "kind": "chi", "chi": [1, -1, 3], "scoop": 0, "points": 3},
			{"a": 2, "b": 0, "kind": "chi", "chi": [1, 1, -1], "scoop": 0, "points": 1},
			{"a": 1, "b": 2, "kind": "foul", "chi": [], "scoop": 0, "points": -6},
		],
	}
	assert_eq(Rules.chi_won(result, 0, 0), 0)
	assert_eq(Rules.chi_won(result, 0, 2), 4)
	assert_eq(Rules.chi_won(result, 1, 2, 0), -3)
	assert_eq(Rules.chi_won(result, 2, 1, 1), null)


func test_the_rules_board_lists_the_points() -> void:
	var table := _table(_view())
	assert_true(_shown(table, "RulesButton"))
	assert_false(_shown(table, "Scoring"))
	_press_button(table, "RulesButton")
	assert_true(_shown(table, "Scoring"))
	var text: String = _texts(table.find_child("Scoring", true, false))
	assert_string_contains(text, "3 vòng")
	assert_string_contains(text, "Thùng phá sảnh chi 2\n+10")
	assert_string_contains(text, "Sảnh rồng đồng chất\n+26")
	assert_string_contains(text, "−6")
	_press_button(table, "ResultsButton")
	assert_false(_shown(table, "Scoring"))
	assert_true(_shown(table, "ResultsEmpty"))


func test_standings_and_results_after_a_round() -> void:
	var table := _table(
		_view({"phase": "show", "points": [-6, 6], "results": [_result()], "ready": [true, true]})
	)
	assert_true(_shown(table, "Standings"))
	assert_eq((table.find_child("Standings", true, false) as XomDaoBoard).title, "Kết quả vòng 1")
	var first: String = _texts(table.find_child("Standing_0", true, false))
	assert_string_contains(first, "Máy 1")
	assert_string_contains(first, "Tổng 6")
	var second: String = _texts(table.find_child("Standing_1", true, false))
	assert_string_contains(second, "Binh lủng")
	assert_string_contains(second, "−6")
	_press_button(table, "ResultsButton")
	assert_true(_shown(table, "Results"))
	assert_eq((table.find_child("RoundTabs", true, false) as XomDaoChoice).options, ["Vòng 1"])
	assert_true(_shown(table, "Entry_0"))
	assert_string_contains(_texts(table.find_child("Entry_1", true, false)), "Chi 1 · Thùng")
	# The last round: the hub's result comes instead.
	var last := _table(
		_view(
			{
				"rounds": 1,
				"phase": "show",
				"points": [-6, 6],
				"results": [_result()],
				"ready": [true, true],
			}
		)
	)
	assert_false(_shown(last, "Standings"))
