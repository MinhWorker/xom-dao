extends VBoxContainer
## Two offer trays, two inventories and one proposal; no history or parallel drafts.

signal acted(event: String, payload: Dictionary)
const Ui := preload("res://content/co-ty-phu-classic/ledger_ui.gd")
const Card := preload("res://content/co-ty-phu-classic/estate_card.gd")
const Draft := preload("res://content/co-ty-phu-classic/trade_draft.gd")
const Tray := preload("res://content/co-ty-phu-classic/offer_tray.gd")
const Pad := preload("res://content/co-ty-phu-classic/money_pad.gd")
const Money := preload("res://content/co-ty-phu-classic/art/cash-pile.svg")
const Mat := preload("res://content/co-ty-phu-classic/art/offer-mat.svg")
var modal_host: Control
var draft: RefCounted = Draft.new()
var _view: Dictionary = {}
var _me: int = -1
var _names: Array[String] = []
var _blocked: bool = false
var _sides := HBoxContainer.new()
var _footer := HBoxContainer.new()


func _ready() -> void:
	add_theme_constant_override("separation", 16)
	_sides.add_theme_constant_override("separation", 24)
	_sides.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(_sides)
	_footer.alignment = BoxContainer.ALIGNMENT_CENTER
	_footer.add_theme_constant_override("separation", 18)
	add_child(_footer)


func refresh(view: Dictionary, me: int, names: Array[String], partner: int, blocked: bool) -> void:
	_view = view
	_me = me
	_names = names
	_blocked = blocked
	var pending: Variant = view.get("trade")
	draft.call("observe", pending)
	if pending is not Dictionary and int(draft.get("partner")) != partner:
		draft.call("reset")
		draft.set("partner", partner)
	_redraw()


func choose(side: int, square: int) -> void:
	draft.call("choose", side, square, _view.get("properties", []))
	_redraw()


func _redraw() -> void:
	if not is_node_ready():
		return
	Ui.clear(_sides)
	Ui.clear(_footer)
	var trade: Variant = _view.get("trade")
	var from: int = int(trade["from"]) if trade is Dictionary else _me
	var to: int = int(trade["to"]) if trade is Dictionary else int(draft.get("partner"))
	_side(0, from)
	_side(1, to)
	if trade is Dictionary:
		if _me == to:
			_button("Đồng ý", "Accept", "accept-trade", XomDaoUi.Kind.CONFIRM)
		if _me in [from, to]:
			_button(
				"Hủy đề nghị" if _me == from else "Từ chối",
				"Decline",
				"decline-trade",
				XomDaoUi.Kind.DANGER
			)
		else:
			_footer.add_child(Ui.label("Đang chờ phản hồi...", 24, Ui.GOLD_TEXT))
	else:
		var reset: XomDaoIconButton = XomDaoIconButton.create("")
		reset.name = "ResetTrade"
		reset.icon = preload("res://content/co-ty-phu-classic/art/ledger-reset.svg")
		reset.disabled = _blocked
		reset.pressed.connect(
			func() -> void:
				draft.call("reset")
				_redraw()
		)
		_footer.add_child(reset)
		var send: XomDaoButton = Ui.button("Gửi đề nghị", "SendTrade", XomDaoUi.Kind.CONFIRM)
		send.custom_minimum_size = Vector2(160, 52)
		send.disabled = _blocked or not bool(draft.call("valid", _view, _me))
		send.pressed.connect(func() -> void: acted.emit("offer-trade", draft.call("payload")))
		_footer.add_child(send)


