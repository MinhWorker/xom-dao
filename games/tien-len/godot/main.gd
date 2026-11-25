extends Control
## The Godot client of Tiến Lên (`games/tien-len/server`). It draws a Match from the server's
## `view` (your own hand and how many cards the others hold) and sends `play {cards}` and `pass`.
##
## Every screen is a function of one `view`: `_apply_view` puts each card where the view says,
## and a card that moves tweens there. The server applies the computer's moves one after another
## with no pause, so `match:state` pushes wait in `_queue` and `_present` shows them one by one,
## each held for as long as a person needs to follow it. An `init` (reconnect, replay) drops
## the queue and redraws at once. `--autoplay` (after `--`, or `?autoplay` on the web page) plays
## by itself, for headless runs.

const Rules := preload("rules.gd")
const Style := preload("style.gd")
const CardView := preload("card_view.gd")
const SeatView := preload("seat_view.gd")
const Overlay := preload("overlay.gd")

const SOUNDS := {
	"bomb": preload("sounds/bomb.wav"),
	"card-play": preload("sounds/card-play.wav"),
	"card-select": preload("sounds/card-select.wav"),
	"combo": preload("sounds/combo.wav"),
	"deal": preload("sounds/deal.wav"),
	"last-card": preload("sounds/last-card.wav"),
	"lose": preload("sounds/lose.wav"),
	"pass": preload("sounds/pass.wav"),
	"special-cut": preload("sounds/special-cut.wav"),
	"special-hand": preload("sounds/special-hand.wav"),
	"trick-clear": preload("sounds/trick-clear.wav"),
	"turn": preload("sounds/turn.wav"),
	"win": preload("sounds/win.wav"),
}
## Where each seat sits, from the player's own (bottom) round the table, by how many play.
## Play goes anticlockwise: the next seat is on your right.
const SLOTS := {
	1: ["bottom"],
	2: ["bottom", "top"],
	3: ["bottom", "right", "left"],
	4: ["bottom", "right", "top", "left"],
}
const TINTS: Array[Color] = [
	Color("#e3b25a"),
	Color("#6fb3a2"),
	Color("#d27b66"),
	Color("#8f9fd6"),
]

## The deal on screen (seconds), as `DEAL` and `INTRO` in `server/game/model.ts`: the server
## starts play when both are over.
const DEAL_SHUFFLE := 0.76
const DEAL_STEP := 0.028
const DEAL_FLY := 0.24
const DEAL_FLIP := 0.22
const INTRO_ROUND := 1.2
const INTRO_LEAD := 1.2
## `TURN_MS` in model.ts: the clock runs only with two or more people at the table.
const TURN_SECONDS := 20.0
## How long a move stays on screen before the next one: the player's own, and the others'.
const HOLD_OWN := 0.15
const HOLD_PLAY := 0.7
const HOLD_PASS := 0.5
const HOLD_BIG := 0.5
const MOVE_SEC := 0.28
const LIFT := 26.0
## The play and pass buttons. `scripts/e2e.mjs` taps them and the hand by this layout (`_hand_slot`,
## `_layout_buttons`): change them together.
const BUTTON := Vector2(132.0, 46.0)
const DONE_AFTER_STANDINGS := 3.4
## The bus of the sound effects, set to the Hub's `effects` level.
const EFFECTS_BUS := "Effects"

var _me := -1
var _seats: Array = []
var _match_id := ""
var _view: Dictionary = {}
var _queue: Array[Dictionary] = []
var _busy := false
var _epoch := 0
var _pending := false
var _done_sent := false
var _autoplay := false
var _turn_key := ""
var _turn_since := 0
var _cards: Dictionary = {}
var _selected: Dictionary = {}
var _seat_views: Array[SeatView] = []
var _seat_count := 0
var _players: Dictionary = {}
## Đồ họa thấp: no shaking or pulsing.
var _low := false

var _glow: GradientTexture2D
var _seat_layer := Control.new()
var _card_layer := Control.new()
var _fx := Control.new()
var _overlay := Overlay.new()
var _play_button := Button.new()
var _pass_button := Button.new()
var _hint_button := Button.new()
## Where Gợi ý is in its list, for the table as it stands (`_hint_key`).
var _hint_index := 0
var _hint_key := ""
## A drag across the hand selects (true) or puts down (false) the cards it passes over.
var _drag_select := true
var _dragging := false
var _turn_label: Label


