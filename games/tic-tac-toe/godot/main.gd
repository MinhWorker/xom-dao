extends Control
## Caro on a notebook page with an expanding board, player HUD and emote bubbles.

const PAPER_CELL := preload("res://content/tic-tac-toe/paper_cell.gd")
const RED := Color("#a52f3e")
const BLUE := Color("#245477")
const HOVER := Color(0.62, 0.72, 0.76, 0.2)
const LAST := Color(0.85, 0.68, 0.3, 0.12)
const WIN_TINT := Color(0.91, 0.7, 0.24, 0.24)
## Marks in a row that win (WIN in src/game/model.ts).
const WIN := 5
const GLIDE_SECONDS := 0.65
## The hub's ☰ button keeps the top left square.
const MENU := 88.0
const COLUMN := 254.0
const INFO_COLUMN := 230.0
const MARK_TARGET := 44.0
const MARK_BADGE := 34.0
const EMOTE_BUBBLE_SIZE := 180.0
const EMOTE_STICKER_SIZE := 128.0
const EMOTE_TAIL_TIP_RATIO := 0.91
const SOUNDS: Array[String] = [
	"caro-draw", "caro-line-complete", "caro-o-place", "caro-select", "caro-start", "mark-drop"
]
const PLACE_SOUND: Dictionary = {"X": "mark-drop", "O": "caro-o-place"}
const DIRECTIONS: Array[Vector2i] = [
	Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1), Vector2i(1, -1)
]

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}

var _paper := TextureRect.new()
var _board := Control.new()
var _tiles_layer := Control.new()
var _pieces_layer := Control.new()
var _cells := Control.new()
var _info_panel := Panel.new()
var _status := Label.new()
var _status_mark := TextureRect.new()
var _rule: XomDaoChip = XomDaoChip.create("Nối 5")
var _seat_panels: Array[Panel] = []
var _slots: Array[XomDaoPlayerSlot] = []
var _mark_badges: Array[Control] = []
var _mark_visuals: Array[PanelContainer] = []
var _icons: Array[TextureRect] = []
var _emote_bubbles: Array[Control] = []
var _emote_stickers: Array[TextureRect] = []
var _emote_tweens: Array[Tween] = []
var _emote_shade := ColorRect.new()
var _emote_panel: XomDaoBoard = XomDaoBoard.create("Biểu cảm", true)
var _emote_grid := GridContainer.new()
var _emote_holder := CenterContainer.new()
var _emote_note := Label.new()
var _owned_emotes: Array[String] = []
var _loading_emotes: bool = false
var _sounds: Dictionary = {}
var _textures: Dictionary = {}

var _tiles: Dictionary = {}
var _buttons: Dictionary = {}
var _pieces: Dictionary = {}
var _win_ring := Line2D.new()
var _result_visible: bool = true
var _board_center := Vector2.ZERO
var _shape := Vector4i(0, 0, -1, -1)
var _mid := Vector2.ZERO
var _cell: float = 40.0
var _area := Rect2()
var _glide: Tween
var _hovered := Vector2i(1 << 20, 1 << 20)
var _round: int = -1
var _seq: int = -1
var _ended: bool = false
var _line: Array[Vector2i] = []


## Options for a sandbox room (`?play=tic-tac-toe` in a debug build): against the computer.
func sandbox_options() -> Dictionary:
	return {"opponent": "bot"}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts).
func room_setup() -> Array:
	return [
		{"key": "opponent", "label": "Chơi với", "options": [["Bạn bè", "human"], ["Máy", "bot"]]},
		{
			"key": "level",
			"label": "Máy chơi",
			"options": [["Dễ", "easy"], ["Vừa", "normal"], ["Khó", "hard"]]
		},
		{"key": "swap", "label": "Bạn cầm quân", "options": [["X (đi trước)", false], ["O", true]]},
	]


