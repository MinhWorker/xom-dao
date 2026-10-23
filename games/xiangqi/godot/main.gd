extends Control
## Cờ Tướng on the Godot client, in the **Bàn** layout (docs/experience.md): the walnut table in
## the middle, as tall as the frame, over the night lotus pond (XiangqiBackdrop); the two
## players in the column on its left (yours at the bottom, the other under the hub's ☰), each with
## a tray of the pieces they took; the turn plaque (whose turn, the move, check) and Hiệu ứng at
## the top of the column on its right, Đầu hàng and Xin hoà at its bottom. It draws
## `snapshot.view` (View in src/game/model.ts, with your legal `moves` on your turn) and sends
## `move {from, to}`, `offer-draw`, `decline-draw` and `resign`.
##
## Tap one of your pieces (it lifts), then a dotted point (a ring marks a piece you can take).
## Black's player sees the board turned round. The last move is marked gold, a general in check
## gets a pulsing red ring. A move slides; a taken piece is struck and breaks apart, and a check
## shows a CHIẾU TƯỚNG! scroll. When the game ends the beaten general topples and a seal stamps how
## (XiangqiFinale, which the hub waits for). Hiệu ứng: Tắt skips the motion, the sounds stay.
##
## Named nodes for tests: Board, Square_<sq> (a button per point, sq = row * 9 + col from
## Black's side), Piece_<sq>, TurnPlaque, Status, MoveCount, StatusNote, Seat_<seat>,
## General_<seat>, Taken_<seat>, OfferDraw, DeclineDraw, Resign, Effects, CheckRing, CutIn,
## Finale with EndSeal, EndHeadline and EndLine.

const COLS := 9
const ROWS := 10
## The board picture as a 900 × 1000 design rectangle: the first point and the gap between points.
const BOARD := Vector2(900.0, 1000.0)
const FIRST_POINT := Vector2(74.0, 77.0)
const GAP := 94.0
## A piece's disc as a share of its picture, its width in gaps and how far above its point it
## stands (in gaps).
const DISC := 0.5875
const PIECE_WIDTH := 0.9
const STAND := 0.1
const PICK_LIFT := 0.14
## Red moves first and starts at the bottom.
const FIRST := "r"
const SIDE_NAMES: Dictionary = {"r": "Đỏ", "b": "Đen"}
const ART: Dictionary = {
	"k": "general",
	"a": "advisor",
	"b": "elephant",
	"n": "horse",
	"r": "chariot",
	"c": "cannon",
	"p": "soldier",
}
const LINE := Color("#5C2D12")
const LAST := Color("#FFE066")
const PICKED := Color("#7FD4FF")
const TARGET := Color("#2E9D57")
const CHECK := Color("#FF3B30")
const SLIDE_SECONDS := 0.24
## The hub's ☰ button keeps the top left square.
const MENU := 88.0
const COLUMN := 230.0
const BUTTON_WIDTH := 210.0
## The player who is not on turn fades back.
const WAITING_ALPHA := 0.6
const NOTE := Color("#FF8A7A")
const SOUNDS: Array[String] = [
	"capture",
	"capture-heavy",
	"check",
	"checkmate",
	"draw",
	"illegal",
	"lose",
	"move",
	"piece-select",
	"shatter",
	"start",
	"turn",
	"victory",
]
const SETTINGS := "user://xiangqi.cfg"

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your side ("r", "b"), or "" for a spectator (who looks from Red's side).
var _mine: String = ""
var _flip: bool = false
var _effects: bool = true

var _backdrop := XiangqiBackdrop.new()
var _board := TextureRect.new()
var _lines := Control.new()
var _river := TextureRect.new()
var _marks := Control.new()
var _check_ring := Control.new()
var _shadows_layer := Control.new()
var _pieces_layer := Control.new()
var _squares := Control.new()
var _plaque := XiangqiTurnPlaque.new()
var _skin: XomDaoTableSkin = XiangqiFinale.skin()
var _draw: XomDaoButton = XomDaoButton.create("Xin hoà", XomDaoUi.Kind.INFO)
var _decline: XomDaoButton = XomDaoButton.create("Từ chối", XomDaoUi.Kind.BACK)
var _resign: XomDaoButton = XomDaoButton.create("Đầu hàng", XomDaoUi.Kind.DANGER)
var _effects_button: XomDaoIconButton = XomDaoIconButton.create("sparkle")
var _slots: Array[XomDaoPlayerSlot] = []
var _icons: Array[TextureRect] = []
var _trays: Array[XiangqiTakenTray] = []
var _finale := XiangqiFinale.new()
var _sounds: Dictionary = {}
var _textures: Dictionary = {}
var _pulse: Tween

## Pieces on screen: point → TextureRect, its shadow on the table, and the letter it shows.
var _pieces: Dictionary = {}
var _shadows: Dictionary = {}
var _letters: Dictionary = {}
## The picked piece's point (-1: none), and the beaten general's once the game is over.
var _picked: int = -1
var _fallen: int = -1
var _moves: Array = []
var _plies: int = -1
var _ended: bool = false
var _animating: bool = false
var _resign_armed: bool = false
## Where the first point is on screen and the gap between two points.
var _origin := Vector2.ZERO
var _gap: float = 60.0


## Options for a sandbox room (`?play=xiangqi` in a debug build): against the computer.
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
			"label": "Bạn cầm quân",
			"options": [["Đỏ (đi trước)", false], ["Đen", true]],
		},
	]


