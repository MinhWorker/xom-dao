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
				[
					{"id": "me", "name": "Minh", "avatar": "cat", "frame": "jade"},
					{"id": "bot", "name": "Máy", "bot": true}
				],
				"spectators": [],
				"seats":
				[
					{"id": "me", "name": "Minh", "avatar": "cat", "frame": "jade"},
					{"id": "bot", "name": "Máy", "bot": true}
				],
				"options": {"swap": false},
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
	assert_eq(
		(board.find_child("Piece_-1_0", true, false) as TextureRect).texture.resource_path,
		"res://content/tic-tac-toe/art/mark-x.webp"
	)
	assert_eq(
		(board.find_child("Piece_0_1", true, false) as TextureRect).texture.resource_path,
		"res://content/tic-tac-toe/art/mark-o.webp"
	)


func test_no_cell_is_open_on_the_other_turn() -> void:
	var board := _board("bot", [null, null, null, null, null, null])
	assert_true((board.find_child("Cell_1_1", true, false) as Button).disabled)
	assert_eq((board.find_child("Status", true, false) as Label).text, "Lượt Máy")


func test_player_panels_show_equipped_looks_and_received_emotes() -> void:
	var board := _board("me", [null, null, null, null, null, null])
	var player: XomDaoPlayerSlot = board.find_child("Seat_0", true, false)
	assert_eq(player.picture.resource_path, "res://addons/xomdao_sdk/ui/looks/avatar-cat.webp")
	assert_eq(player.frame, "jade")
	var bot: XomDaoPlayerSlot = board.find_child("Seat_1", true, false)
	assert_eq(bot.picture.resource_path, "res://addons/xomdao_sdk/ui/looks/avatar-bot.webp")
	var incoming := XomDaoRoomEmote.new()
	incoming.player_id = "bot"
	incoming.emote = "wow"
	board.call("_on_emote_received", incoming)
	var bubble: Control = board.find_child("Emote_1", true, false)
	assert_true(bubble.visible)
	assert_eq(bubble.custom_minimum_size, Vector2(180.0, 180.0))
	var bubble_art: TextureRect = bubble.find_child("BubbleArt", true, false)
	assert_eq(bubble_art.texture.resource_path, "res://content/tic-tac-toe/art/emote-bubble.webp")
	assert_true(bubble_art.flip_v, "opponent bubble tail points back up toward the avatar")
	var sticker: TextureRect = bubble.find_child("Sticker", true, false)
	assert_eq(sticker.custom_minimum_size, Vector2(128.0, 128.0))
	assert_eq(sticker.texture.resource_path, "res://addons/xomdao_sdk/ui/looks/emote-wow.webp")
	await wait_process_frames(2)
	var own_bubble: Control = board.find_child("Emote_0", true, false)
	var own_panel: Control = board.find_child("SeatPanel_0", true, false)
	var own_art: TextureRect = own_bubble.find_child("BubbleArt", true, false)
	assert_false(own_art.flip_v, "own bubble tail points down toward the avatar")
	assert_lt(
		own_bubble.get_global_rect().position.y + 0.84 * 180.0,
		own_panel.get_global_rect().position.y
	)
	var bot_panel: Control = board.find_child("SeatPanel_1", true, false)
	assert_gt(bubble.get_global_rect().position.y + 0.16 * 180.0, bot_panel.get_global_rect().end.y)


func test_tapping_own_avatar_opens_picker_with_owned_emotes() -> void:
	var board := _board("me", [null, null, null, null, null, null])
	var owned: Array[String] = ["happy", "wow"]
	board.set("_owned_emotes", owned)
	assert_eq(board.get("_owned_emotes"), owned)
	assert_eq(
		(board.find_child("Avatar_0", true, false) as Control).mouse_filter,
		Control.MOUSE_FILTER_PASS
	)
	assert_eq(
		(board.find_child("Avatar_1", true, false) as Control).mouse_filter,
		Control.MOUSE_FILTER_IGNORE
	)
	board.call("_rebuild_emote_picker")
	var touch := InputEventScreenTouch.new()
	touch.pressed = true
	board.call("_on_avatar_input", touch, 1)
	assert_false((board.find_child("EmotePanel", true, false) as XomDaoBoard).visible)
	board.call("_on_avatar_input", touch, 0)
	assert_true((board.find_child("EmotePanel", true, false) as XomDaoBoard).visible)
	assert_true((board.find_child("EmoteShade", true, false) as ColorRect).visible)
	var grid: GridContainer = board.find_child("Emotes", true, false)
	assert_eq(grid.get_child_count(), 2)
	assert_eq(grid.get_child(0).name, "Emote_happy")
	assert_eq(grid.get_child(1).name, "Emote_wow")


