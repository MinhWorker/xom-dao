extends RefCounted
## Cờ tỷ phú Classic's board and the sums the table shows, copied from the TypeScript rules:
## the squares from `BOARD` in src/game/model.ts, rent and mortgage sums from src/game/rules.ts,
## who decides from src/game/turnClock.ts. Square corners and the panel come from the geometry
## sources/render_board_25d.py writes with board-25d.webp.

const STARTING_CASH := 1000
const STATION_STEP := 50
const STATION_FEE := 50
const BAIL := 50
const STATIONS: Array[int] = [5, 15, 25, 35]
const UTILITIES: Array[int] = [12, 28]
const SQUARES: Array[Dictionary] = [
	{"name": "Xuất phát", "kind": "start"},
	{
		"name": "Phú Quốc",
		"kind": "street",
		"price": 200,
		"group": "nau",
		"rent": [20, 80, 220, 600, 800, 1000],
		"houseCost": 100
	},
	{
		"name": "Lào Cai",
		"kind": "street",
		"price": 150,
		"group": "nau",
		"rent": [15, 60, 165, 450, 600, 750],
		"houseCost": 75
	},
	{
		"name": "Việt Trì",
		"kind": "street",
		"price": 180,
		"group": "nau",
		"rent": [18, 72, 198, 540, 720, 900],
		"houseCost": 90
	},
	{"name": "Thuế thu nhập", "kind": "tax", "tax": 100},
	{"name": "Bến Bắc", "kind": "station", "price": 200},
	{
		"name": "Hạ Long",
		"kind": "street",
		"price": 280,
		"group": "xanh-nhat",
		"rent": [28, 112, 308, 840, 1120, 1400],
		"houseCost": 140
	},
	{"name": "Cơ hội", "kind": "chance"},
	{
		"name": "Hải Phòng",
		"kind": "street",
		"price": 320,
		"group": "xanh-nhat",
		"rent": [32, 128, 352, 960, 1280, 1600],
		"houseCost": 160
	},
	{
		"name": "Hà Nội",
		"kind": "street",
		"price": 350,
		"group": "xanh-nhat",
		"rent": [35, 140, 385, 1050, 1400, 1750],
		"houseCost": 175
	},
	{"name": "Nhà tù", "kind": "jail"},
	{
		"name": "Hải Dương",
		"kind": "street",
		"price": 220,
		"group": "hong",
		"rent": [22, 88, 242, 660, 880, 1100],
		"houseCost": 110
	},
	{"name": "Điện lực", "kind": "utility", "price": 150},
	{
		"name": "Thái Bình",
		"kind": "street",
		"price": 260,
		"group": "hong",
		"rent": [26, 104, 286, 780, 1040, 1300],
		"houseCost": 130
	},
	{
		"name": "Nam Định",
		"kind": "street",
		"price": 240,
		"group": "hong",
		"rent": [24, 96, 264, 720, 960, 1200],
		"houseCost": 120
	},
	{"name": "Bến Tây", "kind": "station", "price": 200},
	{
		"name": "Thanh Hóa",
		"kind": "street",
		"price": 270,
		"group": "cam",
		"rent": [27, 108, 297, 810, 1080, 1350],
		"houseCost": 135
	},
	{"name": "Khí vận", "kind": "chest"},
	{
		"name": "Vinh",
		"kind": "street",
		"price": 260,
		"group": "cam",
		"rent": [26, 104, 286, 780, 1040, 1300],
		"houseCost": 130
	},
	{
		"name": "Hà Tĩnh",
		"kind": "street",
		"price": 170,
		"group": "cam",
		"rent": [17, 68, 187, 510, 680, 850],
		"houseCost": 85
	},
	{"name": "Sân bay", "kind": "airport"},
	{
		"name": "Huế",
		"kind": "street",
		"price": 270,
		"group": "do",
		"rent": [27, 108, 297, 810, 1080, 1350],
		"houseCost": 135
	},
	{"name": "Cơ hội", "kind": "chance"},
	{
		"name": "Đà Nẵng",
		"kind": "street",
		"price": 300,
		"group": "do",
		"rent": [30, 120, 330, 900, 1200, 1500],
		"houseCost": 150
	},
	{
		"name": "Hội An",
		"kind": "street",
		"price": 250,
		"group": "do",
		"rent": [25, 100, 275, 750, 1000, 1250],
		"houseCost": 125
	},
	{"name": "Bến Nam", "kind": "station", "price": 200},
	{
		"name": "Kon Tum",
		"kind": "street",
		"price": 140,
		"group": "vang",
		"rent": [14, 56, 154, 420, 560, 700],
		"houseCost": 70
	},
	{
		"name": "Pleiku",
		"kind": "street",
		"price": 160,
		"group": "vang",
		"rent": [16, 64, 176, 480, 640, 800],
		"houseCost": 80
	},
	{"name": "Cấp nước", "kind": "utility", "price": 150},
	{
		"name": "Đà Lạt",
		"kind": "street",
		"price": 270,
		"group": "vang",
		"rent": [27, 108, 297, 810, 1080, 1350],
		"houseCost": 135
	},
	{"name": "Vào tù", "kind": "go-jail"},
	{
		"name": "Nha Trang",
		"kind": "street",
		"price": 280,
		"group": "xanh-la",
		"rent": [28, 112, 308, 840, 1120, 1400],
		"houseCost": 140
	},
	{
		"name": "Vũng Tàu",
		"kind": "street",
		"price": 260,
		"group": "xanh-la",
		"rent": [26, 104, 286, 780, 1040, 1300],
		"houseCost": 130
	},
	{"name": "Khí vận", "kind": "chest"},
	{
		"name": "Biên Hòa",
		"kind": "street",
		"price": 220,
		"group": "xanh-la",
		"rent": [22, 88, 242, 660, 880, 1100],
		"houseCost": 110
	},
	{"name": "Bến Đông", "kind": "station", "price": 200},
	{
		"name": "Tp. HCM",
		"kind": "street",
		"price": 350,
		"group": "xanh-dam",
		"rent": [35, 140, 385, 1050, 1400, 1750],
		"houseCost": 175
	},
	{
		"name": "Cần Thơ",
		"kind": "street",
		"price": 300,
		"group": "xanh-dam",
		"rent": [30, 120, 330, 900, 1200, 1500],
		"houseCost": 150
	},
	{"name": "Thuế xa xỉ", "kind": "tax", "tax": 200},
	{
		"name": "Cà Mau",
		"kind": "street",
		"price": 180,
		"group": "xanh-dam",
		"rent": [18, 72, 198, 540, 720, 900],
		"houseCost": 90
	},
]
const GROUP_COLORS: Dictionary = {
	"nau": Color("#434959"),
	"xanh-nhat": Color("#73dde7"),
	"hong": Color("#b94dd6"),
	"cam": Color("#7451c7"),
	"do": Color("#c3288e"),
	"vang": Color("#77717d"),
	"xanh-la": Color("#673c91"),
	"xanh-dam": Color("#176578"),
}
## Board coordinates come from the same Blender render as the board image.
const Geometry := preload("res://content/co-ty-phu-classic/board_geometry.gd")
const CELLS: Array = Geometry.CELLS
const IMAGE_RATIO: float = Geometry.IMAGE_RATIO
const HOMOGRAPHY: Array[float] = Geometry.HOMOGRAPHY
const PANEL_AVATAR: Vector3 = Geometry.PANEL_AVATAR
const PANEL_NAME: Vector2 = Geometry.PANEL_NAME
const PANEL_CASH: Vector2 = Geometry.PANEL_CASH
const FIELD: Rect2 = Geometry.FIELD


