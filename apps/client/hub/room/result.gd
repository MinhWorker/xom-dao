class_name HubResult
extends Control
## The end of a game, over the board: how it ended and the game's own figures (its
## `result_detail()`, after the time played), the ranks the game gave, each player's reward from
## the ledger (a Phần thưởng section of icon tags, green up, red down), the balance on the top
## right that the coins fly into, and Chơi tiếp (a new game, same room), Về sảnh and Xem bàn (put
## the board away to look at the table; Kết quả at the top brings it back).
##
## It arrives rather than pops: the shade fades in, the board rises with a slight overshoot, its
## lines show one after another, then the coins fly. A game skins it with `apply_theme()` (its
## `result_theme()`: paper, ink, accent, shade, title, emblem).

signal again_pressed
signal home_pressed
signal board_view_changed(looking: bool)
signal board_visibility_changed(shown: bool)

var money := HubMoneyRow.new()

var _shade := ColorRect.new()
var _board: XomDaoBoard = XomDaoBoard.create("Hết ván")
var _title := Label.new()
var _reason := Label.new()
var _rows := GridContainer.new()
var _ranks := VBoxContainer.new()
var _rewards := VBoxContainer.new()
var _reward_tags := HBoxContainer.new()
var _reward_caption := Label.new()
var _button_row := HBoxContainer.new()
var _reopen: XomDaoButton = XomDaoButton.create("Kết quả", XomDaoUi.Kind.GO)
var _again: XomDaoButton = XomDaoButton.create("Chơi tiếp", XomDaoUi.Kind.GO)
var _reward_at: Control
var _settings: XomDaoSettings
var _panel_bounds := Rect2()
var _presenting: bool = false
var _side_panel: bool = false
var _dock_area: Callable
var _reveal: Tween
var _emblem := TextureRect.new()
var _paper: PanelContainer
var _ink: Color = XomDaoUi.INK
var _accent: Variant = null
var _shade_color: Variant = null
var _arriving: bool = false
var _pending_balance: int = -1


## The ranks of a finished game: 1 for the winners, 2 for the others; everyone 0 in a draw.
static func ranks(snapshot: XomDaoRoomSnapshot) -> Dictionary:
	var out: Dictionary = {}
	var winners: Array[String] = snapshot.result.winners if snapshot.result != null else []
	for player: XomDaoPlayerInfo in _seated(snapshot):
		if winners.is_empty():
			out[player.id] = 0
		else:
			out[player.id] = 1 if winners.has(player.id) else 2
	return out


## Each player's coins from this game (`core:coin` in the result's rewards).
static func coins(snapshot: XomDaoRoomSnapshot, resource: String = "core:coin") -> Dictionary:
	var out: Dictionary = {}
	if snapshot.result == null:
		return out
	for reward: XomDaoReward in snapshot.result.rewards:
		if reward.resource == resource:
			out[reward.player] = int(out.get(reward.player, 0)) + reward.amount
	return out


static func _seated(snapshot: XomDaoRoomSnapshot) -> Array[XomDaoPlayerInfo]:
	return snapshot.seats if not snapshot.seats.is_empty() else snapshot.players