## How the game ended and its figures, for the hub's result board.
func result_detail() -> Dictionary:
	# The hub may ask before this scene heard the last state.
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or _view.get("end") == null:
		return {}
	return {
		"reason": _plaque.note.text,
		"rows":
		[
			["Số nước", str(int(_view.get("plies", 0)))],
			["Đỏ ăn", "%d quân" % _taken_by("r")],
			["Đen ăn", "%d quân" % _taken_by("b")],
		],
	}


## Hub hook: the result board waits for the end beat.
func wait_for_result_panel() -> void:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	await _finale.wait()


## Hub hook: the result board in the table's colors, with a seal on top.
func result_theme() -> Dictionary:
	return XiangqiFinale.theme(_view)


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
	_effects = _load_effects()
	add_child(_backdrop)

	_board.name = "Board"
	_board.texture = _art("board")
	_board.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_board.stretch_mode = TextureRect.STRETCH_SCALE
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_board)
	_lines.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_lines.draw.connect(_draw_lines)
	add_child(_lines)
	_river.texture = _art("river")
	_river.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_river.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_river)
	_marks.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_marks.draw.connect(_draw_marks)
	add_child(_marks)
	_check_ring.name = "CheckRing"
	_check_ring.visible = false
	_check_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_check_ring.draw.connect(
		func() -> void:
			var width: float = maxf(2.0, 0.1 * _gap)
			_check_ring.draw_arc(Vector2.ZERO, 0.62 * _gap, 0.0, TAU, 48, CHECK, width, true)
	)
	add_child(_check_ring)
	_shadows_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_shadows_layer)
	_pieces_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_pieces_layer)
	_squares.name = "Squares"
	_squares.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_squares)
	for sq: int in COLS * ROWS:
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
		icon.name = "General_%d" % seat
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.custom_minimum_size = Vector2(48.0, 48.0)
		icon.size = icon.custom_minimum_size
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(icon)
		_icons.append(icon)
		# The badge follows the avatar once its container has laid it out.
		slot.item_rect_changed.connect(_place_icons)
		slot.avatar.item_rect_changed.connect(_place_icons)
		var tray := XiangqiTakenTray.new()
		tray.name = "Taken_%d" % seat
		add_child(tray)
		_trays.append(tray)
	_skin.dress_all([_plaque, _effects_button, _draw, _decline, _resign] + _slots)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.bus = XomDaoSettings.SFX_BUS
		var path: String = (
			"res://content/xiangqi/sounds/%s.%s" % [sound, "mp3" if sound == "victory" else "wav"]
		)
		player.stream = load(path)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	add_child(_finale)
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
	var fresh: bool = plies == 0 and (_plies != 0 or _view.is_empty())
	var last: Variant = view.get("last")
	var animate: bool = (
		_effects
		and not _animating
		and plies == _plies + 1
		and flip == _flip
		and last is Dictionary
		and is_inside_tree()
		and _letters.has(int((last as Dictionary)["from"]))
	)
	var moved: bool = plies == _plies + 1 and last is Dictionary
	var seen: bool = not _view.is_empty()
	_view = view
	_moves = view.get("moves", [])
	if flip != _flip:
		_flip = flip
		_layout()
	if fresh:
		_clear_pieces()
		_finale.reset()
		_fallen = -1
		_sfx("start")
	if animate:
		_play_move(last as Dictionary, plies)
	elif not _animating:
		_sync_pieces()
		if moved:
			_sfx(_move_sound(last as Dictionary))
			_after_move(last as Dictionary, false)
	_plies = plies
	if _picked >= 0 and not _starts().has(_picked):
		_set_picked(-1)
	_show_seats()
	_show_status()
	_show_buttons()
	var ended: bool = view.get("end") != null
	if ended and not _ended:
		_finale.arm(seen)
		if not _animating:
			_end_beat()
	_ended = ended
	_plaque.move_count.text = "Nước %d" % (plies / 2 + 1)
	_marks.queue_redraw()
	_show_check()


