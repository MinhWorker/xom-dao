extends Control
## Cờ Vua on the Godot client, in the **Bàn** layout (docs/experience.md): a 3/4-view walnut board
## against a dark plain field; the two players in the column on its left (yours at the bottom,
## the other under the hub's ☰) with the move count between them; utility icons at the top right
## and occasional status text below them. It draws `snapshot.view` (View in
## src/game/model.ts, with your legal `moves` on your turn) and sends `move {from, to,
## promotion?}`, `offer-draw`, `decline-draw` and `resign`.
##
## Tap one of your pieces, then a dotted square (a ring marks a piece you can take); a pawn
## reaching the last rank asks which piece it becomes (Phong cấp). The side that plays Black sees
## the board turned round. The last move's squares are tinted gold, a king in check red. A move
## slides (the rook too when castling), a taken piece flies to its taker's seat, and a check shows
## a CHIẾU TƯỚNG! ribbon (Hiệu ứng: Tắt skips the motion, the sounds stay).
##
## Named nodes for tests: Board, Square_<sq> (a button per square, sq = row * 8 + col from
## Black's side), Piece_<sq>, Shadow_<sq>, Status, MoveCount, Seat_<seat>, OfferDraw,
## DeclineDraw, Resign, Effects, Promotion with Promote_<q|r|b|n>, CutIn.

const SIZE := 8
const PROJECTION = preload("res://content/chess/projection.gd")
const ROYAL_CUT_IN = preload("res://content/chess/royal_cutin.gd")
const CHESS_EFFECTS = preload("res://content/chess/chess_effects.gd")
const CHESS_INPUT = preload("res://content/chess/chess_input.gd")
const PIECE_ATLAS = preload("res://content/chess/chess_piece_atlas.gd")
const CHESS_HUD = preload("res://content/chess/chess_hud.gd")
const CHESS_SEAT = preload("res://content/chess/chess_player_seat.gd")
const ROOM_DATA = preload("res://content/chess/chess_room_data.gd")
## White moves first and starts at the bottom.
const FIRST := "w"
const SIDE_NAMES: Dictionary = {"w": "Trắng", "b": "Đen"}
const ART: Dictionary = {
	"k": "king", "q": "queen", "r": "rook", "b": "bishop", "n": "knight", "p": "pawn"
}
const PROMOTIONS: Array[String] = ["q", "r", "b", "n"]
const PROMOTION_NAMES: Dictionary = {"q": "Hậu", "r": "Xe", "b": "Tượng", "n": "Mã"}
const SHADOW_WIDTH := 0.92
const SHADOW_HEIGHT := 0.48
const SHADOW_OFFSET := Vector2(0.05, 0.1)
## The visible piece's height as a share of its picture, and where its base sits on it.
const DISC := 0.38
const ANCHOR := Vector2(0.5, 0.5)
const LAST := Color("#FFE066")
const PICKED := Color("#7FD4FF")
const TARGET := Color("#1F6B3A")
const CHECK := Color("#FF3B30")
const LIGHT_TEXT := Color("#614029")
const DARK_TEXT := Color("#FFEBBD")
const SLIDE_SECONDS := 0.22
## The hub's ☰ button keeps the top left square.
const MENU := 88.0
const COLUMN := 180.0
const BUTTON_WIDTH := 210.0
const SOUNDS: Array[String] = [
	"capture", "castle", "check", "draw", "mate", "move", "promote", "select", "start", "win"
]

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your side ("w", "b"), or "" for a spectator (who looks from White's side).
var _mine: String = ""
var _flip: bool = false
var _effects: bool = true

var _backdrop := ColorRect.new()
var _board := TextureRect.new()
var _marks := Control.new()
var _squares := Control.new()
var _pieces_layer := Control.new()
var _status := Label.new()
var _move_count := Label.new()
var _draw: XomDaoButton = XomDaoButton.create("Xin hoà", XomDaoUi.Kind.INFO)
var _decline: XomDaoButton = XomDaoButton.create("Từ chối", XomDaoUi.Kind.BACK)
var _resign: XomDaoIconButton = XomDaoIconButton.create("flag-banner")
var _effects_button: XomDaoIconButton = XomDaoIconButton.create("star")
var _promotion: XomDaoBoard = XomDaoBoard.create("Phong cấp")
var _seats: Array[ChessPlayerSeat] = []
var _avatars: Array[XomDaoAvatar] = []
var _sounds: Dictionary = {}
var _shadow_texture: Texture2D
var _piece_atlas: PIECE_ATLAS = PIECE_ATLAS.new()
var _active_cutin: Control

## Pieces on screen: square → TextureRect, and the letter each shows.
var _pieces: Dictionary = {}
var _shadows: Dictionary = {}
var _letters: Dictionary = {}
## The picked piece's square (-1: none), and the square a pawn is promoting on.
var _picked: int = -1
var _promoting: int = -1
var _moves: Array = []
var _plies: int = -1
var _ended: bool = false
var _animating: bool = false
var _resign_armed: bool = false
## The projected width/height of a square near the board centre.
var _cell := Vector2(60.0, 60.0)


## Options for a sandbox room (`?play=chess` in a debug build): against the computer.
func sandbox_options() -> Dictionary:
	return ROOM_DATA.sandbox_options()


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts).
func room_setup() -> Array:
	return ROOM_DATA.room_setup()


