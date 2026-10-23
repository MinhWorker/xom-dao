class_name XomDaoQuest
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var title: String = ""
var goal: int = 0
var progress: int = 0
var reward: int = 0
var claimed: bool = false


static func from_dict(d: Dictionary) -> XomDaoQuest:
	var o := XomDaoQuest.new()
	o.id = str(d.get("id", ""))
	o.title = str(d.get("title", ""))
	o.goal = int(d.get("goal", 0))
	o.progress = int(d.get("progress", 0))
	o.reward = int(d.get("reward", 0))
	o.claimed = bool(d.get("claimed", false))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["title"] = title
	d["goal"] = goal
	d["progress"] = progress
	d["reward"] = reward
	d["claimed"] = claimed
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
