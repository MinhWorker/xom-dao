extends Control
## Bài Cào on the Godot client: a walnut table at night under an oil lamp (backdrop.gd, which also
## holds the table's HUD skin). It draws `snapshot.view` (View in src/game/model.ts: everyone's
## bets, points and turned-over cards, and your own cards) and sends `bet {amount}` and `reveal`.
##
## The table follows the round (table_layout.gd):
##   - betting: every seat small in a strip at the top (the dealer's with the CÁI mark), the
##     round's plaque and the clock under it, and the three bets as big chips in the middle
##     (bet_tray.gd); the chip you pick slides to your spot, the others' land by their seats;
##   - squeezing: your three cards big in the middle. Tap one to open it, or drag it up (or right)
##     to squeeze it: the back slides off and shows the face bit by bit; let go early and it covers
##     up again. Lật bài turns all three over for everyone;
##   - the count: the dealer at the top facing every player in a row under it. Seen live, the
##     dealer's hand turns first, then each player's in turn: its hand, its points and the chip
##     flying between it and the dealer.
## The end beat (finale.gd) slides the chips to the winner. Keys: 1, 2, 3 bet 5, 10, 20 (or open
## that card while squeezing), Enter or Space turns your cards over.
##
## Named nodes for tests: Mine_<k> (your cards), Card_<seat>_<k>, Seat_<seat>, Tag_<seat>,
## Delta_<seat>, Bet_5, Bet_10, Bet_20, Reveal, Round, Dealer, Status, Info, Countdown.

const Rules := preload("res://content/bai-cao/rules.gd")
const EMBLEM: Texture2D = preload("res://content/bai-cao/art/emblem.webp")

const BETS: Array[int] = [5, 10, 20]
const PHASES: Array[String] = ["bet", "reveal", "showdown"]
const PHASE_NAMES: Array[String] = ["Cược", "Nặn bài", "So bài"]
const SOUNDS: Array[String] = [
	"ba-tay", "chip", "deal", "end", "lose", "peek", "reveal", "tick", "win"
]
const BUTTON_WIDTH := 220.0
const WIN := Color("#8DFF8A")
const LOSE := Color("#FF8A80")
const PALE := Color("#FFE8A3")
## How long the cards take to move between the table's layouts, and the count's step per player.
const SHIFT := 0.45
const STEP := 0.75
## The chips by a seat and on your spot.
const SEAT_CHIP := 40.0
const SPOT_CHIP := 96.0

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your seat, or -1 for a spectator (who looks from seat 0).
var _me: int = -1

var _backdrop := BaiCaoBackdrop.new()
var _skin: XomDaoTableSkin = BaiCaoBackdrop.skin()
var _finale := BaiCaoFinale.new()
var _plaque: PanelContainer
var _round_label := Label.new()
var _dealer_label := Label.new()
var _phases: Array[Label] = []
var _status := Label.new()
var _info := Label.new()
var _countdown := Label.new()
## The clock's bar under the strip (its share left; -1 none).
var _clock := Control.new()
var _clock_share: float = -1.0
var _tray := BaiCaoBetTray.new()
## Your betting spot on the table: a ring, then the chip you bet in it.
var _spot := Control.new()
var _spot_chip := TextureRect.new()
var _reveal: XomDaoButton = XomDaoButton.create("Lật bài", XomDaoUi.Kind.PLAY)
var _fx := Control.new()
var _sounds: Dictionary = {}
var _textures: Dictionary = {}

## One entry per seat: seat (its pill), cards, chip (its bet), hand (its hand's name), delta.
var _seats: Array[Dictionary] = []
## Your three cards (hand.gd), and their boxes.
var _hand := BaiCaoHand.new()
var _mine: Array[Control] = _hand.boxes

## What the last view showed, to tell what changed.
var _round: int = -1
var _phase: String = ""
var _bets_seen: Array = []
var _revealed_seen: Array = []
var _shown: Array[String] = []
var _tick: int = -1
## When the last snapshot came (ms), to count its timer down.
var _shown_at: int = 0
var _center := Vector2.ZERO
## "table" (betting, squeezing) or "count": the layout now (a change moves the cards).
var _mode: String = ""
## Seats the count has reached (their hands and points show); all of them when not seen live.
var _counted: Array[int] = []
## When the live count will be over (ms).
var _count_until: int = 0


## Options for a sandbox room (`?play=bai-cao` in a debug build): three computer players.
func sandbox_options() -> Dictionary:
	return {"bots": 3, "rounds": 5}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults).
func room_setup() -> Array:
	return [
		{
			"key": "bots",
			"label": "Máy chơi cùng",
			"options": [["Không", 0], ["1", 1], ["2", 2], ["3", 3], ["4", 4], ["5", 5]],
		},
		{
			"key": "rounds",
			"label": "Số ván",
			"options": [["5", 5], ["10", 10], ["20", 20]],
			"default": 1
		},
	]