func _init(settings: XomDaoSettings = null) -> void:
	_settings = settings if settings != null else XomDaoSettings.current()
	name = "Result"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_shade.mouse_filter = Control.MOUSE_FILTER_STOP
	_shade.color = Color(XomDaoUi.INK, 0.18)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.modulate.a = 0.0
	add_child(_shade)
	_board.name = "ResultBoard"
	_board.visible = false
	_board.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_board)
	var column: VBoxContainer = _board.content
	column.add_theme_constant_override("separation", 8)
	_paper = column.get_parent() as PanelContainer
	_emblem.name = "ResultEmblem"
	_emblem.custom_minimum_size = Vector2(0.0, 96.0)
	_emblem.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_emblem.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_emblem.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_emblem.visible = false
	column.add_child(_emblem)
	_title.name = "ResultTitle"
	_title.theme_type_variation = "TitleLabel"
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.add_theme_font_override("font", XomDaoUi.display_font(800))
	_title.add_theme_font_size_override("font_size", 40)
	column.add_child(_title)
	_reason.name = "ResultReason"
	_reason.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_reason.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_reason.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_reason.add_theme_color_override("font_color", XomDaoUi.INK)
	_reason.visible = false
	column.add_child(_reason)
	_rows.name = "ResultRows"
	_rows.columns = 2
	_rows.add_theme_constant_override("h_separation", 24)
	_rows.add_theme_constant_override("v_separation", 4)
	_rows.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_rows.visible = false
	column.add_child(_rows)
	_ranks.add_theme_constant_override("separation", 8)
	column.add_child(_ranks)
	_rewards.name = "ResultRewards"
	_rewards.add_theme_constant_override("separation", 6)
	_rewards.visible = false
	_reward_caption.text = "Phần thưởng"
	_reward_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_rewards.add_child(_reward_caption)
	_reward_tags.alignment = BoxContainer.ALIGNMENT_CENTER
	_reward_tags.add_theme_constant_override("separation", 12)
	_rewards.add_child(_reward_tags)
	column.add_child(_rewards)
	column.add_child(XomDaoDivider.new())
	_button_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_button_row.add_theme_constant_override("separation", 8)
	var home: XomDaoButton = XomDaoButton.create("Về sảnh", XomDaoUi.Kind.BACK)
	home.name = "Home"
	home.pad = 16.0
	home.pressed.connect(home_pressed.emit)
	_button_row.add_child(home)
	var look: XomDaoButton = XomDaoButton.create("Xem bàn", XomDaoUi.Kind.INFO)
	look.name = "ViewBoard"
	look.pad = 16.0
	look.pressed.connect(show_board.bind(true))
	_button_row.add_child(look)
	column.add_child(_button_row)
	_again.name = "Again"
	_again.pad = 20.0
	_again.pressed.connect(again_pressed.emit)
	column.add_child(_again)
	add_child(money)
	_reopen.name = "ShowResult"
	_reopen.visible = false
	_reopen.pressed.connect(show_board.bind(false))
	add_child(_reopen)
	resized.connect(_layout)


func _ready() -> void:
	_layout()


func _unhandled_input(event: InputEvent) -> void:
	if not event.is_action_pressed("ui_cancel") or not is_visible_in_tree():
		return
	if looking():
		show_board(false)
	else:
		home_pressed.emit()
	get_viewport().set_input_as_handled()


## Fills the board for player `me`; `balance` is the coins shown before this game's reward. An
## event's game (`event`) is titled with the event points you got, also shown in Phần thưởng.
## `detail` is the game's `result_detail()`: `{reason: String, rows: [[label, value], …]}`, and
## optionally `ranks` ({player id: rank}, for a game that places everyone, not only the winner)
## and `scores` ({player id: String}, a short figure on that player's row: "15 điểm").
func show_result(
	snapshot: XomDaoRoomSnapshot,
	me: String,
	balance: int,
	event: bool = false,
	detail: Dictionary = {}
) -> void:
	_side_panel = str(detail.get("layout", "")) == "right"
	var table_interactive: bool = _side_panel or _dock_area.is_valid()
	mouse_filter = Control.MOUSE_FILTER_IGNORE if table_interactive else Control.MOUSE_FILTER_STOP
	_shade.mouse_filter = (
		Control.MOUSE_FILTER_IGNORE if table_interactive else Control.MOUSE_FILTER_STOP
	)
	_shade.color = Color(XomDaoUi.INK, 0.18 if _side_panel else 0.45)
	if _shade_color is Color:
		_shade.color = _shade_color
	var column: VBoxContainer = _board.content
	if _side_panel and _again.get_parent() == _button_row:
		_button_row.remove_child(_again)
		column.add_child(_again)
	elif not _side_panel and _again.get_parent() == column:
		column.remove_child(_again)
		_button_row.add_child(_again)
	var winners: Array[String] = snapshot.result.winners if snapshot.result != null else []
	var points: Dictionary = coins(snapshot, "event:point")
	var participant: bool = false
	for player: XomDaoPlayerInfo in _seated(snapshot):
		if player.id == me:
			participant = true
			break
	if event:
		_title.text = (
			"+%d điểm sự kiện" % int(points.get(me, 0)) if participant else "Sự kiện kết thúc"
		)
	elif winners.is_empty():
		_title.text = "Hoà"
	elif winners.has(me):
		_title.text = "Bạn thắng!"
	else:
		_title.text = "%s thắng!" % _name_of(snapshot, winners[0])
	_show_detail(snapshot, detail)
	var rank: Dictionary = ranks(snapshot)
	var placed: Variant = detail.get("ranks")
	if placed is Dictionary:
		for id: Variant in placed:
			if rank.has(str(id)):
				rank[str(id)] = int(placed[id])
	var scores: Variant = detail.get("scores", {})
	var seated: Array[XomDaoPlayerInfo] = _seated(snapshot)
	seated.sort_custom(
		func(a: XomDaoPlayerInfo, b: XomDaoPlayerInfo) -> bool: return rank[a.id] < rank[b.id]
	)
	for player: XomDaoPlayerInfo in seated:
		var row: Control = _row(player, int(rank[player.id]), me)
		if scores is Dictionary and (scores as Dictionary).has(player.id):
			var score := Label.new()
			score.name = "Score"
			score.text = str(scores[player.id])
			score.add_theme_font_override("font", XomDaoUi.display_font(800))
			score.add_theme_color_override("font_color", Color(_ink, 0.78))
			score.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			row.add_child(score)
			row.move_child(score, row.get_child_count() - 2)
		_ranks.add_child(_mine(row) if player.id == me else row)
	_show_rewards(snapshot, me, event)
	_again.visible = snapshot.host_id == me
	money.show_balance(balance)
	_board.visible = true
	_board.modulate.a = 0.0
	_layout.call_deferred()


