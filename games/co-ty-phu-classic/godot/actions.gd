extends RefCounted
## What Cờ tỷ phú offers you now, from the view alone (after the old board's tileActions): the
## phase's buttons in the field, a deed's buttons on its card, and whether you may mortgage.
## Each action is [node name, label, enabled]; an empty label keeps the button's own.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const FIELD_BUTTONS: Array = [
	["Bail", "Nộp 50", "pay-bail", XomDaoUi.Kind.SOCIAL],
	["UseCard", "Dùng thẻ", "use-card", XomDaoUi.Kind.SOCIAL],
	["Buy", "Mua", "buy", XomDaoUi.Kind.CONFIRM],
	["Skip", "Bỏ qua", "end-turn", XomDaoUi.Kind.BACK],
	["Build", "Xây", "build", XomDaoUi.Kind.CONFIRM],
	["SkipBuild", "Bỏ qua", "skip-build", XomDaoUi.Kind.BACK],
	["EndTurn", "Hết lượt", "end-turn", XomDaoUi.Kind.BACK],
	["PayDebt", "Trả nợ", "pay-debt", XomDaoUi.Kind.CONFIRM],
	["Bankrupt", "Phá sản", "bankrupt", XomDaoUi.Kind.DANGER],
]
const CARD_BUTTONS: Array = [
	["Confirm", "Xác nhận", "confirm-event", XomDaoUi.Kind.GO],
	["Mortgage", "Thế chấp", "mortgage", XomDaoUi.Kind.SOCIAL],
	["Redeem", "Chuộc", "redeem", XomDaoUi.Kind.CONFIRM],
	["SellHouse", "Bán nhà", "sell-house", XomDaoUi.Kind.SOCIAL],
]


## The field's buttons when the room waits on `me`: the dice, buying, the end of the turn or a debt.
static func phase_actions(view: Dictionary, me: int) -> Array:
	var out: Array = []
	if me < 0 or view.get("winner") != null or Rules.decision_seat(view) != me:
		return out
	var player: Dictionary = view["players"][me]
	var cash: int = int(player["cash"])
	match str(view["phase"]):
		"roll":
			var final_jail_turn: bool = (
				bool(player["jailed"]) and int(player.get("jailRolls", 0)) >= 2
			)
			out.append(["Roll", "", true])
			var build: Array = _build(view, me, cash)
			out.append_array(build)
			if not build.is_empty():
				out.append(["SkipBuild", "", true])
			if bool(player["jailed"]) and not final_jail_turn:
				out.append(["Bail", "Nộp %d" % Rules.BAIL, cash >= Rules.BAIL])
				if not (player["freeCards"] as Array).is_empty():
					out.append(["UseCard", "", true])
		"buy":
			var price: int = Rules.price(int(view["pending"]))
			out.append(["Buy", "Mua %s" % XomDaoUi.money(price), cash >= price])
			out.append(["Skip", "", true])
		"end":
			out.append_array(_build(view, me, cash))
			out.append(["EndTurn", "", true])
		"debt":
			var amount: int = int(view["debt"]["amount"])
			out.append(["PayDebt", "Trả %s" % XomDaoUi.money(amount), cash >= amount])
			if cash < amount:
				out.append(["Bankrupt", "", true])
	return out


static func _build(view: Dictionary, me: int, cash: int) -> Array:
	var square: Variant = view.get("buildable")
	if square == null or int(view["players"][me]["position"]) != int(square):
		return []
	var i: int = int(square)
	var properties: Array = view["properties"]
	var deed: Dictionary = properties[i]
	var houses: int = int(deed["houses"])
	if houses >= 5 or bool(deed["mortgaged"]) or deed.get("owner") == null:
		return []
	if int(deed["owner"]) != me:
		return []
	var cost: int = int(Rules.SQUARES[i]["houseCost"])
	var what: String = "khách sạn" if houses == 4 else "nhà"
	return [["Build", "Xây %s %s" % [what, XomDaoUi.money(cost)], cash >= cost]]


## Bán nhà, Chuộc and Thế chấp for your own deed `i`, when the rules allow them now.
static func deed_actions(view: Dictionary, me: int, i: int) -> Array:
	var out: Array = []
	var phase: String = view["phase"]
	if me < 0 or view.get("winner") != null or phase in ["event", "trade"]:
		return out
	var properties: Array = view["properties"]
	var deed: Dictionary = properties[i]
	if not Rules.is_deed(i) or deed.get("owner") == null or int(deed["owner"]) != me:
		return out
	var cash: int = int(view["players"][me]["cash"])
	var houses: int = int(deed["houses"])
	if houses > 0 and not bool(deed["mortgaged"]):
		var house_cost: int = int(Rules.SQUARES[i]["houseCost"])
		out.append(
			[
				"SellHouse",
				"Bán nhà +%s" % XomDaoUi.money(Rules.building_sale_price(house_cost)),
				true
			]
		)
	if Rules.decision_seat(view) != me:
		return out
	if bool(deed["mortgaged"]):
		var cost: int = Rules.redeem_amount(properties, i)
		out.append(["Redeem", "Chuộc %s" % XomDaoUi.money(cost), cash >= cost])
	elif houses == 0:
		var amount: int = Rules.mortgage_amount(properties, i)
		out.append(["Mortgage", "Thế chấp +%s" % XomDaoUi.money(amount), true])
	return out


## Whether `me` may mortgage now (`requireManagement`): on your turn, or while the room waits on
## your debt, with a deed not mortgaged yet.
static func may_mortgage(view: Dictionary, me: int) -> bool:
	if me < 0 or view.get("winner") != null:
		return false
	if not str(view["phase"]) in ["roll", "buy", "debt", "end"]:
		return false
	if Rules.decision_seat(view) != me or bool(view["players"][me]["bankrupt"]):
		return false
	return not Rules.mortgage_squares(view["properties"], me).is_empty()