## How the game ended and its figures, for the hub's result board.
func result_detail() -> Dictionary:
	# The hub may ask before this scene heard the last state.
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	return ROOM_DATA.result_detail(_view, Callable(self, "_taken_by"), Callable(self, "_name_of"))


## The shared Kết quả button uses the same lacquer frame as the chess table controls.
func result_reopen_theme() -> Dictionary:
	return CHESS_HUD.result_reopen_theme()


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	_effects = CHESS_HUD.load_effects()
	_backdrop.name = "BoardBackdrop"
	_backdrop.color = Color("#110D0C")
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_backdrop)

	_board.name = "Board"
	_board.texture = load("res://content/chess/art/board-table.webp")
	_board.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_board.stretch_mode = TextureRect.STRETCH_SCALE
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_board)
	_marks.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_marks.draw.connect(_draw_marks)
	add_child(_marks)
	_pieces_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_pieces_layer)
	_squares.name = "Squares"
	_squares.mouse_filter = Control.MOUSE_FILTER_STOP
	_squares.gui_input.connect(_on_board_input)
	add_child(_squares)
	for sq: int in SIZE * SIZE:
		var square := Button.new()
		square.name = "Square_%d" % sq
		square.flat = true
		square.focus_mode = Control.FOCUS_NONE
		square.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var clear := StyleBoxEmpty.new()
		for state: String in ["normal", "hover", "pressed", "disabled", "focus"]:
			square.add_theme_stylebox_override(state, clear)
		square.pressed.connect(_tap.bind(sq))
		_squares.add_child(square)

	_status.name = "Status"
	_status.theme_type_variation = "HudLabel"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.add_theme_color_override("font_color", Color("#F5E8CE"))
	_status.add_theme_font_size_override("font_size", 28)
	_status.add_theme_color_override("font_outline_color", Color(0.07, 0.05, 0.04, 0.82))
	_status.add_theme_constant_override("outline_size", 2)
	_status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_status.visible = false
	_status.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_status)
	_move_count.name = "MoveCount"
	_move_count.theme_type_variation = "HudLabel"
	_move_count.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_move_count.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_move_count.add_theme_color_override("font_color", Color("#F0D18A"))
	_move_count.add_theme_font_size_override("font_size", 24)
	_move_count.add_theme_color_override("font_outline_color", Color(0.07, 0.05, 0.04, 0.82))
	_move_count.add_theme_constant_override("outline_size", 2)
	_move_count.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_move_count)
	_draw.name = "OfferDraw"
	_draw.pressed.connect(_send.bind("offer-draw"))
	_decline.name = "DeclineDraw"
	_decline.pressed.connect(_send.bind("decline-draw"))
	_resign.name = "Resign"
	_resign.tooltip_text = "Đầu hàng"
	_resign.pressed.connect(_on_resign)
	_effects_button.name = "Effects"
	_effects_button.tooltip_text = "Bật hoặc tắt hiệu ứng"
	_effects_button.pressed.connect(_toggle_effects)
	for button: XomDaoButton in [_draw, _decline]:
		button.custom_minimum_size.x = BUTTON_WIDTH
		CHESS_HUD.skin_royal_button(button, false)
		add_child(button)
	for button: XomDaoIconButton in [_resign, _effects_button]:
		button.custom_minimum_size = Vector2(MENU, MENU)
		add_child(button)
	_update_utility_icons()
	for seat: int in 2:
		var player_seat: ChessPlayerSeat = CHESS_SEAT.new(seat)
		_seats.append(player_seat)
		_avatars.append(player_seat.avatar)
		add_child(player_seat)
	_build_promotion()
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.bus = XomDaoSettings.SFX_BUS
		player.stream = load("res://content/chess/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


## Phong cấp: the four pieces a pawn may become, over the board.
func _build_promotion() -> void:
	_promotion.name = "Promotion"
	_promotion.visible = false
	add_child(_promotion)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	_promotion.content.add_child(row)
	for kind: String in PROMOTIONS:
		var button: XomDaoButton = XomDaoButton.create(PROMOTION_NAMES[kind], XomDaoUi.Kind.BACK)
		button.name = "Promote_" + kind
		button.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		button.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
		button.expand_icon = true
		button.custom_minimum_size = Vector2(110.0, 140.0)
		CHESS_HUD.skin_royal_button(button, false)
		button.pressed.connect(_promote.bind(kind))
		row.add_child(button)


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
			_mine = CHESS_HUD.other(FIRST)
	var flip: bool = _mine == CHESS_HUD.other(FIRST)
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
	_view = view
	_moves = view.get("moves", [])
	if flip != _flip:
		_flip = flip
		_layout()
	if fresh:
		_clear_pieces()
		_sfx("start")
	if animate:
		_play_move(last as Dictionary, plies)
	elif not _animating:
		_sync_pieces()
		if moved:
			CHESS_EFFECTS.play_move_sounds(
				self,
				Callable(self, "_sfx"),
				last as Dictionary,
				bool(_view.get("check", false)),
				_mated(),
				(last as Dictionary).get("captured") != null,
				false
			)
	_plies = plies
	if _picked >= 0 and not _starts().has(_picked):
		_picked = -1
	if _promoting >= 0 and _moves.is_empty():
		_close_promotion()
	_show_seats()
	_show_status()
	_show_buttons()
	var ended: bool = view.get("end") != null
	if ended and not _ended:
		var end: Dictionary = view["end"]
		if str(end.get("reason", "")) != "checkmate":
			_sfx("win" if end.get("winner") != null else "draw")
	_ended = ended
	_move_count.text = "NƯỚC %02d" % (plies / 2 + 1)
	_marks.queue_redraw()


# ── Board ─────────────────────────────────────────────────────────────────────────────────


func _project_board_point(col: float, row: float) -> Vector2:
	return PROJECTION.project_board_point(col, row, _board.position, _board.size)


func _square_points(sq: int) -> PackedVector2Array:
	return PROJECTION.square_points(sq, _flip, _board.position, _board.size)


func _square_size(sq: int) -> Vector2:
	return PROJECTION.square_size(sq, _flip, _board.position, _board.size)


## A square's top-left corner on screen (turned round for Black).
func _square_at(sq: int) -> Vector2:
	return PROJECTION.square_at(sq, _flip, _board.position, _board.size)


func _center_of(sq: int) -> Vector2:
	return PROJECTION.center_of(sq, _flip, _board.position, _board.size)


## A piece's picture: every piece shares one canvas, its base a little below the square's middle.
func _piece_rect(sq: int) -> Rect2:
	return PROJECTION.piece_rect(sq, _flip, _board.position, _board.size, DISC, ANCHOR)


func _on_board_input(event: InputEvent) -> void:
	var sq: int = CHESS_INPUT.square_for_event(
		event, _pieces.keys(), _letters, _flip, _board.position, _board.size, _animating
	)
	if sq < 0:
		return
	_tap(sq)
	_squares.accept_event()


func _texture_of(letter: String, square: int = -1) -> Texture2D:
	return _piece_atlas.texture_for(letter, square, _flip)


## The board's letters, "" for an empty square.
func _board_letters() -> Array[String]:
	var out: Array[String] = []
	for cell: Variant in _view.get("board", []):
		out.append("" if cell == null else str(cell))
	return out


func _clear_pieces() -> void:
	for piece: TextureRect in _pieces.values():
		piece.queue_free()
	for shadow: TextureRect in _shadows.values():
		shadow.queue_free()
	_pieces.clear()
	_shadows.clear()
	_letters.clear()
	_picked = -1


## Makes the pieces on screen match the board, without animation.
func _sync_pieces() -> void:
	var board: Array[String] = _board_letters()
	for sq: int in _pieces.keys():
		if sq < board.size() and board[sq] == _letters[sq]:
			continue
		(_pieces[sq] as TextureRect).queue_free()
		(_shadows[sq] as TextureRect).queue_free()
		_pieces.erase(sq)
		_shadows.erase(sq)
		_letters.erase(sq)
	for sq: int in board.size():
		if board[sq] == "" or _pieces.has(sq):
			continue
		var shadow := TextureRect.new()
		shadow.name = "Shadow_%d" % sq
		shadow.texture = _piece_shadow_texture()
		shadow.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		shadow.stretch_mode = TextureRect.STRETCH_SCALE
		shadow.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		shadow.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_pieces_layer.add_child(shadow)
		var piece := TextureRect.new()
		piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_pieces_layer.add_child(piece)
		_shadows[sq] = shadow
		_pieces[sq] = piece
		_letters[sq] = board[sq]
	_place_pieces()


## Every piece on its square, the ones nearer the bottom of the screen drawn over the others.
func _place_pieces() -> void:
	var order: Array = _pieces.keys()
	order.sort_custom(func(a: int, b: int) -> bool: return _square_at(a).y < _square_at(b).y)
	for sq: int in order:
		var shadow: TextureRect = _shadows[sq]
		var piece: TextureRect = _pieces[sq]
		var rect: Rect2 = _piece_rect(sq)
		var shadow_rect: Rect2 = _shadow_rect(sq)
		shadow.position = shadow_rect.position
		shadow.size = shadow_rect.size
		shadow.modulate = Color(1.0, 1.0, 1.0, 0.78)
		piece.name = "Piece_%d" % sq
		piece.texture = _texture_of(_letters[sq], sq)
		piece.position = rect.position
		piece.size = rect.size
		piece.pivot_offset = rect.size * ANCHOR
		piece.modulate = Color.WHITE
		piece.scale = Vector2.ONE
		piece.rotation = 0.0
		shadow.move_to_front()
		piece.move_to_front()


func _shadow_rect(sq: int) -> Rect2:
	var tile: Vector2 = _square_size(sq)
	var shadow_size := Vector2(tile.x * SHADOW_WIDTH, tile.y * SHADOW_HEIGHT)
	var center: Vector2 = _center_of(sq) + tile * SHADOW_OFFSET
	return Rect2(center - shadow_size / 2.0, shadow_size)


func _piece_shadow_texture() -> Texture2D:
	if _shadow_texture != null:
		return _shadow_texture
	const WIDTH := 96
	const HEIGHT := 64
	var image := Image.create(WIDTH, HEIGHT, false, Image.FORMAT_RGBA8)
	for y: int in HEIGHT:
		for x: int in WIDTH:
			var dx: float = (float(x) + 0.5 - WIDTH * 0.5) / (WIDTH * 0.5)
			var dy: float = (float(y) + 0.5 - HEIGHT * 0.5) / (HEIGHT * 0.5)
			var radius: float = sqrt(dx * dx + dy * dy)
			var alpha: float = pow(maxf(1.0 - radius, 0.0), 2.2) * 0.58
			image.set_pixel(x, y, Color(0.035, 0.022, 0.014, alpha))
	_shadow_texture = ImageTexture.create_from_image(image)
	return _shadow_texture


## The last move on screen: the piece slides (the rook with it when castling), a taken piece flies
## to its taker's seat and fades. You may pick your next move meanwhile.
func _play_move(last: Dictionary, plies: int) -> void:
	var from: int = int(last["from"])
	var to: int = int(last["to"])
	var moving: TextureRect = _pieces[from]
	var letter: String = str(_letters[from])
	var move_checked: bool = bool(_view.get("check", false))
	var move_mate: bool = _mated()
	var captured: bool = last.get("captured") != null
	var castling: bool = bool(last.get("castle", false))
	var taken_at: int = to
	if bool(last.get("enPassant", false)):
		taken_at = (from / SIZE) * SIZE + to % SIZE
	var victim: TextureRect = _pieces.get(taken_at) if taken_at != from else null
	var victim_shadow: TextureRect = _shadows.get(taken_at) if taken_at != from else null
	var moving_shadow: TextureRect = _shadows[from]
	_pieces.erase(taken_at)
	_shadows.erase(taken_at)
	_letters.erase(taken_at)
	_pieces.erase(from)
	_shadows.erase(from)
	_letters.erase(from)
	var rook: Array = CHESS_EFFECTS.castle_rook(from, to) if bool(last.get("castle", false)) else []
	var rook_piece: TextureRect = null
	var rook_shadow: TextureRect = null
	if not rook.is_empty() and _pieces.has(rook[0]):
		rook_piece = _pieces[rook[0]]
		rook_shadow = _shadows[rook[0]]
		_pieces.erase(rook[0])
		_shadows.erase(rook[0])
		_letters.erase(rook[0])
	_animating = true
	moving_shadow.move_to_front()
	moving.move_to_front()
	if captured or castling:
		_sfx("move")
	var tween: Tween = moving.create_tween().set_parallel()
	var destination: Rect2 = _piece_rect(to)
	tween.tween_property(moving, "position", destination.position, SLIDE_SECONDS).set_trans(
		Tween.TRANS_SINE
	)
	tween.tween_property(moving, "size", destination.size, SLIDE_SECONDS).set_trans(
		Tween.TRANS_SINE
	)
	var shadow_destination: Rect2 = _shadow_rect(to)
	(
		tween
		. tween_property(moving_shadow, "position", shadow_destination.position, SLIDE_SECONDS)
		. set_trans(Tween.TRANS_SINE)
	)
	tween.tween_property(moving_shadow, "size", shadow_destination.size, SLIDE_SECONDS).set_trans(
		Tween.TRANS_SINE
	)
	if rook_piece != null:
		var rook_destination: Rect2 = _piece_rect(rook[1])
		var rook_shadow_destination: Rect2 = _shadow_rect(rook[1])
		rook_shadow.move_to_front()
		rook_piece.move_to_front()
		(
			tween
			. tween_property(rook_piece, "position", rook_destination.position, SLIDE_SECONDS)
			. set_trans(Tween.TRANS_SINE)
		)
		tween.tween_property(rook_piece, "size", rook_destination.size, SLIDE_SECONDS).set_trans(
			Tween.TRANS_SINE
		)
		(
			tween
			. tween_property(
				rook_shadow, "position", rook_shadow_destination.position, SLIDE_SECONDS
			)
			. set_trans(Tween.TRANS_SINE)
		)
		(
			tween
			. tween_property(rook_shadow, "size", rook_shadow_destination.size, SLIDE_SECONDS)
			. set_trans(Tween.TRANS_SINE)
		)
	await tween.finished
	if not is_inside_tree():
		return
	await CHESS_EFFECTS.play_move_sounds(
		self, Callable(self, "_sfx"), last, move_checked, move_mate, captured, captured or castling
	)
	if victim != null:
		var impact_vector: Vector2 = _center_of(to) - _center_of(taken_at)
		var seat_index: int = 0 if _side_at_bottom() == CHESS_HUD.side_of(letter) else 1
		var avatar: XomDaoAvatar = _avatars[seat_index]
		var seat_target: Vector2 = avatar.global_position - global_position + avatar.size / 2.0
		CHESS_EFFECTS.animate_capture(victim, impact_vector, seat_target, ANCHOR)
		if victim_shadow != null:
			var fade: Tween = victim_shadow.create_tween()
			fade.tween_property(victim_shadow, "modulate:a", 0.0, 0.2)
			fade.tween_callback(victim_shadow.queue_free)
		CHESS_EFFECTS.spawn_impact(self, _center_of(to), false)
	# The board may already be a move further on (the reply came in meanwhile); each piece keeps
	# its own letter and _sync_pieces below catches up with the board.
	_pieces[to] = moving
	_shadows[to] = moving_shadow
	var promotion: Variant = last.get("promotion")
	if promotion != null:
		var kind: String = str(promotion)
		var promoted_letter: String = kind.to_upper() if letter == letter.to_upper() else kind
		CHESS_EFFECTS.spawn_impact(self, _center_of(to), true)
		var rise: Tween = moving.create_tween().set_parallel()
		rise.tween_property(moving, "scale", Vector2.ONE * 1.2, 0.12).set_trans(Tween.TRANS_BACK)
		rise.tween_property(moving, "modulate", Color("#F3D98C"), 0.12)
		await rise.finished
		if not is_inside_tree():
			return
		moving.texture = _texture_of(promoted_letter, to)
		var settle: Tween = moving.create_tween().set_parallel()
		settle.tween_property(moving, "scale", Vector2.ONE, 0.16).set_trans(Tween.TRANS_BACK)
		settle.tween_property(moving, "modulate", Color.WHITE, 0.16)
		await settle.finished
		if not is_inside_tree():
			return
		_letters[to] = promoted_letter
		if move_checked:
			_cut_in(last, move_mate, promoted_letter)
	else:
		_letters[to] = letter
		if move_checked:
			_cut_in(last, move_mate, letter)
	if rook_piece != null:
		_pieces[rook[1]] = rook_piece
		_shadows[rook[1]] = rook_shadow
		_letters[rook[1]] = "R" if letter == "K" else "r"
	_place_pieces()
	_animating = false
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


func _cut_in(last: Dictionary, mate: bool, checker: String) -> void:
	if not _effects:
		return
	if is_instance_valid(_active_cutin):
		_active_cutin.queue_free()
	var to: int = int(last["to"])
	_active_cutin = ROYAL_CUT_IN.present(
		self,
		_board,
		mate,
		checker,
		str(SIDE_NAMES[CHESS_HUD.side_of(checker)]),
		_texture_of(checker, to)
	)


## The files and ranks on the edge squares; the last move's squares; a king in check; the picked
## piece and where it may go (a dot, or a ring round a piece it takes).
func _draw_marks() -> void:
	var font: Font = get_theme_default_font()
	var font_size: int = maxi(8, roundi(minf(_cell.x, _cell.y) * 0.2))
	var pad := _cell * 0.06
	for i: int in SIZE:
		var col: int = SIZE - 1 - i if _flip else i
		var file: String = "abcdefgh"[col]
		var file_edge := _project_board_point(float(i + 1), float(SIZE))
		var width: float = font.get_string_size(file, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
		var color: Color = LIGHT_TEXT if i % 2 == 1 else DARK_TEXT
		_marks.draw_string(
			font, file_edge - Vector2(width + pad.x, pad.y * 0.5), file, 0, -1, font_size, color
		)
		var rank: String = str(i + 1) if _flip else str(SIZE - i)
		var rank_edge := _project_board_point(0.0, float(i))
		var rank_at := rank_edge + Vector2(pad.x, pad.y * 0.5 + font.get_ascent(font_size))
		color = DARK_TEXT if i % 2 == 1 else LIGHT_TEXT
		_marks.draw_string(font, rank_at, rank, 0, -1, font_size, color)
	var last: Variant = _view.get("last")
	if last is Dictionary:
		for key: String in ["from", "to"]:
			var sq: int = int((last as Dictionary)[key])
			_marks.draw_colored_polygon(_square_points(sq), Color(LAST, 0.35))
	if bool(_view.get("check", false)) and _view.get("end") == null or _mated():
		var king: int = _board_letters().find("K" if str(_view.get("turn", "")) == "w" else "k")
		if king >= 0:
			_marks.draw_colored_polygon(_square_points(king), Color(CHECK, 0.55))
	if _picked < 0:
		return
	_marks.draw_colored_polygon(_square_points(_picked), Color(PICKED, 0.5))
	var board: Array[String] = _board_letters()
	for to: int in _targets(_picked):
		var target_size: Vector2 = _square_size(to)
		if board[to] != "":
			var outline := _ellipse_points(_center_of(to), target_size * 0.44)
			var outline_width: float = maxf(2.0, minf(target_size.x, target_size.y) * 0.07)
			_marks.draw_polyline(outline, Color(TARGET, 0.8), outline_width, true)
		else:
			_marks.draw_colored_polygon(
				_ellipse_points(_center_of(to), target_size * 0.16), Color(TARGET, 0.75)
			)


func _ellipse_points(center: Vector2, radii: Vector2) -> PackedVector2Array:
	var points := PackedVector2Array()
	for i: int in 40:
		var angle: float = TAU * float(i) / 40.0
		points.append(center + Vector2(cos(angle) * radii.x, sin(angle) * radii.y))
	points.append(points[0])
	return points


func _mated() -> bool:
	var end: Variant = _view.get("end")
	return end is Dictionary and str((end as Dictionary).get("reason", "")) == "checkmate"


## The squares of the pieces that may move now.
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
		var to: int = int(move["to"])
		if int(move["from"]) == from and not out.has(to):
			out.append(to)
	return out


## A tap on a square: pick a piece that may move, move the picked piece there (a pawn reaching
## the last rank asks what it becomes first), or drop the pick.
func _tap(sq: int) -> void:
	if _moves.is_empty():
		return
	if _promoting >= 0:
		_close_promotion()
	if _picked >= 0 and _targets(_picked).has(sq):
		var promotes: bool = _moves.any(
			func(m: Dictionary) -> bool:
				return (
					int(m["from"]) == _picked and int(m["to"]) == sq and m.get("promotion") != null
				)
		)
		if promotes:
			_open_promotion(sq)
			return
		var from: int = _picked
		_picked = -1
		_moves = []
		_marks.queue_redraw()
		await _client.send("move", {"from": from, "to": sq})
		return
	if _starts().has(sq) and sq != _picked:
		_sfx("select")
		_picked = sq
	else:
		_picked = -1
	_marks.queue_redraw()


func _open_promotion(to: int) -> void:
	_promoting = to
	var white: bool = _mine == "w"
	for kind: String in PROMOTIONS:
		var button: XomDaoButton = _promotion.find_child("Promote_" + kind, true, false)
		button.icon = _texture_of(kind.to_upper() if white else kind)
	_promotion.visible = true
	_promotion.reset_size()
	_promotion.position = _board.position + (_board.size - _promotion.size) / 2.0


func _close_promotion() -> void:
	_promoting = -1
	_promotion.visible = false


func _promote(kind: String) -> void:
	if _promoting < 0 or _picked < 0:
		_close_promotion()
		return
	var move: Dictionary = {"from": _picked, "to": _promoting, "promotion": kind}
	_close_promotion()
	_picked = -1
	_moves = []
	_marks.queue_redraw()
	await _client.send("move", move)


# ── Players, status and buttons ───────────────────────────────────────────────────────────


func _side_at_bottom() -> String:
	return CHESS_HUD.other(FIRST) if _flip else FIRST


## How many pieces `side` has taken.
func _taken_by(side: String) -> int:
	return _taken_pieces_by(side).size()


func _taken_pieces_by(side: String) -> Array[String]:
	var pieces: Array[String] = []
	for piece: Variant in _view.get("captured", []):
		if CHESS_HUD.side_of(str(piece)) != side:
			pieces.append(str(piece))
	return pieces


## The id playing a side.
func _player_of(side: String) -> String:
	var players: Array = _view.get("players", [])
	if players.size() < 2:
		return ""
	return str(players[0 if side == FIRST else 1])


func _player_info_of(id: String) -> XomDaoPlayerInfo:
	if _snapshot == null:
		return null
	for player: XomDaoPlayerInfo in _snapshot.seats + _snapshot.players:
		if player.id == id:
			return player
	return null


func _name_of(side: String) -> String:
	var id: String = _player_of(side)
	if id == _client.player_id:
		return "Bạn"
	if _snapshot != null:
		for player: XomDaoPlayerInfo in _snapshot.seats + _snapshot.players:
			if player.id == id:
				return player.name
	return str(SIDE_NAMES[side])


## Seat 0 is the side at the bottom (yours), with the player's SDK avatar, frame and record.
func _show_seats() -> void:
	var playing: bool = _view.get("end") == null and _snapshot.status == "playing"
	for i: int in 2:
		var side: String = _side_at_bottom() if i == 0 else CHESS_HUD.other(_side_at_bottom())
		var id: String = _player_of(side)
		var info: XomDaoPlayerInfo = _player_info_of(id)
		var wins: int = 0
		# The room's score counts wins by place in `players`.
		for i_player: int in _snapshot.players.size():
			var counted: bool = _snapshot.score != null and i_player < _snapshot.score.wins.size()
			if counted and _snapshot.players[i_player].id == id:
				wins = _snapshot.score.wins[i_player]
		var on_turn: bool = playing and str(_view.get("turn", "")) == side
		_seats[i].show_player(
			str(SIDE_NAMES[side]),
			_name_of(side),
			info,
			id != "" and id == str(_snapshot.host_id),
			wins,
			_taken_pieces_by(side),
			_piece_atlas,
			on_turn,
			playing
		)
	_layout()


func _show_status() -> void:
	var display: Dictionary = CHESS_HUD.status(_view, _mine, Callable(self, "_name_of"))
	_status.text = str(display["text"])
	_status.visible = bool(display["visible"])


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
	_update_utility_icons()
	_layout.call_deferred()


func _send(event: String) -> void:
	await _client.send(event)


## Đầu hàng asks once more ("Chắc chưa?") for three seconds.
func _on_resign() -> void:
	if _resign_armed:
		_resign_armed = false
		_update_utility_icons()
		await _client.send("resign")
		return
	_resign_armed = true
	_update_utility_icons()
	await get_tree().create_timer(3.0).timeout
	if _resign_armed:
		_resign_armed = false
		_update_utility_icons()


func _toggle_effects() -> void:
	_effects = not _effects
	var config := ConfigFile.new()
	config.set_value("chess", "effects", _effects)
	config.save("user://chess.cfg")
	_update_utility_icons()


func _update_utility_icons() -> void:
	CHESS_HUD.update_utility_icons(_effects_button, _resign, _effects, _resign_armed)


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sfx and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## The perspective board between the players' column and the right utility/action column.
func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	# The board takes what the player cards and occasional draw controls leave around it.
	var seats_width: float = COLUMN
	for seat: ChessPlayerSeat in _seats:
		seat.reset_size()
		seats_width = maxf(seats_width, seat.size.x)
	var buttons_width: float = BUTTON_WIDTH
	for button: XomDaoButton in [_decline, _draw]:
		button.reset_size()
		buttons_width = maxf(buttons_width, button.size.x)
	var room: float = right - left - seats_width - buttons_width - 32.0
	var max_height: float = maxf(size.y - 2.0 * edge, 240.0)
	var aspect: float = _board.texture.get_width() / float(_board.texture.get_height())
	var board_width: float = maxf(240.0, minf(max_height * aspect, room))
	var board_height: float = board_width / aspect
	var board_size := Vector2(board_width, board_height)
	var between: float = left + seats_width + 16.0
	var board_at := Vector2(
		between + maxf(0.0, (room - board_width) / 2.0), (size.y - board_height) / 2.0
	)
	_board.position = board_at
	_board.size = board_size
	_cell = Vector2(
		_project_board_point(4.5, 4.0).distance_to(_project_board_point(3.5, 4.0)),
		_project_board_point(4.0, 4.5).distance_to(_project_board_point(4.0, 3.5))
	)
	_marks.position = Vector2.ZERO
	_marks.size = size
	_pieces_layer.size = size
	_squares.size = size
	for square: Button in _squares.get_children():
		var sq: int = int(str(square.name).trim_prefix("Square_"))
		var points: PackedVector2Array = _square_points(sq)
		var min_x: float = points[0].x
		var max_x: float = points[0].x
		var min_y: float = points[0].y
		var max_y: float = points[0].y
		for point: Vector2 in points:
			min_x = minf(min_x, point.x)
			max_x = maxf(max_x, point.x)
			min_y = minf(min_y, point.y)
			max_y = maxf(max_y, point.y)
		square.position = Vector2(min_x, min_y)
		square.size = Vector2(max_x - min_x, max_y - min_y)
	if not _animating:
		_place_pieces()
	if _promotion.visible:
		_promotion.reset_size()
		_promotion.position = board_at + (_board.size - _promotion.size) / 2.0
	# Left column: the other player under ☰, yours at the bottom, the move count between.
	var column_right: float = board_at.x - 16.0
	for i: int in 2:
		var seat: ChessPlayerSeat = _seats[i]
		seat.pivot_offset = seat.size / 2.0
		var y: float = size.y - edge - seat.size.y if i == 0 else edge + MENU + 12.0
		var base := Vector2(left, y)
		seat.position = base - seat.size * (seat.scale - Vector2.ONE) / 2.0
	_move_count.reset_size()
	var move_height: float = maxf(_move_count.get_combined_minimum_size().y, 34.0)
	var gap_top: float = _seats[1].position.y + _seats[1].size.y
	var gap_bottom: float = _seats[0].position.y
	var move_y: float = gap_top + (gap_bottom - gap_top - move_height) / 2.0
	_move_count.position = Vector2(left, move_y)
	_move_count.size = Vector2(maxf(column_right - left, 1.0), move_height)
	# The icon utilities line up with ☰. Only draw-offer actions stay at the lower right.
	_effects_button.reset_size()
	_resign.reset_size()
	_effects_button.size = Vector2(MENU, MENU)
	_resign.size = Vector2(MENU, MENU)
	_effects_button.position = Vector2(right - MENU * 2.0 - 12.0, edge)
	_resign.position = Vector2(right - MENU, edge)
	# Status text appears only for check, a received draw offer or the result.
	var column_left: float = board_at.x + board_size.x + 16.0
	var width: float = maxf(right - column_left, 1.0)
	var status_font: Font = _status.get_theme_font("font")
	var status_text_width: float = width
	var status_height: float = (
		status_font
		. get_multiline_string_size(
			_status.text, HORIZONTAL_ALIGNMENT_CENTER, status_text_width, 26
		)
		. y
	)
	_status.position = Vector2(column_left, edge + MENU + 12.0)
	_status.size = Vector2(width, clampf(status_height, 44.0, 144.0))
	var y: float = size.y - edge
	for button: XomDaoButton in [_decline, _draw]:
		if not button.visible:
			continue
		button.reset_size()
		y -= button.size.y
		button.position = Vector2(right - button.size.x, y)
		y -= 10.0
	_marks.queue_redraw()
