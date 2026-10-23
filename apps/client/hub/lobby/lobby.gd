class_name HubLobby
extends Control
## The lobby (docs/experience.md, "Sảnh"): the ring of genre islands floating over the sky, and a
## navy HUD around it.
## - Left: a floating dock of places (Nhà, the lobby itself, on a gold plate; Chợ, Đình,
##   Bến), each a picture over its name (HubNavButton).
## - Top: the profile (avatar, name, level, EXP bar; it opens Nhà) on the left; the balance,
##   Bạn bè, mail, gifts and ⚙ on the right.
## - Right, under the top row: shortcuts to Chợ, Sự kiện (red dot and days left while an event
##   is open) and Nhiệm vụ.
## - Bottom right: the selected game's card (HubGameCard): its art, its name, and CHƠI as a
##   gold slab along its bottom. A room is made from the game select.
## Buttons and panels are raised (XomDaoPuff); CHƠI catches the light every few seconds.
## Art slots, all optional: `hub/lobby/backdrop.webp` (HubSky), `hub/genres/<island>.tscn|webp`
## (HubIsland), `hub/lobby/nav-<name>.svg` (a dock picture), `hub/lobby/shortcut-<id>.webp` (a
## shortcut's picture).
##
## The lobby only shows and reports: the hub (main.gd) acts on its signals.

signal play_pressed(game_id: String)
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
	["lobby", "Sảnh", "house", "nav-sanh"],
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
var play: HubPlayButton
var friends: XomDaoIconButton = XomDaoIconButton.create("users")
var mail: XomDaoIconButton = XomDaoIconButton.create("envelope-simple")
var gifts: XomDaoIconButton = XomDaoIconButton.create("gift")

var _game_id: String = ""
var _sidebar := Panel.new()
var _places := VBoxContainer.new()
var _profile := HBoxContainer.new()
var _name := Label.new()
var _username := Label.new()
var _level: XomDaoChip = XomDaoChip.create("Cấp 1", "crown", XomDaoUi.GOLD_DARK)
var _exp := ProgressBar.new()
var _exp_text := Label.new()
var _shortcuts := VBoxContainer.new()
var _event_tag: XomDaoChip
## The open event on the Sự kiện shortcut ("" = none).
var _event_id: String = ""
var _card := HubGameCard.new()
var _settings: XomDaoSettings
var _current_level: int = 1
var _current_into: int = 0
var _current_span: int = 1
var _has_level: bool = false
var _exp_tween: Tween


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
		play.sweep()


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


## Red dots on Nhiệm vụ and the gift while `waiting` quests have a reward to take.
func show_quests(waiting: int) -> void:
	for button: Control in [_shortcuts.get_node("Shortcut_nhiem-vu"), gifts]:
		var dot: Node = button.get_node_or_null("Dot")
		if waiting > 0 and dot == null:
			XomDaoDot.attach(button)
		elif waiting <= 0 and dot != null:
			dot.queue_free()


## Follows the hub's Bạn bè: the people button opens its board, with a red dot while requests or
## messages wait for you.
func watch_friends(people: HubFriends) -> void:
	friends.pressed.connect(func() -> void: people.open(self))
	people.changed.connect(_on_friends.bind(people))
	_on_friends(people)


func _on_friends(people: HubFriends) -> void:
	show_friends(people.attention())


## Follows the hub's Hộp thư: the envelope opens it, with a red dot while letters wait.
func watch_mail(letters: HubMail) -> void:
	mail.pressed.connect(func() -> void: letters.open(self))
	letters.changed.connect(_on_mail.bind(letters))
	_on_mail(letters)


func _on_mail(letters: HubMail) -> void:
	var dot: Node = mail.get_node_or_null("Dot")
	if letters.box.waiting > 0 and dot == null:
		XomDaoDot.attach(mail)
	elif letters.box.waiting <= 0 and dot != null:
		dot.queue_free()


## A red dot on the people button while `waiting` (friend requests and messages) is above 0.
func show_friends(waiting: int) -> void:
	var dot: Node = friends.get_node_or_null("Dot")
	if waiting > 0 and dot == null:
		XomDaoDot.attach(friends)
	elif waiting <= 0 and dot != null:
		dot.queue_free()


