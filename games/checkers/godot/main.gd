extends Control
## Cờ Đam on the Godot client, in the **Bàn** layout (docs/experience.md): the wooden board in the
## middle, as tall as the frame, over the fishing-village harbor at dusk (CheckersBackdrop); the
## two players in the column on its left (yours at the bottom, the other under the hub's ☰), each
## with a tray of the men they took; the turn plaque (whose turn, the move, a draw offer or how
## the game ended) and Hiệu ứng at the top of the column on its right, Đầu hàng and Xin hoà at its
## bottom. It draws `snapshot.view` (View in src/game/model.ts, with your legal `moves` on your
## turn) and sends `move {path}`, `offer-draw`, `decline-draw` and `resign`.
##
## On your turn the pieces that may move have a pulsing ring. Tap one (it lifts), then the square
## to go to; a capture of several pieces is tapped one landing square at a time, and the piece it
## jumps next gets a red ring. A tap that cannot be played shakes the piece. The side that moves
## second sees the board turned round, so your pieces are always at the bottom. A move hops square
## by square, a taken piece is knocked off and flies into the taker's tray, two or more taken in
## one move show "Ăn N quân!", a new king flips over with a ring of light and a PHONG VUA! scroll,
## and at the end the winner's pieces jump in a wave while the loser's go grey (Hiệu ứng: Tắt
## skips the motion; the sounds stay).
##
## Named nodes for tests: Board, Square_<sq> (a button per dark square), Piece_<sq>, TurnPlaque,
## TurnDisc, Status, MoveCount, StatusNote, Seat_<seat>, Side_<seat>, Taken_<seat>, OfferDraw,
## DeclineDraw, Resign, Effects, CutIn, Combo.

const SIZE := 8
## The playing area's margin on the board picture (3% each side).
const FRAME := 0.03
## A piece picture's side against a square's (the disc fills 82% of its picture).
const PIECE := 0.98
const DISC := 0.82
## The side that moves first (RULES.first) and starts at the bottom.
const FIRST := "b"
const SIDE_NAMES: Dictionary = {"w": "Trắng", "b": "Đen"}
const LAST := Color("#FFE066")
const PICKED := Color("#7FD4FF")
const TARGET := Color("#3FBF7F")
const MOVABLE := Color("#FFD56B")
const VICTIM := Color("#FF6B57")
## A hop takes HOP_SECONDS plus HOP_PER_SQUARE for each square it crosses.
const HOP_SECONDS := 0.12
const HOP_PER_SQUARE := 0.09
## How high a picked piece lifts, in squares.
const PICK_LIFT := 0.08
## The player who is not on turn fades back.
const WAITING_ALPHA := 0.6
## The loser's pieces at the end.
const LOST_TINT := Color(0.55, 0.57, 0.62, 1.0)
## The hub's ☰ button keeps the top left square.
const MENU := 88.0
const COLUMN := 230.0
const BUTTON_WIDTH := 210.0
const SOUNDS: Dictionary = {
	"capture": 0.0,
	"combo": -2.0,
	"draw": 0.0,
	"illegal": -4.0,
	"lose": 0.0,
	"move": 0.0,
	"promote": 0.0,
	"select": 0.0,
	"start": 0.0,
	"turn": -8.0,
	"victory": -2.0,
}
const SETTINGS := "user://checkers.cfg"

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your side ("w", "b"), or "" for a spectator (who looks from the first side).
var _mine: String = ""
var _flip: bool = false
var _effects: bool = true

var _backdrop := CheckersBackdrop.new()
var _board := TextureRect.new()
var _marks := Control.new()
var _rings := Control.new()
var _shadows_layer := Control.new()
var _pieces_layer := Control.new()
var _squares := Control.new()
var _plaque := CheckersTurnPlaque.new()
var _skin: XomDaoTableSkin = CheckersEndBeat.skin()
var _draw: XomDaoButton = XomDaoButton.create("Xin hoà", XomDaoUi.Kind.INFO)
var _decline: XomDaoButton = XomDaoButton.create("Từ chối", XomDaoUi.Kind.BACK)
var _resign: XomDaoButton = XomDaoButton.create("Đầu hàng", XomDaoUi.Kind.DANGER)
var _effects_button: XomDaoIconButton = XomDaoIconButton.create("sparkle")
var _slots: Array[XomDaoPlayerSlot] = []
var _icons: Array[TextureRect] = []
var _trays: Array[CheckersTakenTray] = []
var _sounds: Dictionary = {}
var _textures: Dictionary = {}
var _shadow_texture: GradientTexture2D = CheckersFlourish.shadow_texture()
var _pulse: Tween

