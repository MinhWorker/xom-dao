class_name HubLobby
extends Control
## The lobby (docs/experience.md, "Sảnh"): the ring of genre islands floating over the sky, and a
## navy HUD around it.
## - Left: a sidebar of places (Trang chủ, the lobby itself, selected; Chợ, Đình, Bến).
## - Top: the profile (avatar, name, level, EXP bar; it opens Nhà) on the left; the balance,
##   mail, gifts and ⚙ on the right.
## - Right, upper: shortcuts to Chợ, Sự kiện (red dot and days left while an event is open) and
##   Nhiệm vụ.
## - Right, lower: the selected game's card with CHƠI and Tạo phòng.
## Art slots, all optional: `hub/lobby/backdrop.webp` (HubSky), `hub/genres/<island>.tscn|webp`
## (HubIsland), `hub/lobby/shortcut-<id>.webp` (a shortcut's picture).
##
## The lobby only shows and reports: the hub (main.gd) acts on its signals.

signal play_pressed(game_id: String)
signal create_pressed(game_id: String)
## The selected island was tapped again, or the card: open the game select on this genre.
signal select_opened(genre_id: String)
## Nhà (the profile), Chợ, Đình or Bến ("nha", "cho", "dinh", "ben").
signal place_pressed(place: String)
## The ring turned to another genre: the hub picks that genre's game for the card.
signal genre_changed(genre_id: String)
## The Sự kiện shortcut while an event is open: open its card.
signal event_pressed(game_id: String)

## The sidebar: id, label, icon. "lobby" is this screen.
const PLACES: Array = [
	["lobby", "Trang chủ", "house"],
	["cho", "Chợ", "storefront"],
	["dinh", "Đình", "bank"],
	["ben", "Bến", "anchor"],
]
## The shortcuts on the right: id, label, icon, height.
const SHORTCUTS: Array = [
	["cho", "Chợ", "storefront", 104.0],
	["su-kien", "Sự kiện", "gift", 80.0],
	["nhiem-vu", "Nhiệm vụ", "clipboard-text", 80.0],
]
const SIDEBAR_W := 112.0
const NAV_H := 112.0
const SHORTCUT_W := 300.0
const CARD_W := 380.0
const ART_H := 92.0
const GAP := 12.0

var ring := HubIslandRing.new()
var money := HubMoneyRow.new()
var avatar := XomDaoAvatar.new()
var play: XomDaoButton = XomDaoButton.create("CHƠI", XomDaoUi.Kind.HOME_PLAY)
var create: XomDaoButton = XomDaoButton.create("Tạo phòng", XomDaoUi.Kind.HOME_SOCIAL)
var mail: XomDaoIconButton = XomDaoIconButton.create("envelope-simple")
var gifts: XomDaoIconButton = XomDaoIconButton.create("gift")

var _game_id: String = ""
var _sidebar := Panel.new()
var _places := VBoxContainer.new()
var _profile := HBoxContainer.new()
var _name := Label.new()
var _level: XomDaoChip = XomDaoChip.create("Cấp 1", "crown", XomDaoUi.GOLD_DARK)
var _exp := ProgressBar.new()
var _exp_text := Label.new()
var _shortcuts := VBoxContainer.new()
var _event_tag: XomDaoChip
## The open event on the Sự kiện shortcut ("" = none).
var _event_id: String = ""
var _card := PanelContainer.new()
var _card_name := Label.new()
var _card_online: XomDaoChip = XomDaoChip.create("0", "users", XomDaoUi.NAVY)
var _card_art := HubCardArt.new()
var _card_info := HBoxContainer.new()
var _settings: XomDaoSettings


func _init(settings: XomDaoSettings = null) -> void:
	_settings = settings if settings != null else XomDaoSettings.current()
	name = "Lobby"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSky.new())
	ring.name = "Ring"
	ring.selected_changed.connect(func(_i: int) -> void: genre_changed.emit(ring.selected_id()))
	ring.opened.connect(func(_i: int) -> void: _open_genre())
	add_child(ring)
	_build_sidebar()
	_build_profile()
	_build_money()
	_build_shortcuts()
	_build_card()
	resized.connect(_layout)
	_card.resized.connect(_layout, CONNECT_DEFERRED)
	_profile.resized.connect(_layout, CONNECT_DEFERRED)
	_settings.changed.connect(_layout)


func _ready() -> void:
	_layout()


