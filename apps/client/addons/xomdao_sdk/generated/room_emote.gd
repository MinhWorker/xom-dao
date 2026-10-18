class_name XomDaoRoomEmote
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var player_id: String = ""
var emote: String = ""


static func from_dict(d: Dictionary) -> XomDaoRoomEmote:
	var o := XomDaoRoomEmote.new()
	o.player_id = str(d.get("playerId", ""))
	o.emote = str(d.get("emote", ""))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["playerId"] = player_id
	d["emote"] = emote
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