## Pieces on screen: square → TextureRect, its shadow on the board, and the letter it shows.
var _pieces: Dictionary = {}
var _shadows: Dictionary = {}
var _letters: Dictionary = {}
## The squares tapped so far for this move: the piece, then each landing square.
var _path: Array[int] = []
var _moves: Array = []
var _plies: int = -1
var _ended: bool = false
var _animating: bool = false
var _resign_armed: bool = false
## The side whose pieces went grey at the end ("" while playing).
var _dim: String = ""
## An ending this table saw happen, whose end beat has not finished yet; the beat on screen.
var _beat_pending: bool = false
var _beat: CheckersEndBeat
## Where the playing area starts on screen and one square's side.
var _origin := Vector2.ZERO
var _cell: float = 60.0


## Options for a sandbox room (`?play=checkers` in a debug build): against the computer.
func sandbox_options() -> Dictionary:
	return {"opponent": "bot"}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts).
func room_setup() -> Array:
	return [
		{"key": "opponent", "label": "Đối thủ", "options": [["Bạn bè", "human"], ["Máy", "bot"]]},
		{
			"key": "level",
			"label": "Máy chơi",
			"options": [["Dễ", "easy"], ["Vừa", "normal"], ["Khó", "hard"]],
			"default": 1,
		},
		{
			"key": "swap",
			"label": "Lượt đi",
			"options": [["Bạn đi trước", false], ["Đối thủ đi trước", true]],
		},
	]


## The hub waits for this before it shows the result board: until the last move has landed and
## the end beat is over (or skipped). This table plays the outcome sound itself.
func wait_for_result_panel() -> void:
	if _client != null and _client.snapshot != null and _client.snapshot != _snapshot:
		_show(_client.snapshot)
	var until: int = Time.get_ticks_msec() + 7000
	while is_inside_tree() and (_animating or _beat_pending) and Time.get_ticks_msec() < until:
		await get_tree().process_frame


## The hub's result board in the harbor's colours: "Thu lưới" (pulling in the nets) under the
## lantern emblem.
func result_theme() -> Dictionary:
	return CheckersEndBeat.result_theme(_art("emblem"))


## How the game ended and its figures, for the hub's result board.
func result_detail() -> Dictionary:
	# The hub may ask before this scene heard the last state.
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or _view.get("end") == null:
		return {}
	var taken: Dictionary = _view.get("taken", {})
	return {
		"reason": _plaque.note.text,
		"rows":
		[
			["Số lượt đi", str(int(_view.get("plies", 0)))],
			["Đen ăn", "%d quân" % int(taken.get("b", 0))],
			["Trắng ăn", "%d quân" % int(taken.get("w", 0))],
		],
	}


## Hub hook: the ☰ button, the seats and the buttons in the table's own materials.
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
	_effects = CheckersFlourish.load_effects(SETTINGS)
	add_child(_backdrop)

	_board.name = "Board"
	_board.texture = _art("board")
	_board.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_board.stretch_mode = TextureRect.STRETCH_SCALE
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_board)
	for layer: Control in [_marks, _rings, _shadows_layer, _pieces_layer]:
		layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(layer)
	_marks.draw.connect(_draw_marks)
	_rings.draw.connect(_draw_rings)
	_squares.name = "Squares"
	_squares.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_squares)
	for sq: int in SIZE * SIZE:
		if not _is_dark(sq):
			continue
		var square := Button.new()
		square.name = "Square_%d" % sq
		square.flat = true
		square.focus_mode = Control.FOCUS_NONE
		var clear := StyleBoxEmpty.new()
		for state: String in ["normal", "hover", "pressed", "disabled", "focus"]:
			square.add_theme_stylebox_override(state, clear)
		square.pressed.connect(_tap.bind(sq))
		_squares.add_child(square)

	add_child(_plaque)
	_draw.name = "OfferDraw"
	_draw.pressed.connect(_send.bind("offer-draw"))
	_decline.name = "DeclineDraw"
	_decline.pressed.connect(_send.bind("decline-draw"))
	_resign.name = "Resign"
	_resign.pressed.connect(_on_resign)
	_effects_button.name = "Effects"
	_effects_button.pressed.connect(_toggle_effects)
	add_child(_effects_button)
	for button: XomDaoButton in [_draw, _decline, _resign]:
		button.custom_minimum_size.x = BUTTON_WIDTH
		add_child(button)
	for seat: int in 2:
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		slot.compact = true
		add_child(slot)
		_slots.append(slot)
		var icon := TextureRect.new()
		icon.name = "Side_%d" % seat
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.custom_minimum_size = Vector2(44.0, 44.0)
		icon.size = icon.custom_minimum_size
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(icon)
		_icons.append(icon)
		# The badge follows the avatar once its container has laid it out.
		slot.item_rect_changed.connect(_place_icons)
		slot.avatar.item_rect_changed.connect(_place_icons)
		var tray := CheckersTakenTray.new()
		tray.name = "Taken_%d" % seat
		add_child(tray)
		_trays.append(tray)
	_skin.dress_all([_plaque, _effects_button, _draw, _decline, _resign] + _slots)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.bus = XomDaoSettings.SFX_BUS
		player.stream = load("res://content/checkers/sounds/%s.wav" % sound)
		player.volume_db = float(SOUNDS[sound])
		player.max_polyphony = 4
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	var players: Array = view.get("players", [])
	_mine = ""
	if players.size() == 2:
		if str(players[0]) == _client.player_id:
			_mine = FIRST
		elif str(players[1]) == _client.player_id:
			_mine = _other(FIRST)
	var flip: bool = _mine == _other(FIRST)
	var plies: int = int(view.get("plies", 0))
	var first: bool = _view.is_empty()
	var fresh: bool = plies == 0 and (_plies != 0 or first)
	var last: Variant = view.get("last")
	var animate: bool = (
		_effects
		and not _animating
		and plies == _plies + 1
		and flip == _flip
		and last is Dictionary
		and is_inside_tree()
		and _letters.has(int((last as Dictionary)["path"][0]))
	)
	var moved: bool = plies == _plies + 1 and last is Dictionary
	_view = view
	_moves = view.get("moves", [])
	if flip != _flip:
		_flip = flip
		_layout()
	if fresh:
		_clear_pieces()
		_dim = ""
		_sfx("start")
	if animate:
		_play_move(last as Dictionary, plies)
	elif not _animating:
		_sync_pieces()
		if moved:
			_sfx(_move_sound(last as Dictionary))
			_after_move()
	_plies = plies
	if not _path.is_empty() and not _moves.any(_starts_with.bind(_path)):
		_path.clear()
		_place_pieces()
	_show_seats()
	_show_status()
	_show_buttons()
	var ended: bool = view.get("end") != null
	if ended and not _ended:
		# A game already over when this table first saw it gets no end beat.
		_beat_pending = not first
		if not _animating:
			_finish(view["end"] as Dictionary)
	elif not ended:
		_dim = ""
		_beat_pending = false
		if _beat != null:
			_beat.skip()
	_ended = ended
	_plaque.move_count.text = "Nước %d" % (plies / 2 + 1)
	_refresh_marks()


