class_name MauBinhLayout
extends RefCounted
## Where things go on Mậu Binh's table, phase by phase (main.gd moves the nodes):
##
##   - arranging: every seat small in a strip at the top, the clock under it, and your 13 cards
##     as big as the table allows in the middle, their hands' names on the left, the buttons on
##     the right;
##   - comparing (the reveal): one column per seat, yours first, each seat over its three chi
##     laid apart (chi 3 on top) with a line for each chi's hand and points under it.
##
## A block is 13 cards in three rows: chi 1 (5) at the bottom, chi 2 (5), chi 3 (3) on top, each
## card `STEP_X` card widths after the one before it and each row `step_y` card heights over the
## one under it.

const STEP_X := 0.8
## Comparing: the cards of a row overlap more (their corners still show), so they can be bigger.
const OPEN_STEP_X := 0.6
## Arranging: rows overlap (their ranks still show).
const STEP_Y := 0.6
const ROW_START: Array[int] = [0, 5, 10]
## Comparing: the room under each row for its line.
const LINE := 30.0
## The ☰ square and the two round buttons on the right keep the top corners.
const CORNER := 88.0
const ICONS := 2.0 * 88.0 + 12.0
const GAP := 12.0


## A block's size for cards `width` wide, rows `step_y` heights apart.
static func block(width: float, step_y: float = STEP_Y, step_x: float = STEP_X) -> Vector2:
	var height: float = width * XomDaoCard.RATIO
	return Vector2(width + 4.0 * width * step_x, height + 2.0 * height * step_y)


## Each card's rect in a block at `at` (k = position 0–12).
static func card_rect(
	k: int, at: Vector2, width: float, step_y: float = STEP_Y, step_x: float = STEP_X
) -> Rect2:
	var height: float = width * XomDaoCard.RATIO
	var row: int = 0 if k < 5 else (1 if k < 10 else 2)
	var column: int = k - ROW_START[row]
	var x: float = at.x + column * width * step_x + (width * step_x if row == 2 else 0.0)
	var y: float = at.y + (2 - row) * height * step_y
	return Rect2(Vector2(x, y), Vector2(width, height))


## The rows' step when comparing: each row clear of the next, with its line under it.
static func open_step(width: float) -> float:
	var height: float = width * XomDaoCard.RATIO
	return (height + LINE) / height


## Arranging. `frame`: the safe area; `seats`: how many; `labels`: the widest row name;
## `buttons`: the button column's width. Returns strip (Rect2 of the seats' strip), seat_width,
## clock (Rect2 of the clock line), status_y, hand_at, hand_width, labels_right (x where the
## names end) and right (where the seats must end, clear of the round buttons).
static func arranging(frame: Rect2, seats: int, labels: float, buttons: float) -> Dictionary:
	var left: float = frame.position.x + CORNER + GAP
	var right: float = frame.end.x - ICONS - GAP
	var seat_width: float = minf(XomDaoSeatPill.WIDTH, (right - left - GAP * (seats - 1)) / seats)
	var strip_width: float = seat_width * seats + GAP * (seats - 1)
	var strip := Rect2(
		Vector2((left + right - strip_width) / 2.0, frame.position.y), Vector2(strip_width, 68.0)
	)
	var clock := Rect2(Vector2(left, strip.end.y + 8.0), Vector2(right - left, 34.0))
	var status_y: float = clock.end.y + 2.0
	var top: float = status_y + 30.0
	var room := Vector2(frame.size.x - labels - buttons - 4.0 * GAP, frame.end.y - top)
	var width: float = minf(
		150.0,
		minf(room.x / (1.0 + 4.0 * STEP_X), room.y / (XomDaoCard.RATIO * (1.0 + 2.0 * STEP_Y)))
	)
	var size: Vector2 = block(width)
	var hand_left: float = frame.position.x + labels + 2.0 * GAP + (room.x - size.x) / 2.0
	return {
		"strip": strip,
		"seat_width": seat_width,
		"clock": clock,
		"status_y": status_y,
		"hand_at": Vector2(hand_left, frame.end.y - size.y),
		"hand_width": width,
		"labels_right": hand_left - GAP,
		"right": right,
	}


## Comparing: `count` columns under the top corners. Returns columns (Array of Rect2, a column's
## whole room), width (the cards'), step (the rows' step) and seat_height.
static func comparing(frame: Rect2, count: int) -> Dictionary:
	var top: float = frame.position.y + CORNER + GAP
	var column_width: float = (frame.size.x - GAP * (count - 1)) / maxi(count, 1)
	var seat_height: float = 68.0
	# Under the seat: three rows with their lines, then the round's total.
	var height: float = frame.end.y - top - seat_height - GAP - 40.0
	var by_width: float = (column_width - 16.0) / (1.0 + 4.0 * OPEN_STEP_X)
	var by_height: float = (height - 3.0 * LINE) / (3.0 * XomDaoCard.RATIO)
	var width: float = minf(110.0, minf(by_width, by_height))
	var columns: Array[Rect2] = []
	for i: int in count:
		var x: float = frame.position.x + i * (column_width + GAP)
		columns.append(Rect2(Vector2(x, top), Vector2(column_width, frame.end.y - top)))
	return {
		"columns": columns, "width": width, "step": open_step(width), "seat_height": seat_height
	}


## Each card of a block in place (k = position 0–12), at `at`.
static func place_block(
	cards: Array, at: Vector2, width: float, step_y: float, step_x: float = STEP_X
) -> void:
	for k: int in 13:
		var rect: Rect2 = card_rect(k, at, width, step_y, step_x)
		var card: Control = cards[k]
		card.position = rect.position
		card.size = rect.size


## The seats side by side from `strip` to `right` (clear of the round buttons); they shrink together
## when their names and points need more room than there is.
static func place_strip(
	pills: Array[XomDaoSeatPill], strip: Rect2, seat_width: float, right: float
) -> void:
	var wanted: float = -GAP
	for pill: XomDaoSeatPill in pills:
		pill.custom_minimum_size.x = seat_width
		pill.reset_size()
		wanted += pill.size.x + GAP
	var fit: float = minf(1.0, (right - strip.position.x) / maxf(wanted, 1.0))
	var x: float = maxf(strip.position.x, (strip.position.x + right - wanted * fit) / 2.0)
	for pill: XomDaoSeatPill in pills:
		pill.pivot_offset = Vector2.ZERO
		pill.scale = Vector2.ONE * fit
		pill.position = Vector2(x, strip.position.y)
		x += (pill.size.x + GAP) * fit


## The band of light over the chi being compared, across every column.
static func draw_band(canvas: Control, band: Rect2) -> void:
	if not band.has_area():
		return
	var line := Color(MauBinhBackdrop.BRASS, 0.5)
	canvas.draw_rect(band, Color(MauBinhBackdrop.BRASS, 0.13), true)
	canvas.draw_line(band.position, Vector2(band.end.x, band.position.y), line, 2.0)
	canvas.draw_line(Vector2(band.position.x, band.end.y), band.end, line, 2.0)


## Every card on the table: yours, then each seat's.
static func all_cards(mine: Array[XomDaoCard], seats: Array[Dictionary]) -> Array[XomDaoCard]:
	var out: Array[XomDaoCard] = mine.duplicate()
	for seat: Dictionary in seats:
		out.append_array(seat["cards"])
	return out