## The figures for the hub's result board: everyone placed by points (level points share a
## place, whoever left comes last), with their points.
func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or _snapshot == null:
		return {}
	var detail: Dictionary = XomDaoPlaces.by_points(_snapshot, _view["points"], _view["gone"])
	detail.merge({"reason": "Sau %d ván" % int(_view["round"]), "rows": []})
	return detail


## Hub hook: the end beat (chips into the winner's pile) before the result board.
func wait_for_result_panel() -> void:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	await _finale.wait()


## Hub hook: the result board on lamp-lit paper.
func result_theme() -> Dictionary:
	return BaiCaoFinale.theme(EMBLEM)


## Hub hook: the ☰ button and the seats in walnut and brass.
func table_skin() -> XomDaoTableSkin:
	return _skin


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	add_child(_backdrop)
	_round_label.name = "Round"
	_dealer_label.name = "Dealer"
	_plaque = BaiCaoBackdrop.plaque(_skin, _round_label, _dealer_label, PHASE_NAMES, _phases)
	add_child(_plaque)
	_clock.name = "Clock"
	_clock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_clock.draw.connect(_draw_clock)
	add_child(_clock)
	for label: Label in [_status, _info, _countdown]:
		BaiCaoBackdrop.hud(label, XomDaoUi.TEXT_MIN)
		add_child(label)
	_status.name = "Status"
	_status.add_theme_font_size_override("font_size", XomDaoUi.TEXT + 4)
	_info.name = "Info"
	_info.add_theme_color_override("font_color", Color(BaiCaoBackdrop.CREAM, 0.8))
	_countdown.name = "Countdown"
	_countdown.add_theme_color_override("font_color", PALE)
	_spot.name = "BetSpot"
	_spot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_spot.draw.connect(_draw_spot)
	add_child(_spot)
	_spot_chip.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_spot_chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_spot_chip.visible = false
	add_child(_spot_chip)
	_tray.chosen.connect(_on_bet)
	add_child(_tray)
	_skin.dress_button(_reveal, "primary")
	_reveal.name = "Reveal"
	_reveal.tooltip_text = "Phím Enter"
	_reveal.pressed.connect(_on_reveal)
	_reveal.custom_minimum_size = Vector2(BUTTON_WIDTH, XomDaoUi.TOUCH)
	add_child(_reveal)
	for box: Control in _mine:
		add_child(box)
	_hand.can_open = _can_squeeze
	_hand.pressed.connect(_sfx.bind("peek"))
	_hand.opened.connect(
		func() -> void:
			_show_hud()
			_show_seats(false)
	)
	_fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx)
	add_child(_finale)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.bus = XomDaoSettings.SFX_BUS
		player.stream = load("res://content/bai-cao/sounds/%s.wav" % sound)
		player.max_polyphony = 4
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


func _process(_delta: float) -> void:
	_show_countdown()


func _art(name_of: String) -> Texture2D:
	if not _textures.has(name_of):
		_textures[name_of] = load("res://content/bai-cao/art/%s.webp" % name_of)
	return _textures[name_of]


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	_shown_at = Time.get_ticks_msec()
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	var live: bool = not _view.is_empty()
	_view = view
	_me = -1
	for i: int in snapshot.seats.size():
		if snapshot.seats[i].id == _client.player_id:
			_me = i
	var count: int = (view["points"] as Array).size()
	if count != _seats.size():
		_build_seats(count)
	var round_number: int = int(view["round"])
	var phase: String = str(view["phase"])
	if round_number != _round:
		_new_round()
	if phase == "showdown" and (_phase != "showdown" or round_number != _round):
		_counted.clear()
		if not live:
			_counted.assign(range(_seats.size()))
	if live:
		_present(view, phase, round_number)
	_round = round_number
	_phase = phase
	_bets_seen = (view["bets"] as Array).duplicate()
	_revealed_seen = (view["revealed"] as Array).duplicate()
	_show_seats(live)
	_show_mine()
	_show_hud()
	_layout()
	# The end beat once the last count has settled.
	if _finale.follow(snapshot):
		var wait: float = 0.7 + maxf(0.0, (_count_until - Time.get_ticks_msec()) / 1000.0)
		get_tree().create_timer(wait).timeout.connect(_play_end.bind(snapshot))


## A new round: every card face down again, nothing peeked, no bet on your spot.
func _new_round() -> void:
	_hand.reset()
	_shown.clear()
	_counted.clear()
	_spot_chip.visible = false
	for seat: Dictionary in _seats:
		_shown.append("")
		(seat["delta"] as Label).text = ""
		(seat["hand"] as Label).text = ""
		for card: XomDaoCard in seat["cards"]:
			card.show_face("", 0)
			card.rotation = 0.0
			card.modulate.a = 1.0


