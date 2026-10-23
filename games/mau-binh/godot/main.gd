extends Control
## Mậu Binh on the Godot client, in the **Bàn** layout (docs/experience.md): an indigo cloth
## (backdrop.gd, which also holds the table's HUD skin; finale.gd is the end beat), you at the
## bottom with your 13 cards in three rows (chi 3 on top, chi 1 nearest you), the others round
## the table with theirs small; the round at the top, what is going on in the middle, Hoàn tác
## / Tự xếp / Xong at the bottom right. It draws `snapshot.view` (View in src/game/model.ts: your
## hand and rows, who is done, the round results) and sends `submit {rows}` and `cancel`.
##
## Tap a card, then another, to swap them, or drag one onto another; each row shows its hand,
## red where it breaks the order (binh lủng). Xong on binh lủng asks once more ("Vẫn nộp").
## With two seconds left your rows go in as they are. When everyone is done: "Lật bài!", tới
## trắng, then chi 1, 2, 3 with the points each seat won on that chi, sập 3 chi, the round's
## totals, then the round's standings until the next deal. Luật and Kết quả (top right) open
## the scoring rules and every finished round (boards.gd).
##
## Named nodes for tests: Mine_<position> (your cards: chi 1 = 0–4, chi 2 = 5–9, chi 3 = 10–12),
## Row_<chi>, Card_<seat>_<position>, Seat_<seat>, Tag_<seat>, Total_<seat>, Auto, Undo, Done,
## Cancel, Round, Status, Info, Countdown, Word; the boards' in boards.gd.

const Rules := preload("res://content/mau-binh/rules.gd")
const Boards := preload("res://content/mau-binh/boards.gd")
const Drag := preload("res://content/mau-binh/drag.gd")
const EMBLEM: Texture2D = preload("res://content/mau-binh/art/emblem.webp")

const SOUNDS: Array[String] = [
	"deal", "place", "reveal", "scoop", "special", "submit", "swap", "tick", "win", "lose"
]
const ROW_START: Array[int] = [0, 5, 10]
const ROW_LENGTH: Array[int] = [5, 5, 3]
## The widest name of a row while arranging ("Chi 2 · Thùng phá sảnh").
const ROW_NAMES := 230.0
## How long the cards take to move between arranging and comparing.
const SHIFT := 0.45
const BUTTON_WIDTH := 190.0
const GOLD := Color("#FFD54F")
const PALE := Color("#FFE8A3")
const WIN := Color("#8DFF8A")
const LOSE := Color("#FF8A80")
## The reveal on screen (seconds), as REVEAL in src/game/model.ts.
const REVEAL_INTRO := 1.0
const REVEAL_SPECIAL := 2.0
const REVEAL_CHI := 2.6
const REVEAL_SCOOP := 1.8
## A second tap on Xong within this long hands binh lủng in (ms).
const FOUL_CONFIRM_MS := 4000

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your seat, or -1 for a spectator (who looks from seat 0).
var _me: int = -1

var _backdrop := MauBinhBackdrop.new()
var _skin: XomDaoTableSkin = MauBinhBackdrop.skin()
var _finale := MauBinhFinale.new()
## The round on a small indigo plate at the top.
var _clock: MauBinhClockBar = MauBinhClockBar.new(_skin)
var _status := Label.new()
var _word := Label.new()
var _undo: XomDaoButton = XomDaoButton.create("Hoàn tác", XomDaoUi.Kind.BACK)
var _auto: XomDaoButton = XomDaoButton.create("Tự xếp", XomDaoUi.Kind.SOCIAL)
var _done: XomDaoButton = XomDaoButton.create("Xong", XomDaoUi.Kind.PLAY)
var _cancel: XomDaoButton = XomDaoButton.create("Xếp lại", XomDaoUi.Kind.BACK)
var _fx := Control.new()
var _boards: Control = Boards.new()
var _sounds: Dictionary = {}

## One entry per seat: slot, 13 small cards, three row labels, tag, the round's total.
var _seats: Array[Dictionary] = []
## Your 13 cards (by position) and the hand names beside your rows.
var _mine: Array[XomDaoCard] = []
var _my_rows: Array[Label] = []
## Your cards by position, as you arrange them, and the orders before each swap (Hoàn tác).
var _order: Array = []
var _history: Array = []
var _picked: int = -1
var _hand_key: String = ""
var _foul_warned_at: int = -1000000
var _drag: Drag = Drag.new()