# ── Board ─────────────────────────────────────────────────────────────────────────────────


## A square's top-left corner on screen (turned round for the side moving second).
func _square_at(sq: int) -> Vector2:
	var row: int = sq / SIZE
	var col: int = sq % SIZE
	if _flip:
		row = SIZE - 1 - row
		col = SIZE - 1 - col
	return _origin + Vector2(col, row) * _cell


func _center_of(sq: int) -> Vector2:
	return _square_at(sq) + Vector2.ONE * _cell / 2.0


## A piece picture's box on its square, `lift` squares up off the board.
func _piece_rect(sq: int, lift: float = 0.0) -> Rect2:
	var side: float = _cell * PIECE
	var at: Vector2 = _square_at(sq) + Vector2.ONE * (_cell - side) / 2.0
	return Rect2(at - Vector2(0.0, lift * _cell), Vector2(side, side))


func _texture_of(letter: String) -> Texture2D:
	var art: String = (
		"piece-%s-%s"
		% [
			"white" if letter.to_lower() == "w" else "black",
			"king" if letter == letter.to_upper() else "man"
		]
	)
	return _art(art)


func _art(name_of: String) -> Texture2D:
	if not _textures.has(name_of):
		_textures[name_of] = load("res://content/checkers/art/%s.webp" % name_of)
	return _textures[name_of]


## A piece's shadow box under a piece box (`rest`), smaller and fainter the higher it is.
func _shadow_rect(rest: Rect2) -> Rect2:
	var side: float = rest.size.x * DISC * 1.12
	var center: Vector2 = rest.get_center() + Vector2(0.05, 0.08) * _cell
	return Rect2(center - Vector2.ONE * side / 2.0, Vector2.ONE * side)


func _clear_pieces() -> void:
	for sq: int in _pieces.keys():
		(_pieces[sq] as TextureRect).queue_free()
		(_shadows[sq] as TextureRect).queue_free()
	_pieces.clear()
	_shadows.clear()
	_letters.clear()
	_path.clear()


func _drop_piece(sq: int) -> void:
	_pieces.erase(sq)
	_shadows.erase(sq)
	_letters.erase(sq)


## Makes the pieces on screen match the board, without animation.
func _sync_pieces() -> void:
	var board: String = str(_view.get("board", ""))
	for sq: int in _pieces.keys():
		if sq < board.length() and board[sq] == _letters[sq]:
			continue
		(_pieces[sq] as TextureRect).queue_free()
		(_shadows[sq] as TextureRect).queue_free()
		_drop_piece(sq)
	for sq: int in board.length():
		var letter: String = board[sq]
		if letter == "." or _pieces.has(sq):
			continue
		var shadow := TextureRect.new()
		shadow.texture = _shadow_texture
		shadow.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		shadow.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_shadows_layer.add_child(shadow)
		var piece := TextureRect.new()
		piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_pieces_layer.add_child(piece)
		_pieces[sq] = piece
		_shadows[sq] = shadow
		_letters[sq] = letter
	_place_pieces()


