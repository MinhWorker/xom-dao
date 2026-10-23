class_name XomDaoFriendList
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var friends: Array[XomDaoFriend] = []


static func from_dict(d: Dictionary) -> XomDaoFriendList:
	var o := XomDaoFriendList.new()
	for item: Variant in _list(d, "friends"):
		if item is Dictionary:
			o.friends.append(XomDaoFriend.from_dict(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["friends"] = _dicts(friends)
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
