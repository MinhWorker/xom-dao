extends HBoxContainer
## Browse grouped deeds, select a physical card, then use its available actions.

signal acted(event: String, payload: Dictionary)
signal requested(seat: int, square: int)
const Ui := preload("res://content/co-ty-phu-classic/ledger_ui.gd")
const Card := preload("res://content/co-ty-phu-classic/estate_card.gd")
const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const Actions := preload("res://content/co-ty-phu-classic/actions.gd")
const Money := preload("res://content/co-ty-phu-classic/art/hud-money.svg")
var seat: int = -1
var selected: int = -1
var mode: String = ""
var picked: Array[int] = []
var _view: Dictionary = {}
var _me: int = -1
var _blocked: bool = false
var _catalog := VBoxContainer.new()
var _detail := VBoxContainer.new()
var _group_grid := GridContainer.new()


func _ready() -> void:
	add_theme_constant_override("separation", 24)
	var scroll := ScrollContainer.new()
	scroll.name = "EstateScroll"
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_child(scroll)
	_catalog.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_catalog.add_theme_constant_override("separation", 18)
	scroll.add_child(_catalog)
	_group_grid.columns = 2
	_group_grid.add_theme_constant_override("h_separation", 20)
	_group_grid.add_theme_constant_override("v_separation", 20)
	_catalog.add_child(_group_grid)
	_detail.custom_minimum_size.x = 240
	_detail.add_theme_constant_override("separation", 14)
	add_child(_detail)


func refresh(view: Dictionary, me: int, owner_seat: int, blocked: bool) -> void:
	_view = view
	_me = me
	_blocked = blocked
	if seat != owner_seat:
		selected = -1
		mode = ""
		picked.clear()
	seat = owner_seat
	if selected >= 0 and view["properties"][selected].get("owner") != seat:
		selected = -1
	for square: int in picked.duplicate():
		if square not in Rules.mortgage_squares(view["properties"], seat):
			picked.erase(square)
	_redraw()


func select(square: int) -> void:
	selected = square
	if mode == "mortgage" and square in Rules.mortgage_squares(_view["properties"], seat):
		if square in picked:
			picked.erase(square)
		else:
			picked.append(square)
	_redraw()


func _redraw() -> void:
	if not is_node_ready() or _view.is_empty():
		return
	Ui.clear(_group_grid)
	Ui.clear(_detail)
	var groups: Dictionary = {}
	for i: int in 40:
		var deed: Dictionary = _view["properties"][i]
		var stations: Dictionary = _view.get("stationAuctions", {})
		var station: Dictionary = stations.get(str(i), stations.get(i, {}))
		if _view.get("auction") is Dictionary and int(_view["auction"]["square"]) == i:
			station = _view["auction"]
		var deposit: int = int(station.get("bids", [0, 0, 0, 0])[seat]) if seat >= 0 else 0
		if deed.get("owner") != seat and deposit <= 0:
			continue
		var key: String = str(Rules.SQUARES[i].get("group", Rules.SQUARES[i]["kind"]))
		if not groups.has(key):
			groups[key] = []
		if (groups[key] as Array).size() == 3:
			key += "_extra"
			if not groups.has(key):
				groups[key] = []
		groups[key].append([i, deposit])
	if seat >= 0 and not (_view["players"][seat]["freeCards"] as Array).is_empty():
		groups["ticket"] = [[-2, 0]]
	for key: String in groups:
		var group := VBoxContainer.new()
		group.add_theme_constant_override("separation", 8)
		_group_grid.add_child(group)
		var rail := HBoxContainer.new()
		rail.add_theme_constant_override("separation", 10)
		group.add_child(rail)
		for entry: Array in groups[key]:
			var square: int = int(entry[0])
			var card: XomDaoButton = Card.new()
			card.custom_minimum_size = Vector2(116, 168)
			card.name = "Estate_%d" % square
			card.call(
				"configure",
				square,
				seat,
				_view["properties"][square] if square >= 0 else {},
				square in picked if mode != "" else square == selected
			)
			card.set("contribution", int(entry[1]))
			card.pressed.connect(select.bind(square))
			rail.add_child(card)
		var count: int = (groups[key] as Array).size()
		var full: bool = (
			key in Rules.GROUP_COLORS and count == Rules.group_of(int(groups[key][0][0])).size()
		)
		var strip := Panel.new()
		strip.custom_minimum_size.y = 5
		var strip_box: StyleBoxFlat = XomDaoUi.box(
			Ui.GOLD_ACCENT if full else Color(Ui.CARD_BORDER, 0.6), Color.TRANSPARENT, 0, 3.0
		)
		strip.add_theme_stylebox_override("panel", strip_box)
		group.add_child(strip)
	if groups.is_empty():
		var empty_box := VBoxContainer.new()
		empty_box.alignment = BoxContainer.ALIGNMENT_CENTER
		empty_box.custom_minimum_size = Vector2(300, 260)
		empty_box.add_theme_constant_override("separation", 12)
		_group_grid.add_child(empty_box)
		var empty := TextureRect.new()
		empty.texture = XomDaoUi.icon("scroll")
		empty.modulate = Ui.INK_LIGHT
		empty.custom_minimum_size = Vector2(80, 80)
		empty.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		empty.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		empty_box.add_child(empty)
		empty_box.add_child(Ui.label("Chưa sở hữu tài sản nào", 22, Ui.INK_MUTED))
	_details()