func _ready() -> void:
	_autoplay = "--autoplay" in OS.get_cmdline_user_args()
	if OS.has_feature("web"):
		_autoplay = bool(
			JavaScriptBridge.eval("new URLSearchParams(location.search).has('autoplay')", true)
		)
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	for layer: Control in [_seat_layer, _card_layer, _fx]:
		layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
		layer.set_anchors_preset(Control.PRESET_FULL_RECT)
		add_child(layer)
	_build_background()
	_build_buttons()
	add_child(_overlay)
	_overlay.z_index = 1000
	if AudioServer.get_bus_index(EFFECTS_BUS) < 0:
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, EFFECTS_BUS)
		AudioServer.set_bus_send(AudioServer.bus_count - 1, "Master")
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.stream = SOUNDS[sound]
		player.bus = EFFECTS_BUS
		add_child(player)
		_players[sound] = player
	XomdaoBridge.inited.connect(_on_init)
	XomdaoBridge.message_received.connect(_on_message)
	XomdaoBridge.settings_changed.connect(_apply_settings)
	resized.connect(_relayout)
	_refresh_buttons()
	XomdaoBridge.announce_ready()


func _process(_delta: float) -> void:
	if not _clock_runs():
		return
	var turn := int(_view["turn"])
	var elapsed := float(Time.get_ticks_msec() - _turn_since) / 1000.0
	for seat in _seat_views.size():
		_seat_views[seat].clock = (
			clampf(1.0 - elapsed / TURN_SECONDS, 0.0, 1.0) if seat == turn else -1.0
		)
		_seat_views[seat].refresh()


## The turn clock shows when it runs on the server: a trick under way, two or more people.
func _clock_runs() -> bool:
	if _view.is_empty() or _busy or _view.get("phase") != "play":
		return false
	var people := 0
	for seat: Variant in _seats:
		if seat is Dictionary and not bool((seat as Dictionary).get("bot", false)):
			people += 1
	return people >= 2


# ---------------------------------------------------------------------------------------------
# Bridge


func _on_init(init: Dictionary) -> void:
	_epoch += 1
	_busy = false
	_queue.clear()
	_pending = false
	_done_sent = false
	_overlay.hide_board()
	_clear_cards()
	_selected.clear()
	_view = {}
	init = _whole(init)
	var settings: Variant = init.get("settings")
	if settings is Dictionary:
		_apply_settings(settings)
	var player: Dictionary = init.get("player", {})
	var room: Dictionary = init.get("room", {})
	_seats = room.get("seats", [])
	_me = -1
	for seat in _seats.size():
		if str((_seats[seat] as Dictionary).get("id", "")) == str(player.get("id", "")):
			_me = seat
	_build_seats(_seats.size())
	var match_state: Variant = init.get("match")
	if match_state is Dictionary and not (match_state as Dictionary).is_empty():
		_snap(match_state)
	else:
		queue_redraw()
		_refresh_buttons()


func _on_message(event: String, data: Variant) -> void:
	if event != "match:state" or not data is Dictionary:
		return
	var push: Dictionary = data
	var id := str(push.get("matchId", ""))
	if id != _match_id:
		_match_id = id
		_done_sent = false
	var status := str(push.get("status", "playing"))
	var view: Variant = push.get("view")
	if not view is Dictionary and status != "over":
		return
	(
		_queue
		. append(
			{
				"view": _whole(view) if view is Dictionary else {},
				"result": _whole(push.get("result")),
			}
		)
	)
	_pump()


## JSON numbers arrive as floats; the view holds only whole numbers, so make them ints (an
## `Array.find` of a seat in `out` would not match 1.0).
func _whole(value: Variant) -> Variant:
	if value is float:
		return int(value)
	if value is Array:
		var list: Array = []
		for item: Variant in value:
			list.append(_whole(item))
		return list
	if value is Dictionary:
		var table: Dictionary = {}
		for key: Variant in value:
			table[key] = _whole(value[key])
		return table
	return value


## The Hub's `effects` level and Đồ họa (volume and mute are already on the Master bus).
func _apply_settings(settings: Dictionary) -> void:
	if settings.has("effects"):
		var bus := AudioServer.get_bus_index(EFFECTS_BUS)
		AudioServer.set_bus_volume_db(bus, linear_to_db(float(settings["effects"])))
	if settings.has("graphics"):
		_low = str(settings["graphics"]) == "low"
		for seat_view in _seat_views:
			seat_view.calm = _low
			seat_view.refresh()


## Shows the queued pushes one by one.
func _pump() -> void:
	if _busy:
		return
	_busy = true
	var epoch := _epoch
	while not _queue.is_empty() and epoch == _epoch:
		var item: Dictionary = _queue.pop_front()
		await _present(item["view"], item["result"], epoch)
	if epoch == _epoch:
		_busy = false
		_turn_since = Time.get_ticks_msec()
		_refresh_buttons()


## Waits `seconds` (shorter while the queue is long); false when an `init` arrived meanwhile.
func _pause(seconds: float, epoch: int) -> bool:
	var hurry := 0.25 if _queue.size() >= 3 else 1.0
	if seconds * hurry > 0.0:
		await get_tree().create_timer(seconds * hurry).timeout
	return epoch == _epoch


# ---------------------------------------------------------------------------------------------
# Presenting a push