## Brings the paper result panel in after the game's end beat. Only the paper sound: the
## outcome sound belongs to the end beat (the game's own or HubEndBeat).
func present() -> void:
	_arriving = true
	await get_tree().process_frame
	if not is_inside_tree():
		return
	_layout()
	_stagger_lines(0.16)
	if not _side_panel:
		if _dock_area.is_valid():
			await _settle_docked()
		else:
			await _rise()
		return
	var target: Vector2 = _board.position
	var final_scale: Vector2 = _board.scale
	if _dock_area.is_valid():
		await _settle_docked()
		return
	_presenting = true
	_board.position.x += _board.size.x * final_scale.x + 20.0
	_board.pivot_offset = _board.size / 2.0
	_board.scale = final_scale * 0.96
	_board.modulate.a = 0.0
	_shade.modulate.a = 0.0
	var entrance: Tween = create_tween().set_parallel(true)
	entrance.tween_property(_shade, "modulate:a", 1.0, 0.26)
	entrance.tween_property(_board, "position", target, 0.42).set_trans(Tween.TRANS_CUBIC).set_ease(
		Tween.EASE_OUT
	)
	(
		entrance
		. tween_property(_board, "scale", final_scale, 0.42)
		. set_trans(Tween.TRANS_BACK)
		. set_ease(Tween.EASE_OUT)
	)
	entrance.tween_property(_board, "modulate:a", 1.0, 0.28)
	XomDaoUi.play(self, XomDaoUi.SOUND_PANEL)
	await entrance.finished
	_presenting = false
	_arrived()


## The centred board: the shade fades in while the board rises from below with a slight
## overshoot (about half a second in all).
func _rise() -> void:
	var target: Vector2 = _board.position
	var final_scale: Vector2 = _board.scale
	_presenting = true
	_board.pivot_offset = _board.size / 2.0
	_board.position = target + Vector2(0.0, 72.0)
	_board.scale = final_scale * 0.94
	_board.modulate.a = 0.0
	_shade.modulate.a = 0.0
	XomDaoUi.play(self, XomDaoUi.SOUND_PANEL)
	var entrance: Tween = create_tween().set_parallel(true)
	entrance.tween_property(_shade, "modulate:a", 1.0, 0.2)
	entrance.tween_property(_board, "position", target, 0.34).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)
	(
		entrance
		. tween_property(_board, "scale", final_scale, 0.34)
		. set_trans(Tween.TRANS_BACK)
		. set_ease(Tween.EASE_OUT)
	)
	entrance.tween_property(_board, "modulate:a", 1.0, 0.14)
	_reveal = entrance
	await entrance.finished
	_presenting = false
	_layout()
	_arrived()


## A board docked in the game's area: no shade, it fades in as it rises into place.
func _settle_docked() -> void:
	_shade.visible = false
	_shade.modulate.a = 0.0
	var target: Vector2 = _board.position
	_presenting = true
	_board.position = target + Vector2(0.0, 40.0)
	_board.modulate.a = 0.0
	XomDaoUi.play(self, XomDaoUi.SOUND_PANEL)
	_reveal = create_tween().set_parallel(true)
	_reveal.tween_property(_board, "modulate:a", 1.0, 0.2)
	_reveal.tween_property(_board, "position", target, 0.32).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)
	await _reveal.finished
	_presenting = false
	_layout()
	_arrived()


