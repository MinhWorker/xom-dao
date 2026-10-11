class_name HubSeatCard
extends Button
## One seat of a waiting room, as a card: the player's picture over a coloured band, their name
## and what they are (Chủ phòng, Máy, Bạn, Sẵn sàng with a green tick), or an empty seat. Any
## size; the picture and the text follow it.
##
##   var seat := HubSeatCard.new()
##   seat.show_player(player, true, false)   # the host, not you
##   seat.show_empty()
##   seat.pressed.connect(...)               # seat.player_id is "" for an empty seat or a bot

const ROUND := 26.0
## How far the card stands off its lip.
const DEPTH := 6.0
## The share of the card's height the band takes; the picture sits on its lower edge.
const BAND := 0.36

## The seated person's id; "" for an empty seat and for the computer.
var player_id: String = ""
var filled: bool = false

var _avatar := XomDaoAvatar.new()
var _name := Label.new()
var _tag := Label.new()
var _plus := TextureRect.new()
var _host: bool = false
var _mine: bool = false
var _bot: bool = false
var _seated: String = ""
var _ready: bool = false
var _tick: Texture2D = XomDaoUi.icon("check-circle")


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	add_child(_avatar)
	_name.theme_type_variation = "TitleLabel"
	_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name.clip_text = true
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_name)
	_tag.theme_type_variation = "SmallLabel"
	_tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tag.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_tag)
	_plus.texture = XomDaoUi.icon("user-plus")
	_plus.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_plus.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_plus.modulate = Color(XomDaoUi.CREAM, 0.85)
	_plus.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_plus)
	resized.connect(_layout)
	button_down.connect(func() -> void: XomDaoUi.play(self, XomDaoUi.SOUND_TAP))
	show_empty()


## Seats `player`: `host` gives the gold band and the crown, `mine` marks your own card.
func show_player(player: XomDaoPlayerInfo, host: bool, mine: bool) -> void:
	filled = true
	player_id = "" if player.bot else player.id
	_host = host
	_mine = mine
	_bot = player.bot
	_ready = player.ready and not host and not player.bot
	_avatar.initial = player.name
	_avatar.picture = XomDaoLooks.avatar(player.avatar)
	_avatar.frame = player.frame
	_avatar.crown = host
	_name.text = player.name
	_name.add_theme_color_override("font_color", XomDaoUi.INK)
	_tag.remove_theme_color_override("font_color")
	if not player.connected and not player.bot:
		_tag.text = "Mất kết nối"
		_tag.add_theme_color_override("font_color", XomDaoUi.DOWN_ON_PAPER)
	elif host:
		_tag.text = "Chủ phòng"
		_tag.add_theme_color_override("font_color", XomDaoUi.GOLD_DARK)
	elif _ready:
		_tag.text = "Sẵn sàng"
		_tag.add_theme_color_override("font_color", XomDaoUi.UP_ON_PAPER)
	elif player.bot:
		_tag.text = "Máy"
		_tag.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.6))
	else:
		_tag.text = "Bạn" if mine else "Người chơi"
		_tag.add_theme_color_override("font_color", XomDaoUi.SEA_DEEP)
	_avatar.visible = true
	_plus.visible = false
	# Someone new in this seat: the card hops.
	if _seated != player.id and is_inside_tree():
		_hop()
	_seated = player.id
	_layout()
	queue_redraw()


func show_empty() -> void:
	filled = false
	player_id = ""
	_seated = ""
	_host = false
	_mine = false
	_bot = false
	_ready = false
	_name.text = "Trống"
	_name.add_theme_color_override("font_color", Color(XomDaoUi.CREAM, 0.9))
	_tag.text = ""
	_avatar.visible = false
	_plus.visible = true
	_layout()
	queue_redraw()


func _draw() -> void:
	var down: bool = get_draw_mode() == DRAW_PRESSED or get_draw_mode() == DRAW_HOVER_PRESSED
	var over: bool = get_draw_mode() == DRAW_HOVER
	var box := Rect2(Vector2.ZERO, size)
	if not filled:
		var hole: StyleBoxFlat = XomDaoUi.box(
			Color(XomDaoUi.NAVY, 0.4 if over else 0.3), Color(XomDaoUi.CREAM, 0.5), 3, ROUND
		)
		draw_style_box(hole, box)
		return
	var line: Color = XomDaoUi.GOLD_DARK if _mine else XomDaoUi.PAPER_DARK
	XomDaoPuff.paint(self, box, XomDaoUi.PAPER, line, ROUND, DEPTH, down, 3, false, false)
	# The band across the top, rounded like the card.
	var sunk: float = DEPTH - 2.0 if down else 0.0
	var band := StyleBoxFlat.new()
	band.bg_color = _band_color().lightened(0.06 if over else 0.0)
	band.corner_radius_top_left = int(ROUND) - 3
	band.corner_radius_top_right = int(ROUND) - 3
	band.corner_detail = 12
	band.anti_aliasing = true
	var face_h: float = size.y - DEPTH
	draw_style_box(band, Rect2(3.0, 3.0 + sunk, size.x - 6.0, face_h * BAND - 3.0))
	if _ready:
		# A green tick on a paper disc, in the top right corner.
		var side: float = clampf(size.x * 0.17, 34.0, 52.0)
		var at := Vector2(size.x - side - 12.0, 12.0 + sunk)
		draw_circle(
			at + Vector2.ONE * side / 2.0, side / 2.0 + 2.0, XomDaoUi.PAPER, true, -1.0, true
		)
		draw_texture_rect(_tick, Rect2(at, Vector2.ONE * side), false, XomDaoUi.UP_ON_PAPER)


func _band_color() -> Color:
	if _host:
		return XomDaoUi.GOLD
	if _bot:
		return XomDaoUi.NAVY_LINE
	return XomDaoUi.SEA


func _layout() -> void:
	var face_h: float = size.y - DEPTH
	var side: float = clampf(minf(size.x * 0.5, face_h * 0.44), 56.0, 168.0)
	var small: bool = size.x < 230.0
	_name.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN if small else XomDaoUi.TEXT)
	var name_h: float = 34.0 if small else 44.0
	var middle: float = face_h * BAND
	if not filled:
		middle = face_h * 0.42
		_plus.size = Vector2.ONE * side * 0.6
		_plus.position = Vector2((size.x - _plus.size.x) / 2.0, middle - _plus.size.y / 2.0)
	_avatar.size = Vector2.ONE * side
	_avatar.position = Vector2((size.x - side) / 2.0, middle - side / 2.0)
	_name.size = Vector2(size.x - 24.0, name_h)
	_name.position = Vector2(12.0, middle + side / 2.0 + (4.0 if filled else -side * 0.12))
	_tag.size = Vector2(size.x - 24.0, 30.0)
	_tag.position = Vector2(12.0, _name.position.y + name_h - 2.0)


func _hop() -> void:
	pivot_offset = size / 2.0
	scale = Vector2.ONE * 0.9
	(
		create_tween()
		. tween_property(self, "scale", Vector2.ONE, 0.28)
		. set_trans(Tween.TRANS_BACK)
		. set_ease(Tween.EASE_OUT)
	)