func _present(view: Dictionary, result: Variant, epoch: int) -> void:
	_pending = false
	if view.is_empty():
		await _present_over(result, epoch)
		return
	var prev := _view
	var fresh := prev.is_empty() or int(view["round"]) != int(prev["round"])
	if fresh and view.get("phase") == "deal":
		await _present_deal(view, epoch)
		return
	if fresh:
		_snap(view)
		return
	var count: int = (view["counts"] as Array).size()
	var passes: Array[int] = []
	for seat in count:
		if bool((view["passed"] as Array)[seat]) and not bool((prev["passed"] as Array)[seat]):
			passes.append(seat)
	var trick_over := int(view["trick"]) != int(prev["trick"])
	var plays: Array = view["played"]
	var added := plays.size() - (prev["played"] as Array).size()
	var hold := 0.0
	for seat in passes:
		_pop(seat, "Bỏ lượt", Style.MUTED)
		_sfx("pass")
		hold = HOLD_PASS
	if trick_over and added == 0 and hold > 0.0 and not await _pause(hold, epoch):
		return
	_apply_view(view, true)
	if added > 0:
		hold = _announce_play(plays[plays.size() - 1], prev)
	elif trick_over:
		_sfx("trick-clear")
	elif hold == 0.0:
		hold = 0.0
	hold += _announce_hands(view, prev)
	if _my_turn_now() and (int(prev["turn"]) != _me or added > 0 or not passes.is_empty()):
		_sfx("turn")
	if not await _pause(hold, epoch):
		return
	if view.get("phase") == "over" and prev.get("phase") != "over":
		_present_round_end(view)


## The sound and words of the play just made; how long to hold it on screen.
func _announce_play(play: Dictionary, prev: Dictionary) -> float:
	var seat := int(play["seat"])
	var under: Array = []
	var table: Variant = prev.get("table")
	if table is Dictionary and int((table as Dictionary)["trick"]) == int(play["trick"]):
		under = (table as Dictionary)["cards"]
	var impact := Rules.impact(play["cards"], under)
	_sfx(str(impact["sound"]))
	if str(impact["words"]) != "":
		_overlay.banner(
			str(impact["words"]),
			44 if impact["big"] else 32,
			impact["color"],
			1.0,
			_pile_center().y - size.y * 0.2
		)
	if impact["big"]:
		_shake(7.0 if str(impact["words"]).begins_with("Chặt") else 4.0)
	var hold := HOLD_OWN if seat == _me else HOLD_PLAY
	return hold + (HOLD_BIG if impact["big"] else 0.0)