## What the last view showed, to tell what changed.
var _round: int = -1
var _phase: String = ""
var _ended: bool = false
var _tick: int = -1
## When the last snapshot came (ms), to count its timer down.
var _shown_at: int = 0
var _auto_sent: int = -1
## How far the reveal has gone: chi shown (0–3), and whether the totals are up.
var _chi_shown: int = 0
var _totals_shown: bool = false
var _center := Vector2.ZERO
## "arrange" or "compare": the table's layout now (a change animates the cards).
var _mode: String = ""
## The arranging clock under the seats (its share left), and the band over the chi compared.
var _band := Control.new()
var _band_rect := Rect2()


## Options for a sandbox room (`?play=mau-binh` in a debug build): three computer players.
func sandbox_options() -> Dictionary:
	return {"bots": 3, "rounds": 3, "arrangeSeconds": 60}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults).
func room_setup() -> Array:
	return Rules.ROOM_SETUP


## The figures for the hub's result board: everyone placed by points (level points share a
## place, whoever left comes last), with their points.
func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or _snapshot == null:
		return {}
	var left: Array = (_view["gone"] as Array) + (_view["forfeits"] as Array)
	var detail: Dictionary = XomDaoPlaces.by_points(_snapshot, _view["points"], left)
	detail.merge({"reason": "Sau %d vòng" % (_view["results"] as Array).size(), "rows": []})
	return detail


## Hub hook: the end beat (the indigo scroll) before the result board.
func wait_for_result_panel() -> void:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	await _finale.wait()


## Hub hook: the result board in the cloth's indigo and brass.
func result_theme() -> Dictionary:
	return MauBinhFinale.theme(EMBLEM)


## Hub hook: the ☰ button and the seats in indigo and brass.
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
	_band.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_band.set_anchors_preset(Control.PRESET_FULL_RECT)
	_band.draw.connect(func() -> void: MauBinhLayout.draw_band(_band, _band_rect))
	add_child(_band)
	add_child(_clock)
	MauBinhBackdrop.hud(_status, XomDaoUi.TEXT_MIN)
	add_child(_status)
	_status.name = "Status"
	_status.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	for k: int in 13:
		var card := XomDaoCard.new()
		card.name = "Mine_%d" % k
		card.mouse_filter = Control.MOUSE_FILTER_STOP
		card.gui_input.connect(_on_card_input.bind(k))
		_mine.append(card)
	# Chi 3 first, so the nearer rows lie over the farther ones.
	for k: int in [10, 11, 12, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4]:
		add_child(_mine[k])
	_drag.cards = _mine
	_drag.lifted.connect(_on_lifted)
	_drag.tapped.connect(_tap)
	_drag.dropped.connect(_swap)
	for row: int in 3:
		var label := Label.new()
		label.name = "Row_%d" % (row + 1)
		MauBinhBackdrop.hud(label, XomDaoUi.TEXT_MIN)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		add_child(label)
		_my_rows.append(label)
	_undo.name = "Undo"
	_undo.pressed.connect(_on_undo)
	_auto.name = "Auto"
	_auto.pressed.connect(_on_auto)
	_done.name = "Done"
	_done.tooltip_text = "Phím Enter"
	_done.pressed.connect(_on_done)
	_cancel.name = "Cancel"
	_cancel.pressed.connect(_on_cancel)
	for button: XomDaoButton in [_undo, _auto, _done, _cancel]:
		button.custom_minimum_size = Vector2(BUTTON_WIDTH, XomDaoUi.TOUCH)
		add_child(button)
	_skin.dress_button(_done, "primary")
	_skin.dress_button(_auto, "secondary")
	_skin.dress_button(_undo, "danger")
	_skin.dress_button(_cancel, "danger")
	_fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx)
	_word.name = "Word"
	MauBinhBackdrop.hud(_word, XomDaoUi.TITLE)
	_word.add_theme_color_override("font_color", GOLD)
	_word.add_theme_constant_override("outline_size", 12)
	_word.visible = false
	add_child(_word)
	add_child(_boards)
	for button: XomDaoIconButton in [_boards.get("rules_button"), _boards.get("results_button")]:
		_skin.dress_icon_button(button)
	add_child(_finale)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.bus = XomDaoSettings.SFX_BUS
		var path: String = "res://content/mau-binh/sounds/%s.wav" % sound
		if not ResourceLoader.exists(path):
			path = path.get_basename() + ".mp3"
		player.stream = load(path)
		player.max_polyphony = 4
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


func _process(_delta: float) -> void:
	_show_countdown()
	# Arranging, your seat already says how you stand: the line is only for a warning.
	_status.visible = (
		not _word.visible and (_mode == "compare" or _status.text.begins_with("Binh lủng"))
	)
	if _done.text == "Vẫn nộp" and Time.get_ticks_msec() - _foul_warned_at > FOUL_CONFIRM_MS:
		_done.text = "Xong"


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
	var fresh: bool = round_number != _round or phase != _phase
	if round_number != _round:
		_new_round()
	_take_hand()
	if fresh and phase == "show":
		if live:
			_play_reveal.call_deferred(round_number)
		else:
			_chi_shown = 3
			_totals_shown = true
	_round = round_number
	_phase = phase
	_refresh()
	if fresh and live and phase == "deal":
		_deal.call_deferred(round_number)
	_ended = snapshot.result != null
	# The end beat once the last reveal is over.
	if _finale.follow(snapshot):
		get_tree().create_timer(0.5).timeout.connect(_play_end.bind(snapshot))


