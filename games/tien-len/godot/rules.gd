extends RefCounted
## The card rules the table needs on screen, ported from `server/game/cards.ts`: the server
## decides, this only enables Đánh and picks the sound and words of a play. A card is 0-51:
## `rank * 4 + suit`, rank 0-12 = 3 ... A 2, suit 0-3 = spade, club, diamond, heart.

const RANKS: Array[String] = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"]
## The rank of 2 ("heo").
const TWO := 12


static func rank_of(card: int) -> int:
	return card / 4


static func suit_of(card: int) -> int:
	return card % 4


static func is_red(card: int) -> bool:
	return card % 4 >= 2


## What these cards make: `{kind, size, top}`, or `{}` when they are no combination. Kinds:
## single, pair, triple, quad, straight (3+ ranks in a row, no 2), pairs (3+ pairs in a row).
static func combo_of(cards: Array) -> Dictionary:
	var sorted: Array[int] = []
	for card: Variant in cards:
		if sorted.has(int(card)):
			return {}
		sorted.append(int(card))
	sorted.sort()
	var size := sorted.size()
	if size == 0:
		return {}
	var top: int = sorted[size - 1]
	var ranks: Array[int] = []
	for card: int in sorted:
		ranks.append(rank_of(card))
	if size == 1:
		return {"kind": "single", "size": 1, "top": top}
	if ranks.all(func(r: int) -> bool: return r == ranks[0]) and size <= 4:
		return {"kind": ["pair", "triple", "quad"][size - 2], "size": size, "top": top}
	if ranks.has(TWO):
		return {}
	if size >= 3 and _in_row(ranks, 1):
		return {"kind": "straight", "size": size, "top": top}
	if size >= 6 and size % 2 == 0 and _in_row(ranks, 2):
		return {"kind": "pairs", "size": size, "top": top}
	return {}


## Whether `play` may go on `table` (`{}` for a new trick: anything goes).
static func beats(play: Dictionary, table: Dictionary) -> bool:
	if play.is_empty():
		return false
	if table.is_empty():
		return true
	if play["kind"] == table["kind"] and play["size"] == table["size"]:
		return int(play["top"]) > int(table["top"])
	var twos: bool = (
		rank_of(int(table["top"])) == TWO and (table["kind"] == "single" or table["kind"] == "pair")
	)
	var mine := _pairs(play)
	var theirs := _pairs(table)
	if mine == 3:
		return twos and table["kind"] == "single"
	if play["kind"] == "quad":
		return twos or theirs == 3
	if mine >= 4:
		return twos or table["kind"] == "quad" or (theirs >= 3 and mine > theirs)
	return false


## Whether `cards` may be played now on the cards of `table` (`[]` when leading), the first play
## of a Match having to hold `must_play` (-1 for none).
static func can_play(cards: Array, table: Array, must_play: int) -> bool:
	if cards.is_empty():
		return false
	if must_play >= 0 and not cards.has(must_play):
		return false
	return beats(combo_of(cards), combo_of(table))


## The sound and words of `cards` put on `table` (`[]` when leading): `{sound, words, color,
## big}`, `big` for plays worth a shout across the table.
static func impact(cards: Array, table: Array) -> Dictionary:
	var combo := combo_of(cards)
	var under := combo_of(table)
	var plain := "card-play" if combo.get("kind", "") == "single" else "combo"
	var out := {"sound": plain, "words": "", "color": Color("#f1d98a"), "big": false}
	if combo.is_empty():
		return out
	if not under.is_empty() and (combo["kind"] != under["kind"] or combo["size"] != under["size"]):
		var words := "Chặt!"
		if rank_of(int(under["top"])) == TWO:
			words = "Chặt đôi heo!" if under["kind"] == "pair" else "Chặt heo!"
		return {"sound": "special-cut", "words": words, "color": Color("#f08a4b"), "big": true}
	if combo["kind"] == "quad":
		return {"sound": "bomb", "words": "Tứ quý!", "color": Color("#f2b84b"), "big": true}
	if combo["kind"] == "pairs":
		var count: String = ["", "", "", "Ba", "Bốn", "Năm", "Sáu"][int(combo["size"]) / 2]
		return {
			"sound": "bomb",
			"words": "%s đôi thông!" % count,
			"color": Color("#f2b84b"),
			"big": true
		}
	if rank_of(int(combo["top"])) == TWO:
		var twos := {"single": "Heo!", "pair": "Đôi heo!", "triple": "Ba heo!"}
		out["words"] = str(twos.get(combo["kind"], ""))
		return out
	if combo["kind"] == "straight" and int(combo["size"]) >= 7:
		out["sound"] = "special-hand"
		out["words"] = "Sảnh rồng!" if int(combo["size"]) == 12 else "Sảnh dài!"
	return out