## The table jolts under a bomb or a chop.
func _shake(strength: float) -> void:
	if _low:
		return
	for layer: Control in [_card_layer, _seat_layer]:
		var jolt := layer.create_tween()
		for i in 6:
			var fade := 1.0 - float(i) / 6.0
			var offset := Vector2(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * strength * fade
			jolt.tween_property(layer, "position", offset, 0.04)
		jolt.tween_property(layer, "position", Vector2.ZERO, 0.05)


## Marks the seats that just ran out of cards or are down to their last one.
func _announce_hands(view: Dictionary, prev: Dictionary) -> float:
	var hold := 0.0
	var counts: Array = view["counts"]
	var before: Array = prev["counts"]
	for seat in counts.size():
		var now := int(counts[seat])
		if now == 1 and int(before[seat]) > 1:
			_pop(seat, "Còn 1 lá", Style.DANGER)
			_sfx("last-card")
			hold = maxf(hold, 0.4)
		elif now == 0 and int(before[seat]) > 0 and (view["out"] as Array).size() == 1:
			var who := "Bạn" if seat == _me else _name_of(seat)
			_overlay.banner("%s về nhất!" % who, 40, Style.BRASS, 1.4, size.y * 0.27)
			_sfx("special-hand")
			_flash(seat)
			hold = maxf(hold, 0.9)
		elif now == 0 and int(before[seat]) > 0:
			_pop(seat, "Hết bài", Style.BRASS)
			hold = maxf(hold, 0.5)
	return hold


func _present_deal(view: Dictionary, epoch: int) -> void:
	_overlay.hide_board()
	_clear_cards()
	_selected.clear()
	_view = view
	_ensure_seats((view["counts"] as Array).size())
	_sync_seats()
	for seat_view in _seat_views:
		seat_view.count = 0
		seat_view.refresh()
	_turn_key = ""
	_sfx("deal")
	_shuffle_fx()
	var hand: Array = view["hand"]
	var seats := _seat_views.size()
	var total := 0
	for count: Variant in view["counts"]:
		total += int(count)
	var deck := _deck_spot()
	var mine := 0
	var hand_scale := _hand_scale()
	for k in total:
		var seat := k % seats
		var start := DEAL_SHUFFLE + float(k) * DEAL_STEP
		if seat == _me and mine < hand.size():
			var node := CardView.new(int(hand[mine]), false)
			_card_layer.add_child(node)
			node.z_index = 20 + mine
			node.move_to(deck, 0.0, hand_scale * 0.6, 0.0)
			node.modulate.a = 0.0
			node.create_tween().tween_property(node, "modulate:a", 1.0, 0.05).set_delay(start)
			var slot := _hand_slot(mine, hand.size())
			node.move_to(slot["center"], slot["angle"], hand_scale, DEAL_FLY, start)
			node.flip(true, DEAL_FLIP, DEAL_SHUFFLE + float(total) * DEAL_STEP + DEAL_FLY)
			_cards[int(hand[mine])] = node
			mine += 1
		else:
			var temp := CardView.new(-1, false)
			_fx.add_child(temp)
			temp.move_to(deck, 0.0, 0.5, 0.0)
			temp.modulate.a = 0.0
			temp.create_tween().tween_property(temp, "modulate:a", 1.0, 0.05).set_delay(start)
			var flight := temp.move_to(_seat_center(seat), 0.0, 0.3, DEAL_FLY, start)
			flight.finished.connect(temp.queue_free)
		get_tree().create_timer(start + DEAL_FLY).timeout.connect(_dealt.bind(seat, epoch))
	var dealing := DEAL_SHUFFLE + float(total) * DEAL_STEP + DEAL_FLY + DEAL_FLIP
	if not await _pause(dealing, epoch):
		return
	_sync_seats()
	_refresh_buttons()
	queue_redraw()
	var lead := int(view["lead"])
	var rounds := int(view["rounds"])
	if rounds > 1:
		_overlay.banner(
			"Vòng %d" % int(view["round"]), 54, Style.BRASS, INTRO_ROUND, _pile_center().y
		)
		if not await _pause(INTRO_ROUND, epoch):
			return
	_overlay.banner(
		"Bạn đi trước" if lead == _me else "%s đi trước" % _name_of(lead),
		30,
		Style.TEXT,
		INTRO_LEAD,
		_pile_center().y
	)
	if not await _pause(INTRO_LEAD, epoch):
		return
	_reset_clock()


func _dealt(seat: int, epoch: int) -> void:
	if epoch != _epoch or seat >= _seat_views.size():
		return
	_seat_views[seat].count += 1
	_seat_views[seat].refresh()


## A few card backs shuffled in the middle of the table.
func _shuffle_fx() -> void:
	var deck := _deck_spot()
	for i in 6:
		var node := CardView.new(-1, false)
		_fx.add_child(node)
		node.move_to(deck, 0.0, 0.62, 0.0)
		var reach := Vector2(randf_range(-60.0, 60.0), randf_range(-16.0, 16.0))
		var shuffle := node.create_tween().set_trans(Tween.TRANS_SINE)
		for step in 2:
			shuffle.tween_property(
				node, "position", deck - CardView.SIZE * 0.5 + reach, DEAL_SHUFFLE * 0.25
			)
			shuffle.tween_property(
				node, "position", deck - CardView.SIZE * 0.5, DEAL_SHUFFLE * 0.25
			)
		shuffle.tween_callback(node.queue_free)


func _present_round_end(view: Dictionary) -> void:
	var results: Array = view["results"]
	var last: Dictionary = results[results.size() - 1] if not results.is_empty() else {}
	var order: Array = last.get("order", [])
	if not order.is_empty():
		_sfx("win" if int(order[0]) == _me else "lose")
	_show_round_board(view)


## The Match is over. That push has no `view`, only the result (each seat's
## place and score): show the standings, then tell the Hub.
func _present_over(result: Variant, epoch: int) -> void:
	if not result is Dictionary:
		return
	var rows: Array[Dictionary] = []
	var entries: Array = (result as Dictionary).get("seats", [])
	for entry: Dictionary in entries:
		for seat in _seats.size():
			if str((_seats[seat] as Dictionary).get("id", "")) == str(entry.get("player", "")):
				rows.append(
					{
						"seat": seat,
						"place": int(entry["place"]),
						"points": int(entry.get("score", 0))
					}
				)
	rows.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["place"] < b["place"])
	if rows.is_empty():
		return
	if _view.get("phase") != "over":
		_sfx("win" if int(rows[0]["seat"]) == _me else "lose")
	_show_standings(rows)
	if not await _pause(DONE_AFTER_STANDINGS, epoch):
		return
	_finish()


## Tells the Hub the end of the Match has played out.
func _finish() -> void:
	if _done_sent:
		return
	_done_sent = true
	print("TIENLEN done")
	XomdaoBridge.done()


## Draws a view at once: a reconnect, a replay or a round the player did not see dealt.
func _snap(view: Dictionary) -> void:
	_overlay.hide_board()
	_clear_cards()
	_selected.clear()
	_view = {}
	_ensure_seats((view["counts"] as Array).size())
	_apply_view(view, false)
	_reset_clock()
	if view.get("phase") == "over":
		_show_round_board(view)
	_refresh_buttons()


# ---------------------------------------------------------------------------------------------
# What is on the table


