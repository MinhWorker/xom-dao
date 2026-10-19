class_name ChessPlayerSeat
extends PanelContainer
## One player's identity, win record, turn state and captured-piece row.

const PIECE_ATLAS = preload("res://content/chess/chess_piece_atlas.gd")
const CHESS_HUD = preload("res://content/chess/chess_hud.gd")
const CAPTURE_ICON_SIZE := 22.0
const CAPTURE_ICON_STEP := 9.0
const ACTIVE_SEAT_SCALE := 1.05
const WAITING_SEAT_OPACITY := 0.6

var avatar: XomDaoAvatar
var _side: Label
var _player_name: Label
var _wins: Label
var _captures: Control


func _init(index: int) -> void:
	name = "Seat_%d" % index
	custom_minimum_size = Vector2(180.0, 220.0)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_theme_stylebox_override("panel", CHESS_HUD.royal_panel_style())

	var column := VBoxContainer.new()
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_theme_constant_override("separation", 0)
	add_child(column)
	_side = Label.new()
	_side.name = "SeatSide_%d" % index
	_side.theme_type_variation = "SmallLabel"
	_side.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_side.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_side.add_theme_font_override("font", XomDaoUi.display_font(800))
	_side.add_theme_font_size_override("font_size", 20)
	_side.add_theme_color_override("font_color", XomDaoUi.GOLD)
	_side.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(_side)
	avatar = XomDaoAvatar.new()
	avatar.name = "SeatAvatar_%d" % index
	avatar.custom_minimum_size = Vector2(72.0, 72.0)
	avatar.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(avatar)
	_player_name = Label.new()
	_player_name.name = "SeatName_%d" % index
	_player_name.theme_type_variation = "HudLabel"
	_player_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_player_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_player_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_player_name.add_theme_font_size_override("font_size", 22)
	_player_name.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_player_name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(_player_name)
	_wins = Label.new()
	_wins.name = "SeatWins_%d" % index
	_wins.theme_type_variation = "SmallLabel"
	_wins.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_wins.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_wins.add_theme_font_size_override("font_size", 14)
	_wins.add_theme_color_override("font_color", XomDaoUi.PAPER_DARK)
	_wins.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(_wins)
	_captures = Control.new()
	_captures.name = "SeatCaptures_%d" % index
	_captures.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_captures.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_captures.clip_contents = true
	column.add_child(_captures)


func show_player(
	side_name: String,
	player_name: String,
	info: XomDaoPlayerInfo,
	is_host: bool,
	wins: int,
	captured: Array[String],
	piece_atlas: PIECE_ATLAS,
	on_turn: bool,
	playing: bool
) -> void:
	_side.text = side_name
	_player_name.text = player_name
	avatar.initial = player_name
	avatar.picture = null
	avatar.frame = ""
	avatar.crown = false
	if info != null:
		var avatar_id: String = info.avatar
		if info.bot and avatar_id == "":
			avatar_id = "bot"
		avatar.picture = XomDaoLooks.avatar(avatar_id)
		avatar.frame = info.frame if info.frame != "" else XomDaoLooks.DEFAULT_FRAME
		avatar.crown = is_host
	_wins.text = "Thắng %d" % wins
	avatar.turn = 1.0 if on_turn else -1.0
	scale = Vector2.ONE * ACTIVE_SEAT_SCALE if on_turn else Vector2.ONE
	var opacity: float = WAITING_SEAT_OPACITY if playing and not on_turn else 1.0
	modulate = Color(1.0, 1.0, 1.0, opacity)
	_show_captured(captured, piece_atlas)


func _show_captured(pieces: Array[String], piece_atlas: PIECE_ATLAS) -> void:
	for child: Node in _captures.get_children():
		_captures.remove_child(child)
		child.queue_free()
	var width: float = 0.0
	if not pieces.is_empty():
		width = CAPTURE_ICON_SIZE + (pieces.size() - 1) * CAPTURE_ICON_STEP
	_captures.custom_minimum_size = Vector2(
		width, CAPTURE_ICON_SIZE if not pieces.is_empty() else 0.0
	)
	_captures.tooltip_text = "Quân đã ăn: %d" % pieces.size()
	for i: int in pieces.size():
		var icon := TextureRect.new()
		icon.texture = piece_atlas.texture_for(pieces[i], -1, false)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		icon.position = Vector2(i * CAPTURE_ICON_STEP, 0.0)
		icon.size = Vector2.ONE * CAPTURE_ICON_SIZE
		_captures.add_child(icon)