## Every piece on its square (the picked one lifted), with its shadow.
func _place_pieces() -> void:
	var picked: int = _path[0] if not _path.is_empty() else -1
	for sq: int in _pieces.keys():
		var piece: TextureRect = _pieces[sq]
		var lift: float = PICK_LIFT if sq == picked else 0.0
		var rect: Rect2 = _piece_rect(sq, lift)
		piece.name = "Piece_%d" % sq
		piece.texture = _texture_of(_letters[sq])
		piece.position = rect.position
		piece.size = rect.size
		piece.pivot_offset = rect.size / 2.0
		piece.scale = Vector2.ONE * (1.06 if lift > 0.0 else 1.0)
		piece.rotation = 0.0
		var shadow: TextureRect = _shadows[sq]
		var under: Rect2 = _shadow_rect(_piece_rect(sq))
		shadow.position = under.position + Vector2(0.03, 0.05) * _cell * (lift / PICK_LIFT)
		shadow.size = under.size
		shadow.pivot_offset = under.size / 2.0
		shadow.scale = Vector2.ONE * (1.0 + lift)
		shadow.modulate.a = 1.0 - lift * 3.0
	_tint_pieces()


## The loser's pieces grey at the end; the pieces the picked one has jumped so far faded.
func _tint_pieces() -> void:
	var jumped: Array[int] = []
	var matching: Array = [] if _path.is_empty() else _moves.filter(_starts_with.bind(_path))
	if not matching.is_empty():
		var captures: Array = (matching[0] as Dictionary).get("captures", [])
		for i: int in mini(_path.size() - 1, captures.size()):
			jumped.append(int(captures[i]))
	for sq: int in _pieces.keys():
		var tint: Color = Color.WHITE
		if _dim != "" and _side_of(_letters[sq]) == _dim:
			tint = LOST_TINT
		if jumped.has(sq):
			tint.a = 0.4
		(_pieces[sq] as TextureRect).modulate = tint


## The last move on screen: the piece hops square by square (higher over a piece it takes), each
## taken piece is knocked off and flies into the taker's tray, a new king flips over. Taps wait
## until it is over.
func _play_move(last: Dictionary, plies: int) -> void:
	var path: Array = last.get("path", [])
	var captures: Array = last.get("captures", [])
	var from: int = int(path[0])
	var to: int = int(path[path.size() - 1])
	var moving: TextureRect = _pieces[from]
	var moving_shadow: TextureRect = _shadows[from]
	var letter: String = str(_letters[from])
	var victims: Array[TextureRect] = []
	var victim_shadows: Array[TextureRect] = []
	for sq: Variant in captures:
		if _pieces.has(int(sq)):
			victims.append(_pieces[int(sq)])
			victim_shadows.append(_shadows[int(sq)])
			_drop_piece(int(sq))
	_drop_piece(from)
	_animating = true
	_path.clear()
	_refresh_marks()
	moving.move_to_front()
	var seat: int = 0 if _side_at_bottom() == _side_of(letter) else 1
	var tray: CheckersTakenTray = _trays[seat]
	var in_tray: int = tray.count
	var shadow_offset: Vector2 = moving_shadow.position - moving.position
	for i: int in range(1, path.size()):
		var a: Vector2 = _piece_rect(int(path[i - 1])).position
		var b: Vector2 = _piece_rect(int(path[i])).position
		var jump: bool = i - 1 < victims.size()
		var squares: float = a.distance_to(b) / (_cell * 1.414)
		var height: float = _cell * (0.42 if jump else 0.16)
		var seconds: float = HOP_SECONDS + HOP_PER_SQUARE * squares
		var hop: Callable = func(t: float) -> void:
			var up: float = sin(PI * t)
			moving.position = a.lerp(b, t) - Vector2(0.0, up * height)
			moving.scale = Vector2.ONE * (1.0 + 0.14 * up)
			moving_shadow.position = a.lerp(b, t) + shadow_offset + Vector2(0.4, 0.6) * up * height
			moving_shadow.scale = Vector2.ONE * (1.0 + 0.3 * up)
			moving_shadow.modulate.a = 1.0 - 0.55 * up
		var tween: Tween = moving.create_tween()
		tween.tween_method(hop, 0.0, 1.0, seconds).set_trans(Tween.TRANS_SINE)
		await tween.finished
		if not is_inside_tree():
			return
		CheckersFlourish.land(moving)
		if jump:
			tray.texture = _texture_of(_other(_side_of(letter)))
			# Over the trays and seats while it flies.
			victims[i - 1].reparent(self)
			CheckersFlourish.knock_off(
				victims[i - 1], victim_shadows[i - 1], tray, in_tray + i - 1, _cell * 0.9
			)
			_sfx("capture", 1.0 + 0.1 * (i - 1))
		else:
			_sfx("move")
	var crowned: bool = bool(last.get("crowned", false))
	_pieces[to] = moving
	_shadows[to] = moving_shadow
	# The board may already be a move further on (the reply came in meanwhile); the piece keeps
	# its own letter and _sync_pieces below catches up with the board.
	_letters[to] = letter.to_upper() if crowned else letter
	moving.texture = _texture_of(letter)
	if captures.size() >= 2:
		_sfx("combo")
		CheckersFlourish.combo(self, captures.size(), _center_of(to), _cell, _board_rect())
	if crowned:
		await _crown(moving, _center_of(to), letter.to_upper())
		if not is_inside_tree():
			return
	_place_pieces()
	_animating = false
	_show_seats()
	if plies == int(_view.get("plies", 0)):
		_after_move()
	# A reply that came in meanwhile plays next.
	var next: Variant = _view.get("last")
	if (
		int(_view.get("plies", 0)) == plies + 1
		and next is Dictionary
		and _letters.has(int((next as Dictionary)["path"][0]))
	):
		_play_move(next as Dictionary, plies + 1)
		return
	_sync_pieces()
	_refresh_marks()
	if _view.get("end") is Dictionary:
		_finish(_view["end"] as Dictionary)