func _apply_view(view: Dictionary, animate: bool) -> void:
	var prev := _view
	_view = view
	_ensure_seats((view["counts"] as Array).size())
	_sync_seats()
	var sweep := Vector2.INF
	var table: Variant = prev.get("table")
	if table is Dictionary:
		sweep = _seat_center(int((table as Dictionary)["seat"]))
	var wanted := _wanted_cards(view)
	for card: int in _cards.keys():
		if not wanted.has(card):
			var gone: CardView = _cards[card]
			_cards.erase(card)
			if animate:
				gone.retire(0.3, sweep)
			else:
				gone.queue_free()
		elif not (view["hand"] as Array).has(card):
			_selected.erase(card)
	for card: int in _selected.keys():
		if not (view["hand"] as Array).has(card):
			_selected.erase(card)
	for card: int in wanted:
		var spec: Dictionary = wanted[card]
		var node: CardView = _cards.get(card)
		var seconds := MOVE_SEC if animate else 0.0
		if node == null:
			node = CardView.new(card, true)
			_card_layer.add_child(node)
			_cards[card] = node
			var from := int(spec["from"])
			if animate and from >= 0:
				node.move_to(_seat_center(from), 0.0, 0.45, 0.0)
				node.modulate.a = 0.0
				node.create_tween().tween_property(node, "modulate:a", 1.0, 0.12)
			else:
				seconds = 0.0
		node.z_index = int(spec["z"])
		node.selected = bool(spec["selected"])
		node.move_to(spec["center"], spec["angle"], spec["scale"], seconds)
	var key := (
		"%d:%d:%d" % [int(view["round"]), (view["played"] as Array).size(), int(view["turn"])]
	)
	if key != _turn_key:
		_turn_key = key
		_reset_clock()
	queue_redraw()
	_refresh_buttons()


## Where every card of the view belongs: the hand along the bottom, the last plays of the trick
## in the middle.
func _wanted_cards(view: Dictionary) -> Dictionary:
	var out := {}
	var hand: Array = view["hand"]
	var hand_scale := _hand_scale()
	for i in hand.size():
		var card := int(hand[i])
		var slot := _hand_slot(i, hand.size())
		var picked := _selected.has(card)
		var center: Vector2 = slot["center"]
		if picked:
			center.y -= LIFT
		out[card] = {
			"center": center,
			"angle": slot["angle"],
			"scale": hand_scale,
			"z": 20 + i,
			"selected": picked,
			"from": -1,
		}
	var plays := _trick_plays(view)
	for j in plays.size():
		var play: Dictionary = plays[j]
		var cards: Array = play["cards"]
		var top := j == plays.size() - 1
		var seed_value := int(play["trick"]) * 7 + j + int(play["seat"]) * 3
		var wobble := (
			Vector2(_noise(seed_value) * 26.0, _noise(seed_value + 5) * 12.0)
			if not top
			else Vector2.ZERO
		)
		var angle := _noise(seed_value + 11) * 0.18 if not top else _noise(seed_value + 11) * 0.03
		var scale_value := _pile_scale()
		var step := minf(CardView.SIZE.x * scale_value * 0.46, 36.0)
		for k in cards.size():
			var offset := (float(k) - float(cards.size() - 1) * 0.5) * step
			out[int(cards[k])] = {
				"center": _pile_center() + wobble + Vector2(offset, 0.0).rotated(angle),
				"angle": angle,
				"scale": scale_value,
				"z": 2 + j * 14 + k,
				"selected": false,
				"from": int(play["seat"]) if int(play["seat"]) != _me else -1,
			}
	return out


## The last three plays of the trick under way.
func _trick_plays(view: Dictionary) -> Array:
	var list: Array = []
	for play: Dictionary in view["played"]:
		if int(play["trick"]) == int(view["trick"]):
			list.append(play)
	return list.slice(maxi(list.size() - 3, 0))


func _noise(value: int) -> float:
	return fmod(sin(float(value) * 12.9898) * 43758.5453, 1.0)


func _clear_cards() -> void:
	for node: CardView in _cards.values():
		node.queue_free()
	_cards.clear()
	for node in _fx.get_children():
		node.queue_free()


func _sync_seats() -> void:
	var counts: Array = _view["counts"]
	var out: Array = _view["out"]
	var points: Array = _view["points"]
	var passed: Array = _view["passed"]
	for seat in _seat_views.size():
		var seat_view := _seat_views[seat]
		seat_view.count = int(counts[seat])
		seat_view.points = int(points[seat])
		seat_view.place = out.find(seat) + 1
		seat_view.passed = bool(passed[seat])
		seat_view.active = (
			_view["phase"] == "play" and int(_view["turn"]) == seat and seat_view.place == 0
		)
		seat_view.modulate.a = 1.0 if seat_view.active or seat == _me else 0.78
		seat_view.refresh()


func _reset_clock() -> void:
	_turn_since = Time.get_ticks_msec()
	for seat_view in _seat_views:
		seat_view.clock = -1.0
		seat_view.refresh()


