extends GutTest
## The Caro board against a made-up room snapshot (no server).


func _snapshot(turn: String, cells: Array) -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "tic-tac-toe",
				"hostId": "me",
				"players":
				[{"id": "me", "name": "Minh"}, {"id": "bot", "name": "Máy", "bot": true}],
				"spectators": [],
				"seats": [{"id": "me", "name": "Minh"}, {"id": "bot", "name": "Máy", "bot": true}],
				"status": "playing",
				"view":
				{
					"board": {"left": -1, "top": 0, "cols": 3, "rows": 2, "cells": cells},
					"players": ["me", "bot"],
					"turn": turn,
				},
				"result": null,
				"score": {"wins": [0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func _board(turn: String, cells: Array) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(turn, cells)
	var board: Control = add_child_autofree(
		load("res://content/tic-tac-toe/main.tscn").instantiate()
	)
	board.call("bind", client)
	return board


func test_cells_are_named_by_board_coordinates() -> void:
	var board := _board("me", ["X", null, null, null, "O", null])
	var first: Button = board.find_child("Cell_-1_0", true, false)
	assert_not_null(board.find_child("Piece_-1_0", true, false), "X on the first cell")
	assert_true(first.disabled, "a marked cell can't be played")
	assert_not_null(board.find_child("Piece_0_1", true, false), "O in the middle")
	assert_null(board.find_child("Piece_1_1", true, false), "an empty cell has no piece")
	assert_false((board.find_child("Cell_1_1", true, false) as Button).disabled)
	assert_eq((board.find_child("Status", true, false) as Label).text, "Lượt bạn")


func test_no_cell_is_open_on_the_other_turn() -> void:
	var board := _board("bot", [null, null, null, null, null, null])
	assert_true((board.find_child("Cell_1_1", true, false) as Button).disabled)
	assert_eq((board.find_child("Status", true, false) as Label).text, "Lượt Máy")


func test_the_room_setup_offers_the_first_move() -> void:
	var board := _board("me", [null, null, null, null, null, null])
	var keys: Array = (board.call("room_setup") as Array).map(
		func(option: Dictionary) -> String: return option["key"]
	)
	assert_eq(keys, ["opponent", "level", "swap"])


func test_first_move_writes_ink_and_existing_ink_is_complete() -> void:
	var board := _board("me", [null, null, null, null, null, null])
	var snapshot := _snapshot("bot", ["X", null, null, null, null, null])
	snapshot.last = XomDaoLastMove.from_dict(
		{"seq": 1, "move": {"event": "place", "payload": {"x": -1, "y": 0}}}
	)
	board.call("_show", snapshot)
	var ink: Control = board.find_child("Piece_-1_0", true, false)
	assert_eq(ink.get("progress"), 0.0, "the first move starts with blank paper")
	await wait_seconds(0.2)
	assert_gt(ink.get("progress"), 0.0, "ink is drawn over time")
	assert_lt(ink.get("progress"), 1.0, "the mark is still writing")
	await wait_seconds(0.4)
	assert_eq(ink.get("progress"), 1.0, "the mark finishes")
	var loaded := _board("bot", ["X", null, null, null, null, null])
	assert_eq(
		loaded.find_child("Piece_-1_0", true, false).get("progress"),
		1.0,
		"reconnects show complete marks"
	)


func test_finished_board_slides_left_and_view_board_restores_it() -> void:
	var board := _board("me", ["X", null, null, null, "O", null])
	board.set_anchors_preset(Control.PRESET_TOP_LEFT)
	board.size = Vector2(1280, 720)
	board.call("_layout")
	await wait_seconds(0.8)
	var before: Vector2 = board.get("_board_center")
	var snapshot := _snapshot("me", ["X", null, null, null, "O", null])
	snapshot.status = "finished"
	snapshot.result = XomDaoGameResult.from_dict({"winners": ["me"], "rewards": []})
	board.call("_show", snapshot)
	assert_eq(
		board.get("_board_center"), before, "transition starts at the original board position"
	)
	await wait_seconds(0.8)
	var after: Vector2 = board.get("_board_center")
	assert_lt(after.x, before.x, "the entire board slides left")
	var panel: Rect2 = board.call("result_area")
	var last: Button = board.find_child("Cell_1_1", true, false)
	assert_lt(
		last.position.x + last.size.x, panel.position.x, "the result does not cover the board"
	)
	assert_false(
		board.find_child("Seat_0", true, false).visible, "players leave room for the final board"
	)
	board.call("set_result_visible", false)
	await wait_seconds(0.8)
	assert_almost_eq(
		(board.get("_board_center") as Vector2).x,
		before.x,
		0.1,
		"Xem bàn restores the centred board"
	)
	board.call("set_result_visible", true)
	await wait_seconds(0.8)
	assert_almost_eq(
		(board.get("_board_center") as Vector2).x, after.x, 0.1, "Kết quả docks the board again"
	)
	snapshot.status = "playing"
	snapshot.result = null
	snapshot.round = 2
	board.call("_show", snapshot)
	await wait_seconds(0.8)
	assert_true(board.find_child("Seat_0", true, false).visible, "rematch restores the player HUD")
	assert_almost_eq(
		(board.get("_board_center") as Vector2).x,
		before.x,
		0.1,
		"rematch restores the centred board"
	)
