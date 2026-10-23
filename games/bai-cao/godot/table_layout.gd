class_name BaiCaoLayout
extends RefCounted
## Where things go on Bài Cào's table, phase by phase (main.gd moves the nodes):
##
##   - betting and squeezing: every seat small in a strip at the top, the round's plaque and the
##     clock under it, and the middle of the table for you: the three big chips to bet with, then
##     your three cards, big;
##   - the count: the dealer facing everyone, the dealer's seat and cards at the top, every
##     player's seat and cards in a row under it (yours first), each with its hand and its points.

## The ☰ square keeps the top left corner.
const CORNER := 88.0
const GAP := 12.0
const STRIP := 68.0
## Your three cards while betting and squeezing, and the gap between them.
const MY_CARD := 170.0
const MY_GAP := 22.0
## A hand's line (its name) and its points under the cards at the count.
const LINE := 30.0
const DELTA := 44.0


## The seats side by side in a strip from `left` to `right`, shrunk together when they need more
## room than there is.
static func place_strip(
	pills: Array[XomDaoSeatPill], top: float, left: float, right: float
) -> void:
	var wanted: float = -GAP
	var width: float = minf(
		XomDaoSeatPill.WIDTH, (right - left - GAP * (pills.size() - 1)) / maxi(pills.size(), 1)
	)
	for pill: XomDaoSeatPill in pills:
		pill.custom_minimum_size.x = width
		pill.reset_size()
		wanted += pill.size.x + GAP
	var fit: float = minf(1.0, (right - left) / maxf(wanted, 1.0))
	var x: float = maxf(left, (left + right - wanted * fit) / 2.0)
	for pill: XomDaoSeatPill in pills:
		pill.pivot_offset = Vector2.ZERO
		pill.scale = Vector2.ONE * fit
		pill.position = Vector2(x, top)
		x += (pill.size.x + GAP) * fit


## Your three cards side by side, `width` wide each, centred on `middle_x` with their bottom on
## `bottom`.
static func hand(middle_x: float, bottom: float, width: float, gap: float) -> Array[Rect2]:
	var height: float = width * XomDaoCard.RATIO
	var span: float = width * 3.0 + gap * 2.0
	var out: Array[Rect2] = []
	for k: int in 3:
		out.append(
			Rect2(
				Vector2(middle_x - span / 2.0 + k * (width + gap), bottom - height),
				Vector2(width, height)
			)
		)
	return out


## The count. `frame`: the safe area; `players`: how many seats bet against the dealer. Returns
## dealer (Rect2: the dealer's room at the top), players (Array of Rect2, one per player, in a row
## under it), dealer_card and player_card (the cards' widths).
static func counting(frame: Rect2, players: int) -> Dictionary:
	var top: float = frame.position.y
	var dealer_card: float = 92.0
	var dealer_height: float = STRIP + 8.0 + dealer_card * XomDaoCard.RATIO + LINE + DELTA
	var dealer_width: float = maxf(XomDaoSeatPill.WIDTH, dealer_card * 3.0 + 24.0)
	var dealer := Rect2(
		Vector2(frame.get_center().x - dealer_width / 2.0, top),
		Vector2(dealer_width, dealer_height)
	)
	var row_top: float = dealer.end.y + GAP
	var count: int = maxi(players, 1)
	var column: float = minf(300.0, (frame.size.x - GAP * (count - 1)) / count)
	var room: float = frame.end.y - row_top - STRIP - 8.0 - LINE - DELTA
	var player_card: float = minf((column - 20.0) / 3.0, room / XomDaoCard.RATIO)
	player_card = minf(player_card, 86.0)
	var span: float = column * count + GAP * (count - 1)
	var left: float = frame.get_center().x - span / 2.0
	var row: Array[Rect2] = []
	for i: int in count:
		row.append(
			Rect2(
				Vector2(left + i * (column + GAP), row_top), Vector2(column, frame.end.y - row_top)
			)
		)
	return {
		"dealer": dealer, "players": row, "dealer_card": dealer_card, "player_card": player_card
	}


## A seat's room at the count: its pill on top, its three cards under it (`width` each), then its
## hand's line and its points. Returns pill (Vector2, top left), cards (Array of Rect2), line_y and
## delta_y.
static func seat_room(room: Rect2, width: float, pill_width: float) -> Dictionary:
	var pill_at := Vector2(room.get_center().x - pill_width / 2.0, room.position.y)
	var cards: Array[Rect2] = hand(
		room.get_center().x, room.position.y + STRIP + 8.0 + width * XomDaoCard.RATIO, width, 6.0
	)
	var bottom: float = cards[0].end.y
	return {"pill": pill_at, "cards": cards, "line_y": bottom + 2.0, "delta_y": bottom + LINE}
