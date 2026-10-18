extends RefCounted
## The words on Cờ tỷ phú's card: a square's price, rent and owner, and a trade offer.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const START_COIN := preload("res://content/co-ty-phu-classic/art/hud-money.svg")
const START_STAR := preload("res://addons/xomdao_sdk/ui/icons/star.svg")
const MONEY_GAIN_INK := Color("#FFD34E")
const MONEY_LOSS_INK := Color("#F05A43")
const SPECIAL_TEXT: Dictionary = {
	"start": "Đi qua nhận 200.",
	"tax": "Nộp %s hoặc 10%% tiền mặt, lấy số lớn hơn.",
	"chance": "Rút một thẻ Cơ hội.",
	"chest": "Rút một thẻ Khí vận.",
	"jail": "Chỉ ghé thăm. Người trong tù không thu tiền thuê.",
	"airport": "Bay tới một ô ngẫu nhiên.",
	"go-jail": "Vào tù ngay.",
}


## "Minh đưa: Hạ Long, 100 ₫ / Máy 1 đưa: không".
static func trade(offer: Dictionary, names: Array[String]) -> String:
	var give: Array[String] = _side(offer["give"], int(offer["giveCash"]), offer.get("giveCard"))
	var take: Array[String] = _side(offer["take"], int(offer["takeCash"]), offer.get("takeCard"))
	var from: int = int(offer["from"])
	var to: int = int(offer["to"])
	return "%s đưa: %s\n%s đưa: %s" % [names[from], ", ".join(give), names[to], ", ".join(take)]


static func _side(square: Variant, cash: int, card: Variant) -> Array[String]:
	var out: Array[String] = []
	if square != null:
		out.append(str(Rules.SQUARES[int(square)]["name"]))
	if cash > 0:
		out.append(XomDaoUi.money(cash) + " ₫")
	if card == true:
		out.append("vé ra tù")
	if out.is_empty():
		out.append("không")
	return out


static func square(view: Dictionary, i: int, names: Array[String]) -> String:
	var square: Dictionary = Rules.SQUARES[i]
	var kind: String = square["kind"]
	if not Rules.is_deed(i):
		var text: String = SPECIAL_TEXT.get(kind, "")
		return text % XomDaoUi.money(int(square["tax"])) if kind == "tax" else text
	var lines: Array[String] = []
	var deed: Dictionary = view["properties"][i]
	var owner: int = -1 if deed.get("owner") == null else int(deed["owner"])
	if kind == "station" and owner < 0:
		lines.append("Góp đầu %s ₫" % XomDaoUi.money(Rules.price(i)))
	else:
		lines.append("Giá mua %s ₫" % XomDaoUi.money(Rules.deed_price(view["properties"], i)))
	match kind:
		"street":
			var ladder: Array = square["rent"]
			lines.append(
				(
					"Thuê %s, khách sạn %s ₫"
					% [XomDaoUi.money(int(ladder[0])), XomDaoUi.money(int(ladder[5]))]
				)
			)
			lines.append("Xây %s ₫ mỗi lần" % XomDaoUi.money(int(square["houseCost"])))
		"station":
			lines.append("Thuê %d ₫ cho mỗi bến của chủ" % Rules.STATION_FEE)
			if owner < 0:
				lines.append(station_bids(view, i, names))
		"utility":
			lines.append("Thuê = tổng xúc xắc × 4, đủ bộ × 10")
	if owner < 0:
		lines.append("Chưa có chủ")
	else:
		var holding: String = "Chủ: %s" % names[owner]
		var houses: int = int(deed["houses"])
		if houses == 5:
			holding += " · khách sạn"
		elif houses > 0:
			holding += " · %d nhà" % houses
		lines.append(holding)
		if bool(deed["mortgaged"]):
			lines.append(Rules.mortgage_status(view, i))
		else:
			var current_rent: int = Rules.rent(view, i)
			var multiplier: int = Rules.rent_multiplier(view, i)
			var rent: int = current_rent / multiplier if current_rent > 0 else 0
			var rent_text: String = XomDaoUi.money(rent) + " ₫"
			if current_rent > 0 and multiplier > 1:
				rent_text += " ×%d" % multiplier
			lines.append("Thuê bây giờ %s" % rent_text)
	return "\n".join(lines)


static func station_bids(view: Dictionary, i: int, names: Array[String]) -> String:
	var auctions: Dictionary = view.get("stationAuctions", {})
	var auction: Variant = auctions.get(str(i), auctions.get(i))
	if auction is not Dictionary:
		return "Góp tiền khi dừng ở bến"
	var bids: Array = (auction as Dictionary)["bids"]
	var parts: Array[String] = []
	for seat: int in bids.size():
		if int(bids[seat]) > 0:
			parts.append("%s %s" % [names[seat], XomDaoUi.money(int(bids[seat]))])
	return "Đã góp: " + (", ".join(parts) if not parts.is_empty() else "chưa ai")