## Sounds and moves for what changed since the last view.
func _present(view: Dictionary, phase: String, round_number: int) -> void:
	var bets: Array = view["bets"]
	for i: int in bets.size():
		if bets[i] != null and (i >= _bets_seen.size() or _bets_seen[i] == null):
			_sfx("chip")
			if i != _me:
				_fly_bet.call_deferred(i)
	var fresh_bet: bool = phase == "bet" and (_phase != "bet" or round_number != _round)
	if fresh_bet and _me != int(view["dealer"]):
		_tray.open.call_deferred()
	if phase == "reveal" and (_phase != "reveal" or round_number != _round):
		_sfx("deal")
		_deal.call_deferred()
	else:
		var revealed: Array = view["revealed"]
		for i: int in revealed.size():
			if bool(revealed[i]) and (i >= _revealed_seen.size() or not bool(_revealed_seen[i])):
				_sfx("reveal")
				break
	if phase == "showdown" and _phase != "showdown" and view["results"] != null:
		_count_until = Time.get_ticks_msec() + int(_count_time() * 1000.0)
		_count.call_deferred(round_number)


## A seat's bet drops in by its seat.
func _fly_bet(seat: int) -> void:
	if not is_inside_tree() or seat >= _seats.size():
		return
	var chip: TextureRect = _seats[seat]["chip"]
	var home: Vector2 = chip.position
	chip.position = home + Vector2(0.0, 60.0)
	chip.scale = Vector2.ONE * 1.6
	chip.modulate.a = 0.0
	var tween: Tween = chip.create_tween().set_parallel()
	tween.tween_property(chip, "position", home, 0.32).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)
	tween.tween_property(chip, "scale", Vector2.ONE, 0.32)
	tween.tween_property(chip, "modulate:a", 1.0, 0.12)


## The cards fly in from the middle of the table, one seat after another; the others' land in
## their hands behind their seats.
func _deal() -> void:
	if not is_inside_tree():
		return
	var dealer: int = int(_view["dealer"])
	var count: int = _seats.size()
	for i: int in count:
		var order: int = (i - dealer + count) % count
		var dealt: Variant = (_view["hands"] as Array)[i]
		if dealt is Array and (dealt as Array).is_empty():
			continue
		var cards: Array[Control] = []
		if i == _me:
			cards.assign(_mine)
		else:
			cards.assign(_seats[i]["cards"])
		for k: int in cards.size():
			var card: Control = cards[k]
			var target: Vector2 = card.position
			var mine: bool = i == _me
			card.visible = true
			card.set_meta("flying", true)
			card.position = _center - card.size / 2.0
			card.modulate.a = 0.0
			var tween: Tween = card.create_tween()
			tween.tween_interval((k * count + order) * 0.065)
			tween.tween_property(card, "modulate:a", 1.0, 0.06)
			tween.parallel().tween_property(card, "position", target, 0.26).set_trans(
				Tween.TRANS_QUAD
			)
			if not mine:
				tween.tween_property(card, "modulate:a", 0.0, 0.18).set_delay(0.1)
			tween.tween_callback(
				func() -> void:
					card.remove_meta("flying")
					card.modulate.a = 1.0
					card.visible = mine or _mode == "count"
			)


## The count, seen live: the dealer's hand turns, then each player's in turn with its points
## and the chip flying between it and the dealer.
func _count(round_number: int) -> void:
	if not is_inside_tree():
		return
	var order: Array[int] = [int(_view["dealer"])]
	order.append_array(_players())
	var tay: bool = false
	for n: int in order.size():
		await get_tree().create_timer(0.35 if n == 0 else STEP).timeout
		if _round != round_number or not is_inside_tree() or str(_view["phase"]) != "showdown":
			return
		var seat: int = order[n]
		_counted.append(seat)
		var hand: Variant = (_view["hands"] as Array)[seat]
		tay = tay or (hand is Array and Rules.is_tay(hand as Array))
		_show_seats(true)
		_show_mine()
		_show_hud()
		_layout()
		if n > 0:
			_pay(seat)
	_sfx("ba-tay" if tay else ("lose" if _my_delta() < 0 else "win"))


## How long the live count takes, for the end beat to wait it out.
func _count_time() -> float:
	return 0.35 + STEP * _players().size() + 0.3


## The seats betting against the dealer, yours first then round the table.
func _players() -> Array[int]:
	var out: Array[int] = []
	var dealer: int = int(_view["dealer"])
	var gone: Array = _view["gone"]
	for step: int in _seats.size():
		var seat: int = (maxi(_me, 0) + step) % _seats.size()
		if seat != dealer and not gone.has(seat) and not gone.has(float(seat)):
			out.append(seat)
	return out