## A new round: nothing picked, nothing shown yet.
func _new_round() -> void:
	_picked = -1
	_history.clear()
	_chi_shown = 0
	_totals_shown = false
	_word.visible = false
	for seat: Dictionary in _seats:
		(seat["total"] as Label).text = ""


## Your cards as they start: the rows you handed in, else strongest first (chi 1 gets the high
## cards). Kept while the hand is the same, so a new view doesn't undo your swaps.
func _take_hand() -> void:
	var hand: Array = _view.get("hand", [])
	var mine: Variant = _view.get("mine")
	var key: String = ",".join(hand.map(func(card: Variant) -> String: return str(int(card))))
	if mine is Array:
		var rows: Array = mine
		_order = []
		for row: Variant in rows:
			for card: Variant in row:
				_order.append(int(card))
	elif key != _hand_key or _order.size() != hand.size():
		_order = hand.map(func(card: Variant) -> int: return int(card))
		_order.sort_custom(
			func(a: int, b: int) -> bool: return a / 4 > b / 4 or (a / 4 == b / 4 and a > b)
		)
		_history.clear()
	if _phase == "show" or str(_view["phase"]) == "show":
		var result: Variant = _result()
		if result is Dictionary and _me >= 0:
			var rows: Variant = ((result as Dictionary)["rows"] as Array)[_me]
			if rows is Array:
				_order = []
				for row: Variant in rows:
					for card: Variant in row:
						_order.append(int(card))
	_hand_key = key


## This round's result, once shown (RoundResult in src/game/model.ts).
func _result() -> Variant:
	var results: Array = _view["results"]
	if str(_view["phase"]) != "show" or results.is_empty():
		return null
	return results[results.size() - 1]


## Whether you are arranging now (and haven't handed in yet).
func _arranging() -> bool:
	if _me < 0 or _snapshot.result != null or str(_view["phase"]) != "arrange":
		return false
	if not bool((_view["inRound"] as Array)[_me]) or _left(_me):
		return false
	return _view.get("mine") == null


func _left(seat: int) -> bool:
	for key: String in ["gone", "forfeits"]:
		var seats: Array = _view[key]
		if seats.has(float(seat)) or seats.has(seat):
			return true
	return false


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	if seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "…"


## A card's face for XomDaoCard: its rank and suit.
static func _face(card: XomDaoCard, value: int) -> void:
	card.show_face(Rules.RANKS[Rules.rank_of(value)], value % 4)


# ── Effects ───────────────────────────────────────────────────────────────────────────────


## The cards fly in from the middle of the table, one to each seat in turn, then the round is
## announced.
func _deal(round_number: int) -> void:
	if not is_inside_tree():
		return
	_sfx("deal")
	var cards: Array[Control] = []
	var count: int = _seats.size()
	for k: int in 13:
		for step: int in count:
			var seat: int = (maxi(_me, 0) + 1 + step) % count
			if not bool((_view["inRound"] as Array)[seat]):
				continue
			cards.append(_mine[k] if seat == _me else _seats[seat]["cards"][k])
	for n: int in cards.size():
		var card: Control = cards[n]
		var mine: bool = _mine.has(card)
		var target: Vector2 = card.position
		card.position = _center - card.size / 2.0
		card.modulate.a = 0.0
		card.visible = true
		card.set_meta("flying", true)
		var tween: Tween = card.create_tween()
		tween.tween_interval(n * 0.028)
		tween.tween_property(card, "modulate:a", 1.0, 0.08)
		tween.parallel().tween_property(card, "position", target, 0.24).set_trans(Tween.TRANS_QUAD)
		if not mine:
			# The others' cards land in their hands (their seats) and are kept out of the way.
			tween.tween_property(card, "modulate:a", 0.0, 0.2).set_delay(0.15)
		tween.tween_callback(
			func() -> void:
				card.remove_meta("flying")
				card.visible = mine or _mode == "compare"
				card.modulate.a = 1.0
		)
	await get_tree().create_timer(cards.size() * 0.028 + 0.3).timeout
	if _round == round_number and is_inside_tree():
		_announce("Vòng %d" % round_number, "place")


## A big word in the middle of the table for a moment.
func _announce(text: String, sound: String = "") -> void:
	MauBinhBackdrop.announce(_word, text, _center)
	if sound != "":
		_sfx(sound)


