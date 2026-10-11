class_name HubLobby
extends Control
## The lobby (docs/experience.md, "Sảnh"): the ring of genre islands floating over the sky, and a
## navy HUD around it.
## - Left: a floating dock of places (Trang chủ, the lobby itself, on a gold plate; Chợ, Đình,
##   Bến), each a picture over its name (HubNavButton).
## - Top: the profile (avatar, name, level, EXP bar; it opens Nhà) on the left; the balance,
##   mail, gifts and ⚙ on the right.
## - Right, upper: shortcuts to Chợ, Sự kiện (red dot and days left while an event is open) and
##   Nhiệm vụ.
## - Right, lower: the selected game's card (HubGameCard): its art under frosted glass, with
##   CHƠI and Tạo phòng.
## Buttons and panels are raised (XomDaoPuff); CHƠI catches the light every few seconds.
## Art slots, all optional: `hub/lobby/backdrop.webp` (HubSky), `hub/genres/<island>.tscn|webp`
## (HubIsland), `hub/lobby/nav-<name>.svg` (a dock picture), `hub/lobby/shortcut-<id>.webp` (a
## shortcut's picture).
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

## The dock: id, label, icon, picture. "lobby" is this screen.
const PLACES: Array = [
	["lobby", "Trang chủ", "house", "nav-home"],
	["cho", "Chợ", "storefront", "nav-cho"],
	["dinh", "Đình", "bank", "nav-dinh"],
	["ben", "Bến", "anchor", "nav-ben"],
]
## The shortcuts on the right: id, label, icon, height, and whether its picture
## (`hub/lobby/shortcut-<id>.webp`) is a banner filling the plate or an object beside the label.
const SHORTCUTS: Array = [
	["cho", "Chợ", "storefront", 150.0, true],
	["su-kien", "Sự kiện", "gift", 96.0, false],
	["nhiem-vu", "Nhiệm vụ", "clipboard-text", 96.0, false],
]
const DOCK_PAD := 8.0
## Seconds between two glints on CHƠI.
const GLINT_EVERY := 3.6
const SHORTCUT_W := 340.0
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
var _card := HubGameCard.new()
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
	for i: int in _places.get_child_count():
		(_places.get_child(i) as HubNavButton).enter(0.06 * i)
	var glint := Timer.new()
	glint.wait_time = GLINT_EVERY
	glint.autostart = true
	glint.timeout.connect(_glint)
	add_child(glint)


## CHƠI catches the light, while there is something to play.
func _glint() -> void:
	if not play.disabled and is_visible_in_tree():
		play.body.sweep()


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
	avatar.picture = XomDaoLooks.avatar(user.avatar) if user != null else null
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
	_card.title.text = card.name if card != null else "Sắp có"
	_card.show_art(HubGameArt.splash(card.id) if card != null else null, not can_play)
	_card.online.visible = card != null
	_card.online.text = str(card.playing) if card != null else "0"
	# Out of the row at once: a chip waiting to be freed would still widen the card.
	for child: Node in _card.info.get_children():
		_card.info.remove_child(child)
		child.queue_free()
	if card != null:
		var players: XomDaoChip = _card.chip(
			XomDaoGameTile.players_label(card.min_players, card.max_players), "users"
		)
		players.name = "SelectedPlayers"
		_card.info.add_child(players)
		var length: XomDaoChip = _card.chip(XomDaoGameTile.duration_label(card.duration), "clock")
		length.name = "SelectedDuration"
		_card.info.add_child(length)
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


func _build_sidebar() -> void:
	_sidebar.name = "Sidebar"
	_sidebar.mouse_filter = Control.MOUSE_FILTER_STOP
	var style: StyleBoxFlat = XomDaoUi.box(Color(XomDaoUi.NAVY, 0.94), XomDaoUi.NAVY_LINE, 2, 32.0)
	style.shadow_color = XomDaoPuff.SHADE
	style.shadow_size = 3
	style.shadow_offset = Vector2(0.0, 5.0)
	_sidebar.add_theme_stylebox_override("panel", style)
	add_child(_sidebar)
	_places.name = "Places"
	_places.add_theme_constant_override("separation", 4)
	_sidebar.add_child(_places)
	for place: Array in PLACES:
		var id: String = str(place[0])
		var button: HubNavButton = HubNavButton.create(str(place[1]), str(place[3]), str(place[2]))
		button.name = "Place_" + id
		button.selected = id == "lobby"
		if id != "lobby":
			button.button_down.connect(XomDaoUi.play.bind(button, XomDaoUi.SOUND_TAP))
			button.pressed.connect(place_pressed.emit.bind(id))
		_places.add_child(button)