## A point of the printed board (board units) on board-25d.webp (fractions of its size).
static func plane_point(at: Vector2) -> Vector2:
	var h: Array[float] = HOMOGRAPHY
	var w: float = h[6] * at.x + h[7] * at.y + h[8]
	return Vector2((h[0] * at.x + h[1] * at.y + h[2]) / w, (h[3] * at.x + h[4] * at.y + h[5]) / w)


## A point inside square `i` (u across it, v down it, both 0–1), on board-25d.webp.
static func cell_point(i: int, u: float, v: float) -> Vector2:
	var q: Array = CELLS[i]
	var a: Vector2 = q[0]
	var b: Vector2 = q[1]
	var c: Vector2 = q[2]
	var d: Vector2 = q[3]
	return a * (1.0 - u) * (1.0 - v) + b * u * (1.0 - v) + c * u * v + d * (1.0 - u) * v


static func is_deed(i: int) -> bool:
	return SQUARES[i]["kind"] in ["street", "station", "utility"]


static func price(i: int) -> int:
	return int(SQUARES[i].get("price", 0))


static func group_of(i: int) -> Array[int]:
	var out: Array[int] = []
	var group: String = str(SQUARES[i].get("group", ""))
	if group == "":
		return out
	for j: int in SQUARES.size():
		if SQUARES[j].get("group", "") == group:
			out.append(j)
	return out