## The reveal, as on the server's clock: everyone's cards turn over, tới trắng, chi 1, 2, 3
## with each seat's points on that chi, sập 3 chi, then the totals.
func _play_reveal(round_number: int) -> void:
	var result: Variant = _result()
	if result is not Dictionary or not is_inside_tree():
		return
	var still := func() -> bool: return _round == round_number and is_inside_tree()
	_announce("Lật bài!", "reveal")
	_show_seats(true)
	await get_tree().create_timer(REVEAL_INTRO).timeout
	if not still.call():
		return
	var specials: Array = (result as Dictionary)["specials"]
	if specials.any(func(kind: Variant) -> bool: return kind != null):
		var names: Array = []
		for kind: Variant in specials:
			if kind != null:
				names.append(Rules.SPECIAL_NAMES.get(str(kind), ""))
		_announce(", ".join(names), "special")
		await get_tree().create_timer(REVEAL_SPECIAL).timeout
		if not still.call():
			return
	for chi: int in 3:
		_chi_shown = chi + 1
		_announce("Chi %d" % (chi + 1), "place")
		_refresh()
		await get_tree().create_timer(REVEAL_CHI).timeout
		if not still.call():
			return
	var duels: Array = (result as Dictionary)["duels"]
	if duels.any(func(duel: Variant) -> bool: return int((duel as Dictionary)["scoop"]) != 0):
		_announce("Sập 3 chi!", "scoop")
		await get_tree().create_timer(REVEAL_SCOOP).timeout
		if not still.call():
			return
	_totals_shown = true
	var points: Array = (result as Dictionary)["points"]
	if _me >= 0 and int(points[_me]) > 0:
		_sfx("win")
	for i: int in _seats.size():
		var total: Label = _seats[i]["total"]
		total.scale = Vector2.ONE * 0.6
		total.create_tween().tween_property(total, "scale", Vector2.ONE, 0.26).set_trans(
			Tween.TRANS_BACK
		)
	_refresh()


## Draws everything again from the last view.
func _refresh() -> void:
	if _drag.dragged >= 0 and not _arranging():
		_drag.cancel()
	_show_seats()
	_show_mine()
	_show_hud()
	var names: Array[String] = []
	for i: int in _seats.size():
		names.append(_seat_name(i))
	_boards.call("show_view", _view, _snapshot, _me, names, _totals_shown)
	_layout()


# ── Seats ─────────────────────────────────────────────────────────────────────────────────


func _build_seats(count: int) -> void:
	for seat: Dictionary in _seats:
		for key: String in ["seat", "total"]:
			(seat[key] as Node).queue_free()
		for node: Node in (seat["cards"] as Array) + (seat["labels"] as Array):
			node.queue_free()
	_seats.clear()
	for i: int in count:
		var pill := XomDaoSeatPill.new()
		pill.name = "Seat_%d" % i
		pill.tag.name = "Tag_%d" % i
		add_child(pill)
		move_child(pill, _fx.get_index())
		var cards: Array[XomDaoCard] = []
		for k: int in 13:
			var card := XomDaoCard.new()
			card.name = "Card_%d_%d" % [i, k]
			card.visible = false
			cards.append(card)
		for k: int in [10, 11, 12, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4]:
			add_child(cards[k])
			move_child(cards[k], _fx.get_index())
		var labels: Array[Label] = []
		for row: int in 3:
			var label := Label.new()
			MauBinhBackdrop.hud(label, XomDaoUi.TEXT_MIN - 2)
			add_child(label)
			labels.append(label)
		var total := Label.new()
		total.name = "Total_%d" % i
		MauBinhBackdrop.hud(total, XomDaoUi.TEXT + 4)
		add_child(total)
		_seats.append({"seat": pill, "cards": cards, "labels": labels, "total": total, "me": null})
	move_child(_boards, -1)


## Seats in the order the table lays them out: yours first, then round the table.
func _order_of_seats() -> Array[int]:
	var out: Array[int] = []
	var from: int = maxi(_me, 0)
	for step: int in _seats.size():
		var seat: int = (from + step) % _seats.size()
		if _mode != "compare" or bool((_view["inRound"] as Array)[seat]):
			out.append(seat)
	return out