## A new king: the piece flips over to its crowned face inside a ring of light and a burst of
## sparkles, and a PHONG VUA! scroll unrolls over the board.
func _crown(piece: TextureRect, at: Vector2, king: String) -> void:
	_sfx("promote")
	CheckersFlourish.crown_ring(self, at, _cell)
	CheckersFlourish.sparkles(self, at, _cell)
	CheckersFlourish.cut_in(self, _texture_of(king), _board_rect())
	var tween: Tween = piece.create_tween()
	tween.tween_property(piece, "scale", Vector2(0.0, 1.15), 0.12).set_trans(Tween.TRANS_SINE)
	tween.tween_callback(func() -> void: piece.texture = _texture_of(king))
	tween.tween_property(piece, "scale", Vector2(1.2, 1.2), 0.14).set_trans(Tween.TRANS_SINE)
	tween.tween_property(piece, "scale", Vector2.ONE, 0.16).set_trans(Tween.TRANS_BACK)
	await tween.finished


func _board_rect() -> Rect2:
	return Rect2(_board.position, _board.size)


func _move_sound(last: Dictionary) -> String:
	if bool(last.get("crowned", false)):
		return "promote"
	var captures: Array = last.get("captures", [])
	if captures.size() >= 2:
		return "combo"
	return "capture" if not captures.is_empty() else "move"


## After a move lands: the "your turn" chime.
func _after_move() -> void:
	if str(_view.get("turn", "")) == _mine and _view.get("end") == null and is_inside_tree():
		get_tree().create_timer(0.2).timeout.connect(_sfx.bind("turn"))


## The game is over (once the last move has landed). An ending this table saw happen gets its
## sound and end beat; the loser's pieces go grey and the winner's jump in a wave from the middle.
func _finish(end: Dictionary) -> void:
	var winner: Variant = end.get("winner")
	if _beat_pending and _beat == null:
		var outcome: CheckersEndBeat.Outcome = CheckersEndBeat.outcome_of(winner, _mine)
		_sfx(CheckersEndBeat.sound_of(outcome))
		var title: String = _outcome_title(winner)
		_beat = CheckersEndBeat.play(
			self, outcome, title, _plaque.note.text, _board_rect(), _art("emblem"), _effects
		)
		_beat.done.connect(func() -> void: _beat_pending = false)
		_beat.tree_exited.connect(func() -> void: _beat = null)
	_dim = "" if winner == null else _other(str(winner))
	_tint_pieces()
	if winner == null or not _effects:
		return
	var middle: Vector2 = _board.position + _board.size / 2.0
	for sq: int in _pieces.keys():
		if _side_of(_letters[sq]) == str(winner):
			var piece: TextureRect = _pieces[sq]
			var delay: float = piece.position.distance_to(middle) / _cell * 0.07
			CheckersFlourish.hop(piece, delay, _cell * 0.3)


func _outcome_title(winner: Variant) -> String:
	var title: String = CheckersEndBeat.title_of(CheckersEndBeat.outcome_of(winner, _mine))
	return title if title != "" else "%s thắng" % _name_of(str(winner))


## A tap that cannot be played: the piece shakes and the "no" knock sounds.
func _reject(sq: int) -> void:
	_sfx("illegal")
	var piece: TextureRect = _pieces.get(sq)
	if piece == null or _animating:
		return
	CheckersFlourish.shake(piece, _piece_rect(sq).position.x)


