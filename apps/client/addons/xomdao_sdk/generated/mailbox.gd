class_name XomDaoMailbox
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var letters: Array[XomDaoLetter] = []
var waiting: float = 0.0


static func from_dict(d: Dictionary) -> XomDaoMailbox:
	var o := XomDaoMailbox.new()
	for item: Variant in _list(d, "letters"):
		if item is Dictionary:
			o.letters.append(XomDaoLetter.from_dict(item))
	o.waiting = float(d.get("waiting", 0.0))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["letters"] = _dicts(letters)
	d["waiting"] = waiting
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
