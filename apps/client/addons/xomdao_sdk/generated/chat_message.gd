class_name XomDaoChatMessage
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var from: String = ""
var to: String = ""
var text: String = ""
var at: float = 0.0


static func from_dict(d: Dictionary) -> XomDaoChatMessage:
	var o := XomDaoChatMessage.new()
	o.id = str(d.get("id", ""))
	o.from = str(d.get("from", ""))
	o.to = str(d.get("to", ""))
	o.text = str(d.get("text", ""))
	o.at = float(d.get("at", 0.0))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["from"] = from
	d["to"] = to
	d["text"] = text
	d["at"] = at
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