## Redraws the marks and the movable rings, pulsing the rings while you may move.
func _refresh_marks() -> void:
	_marks.queue_redraw()
	_rings.queue_redraw()
	var pulsing: bool = _effects and not _animating and _path.is_empty() and not _moves.is_empty()
	if pulsing and _pulse == null:
		_pulse = _rings.create_tween().set_loops()
		_pulse.tween_property(_rings, "modulate:a", 0.45, 0.6).set_trans(Tween.TRANS_SINE)
		_pulse.tween_property(_rings, "modulate:a", 1.0, 0.6).set_trans(Tween.TRANS_SINE)
	elif not pulsing and _pulse != null:
		_pulse.kill()
		_pulse = null
		_rings.modulate.a = 1.0


## The last move's squares and its trail; the picked piece, the squares it has landed on so far,
## the piece it jumps next and where it may go next.
func _draw_marks() -> void:
	var last: Variant = _view.get("last")
	if last is Dictionary:
		var path: Array = (last as Dictionary).get("path", [])
		for sq: Variant in path:
			_marks.draw_rect(Rect2(_square_at(int(sq)), Vector2.ONE * _cell), Color(LAST, 0.26))
		var width: float = maxf(2.0, _cell * 0.05)
		for i: int in range(1, path.size()):
			_marks.draw_line(
				_center_of(int(path[i - 1])),
				_center_of(int(path[i])),
				Color(LAST, 0.5),
				width,
				true
			)
		if not path.is_empty():
			_marks.draw_circle(
				_center_of(int(path[0])), _cell * 0.1, Color(LAST, 0.6), true, -1.0, true
			)
	_tint_pieces()
	if _animating or _path.is_empty():
		return
	for sq: int in _path:
		_marks.draw_rect(Rect2(_square_at(sq), Vector2.ONE * _cell), Color(PICKED, 0.4))
	var width_ring: float = maxf(2.0, _cell * 0.06)
	for move: Dictionary in _moves.filter(_starts_with.bind(_path)):
		var path: Array = move["path"]
		if path.size() <= _path.size():
			continue
		var captures: Array = move.get("captures", [])
		if _path.size() - 1 < captures.size():
			var victim: Vector2 = _center_of(int(captures[_path.size() - 1]))
			_marks.draw_arc(
				victim, _cell * 0.45, 0.0, TAU, 40, Color(VICTIM, 0.95), width_ring, true
			)
		var center: Vector2 = _center_of(int(path[_path.size()]))
		_marks.draw_circle(center, _cell * 0.2, Color(TARGET, 0.35), true, -1.0, true)
		_marks.draw_circle(center, _cell * 0.13, Color(TARGET, 0.85), true, -1.0, true)


## On your turn, a gold ring round each piece that may move.
func _draw_rings() -> void:
	if _animating or not _path.is_empty():
		return
	var width: float = maxf(2.0, _cell * 0.06)
	for start: int in _starts():
		_rings.draw_arc(
			_center_of(start), _cell * 0.47, 0.0, TAU, 40, Color(MOVABLE, 0.95), width, true
		)


## The squares of the pieces that may move now.
func _starts() -> Array[int]:
	var out: Array[int] = []
	for move: Dictionary in _moves:
		var start: int = int((move["path"] as Array)[0])
		if not out.has(start):
			out.append(start)
	return out


static func _starts_with(move: Dictionary, prefix: Array[int]) -> bool:
	var path: Array = move["path"]
	if path.size() < prefix.size():
		return false
	for i: int in prefix.size():
		if int(path[i]) != prefix[i]:
			return false
	return true


## A tap on a dark square: pick a piece that may move, or the next square of its move (the move
## is sent once the tapped squares make a whole move), or drop the pick. A tap on your own piece
## that cannot move, or on a square the picked piece cannot reach, shakes the piece.
func _tap(sq: int) -> void:
	if _animating:
		return
	var own: bool = _mine != "" and _letters.has(sq) and _side_of(_letters[sq]) == _mine
	if _moves.is_empty():
		if own and _view.get("end") == null:
			_reject(sq)
		return
	var extended: Array[int] = _path.duplicate()
	extended.append(sq)
	var matching: Array = [] if _path.is_empty() else _moves.filter(_starts_with.bind(extended))
	if not matching.is_empty():
		var whole: Array = matching.filter(
			func(m: Dictionary) -> bool: return (m["path"] as Array).size() == extended.size()
		)
		if whole.size() == 1 and matching.size() == 1:
			_path.clear()
			_moves = []
			_refresh_marks()
			await _client.send("move", {"path": extended})
			return
		_path = extended
		_sfx("select")
	elif _starts().has(sq):
		_sfx("select")
		if _path.size() == 1 and _path[0] == sq:
			_path.clear()
		else:
			_path = [sq]
	elif own or not _path.is_empty():
		_reject(sq if own else _path[0])
		_path.clear()
	_place_pieces()
	_refresh_marks()


