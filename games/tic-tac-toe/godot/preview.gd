extends Control
## A stable sample game state with one emote above each player for the visual workbench.

const GAME := preload("res://content/tic-tac-toe/main.tscn")


func _ready() -> void:
	var client := XomDaoClient.new()
	client.player_id = "me"
	client.snapshot = XomDaoRoomSnapshot.from_dict(
		{
			"code": "VIEW",
			"gameId": "tic-tac-toe",
			"hostId": "me",
			"players":
			[
				{"id": "me", "name": "Minh", "avatar": "cat", "frame": "jade"},
				{"id": "bot", "name": "Máy", "avatar": "bot", "bot": true}
			],
			"spectators": [],
			"seats":
			[
				{"id": "me", "name": "Minh", "avatar": "cat", "frame": "jade"},
				{"id": "bot", "name": "Máy", "avatar": "bot", "bot": true}
			],
			"options": {"swap": false},
			"status": "playing",
			"view":
			{
				"board":
				{
					"left": -1,
					"top": 0,
					"cols": 3,
					"rows": 2,
					"cells": ["X", null, null, null, "O", null]
				},
				"players": ["me", "bot"],
				"turn": "me"
			},
			"result": null,
			"score": {"wins": [0, 0], "draws": 0},
			"round": 1,
			"last": null,
			"timer": null,
			"played": null
		}
	)
	add_child(client)
	var caro: Control = GAME.instantiate()
	add_child(caro)
	caro.call("bind", client)
	_show_emote(caro, "me", "happy")
	_show_emote(caro, "bot", "wow")
	for tween: Tween in caro.get("_emote_tweens"):
		if tween != null:
			tween.kill()
	for bubble: Control in caro.get("_emote_bubbles"):
		bubble.visible = true
		bubble.scale = Vector2.ONE
		bubble.modulate = Color.WHITE


func _show_emote(caro: Control, player_id: String, look: String) -> void:
	var emote := XomDaoRoomEmote.new()
	emote.player_id = player_id
	emote.emote = look
	caro.call("_on_emote_received", emote)