## How the game ended and its figures, for the hub's result board.
func result_detail() -> Dictionary:
	# The hub may ask before this scene heard the last state.
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty():
		return {}
	var board: Dictionary = _view["board"]
	var moves: int = 0
	for cell: Variant in board["cells"]:
		if cell != null:
			moves += 1
	var how: String = "Nối đủ %d quân" % WIN if not _line.is_empty() else "Hết chỗ để nối %d" % WIN
	return {"reason": how, "rows": [["Số nước", str(moves)]]}


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	client.emote_received.connect(_on_emote_received)
	if not client.connected.is_connected(_load_owned_emotes):
		client.connected.connect(_load_owned_emotes)
	if client.user != null:
		_load_owned_emotes.call_deferred()
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	var paper_color := ColorRect.new()
	paper_color.color = Color("#f4eedf")
	paper_color.set_anchors_preset(Control.PRESET_FULL_RECT)
	paper_color.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(paper_color)
	_paper.texture = _art("paper")
	_paper.stretch_mode = TextureRect.STRETCH_TILE
	_paper.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	_paper.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_paper)

	_board.name = "Board"
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_board)
	for layer: Control in [_tiles_layer, _pieces_layer, _cells]:
		layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_board.add_child(layer)

	_info_panel.name = "InfoPanel"
	_info_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_info_panel.add_theme_stylebox_override(
		"panel", XomDaoUi.with_shadow(XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.PAPER_DARK, 2, 20.0))
	)
	add_child(_info_panel)
	_status.name = "Status"
	_status.add_theme_font_override("font", XomDaoUi.display_font(800))
	_status.add_theme_font_size_override("font_size", 32)
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_status.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_status.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	add_child(_status)
	_status_mark.name = "TurnMark"
	_status_mark.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_status_mark.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_status_mark.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_status_mark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_status_mark)
	_rule.name = "Rule"
	_rule.text = "Nối %d" % WIN
	add_child(_rule)
	for seat: int in 2:
		var seat_panel := Panel.new()
		seat_panel.name = "SeatPanel_%d" % seat
		seat_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		seat_panel.add_theme_stylebox_override(
			"panel",
			XomDaoUi.with_shadow(XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.PAPER_DARK, 2, 20.0))
		)
		add_child(seat_panel)
		_seat_panels.append(seat_panel)
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		slot.avatar.name = "Avatar_%d" % seat
		slot.compact = true
		slot.avatar.gui_input.connect(_on_avatar_input.bind(seat))
		add_child(slot)
		_slots.append(slot)
		var badge := Control.new()
		badge.name = "Mark_%d" % seat
		badge.custom_minimum_size = Vector2.ONE * MARK_TARGET
		badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
		badge.gui_input.connect(_on_mark_input.bind(seat))
		badge.mouse_entered.connect(_mark_hover.bind(seat, true))
		badge.mouse_exited.connect(_mark_hover.bind(seat, false))
		badge.mouse_default_cursor_shape = Control.CURSOR_ARROW
		slot.avatar.add_child(badge)
		_mark_badges.append(badge)
		var visual := PanelContainer.new()
		visual.name = "MarkBadge_%d" % seat
		visual.custom_minimum_size = Vector2.ONE * MARK_BADGE
		visual.size = visual.custom_minimum_size
		visual.position = Vector2.ONE * ((MARK_TARGET - MARK_BADGE) / 2.0)
		visual.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var badge_style := XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.PAPER_DARK, 2, 22.0)
		badge_style.set_content_margin_all(3.0)
		visual.add_theme_stylebox_override("panel", badge_style)
		badge.add_child(visual)
		_mark_visuals.append(visual)
		var icon := TextureRect.new()
		icon.name = "MarkIcon_%d" % seat
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		visual.add_child(icon)
		_icons.append(icon)
		var bubble := _make_emote_bubble(seat)
		slot.avatar.add_child(bubble)
		_emote_bubbles.append(bubble)
	_emote_shade.name = "EmoteShade"
	_emote_shade.color = Color(XomDaoUi.INK, 0.16)
	_emote_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_emote_shade.visible = false
	_emote_shade.z_index = 10
	_emote_shade.gui_input.connect(_on_emote_shade_input)
	add_child(_emote_shade)
	_emote_panel.name = "EmotePanel"
	_emote_panel.visible = false
	_emote_panel.z_index = 11
	_emote_panel.closed.connect(_on_emote_panel_closed)
	_emote_grid.name = "Emotes"
	_emote_grid.columns = 3
	_emote_grid.add_theme_constant_override("h_separation", 8)
	_emote_grid.add_theme_constant_override("v_separation", 8)
	_emote_holder.name = "EmoteHolder"
	_emote_holder.custom_minimum_size.x = 304.0
	_emote_holder.add_child(_emote_grid)
	_emote_note.name = "EmoteNote"
	_emote_note.custom_minimum_size.x = 304.0
	_emote_note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_emote_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_emote_note.add_theme_font_override("font", XomDaoUi.body_font(true))
	_emote_note.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_emote_panel.content.add_child(_emote_note)
	_emote_panel.content.add_child(_emote_holder)
	add_child(_emote_panel)
	_rebuild_emote_picker()
	_win_ring.default_color = Color("#d4a333")
	_win_ring.width = 3.0
	_win_ring.antialiased = true
	_tiles_layer.add_child(_win_ring)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.bus = XomDaoSettings.SFX_BUS
		player.stream = load("res://content/tic-tac-toe/sounds/%s.wav" % sound)
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
	var first: bool = _view.is_empty()
	_view = view
	var fresh: bool = snapshot.round != _round
	if fresh:
		_round = snapshot.round
		_seq = -1
		_clear_pieces()
		_result_visible = true
		if not first and snapshot.status == "playing":
			_sfx("caro-start")
	var board: Dictionary = view["board"]
	var shape := Vector4i(
		int(board["left"]), int(board["top"]), int(board["cols"]), int(board["rows"])
	)
	if shape != _shape:
		_sync_tiles(shape, not first and not fresh)
		_frame(not first and not fresh)
	var placed := Vector2i(1 << 20, 1 << 20)
	if snapshot.last != null and snapshot.last.seq != _seq:
		var move: Variant = snapshot.last.move
		if not first and move is Dictionary and (move as Dictionary).get("payload") is Dictionary:
			var payload: Dictionary = (move as Dictionary)["payload"]
			placed = Vector2i(int(payload.get("x", 0)), int(payload.get("y", 0)))
		_seq = snapshot.last.seq
	_sync_pieces(placed)
	_line = _winning_line()
	var ended: bool = snapshot.status != "playing" and snapshot.result != null
	if ended and not _ended and not first:
		_sfx("caro-line-complete" if not _line.is_empty() else "caro-draw")
	_ended = ended
	_tint_tiles()
	_place_board()
	_show_seats()
	_show_status()
	_layout()