## The avatar overlaps the left end of a navy plate: the name on it, and under the name one bar
## that starts with the level and fills with EXP.
func _build_profile() -> void:
	_profile.name = "Profile"
	_profile.add_theme_constant_override("separation", -26)
	add_child(_profile)
	avatar.name = "Avatar"
	avatar.custom_minimum_size = Vector2(100.0, 100.0)
	avatar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	avatar.z_index = 1
	_profile.add_child(avatar)
	var plate := PanelContainer.new()
	plate.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.box(Color(XomDaoUi.NAVY, 0.9), XomDaoUi.NAVY_LINE, 2, 24.0)
	style.shadow_color = XomDaoPuff.SHADE
	style.shadow_size = 3
	style.shadow_offset = Vector2(0.0, 4.0)
	style.content_margin_left = 38.0
	style.content_margin_right = 14.0
	style.content_margin_top = 4.0
	style.content_margin_bottom = 10.0
	plate.add_theme_stylebox_override("panel", style)
	_profile.add_child(plate)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 2)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	plate.add_child(column)
	_name.name = "PlayerName"
	_name.theme_type_variation = "HudLabel"
	_name.add_theme_font_size_override("font_size", 30)
	_name.custom_minimum_size = Vector2(230.0, 38.0)
	_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	column.add_child(_name)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", -14)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(row)
	_level.name = "LobbyLevel"
	_level.compact()
	_level.custom_minimum_size.y = 34.0
	_level.z_index = 1
	_level.visible = false
	row.add_child(_level)
	_exp.name = "LobbyExp"
	_exp.custom_minimum_size = Vector2(130.0, 28.0)
	_exp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_exp.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_exp.show_percentage = false
	_exp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_exp.add_theme_stylebox_override(
		"background", XomDaoUi.box(Color(0.0, 0.0, 0.0, 0.35), XomDaoUi.NAVY_LINE, 2, 14.0)
	)
	_exp.add_theme_stylebox_override(
		"fill", XomDaoUi.box(XomDaoUi.SUN, XomDaoUi.GOLD_DARK, 2, 14.0)
	)
	_exp.visible = false
	row.add_child(_exp)
	_exp_text.name = "LobbyExpText"
	_exp_text.theme_type_variation = "HudLabel"
	_exp_text.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_exp_text.add_theme_color_override("font_outline_color", XomDaoUi.NAVY)
	_exp_text.add_theme_constant_override("outline_size", 6)
	_exp_text.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_exp_text.offset_left = 14.0
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
		_shortcuts.add_child(_shortcut(shortcut))
	show_event(null)