## The chip between a player and the dealer: to the player who won, from the one who lost.
func _pay(seat: int) -> void:
	var dealer: int = int(_view["dealer"])
	var results: Variant = _view["results"]
	if results is not Array or seat >= _seats.size():
		return
	var delta: int = 0
	for result: Variant in results:
		if int((result as Dictionary)["seat"]) == seat:
			delta = int((result as Dictionary)["delta"])
	var bets: Array = _view["bets"]
	var from: Vector2 = _chip_spot(dealer if delta > 0 else seat)
	var to: Vector2 = _chip_spot(seat if delta > 0 else dealer)
	var chip := TextureRect.new()
	chip.texture = _art("chip-%d" % int(bets[seat] if bets[seat] != null else 5))
	chip.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	chip.size = Vector2.ONE * 56.0
	chip.position = from - chip.size / 2.0
	chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.add_child(chip)
	var tween: Tween = chip.create_tween()
	tween.tween_property(chip, "position", to - chip.size / 2.0, 0.5).set_trans(Tween.TRANS_CUBIC)
	tween.tween_callback(_sfx.bind("chip"))
	tween.tween_property(chip, "modulate:a", 0.0, 0.2)
	tween.tween_callback(chip.queue_free)


func _my_delta() -> int:
	var results: Variant = _view.get("results")
	if results is Array:
		for result: Variant in results:
			if int((result as Dictionary)["seat"]) == _me:
				return int((result as Dictionary)["delta"])
	return 0


# ── Seats ─────────────────────────────────────────────────────────────────────────────────


func _build_seats(count: int) -> void:
	for seat: Dictionary in _seats:
		for key: String in ["seat", "chip", "hand", "delta"]:
			(seat[key] as Node).queue_free()
		for card: XomDaoCard in seat["cards"]:
			card.queue_free()
	_seats.clear()
	_shown.clear()
	for i: int in count:
		var pill := XomDaoSeatPill.new()
		pill.name = "Seat_%d" % i
		pill.tag.name = "Tag_%d" % i
		add_child(pill)
		move_child(pill, _fx.get_index())
		var cards: Array[XomDaoCard] = []
		for k: int in 3:
			var card := XomDaoCard.new()
			card.name = "Card_%d_%d" % [i, k]
			card.visible = false
			add_child(card)
			move_child(card, _fx.get_index())
			cards.append(card)
		var chip := TextureRect.new()
		chip.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		chip.size = Vector2.ONE * SEAT_CHIP
		chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(chip)
		var hand := Label.new()
		BaiCaoBackdrop.hud(hand, XomDaoUi.TEXT_MIN)
		add_child(hand)
		var delta := Label.new()
		delta.name = "Delta_%d" % i
		BaiCaoBackdrop.hud(delta, XomDaoUi.TEXT + 6)
		add_child(delta)
		_seats.append(
			{"seat": pill, "cards": cards, "chip": chip, "hand": hand, "delta": delta, "me": null}
		)
		_shown.append("")


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	if seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "…"


## What a seat's pill says: the dealer, its bet, or how far it is with its cards.
func _tag_of(seat: int, left: bool) -> String:
	if left:
		return "Rời bàn"
	if seat == int(_view["dealer"]):
		return "Nhà cái"
	var bet: Variant = (_view["bets"] as Array)[seat]
	if str(_view["phase"]) == "bet":
		return "Đang cược" if bet == null else "Cược %d" % int(bet)
	return "Đã lật" if bool((_view["revealed"] as Array)[seat]) else "Đang nặn"


func _show_seats(live: bool) -> void:
	var dealer: int = int(_view["dealer"])
	var phase: String = str(_view["phase"])
	var bets: Array = _view["bets"]
	var revealed: Array = _view["revealed"]
	var hands: Array = _view["hands"]
	var results: Variant = _view["results"]
	var over: bool = _snapshot.result != null
	for i: int in _seats.size():
		var seat: Dictionary = _seats[i]
		var pill: XomDaoSeatPill = seat["seat"]
		var info: XomDaoPlayerInfo = (
			_snapshot.seats[i] if i < _snapshot.seats.size() else XomDaoPlayerInfo.new()
		)
		if seat["me"] != (i == _me):
			seat["me"] = i == _me
			pill.dress(_skin, i == _me)
		var left: bool = (_view["gone"] as Array).has(float(i)) or (_view["gone"] as Array).has(i)
		var bet: Variant = bets[i]
		var waiting: bool = (
			not over
			and not left
			and (
				(phase == "bet" and i != dealer and bet == null)
				or (phase == "reveal" and not bool(revealed[i]))
			)
		)
		var tint: Color = Color(BaiCaoBackdrop.CREAM, 0.7) if waiting else BaiCaoBackdrop.CREAM
		if i == dealer:
			tint = BaiCaoBackdrop.AMBER
		pill.show_player(info, _seat_name(i), int(_view["points"][i]), _tag_of(i, left), tint, -1.0)
		pill.badge = _art("dealer") if i == dealer and not left else null
		pill.modulate.a = 0.45 if left else 1.0
		var chip: TextureRect = seat["chip"]
		chip.visible = bet != null and not left and i != _me and _mode != "count"
		if bet != null:
			chip.texture = _art("chip-%d" % int(bet))
		# The cards: the others' face down until turned over; yours are drawn by _show_mine.
		var hand: Variant = hands[i]
		var dealt: bool = hand == null or (hand as Array).size() > 0
		var counted: bool = phase != "showdown" or _counted.has(i)
		var key: String = ""
		for k: int in 3:
			var card: XomDaoCard = seat["cards"][k]
			if not card.has_meta("flying"):
				card.visible = dealt and i != _me and _mode == "count"
			if hand is Array and k < (hand as Array).size() and counted:
				var value: int = int((hand as Array)[k])
				key += "%d," % value
				if i != _me:
					_turn_over(card, value, live and _shown[i] != "")
			else:
				key += "_,"
				card.show_face("", 0)
				card.back = XomDaoLooks.card_back(_card_back_of(info.id))
		_shown[i] = key if dealt else ""
		# The count: the hand's name, and the points won or lost.
		var full: bool = (
			hand is Array
			and (hand as Array).size() == 3
			and counted
			and (
				bool(revealed[i]) or phase == "showdown" or (i == _me and _hand.peeked.size() == 3)
			)
		)
		var name_label: Label = seat["hand"]
		name_label.text = Rules.hand_name(hand as Array) if full else ""
		var tay: bool = full and Rules.is_tay(hand as Array)
		name_label.add_theme_color_override(
			"font_color", Color("#FFE078") if tay else XomDaoUi.CREAM
		)
		_show_delta(i, results, phase == "showdown" and counted, live)