static func owns_group(properties: Array, owner: int, i: int) -> bool:
	var squares: Array[int] = group_of(i)
	if squares.is_empty():
		return false
	for j: int in squares:
		if _owner(properties, j) != owner:
			return false
	return true


static func rent_multiplier(view: Dictionary, i: int) -> int:
	if SQUARES[i]["kind"] != "street":
		return 1
	var properties: Array = view["properties"]
	var owner: int = _owner(properties, i)
	if owner < 0:
		return 1
	var group: Array[int] = group_of(i)
	if owns_group(properties, owner, i):
		return group.size()
	var position: int = group.find(i)
	for neighbor_position: int in [position - 1, position + 1]:
		if (
			neighbor_position >= 0
			and neighbor_position < group.size()
			and _owner(properties, group[neighbor_position]) == owner
		):
			return 2
	return 1


static func _owner(properties: Array, i: int) -> int:
	var owner: Variant = (properties[i] as Dictionary).get("owner")
	return -1 if owner == null else int(owner)


## What landing on `i` costs right now (`rent`), with `roll` for a utility.
static func rent(view: Dictionary, i: int, roll: int = 7) -> int:
	var properties: Array = view["properties"]
	var deed: Dictionary = properties[i]
	var owner: int = _owner(properties, i)
	if owner < 0 or bool(deed["mortgaged"]) or bool(view["players"][owner]["jailed"]):
		return 0
	var kind: String = SQUARES[i]["kind"]
	if kind == "station":
		var count: int = 0
		for j: int in STATIONS:
			count += 1 if _owner(properties, j) == owner else 0
		return STATION_FEE * count
	if kind == "utility":
		return roll * utility_multiplier(view, i)
	var ladder: Array = SQUARES[i]["rent"]
	return int(ladder[int(deed["houses"])]) * rent_multiplier(view, i)


static func utility_multiplier(view: Dictionary, i: int) -> int:
	var properties: Array = view["properties"]
	var owner: int = _owner(properties, i)
	if owner < 0:
		return 0
	var both: bool = (
		_owner(properties, UTILITIES[0]) == owner and _owner(properties, UTILITIES[1]) == owner
	)
	var shortage: bool = false
	for event: Variant in view.get("shortages", []):
		var e: Dictionary = event
		shortage = shortage or (int(e["square"]) == i and int(e["round"]) == int(view["round"]))
	return (10 if both else 4) * (2 if shortage else 1)


static func mortgage_amount(properties: Array, i: int) -> int:
	var deed: Dictionary = properties[i]
	return int((price(i) + int(deed["houses"]) * int(SQUARES[i].get("houseCost", 0))) / 2.0)