## The line over your actions: whose turn, the auction, what you owe.
static func status(view: Dictionary, me: int, names: Array[String]) -> String:
	var winner: Variant = view.get("winner")
	if winner != null:
		return "Bạn thắng!" if int(winner) == me else "%s thắng!" % names[int(winner)]
	var seat: int = Rules.decision_seat(view)
	var phase: String = view["phase"]
	if phase == "auction" and view.get("auction") is Dictionary:
		var auction: Dictionary = view["auction"]
		var name_of: String = Rules.SQUARES[int(auction["square"])]["name"]
		var highest: int = int(auction["highest"])
		return "%s: %s ₫" % [name_of, XomDaoUi.money(highest)] if highest > 0 else name_of
	if phase == "debt" and seat == me:
		return (
			"Thiếu %s ₫"
			% XomDaoUi.money(int(view["debt"]["amount"]) - int(view["players"][me]["cash"]))
		)
	if seat == me:
		return "Lượt bạn"
	return "Lượt %s" % names[seat]


## A large outlined label in `color`.
static func floater(text: String, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_outline_color", XomDaoUi.INK)
	label.add_theme_constant_override("outline_size", 8)
	return label


## Show a signed money change beside a player's pawn and float it upward.
static func float_money_change(layer: Control, pawn: Control, amount: int, seat: int) -> void:
	if amount == 0:
		return
	var label: Label = floater(XomDaoUi.delta(amount), money_change_color(amount))
	label.add_theme_font_size_override("font_size", 30)
	label.add_theme_constant_override("outline_size", 6)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	layer.add_child(label)
	label.reset_size()
	label.pivot_offset = label.size / 2.0
	label.scale = Vector2.ONE * 0.82
	var center: Vector2 = pawn.position + Vector2(pawn.size.x / 2.0, 0.0)
	var side: float = -5.0 if seat % 2 == 0 else 5.0
	var x: float = clampf(
		center.x + side - label.size.x / 2.0, 8.0, maxf(8.0, layer.size.x - label.size.x - 8.0)
	)
	var y: float = center.y - label.size.y - 2.0
	if y < 8.0:
		y = center.y + pawn.size.y + 2.0
	if y + label.size.y > layer.size.y - 8.0:
		y = center.y - label.size.y - 2.0
	y = clampf(y, 8.0, maxf(8.0, layer.size.y - label.size.y - 8.0))
	label.position = Vector2(x, y)
	var tween: Tween = label.create_tween().set_parallel()
	tween.tween_property(label, "position:y", y - 44.0, 1.05).set_trans(Tween.TRANS_CUBIC).set_ease(
		Tween.EASE_OUT
	)
	tween.tween_property(label, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)
	tween.tween_property(label, "modulate:a", 0.0, 0.4).set_delay(0.65)
	tween.chain().tween_callback(label.queue_free)


static func money_change_color(amount: int) -> Color:
	return MONEY_GAIN_INK if amount > 0 else MONEY_LOSS_INK


## Scatter coins and stars around a pawn when it receives a Start reward.
static func start_reward_burst(layer: Control, pawn: Control) -> void:
	var origin: Vector2 = pawn.position + pawn.size * Vector2(0.5, 0.36)
	_burst(
		layer,
		origin,
		START_COIN,
		8,
		0.86,
		150.0,
		Vector2(65.0, 155.0),
		165.0,
		Vector2(0.14, 0.22),
		Color.WHITE,
		420.0
	)
	_burst(
		layer,
		origin,
		START_STAR,
		10,
		0.68,
		175.0,
		Vector2(38.0, 135.0),
		110.0,
		Vector2(0.045, 0.075),
		Color("#FFF0A5"),
		180.0
	)


static func _burst(
	layer: Control,
	origin: Vector2,
	texture: Texture2D,
	amount: int,
	lifetime: float,
	spread: float,
	velocity: Vector2,
	gravity: float,
	particle_scale: Vector2,
	tint: Color,
	spin: float
) -> void:
	var particles := CPUParticles2D.new()
	particles.position = origin
	particles.texture = texture
	particles.amount = amount
	particles.lifetime = lifetime
	particles.one_shot = true
	particles.explosiveness = 0.94
	particles.direction = Vector2.UP
	particles.spread = spread
	particles.initial_velocity_min = velocity.x
	particles.initial_velocity_max = velocity.y
	particles.gravity = Vector2(0.0, gravity)
	particles.scale_amount_min = particle_scale.x
	particles.scale_amount_max = particle_scale.y
	particles.angular_velocity_min = -spin
	particles.angular_velocity_max = spin
	particles.color = tint
	particles.finished.connect(particles.queue_free, CONNECT_ONE_SHOT)
	layer.add_child(particles)