## The board's lines (emblem, title, figures, ranks, buttons) show one after another.
func _stagger_lines(start: float) -> void:
	var lines: Array[Control] = []
	for child: Node in _board.content.get_children():
		if child is Control and (child as Control).visible:
			lines.append(child as Control)
	for row: Node in _ranks.get_children():
		if row is Control:
			lines.append(row as Control)
	var tween: Tween = create_tween().set_parallel(true)
	for i: int in lines.size():
		var line: Control = lines[i]
		if line == _ranks:
			continue
		line.modulate.a = 0.0
		tween.tween_property(line, "modulate:a", 1.0, 0.14).set_delay(start + 0.035 * i)


## Arrived: coins the ledger paid meanwhile fly now.
func _arrived() -> void:
	_arriving = false
	if _pending_balance >= 0:
		var balance: int = _pending_balance
		_pending_balance = -1
		receive(balance)


## Whether the board is still on its way in.
func arriving() -> bool:
	return _arriving


## Takes a game's optional result hooks: `result_theme()`, `result_reopen_theme()`,
## `result_area()` with `set_result_visible()`, and `set_result_view()` (Xem bàn / Kết quả).
func follow(game: Node) -> void:
	if game.has_method("result_theme"):
		var skin: Variant = game.call("result_theme")
		if skin is Dictionary:
			apply_theme(skin as Dictionary)
	if game.has_method("result_reopen_theme"):
		var reopen_theme: Variant = game.call("result_reopen_theme")
		if reopen_theme is Dictionary:
			set_reopen_theme(reopen_theme as Dictionary)
	if game.has_method("result_area"):
		dock(Callable(game, "result_area"))
		if game.has_method("set_result_visible"):
			board_visibility_changed.connect(Callable(game, "set_result_visible"))
	if game.has_method("set_result_view"):
		board_view_changed.connect(Callable(game, "set_result_view"))


## A game's skin for the board (its `result_theme()`), every key optional: `paper` (the board's
## paper), `ink` (its text), `accent` (the headline and your row), `shade` (the dim behind it,
## alpha included), `title` (in place of "Hết ván"), `emblem` (a Texture2D on top, 96 tall).
## Call it before show_result().
func apply_theme(skin: Dictionary) -> void:
	var paper: Variant = skin.get("paper")
	if paper is Color and _paper != null:
		var inside: StyleBoxFlat = XomDaoUi.box(
			paper, (paper as Color).darkened(0.18), XomDaoUi.BORDER, XomDaoUi.RADIUS - 8.0
		)
		inside.set_content_margin_all(XomDaoUi.PAD)
		_paper.add_theme_stylebox_override("panel", inside)
	var ink: Variant = skin.get("ink")
	if ink is Color:
		_ink = ink
		_reason.add_theme_color_override("font_color", _ink)
	var accent: Variant = skin.get("accent")
	if accent is Color:
		_accent = accent
		_title.add_theme_color_override("font_color", accent as Color)
	var shade: Variant = skin.get("shade")
	if shade is Color:
		_shade_color = shade
		_shade.color = shade
	var heading: Variant = skin.get("title")
	if heading is String and heading != "":
		_board.title = heading
	var emblem: Variant = skin.get("emblem")
	if emblem is Texture2D:
		_emblem.texture = emblem
		_emblem.visible = true


## `true` puts the board away to look at the table, with Kết quả to bring it back.
func show_board(looking: bool) -> void:
	_shade.visible = not looking and not _dock_area.is_valid()
	_board.visible = not looking
	money.visible = not looking
	_reopen.visible = looking
	mouse_filter = (
		Control.MOUSE_FILTER_IGNORE
		if looking or _side_panel or _dock_area.is_valid()
		else Control.MOUSE_FILTER_STOP
	)
	board_view_changed.emit(looking)
	board_visibility_changed.emit(not looking)
	XomDaoUi.play(self, XomDaoUi.SOUND_PANEL)
	_layout.call_deferred()


## Whether the board is put away (Xem bàn).
func looking() -> bool:
	return _reopen.visible


## A game's optional visual treatment for the shared button that reopens its result board.
func set_reopen_theme(theme: Dictionary) -> void:
	_reopen.body.visible = false
	_reopen.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
		var stylebox: Variant = theme.get(state)
		if stylebox is StyleBox:
			_reopen.add_theme_stylebox_override(state, stylebox as StyleBox)
	var label_color: Variant = theme.get("font_color", XomDaoUi.CREAM)
	if label_color is Color:
		for state: String in [
			"font_color", "font_hover_color", "font_pressed_color", "font_disabled_color"
		]:
			_reopen.add_theme_color_override(state, label_color as Color)


