class_name XomDaoFriend
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var username: String = ""
var name: String = ""
var avatar: String = ""
var frame: String = ""
var state: String = ""
var online: bool = false
var game_id: String = ""
var room_code: String = ""
var unread: int = 0


static func from_dict(d: Dictionary) -> XomDaoFriend:
	var o := XomDaoFriend.new()
	o.id = str(d.get("id", ""))
	o.username = str(d.get("username", ""))
	o.name = str(d.get("name", ""))
	o.avatar = str(d.get("avatar", ""))
	o.frame = str(d.get("frame", ""))
	o.state = str(d.get("state", ""))
	o.online = bool(d.get("online", false))
	o.game_id = str(d.get("gameId", ""))
	o.room_code = str(d.get("roomCode", ""))
	o.unread = int(d.get("unread", 0))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["username"] = username
	d["name"] = name
	d["avatar"] = avatar
	d["frame"] = frame
	d["state"] = state
	d["online"] = online
	if game_id != "":
		d["gameId"] = game_id
	if room_code != "":
		d["roomCode"] = room_code
	d["unread"] = unread
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