## Fills the ring from the catalog, `genre_id`'s island at the front.
func show_catalog(catalog: HubCatalog, genre_id: String) -> void:
	var list: Array[Dictionary] = HubIslandRing.entries(
		catalog.catalog.genres, catalog.ready_genres()
	)
	var events: Array[XomDaoGameCard] = catalog.open_events()
	var index: int = 0
	for i: int in list.size():
		if list[i]["id"] == genre_id:
			index = i
		if not events.is_empty() and list[i]["id"] == events[0].genre:
			list[i]["days"] = HubCatalog.days_left(events[0])
	ring.set_entries(list, index)
	show_event(events[0] if not events.is_empty() else null)
	_layout()


## The Sự kiện shortcut: an open event (the days left and a red dot), or nothing to open.
func show_event(card: XomDaoGameCard) -> void:
	_event_id = card.id if card != null else ""
	_event_tag.visible = card != null
	_event_tag.text = "Còn %d ngày" % HubCatalog.days_left(card) if card != null else ""
	var button: Control = _shortcuts.get_node("Shortcut_su-kien")
	var dot: Node = button.get_node_or_null("Dot")
	if card != null:
		XomDaoDot.attach(button)
	elif dot != null:
		dot.queue_free()


func show_user(user: XomDaoUser) -> void:
	_name.text = user.name if user != null else ""
	avatar.initial = _name.text
	avatar.frame = user.frame if user != null else ""


## The level chip and the EXP bar under the name (`stats:get`): `xp` is the total, `level_xp`
## where this level starts and `next_xp` where the next one does.
func show_level(level: int, xp: int = 0, level_xp: int = 0, next_xp: int = 0) -> void:
	_level.text = "Cấp %d" % level
	_level.visible = true
	var span: int = maxi(1, next_xp - level_xp)
	var into: int = clampi(xp - level_xp, 0, span)
	_exp.max_value = span
	_exp.value = into
	_exp_text.text = "%s/%s" % [XomDaoUi.money(into), XomDaoUi.money(span)]
	_exp.visible = next_xp > level_xp


## The card at the bottom right: the selected game, or "Sắp có" when there is none to play.
func show_game(card: XomDaoGameCard, can_play: bool) -> void:
	_game_id = card.id if card != null else ""
	_card_name.text = card.name if card != null else "Sắp có"
	_card_art.title = _card_name.text
	_card_art.locked = not can_play
	_card_online.visible = card != null
	_card_online.text = str(card.playing) if card != null else "0"
	# Out of the row at once: a chip waiting to be freed would still widen the card.
	for child: Node in _card_info.get_children():
		_card_info.remove_child(child)
		child.queue_free()
	if card != null:
		var players := XomDaoChip.create(
			XomDaoGameTile.players_label(card.min_players, card.max_players), "users", XomDaoUi.NAVY
		)
		players.name = "SelectedPlayers"
		players.compact()
		_card_info.add_child(players)
		var length := XomDaoChip.create(
			XomDaoGameTile.duration_label(card.duration), "clock", XomDaoUi.NAVY
		)
		length.name = "SelectedDuration"
		length.compact()
		_card_info.add_child(length)
	play.disabled = not can_play
	create.disabled = not can_play
	_layout.call_deferred()


## Where the HUD is, in this control's coordinates: no island may go there.
func hud_rects() -> Array[Rect2]:
	var out: Array[Rect2] = []
	for part: Control in [_sidebar, _profile, money, _shortcuts, _card]:
		out.append(Rect2(part.position, part.size * part.scale))
	return out


func _open_genre() -> void:
	if ring.selected_id() == HubIsland.SOON or ring.islands[ring.selected].locked:
		XomDaoToast.show_on(self, "Sắp có", "lock-simple")
		return
	select_opened.emit(ring.selected_id())


func _soon() -> void:
	XomDaoToast.show_on(self, "Sắp có", "lock-simple")


## A navy HUD panel (see-through) with a thin lighter rim.
func _navy(radius: float, line: bool = true) -> StyleBoxFlat:
	var style: StyleBoxFlat = XomDaoUi.box(
		XomDaoUi.NAVY_HUD,
		XomDaoUi.NAVY_LINE if line else Color.TRANSPARENT,
		2 if line else 0,
		radius
	)
	return XomDaoUi.with_shadow(style)


