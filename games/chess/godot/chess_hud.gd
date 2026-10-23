extends RefCounted
## Shared chess-specific presentation for player cards, status and table controls.

const SIDE_NAMES: Dictionary = {"w": "Trắng", "b": "Đen"}
const SETTINGS := "user://chess.cfg"


static func royal_panel_style() -> StyleBoxTexture:
	var style := StyleBoxTexture.new()
	style.texture = load("res://content/chess/art/royal-panel.svg")
	style.texture_margin_left = 48.0
	style.texture_margin_top = 34.0
	style.texture_margin_right = 48.0
	style.texture_margin_bottom = 34.0
	style.set_content_margin_all(16.0)
	return style


static func royal_button_style(asset: String) -> StyleBoxTexture:
	var style := StyleBoxTexture.new()
	style.texture = load("res://content/chess/art/%s.svg" % asset)
	style.texture_margin_left = 36.0
	style.texture_margin_top = 20.0
	style.texture_margin_right = 36.0
	style.texture_margin_bottom = 25.0
	style.content_margin_left = 24.0
	style.content_margin_right = 24.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	return style


static func skin_royal_button(button: XomDaoButton, danger: bool) -> void:
	button.body.visible = false
	button.alignment = HORIZONTAL_ALIGNMENT_CENTER
	button.vertical_icon_alignment = VERTICAL_ALIGNMENT_CENTER
	var stem: String = "royal-danger" if danger else "royal-button"
	button.add_theme_stylebox_override("normal", royal_button_style(stem))
	button.add_theme_stylebox_override("hover", royal_button_style(stem + "-hover"))
	button.add_theme_stylebox_override("pressed", royal_button_style(stem + "-pressed"))
	button.add_theme_stylebox_override("hover_pressed", royal_button_style(stem + "-pressed"))
	button.add_theme_stylebox_override("disabled", royal_button_style(stem))
	button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	button.add_theme_color_override("font_color", XomDaoUi.CREAM)
	button.add_theme_color_override("font_hover_color", XomDaoUi.CREAM)
	button.add_theme_color_override("font_pressed_color", XomDaoUi.CREAM)
	button.add_theme_font_size_override("font_size", 26)


static func result_reopen_theme() -> Dictionary:
	return {
		"normal": royal_button_style("royal-button"),
		"hover": royal_button_style("royal-button-hover"),
		"pressed": royal_button_style("royal-button-pressed"),
		"hover_pressed": royal_button_style("royal-button-pressed"),
		"disabled": royal_button_style("royal-button"),
		"font_color": XomDaoUi.CREAM,
	}


static func result_reason(end: Dictionary, name_of: Callable) -> String:
	var reason: String = str(end.get("reason", ""))
	var winner: Variant = end.get("winner")
	var descriptions: Dictionary = {
		"checkmate": "Chiếu hết",
		"stalemate": "Hoà do hết nước đi",
		"repetition": "Lặp lại thế cờ ba lần",
		"move-limit": "50 nước không ăn quân, không đi tốt",
		"material": "Không đủ quân chiếu hết",
		"agreement": "Hai bên đồng ý hoà",
	}
	if descriptions.has(reason):
		return str(descriptions[reason])
	if reason == "resign":
		return (
			"%s đầu hàng" % name_of.call(other(str(winner)))
			if winner != null
			else "Có người đầu hàng"
		)
	if reason == "left":
		return (
			"%s rời bàn" % name_of.call(other(str(winner)))
			if winner != null
			else "Có người rời bàn"
		)
	return ""


