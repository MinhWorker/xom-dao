class_name HubGameSelect
extends Control
## Three island previews, game-specific splash, fading detail on the left and actions below.
## Selection is saved immediately; creating a room still opens its own setup board.

signal back_pressed
signal chosen(game_id: String)
signal create_pressed(game_id: String)
signal rules_pressed(game_id: String)
signal progress_needed(game_id: String)
signal join_pressed(game_id: String)
signal claim_pressed(game_id: String, tier: int)

var top: HubTopBar
var carousel := HubGameCarousel.new()
var _catalog: HubCatalog
var _genre: String = ""
var _game: String = ""
var _tabs := HBoxContainer.new()
var _tab_scroll := ScrollContainer.new()
var _tab_surface := Control.new()
var _detail := Control.new()
var _fade := ColorRect.new()
var _title := Label.new()
var _tagline := Label.new()
var _players := Label.new()
var _people := TextureRect.new()
var _create: XomDaoButton = XomDaoButton.create("Tạo phòng", XomDaoUi.Kind.SOCIAL)
var _rules: XomDaoButton = XomDaoButton.create("Luật", XomDaoUi.Kind.INFO)
var _join: XomDaoButton = XomDaoButton.create("Tham gia", XomDaoUi.Kind.PLAY)
var _actions := HBoxContainer.new()
var _event := VBoxContainer.new()
var _points := Label.new()
var _tiers := VBoxContainer.new()
var _event_scroll := ScrollContainer.new()
var _background := TextureRect.new()
var _old_background := TextureRect.new()
var _background_tween: Tween
var _settings: XomDaoSettings