func _art(name_of: String) -> Texture2D:
	if not _textures.has(name_of):
		_textures[name_of] = load("res://content/tic-tac-toe/art/%s.webp" % name_of)
	return _textures[name_of]


func _make_emote_bubble(seat: int) -> Control:
	var bubble := Control.new()
	bubble.name = "Emote_%d" % seat
	bubble.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bubble.custom_minimum_size = Vector2.ONE * EMOTE_BUBBLE_SIZE
	var art := TextureRect.new()
	art.name = "BubbleArt"
	art.texture = _art("emote-bubble")
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	art.flip_v = seat == 1
	art.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bubble.add_child(art)
	var sticker := TextureRect.new()
	sticker.name = "Sticker"
	sticker.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	sticker.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	sticker.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	sticker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sticker.custom_minimum_size = Vector2.ONE * EMOTE_STICKER_SIZE
	sticker.size = sticker.custom_minimum_size
	sticker.position = Vector2(26.0, 21.0)
	bubble.add_child(sticker)
	bubble.visible = false
	bubble.z_index = 5
	_emote_stickers.append(sticker)
	_emote_tweens.append(null)
	return bubble


func _at(p: Vector2i) -> String:
	var board: Dictionary = _view["board"]
	var col: int = p.x - int(board["left"])
	var row: int = p.y - int(board["top"])
	if col < 0 or row < 0 or col >= int(board["cols"]) or row >= int(board["rows"]):
		return ""
	var cell: Variant = (board["cells"] as Array)[row * int(board["cols"]) + col]
	return "" if cell == null else str(cell)


## A cell's centre on screen, in the board layer.
func _center_of(p: Vector2i) -> Vector2:
	return _board_center + (Vector2(p) - _mid) * _cell


## Sync tiles and buttons, fading new edge tiles in from nearest the old board first.
func _sync_tiles(shape: Vector4i, animate: bool) -> void:
	var old: Vector4i = _shape
	_shape = shape
	var wanted: Dictionary = {}
	for y: int in range(shape.y, shape.y + shape.w):
		for x: int in range(shape.x, shape.x + shape.z):
			wanted[Vector2i(x, y)] = true
	for p: Vector2i in _tiles.keys():
		if wanted.has(p):
			continue
		_tiles[p].queue_free()
		_buttons[p].queue_free()
		_tiles.erase(p)
		_buttons.erase(p)
	for p: Vector2i in wanted:
		if _tiles.has(p):
			continue
		var tile: Control = PAPER_CELL.new()
		tile.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_tiles_layer.add_child(tile)
		_tiles[p] = tile
		var cell := Button.new()
		cell.name = "Cell_%d_%d" % [p.x, p.y]
		cell.flat = true
		cell.focus_mode = Control.FOCUS_NONE
		var clear := StyleBoxEmpty.new()
		for state: String in ["normal", "hover", "pressed", "disabled", "focus"]:
			cell.add_theme_stylebox_override(state, clear)
		cell.pressed.connect(_tap.bind(p))
		cell.mouse_entered.connect(_hover.bind(p))
		cell.mouse_exited.connect(_hover.bind(Vector2i(1 << 20, 1 << 20)))
		_cells.add_child(cell)
		_buttons[p] = cell
		if animate and old.z > 0 and is_inside_tree():
			var away: int = maxi(
				maxi(old.x - p.x, p.x - (old.x + old.z - 1)),
				maxi(old.y - p.y, p.y - (old.y + old.w - 1))
			)
			tile.modulate.a = 0.0
			tile.create_tween().tween_property(tile, "modulate:a", 1.0, 0.32).set_delay(
				0.12 + away * 0.11
			)

	for p: Vector2i in _tiles:
		_tiles[p].set("left_edge", p.x == shape.x)
		_tiles[p].set("top_edge", p.y == shape.y)


