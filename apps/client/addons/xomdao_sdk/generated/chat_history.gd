class_name XomDaoChatHistory
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var user_id: String = ""
var messages: Array[XomDaoChatMessage] = []


static func from_dict(d: Dictionary) -> XomDaoChatHistory:
	var o := XomDaoChatHistory.new()
	o.user_id = str(d.get("userId", ""))
	for item: Variant in _list(d, "messages"):
		if item is Dictionary:
			o.messages.append(XomDaoChatMessage.from_dict(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["userId"] = user_id
	d["messages"] = _dicts(messages)
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