# ── Board ─────────────────────────────────────────────────────────────────────────────────


## A point on screen (turned round for Black).
func _point_at(sq: int) -> Vector2:
	var row: int = sq / COLS
	var col: int = sq % COLS
	if _flip:
		row = ROWS - 1 - row
		col = COLS - 1 - col
	return _origin + Vector2(col, row) * _gap


## A piece's picture standing on a point, `lift` gaps above where it rests.
func _piece_rect(sq: int, lift: float = 0.0) -> Rect2:
	var side: float = _gap * PIECE_WIDTH / DISC
	var center: Vector2 = _point_at(sq) - Vector2(0.0, (STAND + lift) * _gap)
	return Rect2(center - Vector2.ONE * side / 2.0, Vector2(side, side))


func _texture_of(letter: String) -> Texture2D:
	var side: String = "red" if letter == letter.to_upper() else "black"
	return _art("piece-%s-%s" % [side, ART[letter.to_lower()]])


func _art(name_of: String) -> Texture2D:
	if not _textures.has(name_of):
		_textures[name_of] = load("res://content/xiangqi/art/%s.webp" % name_of)
	return _textures[name_of]


## The board's letters, "" for an empty point.
func _board_letters() -> Array[String]:
	var out: Array[String] = []
	for cell: Variant in _view.get("board", []):
		out.append("" if cell == null else str(cell))
	return out


func _clear_pieces() -> void:
	for sq: int in _pieces.keys():
		(_pieces[sq] as TextureRect).queue_free()
		(_shadows[sq] as TextureRect).queue_free()
	_pieces.clear()
	_shadows.clear()
	_letters.clear()
	_picked = -1


func _drop_piece(sq: int) -> void:
	_pieces.erase(sq)
	_shadows.erase(sq)
	_letters.erase(sq)


## Makes the pieces on screen match the board, without animation.
func _sync_pieces() -> void:
	var board: Array[String] = _board_letters()
	for sq: int in _pieces.keys():
		if sq < board.size() and board[sq] == _letters[sq]:
			continue
		(_pieces[sq] as TextureRect).queue_free()
		(_shadows[sq] as TextureRect).queue_free()
		_drop_piece(sq)
	for sq: int in board.size():
		if board[sq] == "" or _pieces.has(sq):
			continue
		var shadow := TextureRect.new()
		shadow.texture = _art("piece-shadow")
		shadow.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		shadow.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_shadows_layer.add_child(shadow)
		var piece := TextureRect.new()
		piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_pieces_layer.add_child(piece)
		_pieces[sq] = piece
		_shadows[sq] = shadow
		_letters[sq] = board[sq]
	_place_pieces()