# ── Players, status and buttons ───────────────────────────────────────────────────────────


static func _other(side: String) -> String:
	return "w" if side == "b" else "b"


static func _side_of(letter: String) -> String:
	return "w" if letter.to_lower() == "w" else "b"


static func _is_dark(sq: int) -> bool:
	return (sq / SIZE + sq % SIZE) % 2 == 1


func _side_at_bottom() -> String:
	return _other(FIRST) if _flip else FIRST


## The id playing a side.
func _player_of(side: String) -> String:
	var players: Array = _view.get("players", [])
	if players.size() < 2:
		return ""
	return str(players[0 if side == FIRST else 1])


func _name_of(side: String) -> String:
	var id: String = _player_of(side)
	if id == _client.player_id:
		return "Bạn"
	if _snapshot != null:
		for player: XomDaoPlayerInfo in _snapshot.seats + _snapshot.players:
			if player.id == id:
				return player.name
	return str(SIDE_NAMES[side])


## Slot 0 is the side at the bottom (yours), slot 1 the other: avatar, wins, the side's man as a
## badge and the tray of the men it took. The player who is waiting fades back.
func _show_seats() -> void:
	var taken: Dictionary = _view.get("taken", {})
	var playing: bool = _view.get("end") == null and _snapshot.status == "playing"
	for i: int in 2:
		var side: String = _side_at_bottom() if i == 0 else _other(_side_at_bottom())
		var id: String = _player_of(side)
		var slot: XomDaoPlayerSlot = _slots[i]
		slot.player_name = _name_of(side)
		slot.host = id != "" and id == str(_snapshot.host_id)
		var wins: int = 0
		for seat: XomDaoPlayerInfo in _snapshot.seats:
			if seat.id == id:
				slot.frame = seat.frame
				slot.picture = XomDaoLooks.avatar("bot" if seat.bot else seat.avatar)
		# The room's score counts wins by place in `players`.
		for i_player: int in _snapshot.players.size():
			var counted: bool = _snapshot.score != null and i_player < _snapshot.score.wins.size()
			if counted and _snapshot.players[i_player].id == id:
				wins = _snapshot.score.wins[i_player]
		slot.extra = "Thắng %d" % wins
		var on_turn: bool = playing and str(_view.get("turn", "")) == side
		if on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
		var alpha: float = WAITING_ALPHA if playing and not on_turn else 1.0
		for faded: CanvasItem in [slot, _icons[i], _trays[i]]:
			faded.modulate.a = alpha
		_icons[i].texture = _texture_of(side)
		# A taken piece reaches the tray when it lands there.
		if not _animating:
			_trays[i].texture = _texture_of(_other(side))
			_trays[i].count = int(taken.get(side, 0))
	# A longer count can widen the seats' column.
	_layout()


func _show_status() -> void:
	var end: Variant = _view.get("end")
	var turn: String = str(_view.get("turn", FIRST))
	_plaque.disc.visible = true
	if end is Dictionary:
		var winner: Variant = (end as Dictionary).get("winner")
		var loser: String = _name_of(_other(str(winner))) if winner != null else ""
		var how: String = CheckersTurnPlaque.how_ended(
			str((end as Dictionary).get("reason", "")), loser
		)
		_plaque.status.text = "%s thắng" % _name_of(str(winner)) if winner != null else "Hoà"
		_plaque.disc.visible = winner != null
		if winner != null:
			_plaque.disc.texture = _texture_of(str(winner).to_upper())
		_plaque.set_note(how, XomDaoUi.CREAM)
		return
	_plaque.disc.texture = _texture_of(turn)
	var offer: Variant = _view.get("drawOffer")
	if offer != null and _mine != "" and str(offer) != _mine:
		_plaque.set_note("%s xin hoà" % _name_of(str(offer)), XomDaoUi.SUN)
	elif offer != null and str(offer) == _mine:
		_plaque.set_note("Đang chờ trả lời hoà", Color(XomDaoUi.CREAM, 0.8))
	else:
		_plaque.set_note("", XomDaoUi.CREAM)
	_plaque.status.text = "Tới lượt bạn" if turn == _mine else "Lượt %s" % _name_of(turn)


func _show_buttons() -> void:
	var playing: bool = _mine != "" and _view.get("end") == null and _snapshot.status == "playing"
	var offer: Variant = _view.get("drawOffer")
	var offered: bool = playing and offer != null and str(offer) != _mine
	var vs_bot: bool = false
	for player: XomDaoPlayerInfo in _snapshot.seats:
		vs_bot = vs_bot or player.bot
	_draw.visible = playing and not vs_bot
	_draw.text = (
		"Đồng ý hoà"
		if offered
		else ("Đã xin hoà" if offer != null and str(offer) == _mine else "Xin hoà")
	)
	_draw.disabled = offer != null and str(offer) == _mine
	_decline.visible = offered
	_resign.visible = playing
	if not playing:
		_resign_armed = false
	_resign.text = "Chắc chưa?" if _resign_armed else "Đầu hàng"
	_show_effects()
	_layout.call_deferred()