func _build_sidebar() -> void:
	_sidebar.name = "Sidebar"
	_sidebar.mouse_filter = Control.MOUSE_FILTER_STOP
	var style: StyleBoxFlat = XomDaoUi.box(XomDaoUi.NAVY, Color.TRANSPARENT, 0, 0.0)
	style.border_color = XomDaoUi.NAVY_LINE
	style.border_width_right = 2
	_sidebar.add_theme_stylebox_override("panel", style)
	add_child(_sidebar)
	_places.name = "Places"
	_places.add_theme_constant_override("separation", 6)
	_sidebar.add_child(_places)
	for place: Array in PLACES:
		_places.add_child(_nav_button(str(place[0]), str(place[1]), str(place[2])))


## A sidebar entry: icon over label; gold with a glow when it is this screen.
func _nav_button(id: String, label: String, icon_name: String) -> Button:
	var button := Button.new()
	button.name = "Place_" + id
	button.text = label
	button.icon = XomDaoUi.icon(icon_name)
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.custom_minimum_size = Vector2(SIDEBAR_W, NAV_H)
	button.expand_icon = true
	button.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	button.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
	button.add_theme_constant_override("icon_max_width", 48)
	button.add_theme_font_override("font", XomDaoUi.display_font(800))
	button.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN + 2)
	var here: bool = id == "lobby"
	var style: StyleBoxFlat
	if here:
		style = XomDaoUi.box(Color("#9A6418"), XomDaoUi.GOLD, XomDaoUi.BORDER, 18.0)
		style.shadow_color = Color(XomDaoUi.GOLD, 0.45)
		style.shadow_size = 12
	else:
		style = XomDaoUi.box(Color.TRANSPARENT, Color.TRANSPARENT, 0, 18.0)
	style.content_margin_top = 16.0
	style.content_margin_bottom = 10.0
	var down: StyleBoxFlat = style.duplicate()
	down.bg_color = style.bg_color.darkened(0.2) if here else Color(XomDaoUi.NAVY_LINE, 0.5)
	var hover: StyleBoxFlat = style.duplicate()
	if not here:
		hover.bg_color = Color(XomDaoUi.NAVY_LINE, 0.3)
	button.add_theme_stylebox_override("normal", style)
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", down)
	button.add_theme_stylebox_override("hover_pressed", down)
	button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	for state: String in ["font_color", "font_hover_color", "font_pressed_color"]:
		button.add_theme_color_override(state, XomDaoUi.CREAM)
	for state: String in ["icon_normal_color", "icon_pressed_color", "icon_hover_color"]:
		button.add_theme_color_override(state, XomDaoUi.CREAM)
	button.button_down.connect(XomDaoUi.bounce.bind(button))
	if not here:
		button.button_down.connect(XomDaoUi.play.bind(button, XomDaoUi.SOUND_TAP))
		button.pressed.connect(place_pressed.emit.bind(id))
	return button


func _build_profile() -> void:
	_profile.name = "Profile"
	_profile.add_theme_constant_override("separation", 10)
	add_child(_profile)
	avatar.name = "Avatar"
	avatar.custom_minimum_size = Vector2(88.0, 88.0)
	avatar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_profile.add_child(avatar)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 4)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_profile.add_child(column)
	var pill := PanelContainer.new()
	pill.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	var style: StyleBoxFlat = XomDaoUi.box(XomDaoUi.NAVY_HUD, Color.TRANSPARENT, 0, 22.0)
	style.content_margin_left = 16.0
	style.content_margin_right = 18.0
	pill.add_theme_stylebox_override("panel", style)
	pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(pill)
	_name.name = "PlayerName"
	_name.theme_type_variation = "HudLabel"
	_name.add_theme_font_size_override("font_size", 30)
	_name.custom_minimum_size = Vector2(170.0, 40.0)
	_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	pill.add_child(_name)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(row)
	_level.name = "LobbyLevel"
	_level.compact()
	_level.visible = false
	row.add_child(_level)
	_exp.name = "LobbyExp"
	_exp.custom_minimum_size = Vector2(124.0, 36.0)
	_exp.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_exp.show_percentage = false
	_exp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_exp.add_theme_stylebox_override(
		"background", XomDaoUi.box(XomDaoUi.NAVY_HUD, XomDaoUi.NAVY_LINE, 2, 18.0)
	)
	_exp.add_theme_stylebox_override(
		"fill", XomDaoUi.box(XomDaoUi.GOLD, Color.TRANSPARENT, 0, 18.0)
	)
	_exp.visible = false
	row.add_child(_exp)
	_exp_text.name = "LobbyExpText"
	_exp_text.theme_type_variation = "HudLabel"
	_exp_text.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_exp_text.add_theme_color_override("font_outline_color", XomDaoUi.NAVY)
	_exp_text.add_theme_constant_override("outline_size", 6)
	_exp_text.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_exp_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_exp_text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_exp.add_child(_exp_text)
	# The profile opens Nhà.
	_profile.mouse_filter = Control.MOUSE_FILTER_STOP
	_profile.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_profile.gui_input.connect(_on_profile_input)