## Every piece on its point (the picked one lifted), those nearer the bottom drawn over the others.
func _place_pieces() -> void:
	var order: Array = _pieces.keys()
	order.sort_custom(func(a: int, b: int) -> bool: return _point_at(a).y < _point_at(b).y)
	for sq: int in order:
		var piece: TextureRect = _pieces[sq]
		var lift: float = PICK_LIFT if sq == _picked and _effects else 0.0
		var rect: Rect2 = _piece_rect(sq, lift)
		piece.name = "Piece_%d" % sq
		piece.texture = _texture_of(_letters[sq])
		piece.position = rect.position
		piece.size = rect.size
		piece.pivot_offset = rect.size / 2.0
		piece.modulate.a = 1.0
		piece.scale = Vector2.ONE
		piece.rotation = 0.0
		piece.move_to_front()
		var shadow: TextureRect = _shadows[sq]
		var rest: Rect2 = _piece_rect(sq)
		shadow.position = rest.position
		shadow.size = rest.size
		shadow.pivot_offset = rest.size / 2.0
		shadow.scale = Vector2.ONE * (1.0 - lift)
		shadow.modulate.a = 1.0 - lift * 1.3
		if sq == _fallen and _finale.toppled:
			XiangqiFinale.lay_down(piece, shadow, _gap)


## The last move on screen: the piece lifts and slides; a taken piece is struck and breaks apart.
## You may pick your next move meanwhile.
func _play_move(last: Dictionary, plies: int) -> void:
	var from: int = int(last["from"])
	var to: int = int(last["to"])
	var moving: TextureRect = _pieces[from]
	var moving_shadow: TextureRect = _shadows[from]
	var letter: String = str(_letters[from])
	var victim: TextureRect = _pieces.get(to)
	var victim_shadow: TextureRect = _shadows.get(to)
	_drop_piece(to)
	_drop_piece(from)
	_animating = true
	moving.move_to_front()
	var goal: Rect2 = _piece_rect(to)
	var tween: Tween = moving.create_tween().set_parallel()
	tween.tween_property(moving, "position", goal.position, SLIDE_SECONDS).set_trans(
		Tween.TRANS_SINE
	)
	tween.tween_property(moving_shadow, "position", goal.position, SLIDE_SECONDS).set_trans(
		Tween.TRANS_SINE
	)
	await tween.finished
	if not is_inside_tree():
		return
	_sfx(_move_sound(last))
	if victim != null:
		_shatter(victim, victim_shadow, _point_at(to) - _point_at(from))
	_pieces[to] = moving
	_shadows[to] = moving_shadow
	_letters[to] = letter
	_place_pieces()
	_animating = false
	_show_seats()
	if plies == int(_view.get("plies", 0)):
		_after_move(last, true)
	# A reply that came in meanwhile plays next.
	var next: Variant = _view.get("last")
	if (
		int(_view.get("plies", 0)) == plies + 1
		and next is Dictionary
		and _letters.has(int((next as Dictionary)["from"]))
	):
		_play_move(next as Dictionary, plies + 1)
		return
	_sync_pieces()
	_marks.queue_redraw()


