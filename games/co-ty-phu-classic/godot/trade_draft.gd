extends RefCounted
## One editable offer. The server remains authoritative for ownership and payment.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")

var partner: int = -1
var give: int = -1
var take: int = -1
var give_cash: int = 0
var take_cash: int = 0
var pending: bool = false


func reset() -> void:
	give = -1
	take = -1
	give_cash = 0
	take_cash = 0


func choose(side: int, square: int) -> void:
	if pending:
		return
	if square == -2:
		var already: bool = (give if side == 0 else take) == -2
		reset()
		if already:
			return
		give = -2 if side == 0 else -1
		take = -2 if side == 1 else -1
		give_cash = 200 if side == 1 else 0
		take_cash = 200 if side == 0 else 0
		return
	if give == -2 or take == -2:
		reset()
	if side == 0:
		give = -1 if give == square else square
	else:
		take = -1 if take == square else square

	quote()


func quote() -> void:
	var value: int = (
		(Rules.price(take) if take >= 0 else 0) - (Rules.price(give) if give >= 0 else 0)
	)
	give_cash = maxi(0, value)
	take_cash = maxi(0, -value)


func observe(trade: Variant) -> void:
	if trade is Dictionary:
		pending = true
		partner = int(trade["to"])
		give = (
			-2
			if bool(trade.get("giveCard", false))
			else (-1 if trade.get("give") == null else int(trade["give"]))
		)
		take = (
			-2
			if bool(trade.get("takeCard", false))
			else (-1 if trade.get("take") == null else int(trade["take"]))
		)
		give_cash = int(trade["giveCash"])
		take_cash = int(trade["takeCash"])
	elif pending:
		pending = false
		reset()


func payload() -> Dictionary:
	return {"to": partner, "give": give, "take": take, "giveCash": give_cash, "takeCash": take_cash}


func valid(view: Dictionary, me: int) -> bool:
	var players: Array = view.get("players", [])
	if pending or me < 0 or partner < 0 or partner >= players.size() or partner == me:
		return false
	if bool(players[partner]["bankrupt"]) or bool(players[me]["bankrupt"]):
		return false
	if give == -1 and take == -1 and give_cash == 0 and take_cash == 0:
		return false
	if give_cash > int(players[me]["cash"]) or take_cash > int(players[partner]["cash"]):
		return false
	for side: int in 2:
		var square: int = give if side == 0 else take
		var seat: int = me if side == 0 else partner
		if not _item_valid(view, seat, square):
			return false
	return int(view["turn"]) == me and str(view["phase"]) in ["roll", "buy", "end"]


func _item_valid(view: Dictionary, seat: int, square: int) -> bool:
	if square == -2:
		return not (view["players"][seat]["freeCards"] as Array).is_empty()
	if square < 0:
		return true
	var deed: Dictionary = view["properties"][square]
	return deed.get("owner") == seat and int(deed["houses"]) == 0