## How it ended (the game's words) and the figures: the time played, then the game's rows.
func _show_detail(snapshot: XomDaoRoomSnapshot, detail: Dictionary) -> void:
	var reason: String = str(detail.get("reason", ""))
	_reason.text = reason
	_reason.visible = reason != ""
	for child: Node in _rows.get_children():
		_rows.remove_child(child)
		child.queue_free()
	var rows: Array = []
	if snapshot.played != null and snapshot.played.ms > 0.0:
		rows.append(["Thời gian", played_text(snapshot.played.ms)])
	var extra: Variant = detail.get("rows", [])
	if extra is Array:
		rows.append_array(extra)
	for row: Variant in rows:
		if row is not Array or (row as Array).size() < 2:
			continue
		var pair: Array = row
		var label := Label.new()
		label.text = str(pair[0])
		label.add_theme_color_override(
			"font_color", XomDaoUi.HONEY_DARK if _ink == XomDaoUi.INK else Color(_ink, 0.72)
		)
		_rows.add_child(label)
		var value := Label.new()
		value.text = str(pair[1])
		value.add_theme_color_override("font_color", _ink)
		value.add_theme_font_override("font", XomDaoUi.display_font(800))
		_rows.add_child(value)
	_rows.visible = _rows.get_child_count() > 0


## "12:05" for 12 minutes 5 seconds; "1:02:05" past an hour.
static func played_text(ms: float) -> String:
	var seconds: int = int(ms / 1000.0)
	if seconds >= 3600:
		return "%d:%02d:%02d" % [seconds / 3600, seconds / 60 % 60, seconds % 60]
	return "%d:%02d" % [seconds / 60, seconds % 60]


## The ledger paid: coins fly from your reward into the balance.
func receive(balance: int) -> void:
	if _arriving:
		_pending_balance = balance
		return
	var from: Vector2 = _board.global_position + _board.size / 2.0
	if _reward_at != null and is_instance_valid(_reward_at):
		from = _reward_at.global_position + _reward_at.size / 2.0
	money.receive(balance, from)


func _row(player: XomDaoPlayerInfo, rank: int, me: String) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var place := XomDaoChip.create(
		"Hoà" if rank == 0 else "Hạng %d" % rank,
		"crown" if rank == 1 else "",
		XomDaoUi.GOLD_DARK if rank == 1 else XomDaoUi.HUD
	)
	place.custom_minimum_size.x = (
		96.0 if _side_panel else (110.0 if _dock_area.is_valid() else 150.0)
	)
	place.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(place)
	var avatar := XomDaoAvatar.new()
	avatar.custom_minimum_size = Vector2(48.0, 48.0) if _side_panel else Vector2(64.0, 64.0)
	avatar.initial = player.name
	avatar.frame = player.frame
	avatar.picture = XomDaoLooks.avatar("bot" if player.bot else player.avatar)
	row.add_child(avatar)
	var label := Label.new()
	label.text = "Bạn" if player.id == me else player.name
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_color_override("font_color", _ink)
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.custom_minimum_size.x = 100.0 if _side_panel or _dock_area.is_valid() else 200.0
	row.add_child(label)
	return row


## Phần thưởng: what you got from this game, one icon tag each (xu, then event points in an
## event's game). A reward of 0 gets no tag, and with none the section stays away.
func _show_rewards(snapshot: XomDaoRoomSnapshot, me: String, event: bool) -> void:
	for tag: Node in _reward_tags.get_children():
		_reward_tags.remove_child(tag)
		tag.queue_free()
	_reward_at = null
	_reward_caption.add_theme_color_override(
		"font_color", XomDaoUi.HONEY_DARK if _ink == XomDaoUi.INK else Color(_ink, 0.72)
	)
	var gained: int = int(coins(snapshot).get(me, 0))
	if gained != 0:
		var coin := XomDaoResourceIcon.new()
		coin.custom_minimum_size = Vector2(44.0, 44.0)
		_reward_at = _reward_tag("Reward", gained, coin)
	var points: int = int(coins(snapshot, "event:point").get(me, 0))
	if event and points != 0:
		var flag := TextureRect.new()
		flag.texture = XomDaoUi.icon("flag-banner")
		flag.modulate = XomDaoUi.LACQUER
		flag.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		flag.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		flag.custom_minimum_size = Vector2(40.0, 40.0)
		flag.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		_reward_tag("EventReward", points, flag)
	_rewards.visible = _reward_tags.get_child_count() > 0