## The taken piece jolts away from the blow, spins and breaks into nothing; its shadow fades.
func _shatter(victim: TextureRect, shadow: TextureRect, blow: Vector2) -> void:
	_sfx("shatter")
	var away: Vector2 = blow.normalized() * _gap * 0.5
	var tween: Tween = victim.create_tween().set_parallel()
	tween.tween_property(victim, "position", victim.position + away, 0.32).set_trans(
		Tween.TRANS_QUAD
	)
	tween.tween_property(victim, "rotation", 0.6 * signf(blow.x if blow.x != 0.0 else 1.0), 0.32)
	tween.tween_property(victim, "scale", Vector2.ONE * 1.35, 0.32)
	tween.tween_property(victim, "modulate:a", 0.0, 0.32).set_ease(Tween.EASE_IN)
	tween.tween_property(shadow, "modulate:a", 0.0, 0.2)
	tween.chain().tween_callback(victim.queue_free)
	tween.tween_callback(shadow.queue_free)


func _move_sound(last: Dictionary) -> String:
	var captured: Variant = last.get("captured")
	if captured == null:
		return "move"
	return "capture-heavy" if str(captured).to_lower() == "r" else "capture"


## After a move lands: the check or mate sound and the CHIẾU TƯỚNG! scroll (a mate's end beat
## follows), or the "your turn" chime.
func _after_move(last: Dictionary, animated: bool) -> void:
	var end: Variant = _view.get("end")
	var mate: bool = end is Dictionary and str((end as Dictionary).get("reason", "")) == "checkmate"
	if bool(_view.get("check", false)) or mate:
		_sfx("checkmate" if mate else "check")
		if animated and _effects and not mate:
			var board: Array[String] = _board_letters()
			var to: int = int(last["to"])
			var checker: Texture2D = _texture_of(board[to] if board[to] != "" else "R")
			XiangqiFinale.check_scroll(self, _board, checker)
	elif str(_view.get("turn", "")) == _mine and end == null:
		get_tree().create_timer(0.26).timeout.connect(_sfx.bind("turn"))
	if animated and end != null:
		_end_beat()


## The end beat, from your side: the beaten general topples, a seal says how the game ended and
## the outcome sound plays (a win's music, a loss, a draw).
func _end_beat() -> void:
	if not _finale.armed():
		return
	var end: Dictionary = _view["end"]
	var winner: Variant = end.get("winner")
	var outcome: String = "draw"
	if winner != null:
		outcome = "watch" if _mine == "" else ("win" if str(winner) == _mine else "lose")
	var board: Array[String] = _board_letters()
	_fallen = board.find("k" if str(winner) == "r" else "K") if winner != null else -1
	var crowned: int = board.find("K" if str(winner) == "r" else "k") if winner != null else -1
	var sound: String = {"lose": "lose", "draw": "draw"}.get(outcome, "victory")
	(
		_finale
		. play(
			{
				"outcome": outcome,
				"headline":
				{"win": "Thắng rồi!", "lose": "Thua rồi", "draw": "Hoà"}.get(
					outcome, "%s thắng" % _name_of(str(winner))
				),
				"line": _plaque.note.text,
				"reason": str(end.get("reason", "")),
				"board": Rect2(_board.position, _board.size),
				"gap": _gap,
				"winner_at": _point_at(crowned) if crowned >= 0 else null,
				"piece": _pieces.get(_fallen),
				"shadow": _shadows.get(_fallen),
				"effects": _effects,
				"sound": _sfx.bind(sound),
			}
		)
	)


## The pulsing red ring round a general in check.
func _show_check() -> void:
	var general: int = -1
	if bool(_view.get("check", false)) and _snapshot.status == "playing":
		general = _board_letters().find("K" if str(_view.get("turn", "")) == "r" else "k")
	_check_ring.visible = general >= 0
	if _pulse != null:
		_pulse.kill()
		_pulse = null
	_check_ring.modulate.a = 1.0
	if general < 0:
		return
	_check_ring.position = _point_at(general)
	_check_ring.queue_redraw()
	if _effects:
		_pulse = _check_ring.create_tween().set_loops()
		_pulse.tween_property(_check_ring, "modulate:a", 0.3, 0.48)
		_pulse.tween_property(_check_ring, "modulate:a", 1.0, 0.48)