func test_the_room_setup_offers_the_first_move() -> void:
	var board := _board("me", [null, null, null, null, null, null])
	var keys: Array = (board.call("room_setup") as Array).map(
		func(option: Dictionary) -> String: return option["key"]
	)
	assert_eq(keys, ["opponent", "level", "swap"])


func test_new_marks_pop_in_and_use_generated_sprites() -> void:
	var board := _board("me", [null, null, null, null, null, null])
	var snapshot := _snapshot("bot", ["X", null, null, null, null, null])
	snapshot.last = XomDaoLastMove.from_dict(
		{"seq": 1, "move": {"event": "place", "payload": {"x": -1, "y": 0}}}
	)
	board.call("_show", snapshot)
	var mark: TextureRect = board.find_child("Piece_-1_0", true, false)
	assert_eq(
		mark.texture.resource_path, "res://content/tic-tac-toe/art/mark-x.webp", "X uses its sprite"
	)
	assert_lt(mark.scale.x, 1.0, "the latest mark starts with a small pop")
	await wait_seconds(0.25)
	assert_almost_eq(mark.scale.x, 1.0, 0.02, "the mark settles at full size")
	var loaded := _board("bot", ["X", null, null, null, null, null])
	var loaded_mark: TextureRect = loaded.find_child("Piece_-1_0", true, false)
	assert_eq(loaded_mark.texture.resource_path, "res://content/tic-tac-toe/art/mark-x.webp")
	assert_eq(loaded_mark.scale, Vector2.ONE, "reconnects show settled marks")


func test_finished_board_slides_left_and_view_board_restores_it() -> void:
	var board := _board("me", ["X", null, null, null, "O", null])
	board.set_anchors_preset(Control.PRESET_TOP_LEFT)
	board.size = Vector2(1280, 720)
	board.call("_layout")
	await wait_seconds(0.8)
	var before: Vector2 = board.get("_board_center")
	var snapshot := _snapshot("me", ["X", null, null, null, "O", null])
	snapshot.options = {"swap": true}
	snapshot.status = "finished"
	snapshot.result = XomDaoGameResult.from_dict({"winners": ["me"], "rewards": []})
	(board.get("_client") as XomDaoClient).snapshot = snapshot
	board.call("_show", snapshot)
	assert_eq(
		board.get("_board_center"), before, "transition starts at the original board position"
	)
	await wait_seconds(0.5)
	assert_eq(board.get("_board_center"), before, "the board holds still for the end beat")
	var stamp: Control = board.find_child("EndStamp", true, false)
	assert_true(stamp.visible, "the outcome is stamped on the page")
	assert_eq(stamp.get_parent().get("_word"), "Thắng rồi!", "from your side")
	await board.call("wait_for_result_panel")
	await wait_seconds(0.8)
	var after: Vector2 = board.get("_board_center")
	assert_lt(after.x, before.x, "the entire board slides left")
	var panel: Rect2 = board.call("result_area")
	var last: Button = board.find_child("Cell_1_1", true, false)
	assert_lt(
		last.position.x + last.size.x, panel.position.x, "the result does not cover the board"
	)
	assert_true(
		board.find_child("Seat_0", true, false).visible, "player panels stay with the board"
	)
	var mark_badge: Control = board.find_child("Mark_0", true, false)
	assert_true(mark_badge.visible, "the host's mark selector remains in their player panel")
	assert_eq(
		mark_badge.mouse_filter, Control.MOUSE_FILTER_STOP, "the host can select next round's mark"
	)
	assert_eq(
		(board.find_child("MarkIcon_0", true, false) as TextureRect).texture.resource_path,
		"res://content/tic-tac-toe/art/mark-o.webp",
		"the own panel shows the selected mark for next round"
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


func test_a_finger_on_small_cells_marks_before_it_plays() -> void:
	var board := _board("me", ["X", null, null, null, "O", null])
	var cell: Button = board.find_child("Cell_1_1", true, false)
	board.set("_cell", 40.0)
	board.set("_touching", true)
	board.call("_tap", Vector2i(1, 1))
	assert_false(cell.disabled, "the first tap only marks the cell")
	assert_eq(board.get("_armed"), Vector2i(1, 1))
	board.call("_tap", Vector2i(1, 1))
	assert_true(cell.disabled, "the second tap on it plays")