## Glides (or jumps) so the whole board fits the board area, centred.
func _frame(smooth: bool) -> void:
	if _shape.z <= 0:
		return
	var mid := Vector2(_shape.x + (_shape.z - 1) / 2.0, _shape.y + (_shape.w - 1) / 2.0)
	var cell: float = minf(_area.size.x, _area.size.y) / maxi(_shape.z, _shape.w)
	if _glide != null:
		_glide.kill()
	if not smooth or not is_inside_tree():
		_board_center = _area.get_center()
		_mid = mid
		_cell = cell
		_place_board()
		return
	_glide = create_tween().set_parallel().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	_glide.tween_property(self, "_board_center", _area.get_center(), GLIDE_SECONDS)
	_glide.tween_property(self, "_mid", mid, GLIDE_SECONDS)
	_glide.tween_property(self, "_cell", cell, GLIDE_SECONDS)
	_glide.tween_method(func(_t: float) -> void: _place_board(), 0.0, 1.0, GLIDE_SECONDS)


func _place_board() -> void:
	for p: Vector2i in _tiles:
		var at: Vector2 = _center_of(p)
		var tile: Control = _tiles[p]
		tile.size = Vector2.ONE * _cell
		tile.position = at - tile.size / 2.0
		var cell: Button = _buttons[p]
		cell.size = Vector2.ONE * _cell
		cell.position = at - cell.size / 2.0
	for p: Vector2i in _pieces:
		var piece: Control = _pieces[p]
		piece.size = Vector2.ONE * _cell * 0.68
		piece.pivot_offset = piece.size / 2.0
		piece.position = _center_of(p) - piece.size / 2.0

	_place_win_ring()


func _clear_pieces() -> void:
	for piece: Control in _pieces.values():
		piece.queue_free()
	_pieces.clear()
	_win_ring.clear_points()


## A new lacquer mark pops into place with its placement sound.
func _sync_pieces(placed: Vector2i) -> void:
	for p: Vector2i in _pieces.keys():
		if _at(p) != "":
			continue
		_pieces[p].queue_free()
		_pieces.erase(p)
	for p: Vector2i in _tiles:
		var mark: String = _at(p)
		if mark == "" or _pieces.has(p):
			continue
		var piece := TextureRect.new()
		piece.name = "Piece_%d_%d" % [p.x, p.y]
		piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		piece.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		piece.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		piece.texture = _mark_texture(mark)
		piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_pieces_layer.add_child(piece)
		_pieces[p] = piece
		if p == placed and is_inside_tree():
			piece.scale = Vector2.ONE * 0.78
			piece.modulate.a = 0.0
			var tween: Tween = piece.create_tween().set_parallel()
			tween.set_trans(Tween.TRANS_BACK)
			tween.set_ease(Tween.EASE_OUT)
			tween.tween_property(piece, "scale", Vector2.ONE, 0.2)
			tween.tween_property(piece, "modulate:a", 1.0, 0.14)
			_sfx(PLACE_SOUND[mark])
	_place_board()


func _mark_texture(mark: String) -> Texture2D:
	return _art("mark-x" if mark == "X" else "mark-o")


## The first WIN cells in a row with the same mark, or none.
func _winning_line() -> Array[Vector2i]:
	for p: Vector2i in _tiles:
		var mark: String = _at(p)
		if mark == "":
			continue
		for step: Vector2i in DIRECTIONS:
			var line: Array[Vector2i] = []
			for i: int in WIN:
				if _at(p + step * i) != mark:
					break
				line.append(p + step * i)
			if line.size() == WIN:
				return line
	return []


func _can_play(p: Vector2i) -> bool:
	return (
		_snapshot != null
		and _snapshot.status == "playing"
		and str(_view.get("turn", "")) == _client.player_id
		and _at(p) == ""
	)