## The board's lines: files broken at the river, ranks, the palaces, a border and point marks.
func _draw_lines() -> void:
	var width: float = maxf(1.5, _gap * 0.045)
	var at := func(col: float, row: float) -> Vector2: return _origin + Vector2(col, row) * _gap
	for row: int in ROWS:
		_lines.draw_line(at.call(0, row), at.call(COLS - 1, row), LINE, width, true)
	for col: int in COLS:
		if col == 0 or col == COLS - 1:
			_lines.draw_line(at.call(col, 0), at.call(col, ROWS - 1), LINE, width, true)
		else:
			_lines.draw_line(at.call(col, 0), at.call(col, 4), LINE, width, true)
			_lines.draw_line(at.call(col, 5), at.call(col, ROWS - 1), LINE, width, true)
	for rows: Array in [[0, 2], [7, 9]]:
		_lines.draw_line(at.call(3, rows[0]), at.call(5, rows[1]), LINE, width, true)
		_lines.draw_line(at.call(5, rows[0]), at.call(3, rows[1]), LINE, width, true)
	var out: float = 0.2
	var corner: Vector2 = at.call(-out, -out)
	var span := Vector2(COLS - 1 + 2 * out, ROWS - 1 + 2 * out) * _gap
	_lines.draw_rect(Rect2(corner, span), LINE, false, width * 2.0, true)
	# Where cannons and soldiers start: four small corners around the point.
	var marks: Array = [[2, 1], [2, 7], [7, 1], [7, 7]]
	for row: int in [3, 6]:
		for col: int in [0, 2, 4, 6, 8]:
			marks.append([row, col])
	var near: float = 0.1
	var arm: float = 0.22
	for mark: Array in marks:
		var row: int = mark[0]
		var col: int = mark[1]
		for sx: int in [-1, 1]:
			if (col == 0 and sx < 0) or (col == COLS - 1 and sx > 0):
				continue
			for sy: int in [-1, 1]:
				var start: Vector2 = at.call(col + sx * near, row + sy * near)
				var across: Vector2 = at.call(col + sx * (near + arm), row + sy * near)
				var down: Vector2 = at.call(col + sx * near, row + sy * (near + arm))
				_lines.draw_line(start, across, LINE, width * 0.8, true)
				_lines.draw_line(start, down, LINE, width * 0.8, true)


## Marks on the table, under the pieces: the last move, the picked piece and where it may go
## (dots; rings round pieces it can take).
func _draw_marks() -> void:
	var last: Variant = _view.get("last")
	if last is Dictionary:
		var from: int = int((last as Dictionary)["from"])
		var to: int = int((last as Dictionary)["to"])
		_marks.draw_circle(_point_at(from), 0.22 * _gap, Color(LAST, 0.45), true, -1.0, true)
		_marks.draw_circle(_point_at(to), 0.6 * _gap, Color(LAST, 0.55), true, -1.0, true)
	if _picked < 0:
		return
	_marks.draw_circle(_point_at(_picked), 0.62 * _gap, Color(PICKED, 0.75), true, -1.0, true)
	var board: Array[String] = _board_letters()
	for to: int in _targets(_picked):
		if board[to] != "":
			var width: float = maxf(2.0, 0.08 * _gap)
			_marks.draw_arc(_point_at(to), 0.6 * _gap, 0.0, TAU, 40, TARGET, width, true)
		else:
			_marks.draw_circle(_point_at(to), 0.15 * _gap, Color(TARGET, 0.9), true, -1.0, true)


## The points of the pieces that may move now.
func _starts() -> Array[int]:
	var out: Array[int] = []
	for move: Dictionary in _moves:
		var from: int = int(move["from"])
		if not out.has(from):
			out.append(from)
	return out


## Where the piece on `from` may go.
func _targets(from: int) -> Array[int]:
	var out: Array[int] = []
	for move: Dictionary in _moves:
		if int(move["from"]) == from:
			out.append(int(move["to"]))
	return out