func _init(settings: XomDaoSettings = null) -> void:
	name = "GameSelect"
	_settings = settings if settings != null else XomDaoSettings.current()
	theme = XomDaoUi.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	for picture: TextureRect in [_old_background, _background]:
		picture.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(picture)
	var tint := ShaderMaterial.new()
	tint.shader = preload("res://hub/select/island_tint.gdshader")
	tint.set_shader_parameter("saturation", 0.65)
	tint.set_shader_parameter("wash", 0.12)
	_background.material = tint
	_old_background.material = tint
	var veil := ColorRect.new()
	veil.color = Color(XomDaoUi.PAPER, 0.16)
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	veil.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(veil)
	add_child(carousel)
	carousel.selected_changed.connect(_show_game)
	top = HubTopBar.new(_settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	_tabs.name = "Tabs"
	_tab_scroll.name = "GenreTabs"
	_tabs.add_theme_constant_override("separation", 10)
	_tab_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_tab_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	_tab_surface.add_child(_tabs)
	_tab_scroll.add_child(_tab_surface)
	_tab_scroll.scroll_started.connect(func() -> void: XomDaoUi.play(self, XomDaoUi.SOUND_TAP))
	add_child(_tab_scroll)
	_build_detail()
	_actions.name = "SelectActions"
	_actions.add_theme_constant_override("separation", 16)
	_rules.name = "GameRules"
	_rules.icon = XomDaoUi.icon("scroll")
	_rules.pressed.connect(func() -> void: rules_pressed.emit(_game))
	_create.name = "SelectCreate"
	_create.add_theme_font_size_override("font_size", 40)
	_create.custom_minimum_size = Vector2(288, 104)
	_create.pressed.connect(func() -> void: create_pressed.emit(_game))
	_join.name = "JoinEvent"
	_join.pressed.connect(func() -> void: join_pressed.emit(_game))
	for button: XomDaoButton in [_rules, _create, _join]:
		_actions.add_child(button)
	add_child(_actions)
	resized.connect(_layout)
	_settings.changed.connect(_layout)


func _ready() -> void:
	_layout()


func show_genre(catalog: HubCatalog, genre_id: String, game_id: String = "") -> void:
	_catalog = catalog
	_genre = genre_id
	_build_tabs()
	var cards: Array[XomDaoGameCard] = catalog.games_of(genre_id)
	var pick: String = game_id
	if catalog.card(pick) == null or catalog.card(pick).genre != genre_id:
		pick = cards[0].id if not cards.is_empty() else ""
	carousel.show_games(cards, catalog, pick)
	_show_game(pick)


func select_game(game_id: String) -> void:
	carousel.select_game(game_id)


func selected_game() -> String:
	return _game


func set_obscured(value: bool) -> void:
	carousel.set_obscured(value)


func _show_game(game_id: String) -> void:
	_game = game_id
	var card: XomDaoGameCard = _catalog.card(game_id) if _catalog != null else null
	_detail.visible = card != null
	_actions.visible = card != null
	if card == null:
		_background.texture = null
		_old_background.texture = null
		return
	var playable: bool = _catalog.can_play(game_id)
	_title.text = card.name
	_tagline.text = card.tagline if playable else "Sắp có trên Xóm Đảo."
	_players.text = XomDaoGameTile.players_label(card.min_players, card.max_players).replace(
		"người", "chỗ"
	)
	var event: bool = card.kind == "event"
	_create.visible = not event
	_join.visible = event
	_event_scroll.visible = event
	_players.visible = not event
	_people.visible = not event
	_create.disabled = not playable
	_join.disabled = not playable
	if event:
		_show_tiers(card, null)
		progress_needed.emit(game_id)
	if playable:
		chosen.emit(game_id)
		ContentLoader.preload_game(game_id)
	_set_splash(HubGameArt.splash(game_id))
	if is_inside_tree():
		var tween: Tween = create_tween()
		_detail.modulate.a = 0.6
		tween.tween_property(_detail, "modulate:a", 1.0, 0.22)
	_layout.call_deferred()


func _set_splash(picture: Texture2D) -> void:
	if _background_tween != null:
		_background_tween.kill()
	_old_background.texture = _background.texture
	_background.texture = picture
	_background.modulate.a = 0.0 if is_inside_tree() and _old_background.texture != null else 1.0
	if is_inside_tree():
		_background_tween = create_tween()
		_background_tween.tween_property(_background, "modulate:a", 1.0, 0.35)
		_background_tween.tween_callback(func() -> void: _old_background.texture = null)


func show_progress(progress: XomDaoEventProgress) -> void:
	var card: XomDaoGameCard = _catalog.card(_game) if _catalog != null else null
	if card != null and card.kind == "event" and progress.event_id == card.id:
		_show_tiers(card, progress)


func _show_tiers(card: XomDaoGameCard, progress: XomDaoEventProgress) -> void:
	var points: int = progress.points if progress != null else 0
	_points.text = "%d điểm" % points
	for child: Node in _tiers.get_children():
		_tiers.remove_child(child)
		child.queue_free()
	if card.event == null:
		return
	for i: int in card.event.tiers.size():
		var tier: Dictionary = card.event.tiers[i]
		var row := HBoxContainer.new()
		row.name = "Tier_%d" % i
		row.add_theme_constant_override("separation", 8)
		var reward := VBoxContainer.new()
		reward.add_theme_constant_override("separation", 8)
		reward.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(reward)
		var goal := XomDaoChip.create("%d điểm" % int(tier.get("points", 0)))
		goal.compact()
		reward.add_child(goal)
		var money := HBoxContainer.new()
		money.add_theme_constant_override("separation", 8)
		reward.add_child(money)
		var coins: int = int((tier.get("reward", {}) as Dictionary).get("core:coin", 0))
		var coin := XomDaoResourceIcon.new()
		coin.custom_minimum_size = Vector2(32.0, 32.0)
		coin.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		money.add_child(coin)
		var amount := Label.new()
		amount.text = XomDaoUi.money(coins)
		amount.add_theme_color_override("font_color", XomDaoUi.CREAM)
		amount.add_theme_font_size_override("font_size", 24)
		amount.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		money.add_child(amount)
		if progress != null and progress.claimed.has(i):
			var done := XomDaoChip.create("Đã nhận", "check-circle", XomDaoUi.BAMBOO_DARK)
			done.name = "Claimed_%d" % i
			done.compact()
			done.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			row.add_child(done)
		else:
			var claim: XomDaoButton = XomDaoButton.create("Nhận", XomDaoUi.Kind.CONFIRM)
			claim.name = "Claim_%d" % i
			claim.custom_minimum_size = Vector2(110.0, 88.0)
			claim.disabled = points < int(tier.get("points", 0))
			claim.pressed.connect(claim_pressed.emit.bind(card.id, i))
			row.add_child(claim)
		_tiers.add_child(row)
	_layout.call_deferred()


func _build_tabs() -> void:
	for child: Node in _tabs.get_children():
		_tabs.remove_child(child)
		child.queue_free()
	for genre: XomDaoGenre in _catalog.ordered_genres():
		var tab: XomDaoButton = XomDaoButton.create(
			genre.name, XomDaoUi.Kind.GO if genre.id == _genre else XomDaoUi.Kind.BACK
		)
		tab.name = "Tab_" + genre.id
		tab.custom_minimum_size = Vector2(140, 88)
		tab.pressed.connect(func() -> void: show_genre(_catalog, genre.id))
		_tabs.add_child(tab)


func _build_detail() -> void:
	_detail.name = "Detail"
	_detail.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_detail)
	var fade := ShaderMaterial.new()
	fade.shader = preload("res://hub/select/detail_fade.gdshader")
	_fade.material = fade
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_detail.add_child(_fade)
	_title.name = "FocusName"
	_tagline.name = "GameDescription"
	_players.name = "GameSeats"
	for label: Label in [_title, _tagline, _players, _points]:
		label.add_theme_color_override("font_color", XomDaoUi.CREAM)
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_title.add_theme_font_override("font", XomDaoUi.display_font())
	_title.add_theme_font_size_override("font_size", 52)
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_tagline.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_tagline.add_theme_font_size_override("font_size", 28)
	_players.add_theme_font_size_override("font_size", 28)
	for child: Control in [_title, _tagline, _players, _people]:
		_detail.add_child(child)
	_people.texture = XomDaoUi.icon("users")
	_people.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_people.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_event.name = "EventTiers"
	_points.name = "EventPoints"
	_points.add_theme_font_override("font", XomDaoUi.display_font())
	_points.add_theme_font_size_override("font_size", 32)
	_event.add_child(_points)
	_event.add_child(_tiers)
	_event_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_event_scroll.add_child(_event)
	_detail.add_child(_event_scroll)