func _reward_tag(tag_name: String, amount: int, icon: Control) -> XomDaoDelta:
	var tag := XomDaoDelta.create(amount, icon)
	tag.name = tag_name
	tag.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	(tag.get("_label") as Label).add_theme_font_size_override("font_size", 34)
	_reward_tags.add_child(tag)
	return tag


## Your row, on a soft band of the accent (gold unless the game says otherwise).
func _mine(row: Control) -> Control:
	var tint: Color = _accent if _accent is Color else XomDaoUi.GOLD
	var band := PanelContainer.new()
	band.name = "MyRow"
	var style: StyleBoxFlat = XomDaoUi.box(Color(tint, 0.16), Color(tint, 0.7), 2, 14.0)
	style.content_margin_left = 6.0
	style.content_margin_right = 10.0
	style.content_margin_top = 2.0
	style.content_margin_bottom = 2.0
	band.add_theme_stylebox_override("panel", style)
	band.add_child(row)
	return band


func _name_of(snapshot: XomDaoRoomSnapshot, id: String) -> String:
	for player: XomDaoPlayerInfo in snapshot.seats + snapshot.players:
		if player.id == id:
			return player.name
	return "?"


func _layout() -> void:
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = _settings.margin
	var k: float = _settings.ui_scale
	money.reset_size()
	money.scale = Vector2.ONE * k
	money.position = Vector2(size.x - inset.x - edge - money.size.x * k, inset.y + edge)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var panel_top: float = inset.y + edge + money.size.y * k + 12.0
	var bottom: float = size.y - inset.y - edge
	var available_width: float = maxf(1.0, right - left)
	var available_height: float = maxf(1.0, bottom - panel_top)
	_reopen.reset_size()
	if _side_panel:
		var panel_width: float = minf(500.0, minf(size.x * 0.42, available_width))
		_board.custom_minimum_size.x = panel_width
		_board.reset_size()
		var scale: float = minf(1.0, available_height / maxf(_board.size.y, 1.0))
		scale = minf(scale, panel_width / maxf(_board.size.x, 1.0))
		_board.scale = Vector2.ONE * scale
		_board.pivot_offset = _board.size / 2.0
		var drawn_size: Vector2 = _board.size * scale
		var pivot_shift: Vector2 = _board.pivot_offset * (Vector2.ONE - _board.scale)
		_panel_bounds = Rect2(
			Vector2(right - drawn_size.x, panel_top + (available_height - drawn_size.y) / 2.0),
			drawn_size
		)
		if not _presenting:
			_board.position = _panel_bounds.position - pivot_shift
		_reopen.position = Vector2(right - _reopen.size.x, bottom - _reopen.size.y)
	elif _dock_area.is_valid():
		_board.reset_size()
		var area: Rect2 = _dock_area.call()
		var fit: float = minf(area.size.x / _board.size.x, area.size.y / _board.size.y)
		_board.scale = Vector2.ONE * minf(k, fit)
		if not _presenting:
			_board.position = area.position + (area.size - _board.size * _board.scale) / 2.0
		_reopen.position = Vector2(right - _reopen.size.x, bottom - _reopen.size.y)
	else:
		_board.reset_size()
		if not _presenting:
			# Centred in the safe frame, shrunk to fit it: a tall board (an emblem, the game's
			# rows, six players) never runs off the top or the bottom of the screen.
			var frame_top: float = inset.y + edge
			var room := Vector2(available_width, maxf(1.0, bottom - frame_top))
			var fit: float = minf(room.x / _board.size.x, room.y / _board.size.y)
			_board.pivot_offset = _board.size / 2.0
			_board.scale = Vector2.ONE * minf(1.0, fit)
			var middle := Vector2(size.x / 2.0, frame_top + room.y / 2.0)
			_board.position = middle - _board.size / 2.0
		_reopen.position = Vector2(right - _reopen.size.x, bottom - _reopen.size.y)


## Optional game-provided area for the shared result HUD.
func dock(area: Callable) -> void:
	_dock_area = area
	_shade.visible = false
	if _accent == null:
		_title.add_theme_color_override("font_color", XomDaoUi.LACQUER)