## A seat's points won or lost at the count, popping in when it is counted live.
func _show_delta(seat: int, results: Variant, counted: bool, live: bool) -> void:
	var delta_label: Label = _seats[seat]["delta"]
	var delta_text: String = ""
	if counted and results is Array:
		for result: Variant in results:
			if int((result as Dictionary)["seat"]) == seat:
				var won: int = int((result as Dictionary)["delta"])
				delta_text = XomDaoUi.delta(won)
				delta_label.add_theme_color_override("font_color", WIN if won > 0 else LOSE)
	if delta_text != "" and delta_label.text == "" and live:
		delta_label.scale = Vector2.ONE * 0.5
		delta_label.create_tween().tween_property(delta_label, "scale", Vector2.ONE, 0.3).set_trans(
			Tween.TRANS_BACK
		)
	delta_label.text = delta_text


## Flips a card to its face (turning it over when `animate`).
func _turn_over(card: XomDaoCard, value: int, animate: bool) -> void:
	var rank: String = Rules.RANKS[Rules.rank_of(value)]
	var suit: int = Rules.CARD_SUIT[value % 4]
	if card.rank == rank and card.suit == suit:
		return
	if not animate or not is_inside_tree():
		card.show_face(rank, suit)
		return
	var tween: Tween = card.create_tween()
	tween.tween_property(card, "scale:x", 0.0, 0.13)
	tween.tween_callback(card.show_face.bind(rank, suit))
	tween.tween_property(card, "scale:x", 1.0, 0.13)


## The card back a member of the room wears ("" when unknown: the default).
func _card_back_of(id: String) -> String:
	for player: XomDaoPlayerInfo in _snapshot.players:
		if player.id == id:
			return player.card_back
	return ""


# ── Your cards ────────────────────────────────────────────────────────────────────────────


## Your three cards: face down until you open them or turn the hand over.
func _show_mine() -> void:
	var hands: Array = _view["hands"]
	var hand: Variant = hands[_me] if _me >= 0 and _me < hands.size() else null
	var dealt: bool = hand is Array and (hand as Array).size() == 3
	var revealed: bool = _me >= 0 and bool((_view["revealed"] as Array)[_me])
	var all_open: bool = revealed or str(_view["phase"]) == "showdown"
	var face_of := func(k: int) -> Array:
		var value: int = int((hand as Array)[k])
		return [Rules.RANKS[Rules.rank_of(value)], Rules.CARD_SUIT[value % 4]]
	var back: Texture2D = XomDaoLooks.card_back(_card_back_of(_client.player_id))
	_hand.show_cards(dealt, face_of, back, all_open)


func _can_squeeze(k: int) -> bool:
	if _me < 0 or _snapshot.result != null or str(_view.get("phase", "")) != "reveal":
		return false
	var gone: Array = _view["gone"]
	if gone.has(float(_me)) or gone.has(_me) or bool((_view["revealed"] as Array)[_me]):
		return false
	return not _hand.peeked.has(k)


# ── Top, status and buttons ───────────────────────────────────────────────────────────────


