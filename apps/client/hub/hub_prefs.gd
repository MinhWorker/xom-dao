class_name HubPrefs
extends RefCounted
## What the hub remembers per account on this device (user://hub.cfg): the game on CHƠI and
## cached stats.

const PATH := "user://hub.cfg"


static func selected_game(user_id: String, path: String = PATH) -> String:
	var config := ConfigFile.new()
	if config.load(path) != OK:
		return ""
	return str(config.get_value("selected", user_id, ""))


static func set_selected_game(user_id: String, game_id: String, path: String = PATH) -> void:
	var config := ConfigFile.new()
	config.load(path)
	config.set_value("selected", user_id, game_id)
	config.save(path)


static func player_stats(user_id: String, path: String = PATH) -> Dictionary:
	if user_id == "":
		return {}
	var config := ConfigFile.new()
	if config.load(path) != OK:
		return {}
	var val: Variant = config.get_value("stats", user_id, {})
	return val if val is Dictionary else {}


static func set_player_stats(user_id: String, stats: Dictionary, path: String = PATH) -> void:
	if user_id == "":
		return
	var config := ConfigFile.new()
	config.load(path)
	config.set_value("stats", user_id, stats)
	config.save(path)