func _show_seats(turning: bool = false) -> void:
	var phase: String = str(_view["phase"])
	var in_round: Array = _view["inRound"]
	var ready: Array = _view["ready"]
	var points: Array = _view["points"]
	var result: Variant = _result()
	for i: int in _seats.size():
		var seat: Dictionary = _seats[i]
		var pill: XomDaoSeatPill = seat["seat"]
		var info: XomDaoPlayerInfo = (
			_snapshot.seats[i] if i < _snapshot.seats.size() else XomDaoPlayerInfo.new()
		)
		var gone: bool = _left(i)
		var dealt: bool = bool(in_round[i]) if i < in_round.size() else false
		var round_points: int = 0
		if result is Dictionary:
			round_points = int(((result as Dictionary)["points"] as Array)[i])
		if seat["me"] != (i == _me):
			seat["me"] = i == _me
			pill.dress(_skin, i == _me)
		var shown_points: int = int(points[i]) - (0 if _totals_shown else round_points)
		pill.modulate.a = 0.45 if gone else 1.0
		var waiting: bool = (
			phase == "arrange"
			and dealt
			and not gone
			and not bool(ready[i])
			and _snapshot.result == null
		)
		var words: String = Rules.tag_of(_view, i, dealt, gone, result)
		var tint: Color = Color(MauBinhBackdrop.CREAM, 0.7) if waiting else Color("#F0CF7E")
		var clock: float = _clock.share if waiting and _clock.share >= 0.0 else -1.0
		pill.show_player(info, _seat_name(i), shown_points, words, tint, clock)
		# The cards: face down until the reveal; yours are drawn by _show_mine.
		var rows: Variant = null
		if result is Dictionary:
			rows = ((result as Dictionary)["rows"] as Array)[i]
		var order: Array = []
		if rows is Array:
			for row: Variant in rows:
				order.append_array(row as Array)
		var cards: Array[XomDaoCard] = []
		cards.assign(seat["cards"])
		var back: Texture2D = XomDaoLooks.card_back(_card_back_of(info.id))
		for k: int in 13:
			var card: XomDaoCard = cards[k]
			if not card.has_meta("flying"):
				card.visible = dealt and i != _me and _mode == "compare"
			card.back = back
			card.dim = false
			if k < order.size():
				MauBinhBackdrop.turn_over(card, int(order[k]), turning and is_inside_tree())
			else:
				card.show_face("", 0)
		# Each row's hand and its points, chi by chi as the reveal goes.
		var labels: Array[Label] = []
		labels.assign(seat["labels"])
		for row: int in 3:
			var label: Label = labels[row]
			label.text = ""
			label.visible = _mode == "compare" and i != _me
			if order.size() == 13 and row < _chi_shown and i != _me:
				label.text = Rules.row_text(
					result, i, row, Rules.rows_of(order)[row], false, _chi_shown
				)
				label.add_theme_color_override(
					"font_color", Rules.row_color(result, i, row, _chi_shown)
				)
			if order.size() == 13 and _chi_shown > 0 and not _totals_shown:
				for k: int in ROW_LENGTH[row]:
					MauBinhBackdrop.dim(cards[ROW_START[row] + k], row != _chi_shown - 1)
		var total: Label = seat["total"]
		total.text = ""
		if _totals_shown and result is Dictionary and dealt:
			total.text = XomDaoUi.delta(round_points) if round_points != 0 else "0"
			total.add_theme_color_override(
				"font_color", WIN if round_points > 0 else (LOSE if round_points < 0 else PALE)
			)


## The card back a member of the room wears ("" when unknown: the default).
func _card_back_of(id: String) -> String:
	for player: XomDaoPlayerInfo in _snapshot.players:
		if player.id == id:
			return player.card_back
	return ""


# ── Your cards ────────────────────────────────────────────────────────────────────────────


## Your 13 cards in their rows, and each row's hand (red where it breaks the order).
func _show_mine() -> void:
	var dealt: bool = _me >= 0 and _order.size() == 13
	var result: Variant = _result()
	var foul: String = Rules.foul_of(Rules.rows_of(_order)) if dealt else ""
	for k: int in 13:
		var card: XomDaoCard = _mine[k]
		card.visible = dealt
		if not dealt:
			continue
		_face(card, int(_order[k]))
		card.picked = k == _picked or k == _drag.hint
		card.dim = false
		card.mouse_default_cursor_shape = (
			Control.CURSOR_POINTING_HAND if _arranging() else Control.CURSOR_ARROW
		)
	for row: int in 3:
		var label: Label = _my_rows[row]
		label.visible = dealt
		if not dealt:
			continue
		var cards: Array = Rules.rows_of(_order)[row]
		var naming: bool = _mode != "compare"
		label.text = Rules.row_text(result, _me, row, cards, naming, _chi_shown)
		if not naming and row >= _chi_shown:
			label.text = ""
		var broken: bool = (
			(foul.begins_with("Chi 2") and row == 1) or (foul.begins_with("Chi 3") and row == 2)
		)
		label.add_theme_color_override(
			"font_color",
			LOSE if broken and result == null else Rules.row_color(result, _me, row, _chi_shown)
		)
		if result is Dictionary and _chi_shown > 0 and not _totals_shown:
			for k: int in ROW_LENGTH[row]:
				MauBinhBackdrop.dim(_mine[ROW_START[row] + k], row != _chi_shown - 1)