func _show_hud() -> void:
	var phase: String = str(_view["phase"])
	var dealer: int = int(_view["dealer"])
	var gone: Array = _view["gone"]
	var bets: Array = _view["bets"]
	var revealed: Array = _view["revealed"]
	var over: bool = _snapshot.result != null
	_round_label.text = "Ván %d/%d" % [int(_view["round"]), int(_view["rounds"])]
	_dealer_label.text = "Cái: %s" % _seat_name(dealer)
	for k: int in _phases.size():
		_phases[k].add_theme_color_override(
			"font_color", BaiCaoBackdrop.AMBER if PHASES[k] == phase else Color("#8C7458")
		)
	var done: int = 0
	var of: int = 0
	for i: int in _seats.size():
		if gone.has(float(i)) or gone.has(i) or (phase == "bet" and i == dealer):
			continue
		of += 1
		done += 1 if (bets[i] != null if phase == "bet" else bool(revealed[i])) else 0
	var mine_gone: bool = _me >= 0 and (gone.has(float(_me)) or gone.has(_me))
	var info: String = (
		"Đã cược %d/%d" % [done, of]
		if phase == "bet"
		else ("Đã lật %d/%d" % [done, of] if phase == "reveal" else "Đã so bài")
	)
	var status: String = ""
	if _me < 0:
		status = "Đang xem"
	elif mine_gone:
		status = "Rời bàn"
	elif phase == "bet":
		status = (
			"Bạn làm cái"
			if _me == dealer
			else ("Cược %d" % int(bets[_me]) if bets[_me] != null else "Đặt cược")
		)
	elif phase == "reveal":
		status = "Đã lật bài" if bool(revealed[_me]) else "Đã nặn %d/3" % _hand.peeked.size()
	elif _counted.has(_me):
		status = "%s điểm" % XomDaoUi.delta(_my_delta())
	if over:
		info = "Hoà cả bàn" if _snapshot.result.winners.is_empty() else "Kết thúc"
		status = ""
	elif phase == "showdown" and _view["results"] == null:
		info = "Nhà cái rời bàn, huỷ ván"
	_info.text = info
	_status.text = status
	var betting: bool = (
		not over and phase == "bet" and _me >= 0 and _me != dealer and bets[_me] == null
	)
	_tray.visible = betting and not mine_gone
	var hands: Array = _view["hands"]
	_reveal.visible = (
		not over
		and phase == "reveal"
		and _me >= 0
		and not mine_gone
		and not bool(revealed[_me])
		and hands[_me] is Array
		and (hands[_me] as Array).size() > 0
	)
	# Your bet on your spot (the dealer's spot shows its mark).
	var bet: Variant = bets[_me] if _me >= 0 else null
	_spot_chip.visible = phase != "showdown" and _me >= 0 and (bet != null or _me == dealer)
	if _spot_chip.visible:
		_spot_chip.texture = _art("dealer" if _me == dealer else "chip-%d" % int(bet))
	_spot.visible = phase == "bet" and _me >= 0 and not mine_gone


## The seconds left to bet or turn over, and a tick in the last three when you still have to.
func _show_countdown() -> void:
	if _snapshot == null or _view.is_empty():
		return
	var timer: XomDaoRoomTimer = _snapshot.timer
	var counting: bool = (
		timer != null
		and _snapshot.result == null
		and (timer.event == "bet-over" or timer.event == "reveal-over")
	)
	if not counting:
		_countdown.text = ""
		if _clock_share >= 0.0:
			_clock_share = -1.0
			_clock.queue_redraw()
		return
	var left_ms: float = timer.left - (Time.get_ticks_msec() - _shown_at)
	var left: int = ceili(maxf(0.0, left_ms) / 1000.0)
	_countdown.text = "%d giây" % left
	_clock_share = clampf(left_ms / maxf(timer.ms, 1.0), 0.0, 1.0)
	_clock.queue_redraw()
	var acting: bool = _tray.visible or _reveal.visible
	if acting and left <= 3 and left > 0 and left != _tick:
		_sfx("tick")
	_tick = left


func _draw_clock() -> void:
	if _clock_share < 0.0 or _mode != "table":
		return
	var track := Rect2(Vector2.ZERO, _clock.size)
	_clock.draw_rect(track, Color(BaiCaoBackdrop.WALNUT, 0.85), true)
	var urgent: bool = _clock_share <= 0.2
	var fill := Rect2(Vector2.ZERO, Vector2(_clock.size.x * _clock_share, _clock.size.y))
	_clock.draw_rect(fill, BaiCaoBackdrop.CLAY if urgent else BaiCaoBackdrop.AMBER, true)
	_clock.draw_rect(track, Color(BaiCaoBackdrop.BRASS, 0.6), false, 1.5)


## Your betting spot: a dashed brass ring on the wood.
func _draw_spot() -> void:
	var middle: Vector2 = _spot.size / 2.0
	var radius: float = SPOT_CHIP * 0.62
	for i: int in 24:
		var from: float = TAU * i / 24.0
		var brass := Color(BaiCaoBackdrop.BRASS, 0.8)
		_spot.draw_arc(middle, radius, from, from + TAU / 48.0, 4, brass, 3.0, true)


func _on_bet(amount: int) -> void:
	if not _tray.visible:
		return
	_tray.visible = false
	# The chip you picked slides from the tray to your spot.
	_spot_chip.texture = _art("chip-%d" % amount)
	_spot_chip.visible = true
	var home: Vector2 = _spot_chip.position
	_spot_chip.position = _tray.chip_center(amount) - _spot_chip.size / 2.0
	_spot_chip.create_tween().tween_property(_spot_chip, "position", home, 0.32).set_trans(
		Tween.TRANS_QUAD
	)
	_sfx("chip")
	await _client.send("bet", {"amount": amount})