func _send(event: String) -> void:
	await _client.send(event)


## Đầu hàng asks once more ("Chắc chưa?") for three seconds.
func _on_resign() -> void:
	if _resign_armed:
		_resign_armed = false
		_resign.text = "Đầu hàng"
		await _client.send("resign")
		return
	_resign_armed = true
	_resign.text = "Chắc chưa?"
	await get_tree().create_timer(3.0).timeout
	if _resign_armed:
		_resign_armed = false
		_resign.text = "Đầu hàng"


func _toggle_effects() -> void:
	_effects = not _effects
	CheckersFlourish.save_effects(SETTINGS, _effects)
	_show_effects()
	XomDaoToast.show_on(self, "Hiệu ứng: %s" % ("Bật" if _effects else "Tắt"), "sparkle")
	_refresh_marks()


## Hiệu ứng is a sparkle: bright while the motion is on, faded while it is off.
func _show_effects() -> void:
	_effects_button.modulate.a = 1.0 if _effects else 0.45


func _sfx(sound: String, pitch: float = 1.0) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sfx and is_inside_tree():
		player.pitch_scale = pitch
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## The board as tall as the frame in the middle; the players' column on its left, the turn
## plaque and buttons' column on its right.
func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	# The board takes what the two columns leave: the seats on the left, the buttons on the right.
	var seats_width: float = COLUMN
	for slot: XomDaoPlayerSlot in _slots:
		slot.reset_size()
		seats_width = maxf(seats_width, slot.size.x)
	var buttons_width: float = BUTTON_WIDTH
	for button: XomDaoButton in [_resign, _decline, _draw]:
		button.reset_size()
		buttons_width = maxf(buttons_width, button.size.x)
	var room: float = right - left - seats_width - buttons_width - 32.0
	var side: float = clampf(minf(size.y - 2.0 * edge, room), 240.0, size.y)
	var between: float = left + seats_width + 16.0
	var board_at := Vector2(between + maxf(0.0, (room - side) / 2.0), (size.y - side) / 2.0)
	_board.position = board_at
	_board.size = Vector2(side, side)
	_backdrop.fit(size, Rect2(board_at, _board.size))
	_cell = side * (1.0 - 2.0 * FRAME) / SIZE
	_origin = board_at + Vector2.ONE * side * FRAME
	for layer: Control in [_marks, _rings, _shadows_layer, _pieces_layer, _squares]:
		layer.position = Vector2.ZERO
		layer.size = size
	for square: Button in _squares.get_children():
		var sq: int = int(str(square.name).trim_prefix("Square_"))
		square.position = _square_at(sq)
		square.size = Vector2.ONE * _cell
	if not _animating:
		_place_pieces()
	# Left column: the other player under ☰ with their tray below, yours at the bottom with your
	# tray above.
	for i: int in 2:
		var slot: XomDaoPlayerSlot = _slots[i]
		var y: float = size.y - edge - slot.size.y if i == 0 else edge + MENU + 12.0
		slot.position = Vector2(left, y)
		var tray: CheckersTakenTray = _trays[i]
		var tray_y: float = y - tray.size.y - 14.0 if i == 0 else y + slot.size.y + 14.0
		tray.position = Vector2(left, tray_y)
	_place_icons.call_deferred()
	# Right column: the turn plaque and Hiệu ứng at the top, the buttons at the bottom; Đầu hàng
	# stands apart above the others.
	var column_left: float = board_at.x + side + 16.0
	var width: float = maxf(right - column_left, BUTTON_WIDTH)
	_plaque.fit(width)
	_plaque.position = Vector2(right - width, edge)
	_effects_button.reset_size()
	_effects_button.position = Vector2(right - _effects_button.size.x, edge + _plaque.size.y + 12.0)
	var y: float = size.y - edge
	for button: XomDaoButton in [_draw, _decline, _resign]:
		if not button.visible:
			continue
		button.reset_size()
		if button == _resign and y < size.y - edge:
			y -= 28.0
		y -= button.size.y
		button.position = Vector2(right - button.size.x, y)
		y -= 10.0
	_refresh_marks()


## Each side's man sits on its player's avatar like a badge, at the top right (the host's crown
## has the top left), once the slots have laid out.
func _place_icons() -> void:
	for i: int in _slots.size():
		var avatar: Control = _slots[i].avatar
		var icon: TextureRect = _icons[i]
		var corner := Vector2(avatar.size.x - icon.size.x * 0.62, -icon.size.y * 0.3)
		icon.position = avatar.global_position - global_position + corner
