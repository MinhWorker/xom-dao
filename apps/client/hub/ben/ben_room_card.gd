class_name HubBenRoomCard
extends PanelContainer
## A room card on Bến's right list:
## displays a mini splash thumbnail of the game, the game title,
## the room code badge, the host name, seats chip, and the "Vào" or "Xem" button.

signal join_pressed(code: String)
signal watch_pressed(code: String)

const SHADER: Shader = preload("res://hub/ben/ben_card.gdshader")

var summary: XomDaoRoomSummary
var game_name: String = ""
var game_id: String = ""

var enter_btn: XomDaoButton


static func create(
	room_summary: XomDaoRoomSummary, title: String, id: String = ""
) -> HubBenRoomCard:
	var card := HubBenRoomCard.new()
	card.summary = room_summary
	card.game_name = title
	card.game_id = id
	card.name = "Room_" + room_summary.code
	card._build()
	return card


func _init() -> void:
	custom_minimum_size = Vector2(0.0, 92.0)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var box: StyleBoxFlat = XomDaoUi.box(Color("#131D2E", 0.95), Color("#293D5C", 0.8), 2, 18.0)
	box.shadow_color = Color(0.0, 0.0, 0.0, 0.25)
	box.shadow_size = 4
	box.shadow_offset = Vector2(0.0, 3.0)
	box.set_content_margin_all(10.0)
	add_theme_stylebox_override("panel", box)


func _build() -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	add_child(row)

	# Mini Game Splash Thumbnail
	var thumb_holder := Control.new()
	thumb_holder.custom_minimum_size = Vector2(96.0, 68.0)
	row.add_child(thumb_holder)

	var splash_tex: Texture2D = HubGameArt.splash(game_id)
	var thumb_art := ColorRect.new()
	thumb_art.size = Vector2(96.0, 68.0)
	var thumb_mat := ShaderMaterial.new()
	thumb_mat.shader = SHADER
	thumb_mat.set_shader_parameter("art", splash_tex)
	thumb_mat.set_shader_parameter("has_art", splash_tex != null)
	thumb_mat.set_shader_parameter("box", Vector2(96.0, 68.0))
	thumb_mat.set_shader_parameter("radii", Vector4(10.0, 10.0, 10.0, 10.0))
	thumb_mat.set_shader_parameter("scrim_left", 0.0)
	thumb_mat.set_shader_parameter("scrim_right", 0.0)
	if splash_tex != null:
		var pic_size := splash_tex.get_size()
		var k: float = maxf(96.0 / pic_size.x, 68.0 / pic_size.y)
		var span := Vector2(96.0, 68.0) / (pic_size * k)
		var origin := (Vector2.ONE - span) / 2.0
		thumb_mat.set_shader_parameter("uv_origin", origin)
		thumb_mat.set_shader_parameter("uv_span", span)
	thumb_art.material = thumb_mat
	thumb_holder.add_child(thumb_art)

	# Overlay border & small emblem on thumbnail
	var thumb_frame := Panel.new()
	thumb_frame.size = Vector2(96.0, 68.0)
	var frame_style: StyleBoxFlat = XomDaoUi.box(
		Color.TRANSPARENT, Color(XomDaoUi.NAVY_LINE, 0.7), 2, 10.0
	)
	thumb_frame.add_theme_stylebox_override("panel", frame_style)
	thumb_holder.add_child(thumb_frame)

	var logo_tex: Texture2D = HubGameArt.logo(game_id)
	if logo_tex != null:
		var emblem := TextureRect.new()
		emblem.texture = logo_tex
		emblem.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		emblem.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		emblem.size = Vector2(32.0, 32.0)
		emblem.position = Vector2(4.0, 4.0)
		thumb_holder.add_child(emblem)

	# Center info column
	var info := VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	info.add_theme_constant_override("separation", 6)
	row.add_child(info)

	# Top line: Game Name + Room Code
	var top_line := HBoxContainer.new()
	top_line.add_theme_constant_override("separation", 10)
	info.add_child(top_line)

	var title_lbl := Label.new()
	title_lbl.text = game_name
	title_lbl.add_theme_font_override("font", XomDaoUi.display_font(800))
	title_lbl.add_theme_font_size_override("font_size", 24)
	title_lbl.add_theme_color_override("font_color", XomDaoUi.CREAM)
	title_lbl.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	title_lbl.clip_text = true
	title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top_line.add_child(title_lbl)

	var code_chip := XomDaoChip.create("#" + summary.code, "", Color("#192740"))
	code_chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top_line.add_child(code_chip)

	# Bottom line: Host + Seats
	var bot_line := HBoxContainer.new()
	bot_line.add_theme_constant_override("separation", 10)
	info.add_child(bot_line)

	var host_chip := XomDaoChip.create(summary.host_name, "crown")
	host_chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bot_line.add_child(host_chip)

	var seat_color: Color = XomDaoUi.BAMBOO_DARK if summary.can_join else Color("#455268")
	var seats_chip := XomDaoChip.create(
		"%d/%d ghế" % [summary.players, summary.max_players], "users", seat_color
	)
	seats_chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bot_line.add_child(seats_chip)

	var watching: bool = summary.status == "playing"
	if watching or not summary.can_join:
		var status_text: String = "Đang chơi" if watching else "Đủ ghế"
		var status_icon: String = "clock"
		if watching and summary.spectators > 0:
			status_text = "%d xem" % summary.spectators
			status_icon = "users"
		var status_chip := XomDaoChip.create(status_text, status_icon, Color("#3D291F"))
		status_chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		bot_line.add_child(status_chip)

	# Right Action Button
	enter_btn = XomDaoButton.create("Xem" if watching else "Vào", XomDaoUi.Kind.SOCIAL)
	enter_btn.name = ("Watch_" if watching else "Enter_") + summary.code
	enter_btn.pad = 16.0
	enter_btn.custom_minimum_size = Vector2(104.0, 56.0)
	enter_btn.add_theme_font_size_override("font_size", 26)
	enter_btn.disabled = not summary.can_join and not watching
	enter_btn.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	if watching:
		enter_btn.pressed.connect(func() -> void: watch_pressed.emit(summary.code))
	else:
		enter_btn.pressed.connect(func() -> void: join_pressed.emit(summary.code))
	row.add_child(enter_btn)
