extends Control
## Cờ Cá Ngựa on the Godot client, in the **Bàn** layout (docs/experience.md): the square board in
## the middle on the stilt house's veranda deck (backdrop.gd), each player's slot in the corner by
## their colour's paddock (like Ludo King) with their horses home beside it (home_tally.gd), and
## the dice in its bamboo tray (dice_tray.gd) by the slot of whoever is on turn, under the turn
## plaque (turn_plaque.gd). It draws `snapshot.view` (State in src/game/model.ts: every horse, the
## colours, the turn, the dice) and sends `roll` and `move {horse}`.
##
## Tap the dice to roll (it bobs in a glowing tray when it is yours); the horses that can go get
## a pulsing gold ring (horse.gd), tap one to move it. Horses hop square by square, leave the
## paddock with a puff, a kicked horse flies spinning back to its paddock, a horse home sparkles
## (burst.gd), and a team home dances under fireworks with its plaque ("CHIẾN THẮNG!" or "VỀ
## ĐÍCH!", "HẠNG n"; celebration.gd). The book in the top right corner opens the illustrated rules
## (rules_panel.gd).
##
## Named nodes for tests: Board, DiceTray, Dice, Horse_<seat>_<horse>, Seat_<seat>,
## Home_<seat>, TurnPlaque, Status, Notice, RulesButton, RulesPanel (and its own), Celebration
## (and its own).

## The animation queue ran dry.
signal idle

const Rules := preload("res://content/co-ca-ngua/rules.gd")
const RulesPanel := preload("res://content/co-ca-ngua/rules_panel.gd")
const Celebration := preload("res://content/co-ca-ngua/celebration.gd")
const Backdrop := preload("res://content/co-ca-ngua/backdrop.gd")
const Horse := preload("res://content/co-ca-ngua/horse.gd")
const DiceTray := preload("res://content/co-ca-ngua/dice_tray.gd")
const TurnPlaque := preload("res://content/co-ca-ngua/turn_plaque.gd")
const HomeTally := preload("res://content/co-ca-ngua/home_tally.gd")
const Burst := preload("res://content/co-ca-ngua/burst.gd")
const SOUNDS: Array[String] = [
	"dice-roll",
	"dice-six",
	"lose",
	"game-start",
	"no-move",
	"token-bump",
	"token-finish",
	"token-leave",
	"token-return",
	"token-safe",
	"token-select",
	"token-step",
	"turn",
	"win",
]
## The 15 × 15 grid on the board picture: one cell (in board sides).
const CELL := 0.4 / 6.5
## A horse's square against the board's side (the picture has room round the horse).
const HORSE := 0.11
const TURN_SECONDS := 30.0
const STEP_SECONDS := 0.11
## The pause after the end beat before the hub shows its result board.
const END_PAUSE := 0.5
const GOLD := Color("#FFE2A0")
const DUST := Color("#F3DDB0")
## Players not on turn fade back.
const WAITING_ALPHA := 0.6
## The ☰ square the hub keeps in the top left corner.
const MENU := 88.0
const COLUMN := 230.0
const PLAQUE_WIDTH := 250.0
## The widest the dice's column gets.
const COLUMN_MAX := 290.0

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your seat, or -1 for a spectator.
var _me: int = -1

var _backdrop := Backdrop.new()
var _board := TextureRect.new()
var _horse_layer := Control.new()
var _tray := DiceTray.new()
var _plaque := TurnPlaque.new()
## The veranda's HUD: dark teak plates with a honey edge, the timer in lacquer red.
var _skin: XomDaoTableSkin = _veranda_skin()
var _slots: Array[XomDaoPlayerSlot] = []
var _tallies: Array[PanelContainer] = []
## horses[seat][horse]: each a Horse (horse.gd).
var _horses: Array = []
var _fx := Control.new()
var _rules_button: XomDaoIconButton = XomDaoIconButton.create("book-open")
var _rules := RulesPanel.new()
var _sounds: Dictionary = {}
var _faces: Array[Texture2D] = []
## Each colour's horse: the whole square (on the board) and cropped round the horse (tallies).
var _frames: Array[Texture2D] = []
var _heads: Array[Texture2D] = []