## Tap a card to pick it, another to swap the two (the same card again puts it down); or drag
## one onto another (drag.gd).
func _on_card_input(event: InputEvent, k: int) -> void:
	if event is InputEventMouse and _arranging():
		accept_event()
		_drag.input(event as InputEventMouse, k)


func _on_lifted() -> void:
	_picked = -1
	_refresh()


func _tap(k: int) -> void:
	if _picked < 0:
		_picked = k
		_sfx("place")
	elif _picked == k:
		_picked = -1
	else:
		var other: int = _picked
		_picked = -1
		_swap(other, k)
		return
	_refresh()


## Swaps two cards: each slides from where the other one is now to its place.
func _swap(a: int, b: int) -> void:
	_history.append(_order.duplicate())
	var from: Array[Vector2] = [_mine[b].position, _mine[a].position]
	var held: int = _order[a]
	_order[a] = _order[b]
	_order[b] = held
	_sfx("swap")
	_refresh()
	if not is_inside_tree():
		return
	for n: int in 2:
		var card: XomDaoCard = _mine[[a, b][n]]
		var home: Vector2 = card.position
		card.position = from[n]
		Drag.slide(card, home, 0.18)


## Desktop keys: Enter hands your rows in, A arranges them, Z takes back a swap, L and K open
## the rules and the rounds' results.
func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or key.echo or _view.is_empty():
		return
	var actions: Dictionary = {
		KEY_ENTER: _on_done,
		KEY_A: _on_auto,
		KEY_Z: _on_undo,
		KEY_L: Callable(_boards, "open_rules"),
		KEY_K: Callable(_boards, "open_results"),
	}
	if not actions.has(key.keycode):
		return
	(actions[key.keycode] as Callable).call()
	get_viewport().set_input_as_handled()


func _on_undo() -> void:
	if _history.is_empty() or not _arranging():
		return
	_order = _history.pop_back()
	_picked = -1
	_sfx("swap")
	_refresh()


func _on_auto() -> void:
	if not _arranging():
		return
	var best: Array = Rules.best_order(_order)
	if best == _order:
		return
	_history.append(_order.duplicate())
	_order = best
	_picked = -1
	_sfx("swap")
	_refresh()


## Xong: hands your rows in; binh lủng asks for a second tap first.
func _on_done() -> void:
	if not _arranging():
		return
	var foul: String = Rules.foul_of(Rules.rows_of(_order))
	if foul != "" and Time.get_ticks_msec() - _foul_warned_at > FOUL_CONFIRM_MS:
		_foul_warned_at = Time.get_ticks_msec()
		_done.text = "Vẫn nộp"
		_status.text = "Binh lủng: %s" % foul.to_lower()
		return
	_submit()


func _submit() -> void:
	_done.text = "Xong"
	_picked = -1
	_auto_sent = _round
	_sfx("submit")
	await _client.send("submit", {"rows": Rules.rows_of(_order)})


func _on_cancel() -> void:
	_cancel.visible = false
	await _client.send("cancel")


# ── Status and buttons ────────────────────────────────────────────────────────────────────


func _show_hud() -> void:
	var phase: String = str(_view["phase"])
	var over: bool = _snapshot.result != null
	var in_round: Array = _view["inRound"]
	var ready: Array = _view["ready"]
	_clock.round_label.text = "Vòng %d/%d" % [int(_view["round"]), int(_view["rounds"])]
	var playing: int = 0
	var done: int = 0
	for i: int in in_round.size():
		if bool(in_round[i]) and not _left(i):
			playing += 1
			done += 1 if bool(ready[i]) else 0
	var info: String = ""
	if over:
		info = "Kết thúc"
	elif phase == "deal":
		info = "Chia bài"
	elif phase == "arrange":
		info = "Xong %d/%d" % [done, playing]
	else:
		info = "Lật bài" if _chi_shown == 0 else ("Chi %d" % _chi_shown)
		if _totals_shown:
			info = "Vòng sau" if int(_view["round"]) < int(_view["rounds"]) else "Tổng kết"
	var status: String = ""
	var result: Variant = _result()
	if _me < 0:
		status = "Đang xem"
	elif _left(_me):
		status = "Rời bàn"
	elif phase == "arrange" and _view.get("mine") != null:
		status = "Đã nộp bài"
	elif phase == "arrange" and bool(in_round[_me]):
		var foul: String = Rules.foul_of(Rules.rows_of(_order)) if _order.size() == 13 else ""
		status = "Binh lủng" if foul != "" else "Đang xếp"
	elif result is Dictionary and _totals_shown:
		status = "%s điểm" % XomDaoUi.delta(int(((result as Dictionary)["points"] as Array)[_me]))
	if over:
		status = ""
	_clock.info.text = info
	_status.text = status
	var arranging: bool = _arranging()
	_undo.visible = arranging
	_undo.disabled = _history.is_empty()
	_auto.visible = arranging
	_done.visible = arranging
	_cancel.visible = (
		not over
		and phase == "arrange"
		and _me >= 0
		and _view.get("mine") != null
		and not _left(_me)
	)