static func _in_row(ranks: Array[int], step: int) -> bool:
	for i in ranks.size():
		if ranks[i] != ranks[0] + i / step:
			return false
	return true


static func _pairs(combo: Dictionary) -> int:
	return int(combo["size"]) / 2 if combo["kind"] == "pairs" else 0


## The plays worth suggesting for `hand` on `table` (`[]` when leading), weakest first, one per
## shape and rank. Following: the table's shape, then the bombs. Leading: the sets holding the
## lowest card first, longest first.
static func hints(hand: Array, table: Array, must_play: int) -> Array:
	var legal: Array = []
	for cards: Array in combos(hand):
		if can_play(cards, table, must_play):
			legal.append(cards)
	legal.sort_custom(func(a: Array, b: Array) -> bool: return a.max() < b.max())
	var seen := {}
	var unique: Array = []
	for cards: Array in legal:
		var combo := combo_of(cards)
		var key := "%s/%d/%d" % [combo["kind"], combo["size"], rank_of(int(combo["top"]))]
		if not seen.has(key):
			seen[key] = true
			unique.append(cards)
	if table.is_empty():
		unique.sort_custom(
			func(a: Array, b: Array) -> bool:
				if a.min() != b.min():
					return a.min() < b.min()
				if a.size() != b.size():
					return a.size() > b.size()
				return a.max() < b.max()
		)
		return unique
	var shape := combo_of(table)
	var same: Array = []
	var other: Array = []
	for cards: Array in unique:
		var combo := combo_of(cards)
		if combo["kind"] == shape["kind"] and combo["size"] == shape["size"]:
			same.append(cards)
		else:
			other.append(cards)
	return same + other


## Every combination `hand` can make (as `combosOf` in `server/game/bot.ts`): each single, each
## choice of suits for sets of one rank, and straights and runs of pairs with every suit choice
## for the top rank.
static func combos(hand: Array) -> Array:
	var by_rank := {}
	var cards: Array[int] = []
	for card: Variant in hand:
		cards.append(int(card))
	cards.sort()
	for card: int in cards:
		if not by_rank.has(rank_of(card)):
			by_rank[rank_of(card)] = []
		(by_rank[rank_of(card)] as Array).append(card)
	var out: Array = []
	for card: int in cards:
		out.append([card])
	for rank: int in by_rank:
		for count: int in [2, 3, 4]:
			out.append_array(_choose(by_rank[rank], count))
	for start in TWO:
		for width: int in [1, 2]:
			var run: Array = []
			for rank in range(start, TWO):
				var here: Array = by_rank.get(rank, [])
				if here.size() < width:
					break
				if rank - start + 1 >= 3:
					for top: Array in _choose(here, width):
						out.append(run + top)
				run.append_array(here.slice(0, width))
	return out


static func _choose(cards: Array, count: int) -> Array:
	if count == 0:
		return [[]]
	var out: Array = []
	for i in cards.size():
		for rest: Array in _choose(cards.slice(i + 1), count - 1):
			out.append([cards[i]] + rest)
	return out
