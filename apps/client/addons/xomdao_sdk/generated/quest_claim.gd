class_name XomDaoQuestClaim
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var board: XomDaoQuestBoard
var balances: Dictionary = {}


static func from_dict(d: Dictionary) -> XomDaoQuestClaim:
	var o := XomDaoQuestClaim.new()
	o.board = XomDaoQuestBoard.from_dict(_dict(d, "board"))
	o.balances = _dict(d, "balances")
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["board"] = board.to_dict()
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
