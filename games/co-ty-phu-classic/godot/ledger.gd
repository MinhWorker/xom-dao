extends Control
## Full-scene ledger: vertical main tabs, horizontal player tabs, object-based pages.

signal acted(event: String, payload: Dictionary)
const Paper := preload("res://content/co-ty-phu-classic/art/ledger-paper.svg")
const Bookmark := preload("res://content/co-ty-phu-classic/art/ledger-bookmark.svg")
const ActiveBookmark := preload("res://content/co-ty-phu-classic/art/ledger-bookmark-active.svg")
const Bank := preload("res://addons/xomdao_sdk/ui/icons/bank.svg")
const Ui := preload("res://content/co-ty-phu-classic/ledger_ui.gd")
const Estate := preload("res://content/co-ty-phu-classic/estate_page.gd")
const Exchange := preload("res://content/co-ty-phu-classic/exchange_page.gd")
var page: int = 0
var viewed_seat: int = -1
var partner: int = -1
var _view: Dictionary = {}
var _me: int = -1
var _names: Array[String] = []
var _slots: Array[XomDaoPlayerSlot] = []
var _blocked: bool = false
var _pending: bool = false
var _book := PanelContainer.new()
var _content := Control.new()
var _players := HBoxContainer.new()
var _estate: Control = Estate.new()
var _exchange: Control = Exchange.new()
var _tabs: Array[XomDaoButton] = []
var _close: XomDaoIconButton = XomDaoIconButton.create("x")
var _bank := TextureButton.new()


func _ready() -> void:
	name = "Ledger"
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_book.add_theme_stylebox_override("panel", Ui.surface(Paper))
	add_child(_book)
	_book.add_child(_content)
	for item: Control in [_estate, _exchange]:
		_content.add_child(item)
		item.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		item.connect(
			"acted", func(event: String, payload: Dictionary) -> void: acted.emit(event, payload)
		)
	_exchange.set("modal_host", self)
	_estate.connect("requested", _request)
	for index: int in 2:
		var button: XomDaoButton = Ui.button(
			"Tài sản" if index == 0 else "Trao đổi",
			"LedgerAssets" if index == 0 else "LedgerTrade",
			XomDaoUi.Kind.SOCIAL
		)
		var caption := Ui.label("Tài sản" if index == 0 else "Trao đổi", 25, XomDaoUi.CREAM)
		caption.name = "Caption"
		caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		caption.position = Vector2(0, 76)
		caption.size = Vector2(148, 32)
		button.text = ""
		button.add_child(caption)
		var symbol := TextureRect.new()
		symbol.name = "Symbol"
		symbol.texture = XomDaoUi.icon("scroll" if index == 0 else "share")
		symbol.modulate = XomDaoUi.CREAM
		symbol.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		symbol.position = Vector2(50, 18)
		symbol.size = Vector2(48, 48)
		symbol.mouse_filter = Control.MOUSE_FILTER_IGNORE
		button.add_child(symbol)
		button.custom_minimum_size = Vector2(148, 116)
		button.pressed.connect(_tab.bind(index))
		add_child(button)
		_tabs.append(button)
	_players.name = "LedgerPlayers"
	_players.add_theme_constant_override("separation", 12)
	add_child(_players)
	_close.name = "CloseLedger"
	_close.pressed.connect(hide)
	add_child(_close)
	_bank.name = "Bankrupt"
	_bank.ignore_texture_size = true
	_bank.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	_bank.texture_normal = Bank
	_bank.texture_hover = Bank
	_bank.texture_pressed = Bank
	_bank.modulate = XomDaoUi.GOLD
	_bank.tooltip_text = "Tuyên bố phá sản"
	_bank.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_bank.focus_mode = Control.FOCUS_NONE
	_bank.mouse_entered.connect(func() -> void: _bank.modulate = XomDaoUi.CREAM)
	_bank.mouse_exited.connect(func() -> void: _bank.modulate = XomDaoUi.GOLD)
	_bank.button_down.connect(XomDaoUi.bounce.bind(_bank))
	_bank.button_down.connect(XomDaoUi.play.bind(_bank, XomDaoUi.SOUND_TAP))
	_bank.pressed.connect(_confirm_bankruptcy)
	add_child(_bank)
	resized.connect(_arrange)
	_arrange()


func refresh(
	view: Dictionary, me: int, names: Array[String], slots: Array[XomDaoPlayerSlot], blocked: bool
) -> void:
	var changed: bool = _view != view or _me != me or _blocked != blocked
	_view = view.duplicate(true)
	_me = me
	_names = names
	_slots = slots
	_blocked = blocked
	if viewed_seat < 0 or viewed_seat >= names.size():
		viewed_seat = maxi(0, me)
	if (
		partner < 0
		or partner == me
		or partner >= names.size()
		or bool(view["players"][partner]["bankrupt"])
	):
		partner = -1
		for i: int in names.size():
			if i != me and not bool(view["players"][i]["bankrupt"]):
				partner = i
				break
	var trade: Variant = view.get("trade")
	var waiting: bool = trade is Dictionary
	if waiting and not _pending and me in [int(trade["from"]), int(trade["to"])]:
		page = 1
		partner = int(trade["to"]) if me == int(trade["from"]) else int(trade["from"])
		_pending = true
		show()
	_pending = waiting
	# Observe completion even when the book is closed so no old offer can return.
	_exchange.get("draft").call("observe", trade)
	if changed and visible:
		_render()


func open(section: int = 0, square: int = -1) -> void:
	page = section
	show()
	_render()
	if square >= 0:
		_estate.call("select", square)


func _tab(index: int) -> void:
	page = index
	_render()