## What the last view showed, to animate only what changed.
var _phase: String = ""
var _moves: int = -1
var _turn: int = -1
var _ended: bool = false
## Animations run one after another; while they run the horses are theirs to place.
var _jobs: Array[Callable] = []
var _running: bool = false
var _rolling: bool = false
## Seats whose team home has been celebrated this game (or is queued to be).
var _celebrated: Dictionary = {}
## The winner and the places the HUD shows: they follow the view once the horses got there.
var _settled: Dictionary = {"winner": null, "rankings": []}
## Where the dice tray and the plaque stand, once placed (they glide to the next player).
var _placed: bool = false


## Options for a sandbox room (`?play=co-ca-ngua` in a debug build): three computer players.
func sandbox_options() -> Dictionary:
	return {"bots": 3, "mode": "normal"}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults).
func room_setup() -> Array:
	return [
		{
			"key": "bots",
			"label": "Máy chơi cùng",
			"options": [["Không", 0], ["1", 1], ["2", 2], ["3", 3]],
		},
		{
			"key": "mode",
			"label": "Chế độ",
			"options": [["Thường", "normal"], ["Phân hạng", "ranked"]],
		},
	]


## The figures for the hub's result board.
func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or _view.get("winner") == null:
		return {}
	var rows: Array = [["Số nước đi", str(int(_view["moves"]))]]
	var rankings: Array = _view["rankings"]
	if rankings.size() > 1:
		for place: int in rankings.size():
			rows.append(["Hạng %d" % (place + 1), _seat_name(int(rankings[place]))])
	return {"reason": "Bốn ngựa về đích", "rows": rows}


## The hub waits for this before it shows the result, however the game ended: the last horse's
## hops and the end beat (your win or loss, with its sound) play first, then a short pause. The
## table plays the outcome sound itself.
func wait_for_result_panel() -> void:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _running:
		await idle
	for party: Node in _fx.get_children():
		if party.get_script() == Celebration and party.is_inside_tree():
			await party.tree_exited
	if is_inside_tree():
		await get_tree().create_timer(END_PAUSE).timeout


## The shared result board in the veranda's colours: cream paper, dark teak ink, red lacquer,
## a warm dusk shade, and the horse-and-dice emblem.
func result_theme() -> Dictionary:
	return {
		"paper": Color("#FBF1DC"),
		"ink": Color("#4A2E1C"),
		"accent": Color("#B8262A"),
		"shade": Color(0.09, 0.05, 0.02, 0.55),
		"title": "Hết cuộc đua",
		"emblem": load("res://content/co-ca-ngua/art/emblem.webp"),
	}


## Hub hook: the ☰ button, the seats and Luật in the veranda's teak and honey.
func table_skin() -> XomDaoTableSkin:
	return _skin