## The seconds left to arrange; a tick in the last five, and your rows go in with two left.
func _show_countdown() -> void:
	if _snapshot == null or _view.is_empty():
		return
	var timer: XomDaoRoomTimer = _snapshot.timer
	var counting: bool = (
		timer != null and _snapshot.result == null and timer.event == "arrange-over"
	)
	if not counting:
		_clock.countdown.text = ""
		_clock.share = -1.0
		return
	var left_ms: float = timer.left - (Time.get_ticks_msec() - _shown_at)
	var left: int = ceili(maxf(0.0, left_ms) / 1000.0)
	_clock.countdown.text = "%d giây" % left
	# The bar and the rings round the seats still arranging run down with it.
	_clock.total = timer.ms / 1000.0
	_clock.share = clampf(left_ms / maxf(timer.ms, 1.0), 0.0, 1.0)
	var ready: Array = _view["ready"]
	for i: int in _seats.size():
		var waiting: bool = i < ready.size() and not bool(ready[i]) and not _left(i)
		(_seats[i]["seat"] as XomDaoSeatPill).avatar.turn = _clock.share if waiting else -1.0
	var arranging: bool = _arranging()
	if arranging and left <= 5 and left > 0 and left != _tick:
		_sfx("tick")
	_tick = left
	if arranging and left_ms <= 2000.0 and _auto_sent != _round and _order.size() == 13:
		_submit()


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sfx and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## Lays the table out for the phase: arranging (your cards big, the seats in a strip) or
## comparing (a column per seat). Moving from one to the other slides every card into place.
func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var frame := Rect2(
		Vector2(inset.x + edge, edge), Vector2(size.x - 2.0 * (inset.x + edge), size.y - 2.0 * edge)
	)
	var mode: String = "compare" if _result() is Dictionary else "arrange"
	var shifting: bool = _mode != "" and mode != _mode and is_visible_in_tree()
	_mode = mode
	_boards.call("place", Rect2(frame.position, Vector2(frame.size.x, frame.size.y)))
	for card: XomDaoCard in MauBinhLayout.all_cards(_mine, _seats):
		card.set_meta("from", Rect2(card.position, card.size))
	if mode == "arrange":
		_lay_arranging(frame)
	else:
		_lay_comparing(frame)
	for card: XomDaoCard in MauBinhLayout.all_cards(_mine, _seats):
		var from: Rect2 = card.get_meta("from")
		card.pivot_offset = card.size / 2.0
		if shifting and card.visible and from.size.x > 0.0:
			var to := Rect2(card.position, card.size)
			card.position = from.position
			card.size = from.size
			var tween: Tween = card.create_tween().set_parallel()
			tween.tween_property(card, "position", to.position, SHIFT).set_trans(Tween.TRANS_CUBIC)
			tween.tween_property(card, "size", to.size, SHIFT).set_trans(Tween.TRANS_CUBIC)
	_band.queue_redraw()


func _lay_arranging(frame: Rect2) -> void:
	var spot: Dictionary = MauBinhLayout.arranging(frame, _seats.size(), ROW_NAMES, BUTTON_WIDTH)
	_center = Vector2(size.x / 2.0, size.y * 0.5)
	# The seats in a strip at the top, yours first.
	var strip: Rect2 = spot["strip"]
	var pills: Array[XomDaoSeatPill] = []
	for i: int in _order_of_seats():
		pills.append(_seats[i]["seat"])
	MauBinhLayout.place_strip(pills, strip, spot["seat_width"], spot["right"])
	for i: int in _order_of_seats():
		var pill: XomDaoSeatPill = _seats[i]["seat"]
		for card: XomDaoCard in _seats[i]["cards"]:
			# Their cards wait in their hands, behind their seats.
			card.size = Vector2(28.0, 42.0)
			card.position = pill.position + Vector2(18.0, 14.0)
		(_seats[i]["total"] as Label).text = ""
	# The clock: the round on the left, who is done and the seconds round the bar.
	var clock: Rect2 = spot["clock"]
	_clock.fit(clock, true, Vector2.ZERO)
	_status.reset_size()
	_status.size.x = 520.0
	_status.position = Vector2((size.x - 520.0) / 2.0, spot["status_y"])
	# Your cards, big, with each row's hand on its left.
	var width: float = spot["hand_width"]
	var at: Vector2 = spot["hand_at"]
	MauBinhLayout.place_block(_mine, at, width, MauBinhLayout.STEP_Y)
	_drag.homes.clear()
	for card: XomDaoCard in _mine:
		_drag.homes.append(card.position)
	_drag.place()
	for row: int in 3:
		var label: Label = _my_rows[row]
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		label.reset_size()
		var first: Rect2 = MauBinhLayout.card_rect(ROW_START[row], at, width)
		label.position = Vector2(spot["labels_right"] - label.size.x, first.position.y + 6.0)
	if _picked >= 0:
		_mine[_picked].position.y -= 18.0
	# The buttons down the right.
	var y: float = frame.end.y
	for button: XomDaoButton in [_done, _auto, _undo]:
		button.reset_size()
		y -= button.size.y
		button.position = Vector2(frame.end.x - button.size.x, y)
		y -= 10.0
	_cancel.reset_size()
	_cancel.position = Vector2(frame.end.x - _cancel.size.x, frame.end.y - _cancel.size.y)
	_band_rect = Rect2()