func _ensure_seats(count: int) -> void:
	if _seat_views.size() != count:
		_build_seats(count)


func _build_seats(count: int) -> void:
	for node in _seat_layer.get_children():
		node.queue_free()
	_seat_views.clear()
	_seat_count = count
	for seat in count:
		var seat_view := SeatView.new()
		var info: Dictionary = _seats[seat] if seat < _seats.size() else {}
		seat_view.display_name = str(info.get("name", ""))
		seat_view.is_bot = bool(info.get("bot", false))
		seat_view.tint = TINTS[seat % TINTS.size()]
		seat_view.mine = seat == _me
		seat_view.calm = _low
		seat_view.position = _seat_spot(seat)
		_seat_layer.add_child(seat_view)
		_seat_views.append(seat_view)
	queue_redraw()


func _relayout() -> void:
	for seat in _seat_views.size():
		_seat_views[seat].position = _seat_spot(seat)
	if not _view.is_empty():
		_apply_view(_view, false)
	_layout_buttons()


# ---------------------------------------------------------------------------------------------
# Layout


func _hand_scale() -> float:
	return clampf(size.y * 0.185 / CardView.SIZE.x, 0.7, 1.1)


func _pile_scale() -> float:
	return _hand_scale() * 0.84


func _pile_center() -> Vector2:
	return Vector2(size.x * 0.5, size.y * 0.45)


func _deck_spot() -> Vector2:
	return Vector2(size.x * 0.5, size.y * 0.42)


## Center and tilt of card `index` in a hand of `count`, fanned a little along the bottom.
func _hand_slot(index: int, count: int) -> Dictionary:
	var hand_scale := _hand_scale()
	var width := CardView.SIZE.x * hand_scale
	var height := CardView.SIZE.y * hand_scale
	var left := 16.0
	var span := size.x - 16.0 - BUTTON.x - 28.0 - left
	var step := minf(width * 0.7, (span - width) / maxf(float(count - 1), 1.0))
	var total := width + step * float(count - 1)
	var start := left + (span - total) * 0.5 + width * 0.5
	var mid := float(count - 1) * 0.5
	var lean := (float(index) - mid) / maxf(mid, 1.0)
	return {
		"center":
		Vector2(start + step * float(index), size.y - 14.0 - height * 0.5 + lean * lean * 7.0),
		"angle": lean * 0.045,
	}


func _slot_name(seat: int) -> String:
	var count := _seat_count
	var slots: Array = SLOTS.get(count, SLOTS[4])
	var base := maxi(_me, 0)
	return slots[(seat - base + count) % count]


## The top-left corner of a seat's plate.
func _seat_spot(seat: int) -> Vector2:
	var plate := SeatView.SIZE
	var side_y := size.y * 0.36 - plate.y * 0.5
	match _slot_name(seat):
		"bottom":
			var hand_top := size.y - 14.0 - CardView.SIZE.y * _hand_scale()
			return Vector2(16.0, hand_top - LIFT - 10.0 - plate.y)
		"right":
			return Vector2(size.x - 12.0 - plate.x, side_y)
		"left":
			return Vector2(12.0, side_y)
		_:
			return Vector2((size.x - plate.x) * 0.5, 10.0)


func _seat_center(seat: int) -> Vector2:
	return _seat_spot(seat) + SeatView.SIZE * 0.5


func _name_of(seat: int) -> String:
	if seat < _seats.size():
		return str((_seats[seat] as Dictionary).get("name", ""))
	return ""


# ---------------------------------------------------------------------------------------------
# Drawing


