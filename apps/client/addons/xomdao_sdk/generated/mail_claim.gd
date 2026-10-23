class_name XomDaoMailClaim
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var mailbox: XomDaoMailbox
var balances: Dictionary = {}


static func from_dict(d: Dictionary) -> XomDaoMailClaim:
	var o := XomDaoMailClaim.new()
	o.mailbox = XomDaoMailbox.from_dict(_dict(d, "mailbox"))
	o.balances = _dict(d, "balances")
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["mailbox"] = mailbox.to_dict()
	d["balances"] = balances
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
