extends RefCounted
## Fixed POV slots, numeric totals, conditional statuses and simultaneous transfer balances.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const BANK := Vector2(0.525, 0.275)
const LOCAL := Rect2(0.191, 0.193, 0.25, 0.163)
const NUMBERS: Array[String] = ["land", "houses", "hotels", "stations"]
const STATES: Array[String] = ["jail", "power", "water", "tickets"]


static func seats(viewer: int, count: int) -> Array[int]:
	if count <= 0:
		return []
	var local: int = viewer if viewer >= 0 and viewer < count else 0
	var out: Array[int] = [local]
	for seat: int in count:
		if seat != local:
			out.append(seat)
	return out


static func slot(index: int) -> Rect2:
	return LOCAL if index == 0 else Rect2(0.611, 0.193 + (index - 1) * 0.055, 0.199, 0.053)


static func endpoint(transfer: Dictionary, key: String) -> int:
	return -1 if transfer.get(key) == null else int(transfer[key])


static func delta(transfer: Dictionary, seat: int) -> int:
	var amount: int = int(transfer.get("amount", 0))
	return (
		(amount if endpoint(transfer, "to") == seat else 0)
		- (amount if endpoint(transfer, "from") == seat else 0)
	)


static func balance(cash: Array[int], transfer: Dictionary, seat: int, progress: float) -> int:
	return cash[seat] + roundi(delta(transfer, seat) * smoothstep(0.22, 0.90, progress))


static func summary(view: Dictionary, seat: int) -> Dictionary:
	var out: Dictionary = {"land": 0, "houses": 0, "hotels": 0, "stations": 0}
	var properties: Array = view.get("properties", [])
	for i: int in mini(properties.size(), Rules.SQUARES.size()):
		var deed: Dictionary = properties[i]
		if deed.get("owner") == null or int(deed["owner"]) != seat:
			continue
		match str(Rules.SQUARES[i]["kind"]):
			"street":
				out["land"] += 1
				var buildings: int = int(deed.get("houses", 0))
				out["houses"] += buildings if buildings < 5 else 0
				out["hotels"] += 1 if buildings == 5 else 0
			"station":
				out["stations"] += 1
			"utility":
				out["power" if i == 12 else "water"] = 1
	var players: Array = view.get("players", [])
	if seat < players.size():
		var player: Dictionary = players[seat]
		if bool(player.get("jailed", false)):
			out["jail"] = maxi(0, 3 - int(player.get("jailRolls", 0)))
		var tickets: int = (player.get("freeCards", []) as Array).size()
		if tickets > 0:
			out["tickets"] = tickets
	return out


static func countdown_path(bounds: Rect2, fraction: float) -> PackedVector2Array:
	var a: Vector2 = bounds.position
	var b: Vector2 = bounds.end
	var cut: float = 0.003
	var corners := PackedVector2Array(
		[
			Vector2(bounds.get_center().x, a.y),
			Vector2(b.x - cut, a.y),
			Vector2(b.x, a.y + cut),
			Vector2(b.x, b.y - cut),
			Vector2(b.x - cut, b.y),
			Vector2(a.x + cut, b.y),
			Vector2(a.x, b.y - cut),
			Vector2(a.x, a.y + cut),
			Vector2(a.x + cut, a.y),
			Vector2(bounds.get_center().x, a.y)
		]
	)
	var length: float = 0.0
	for i: int in range(1, corners.size()):
		length += corners[i - 1].distance_to(corners[i])
	var left: float = clampf(fraction, 0.0, 1.0) * length
	var path := PackedVector2Array([corners[0]])
	for i: int in range(1, corners.size()):
		var segment: float = corners[i - 1].distance_to(corners[i])
		if left < segment:
			path.append(corners[i - 1].lerp(corners[i], left / segment))
			break
		path.append(corners[i])
		left -= segment
	return path