func _set_picked(sq: int) -> void:
	_picked = sq
	if not _animating:
		_place_pieces()
	_marks.queue_redraw()


## A tap on a point: pick a piece that may move, move the picked piece there, or drop the pick.
func _tap(sq: int) -> void:
	if _moves.is_empty():
		return
	if _picked >= 0 and _targets(_picked).has(sq):
		var from: int = _picked
		_moves = []
		_set_picked(-1)
		await _client.send("move", {"from": from, "to": sq})
		return
	if _starts().has(sq) and sq != _picked:
		_sfx("piece-select")
		_set_picked(sq)
	elif _picked >= 0 and sq != _picked and _board_letters()[sq] == "":
		_sfx("illegal")
		_set_picked(-1)
	else:
		_set_picked(-1)


# ── Players, status and buttons ───────────────────────────────────────────────────────────


static func _other(side: String) -> String:
	return "r" if side == "b" else "b"


static func _side_of(letter: String) -> String:
	return "r" if letter == letter.to_upper() else "b"


func _side_at_bottom() -> String:
	return _other(FIRST) if _flip else FIRST


## How many pieces `side` has taken.
func _taken_by(side: String) -> int:
	var count: int = 0
	for piece: Variant in _view.get("captured", []):
		if _side_of(str(piece)) != side:
			count += 1
	return count


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


## Slot 0 is the side at the bottom (yours), slot 1 the other, with its general, wins and takes.
func _show_seats() -> void:
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
		_icons[i].texture = _texture_of("K" if side == "r" else "k")
		# A taken piece reaches the tray when the piece that took it lands.
		if not _animating:
			_fill_tray(i, side)
	# A longer count can widen the seats' column.
	_layout()


func _show_status() -> void:
	var end: Variant = _view.get("end")
	var turn: String = str(_view.get("turn", FIRST))
	if end is Dictionary:
		var winner: Variant = (end as Dictionary).get("winner")
		var loser: String = _name_of(_other(str(winner))) if winner != null else ""
		var how: String = (
			{
				"checkmate": "Chiếu bí!",
				"stalemate": "%s hết nước đi" % loser,
				"resign": "%s đầu hàng" % loser,
				"left": "%s rời bàn" % loser,
				"perpetual-check": "%s chiếu dai" % loser,
				"perpetual-chase": "%s đuổi dai" % loser,
				"repetition": "Lặp lại thế cờ",
				"move-limit": "60 nước không ăn quân",
				"material": "Hết quân tấn công",
				"agreement": "Hai bên đồng ý",
			}
			. get(str((end as Dictionary).get("reason", "")), "")
		)
		_plaque.status.text = "%s thắng" % _name_of(str(winner)) if winner != null else "Hoà"
		_plaque.set_note(how, XomDaoUi.CREAM)
		return
	_plaque.set_note("Chiếu tướng!" if bool(_view.get("check", false)) else "", NOTE)
	var offer: Variant = _view.get("drawOffer")
	if offer != null and _mine != "" and str(offer) != _mine:
		_plaque.status.text = "%s xin hoà" % SIDE_NAMES[str(offer)]
	elif turn == _mine:
		_plaque.status.text = "Tới lượt bạn"
	else:
		_plaque.status.text = "Lượt %s" % SIDE_NAMES[turn]


func _show_buttons() -> void:
	var playing: bool = _mine != "" and _view.get("end") == null and _snapshot.status == "playing"
	var offer: Variant = _view.get("drawOffer")
	var offered: bool = playing and offer != null and str(offer) != _mine
	var vs_bot: bool = false
	for player: XomDaoPlayerInfo in _snapshot.seats:
		vs_bot = vs_bot or player.bot
	# The computer never takes a draw: no point offering one.
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
	var config := ConfigFile.new()
	config.set_value("xiangqi", "effects", _effects)
	config.save(SETTINGS)
	_show_effects()
	XomDaoToast.show_on(self, "Hiệu ứng: %s" % ("Bật" if _effects else "Tắt"), "sparkle")
	if not _animating:
		_place_pieces()
	_show_check()