func _lay_comparing(frame: Rect2) -> void:
	var seats: Array[int] = _order_of_seats()
	var spot: Dictionary = MauBinhLayout.comparing(frame, seats.size())
	var width: float = spot["width"]
	var step: float = spot["step"]
	var columns: Array[Rect2] = spot["columns"]
	_center = Vector2(size.x / 2.0, frame.position.y + MauBinhLayout.CORNER / 2.0)
	_clock.fit(
		frame, false, frame.position + Vector2(MauBinhLayout.CORNER + MauBinhLayout.GAP, 20.0)
	)
	var block: Vector2 = MauBinhLayout.block(width, step, MauBinhLayout.OPEN_STEP_X)
	var height: float = width * XomDaoCard.RATIO
	for n: int in seats.size():
		var i: int = seats[n]
		var column: Rect2 = columns[n]
		var pill: XomDaoSeatPill = _seats[i]["seat"]
		pill.custom_minimum_size.x = minf(XomDaoSeatPill.WIDTH, column.size.x)
		pill.reset_size()
		var fit: float = minf(1.0, column.size.x / pill.size.x)
		pill.pivot_offset = Vector2.ZERO
		pill.scale = Vector2.ONE * fit
		pill.position = Vector2(column.get_center().x - pill.size.x * fit / 2.0, column.position.y)
		var at := Vector2(
			column.get_center().x - block.x / 2.0, pill.position.y + spot["seat_height"] + 10.0
		)
		var cards: Array = _mine if i == _me else _seats[i]["cards"]
		MauBinhLayout.place_block(cards, at, width, step, MauBinhLayout.OPEN_STEP_X)
		var labels: Array = _my_rows if i == _me else _seats[i]["labels"]
		for row: int in 3:
			var label: Label = labels[row]
			label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			label.reset_size()
			label.size.x = column.size.x
			var first: Rect2 = MauBinhLayout.card_rect(
				ROW_START[row], at, width, step, MauBinhLayout.OPEN_STEP_X
			)
			label.position = Vector2(column.position.x, first.end.y + 1.0)
		var total: Label = _seats[i]["total"]
		total.reset_size()
		total.pivot_offset = total.size / 2.0
		total.position = Vector2(
			column.get_center().x - total.size.x / 2.0, at.y + block.y + MauBinhLayout.LINE + 2.0
		)
		if _chi_shown > 0 and not _totals_shown:
			var row_rect: Rect2 = MauBinhLayout.card_rect(
				ROW_START[_chi_shown - 1], at, width, step
			)
			_band_rect = Rect2(
				Vector2(frame.position.x, row_rect.position.y - 6.0),
				Vector2(frame.size.x, height + MauBinhLayout.LINE + 8.0)
			)
		else:
			_band_rect = Rect2()
	_status.reset_size()
	_status.size.x = 520.0
	_status.position = Vector2((size.x - 520.0) / 2.0, frame.end.y - _status.size.y)


## The end beat: a brass ring round the winners and the indigo scroll in the middle.
func _play_end(snapshot: XomDaoRoomSnapshot) -> void:
	if not is_inside_tree() or not _finale.armed():
		return
	var seats: Array[Dictionary] = []
	for seat: int in mini(_seats.size(), snapshot.seats.size()):
		var avatar: Control = (_seats[seat]["seat"] as XomDaoSeatPill).avatar
		var at: Vector2 = avatar.global_position - global_position + avatar.size / 2.0
		seats.append({"id": snapshot.seats[seat].id, "name": _seat_name(seat), "at": at})
	_finale.play_points(snapshot, _client.player_id, seats, _view["points"], _center, _sfx)