func show_user(user: XomDaoUser) -> void:
	_name.text = user.name if user != null else ""
	var uname: String = user.username if user != null else ""
	if uname != "":
		_username.text = "#" + uname.trim_prefix("#")
		_username.visible = true
	else:
		_username.text = ""
		_username.visible = false
	avatar.initial = _name.text
	avatar.picture = XomDaoLooks.avatar(user.avatar) if user != null else null
	avatar.frame = user.frame if user != null else ""


## The level chip and the EXP bar under the name (`stats:get`): `xp` is the total, `level_xp`
## where this level starts and `next_xp` where the next one does.
func show_level(
	level: int, xp: int = 0, level_xp: int = 0, next_xp: int = 0, animate: bool = true
) -> void:
	var span: int = maxi(1, next_xp - level_xp)
	var into: int = clampi(xp - level_xp, 0, span)
	var max_level: bool = next_xp <= level_xp

	if not _has_level or not animate or not is_inside_tree():
		if _exp_tween != null and _exp_tween.is_valid():
			_exp_tween.kill()
		_has_level = true
		_current_level = level
		_current_into = into
		_current_span = span
		_level.text = "Cấp %d" % level
		_level.visible = true
		_exp.max_value = span
		_exp.value = into
		_exp_text.text = "%s/%s" % [XomDaoUi.money(into), XomDaoUi.money(span)]
		_exp.visible = not max_level
		return

	_level.visible = true
	_exp.visible = not max_level

	if level == _current_level and into == _current_into and span == _current_span:
		return

	if _exp_tween != null and _exp_tween.is_valid():
		_exp_tween.kill()

	_exp_tween = create_tween()

	if level > _current_level:
		var old_span: int = _current_span if _current_span > 0 else span
		var start_val: float = _exp.value
		(
			_exp_tween
			. tween_method(
				func(v: float) -> void: _set_exp_display(v, old_span),
				start_val,
				float(old_span),
				0.35
			)
			. set_trans(Tween.TRANS_QUAD)
			. set_ease(Tween.EASE_IN)
		)
		_exp_tween.tween_callback(
			func() -> void:
				_level.text = "Cấp %d" % level
				XomDaoUi.bounce(_level)
				XomDaoUi.play(self, XomDaoUi.SOUND_COIN)
				_exp.max_value = span
				_set_exp_display(0.0, span)
		)
		if not max_level:
			(
				_exp_tween
				. tween_method(
					func(v: float) -> void: _set_exp_display(v, span), 0.0, float(into), 0.5
				)
				. set_trans(Tween.TRANS_QUAD)
				. set_ease(Tween.EASE_OUT)
			)
	else:
		if level != _current_level:
			_level.text = "Cấp %d" % level
			XomDaoUi.bounce(_level)
		_exp.max_value = span
		var start_val: float = _exp.value
		(
			_exp_tween
			. tween_method(
				func(v: float) -> void: _set_exp_display(v, span), start_val, float(into), 0.5
			)
			. set_trans(Tween.TRANS_QUAD)
			. set_ease(Tween.EASE_OUT)
		)

	_current_level = level
	_current_into = into
	_current_span = span


func _set_exp_display(val: float, span_val: int) -> void:
	_exp.value = val
	_exp_text.text = "%s/%s" % [XomDaoUi.money(roundi(val)), XomDaoUi.money(span_val)]


## The card at the bottom right: the selected game, or "Sắp có" when there is none to play.
func show_game(card: XomDaoGameCard, can_play: bool) -> void:
	_game_id = card.id if card != null else ""
	_card.show_title(card.name if card != null else "Sắp có")
	_card.show_art(HubGameArt.splash(card.id) if card != null else null, not can_play)
	_card.show_online(card.playing if card != null else 0, card != null)
	play.seats = (
		XomDaoGameTile.players_label(card.min_players, card.max_players) if card != null else ""
	)
	play.disabled = not can_play
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