static func status(view: Dictionary, mine: String, name_of: Callable) -> Dictionary:
	var end: Variant = view.get("end")
	var turn: String = str(view.get("turn", "w"))
	if end is Dictionary:
		var result: Dictionary = end as Dictionary
		var winner: Variant = result.get("winner")
		var loser: String = name_of.call(other(str(winner))) if winner != null else ""
		var how: String = str(
			(
				{
					"checkmate": "Chiếu hết!",
					"stalemate": "Hết nước đi",
					"resign": "%s đầu hàng" % loser,
					"left": "%s rời bàn" % loser,
					"repetition": "Lặp lại thế cờ ba lần",
					"move-limit": "50 nước không ăn quân, không đi tốt",
					"material": "Không đủ quân chiếu hết",
					"agreement": "Hai bên đồng ý",
				}
				. get(str(result.get("reason", "")), "")
			)
		)
		if winner != null and str(result.get("reason", "")) == "resign":
			return {"text": "%s thắng\n%s" % [name_of.call(str(winner)), how], "visible": true}
		if winner != null:
			return {"text": "%s thắng · %s" % [name_of.call(str(winner)), how], "visible": true}
		return {"text": "Hoà · %s" % how, "visible": true}
	var offer: Variant = view.get("drawOffer")
	if offer != null and mine != "" and str(offer) != mine:
		return {"text": "%s xin hoà" % name_of.call(str(offer)), "visible": true}
	if bool(view.get("check", false)):
		return {"text": "Chiếu!", "visible": true}
	if turn == mine:
		return {"text": "Tới lượt bạn", "visible": false}
	return {"text": "Lượt %s · %s" % [SIDE_NAMES[turn], name_of.call(turn)], "visible": false}


static func update_utility_icons(
	effects_button: XomDaoIconButton,
	resign_button: XomDaoIconButton,
	effects: bool,
	resign_armed: bool
) -> void:
	effects_button.icon_name = "star"
	effects_button.background = Color("#3A241B") if effects else Color("#292524")
	effects_button.edge = Color("#D2A94D") if effects else Color("#625A56")
	effects_button.border = 2
	effects_button.lit = effects
	effects_button.tooltip_text = "Tắt hiệu ứng" if effects else "Bật hiệu ứng"
	var effects_icon: Color = XomDaoUi.CREAM if effects else Color("#938B85")
	for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		effects_button.add_theme_color_override(state, effects_icon)

	resign_button.icon_name = "warning" if resign_armed else "flag-banner"
	resign_button.background = Color("#48221D") if resign_armed else Color("#35211D")
	resign_button.edge = Color("#E17952") if resign_armed else Color("#9B6940")
	resign_button.border = 2
	resign_button.lit = resign_armed
	resign_button.tooltip_text = "Chạm lại để đầu hàng" if resign_armed else "Đầu hàng"
	var resign_icon: Color = XomDaoUi.CREAM if not resign_armed else Color("#FFE0C2")
	for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		resign_button.add_theme_color_override(state, resign_icon)


static func load_effects() -> bool:
	var config := ConfigFile.new()
	if config.load(SETTINGS) != OK:
		return true
	return bool(config.get_value("chess", "effects", true))


static func other(side: String) -> String:
	return "w" if side == "b" else "b"


static func side_of(letter: String) -> String:
	return "w" if letter == letter.to_upper() else "b"


## Phong cấp: the four pieces a pawn may become (Promote_<kind>), on `board`; a tap calls
## `on_pick` with the kind.
static func build_promotion(
	board: XomDaoBoard, kinds: Array[String], names: Dictionary, on_pick: Callable
) -> void:
	board.name = "Promotion"
	board.visible = false
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	board.content.add_child(row)
	for kind: String in kinds:
		var button: XomDaoButton = XomDaoButton.create(names[kind], XomDaoUi.Kind.BACK)
		button.name = "Promote_" + kind
		button.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		button.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
		button.expand_icon = true
		button.custom_minimum_size = Vector2(110.0, 140.0)
		skin_royal_button(button, false)
		button.pressed.connect(on_pick.bind(kind))
		row.add_child(button)


## A centred HUD label in `color` with a dark outline, which never takes taps.
static func hud_label(label: Label, label_name: String, font_size: int, color: Color) -> void:
	label.name = label_name
	label.theme_type_variation = "HudLabel"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_outline_color", Color(0.07, 0.05, 0.04, 0.82))
	label.add_theme_constant_override("outline_size", 2)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