## Gold under the winning line, light under the mouse where you may play, else plain.
func _tint_tiles() -> void:
	var last := Vector2i(1 << 20, 1 << 20)
	if _snapshot != null and _snapshot.last != null and _snapshot.last.move is Dictionary:
		var payload: Variant = (_snapshot.last.move as Dictionary).get("payload")
		if payload is Dictionary:
			last = Vector2i(int(payload.get("x", 0)), int(payload.get("y", 0)))
	for p: Vector2i in _tiles:
		var tile: Control = _tiles[p]
		if _line.has(p):
			tile.set("wash", WIN_TINT)
		elif p == _hovered and _can_play(p):
			tile.set("wash", HOVER)
		elif p == last and _snapshot.status == "playing":
			tile.set("wash", LAST)
		else:
			tile.set("wash", Color.TRANSPARENT)
		(_buttons[p] as Button).disabled = not _can_play(p)


## A restrained gold oval around the winning row, behind the marks.
func _place_win_ring() -> void:
	_win_ring.clear_points()
	if _line.is_empty():
		return
	var first: Vector2 = _center_of(_line[0])
	var last: Vector2 = _center_of(_line[-1])
	var center: Vector2 = (first + last) / 2.0
	var angle: float = (last - first).angle()
	var radius: float = first.distance_to(last) / 2.0 + _cell * 0.48
	for i: int in 81:
		var t: float = TAU * float(i) / 80.0
		var point := Vector2(cos(t) * radius, sin(t) * _cell * 0.46)
		point.y += sin(t * 3.0) * _cell * 0.035
		_win_ring.add_point(center + point.rotated(angle))


func _tap(p: Vector2i) -> void:
	if not _can_play(p):
		return
	_hovered = Vector2i(1 << 20, 1 << 20)
	(_buttons[p] as Button).disabled = true
	await _client.send("place", {"x": p.x, "y": p.y})


func _hover(p: Vector2i) -> void:
	_hovered = p
	if not _view.is_empty():
		_tint_tiles()


# ── Players, status and the host's swap ───────────────────────────────────────────────────


## The id that plays a mark: players[0] is X.
func _player_of(mark: String) -> String:
	var players: Array = _view.get("players", [])
	if players.size() < 2:
		return ""
	return str(players[0 if mark == "X" else 1])


func _mine() -> String:
	if _player_of("O") == _client.player_id:
		return "O"
	return "X" if _player_of("X") == _client.player_id else ""


func _name(id: String) -> String:
	if id == _client.player_id:
		return "Bạn"
	for player: XomDaoPlayerInfo in _snapshot.seats + _snapshot.players:
		if player.id == id:
			return player.name
	return "?"


## Slot 0 (at the bottom) is yours, or X for a spectator; each with its wins and its piece.
func _show_seats() -> void:
	var bottom: String = "O" if _mine() == "O" else "X"
	for i: int in 2:
		var mark: String = bottom if i == 0 else ("X" if bottom == "O" else "O")
		var id: String = _player_of(mark)
		var slot: XomDaoPlayerSlot = _slots[i]
		slot.player_name = _name(id)
		slot.host = id != "" and id == str(_snapshot.host_id)
		slot.picture = null
		slot.frame = ""
		for seat: XomDaoPlayerInfo in _snapshot.seats:
			if seat.id == id:
				var avatar_id: String = seat.avatar
				if avatar_id == "" and seat.bot:
					avatar_id = "bot"
				slot.picture = XomDaoLooks.avatar(avatar_id)
				slot.frame = seat.frame
		# The room's score counts wins by place in `players`.
		var wins: int = 0
		for i_player: int in _snapshot.players.size():
			var counted: bool = _snapshot.score != null and i_player < _snapshot.score.wins.size()
			if counted and _snapshot.players[i_player].id == id:
				wins = _snapshot.score.wins[i_player]
		slot.extra = "Thắng %d" % wins
		var on_turn: bool = _snapshot.status == "playing" and str(_view.get("turn", "")) == id
		if on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
		var selectable: bool = _can_choose_mark(i)
		var can_emote: bool = id != "" and id == _client.player_id
		_icons[i].texture = _mark_texture(_next_mark() if selectable else mark)
		_slots[i].avatar.mouse_filter = (
			Control.MOUSE_FILTER_PASS if can_emote or selectable else Control.MOUSE_FILTER_IGNORE
		)
		_slots[i].avatar.mouse_default_cursor_shape = (
			Control.CURSOR_POINTING_HAND if can_emote else Control.CURSOR_ARROW
		)
		_mark_badges[i].mouse_filter = (
			Control.MOUSE_FILTER_STOP if selectable else Control.MOUSE_FILTER_IGNORE
		)
		_mark_badges[i].mouse_default_cursor_shape = (
			Control.CURSOR_POINTING_HAND if selectable else Control.CURSOR_ARROW
		)
		_style_mark_badge(i, selectable)