static func redeem_amount(properties: Array, i: int) -> int:
	var deed: Dictionary = properties[i]
	var principal: int = mortgage_amount(properties, i)
	if deed.get("mortgage") is Dictionary:
		principal = int(deed["mortgage"]["principal"])
	return ceili(principal * 11 / 10.0)


## The deeds `seat` may mortgage now: its own, not mortgaged yet (`mortgageSquares`).
static func mortgage_squares(properties: Array, seat: int) -> Array[int]:
	var out: Array[int] = []
	for i: int in properties.size():
		if is_deed(i) and _owner(properties, i) == seat and not bool(properties[i]["mortgaged"]):
			out.append(i)
	return out


## What a player is worth: cash, jail tickets at 200, deeds and buildings less what redeeming the
## mortgaged ones costs (`assetValue`).
static func asset_value(view: Dictionary, seat: int) -> int:
	var properties: Array = view["properties"]
	var player: Dictionary = view["players"][seat]
	var total: int = int(player["cash"]) + (player["freeCards"] as Array).size() * 200
	for i: int in properties.size():
		if _owner(properties, i) != seat:
			continue
		var deed: Dictionary = properties[i]
		total += price(i) + int(deed["houses"]) * int(SQUARES[i].get("houseCost", 0))
		if bool(deed["mortgaged"]):
			total -= redeem_amount(properties, i)
	return total


static func bank_houses(properties: Array) -> int:
	var used: int = 0
	for deed: Variant in properties:
		var houses: int = int((deed as Dictionary)["houses"])
		used += 0 if houses == 5 else houses
	return 32 - used


static func bank_hotels(properties: Array) -> int:
	var used: int = 0
	for deed: Variant in properties:
		used += 1 if int((deed as Dictionary)["houses"]) == 5 else 0
	return 12 - used


## "Chuộc: còn 2 lượt" (`mortgageStatus`).
static func mortgage_status(view: Dictionary, i: int) -> String:
	var deed: Dictionary = view["properties"][i]
	if deed.get("mortgage") is not Dictionary:
		return "Đang thế chấp"
	var borrower: int = int(deed["mortgage"]["borrower"])
	var remaining: int = int(deed["mortgage"]["deadline"]) - int(view["playerTurns"][borrower])
	var left: int = remaining + (1 if int(view["turn"]) == borrower and remaining < 3 else 0)
	return "Chuộc: hết lượt này" if remaining <= 0 else "Chuộc: còn %d lượt" % left


## Whose decision the room waits on (`decisionSeat`).
static func decision_seat(view: Dictionary) -> int:
	var phase: String = view["phase"]
	if phase == "auction" and view.get("auction") is Dictionary:
		return int(view["auction"]["bidder"])
	if phase == "trade" and view.get("trade") is Dictionary:
		return int(view["trade"]["to"])
	if phase == "debt" and view.get("debt") is Dictionary and view["debt"].get("payer") != null:
		return int(view["debt"]["payer"])
	return int(view["turn"])


## What the Bid button offers: the next contribution at this station.
static func bid_amount(view: Dictionary) -> int:
	var auction: Dictionary = view["auction"]
	return int(auction["highest"]) + STATION_STEP


## Each seat's net change over a view's money transfers ({seat: amount}).
static func net_changes(transfers: Array) -> Dictionary:
	var net: Dictionary = {}
	for item: Variant in transfers:
		var transfer: Dictionary = item
		var amount: int = int(transfer["amount"])
		if transfer.get("from") != null:
			net[int(transfer["from"])] = int(net.get(int(transfer["from"]), 0)) - amount
		if transfer.get("to") != null:
			net[int(transfer["to"])] = int(net.get(int(transfer["to"]), 0)) + amount
	return net


## The sound of a view's money: rent, a purchase, or coins.
static func money_sound(transfers: Array) -> String:
	var sound: String = "coin"
	for item: Variant in transfers:
		var reason: String = str((item as Dictionary).get("reason", ""))
		if reason.begins_with("Tiền thuê"):
			return "rent"
		if reason.begins_with("Mua"):
			sound = "buy"
	return sound