func _build_sidebar() -> void:
	_sidebar.name = "Sidebar"
	_sidebar.mouse_filter = Control.MOUSE_FILTER_STOP
	var style: StyleBoxFlat = XomDaoUi.box(Color("#101726", 0.96), Color("#C4922F", 0.75), 2, 32.0)
	style.shadow_color = XomDaoPuff.SHADE
	style.shadow_size = 6
	style.shadow_offset = Vector2(0.0, 6.0)
	_sidebar.add_theme_stylebox_override("panel", style)
	_sidebar.draw.connect(
		func() -> void:
			var s: Vector2 = _sidebar.size
			_draw_rivet(_sidebar, Vector2(s.x / 2.0, 10.0), 3.0)
			_draw_rivet(_sidebar, Vector2(s.x / 2.0, s.y - 10.0), 3.0)
	)
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
	plate.name = "Plate"
	plate.custom_minimum_size = Vector2(284.0, 103.0)
	plate.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.box(Color("#111827", 0.96), Color("#C4922F", 0.8), 2, 24.0)
	style.shadow_color = XomDaoPuff.SHADE
	style.shadow_size = 5
	style.shadow_offset = Vector2(0.0, 5.0)
	style.content_margin_left = 38.0
	style.content_margin_right = 16.0
	style.content_margin_top = 4.0
	style.content_margin_bottom = 10.0
	plate.add_theme_stylebox_override("panel", style)
	plate.draw.connect(
		func() -> void:
			_draw_rivet(plate, Vector2(plate.size.x - 14.0, 14.0), 3.5)
			_draw_rivet(plate, Vector2(plate.size.x - 14.0, plate.size.y - 14.0), 3.5)
	)
	_profile.add_child(plate)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 2)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.custom_minimum_size = Vector2(230.0, 85.0)
	plate.add_child(column)
	var name_row := HBoxContainer.new()
	name_row.name = "NameRow"
	name_row.custom_minimum_size = Vector2(0.0, 36.0)
	name_row.add_theme_constant_override("separation", 8)
	name_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(name_row)
	_name.name = "PlayerName"
	_name.theme_type_variation = "HudLabel"
	_name.add_theme_font_size_override("font_size", 30)
	_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	name_row.add_child(_name)
	_username.name = "PlayerUsername"
	var font := FontVariation.new()
	font.base_font = XomDaoUi.display_font(700)
	font.variation_transform = Transform2D(Vector2(1.0, 0.0), Vector2(0.2, 1.0), Vector2.ZERO)
	_username.add_theme_font_override("font", font)
	_username.add_theme_font_size_override("font_size", 22)
	_username.add_theme_color_override("font_color", Color("#9AAEC7"))
	_username.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_username.mouse_filter = Control.MOUSE_FILTER_IGNORE
	name_row.add_child(_username)
	var row := HBoxContainer.new()
	row.name = "LevelRow"
	row.custom_minimum_size = Vector2(230.0, 40.0)
	row.add_theme_constant_override("separation", -14)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(row)
	_level.name = "LobbyLevel"
	_level.compact()
	_level.custom_minimum_size.y = 40.0
	_level.z_index = 1
	_level.visible = false
	row.add_child(_level)
	_exp.name = "LobbyExp"
	_exp.custom_minimum_size = Vector2(130.0, 28.0)
	_exp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_exp.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_exp.show_percentage = false
	_exp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var exp_bg := StyleBoxFlat.new()
	exp_bg.bg_color = Color(0.04, 0.06, 0.1, 0.9)
	exp_bg.border_width_left = 2
	exp_bg.border_width_top = 2
	exp_bg.border_width_right = 2
	exp_bg.border_width_bottom = 2
	exp_bg.border_color = Color(0.02, 0.03, 0.05, 0.95)
	exp_bg.set_corner_radius_all(14)
	_exp.add_theme_stylebox_override("background", exp_bg)
	var exp_fill := StyleBoxFlat.new()
	exp_fill.bg_color = Color("#F3BA2F")
	exp_fill.border_width_left = 1
	exp_fill.border_width_top = 1
	exp_fill.border_width_right = 1
	exp_fill.border_width_bottom = 2
	exp_fill.border_color = Color("#9C620E")
	exp_fill.set_corner_radius_all(14)
	_exp.add_theme_stylebox_override("fill", exp_fill)
	_exp.visible = false
	row.add_child(_exp)
	_exp_text.name = "LobbyExpText"
	_exp_text.theme_type_variation = "HudLabel"
	_exp_text.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_exp_text.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_exp_text.add_theme_color_override("font_outline_color", Color("#0A101A"))
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