func _on_reveal() -> void:
	_reveal.visible = false
	await _client.send("reveal")


## Desktop keys: 1, 2, 3 bet 5, 10, 20 (or open that card while squeezing); Enter or Space turns
## your cards over.
func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or key.echo or _me < 0 or _view.is_empty():
		return
	var k: int = [KEY_1, KEY_2, KEY_3].find(key.keycode)
	if k < 0:
		k = [KEY_KP_1, KEY_KP_2, KEY_KP_3].find(key.keycode)
	if k >= 0 and _tray.visible:
		_on_bet(BETS[k])
	elif k >= 0 and str(_view["phase"]) == "reveal":
		_hand.open_card(k)
	elif key.keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE] and _reveal.visible:
		_on_reveal()
	else:
		return
	get_viewport().set_input_as_handled()


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sfx and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## Where a seat's chip sits (for the chips that fly at the count and the end).
func _chip_spot(seat: int) -> Vector2:
	if seat == _me and _mode == "table":
		return _spot_chip.position + _spot_chip.size / 2.0
	var pill: XomDaoSeatPill = _seats[seat]["seat"]
	return pill.position + pill.size * pill.scale / 2.0


## Lays the table out for the phase: betting and squeezing (your spot and cards in the middle,
## the seats in a strip) or the count (the dealer facing a row of players). A change of layout
## slides the cards into place.
func _layout() -> void:
	if not is_inside_tree() or _view.is_empty():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var frame := Rect2(
		Vector2(inset.x + edge, edge), Vector2(size.x - 2.0 * (inset.x + edge), size.y - 2.0 * edge)
	)
	var mode: String = "count" if str(_view["phase"]) == "showdown" else "table"
	var shifting: bool = _mode != "" and mode != _mode and is_visible_in_tree()
	_mode = mode
	var moving: Array[Control] = _mine.duplicate()
	for seat: Dictionary in _seats:
		moving.append_array(seat["cards"])
	for node: Control in moving:
		node.set_meta("from", Rect2(node.position, node.size))
	if mode == "table":
		_lay_table(frame)
	else:
		_lay_count(frame)
	_hand.fit()
	for node: Control in moving:
		var from: Rect2 = node.get_meta("from")
		node.pivot_offset = node.size / 2.0
		if shifting and node.visible and from.size.x > 0.0:
			var to := Rect2(node.position, node.size)
			node.position = from.position
			node.size = from.size
			var tween: Tween = node.create_tween().set_parallel()
			tween.tween_property(node, "position", to.position, SHIFT).set_trans(Tween.TRANS_CUBIC)
			tween.tween_property(node, "size", to.size, SHIFT).set_trans(Tween.TRANS_CUBIC)
	_clock.queue_redraw()


func _lay_table(frame: Rect2) -> void:
	var pills: Array[XomDaoSeatPill] = []
	for step: int in _seats.size():
		pills.append(_seats[(maxi(_me, 0) + step) % _seats.size()]["seat"])
	var left: float = frame.position.x + BaiCaoLayout.CORNER + BaiCaoLayout.GAP
	BaiCaoLayout.place_strip(pills, frame.position.y, left, frame.end.x)
	for i: int in _seats.size():
		var pill: XomDaoSeatPill = _seats[i]["seat"]
		pill.visible = true
		var chip: TextureRect = _seats[i]["chip"]
		chip.size = Vector2.ONE * SEAT_CHIP
		chip.position = pill.position + Vector2(pill.size.x * pill.scale.x - 24.0, 42.0)
		for card: XomDaoCard in _seats[i]["cards"]:
			# Their cards wait in their hands, behind their seats.
			card.size = Vector2(30.0, 45.0)
			card.position = pill.position + Vector2(14.0, 12.0)
		for key: String in ["hand", "delta"]:
			(_seats[i][key] as Label).visible = i == _me
	# The plaque and the clock under the strip.
	var line_y: float = frame.position.y + BaiCaoLayout.STRIP + 10.0
	_plaque.reset_size()
	_plaque.position = Vector2(left, line_y)
	for label: Label in [_info, _countdown]:
		label.reset_size()
	_countdown.position = Vector2(frame.end.x - _countdown.size.x, line_y + 2.0)
	_info.position = Vector2(_countdown.position.x - 16.0 - _info.size.x, line_y + 2.0)
	_clock.position = Vector2(_plaque.position.x + _plaque.size.x + 16.0, line_y + 14.0)
	_clock.size = Vector2(maxf(30.0, _info.position.x - 16.0 - _clock.position.x), 10.0)
	_center = Vector2(frame.get_center().x, line_y + 150.0)
	# The middle: your status, the chips to bet with, your spot, your cards.
	_status.reset_size()
	_status.size.x = 520.0
	_status.position = Vector2(frame.get_center().x - 260.0, line_y + 52.0)
	var span: Vector2 = BaiCaoBetTray.span()
	_tray.size = span
	_tray.position = Vector2(frame.get_center().x - span.x / 2.0, _status.position.y + 60.0)
	var cards: Array[Rect2] = BaiCaoLayout.hand(
		frame.get_center().x, frame.end.y, BaiCaoLayout.MY_CARD, BaiCaoLayout.MY_GAP
	)
	for k: int in 3:
		_mine[k].position = cards[k].position
		_mine[k].size = cards[k].size
	_spot.size = Vector2.ONE * SPOT_CHIP * 1.4
	_spot.position = Vector2(frame.get_center().x, frame.end.y - SPOT_CHIP) - _spot.size / 2.0
	_spot_chip.size = Vector2.ONE * SPOT_CHIP
	var spot_at := Vector2(cards[0].position.x - SPOT_CHIP - 28.0, frame.end.y - SPOT_CHIP - 20.0)
	if str(_view["phase"]) == "bet":
		spot_at = _spot.position + (_spot.size - _spot_chip.size) / 2.0
	_spot_chip.position = spot_at
	if _me >= 0:
		var hand: Label = _seats[_me]["hand"]
		hand.reset_size()
		hand.size.x = cards[2].end.x - cards[0].position.x
		hand.position = Vector2(cards[0].position.x, cards[0].position.y - hand.size.y - 2.0)
	if _me >= 0 and str(_view["phase"]) == "reveal":
		_status.position.y = cards[0].position.y - 74.0
	_reveal.reset_size()
	_reveal.position = frame.end - _reveal.size


