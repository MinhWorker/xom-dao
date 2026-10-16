extends RefCounted
## Permanent set colors and joined, static ownership frames. Never cross a foreign tile.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const INKS: Dictionary = {
	"nau": Color("#434959"),
	"xanh-nhat": Color("#73DDE7"),
	"hong": Color("#B94DD6"),
	"cam": Color("#7451C7"),
	"do": Color("#C3288E"),
	"vang": Color("#77717D"),
	"xanh-la": Color("#673C91"),
	"xanh-dam": Color("#176578"),
}


static func frames(properties: Array) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for group: String in INKS:
		var owners: Dictionary = {}
		for i: int in Rules.SQUARES.size():
			if Rules.SQUARES[i].get("group", "") != group:
				continue
			var held: Variant = properties[i].get("owner")
			if held != null:
				var seat: int = int(held)
				if not owners.has(seat):
					owners[seat] = []
				(owners[seat] as Array).append(i)
		for seat: int in owners:
			var held: Array = owners[seat]
			if held.size() < 2:
				continue
			var run: Array[int] = []
			for square: int in held:
				if not run.is_empty() and square != run[-1] + 1:
					result.append(_frame(group, held.size() == 3, run))
					run = []
				run.append(square)
			result.append(_frame(group, held.size() == 3, run))
	return result


static func _frame(group: String, complete: bool, squares: Array[int]) -> Dictionary:
	return {"group": group, "complete": complete, "squares": squares.duplicate()}


static func outline(squares: Array[int], board_size: Vector2) -> PackedVector2Array:
	var first: Array = Rules.CELLS[squares[0]]
	var last: Array = Rules.CELLS[squares[-1]]
	var points: PackedVector2Array
	var square: int = squares[0]
	if square < 10:
		points = PackedVector2Array([last[0], first[1], first[2], last[3]])
	elif square < 20:
		points = PackedVector2Array([last[0], last[1], first[2], first[3]])
	elif square < 30:
		points = PackedVector2Array([first[0], last[1], last[2], first[3]])
	else:
		points = PackedVector2Array([first[0], first[1], last[2], last[3]])
	var center: Vector2 = (points[0] + points[1] + points[2] + points[3]) / 4.0
	for i: int in points.size():
		points[i] = (center + (points[i] - center) * 0.95) * board_size
	points.append(points[0])
	return points