func _request(seat: int, square: int) -> void:
	if seat != _me:
		partner = seat
	page = 1
	_render()
	_exchange.call("choose", 0 if seat == _me else 1, square)


func _render() -> void:
	if not is_node_ready() or _view.is_empty():
		return
	var player: Dictionary = (
		_view["players"][_me] if _me >= 0 and _me < _view["players"].size() else {}
	)
	_bank.visible = (
		_me >= 0 and not bool(player.get("bankrupt", true)) and _view.get("winner") == null
	)
	_bank.disabled = _blocked
	Ui.clear(_players)
	var pending: bool = _view.get("trade") is Dictionary
	for seat: int in _names.size():
		if page == 1 and seat == _me:
			continue
		var selected: bool = seat == (viewed_seat if page == 0 else partner)
		var button: XomDaoButton = Ui.button(
			_names[seat],
			"LedgerPlayer_%d" % seat,
			XomDaoUi.Kind.SOCIAL if selected else XomDaoUi.Kind.BACK
		)
		button.custom_minimum_size = Vector2(150, 88)
		Ui.flat(button, selected)
		if seat < _slots.size():
			_player_border(button, _slots[seat].get("accent"), selected)
		button.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		button.clip_text = true
		if seat < _slots.size():
			button.icon = _slots[seat].picture
		button.disabled = page == 1 and (pending or bool(_view["players"][seat]["bankrupt"]))
		button.pressed.connect(_choose_player.bind(seat))
		_players.add_child(button)
	for index: int in 2:
		var selected: bool = page == index
		_tabs[index].body.hide()
		for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
			_tabs[index].add_theme_stylebox_override(
				state, Ui.surface(ActiveBookmark if selected else Bookmark, 10)
			)
		(_tabs[index].get_node("Caption") as Label).add_theme_color_override(
			"font_color", Ui.INK_DARK if selected else Color("#CBD5E1")
		)
		(_tabs[index].get_node("Symbol") as TextureRect).modulate = (
			Ui.GOLD_TEXT if selected else Color("#CBD5E1")
		)
	_estate.visible = page == 0
	_exchange.visible = page == 1
	_estate.call("refresh", _view, _me, viewed_seat, _blocked)
	_exchange.call("refresh", _view, _me, _names, partner, _blocked)
	_arrange()


func _player_border(button: XomDaoButton, accent: Color, selected: bool) -> void:
	var border: Color = accent.darkened(0.14)
	if not selected:
		border = Color(border, 0.68)
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
		var style: StyleBoxFlat = button.get_theme_stylebox(state).duplicate() as StyleBoxFlat
		style.border_color = border
		style.set_border_width_all(3 if selected else 2)
		button.add_theme_stylebox_override(state, style)


func _choose_player(seat: int) -> void:
	if page == 0:
		viewed_seat = seat
	else:
		partner = seat
	_render()


func _confirm_bankruptcy() -> void:
	if _blocked or _me < 0 or _view.is_empty() or _view.get("winner") != null:
		return
	if bool(_view["players"][_me]["bankrupt"]):
		return
	var shade := ColorRect.new()
	shade.name = "BankruptShade"
	shade.color = Color(XomDaoUi.INK, 0.58)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.add_child(center)
	var confirm: XomDaoBoard = XomDaoBoard.create("Phá sản?", true)
	confirm.name = "ConfirmBankrupt"
	confirm.custom_minimum_size = Vector2(minf(size.x - 48.0, 540.0), 0.0)
	center.add_child(confirm)
	var note := Label.new()
	note.text = (
		"Tài sản sẽ về ngân hàng, số dư của bạn về 0 và bạn bị loại khỏi ván."
		+ " Nếu đang nợ người chơi, họ nhận tiền mặt hiện có tối đa bằng khoản phí."
	)
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.add_theme_font_size_override("font_size", 24)
	confirm.content.add_child(note)
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 16)
	confirm.content.add_child(buttons)
	var stay: XomDaoButton = XomDaoButton.create("Tiếp tục chơi", XomDaoUi.Kind.BACK)
	stay.name = "StayInGame"
	stay.pressed.connect(confirm.close)
	buttons.add_child(stay)
	var declare: XomDaoButton = XomDaoButton.create("Phá sản", XomDaoUi.Kind.DANGER)
	declare.name = "ConfirmBankruptcy"
	declare.pressed.connect(
		func() -> void:
			shade.queue_free()
			acted.emit("bankrupt", {})
	)
	buttons.add_child(declare)
	confirm.closed.connect(shade.queue_free)
	confirm.open()


func _arrange() -> void:
	if not is_node_ready():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var left: float = maxf(20, inset.x)
	var top: float = maxf(20, inset.y)
	_book.position = Vector2(left + 166, top + 96)
	_book.size = Vector2(size.x - _book.position.x - left, size.y - top - _book.position.y)
	_players.position = Vector2(left + 166, top)
	_players.size = Vector2(size.x - left * 2 - 270, 88)
	_close.position = Vector2(size.x - left - 88, top)
	_bank.position = Vector2(42, size.y - 151)
	_bank.size = Vector2(98, 98)
	for index: int in 2:
		_tabs[index].position = Vector2(left, top + 150 + index * 138)
		_tabs[index].size = Vector2(148, 116)
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), XomDaoUi.NAVY)
	var seam: float = _book.position.x - 8
	draw_line(Vector2(seam, 114), Vector2(seam, size.y - 24), XomDaoUi.GOLD, 3)
	draw_texture_rect(Bank, Rect2(46, size.y - 150, 90, 90), false, Color(XomDaoUi.GOLD, 0.25))