func _side(side: int, seat: int) -> void:
	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_theme_constant_override("separation", 10)
	_sides.add_child(column)
	if seat < 0 or seat >= _names.size():
		return
	var pending: bool = bool(draft.get("pending"))
	var header_text: String = "Bạn đề nghị" if seat == _me else ("Đối tác: " + _names[seat])
	var title: Label = Ui.label(header_text, 24, Ui.INK_DARK)
	column.add_child(title)

	var tray: PanelContainer = Tray.new()
	tray.name = "OfferTray_%d" % side
	tray.set("seat", seat)
	tray.set("side", side)
	tray.set("locked", pending or _blocked)
	_connect_tray(tray, side)
	tray.add_theme_stylebox_override("panel", Ui.surface(Mat, 16))
	column.add_child(tray)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	tray.add_child(row)

	var square: int = int(draft.get("give" if side == 0 else "take"))
	var card: XomDaoButton = Card.new()
	card.name = "Offered_%d" % side
	card.custom_minimum_size = Vector2(116, 168)
	card.call(
		"configure", square, seat, _view["properties"][square] if square >= 0 else {}, square != -1
	)
	card.disabled = pending or _blocked or square == -1
	card.pressed.connect(choose.bind(side, square))
	row.add_child(card)

	var money := VBoxContainer.new()
	money.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	money.alignment = BoxContainer.ALIGNMENT_CENTER
	money.add_theme_constant_override("separation", 8)
	row.add_child(money)

	var amount: int = int(draft.get("give_cash" if side == 0 else "take_cash"))
	var cash: XomDaoButton = Ui.button(
		XomDaoUi.money(amount), "TradeCash_%d" % side, XomDaoUi.Kind.INFO
	)
	var cash_box: StyleBoxFlat = XomDaoUi.box(Color.WHITE, Ui.CARD_BORDER, 2, 10)
	cash_box.set_content_margin_all(8)
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
		cash.add_theme_stylebox_override(state, cash_box)
	for state: String in [
		"font_color", "font_hover_color", "font_pressed_color", "font_disabled_color"
	]:
		cash.add_theme_color_override(state, Ui.INK_DARK)
	for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		cash.add_theme_color_override(state, Color.WHITE)

	cash.add_theme_font_size_override("font_size", 30)
	cash.add_theme_constant_override("icon_max_width", 54)
	cash.icon = Money
	cash.disabled = (
		pending or _blocked or int(draft.get("give")) == -2 or int(draft.get("take")) == -2
	)
	cash.pressed.connect(_cash_pad.bind(side, seat))
	money.add_child(cash)

	var balance: int = (
		int(_view["players"][seat]["cash"])
		- amount
		+ int(draft.get("take_cash" if side == 0 else "give_cash"))
	)
	var after: Label = Ui.label(
		"Số dư: " + XomDaoUi.money(balance), 20, Ui.GREEN_TEXT if balance >= 0 else Ui.RED_TEXT
	)
	money.add_child(after)

	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(scroll)

	var inventory := HFlowContainer.new()
	inventory.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inventory.add_theme_constant_override("h_separation", 10)
	inventory.add_theme_constant_override("v_separation", 10)
	scroll.add_child(inventory)

	for i: int in 40:
		var deed: Dictionary = _view["properties"][i]
		if deed.get("owner") != seat:
			continue
		_inventory_card(inventory, side, seat, i, deed, pending)
	if not (_view["players"][seat]["freeCards"] as Array).is_empty():
		_inventory_card(inventory, side, seat, -2, {}, pending)


func _connect_tray(tray: Control, side: int) -> void:
	tray.connect(
		"dropped",
		func(square: int) -> void:
			if square != int(draft.get("give" if side == 0 else "take")):
				choose(side, square)
	)


func _inventory_card(
	container: Control, side: int, seat: int, square: int, deed: Dictionary, pending: bool
) -> void:
	var card: XomDaoButton = Card.new()
	card.name = "Trade%s_%d" % ["Give" if side == 0 else "Take", square]
	card.custom_minimum_size = Vector2(116, 168)
	card.call(
		"configure", square, seat, deed, square == int(draft.get("give" if side == 0 else "take"))
	)
	card.disabled = pending or _blocked or int(deed.get("houses", 0)) > 0
	card.modulate.a = 0.5 if card.disabled else 1.0
	card.set("draggable", not card.disabled)
	card.set("drag_side", side)
	card.pressed.connect(choose.bind(side, square))
	container.add_child(card)


func _cash_pad(side: int, seat: int) -> void:
	var pad: Control = Pad.new()
	pad.name = "TradeMoneyPad"
	pad.set("amount", int(draft.get("give_cash" if side == 0 else "take_cash")))
	pad.set("maximum", mini(100000, int(_view["players"][seat]["cash"])))
	pad.connect(
		"chosen",
		func(amount: int) -> void:
			draft.set("give_cash" if side == 0 else "take_cash", amount)
			_redraw()
	)
	modal_host.add_child(pad)


func _button(title: String, id: String, event: String, kind: XomDaoUi.Kind) -> void:
	var button: XomDaoButton = Ui.button(title, id, kind)
	button.custom_minimum_size = Vector2(160, 52)
	button.disabled = _blocked
	button.pressed.connect(func() -> void: acted.emit(event, {}))
	_footer.add_child(button)