func _build_background() -> void:
	var gradient := Gradient.new()
	gradient.set_color(0, Color("#235a4b"))
	gradient.set_color(1, Style.FELT_DARK)
	_glow = GradientTexture2D.new()
	_glow.gradient = gradient
	_glow.fill = GradientTexture2D.FILL_RADIAL
	_glow.fill_from = Vector2(0.5, 0.46)
	_glow.fill_to = Vector2(1.0, 0.46)
	_glow.width = 256
	_glow.height = 256


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Style.FELT_DARK)
	draw_texture_rect(_glow, Rect2(Vector2.ZERO, size), false)
	var rim := Rect2(Vector2.ZERO, size).grow(-7.0)
	draw_style_box(Style.box(Color(0, 0, 0, 0), 30.0, Color(Style.BRASS_DARK, 0.55), 2.0), rim)
	var middle := _pile_center()
	draw_arc(middle, size.y * 0.27, 0.0, TAU, 64, Color(Style.BRASS, 0.09), 2.0, true)
	draw_arc(middle, size.y * 0.27 + 7.0, 0.0, TAU, 64, Color(Style.BRASS, 0.05), 1.0, true)
	if _view.is_empty():
		return
	var rounds := int(_view["rounds"])
	if rounds > 1:
		var text := "Vòng %d/%d" % [int(_view["round"]), rounds]
		draw_string(
			Style.bold(), Vector2(22.0, 30.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Style.BRASS
		)


func _build_buttons() -> void:
	_play_button.text = "Đánh"
	_pass_button.text = "Bỏ lượt"
	_hint_button.text = "Gợi ý"
	_style_button(_play_button, true)
	_style_button(_pass_button, false)
	_style_button(_hint_button, false)
	_play_button.pressed.connect(_on_play)
	_pass_button.pressed.connect(_on_pass)
	_hint_button.pressed.connect(_on_hint)
	_turn_label = Style.label("Lượt của bạn", 15, Style.BRASS, true)
	_turn_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_turn_label.visible = false
	for node: Control in [_hint_button, _pass_button, _play_button, _turn_label]:
		add_child(node)
	_layout_buttons()


func _style_button(button: Button, primary: bool) -> void:
	button.focus_mode = Control.FOCUS_NONE
	button.add_theme_font_override("font", Style.bold())
	button.add_theme_font_size_override("font_size", 20 if primary else 17)
	var fill := Style.BRASS if primary else Color(0.04, 0.09, 0.08, 0.9)
	var ink := Style.INK if primary else Style.BRASS
	for state: String in ["normal", "hover", "pressed", "disabled"]:
		var shade := fill
		match state:
			"pressed":
				shade = fill.darkened(0.2)
			"disabled":
				shade = Color(fill, 0.28)
		var style := Style.box(
			shade, 12.0, Color(Style.BRASS, 0.9 if state != "disabled" else 0.25), 2.0
		)
		style.shadow_color = Color(0, 0, 0, 0.35)
		style.shadow_size = 4
		style.shadow_offset = Vector2(0, 2)
		button.add_theme_stylebox_override(state, style)
		var color := ink if state != "disabled" else Color(ink, 0.4)
		button.add_theme_color_override("font_%s_color" % state, color)
	button.add_theme_color_override("font_hover_color", ink)


func _layout_buttons() -> void:
	var play_at := Vector2(size.x - 16.0 - BUTTON.x, size.y - 16.0 - BUTTON.y)
	_play_button.position = play_at
	_play_button.size = BUTTON
	_pass_button.position = play_at - Vector2(0.0, BUTTON.y * 0.85 + 10.0)
	_pass_button.size = Vector2(BUTTON.x, BUTTON.y * 0.85)
	_hint_button.position = _pass_button.position - Vector2(0.0, BUTTON.y * 0.85 + 10.0)
	_hint_button.size = _pass_button.size
	var hand_top := size.y - 14.0 - CardView.SIZE.y * _hand_scale()
	_turn_label.size = Vector2(240.0, 24.0)
	_turn_label.position = Vector2(
		(size.x - BUTTON.x - 28.0 - 240.0) * 0.5 + 16.0, hand_top - LIFT - 28.0
	)


# ---------------------------------------------------------------------------------------------
# Playing


func _is_my_turn() -> bool:
	return (
		_me >= 0
		and not _view.is_empty()
		and not _busy
		and _queue.is_empty()
		and _view.get("phase") == "play"
		and int(_view["turn"]) == _me
	)


## Whether it is the player's turn on the screen as it stands, not waiting on the queue.
func _my_turn_now() -> bool:
	return _me >= 0 and _view.get("phase") == "play" and int(_view["turn"]) == _me


func _selection() -> Array[int]:
	var cards: Array[int] = []
	for card: Variant in _view.get("hand", []):
		if _selected.has(int(card)):
			cards.append(int(card))
	return cards


func _table_cards() -> Array:
	var table: Variant = _view.get("table")
	return (table as Dictionary)["cards"] if table is Dictionary else []


func _refresh_buttons() -> void:
	var mine := _is_my_turn() and not _pending
	var must := -1
	if _view.get("mustPlay") != null:
		must = int(_view["mustPlay"])
	_play_button.disabled = not (mine and Rules.can_play(_selection(), _table_cards(), must))
	_pass_button.disabled = not (mine and _view.get("table") != null)
	_hint_button.disabled = not mine or _hints().is_empty()
	_turn_label.visible = _is_my_turn()
	if _autoplay and mine:
		_autoplay_move.call_deferred()


func _on_play() -> void:
	if _play_button.disabled:
		return
	_send("play", {"cards": _selection()})


func _on_pass() -> void:
	if _pass_button.disabled:
		return
	_send("pass", {})


## The plays Gợi ý goes through now, weakest first.
func _hints() -> Array:
	var must := -1
	if _view.get("mustPlay") != null:
		must = int(_view["mustPlay"])
	return Rules.hints(_view.get("hand", []), _table_cards(), must)


## Selects the next suggested play, round and round.
func _on_hint() -> void:
	var hints := _hints()
	if _hint_button.disabled or hints.is_empty():
		return
	var key := "%d/%d" % [int(_view.get("trick", 0)), (_view.get("played", []) as Array).size()]
	if key != _hint_key:
		_hint_key = key
		_hint_index = 0
	var cards: Array = hints[_hint_index % hints.size()]
	_hint_index += 1
	_selected.clear()
	for card: Variant in cards:
		_selected[int(card)] = true
	_sfx("card-select")
	_apply_view(_view, true)


func _send(event: String, data: Dictionary) -> void:
	_pending = true
	_refresh_buttons()
	var epoch := _epoch
	var result: Dictionary = await XomdaoBridge.send(event, data)
	if bool(result.get("ok", false)) or epoch != _epoch:
		return
	_pending = false
	var error := str(result.get("error", ""))
	if error != XomdaoBridge.ERROR_RESET and error != XomdaoBridge.ERROR_UNAVAILABLE:
		_overlay.toast(error, size.y * 0.58)
	_refresh_buttons()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and _dragging:
		var card := _hand_card_at((event as InputEventMouseMotion).position)
		if card >= 0 and _selected.has(card) != _drag_select:
			_toggle(card)
		return
	if not event is InputEventMouseButton:
		return
	var click := event as InputEventMouseButton
	if click.button_index != MOUSE_BUTTON_LEFT:
		return
	if not click.pressed:
		_dragging = false
		return
	if _me < 0:
		return
	var card := _hand_card_at(click.position)
	if card < 0:
		if not _selected.is_empty():
			_selected.clear()
			_apply_view(_view, true)
		return
	_dragging = true
	_drag_select = not _selected.has(card)
	_toggle(card)


func _toggle(card: int) -> void:
	if _selected.has(card):
		_selected.erase(card)
	else:
		_selected[card] = true
	_sfx("card-select")
	_apply_view(_view, true)


## The card in the player's hand under `point`, the top one where they overlap; -1 for none.
func _hand_card_at(point: Vector2) -> int:
	var hand: Array = _view.get("hand", [])
	var hand_scale := _hand_scale()
	var half := CardView.SIZE * hand_scale * 0.5
	for i in range(hand.size() - 1, -1, -1):
		var center: Vector2 = _hand_slot(i, hand.size())["center"]
		if _selected.has(int(hand[i])):
			center.y -= LIFT
		if Rect2(center - half, half * 2.0).has_point(point):
			return int(hand[i])
	return -1


## Leads the lowest card, passes otherwise: enough to finish a Match.
func _autoplay_move() -> void:
	if not _is_my_turn() or _pending:
		return
	_pending = true
	await get_tree().create_timer(0.2).timeout
	_pending = false
	if not _is_my_turn():
		return
	if _view.get("table") == null:
		var hand: Array = _view["hand"]
		print("TIENLEN autoplay play")
		_send("play", {"cards": [hand[0]]})
	else:
		print("TIENLEN autoplay pass")
		_send("pass", {})


# ---------------------------------------------------------------------------------------------
# Words, sounds and boards


## The plate of the seat that went out first swells and glows.
func _flash(seat: int) -> void:
	if _low or seat >= _seat_views.size():
		return
	var plate := _seat_views[seat]
	var glow := plate.create_tween()
	glow.tween_property(plate, "scale", Vector2(1.12, 1.12), 0.18).set_trans(Tween.TRANS_BACK)
	glow.parallel().tween_property(plate, "modulate", Color(1.35, 1.25, 0.9), 0.18)
	glow.tween_property(plate, "scale", Vector2.ONE, 0.35)
	glow.parallel().tween_property(plate, "modulate", Color.WHITE, 0.35)


## A short tag that floats up between a seat and the pile.
func _pop(seat: int, text: String, color: Color) -> void:
	_overlay.pop(text, color, _seat_center(seat).lerp(_pile_center(), 0.55))


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _players.get(sound)
	if player != null:
		player.play()


func _show_round_board(view: Dictionary) -> void:
	var results: Array = view["results"]
	if results.is_empty():
		return
	var last: Dictionary = results[results.size() - 1]
	var order: Array = last["order"]
	var points: Array = last["points"]
	var totals: Array = view["points"]
	var rows: Array[Dictionary] = []
	for place in order.size():
		var seat := int(order[place])
		var cells := ["+%d" % int(points[seat]), str(int(totals[seat]))]
		rows.append(_board_row(place + 1, seat, cells))
	_overlay.show_board("Hết vòng %d" % int(view["round"]), ["Vòng", "Tổng"], rows)


func _show_standings(places: Array[Dictionary]) -> void:
	var rows: Array[Dictionary] = []
	for entry in places:
		rows.append(_board_row(int(entry["place"]), int(entry["seat"]), [str(entry["points"])]))
	_overlay.show_board("Kết thúc ván", ["Điểm"], rows)


func _board_row(place: int, seat: int, cells: Array) -> Dictionary:
	var mine := seat == _me
	return {
		"place": str(place), "name": "Bạn" if mine else _name_of(seat), "mine": mine, "cells": cells
	}
