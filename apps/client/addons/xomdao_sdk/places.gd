class_name XomDaoPlaces
extends RefCounted
## Places and words for the end of a game scored in points (card tables): who placed where for
## the hub's result board, and what the end beat says from your side.
##
##   var detail := XomDaoPlaces.by_points(snapshot, points, left)   # {ranks, scores}
##   var outcome := XomDaoPlaces.outcome(snapshot, client.player_id)  # "win", "lose", …
##   var words := XomDaoPlaces.words(outcome, ["Máy 1"], 20)          # [headline, line]


## Everyone placed by points, for `result_detail()`: `ranks` ({player id: rank}: level points
## share a place, a seat in `left` comes after everyone still at the table, 0 for all in a draw)
## and `scores` ({player id: "12 điểm"}).
static func by_points(snapshot: XomDaoRoomSnapshot, points: Array, left: Array) -> Dictionary:
	var winners: Array[String] = snapshot.result.winners if snapshot.result != null else []
	var ranks: Dictionary = {}
	var scores: Dictionary = {}
	var seated: Array[XomDaoPlayerInfo] = _seated(snapshot)
	for seat: int in mini(points.size(), seated.size()):
		var gone: bool = left.has(seat) or left.has(float(seat))
		var above: int = 0
		for other: int in points.size():
			var other_gone: bool = left.has(other) or left.has(float(other))
			if other_gone and not gone:
				continue
			if (not other_gone and gone) or int(points[other]) > int(points[seat]):
				above += 1
		var id: String = seated[seat].id
		ranks[id] = 0 if winners.is_empty() else above + 1
		scores[id] = "%d điểm" % int(points[seat])
	return {"ranks": ranks, "scores": scores}


## How the game ended for `player_id`: "win", "lose", "draw" or "watch" (not seated).
static func outcome(snapshot: XomDaoRoomSnapshot, player_id: String) -> String:
	var winners: Array[String] = snapshot.result.winners if snapshot.result != null else []
	if winners.is_empty():
		return "draw"
	for seat: XomDaoPlayerInfo in _seated(snapshot):
		if seat.id == player_id:
			return "win" if winners.has(player_id) else "lose"
	return "watch"


## The end beat's headline and line: "Thắng rồi!" / "Nhiều điểm nhất, 20 điểm", "Thua rồi" /
## "Máy 1 nhiều điểm nhất, 20 điểm", "Hoà" / "Cả bàn bằng điểm", or "Máy 1 thắng" / "20 điểm"
## for someone watching. `names`: the winners' names; `best`: their points.
static func words(how: String, names: Array[String], best: int) -> Array[String]:
	var who: String = " và ".join(names)
	match how:
		"win":
			return ["Thắng rồi!", "Nhiều điểm nhất, %d điểm" % best]
		"lose":
			return ["Thua rồi", "%s nhiều điểm nhất, %d điểm" % [who, best]]
		"watch":
			return ["%s thắng" % who, "%d điểm" % best]
	return ["Hoà", "Cả bàn bằng điểm"]


## The seats in seat order (the room's players when it has no seats).
static func _seated(snapshot: XomDaoRoomSnapshot) -> Array[XomDaoPlayerInfo]:
	return snapshot.seats if not snapshot.seats.is_empty() else snapshot.players