func _on_emote_received(emote: XomDaoRoomEmote) -> void:
	if _snapshot == null or _client == null or _view.is_empty():
		return
	var bottom: String = "O" if _mine() == "O" else "X"
	var seat_index: int = -1
	for i: int in 2:
		var mark: String = bottom if i == 0 else ("X" if bottom == "O" else "O")
		if _player_of(mark) == emote.player_id:
			seat_index = i
			break
	if seat_index < 0:
		return
	var sticker: Texture2D = XomDaoLooks.emote(emote.emote)
	if sticker == null:
		return
	var bubble: Control = _emote_bubbles[seat_index]
	var previous: Tween = _emote_tweens[seat_index]
	if previous != null and previous.is_running():
		previous.kill()
	_emote_stickers[seat_index].texture = sticker
	bubble.visible = true
	bubble.scale = Vector2.ONE * 0.72
	bubble.modulate.a = 0.0
	var tween := bubble.create_tween()
	tween.set_parallel()
	tween.set_trans(Tween.TRANS_BACK)
	tween.set_ease(Tween.EASE_OUT)
	tween.tween_property(bubble, "scale", Vector2.ONE, 0.2)
	tween.tween_property(bubble, "modulate:a", 1.0, 0.14)
	tween.set_parallel(false)
	tween.tween_interval(1.55)
	tween.tween_property(bubble, "modulate:a", 0.0, 0.24)
	tween.tween_callback(func() -> void: bubble.visible = false)
	_emote_tweens[seat_index] = tween


func _on_avatar_input(event: InputEvent, seat: int) -> void:
	if _client == null or _snapshot == null or seat < 0 or seat >= _slots.size():
		return
	var bottom: String = "O" if _mine() == "O" else "X"
	var mark: String = bottom if seat == 0 else ("X" if bottom == "O" else "O")
	if _player_of(mark) != _client.player_id:
		return
	var mouse := event as InputEventMouseButton
	if mouse != null and mouse.button_index == MOUSE_BUTTON_LEFT and mouse.pressed:
		_slots[seat].avatar.accept_event()
		_toggle_emote_picker()
		return
	var touch := event as InputEventScreenTouch
	if touch != null and touch.pressed:
		_slots[seat].avatar.accept_event()
		_toggle_emote_picker()


func _toggle_emote_picker() -> void:
	if _emote_panel.visible:
		_emote_panel.close()
		return
	_rebuild_emote_picker()
	_emote_shade.visible = true
	_emote_panel.visible = true
	_emote_panel.reset_size()
	_layout_emote_panel()
	_emote_panel.open()


func _on_emote_shade_input(event: InputEvent) -> void:
	var mouse := event as InputEventMouseButton
	var touch := event as InputEventScreenTouch
	if (
		(mouse != null and mouse.button_index == MOUSE_BUTTON_LEFT and mouse.pressed)
		or (touch != null and touch.pressed)
	):
		_emote_shade.accept_event()
		_emote_panel.close()


func _on_emote_panel_closed() -> void:
	_emote_shade.visible = false


func _layout_emote_panel() -> void:
	var own_seat: int = _own_seat()
	if own_seat < 0:
		_emote_panel.position = (size - _emote_panel.size) / 2.0
		return
	var avatar: Control = _slots[own_seat].avatar
	var avatar_rect: Rect2 = avatar.get_global_rect()
	var panel_size: Vector2 = _emote_panel.size
	var popup := avatar_rect.position + Vector2(0.0, -panel_size.y - 18.0)
	var safe: Vector2 = XomDaoFrame.safe_inset(self)
	var inset: Vector2 = safe + Vector2.ONE * float(XomDaoSettings.current().margin)
	popup = popup.clamp(inset, (size - inset - panel_size).max(inset))
	_emote_panel.position = get_global_transform_with_canvas().affine_inverse() * popup


func _own_seat() -> int:
	if _client == null or _view.is_empty():
		return -1
	var bottom: String = "O" if _mine() == "O" else "X"
	for seat: int in 2:
		var mark: String = bottom if seat == 0 else ("X" if bottom == "O" else "O")
		if _player_of(mark) == _client.player_id:
			return seat
	return -1


func _load_owned_emotes() -> void:
	if _client == null or _client.user == null or _loading_emotes:
		return
	_loading_emotes = true
	_rebuild_emote_picker()
	var looks: Array[String] = await _client.owned_emotes()
	_loading_emotes = false
	if not is_inside_tree():
		return
	_owned_emotes = looks
	_rebuild_emote_picker()
	if _emote_panel.visible:
		_emote_panel.reset_size()
		_layout_emote_panel()