func _lay_count(frame: Rect2) -> void:
	var dealer: int = int(_view["dealer"])
	var players: Array[int] = _players()
	var spot: Dictionary = BaiCaoLayout.counting(frame, players.size())
	var rooms: Array[Rect2] = [spot["dealer"]]
	rooms.append_array(spot["players"])
	var seats: Array[int] = [dealer]
	seats.append_array(players)
	_center = (spot["dealer"] as Rect2).get_center()
	for i: int in _seats.size():
		(_seats[i]["seat"] as Control).visible = seats.has(i)
		(_seats[i]["chip"] as Control).visible = false
	for n: int in seats.size():
		var i: int = seats[n]
		var width: float = spot["dealer_card" if n == 0 else "player_card"]
		var pill: XomDaoSeatPill = _seats[i]["seat"]
		pill.custom_minimum_size.x = minf(XomDaoSeatPill.WIDTH, rooms[n].size.x)
		pill.reset_size()
		var fit: float = minf(1.0, rooms[n].size.x / pill.size.x)
		pill.scale = Vector2.ONE * fit
		var room: Dictionary = BaiCaoLayout.seat_room(rooms[n], width, pill.size.x * fit)
		pill.position = room["pill"]
		var cards: Array = _mine if i == _me else _seats[i]["cards"]
		var rects: Array[Rect2] = room["cards"]
		for k: int in 3:
			(cards[k] as Control).position = rects[k].position
			(cards[k] as Control).size = rects[k].size
		for key: String in ["hand", "delta"]:
			var label: Label = _seats[i][key]
			label.visible = true
			label.reset_size()
			label.size.x = rooms[n].size.x
			var y: float = room["line_y" if key == "hand" else "delta_y"]
			label.position = Vector2(rooms[n].position.x, y)
			label.pivot_offset = label.size / 2.0
	_clock.size = Vector2.ZERO
	for node: Control in [_status, _plaque, _info, _countdown]:
		node.position = Vector2(-1000.0, 0.0)


## The end beat: lamp light round the winners, the others' chips sliding to them, the strip.
func _play_end(snapshot: XomDaoRoomSnapshot) -> void:
	if not is_inside_tree() or not _finale.armed():
		return
	var winners: Array[String] = snapshot.result.winners if snapshot.result != null else []
	var gone: Array = _view["gone"]
	var spots: Array[Vector2] = []
	var losers: Array[Vector2] = []
	var names: Array[String] = []
	var best: int = 0
	for seat: int in mini(_seats.size(), snapshot.seats.size()):
		if winners.has(snapshot.seats[seat].id):
			spots.append(_chip_spot(seat))
			names.append(_seat_name(seat))
			best = int(_view["points"][seat])
		elif not gone.has(seat) and not gone.has(float(seat)):
			losers.append(_chip_spot(seat))
	var how: String = XomDaoPlaces.outcome(snapshot, _client.player_id)
	var words: Array[String] = XomDaoPlaces.words(how, names, best)
	var spec: Dictionary = {"outcome": how, "headline": words[0], "line": words[1]}
	spec.merge({"middle": _center, "winners": spots, "losers": losers, "chip": _art("chip-10")})
	spec["sound"] = _sfx.bind("win" if how == "win" else "lose")
	spec["land"] = _sfx.bind("chip")
	_finale.play(spec)