static func _veranda_skin() -> XomDaoTableSkin:
	var look := XomDaoTableSkin.new()
	look.plate = Color("#3A2414")
	look.edge = Color("#D9A55A")
	look.ink = Color("#FBF1DC")
	look.radius = 10.0
	look.chip = Color("#5A3820")
	look.chip_edge = Color("#D9A55A", 0.6)
	look.chip_ink = Color("#FBF1DC")
	look.timer = Color("#E8B64C")
	look.timer_track = Color("#2A170C", 0.6)
	look.round_button = [Color("#3A2414"), Color("#D9A55A"), Color("#FBF1DC")]
	return look


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
	_board.name = "Board"
	_board.texture = load("res://content/co-ca-ngua/art/board.webp")
	_board.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_board)
	_horse_layer.name = "Horses"
	_horse_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_horse_layer)
	var sheet: Texture2D = load("res://content/co-ca-ngua/art/horses.webp")
	for color: int in 4:
		var frame := AtlasTexture.new()
		frame.atlas = sheet
		frame.region = Rect2(4.0 + color * 264.0, 4.0, 256.0, 256.0)
		_frames.append(frame)
		var head := AtlasTexture.new()
		head.atlas = sheet
		head.region = Rect2(4.0 + color * 264.0 + 62.0, 54.0, 140.0, 172.0)
		_heads.append(head)
	for face: int in 6:
		_faces.append(load("res://content/co-ca-ngua/art/dice-%d.webp" % (face + 1)))
	_tray.faces = _faces
	_tray.show_face(1)
	_tray.tapped.connect(_on_dice_tapped)
	add_child(_tray)
	add_child(_plaque)
	_fx.name = "Effects"
	_fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx)
	_rules_button.name = "RulesButton"
	_rules_button.pressed.connect(_rules.open)
	add_child(_rules_button)
	_skin.dress_icon_button(_rules_button)
	add_child(_rules)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.bus = XomDaoSettings.SFX_BUS
		player.stream = load("res://content/co-ca-ngua/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	var live: bool = not _view.is_empty()
	var moves: int = int(view["moves"])
	if not live or moves < _moves:
		_celebrated.clear()
		_rules.close()
	_me = -1
	for i: int in snapshot.seats.size():
		if snapshot.seats[i].id == _client.player_id:
			_me = i
	var count: int = (view["horses"] as Array).size()
	if count != _slots.size():
		_build(count, view)
	var phase: String = str(view["phase"])
	var turn: int = int(view["turn"])
	if not live:
		_sfx("game-start")
	elif _phase == "roll" and phase != "roll" and view.get("lastRoll") != null:
		_enqueue(_animate_roll.bind(int((view["lastRoll"] as Dictionary)["value"]), phase))
	if live and moves > _moves and view.get("lastMove") != null:
		var move: Dictionary = (view["lastMove"] as Dictionary).duplicate(true)
		_enqueue(_animate_move.bind(move, view))
		var mover: int = int(move["seat"])
		var over: bool = view.get("winner") != null
		if _team_home(view, mover) and not _celebrated.has(mover) and not over:
			_celebrated[mover] = true
			_enqueue(_celebrate_home.bind(mover))
	if live and turn == _me and _turn != _me and view.get("winner") == null:
		_enqueue(_sfx.bind("turn"))
	_view = view
	_phase = phase
	_moves = moves
	_turn = turn
	if not _running:
		_settle()
		_place_horses()
	_show_hud(live)
	var ended: bool = view.get("winner") != null or snapshot.status == "finished"
	if ended and not _ended and live:
		_enqueue(_conclude)
	_ended = ended
	_layout()


## Whether all four horses of a seat are home.
static func _team_home(view: Dictionary, seat: int) -> bool:
	var all: Array = view["horses"]
	if seat < 0 or seat >= all.size():
		return false
	for horse: Variant in all[seat]:
		if not bool((horse as Dictionary)["finished"]):
			return false
	return true


## A seat's place: its index in the rankings plus one (the winner is first even when the game
## ended before anyone was ranked), or 0 when it has none.
static func rank_of(view: Dictionary, seat: int) -> int:
	var rankings: Array = view["rankings"]
	for place: int in rankings.size():
		if int(rankings[place]) == seat:
			return place + 1
	return 1 if view.get("winner") != null and int(view["winner"]) == seat else 0


func _dice_value() -> int:
	var last: Variant = _view.get("lastRoll")
	return clampi(int((last as Dictionary)["value"]), 1, 6) if last is Dictionary else 1


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	if seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "…"


func _left(seat: int) -> bool:
	return seat < _snapshot.seats.size() and _snapshot.seats[seat].left


func _color(seat: int) -> int:
	return int(_view["colors"][seat]) % 4


func _build(count: int, view: Dictionary) -> void:
	for slot: XomDaoPlayerSlot in _slots:
		slot.queue_free()
	for tally: PanelContainer in _tallies:
		tally.queue_free()
	for team: Variant in _horses:
		for horse: Control in team:
			horse.queue_free()
	_slots.clear()
	_tallies.clear()
	_horses.clear()
	var colors: Array = view["colors"]
	for seat: int in count:
		var color: int = int(colors[seat]) % 4
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		slot.compact = true
		slot.skin = _skin
		add_child(slot)
		move_child(slot, _horse_layer.get_index())
		slot.avatar.item_rect_changed.connect(_place_tallies)
		# A rank chip widens the slot: the tally beside it moves along.
		slot.resized.connect(_place_tallies)
		_slots.append(slot)
		var tally := HomeTally.new()
		tally.name = "Home_%d" % seat
		tally.horse = _heads[color]
		add_child(tally)
		move_child(tally, _horse_layer.get_index())
		_tallies.append(tally)
		var team: Array[Control] = []
		for k: int in 4:
			var horse := Horse.new()
			horse.name = "Horse_%d_%d" % [seat, k]
			horse.texture = _frames[color]
			horse.gui_input.connect(_on_horse_input.bind(seat, k))
			_horse_layer.add_child(horse)
			team.append(horse)
		_horses.append(team)


# ── The board ─────────────────────────────────────────────────────────────────────────────


## The middle of a grid point on the screen.
func _grid_point(at: Vector2) -> Vector2:
	var side: float = _board.size.x
	return _board.position + Vector2.ONE * side / 2.0 + (at - Vector2(7.0, 7.0)) * side * CELL


func _horse_point(seat: int, horse: int, position: int) -> Vector2:
	return _grid_point(Rules.point(_view["colors"], seat, horse, position))


## Stands a horse with its feet on a point.
func _stand(sprite: Horse, at: Vector2) -> void:
	sprite.size = Vector2.ONE * _board.size.x * HORSE
	sprite.position = at - sprite.foot()


func _place_horses() -> void:
	if _view.is_empty() or _board.size.x <= 0.0:
		return
	var all: Array = _view["horses"]
	for seat: int in _horses.size():
		for k: int in 4:
			var sprite: Horse = _horses[seat][k]
			var horse: Dictionary = all[seat][k]
			sprite.visible = not _left(seat)
			sprite.lift = 0.0
			sprite.spin = 0.0
			sprite.squash = 1.0
			_stand(sprite, _horse_point(seat, k, int(horse["position"])))
	_sort_horses()
	_show_selectable()


## The horses lower on the board stand in front.
func _sort_horses() -> void:
	var sprites: Array[Node] = _horse_layer.get_children()
	sprites.sort_custom(func(a: Node, b: Node) -> bool: return a.position.y < b.position.y)
	for i: int in sprites.size():
		_horse_layer.move_child(sprites[i], i)


## Whether you may roll or move now.
func _can_play() -> bool:
	return (
		_me >= 0
		and _snapshot.result == null
		and _view.get("winner") == null
		and int(_view["turn"]) == _me
		and not _left(_me)
		and not _running
	)


## Your horses that can go get their pulsing gold ring.
func _show_selectable() -> void:
	var movable: Dictionary = {}
	if not _view.is_empty() and _can_play() and str(_view["phase"]) == "choose":
		for move: Variant in Rules.legal_moves(_view):
			movable[int((move as Dictionary)["horse"])] = true
	for seat: int in _horses.size():
		for k: int in 4:
			var sprite: Horse = _horses[seat][k]
			sprite.selectable = seat == _me and movable.has(k)
			sprite.mouse_default_cursor_shape = (
				Control.CURSOR_POINTING_HAND if sprite.selectable else Control.CURSOR_ARROW
			)


func _on_dice_tapped() -> void:
	if not _view.is_empty() and _can_play() and str(_view["phase"]) == "roll":
		_tray.ready_to_roll = false
		await _client.send("roll")


func _on_horse_input(event: InputEvent, seat: int, horse: int) -> void:
	var button := event as InputEventMouseButton
	if button == null or not button.pressed or button.button_index != MOUSE_BUTTON_LEFT:
		return
	if seat == _me:
		_move_horse(horse)


## Moves your horse `horse` if it may go now.
func _move_horse(horse: int) -> void:
	if not _can_play() or str(_view["phase"]) != "choose":
		return
	for move: Variant in Rules.legal_moves(_view):
		if int((move as Dictionary)["horse"]) == horse:
			_sfx("token-select")
			for sprite: Horse in _horses[_me]:
				sprite.selectable = false
			await _client.send("move", {"horse": horse})
			return


## Desktop keys: Space or Enter rolls the dice (and moves the only horse that can go); 1–4 move
## that horse.
func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or key.echo or _view.is_empty() or not _can_play():
		return
	var horse: int = [KEY_1, KEY_2, KEY_3, KEY_4].find(key.keycode)
	var phase: String = str(_view["phase"])
	if key.keycode in [KEY_SPACE, KEY_ENTER, KEY_KP_ENTER] and phase == "roll":
		_on_dice_tapped()
	elif key.keycode in [KEY_SPACE, KEY_ENTER, KEY_KP_ENTER] and phase == "choose":
		var horses: Array = Rules.legal_moves(_view).map(
			func(move: Variant) -> int: return int((move as Dictionary)["horse"])
		)
		if horses.size() != 1:
			return
		_move_horse(int(horses[0]))
	elif horse >= 0 and phase == "choose":
		_move_horse(horse)
	else:
		return
	get_viewport().set_input_as_handled()


# ── Animations ────────────────────────────────────────────────────────────────────────────


func _enqueue(job: Callable) -> void:
	_jobs.append(job)
	if not _running:
		_run_jobs()


func _run_jobs() -> void:
	_running = true
	_show_selectable()
	while not _jobs.is_empty() and is_inside_tree():
		var job: Callable = _jobs.pop_front()
		await job.call()
	_running = false
	_rolling = false
	_settle()
	_place_horses()
	if not _view.is_empty():
		_show_hud(true)
	idle.emit()


## The dice tumbles round its tray and lands on the roll.
func _animate_roll(value: int, phase: String) -> void:
	_rolling = true
	_show_hud(true)
	_sfx("dice-roll")
	await _tray.roll(value)
	if not is_inside_tree():
		return
	_rolling = false
	var middle: Vector2 = _tray.position + _tray.size / 2.0
	if value == 6:
		_sfx("dice-six")
		_burst(middle, _tray.size.x * 0.75, GOLD, Burst.Kind.SPARKS)
	elif phase == "pause":
		_sfx("no-move")
		var wobble: Tween = _tray.create_tween()
		for side: float in [-6.0, 6.0, -3.0, 0.0]:
			wobble.tween_property(_tray.dice, "rotation", deg_to_rad(side), 0.05)
	_show_hud(true)


## A horse hops along its path (a bigger hop out of the paddock); a horse it lands on flies
## spinning back to its own paddock; a horse home sparkles.
func _animate_move(move: Dictionary, view: Dictionary) -> void:
	var seat: int = int(move["seat"])
	var horse: int = int(move["horse"])
	if seat >= _horses.size():
		return
	var colors: Array = view["colors"]
	var sprite: Horse = _horses[seat][horse]
	var side: float = _board.size.x * HORSE
	_horse_layer.move_child(sprite, -1)
	var from: int = int(move["from"])
	var path: Array = move["path"]
	for i: int in path.size():
		var at: Vector2 = _grid_point(Rules.point(colors, seat, horse, int(path[i])))
		if from < 0 and i == 0:
			_sfx("token-leave")
			await _hop(sprite, at, side * 0.55, 0.3)
			_burst(at, side * 0.5, DUST, Burst.Kind.DUST)
		else:
			_sfx("token-step")
			await _hop(sprite, at, side * 0.2, STEP_SECONDS)
		if not is_inside_tree():
			return
	var landing: Vector2 = sprite.position + sprite.foot()
	var capture: Variant = move.get("capture")
	if capture is Dictionary and int((capture as Dictionary)["seat"]) < _horses.size():
		var victim_seat: int = int((capture as Dictionary)["seat"])
		var victim_horse: int = int((capture as Dictionary)["horse"])
		var victim: Horse = _horses[victim_seat][victim_horse]
		_sfx("token-bump")
		_burst(landing, side * 0.7, Rules.INKS[int(colors[seat]) % 4], Burst.Kind.KICK)
		var home: Vector2 = _grid_point(Rules.point(colors, victim_seat, victim_horse, -1))
		_horse_layer.move_child(victim, -1)
		await _fly(victim, home, 0.5)
		if not is_inside_tree():
			return
		_sfx("token-return")
		_burst(home, side * 0.5, DUST, Burst.Kind.DUST)
	if bool(move["finish"]):
		_sfx("token-finish")
		_burst(landing, side * 0.8, GOLD, Burst.Kind.SPARKS)
	elif int(move["to"]) >= Rules.TRACK_LENGTH:
		_sfx("token-safe")


## One hop to `at`, `height` high, landing with a little squash.
func _hop(sprite: Horse, at: Vector2, height: float, seconds: float) -> void:
	var tween: Tween = sprite.create_tween().set_parallel()
	tween.tween_property(sprite, "position", at - sprite.foot(), seconds)
	tween.tween_method(
		func(t: float) -> void: sprite.lift = sin(t * PI) * height, 0.0, 1.0, seconds
	)
	await tween.finished
	sprite.lift = 0.0
	sprite.squash = 0.8
	sprite.create_tween().tween_property(sprite, "squash", 1.0, 0.14).set_trans(Tween.TRANS_BACK)


## A kicked horse flies high, spinning, back to its paddock.
func _fly(sprite: Horse, at: Vector2, seconds: float) -> void:
	var height: float = sprite.size.y * 1.4
	var tween: Tween = sprite.create_tween().set_parallel()
	tween.tween_property(sprite, "position", at - sprite.foot(), seconds).set_trans(
		Tween.TRANS_SINE
	)
	tween.tween_method(
		func(t: float) -> void: sprite.lift = sin(t * PI) * height, 0.0, 1.0, seconds
	)
	tween.tween_property(sprite, "spin", TAU * 2.0, seconds)
	await tween.finished
	sprite.lift = 0.0
	sprite.spin = 0.0
	sprite.squash = 0.75
	sprite.create_tween().tween_property(sprite, "squash", 1.0, 0.18).set_trans(Tween.TRANS_BACK)


func _burst(at: Vector2, radius: float, color: Color, kind: Burst.Kind) -> void:
	var burst := Burst.new()
	burst.setup(at, radius, color, kind)
	_fx.add_child(burst)


## A team home before the game is over (Phân hạng): its plaque, "VỀ ĐÍCH!" and its place; the
## win sound when it is yours.
func _celebrate_home(seat: int) -> void:
	if seat == _me:
		_sfx("win")
	await _celebrate(seat, "", "", true)


## The end beat, from your side: you won ("VỀ NHẤT!", fireworks, the win sound), or someone else
## did (their plaque with "BẠN THUA" or your place, no fireworks, the lose sound). Spectators see
## the winner's plaque.
func _conclude() -> void:
	var winner: Variant = _view.get("winner")
	if winner == null:
		_settle()
		_show_hud(true)
		_sfx("no-move")
		return
	var seat: int = int(winner)
	if seat == _me:
		_sfx("win")
		await _celebrate(seat, "BẠN", "", true, "VỀ NHẤT!")
	elif _me >= 0:
		_sfx("lose")
		var place: int = rank_of(_view, _me)
		var ribbon: String = "BẠN HẠNG %d" % place if place > 1 else "BẠN THUA"
		await _celebrate(seat, "VỀ NHẤT", ribbon, false)
	else:
		_sfx("win")
		await _celebrate(seat, "", "", true)


## A team's plaque over the board (celebration.gd) while its four horses hop on their squares;
## `title` replaces the player's name as the plaque's big line.
func _celebrate(
	seat: int, heading: String, ribbon: String, fireworks: bool, title: String = ""
) -> void:
	if seat < 0 or seat >= _horses.size():
		return
	_settle()
	_place_horses()
	_show_hud(true)
	var color: int = int(_view["colors"][seat]) % 4
	var party := Celebration.new()
	party.setup(
		Rect2(_board.position, _board.size),
		Rules.INKS[color],
		Color("#FFE2A0") if title != "" else Rules.TINTS[color],
		title if title != "" else _seat_name(seat),
		maxi(1, rank_of(_view, seat)),
		heading,
		ribbon,
		fireworks
	)
	_fx.add_child(party)
	party.play()
	var height: float = _board.size.x * 0.03
	for round: int in 6:
		var tween: Tween = create_tween().set_parallel()
		for sprite: Horse in _horses[seat]:
			tween.tween_property(sprite, "lift", height, 0.2).set_trans(Tween.TRANS_SINE)
		tween.chain()
		for sprite: Horse in _horses[seat]:
			tween.tween_property(sprite, "lift", 0.0, 0.2).set_trans(Tween.TRANS_SINE)
		await tween.finished
		if not is_inside_tree():
			return


## The HUD catches up with the view's winner and places.
func _settle() -> void:
	_settled = {"winner": _view.get("winner"), "rankings": _view.get("rankings", [])}


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sfx and is_inside_tree():
		player.play()


# ── Status ────────────────────────────────────────────────────────────────────────────────


## The plaque, the dice, the slots and the horses home. `live` pops the tallies' new horses.
func _show_hud(live: bool) -> void:
	var turn: int = int(_view["turn"])
	var phase: String = str(_view["phase"])
	var winner: Variant = _settled["winner"]
	if winner != null:
		var who: int = int(winner)
		_plaque.set_status("Bạn thắng!" if who == _me else "%s thắng!" % _seat_name(who), GOLD)
	else:
		_plaque.set_status(
			"Lượt bạn" if turn == _me else "Lượt %s" % _seat_name(turn), Rules.TINTS[_color(turn)]
		)
	var note: String = ""
	if winner == null and not _rolling:
		if phase == "choose" and turn == _me:
			note = "Chọn ngựa"
		elif phase != "roll":
			note = str(_view.get("notice", ""))
	_plaque.set_note(note)
	_tray.visible = winner == null
	_tray.ready_to_roll = _can_play() and phase == "roll" and not _rolling
	if not _rolling and not _running:
		_tray.show_face(_dice_value())
	var timer: XomDaoRoomTimer = _snapshot.timer
	for seat: int in _slots.size():
		var slot: XomDaoPlayerSlot = _slots[seat]
		var info: XomDaoPlayerInfo = _snapshot.seats[seat]
		slot.player_name = _seat_name(seat)
		slot.frame = info.frame
		slot.picture = XomDaoLooks.avatar("bot" if info.bot else info.avatar)
		slot.host = info.id != "" and info.id == str(_snapshot.host_id)
		var place: int = rank_of(_settled, seat)
		slot.extra = "Hạng %d" % place if place > 0 else ("Rời" if info.left else "")
		var on_turn: bool = winner == null and seat == turn
		var alpha: float = 1.0
		if info.left:
			alpha = 0.4
		elif winner == null and not on_turn:
			alpha = WAITING_ALPHA
		slot.modulate.a = alpha
		_tallies[seat].modulate.a = alpha
		if on_turn and timer != null and timer.event == "timeout":
			slot.start_turn(TURN_SECONDS, maxf(0.0, TURN_SECONDS - timer.left / 1000.0))
		elif on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
		if not _running:
			var home: int = 0
			for horse: Variant in _view["horses"][seat]:
				home += 1 if bool((horse as Dictionary)["finished"]) else 0
			(_tallies[seat] as HomeTally).show_home(home, live)
	_show_selectable()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## The board as tall as the frame in the middle; the slots in the corners by their paddocks,
## each with its horses home beside it; the dice tray and the turn plaque by the slot of whoever
## is on turn; the rules book in the top right corner.
func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var column: float = COLUMN
	for slot: XomDaoPlayerSlot in _slots:
		slot.reset_size()
	var side: float = clampf(
		minf(size.y - 2.0 * edge, right - left - 2.0 * (column + 16.0)), 320.0, size.y
	)
	_board.size = Vector2.ONE * side
	_board.position = Vector2((size.x - side) / 2.0, (size.y - side) / 2.0)
	_backdrop.fit(size, Rect2(_board.position, _board.size))
	_horse_layer.size = size
	_rules_button.reset_size()
	_rules_button.position = Vector2(right - _rules_button.size.x, edge)
	if _view.is_empty():
		return
	# Each slot in the corner by its colour: red top left (under ☰), blue top right (under the
	# rules book), yellow bottom right, green bottom left.
	for seat: int in _slots.size():
		var slot: XomDaoPlayerSlot = _slots[seat]
		var color: int = _color(seat)
		var on_right: bool = color == 1 or color == 2
		var on_top: bool = color == 0 or color == 1
		slot.position = Vector2(
			right - slot.size.x if on_right else left,
			edge + MENU + 12.0 if on_top else size.y - edge - slot.size.y
		)
	_place_tallies.call_deferred()
	# The dice tray and the plaque in the column of whoever is on turn, next to their slot.
	var turn: int = int(_view["turn"])
	var turn_color: int = _color(turn)
	var turn_right: bool = turn_color == 1 or turn_color == 2
	var turn_top: bool = turn_color == 0 or turn_color == 1
	# On wide screens the column keeps to the slot's side, not the middle of the empty deck.
	var column_width: float = minf(_board.position.x - 16.0 - left, COLUMN_MAX)
	var column_left: float = right - column_width if turn_right else left
	var middle: float = column_left + column_width / 2.0
	var tray_side: float = clampf(minf(column_width * 0.62, side * 0.25), 110.0, 170.0)
	_tray.size = Vector2.ONE * tray_side
	_plaque.fit(minf(column_width, PLAQUE_WIDTH))
	var anchor: XomDaoPlayerSlot = _slots[turn] if turn < _slots.size() else null
	var tray_at := Vector2(middle - tray_side / 2.0, (size.y - tray_side) / 2.0)
	var plaque_at := Vector2(middle - _plaque.size.x / 2.0, tray_at.y + tray_side + 10.0)
	if anchor != null and turn_top:
		tray_at.y = anchor.position.y + anchor.size.y + 14.0
		plaque_at.y = tray_at.y + tray_side + 10.0
	elif anchor != null:
		tray_at.y = anchor.position.y - 14.0 - tray_side
		plaque_at.y = tray_at.y - 10.0 - _plaque.size.y
	_glide(_tray, tray_at)
	_glide(_plaque, plaque_at)
	_placed = true
	if not _running:
		_place_horses()


## Moves `node` to `at`: up or down its column it glides; to the other side of the board it
## fades out and back in there, rather than crossing the board.
func _glide(node: Control, at: Vector2) -> void:
	var heading: Vector2 = node.get_meta("heading", Vector2(-1.0e6, -1.0e6))
	if _placed and heading.distance_to(at) <= 1.0:
		return
	node.set_meta("heading", at)
	if not _placed or node.position.distance_to(at) <= 1.0 or not is_visible_in_tree():
		node.position = at
		return
	if absf(node.position.x - at.x) < 1.0:
		node.create_tween().tween_property(node, "position", at, 0.3).set_trans(Tween.TRANS_QUAD)
		return
	var swap: Tween = node.create_tween()
	swap.tween_property(node, "modulate:a", 0.0, 0.12)
	swap.tween_callback(func() -> void: node.position = at)
	swap.tween_property(node, "modulate:a", 1.0, 0.2)


## Each seat's horses home sit beside its avatar, on the board's side of the slot.
func _place_tallies() -> void:
	if _view.is_empty():
		return
	for seat: int in mini(_slots.size(), _tallies.size()):
		var slot: XomDaoPlayerSlot = _slots[seat]
		var tally: PanelContainer = _tallies[seat]
		tally.reset_size()
		var avatar: Rect2 = slot.avatar.get_global_rect()
		var y: float = avatar.get_center().y - global_position.y - tally.size.y / 2.0
		var color: int = _color(seat)
		var on_right: bool = color == 1 or color == 2
		var x: float = (
			slot.position.x - 10.0 - tally.size.x
			if on_right
			else slot.position.x + slot.size.x + 10.0
		)
		tally.position = Vector2(x, y)