## Bạn bè, mail and gifts go between the balance and ⚙.
func _build_money() -> void:
	add_child(money)
	money.add_theme_constant_override("separation", 10)
	money.coins.custom_minimum_size.x = 180.0
	money.coins.background = Color("#111A29")
	for button: XomDaoIconButton in [friends, mail, gifts, money.settings]:
		button.background = Color("#141E30")
		button.border = 2
		button.edge = XomDaoUi.GOLD_DARK
		button.lit = true
	friends.name = "Friends"
	friends.tooltip_text = "Bạn bè"
	money.add_child(friends)
	mail.name = "Mail"
	money.add_child(mail)
	gifts.name = "Gifts"
	gifts.pressed.connect(place_pressed.emit.bind("nhiem-vu"))
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
	var button := HubShortcutButton.create(id, str(entry[1]), str(entry[2]), height, banner)
	button.pressed.connect(_on_shortcut.bind(id))
	if id == "su-kien":
		_event_tag = button.get_event_tag()
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
		"nhiem-vu":
			place_pressed.emit("nhiem-vu")
		_:
			XomDaoToast.show_on(self, "Sắp có", "lock-simple")


## The selected game: name and players online, its picture, players and length, CHƠI and
## Tạo phòng.
func _build_card() -> void:
	play = _card.play
	_card.gui_input.connect(_on_card_input)
	add_child(_card)
	play.pressed.connect(func() -> void: play_pressed.emit(_game_id))


func _on_profile_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_open_profile()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") and is_visible_in_tree():
		_open_profile()
		get_viewport().set_input_as_handled()


func _open_profile() -> void:
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
	var top: float = inset.y + edge * 0.5
	var bottom: float = view.y - edge * 0.5
	var profile_left: float = inset.x + edge * 0.5
	var right: float = view.x - inset.x - edge
	# The top row shrinks rather than overlap itself.
	var row_w: float = _profile.size.x + money.size.x + GAP
	var k_top: float = minf(k, (right - profile_left) / row_w)
	_profile.scale = Vector2.ONE * k_top
	money.scale = Vector2.ONE * k_top
	_profile.position = Vector2(profile_left, top + (88.0 - _profile.size.y) / 2.0 * k_top)
	money.position = Vector2(right - money.size.x * k_top, top)
	var hud_bottom: float = top + 88.0 * k_top
	# The dock floats at the left edge under the top row, shrunk to fit the height.
	var dock: Vector2 = _places.size + Vector2.ONE * 2.0 * DOCK_PAD
	var side_space: float = bottom - hud_bottom - GAP
	var k_side: float = minf(k, side_space / dock.y)
	_sidebar.size = dock * k_side
	_sidebar.position = Vector2(
		inset.x + edge * 0.5, hud_bottom + GAP + (side_space - _sidebar.size.y) / 2.0
	)
	_places.scale = Vector2.ONE * k_side
	_places.position = Vector2.ONE * DOCK_PAD * k_side
	var left: float = _sidebar.position.x + _sidebar.size.x + edge * 0.5
	# The right column, shrunk to fit the height: the shortcuts hang under the top row and the
	# card sits in the bottom corner.
	var column_h: float = _shortcuts.size.y + GAP + _card.size.y
	var k_right: float = minf(k, (bottom - hud_bottom - GAP) / column_h)
	k_right = minf(k_right, (right - left) * 0.45 / _card.size.x)
	_shortcuts.scale = Vector2.ONE * k_right
	_card.scale = Vector2.ONE * k_right
	_card.position = Vector2(right - _card.size.x * k_right, bottom - _card.size.y * k_right)
	_shortcuts.position = Vector2(right - _shortcuts.size.x * k_right, hud_bottom + GAP)
	var ring_top: float = hud_bottom + 8.0
	var ring_right: float = minf(_card.position.x, _shortcuts.position.x) - GAP
	ring.position = Vector2(left, ring_top)
	ring.size = Vector2(maxf(0.0, ring_right - left), maxf(0.0, bottom - ring_top))


static func _draw_rivet(canvas: CanvasItem, pos: Vector2, r: float = 3.5) -> void:
	canvas.draw_circle(pos + Vector2(0.0, 1.2), r, Color(0.0, 0.0, 0.0, 0.45), true, -1.0, true)
	canvas.draw_circle(pos, r, Color("#754511"), true, -1.0, true)
	canvas.draw_circle(pos, r * 0.72, Color("#E5A730"), true, -1.0, true)
	canvas.draw_circle(
		pos + Vector2(-r * 0.25, -r * 0.25), r * 0.3, Color("#FFF8E7"), true, -1.0, true
	)