## Mail and gifts go between the balance and ⚙.
func _build_money() -> void:
	add_child(money)
	money.add_theme_constant_override("separation", 8)
	money.coins.custom_minimum_size.x = 170.0
	money.coins.background = XomDaoUi.NAVY_HUD
	for button: XomDaoIconButton in [mail, gifts, money.settings]:
		button.background = XomDaoUi.NAVY_HUD
	mail.name = "Mail"
	mail.pressed.connect(_soon)
	money.add_child(mail)
	gifts.name = "Gifts"
	gifts.pressed.connect(_soon)
	money.add_child(gifts)
	money.move_child(money.settings, -1)


func _build_shortcuts() -> void:
	_shortcuts.name = "Shortcuts"
	_shortcuts.add_theme_constant_override("separation", 8)
	add_child(_shortcuts)
	for shortcut: Array in SHORTCUTS:
		_shortcuts.add_child(
			_shortcut(str(shortcut[0]), str(shortcut[1]), str(shortcut[2]), float(shortcut[3]))
		)
	show_event(null)


## A shortcut panel: its picture (`hub/lobby/shortcut-<id>.webp`) or icon, the label and ›.
func _shortcut(id: String, label: String, icon_name: String, height: float) -> Button:
	var button := Button.new()
	button.name = "Shortcut_" + id
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.custom_minimum_size = Vector2(SHORTCUT_W, height)
	button.clip_contents = false
	var style: StyleBoxFlat = _navy(18.0)
	var down: StyleBoxFlat = style.duplicate()
	down.bg_color = XomDaoUi.NAVY
	var hover: StyleBoxFlat = style.duplicate()
	hover.border_color = XomDaoUi.GOLD
	button.add_theme_stylebox_override("normal", style)
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", down)
	button.add_theme_stylebox_override("hover_pressed", down)
	button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	button.button_down.connect(XomDaoUi.bounce.bind(button))
	button.button_down.connect(XomDaoUi.play.bind(button, XomDaoUi.SOUND_TAP))
	button.pressed.connect(_on_shortcut.bind(id))
	var picture_path: String = "res://hub/lobby/shortcut-%s.webp" % id
	if ResourceLoader.exists(picture_path):
		var picture := TextureRect.new()
		picture.texture = load(picture_path)
		picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		picture.set_anchors_and_offsets_preset(
			Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 4
		)
		picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
		button.add_child(picture)
	var row := HBoxContainer.new()
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 12)
	row.add_theme_constant_override("separation", 12)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	button.add_child(row)
	var icon := TextureRect.new()
	icon.texture = XomDaoUi.icon(icon_name)
	icon.custom_minimum_size = Vector2(56.0, 56.0)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	icon.modulate = XomDaoUi.GOLD
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(icon)
	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_theme_constant_override("separation", 0)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(column)
	var title := Label.new()
	title.name = "ShortcutTitle_" + id
	title.text = label
	title.theme_type_variation = "HudLabel"
	title.add_theme_font_size_override("font_size", 32)
	column.add_child(title)
	if id == "su-kien":
		_event_tag = XomDaoChip.create("", "", XomDaoUi.LACQUER)
		_event_tag.name = "EventTag"
		_event_tag.compact()
		_event_tag.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		column.add_child(_event_tag)
	var caret := TextureRect.new()
	caret.texture = XomDaoUi.icon("caret-right")
	caret.custom_minimum_size = Vector2(28.0, 28.0)
	caret.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	caret.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	caret.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	caret.modulate = XomDaoUi.CREAM
	caret.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(caret)
	return button


func _on_shortcut(id: String) -> void:
	match id:
		"cho":
			place_pressed.emit("cho")
		"su-kien":
			if _event_id != "":
				event_pressed.emit(_event_id)
			else:
				XomDaoToast.show_on(self, "Chưa có sự kiện", "moon-stars")
		_:
			_soon()


