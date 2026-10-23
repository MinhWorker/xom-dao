class_name XomDaoQuestBoard
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var day: String = ""
var ends_in: float = 0.0
var quests: Array[XomDaoQuest] = []


static func from_dict(d: Dictionary) -> XomDaoQuestBoard:
	var o := XomDaoQuestBoard.new()
	o.day = str(d.get("day", ""))
	o.ends_in = float(d.get("endsIn", 0.0))
	for item: Variant in _list(d, "quests"):
		if item is Dictionary:
			o.quests.append(XomDaoQuest.from_dict(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["day"] = day
	d["endsIn"] = ends_in
	d["quests"] = _dicts(quests)
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
