class_name HubGameSelect
extends Control
## Chọn trò (docs/experience.md): the games of one genre as posters on a rail across the middle
## (HubGameStrip), and the genres as objects on plates in the bottom left corner (HubGenreTab).
## A tap on a poster is the whole choice: `play_pressed`, and the hub opens a room of that game.
## An event's poster opens its board instead: your points, the tiers to claim and Tham gia.
##
## Named nodes for tests: Cards, Card_<id>, GenreTabs, Tab_<genre>, EventBoard, EventPoints,
## Tier_<i>, Claim_<i>, Claimed_<i>, JoinEvent.

signal back_pressed
## A playable game's poster was tapped.
signal play_pressed(game_id: String)
signal progress_needed(game_id: String)
signal join_pressed(game_id: String)
signal claim_pressed(game_id: String, tier: int)

var top: HubTopBar
var strip := HubGameStrip.new()
var _catalog: HubCatalog
var _genre: String = ""
## The event whose board is open ("" for none).
var _event_id: String = ""
var _tabs := HBoxContainer.new()
var _event_layer := Control.new()
var _event_board: XomDaoBoard = XomDaoBoard.create("", true)
var _points := Label.new()
var _tiers := VBoxContainer.new()
var _join: XomDaoButton = XomDaoButton.create("Tham gia", XomDaoUi.Kind.PLAY)
var _settings: XomDaoSettings


func _init(settings: XomDaoSettings = null) -> void:
	name = "GameSelect"
	_settings = settings if settings != null else XomDaoSettings.current()
	theme = XomDaoUi.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSky.new())
	add_child(strip)
	strip.picked.connect(_on_picked)
	top = HubTopBar.new(_settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	_tabs.name = "GenreTabs"
	_tabs.add_theme_constant_override("separation", 14)
	add_child(_tabs)
	_build_event()
	resized.connect(_layout)
	_settings.changed.connect(_layout)


func _ready() -> void:
	_layout()


## The genre's games on the rail; `game_id`, when it is one of them, is slid into view, and an
## event's board opens.
func show_genre(catalog: HubCatalog, genre_id: String, game_id: String = "") -> void:
	_catalog = catalog
	_genre = genre_id
	_build_tabs()
	strip.show_games(catalog.games_of(genre_id), catalog)
	_layout()
	var card: XomDaoGameCard = catalog.card(game_id)
	if card == null or card.genre != genre_id:
		return
	strip.reveal(game_id)
	if card.kind == "event":
		_open_event(card)


func show_progress(progress: XomDaoEventProgress) -> void:
	var card: XomDaoGameCard = _catalog.card(_event_id) if _catalog != null else null
	if card != null and progress.event_id == card.id:
		_show_tiers(card, progress)


func _on_picked(game_id: String) -> void:
	var card: XomDaoGameCard = _catalog.card(game_id) if _catalog != null else null
	if card == null or not _catalog.can_play(game_id):
		return
	if card.kind == "event":
		_open_event(card)
	else:
		play_pressed.emit(game_id)


func _open_event(card: XomDaoGameCard) -> void:
	_event_id = card.id
	_event_board.title = card.name
	_join.disabled = not _catalog.can_play(card.id)
	_show_tiers(card, null)
	_event_layer.visible = true
	_event_board.open()
	_layout()
	progress_needed.emit(card.id)
	ContentLoader.preload_game(card.id)


func _close_event() -> void:
	_event_id = ""
	_event_layer.visible = false


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
		row.add_theme_constant_override("separation", 16)
		var goal := XomDaoChip.create("%d điểm" % int(tier.get("points", 0)))
		goal.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(goal)
		var coins: int = int((tier.get("reward", {}) as Dictionary).get("core:coin", 0))
		var coin := XomDaoResourceIcon.new()
		coin.custom_minimum_size = Vector2(36.0, 36.0)
		coin.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(coin)
		var amount := Label.new()
		amount.text = XomDaoUi.money(coins)
		amount.add_theme_font_override("font", XomDaoUi.display_font(800))
		amount.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(amount)
		if progress != null and progress.claimed.has(i):
			var done := XomDaoChip.create("Đã nhận", "check-circle", XomDaoUi.BAMBOO_DARK)
			done.name = "Claimed_%d" % i
			done.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			row.add_child(done)
		else:
			var claim: XomDaoButton = XomDaoButton.create("Nhận", XomDaoUi.Kind.CONFIRM)
			claim.name = "Claim_%d" % i
			claim.custom_minimum_size = Vector2(130.0, 72.0)
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
		var tab: HubGenreTab = HubGenreTab.create(genre.id, genre.name)
		tab.selected = genre.id == _genre
		tab.pressed.connect(func() -> void: show_genre(_catalog, genre.id))
		_tabs.add_child(tab)


## The event's board over a shade: points, one row per tier and Tham gia.
func _build_event() -> void:
	_event_layer.name = "EventLayer"
	_event_layer.visible = false
	_event_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_event_layer)
	var shade := ColorRect.new()
	shade.color = Color(XomDaoUi.INK, 0.45)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.gui_input.connect(
		func(event: InputEvent) -> void:
			var button := event as InputEventMouseButton
			if button != null and button.pressed:
				_close_event()
	)
	_event_layer.add_child(shade)
	_event_board.name = "EventBoard"
	_event_board.closed.connect(_close_event)
	_event_layer.add_child(_event_board)
	var column: VBoxContainer = _event_board.content
	column.add_theme_constant_override("separation", 14)
	column.custom_minimum_size.x = 520.0
	_points.name = "EventPoints"
	_points.theme_type_variation = "TitleLabel"
	_points.add_theme_color_override("font_color", XomDaoUi.LACQUER)
	_points.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_points)
	_tiers.name = "EventTiers"
	_tiers.add_theme_constant_override("separation", 10)
	column.add_child(_tiers)
	column.add_child(XomDaoDivider.new())
	_join.name = "JoinEvent"
	_join.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_join.pressed.connect(func() -> void: join_pressed.emit(_event_id))
	column.add_child(_join)


func _layout() -> void:
	if not is_inside_tree():
		return
	top._layout()
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = _settings.margin
	var k: float = _settings.ui_scale
	_tabs.reset_size()
	_tabs.scale = Vector2.ONE * k
	_tabs.position = Vector2(inset.x + edge, size.y - inset.y - edge - _tabs.size.y * k)
	var y: float = top.bottom() + 4.0
	strip.position = Vector2(0.0, y)
	strip.size = Vector2(size.x, maxf(0.0, _tabs.position.y - 8.0 - y))
	if _event_layer.visible:
		_event_board.reset_size()
		var room: Vector2 = (size - Vector2(32.0, 16.0)) / _event_board.size
		_event_board.pivot_offset = _event_board.size / 2.0
		_event_board.scale = Vector2.ONE * clampf(minf(room.x, room.y), 0.5, 1.0)
		_event_board.position = (size - _event_board.size) / 2.0