func _rebuild_emote_picker() -> void:
	if not is_instance_valid(_emote_grid):
		return
	for child: Node in _emote_grid.get_children():
		_emote_grid.remove_child(child)
		child.queue_free()
	_emote_grid.columns = 3
	_emote_grid.visible = not _owned_emotes.is_empty()
	_emote_holder.visible = not _owned_emotes.is_empty()
	_emote_note.text = "Đang tải biểu cảm" if _loading_emotes else "Chưa có biểu cảm"
	_emote_note.visible = _owned_emotes.is_empty()
	for look: String in _owned_emotes:
		var sticker: Texture2D = XomDaoLooks.emote(look)
		if sticker == null:
			continue
		var pick := XomDaoIconButton.create("")
		pick.name = "Emote_%s" % look
		pick.icon = sticker
		pick.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		for state: String in ["normal", "hover", "pressed", "disabled", "hover_pressed"]:
			var icon_style := StyleBoxEmpty.new()
			icon_style.set_content_margin_all(12.0)
			icon_style.content_margin_top = 10.0 - XomDaoIconButton.DEPTH / 2.0
			icon_style.content_margin_bottom = 10.0 + XomDaoIconButton.DEPTH / 2.0
			pick.add_theme_stylebox_override(state, icon_style)
		for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
			pick.add_theme_color_override(state, Color.WHITE)
		pick.tooltip_text = str(XomDaoMenu.EMOTE_LABELS.get(look, look))
		pick.pressed.connect(_choose_emote.bind(look))
		_emote_grid.add_child(pick)


func _choose_emote(look: String) -> void:
	if _client == null or not _owned_emotes.has(look):
		return
	_emote_panel.close()
	await _client.send_emote(look)


func _show_status() -> void:
	var playing: bool = _snapshot.status == "playing"
	if not playing:
		_status.text = "Hết ván"
	elif str(_view.get("turn", "")) == _client.player_id:
		_status.text = "Lượt bạn"
	else:
		_status.text = "Lượt %s" % _name(str(_view.get("turn", "")))
	_status.add_theme_color_override("font_color", RED if _turn_mark() == "X" else BLUE)
	if not playing:
		_status.add_theme_color_override("font_color", BLUE)
	_status_mark.texture = _mark_texture(_turn_mark()) if playing else null


func _turn_mark() -> String:
	return "X" if str(_view.get("turn", "")) == _player_of("X") else "O"


## The piece the host plays next game, from the room's `swap` option.
func _next_mark() -> String:
	var options: Dictionary = _snapshot.options if _snapshot.options is Dictionary else {}
	var first: bool = _snapshot.players.size() > 0 and _snapshot.players[0].id == _client.player_id
	return "X" if first != bool(options.get("swap", false)) else "O"


func _can_choose_mark(seat: int) -> bool:
	if (
		_snapshot == null
		or _client == null
		or seat < 0
		or seat >= 2
		or _snapshot.status == "playing"
		or _snapshot.players.size() != 2
		or _snapshot.host_id == null
		or str(_snapshot.host_id) != _client.player_id
	):
		return false
	var bottom: String = "O" if _mine() == "O" else "X"
	var mark: String = bottom if seat == 0 else ("X" if bottom == "O" else "O")
	return _player_of(mark) == _client.player_id


func _style_mark_badge(seat: int, selectable: bool, hovered: bool = false) -> void:
	var badge: PanelContainer = _mark_visuals[seat]
	var fill: Color = XomDaoUi.PAPER if not hovered else XomDaoUi.CREAM
	var border: Color = XomDaoUi.GOLD_DARK if selectable else XomDaoUi.PAPER_DARK
	var width: int = 3 if selectable else 2
	var style := XomDaoUi.box(fill, border, width, 22.0)
	style.set_content_margin_all(3.0)
	badge.add_theme_stylebox_override("panel", style)


func _mark_hover(seat: int, hovered: bool) -> void:
	if seat >= 0 and seat < _mark_badges.size():
		_style_mark_badge(seat, _can_choose_mark(seat), hovered)


func _on_mark_input(event: InputEvent, seat: int) -> void:
	if not _can_choose_mark(seat):
		return
	var pressed: bool = false
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		pressed = mouse_event.pressed and mouse_event.button_index == MOUSE_BUTTON_LEFT
	elif event is InputEventScreenTouch:
		pressed = (event as InputEventScreenTouch).pressed
	if pressed:
		_mark_badges[seat].accept_event()
		_toggle_next_mark()


