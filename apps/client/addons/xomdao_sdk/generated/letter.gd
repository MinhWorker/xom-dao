class_name XomDaoLetter
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var title: String = ""
var body: String = ""
var coins: float = 0.0
var sent_at: float = 0.0
var read: bool = false
var claimed: bool = false


static func from_dict(d: Dictionary) -> XomDaoLetter:
	var o := XomDaoLetter.new()
	o.id = str(d.get("id", ""))
	o.title = str(d.get("title", ""))
	o.body = str(d.get("body", ""))
	o.coins = float(d.get("coins", 0.0))
	o.sent_at = float(d.get("sentAt", 0.0))
	o.read = bool(d.get("read", false))
	o.claimed = bool(d.get("claimed", false))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["title"] = title
	d["body"] = body
	d["coins"] = coins
	d["sentAt"] = sent_at
	d["read"] = read
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
