extends RefCounted
## xd's `go` (tools/xd, debug desktop builds): opens a hub place as a tap would. It drives the
## hub (hub/main.gd) through its own methods, so what shows is what a player would see.

const PLACES: Array[String] = ["lobby", "select", "ben", "nha", "cho", "dinh", "play", "rules"]


## lobby, select [genre], ben [game], nha, cho, dinh, rules [game], or play <game> (its
## sandbox). Leaves the room first for a place out of it. "" when done, else why not.
static func go(hub: Node, place: String, arg: String) -> String:
	if hub.get("_catalog") == null:
		return "Not logged in yet (scene %s)" % TestBridge.scene
	if not PLACES.has(place):
		return "Unknown place %s: %s" % [place, ", ".join(PLACES)]
	var client: XomDaoClient = Net.client
	if place == "rules":
		var game_id: String = arg if arg != "" else str(hub.get("_game_id"))
		if arg == "" and client.snapshot != null:
			game_id = client.snapshot.game_id
		hub.call("_show_rules", game_id)
		return ""
	var catalog: HubCatalog = hub.get("_catalog")
	if (place == "play" or (place == "ben" and arg != "")) and catalog.card(arg) == null:
		return "Unknown game %s" % arg
	if client.room_code != "":
		await client.leave_room()
	if place == "play":
		hub.call("_choose_game", arg)
		await hub.call("_sandbox", arg)
		return ""
	if place == "ben" and arg != "":
		hub.call("_choose_game", arg)
	if place == "select" and arg != "":
		hub.set("_genre", arg)
	hub.set("_place", place)
	hub.set("_shown", "")
	hub.call("_show_place")
	return ""