## A shortcut: a flat navy plate with a thin rim, its label and ›. Its picture is a banner that
## fills the plate (darker at the bottom, under the label) or an object beside the label; without
## one it shows its icon.
func _shortcut(entry: Array) -> Button:
	var id: String = str(entry[0])
	var height: float = float(entry[3])
	var banner: bool = entry[4]
	var button := Button.new()
	button.name = "Shortcut_" + id
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.custom_minimum_size = Vector2(SHORTCUT_W, height)
	button.clip_contents = false
	var style: StyleBoxFlat = XomDaoUi.box(Color(XomDaoUi.NAVY, 0.94), XomDaoUi.NAVY_LINE, 2, 20.0)
	style.shadow_color = XomDaoPuff.SHADE
	style.shadow_size = 3
	style.shadow_offset = Vector2(0.0, 5.0)
	var down: StyleBoxFlat = style.duplicate()
	down.bg_color = XomDaoUi.NAVY.darkened(0.2)
	var hover: StyleBoxFlat = style.duplicate()
	hover.border_color = XomDaoUi.SUN
	button.add_theme_stylebox_override("normal", style)
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", down)
	button.add_theme_stylebox_override("hover_pressed", down)
	button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	button.button_down.connect(XomDaoUi.bounce.bind(button))
	button.button_down.connect(XomDaoUi.play.bind(button, XomDaoUi.SOUND_TAP))
	button.pressed.connect(_on_shortcut.bind(id))
	var picture_path: String = "res://hub/lobby/shortcut-%s.webp" % id
	var picture: Texture2D = load(picture_path) if ResourceLoader.exists(picture_path) else null
	if banner and picture != null:
		button.add_child(_banner(picture, Vector2(SHORTCUT_W, height)))
	var row := HBoxContainer.new()
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 12)
	row.offset_left = 16.0
	row.add_theme_constant_override("separation", 14)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	button.add_child(row)
	if not banner or picture == null:
		var icon := TextureRect.new()
		icon.texture = picture if picture != null else XomDaoUi.icon(str(entry[2]))
		icon.custom_minimum_size = Vector2.ONE * (76.0 if picture != null else 52.0)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		# A picture is drawn smaller than its file: mipmaps keep its edges smooth.
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		icon.modulate = Color.WHITE if picture != null else XomDaoUi.SUN
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(icon)
	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# On a banner the label sits at the bottom, where the picture is darker.
	column.alignment = BoxContainer.ALIGNMENT_END if banner else BoxContainer.ALIGNMENT_CENTER
	column.add_theme_constant_override("separation", 0)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(column)
	var title := Label.new()
	title.name = "ShortcutTitle_" + id
	title.text = str(entry[1])
	title.theme_type_variation = "HudLabel"
	title.add_theme_font_size_override("font_size", 34)
	title.add_theme_color_override("font_outline_color", Color(XomDaoUi.NAVY, 0.7))
	title.add_theme_constant_override("outline_size", 5)
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
	caret.size_flags_vertical = Control.SIZE_SHRINK_END if banner else Control.SIZE_SHRINK_CENTER
	caret.modulate = XomDaoUi.CREAM
	caret.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(caret)
	return button


## A picture cut to a plate's rounded corners, inside its rim, darker at the top and bottom.
func _banner(picture: Texture2D, plate: Vector2) -> ColorRect:
	var rect := ColorRect.new()
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 3)
	var box: Vector2 = plate - Vector2.ONE * 6.0
	var k: float = maxf(box.x / picture.get_width(), box.y / picture.get_height())
	var span: Vector2 = box / (picture.get_size() * k)
	var material := ShaderMaterial.new()
	material.shader = preload("res://hub/lobby/glass.gdshader")
	material.set_shader_parameter("art", picture)
	material.set_shader_parameter("has_art", true)
	material.set_shader_parameter("box", box)
	material.set_shader_parameter("radius", 17.0)
	material.set_shader_parameter("shade", 0.5)
	material.set_shader_parameter("uv_origin", (Vector2.ONE - span) / 2.0)
	material.set_shader_parameter("uv_span", span)
	rect.material = material
	return rect


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
	_card.gui_input.connect(_on_card_input)
	add_child(_card)
	var buttons: HBoxContainer = _card.buttons
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
	play.pad = 12.0
	create.pad = 12.0


func _on_profile_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
		place_pressed.emit("nha")


func _on_card_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		XomDaoUi.bounce(_card)
		XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
		_open_genre()


## The dock floating at the left edge; the top row, the shortcuts and the card
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
	# The dock floats at the left edge, centred, shrunk to fit the height.
	var dock: Vector2 = _places.size + Vector2.ONE * 2.0 * DOCK_PAD
	var k_side: float = minf(k, (view.y - 2.0 * GAP) / dock.y)
	_sidebar.size = dock * k_side
	_sidebar.position = Vector2(inset.x + edge * 0.5, (view.y - _sidebar.size.y) / 2.0)
	_places.scale = Vector2.ONE * k_side
	_places.position = Vector2.ONE * DOCK_PAD * k_side
	var left: float = _sidebar.position.x + _sidebar.size.x + edge * 0.5
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