func _toggle_next_mark() -> void:
	if _snapshot == null or _client == null:
		return
	_sfx("caro-select")
	var options: Dictionary = (
		(_snapshot.options as Dictionary).duplicate() if _snapshot.options is Dictionary else {}
	)
	options["swap"] = not bool(options.get("swap", false))
	await _client.request("room:options", {"options": options})


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sfx and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## Centre the board between player panels and turn info; the host toggles marks on their badge.
func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	_paper.size = size
	var seats_width: float = COLUMN
	for slot: XomDaoPlayerSlot in _slots:
		slot.reset_size()
		seats_width = maxf(seats_width, slot.size.x + 24.0)
	var room: float = right - left - seats_width - INFO_COLUMN - 32.0
	var side: float = clampf(minf(size.y - 2.0 * edge, room), 200.0, size.y)
	var between: float = left + seats_width + 16.0
	var area := Rect2(
		Vector2(between + maxf(0.0, (room - side) / 2.0), (size.y - side) / 2.0),
		Vector2(side, side)
	)
	var docked: bool = _ended and _result_visible
	if docked:
		var panel: Rect2 = result_area()
		var board_left: float = left + seats_width + 16.0
		var available: float = panel.position.x - board_left - 16.0
		var top: float = inset.y + edge + MENU + 12.0
		var height: float = size.y - inset.y - edge - top
		var final_side: float = minf(available, height)
		area = Rect2(
			Vector2(board_left + (available - final_side) / 2.0, top + (height - final_side) / 2.0),
			Vector2.ONE * final_side
		)
	_status.visible = not docked
	_status_mark.visible = not docked and _snapshot != null and _snapshot.status == "playing"
	_rule.visible = not docked
	_info_panel.visible = not docked
	for i: int in _slots.size():
		_slots[i].visible = true
		_seat_panels[i].visible = true
		_mark_badges[i].visible = true
	var resized_area: bool = area != _area
	_area = area
	for layer: Control in [_board, _tiles_layer, _pieces_layer, _cells]:
		layer.position = Vector2.ZERO
		layer.size = size
	if resized_area:
		_frame(_shape.z > 0 and _board_center != Vector2.ZERO)
	for i: int in 2:
		var slot: XomDaoPlayerSlot = _slots[i]
		var y: float = size.y - edge - slot.size.y if i == 0 else edge + MENU + 12.0
		slot.position = Vector2(left, y)
		_seat_panels[i].position = slot.position - Vector2(12.0, 10.0)
		_seat_panels[i].size = slot.size + Vector2(24.0, 20.0)
	_place_icons.call_deferred()
	var column_left: float = area.end.x + 16.0
	var info_top: float = edge + 8.0
	var panel_position := Vector2(column_left - 12.0, info_top - 12.0)
	_info_panel.position = panel_position
	_info_panel.size = Vector2(right - panel_position.x, 128.0)
	_status_mark.position = panel_position + Vector2(12.0, 12.0)
	_status_mark.size = Vector2.ONE * 56.0
	_status.position = panel_position + Vector2(76.0, 16.0)
	_status.reset_size()
	_status.size = Vector2(_info_panel.size.x - 88.0, 56.0)
	_rule.position = panel_position + Vector2(12.0, 76.0)
	_rule.reset_size()
	if _emote_panel.visible:
		_layout_emote_panel.call_deferred()


## Each player's mark sits on their avatar like a badge, once the slots have laid out.
func _place_icons() -> void:
	for i: int in _slots.size():
		var avatar: Control = _slots[i].avatar
		var badge: Control = _mark_badges[i]
		badge.size = badge.custom_minimum_size
		badge.position = avatar.size - badge.size
		var bubble: Control = _emote_bubbles[i]
		bubble.size = Vector2.ONE * EMOTE_BUBBLE_SIZE
		var panel_rect: Rect2 = _seat_panels[i].get_global_rect()
		var avatar_top: float = avatar.get_global_rect().position.y
		var panel_edge: float = (panel_rect.end.y if i == 1 else panel_rect.position.y) - avatar_top
		var tip_offset: float = (
			EMOTE_BUBBLE_SIZE * EMOTE_TAIL_TIP_RATIO
			if i == 0
			else EMOTE_BUBBLE_SIZE * (1.0 - EMOTE_TAIL_TIP_RATIO)
		)
		var bubble_y: float = (
			panel_edge - 8.0 - tip_offset if i == 0 else panel_edge + 8.0 - tip_offset
		)
		bubble.position = Vector2(avatar.size.x - EMOTE_BUBBLE_SIZE * 0.17, bubble_y)


## Optional hub hook: a result HUD on the right, without a shade over the final board.
func result_area() -> Rect2:
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = size.x * 0.5 + 16.0
	return Rect2(
		Vector2(left, inset.y + edge + 80.0),
		Vector2(size.x - inset.x - edge - left, size.y - inset.y * 2.0 - edge * 2.0 - 180.0)
	)


## Xem bàn restores the centred board; Kết quả slides it left again.
func set_result_visible(shown: bool) -> void:
	_result_visible = shown
	_layout()