static func _load_effects() -> bool:
	var config := ConfigFile.new()
	if config.load(SETTINGS) != OK:
		return true
	return bool(config.get_value("xiangqi", "effects", true))


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sfx and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## The table as tall as the frame in the middle; the players' column on its left, the turn
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
	var scale: float = maxf(minf((size.y - 2.0 * edge) / BOARD.y, room / BOARD.x), 240.0 / BOARD.x)
	var board_size: Vector2 = BOARD * scale
	var between: float = left + seats_width + 16.0
	var board_at := Vector2(
		between + maxf(0.0, (room - board_size.x) / 2.0), (size.y - board_size.y) / 2.0
	)
	_board.position = board_at
	_board.size = board_size
	_backdrop.fit(size, Rect2(board_at, board_size))
	_gap = GAP * scale
	_origin = board_at + FIRST_POINT * scale
	for layer: Control in [_lines, _marks, _shadows_layer, _pieces_layer, _squares]:
		layer.position = Vector2.ZERO
		layer.size = size
	_lines.queue_redraw()
	# 楚河 漢界: the picture spans the 8 column gaps, on the river.
	var river_width: float = _gap * (COLS - 1)
	var river_height: float = river_width * _river.texture.get_height() / _river.texture.get_width()
	_river.size = Vector2(river_width, river_height)
	_river.position = _origin + Vector2(0.0, _gap * 4.5 - river_height / 2.0)
	for square: Button in _squares.get_children():
		var sq: int = int(str(square.name).trim_prefix("Square_"))
		square.size = Vector2.ONE * _gap
		square.position = _point_at(sq) - square.size / 2.0
	if not _animating:
		_place_pieces()
	if _check_ring.visible:
		_show_check()
	# Left column: the other player under ☰ with their tray below, yours at the bottom with your
	# tray above.
	for i: int in 2:
		var slot: XomDaoPlayerSlot = _slots[i]
		var y: float = size.y - edge - slot.size.y if i == 0 else edge + MENU + 12.0
		slot.position = Vector2(left, y)
		var tray: XiangqiTakenTray = _trays[i]
		tray.reset_size()
		var tray_y: float = y - tray.size.y - 12.0 if i == 0 else y + slot.size.y + 12.0
		tray.position = Vector2(left, tray_y)
	_place_icons.call_deferred()
	# Right column: the turn plaque and Hiệu ứng at the top, the buttons at the bottom; Đầu hàng
	# stands apart above the others.
	var column_left: float = board_at.x + board_size.x + 16.0
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
	_marks.queue_redraw()


## Each side's general sits on its player's avatar like a badge, at the top right (the host's
## crown has the top left), once the slots have laid out.
func _place_icons() -> void:
	for i: int in _slots.size():
		var avatar: Control = _slots[i].avatar
		var icon: TextureRect = _icons[i]
		var corner := Vector2(avatar.size.x - icon.size.x * 0.62, -icon.size.y * 0.3)
		icon.position = avatar.global_position - global_position + corner


## The pieces `side` took, in the tray of slot `i`.
func _fill_tray(i: int, side: String) -> void:
	var letters: Array[String] = []
	var textures: Array[Texture2D] = []
	for piece: Variant in _view.get("captured", []):
		if _side_of(str(piece)) != side:
			letters.append(str(piece))
			textures.append(XiangqiTakenTray.disc_of(_texture_of(str(piece)), DISC))
	if _trays[i].show_pieces(letters, textures):
		_layout.call_deferred()


## Hiệu ứng is a sparkle: bright while the motion is on, faded while it is off.
func _show_effects() -> void:
	_effects_button.modulate.a = 1.0 if _effects else 0.45