func _layout() -> void:
	top._layout()
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = _settings.margin
	var k: float = _settings.ui_scale
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var y: float = top.bottom() + 20.0
	var tabs_left: float = left + 104.0 * k
	_tab_scroll.position = Vector2(tabs_left, inset.y + edge)
	_tab_scroll.size = Vector2(maxf(0.0, top.money.position.x - 16.0 - tabs_left), 88.0 * k)
	_tabs.scale = Vector2.ONE * k
	_tabs.size = _tabs.get_combined_minimum_size()
	_tab_surface.custom_minimum_size = _tabs.size * k
	_actions.reset_size()
	_actions.scale = Vector2.ONE * k
	_actions.position = Vector2(
		right - _actions.size.x * k, size.y - inset.y - edge - _actions.size.y * k
	)
	var available: float = _actions.position.y - y - 16.0
	var detail_width: float = clampf((right - left) * 0.24, 290.0, 340.0)
	_detail.position = Vector2(left, y)
	_detail.size = Vector2(detail_width, available)
	var text_width: float = detail_width - 48.0
	var title_font: int = 44 if available < 440 else 52
	var body_font: int = 26 if available < 420 else 28
	var spacing: float = 24.0
	if _event_scroll.visible:
		title_font = 40
		body_font = 24
		spacing = 12.0
	_title.add_theme_font_size_override("font_size", title_font)
	_tagline.add_theme_font_size_override("font_size", body_font)
	var title_height: float = (
		(
			XomDaoUi
			. display_font()
			. get_multiline_string_size(
				_title.text, HORIZONTAL_ALIGNMENT_LEFT, text_width, title_font
			)
			. y
		)
		+ 8.0
	)
	var body_height: float = (
		(
			XomDaoUi
			. body_font()
			. get_multiline_string_size(
				_tagline.text, HORIZONTAL_ALIGNMENT_LEFT, text_width, body_font
			)
			. y
		)
		+ 8.0
	)
	_title.position = Vector2(24, 16)
	_title.size = Vector2(text_width, title_height)
	_tagline.position = Vector2(24, 16 + title_height + spacing)
	_tagline.size = Vector2(text_width, body_height)
	var seats_y: float = _tagline.position.y + body_height + spacing
	_people.position = Vector2(24, seats_y + 10)
	_people.size = Vector2(32, 32)
	_players.position = Vector2(68, seats_y)
	_players.size = Vector2(text_width - 44, 52)
	_event_scroll.position = Vector2(24, seats_y)
	_event_scroll.size = Vector2(text_width, maxf(0.0, available - seats_y - 8.0))
	_event.custom_minimum_size.x = text_width - 16
	carousel.position = Vector2(left + detail_width + 8, y)
	carousel.size = Vector2(maxf(0.0, right - carousel.position.x), available)
