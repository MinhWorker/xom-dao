class_name XomDaoRoomInvite
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var from_id: String = ""
var from_name: String = ""
var avatar: String = ""
var frame: String = ""
var room_code: String = ""
var game_id: String = ""


static func from_dict(d: Dictionary) -> XomDaoRoomInvite:
	var o := XomDaoRoomInvite.new()
	o.from_id = str(d.get("fromId", ""))
	o.from_name = str(d.get("fromName", ""))
	o.avatar = str(d.get("avatar", ""))
	o.frame = str(d.get("frame", ""))
	o.room_code = str(d.get("roomCode", ""))
	o.game_id = str(d.get("gameId", ""))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["fromId"] = from_id
	d["fromName"] = from_name
	d["avatar"] = avatar
	d["frame"] = frame
	d["roomCode"] = room_code
	d["gameId"] = game_id
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