## The selected game: name and players online, its picture, players and length, CHƠI and
## Tạo phòng.
func _build_card() -> void:
	_card.name = "SelectedGame"
	_card.custom_minimum_size.x = CARD_W
	_card.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var style: StyleBoxFlat = _navy(22.0)
	style.set_content_margin_all(12.0)
	_card.add_theme_stylebox_override("panel", style)
	_card.gui_input.connect(_on_card_input)
	add_child(_card)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_card.add_child(column)
	var head := HBoxContainer.new()
	head.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(head)
	_card_name.name = "SelectedName"
	_card_name.theme_type_variation = "HudLabel"
	_card_name.add_theme_font_size_override("font_size", 32)
	_card_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_card_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	head.add_child(_card_name)
	_card_online.name = "SelectedOnline"
	_card_online.compact()
	_card_online.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	head.add_child(_card_online)
	_card_art.name = "SelectedArt"
	_card_art.custom_minimum_size.y = ART_H
	column.add_child(_card_art)
	_card_info.name = "SelectedInfo"
	_card_info.add_theme_constant_override("separation", 8)
	_card_info.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(_card_info)
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 10)
	column.add_child(buttons)
	play.name = "Play"
	play.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	play.size_flags_stretch_ratio = 1.1
	play.pressed.connect(func() -> void: play_pressed.emit(_game_id))
	buttons.add_child(play)
	create.name = "CreateRoom"
	create.icon = XomDaoUi.icon("user-plus")
	create.add_theme_font_size_override("font_size", 28)
	create.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	create.pressed.connect(func() -> void: create_pressed.emit(_game_id))
	buttons.add_child(create)
	for button: XomDaoButton in [play, create]:
		for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
			var box: StyleBoxFlat = button.get_theme_stylebox(state)
			box.content_margin_left = 12.0
			box.content_margin_right = 12.0


func _on_profile_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
		place_pressed.emit("nha")


func _on_card_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		XomDaoUi.bounce(_card)
		XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
		_open_genre()


## The sidebar along the left edge (under the notch too); the top row, the shortcuts and the card
## at the safe area plus the player's margin, scaled by their HUD size but never so far that they
## overlap; the ring takes the sky between them.
func _layout() -> void:
	var view: Vector2 = size
	if view.x <= 0.0:
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = _settings.margin
	var k: float = _settings.ui_scale
	for part: Control in [_profile, money, _shortcuts, _card, _places]:
		part.reset_size()
	# The sidebar: as tall as the screen, its entries centred.
	var k_side: float = minf(k, (view.y - 2.0 * GAP) / _places.size.y)
	var side_w: float = inset.x + SIDEBAR_W * k_side + 8.0
	_sidebar.position = Vector2.ZERO
	_sidebar.size = Vector2(side_w, view.y)
	_places.scale = Vector2.ONE * k_side
	_places.position = Vector2(inset.x + 4.0, (view.y - _places.size.y * k_side) / 2.0)
	var left: float = side_w + edge * 0.5
	var right: float = view.x - inset.x - edge
	var top: float = inset.y + edge * 0.5
	var bottom: float = view.y - edge * 0.5
	# The top row shrinks rather than overlap itself.
	var row_w: float = _profile.size.x + money.size.x + GAP
	var k_top: float = minf(k, (right - left) / row_w)
	_profile.scale = Vector2.ONE * k_top
	money.scale = Vector2.ONE * k_top
	_profile.position = Vector2(left, top + (88.0 - _profile.size.y) / 2.0 * k_top)
	money.position = Vector2(right - money.size.x * k_top, top)
	var hud_bottom: float = top + 88.0 * k_top
	# The right column: shortcuts over the card, shrunk to fit the height.
	var column_h: float = _shortcuts.size.y + GAP + _card.size.y
	var k_right: float = minf(k, (bottom - hud_bottom - GAP) / column_h)
	k_right = minf(k_right, (right - left) * 0.45 / _card.size.x)
	_shortcuts.scale = Vector2.ONE * k_right
	_card.scale = Vector2.ONE * k_right
	_card.position = Vector2(right - _card.size.x * k_right, bottom - _card.size.y * k_right)
	_shortcuts.position = Vector2(
		right - _shortcuts.size.x * k_right, _card.position.y - (_shortcuts.size.y + GAP) * k_right
	)
	var ring_top: float = hud_bottom + 8.0
	var ring_right: float = minf(_card.position.x, _shortcuts.position.x) - GAP
	ring.position = Vector2(left, ring_top)
	ring.size = Vector2(maxf(0.0, ring_right - left), maxf(0.0, bottom - ring_top))