func _details() -> void:
	if selected == -1:
		var empty_panel := VBoxContainer.new()
		empty_panel.alignment = BoxContainer.ALIGNMENT_CENTER
		empty_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
		empty_panel.add_theme_constant_override("separation", 16)
		_detail.add_child(empty_panel)
		var emblem := TextureRect.new()
		emblem.texture = XomDaoUi.icon("bank")
		emblem.modulate = Ui.INK_LIGHT
		emblem.custom_minimum_size = Vector2(80, 80)
		emblem.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		emblem.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		empty_panel.add_child(emblem)
		var hint := Ui.label("Chọn một tài sản để xem", 20, Ui.INK_MUTED)
		hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		empty_panel.add_child(hint)
		if seat == _me and Actions.may_mortgage(_view, _me):
			_action("Thế chấp", "EstateMortgage", _batch, XomDaoUi.Kind.INFO)
		return

	# Card preview container
	var preview_center := CenterContainer.new()
	_detail.add_child(preview_center)
	var card: XomDaoButton = Card.new()
	card.custom_minimum_size = Vector2(136, 196)
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.call("configure", selected, seat, _view["properties"][selected] if selected >= 0 else {})
	preview_center.add_child(card)

	# Stats banner
	var stats_panel := PanelContainer.new()
	var stats_box: StyleBoxFlat = XomDaoUi.box(Color("#F5EFE4"), Ui.CARD_BORDER, 1, 10)
	stats_box.set_content_margin_all(10)
	stats_panel.add_theme_stylebox_override("panel", stats_box)
	_detail.add_child(stats_panel)

	var stats := HBoxContainer.new()
	stats.alignment = BoxContainer.ALIGNMENT_CENTER
	stats.add_theme_constant_override("separation", 10)
	stats_panel.add_child(stats)

	var current_rent: int = (
		Rules.rent(_view, selected, 7) if selected >= 0 and Rules.is_deed(selected) else 0
	)
	var multiplier: int = Rules.rent_multiplier(_view, selected) if selected >= 0 else 1
	var rent: int = current_rent / multiplier if current_rent > 0 else 0
	var rent_text: String = XomDaoUi.money(rent)
	if current_rent > 0 and multiplier > 1:
		rent_text += " ×%d" % multiplier
	var rent_title := Ui.label("Tiền thuê:", 20, Ui.INK_MUTED)
	stats.add_child(rent_title)
	var rent_icon := TextureRect.new()
	rent_icon.texture = Money
	rent_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rent_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	rent_icon.custom_minimum_size = Vector2(24, 20)
	stats.add_child(rent_icon)
	stats.add_child(Ui.label(rent_text, 24, Ui.GOLD_TEXT))

	if selected == -2:
		_action(
			"Trao đổi",
			"EstateRequest",
			func() -> void: requested.emit(seat, selected),
			XomDaoUi.Kind.SOCIAL,
			(
				_blocked
				or _me < 0
				or int(_view["turn"]) != _me
				or str(_view["phase"]) not in ["roll", "buy", "end"]
			)
		)
		return

	var deed: Dictionary = _view["properties"][selected]
	if deed.get("mortgage") is Dictionary:
		var loan: Dictionary = deed["mortgage"]
		var borrower: int = int(loan["borrower"])
		var left: int = maxi(0, int(loan["deadline"]) - int(_view["playerTurns"][borrower]))
		var clock_box := HBoxContainer.new()
		clock_box.alignment = BoxContainer.ALIGNMENT_CENTER
		clock_box.add_theme_constant_override("separation", 8)
		_detail.add_child(clock_box)
		var clock := TextureRect.new()
		clock.texture = XomDaoUi.icon("clock")
		clock.modulate = Ui.RED_TEXT
		clock.custom_minimum_size = Vector2(20, 20)
		clock.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		clock_box.add_child(clock)
		clock_box.add_child(Ui.label("Còn %d lượt" % left, 20, Ui.RED_TEXT))

	if mode == "mortgage":
		var total: int = 0
		for square: int in picked:
			total += Rules.mortgage_amount(_view["properties"], square)
		_action(
			"+" + XomDaoUi.money(total),
			"EstateCommit",
			_commit,
			XomDaoUi.Kind.CONFIRM,
			picked.is_empty() or _blocked
		)
		_action("Hủy", "EstateCancel", _cancel, XomDaoUi.Kind.BACK)
	elif seat == _me:
		for action: Array in Actions.deed_actions(_view, _me, selected):
			var id: String = str(action[0])
			var title: String = (
				{"SellHouse": "Bán nhà", "Redeem": "Chuộc", "Mortgage": "Thế chấp"}.get(id, id)
			)
			var kind: XomDaoUi.Kind = XomDaoUi.Kind.INFO
			if id == "SellHouse":
				kind = XomDaoUi.Kind.DANGER
			elif id == "Redeem":
				kind = XomDaoUi.Kind.CONFIRM

			if id == "Mortgage":
				_action(title, "EstateMortgage", _batch, kind, _blocked or not bool(action[2]))
			else:
				var event: String = "sell-house" if id == "SellHouse" else "redeem"
				_action(
					title, "Estate" + id, _emit.bind(event), kind, _blocked or not bool(action[2])
				)
		for action: Array in Actions.phase_actions(_view, _me):
			if action[0] == "Build" and _view.get("buildable") == selected:
				_action(
					"Xây nhà",
					"EstateBuild",
					_emit.bind("build"),
					XomDaoUi.Kind.CONFIRM,
					_blocked or not bool(action[2])
				)
	elif not bool(deed.get("houses", 0)) and deed.get("owner") == seat:
		_action(
			"Trao đổi",
			"EstateRequest",
			func() -> void: requested.emit(seat, selected),
			XomDaoUi.Kind.SOCIAL,
			(
				_me < 0
				or _blocked
				or int(_view["turn"]) != _me
				or str(_view["phase"]) not in ["roll", "buy", "end"]
			)
		)


func _action(
	title: String,
	id: String,
	callback: Callable,
	kind: XomDaoUi.Kind = XomDaoUi.Kind.INFO,
	disabled: bool = false
) -> void:
	var button: XomDaoButton = Ui.button(title, id, kind)
	button.custom_minimum_size = Vector2(220, 54)
	button.disabled = disabled
	button.modulate.a = 0.5 if disabled else 1.0
	button.pressed.connect(callback)
	_detail.add_child(button)


func _batch() -> void:
	mode = "mortgage"
	picked.clear()
	if selected in Rules.mortgage_squares(_view["properties"], seat):
		picked.append(selected)
	_redraw()


func _cancel() -> void:
	mode = ""
	picked.clear()
	_redraw()


func _commit() -> void:
	if picked.is_empty():
		return
	acted.emit("mortgage", {"squares": picked.duplicate()})
	_cancel()


func _emit(event: String) -> void:
	acted.emit(event, {"square": selected})
