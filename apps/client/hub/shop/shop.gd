class_name HubShop
extends Control
## Chợ (docs/experience.md): the items for sale (not the free ones), each with its price and
## Mua, or "Đã có". Laid out to grow both ways:
## - a row of tabs under the top bar, one per kind of item (`TABS`: Khung, Lưng bài) — more
##   kinds add tabs sideways;
## - a column of filters on the left (`FILTERS`: Tất cả, Chưa có, Đã có) — more groups add
##   rows downwards;
## - a grid of item cards (HubShopCard) that fills the rest and scrolls down.
## Paying and handing the item over are the server's (`shop:buy`): this screen only asks and
## shows.

signal back_pressed
signal buy_requested(item_id: String)

## The kinds of item: slot, label.
const TABS: Array = [["frame", "Khung"], ["card-back", "Lưng bài"]]
## The filters: id, label, icon.
const FILTERS: Array = [
	["all", "Tất cả", "storefront"],
	["new", "Chưa có", "star"],
	["owned", "Đã có", "check-circle"],
]
const TAB_SIZE := Vector2(190.0, 64.0)
const FILTER_SIZE := Vector2(168.0, 112.0)
const GAP := 14.0

var top := HubTopBar.new()
## The tab and the filter that are shown.
var tab: String = "frame"
var filter: String = "all"

var _items: Array[XomDaoShopItem] = []
var _coins: int = 0
var _tabs := HBoxContainer.new()
var _tab_strip := PanelContainer.new()
var _filters := VBoxContainer.new()
var _scroll := ScrollContainer.new()
var _grid := GridContainer.new()
var _empty := Label.new()


func _init(settings: XomDaoSettings = null) -> void:
	name = "Shop"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	var veil := ColorRect.new()
	veil.color = Color(XomDaoUi.NAVY, 0.35)
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	veil.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(veil)
	top = HubTopBar.new(settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	_tab_strip.name = "ShopTabs"
	var strip: StyleBoxFlat = XomDaoUi.box(Color(XomDaoUi.NAVY, 0.94), XomDaoUi.NAVY_LINE, 2, 22.0)
	strip.set_content_margin_all(6.0)
	_tab_strip.add_theme_stylebox_override("panel", strip)
	add_child(_tab_strip)
	_tabs.add_theme_constant_override("separation", 6)
	_tab_strip.add_child(_tabs)
	_filters.name = "ShopFilters"
	_filters.add_theme_constant_override("separation", 10)
	add_child(_filters)
	_scroll.name = "ShopGrid"
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	add_child(_scroll)
	_grid.add_theme_constant_override("h_separation", int(GAP))
	_grid.add_theme_constant_override("v_separation", int(GAP))
	var around := MarginContainer.new()
	around.add_theme_constant_override("margin_bottom", 12)
	around.add_theme_constant_override("margin_right", 6)
	around.add_child(_grid)
	_scroll.add_child(around)
	_empty.name = "ShelfEmpty"
	_empty.text = "Chưa có hàng"
	_empty.theme_type_variation = "HudLabel"
	_empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_empty.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_empty.visible = false
	add_child(_empty)
	_build_choices()
	resized.connect(_layout)


func _ready() -> void:
	_layout()


## The items (`shop:list`) and the balance they are priced against.
func show_items(items: Array[XomDaoShopItem], coins: int) -> void:
	_items = items
	_coins = coins
	_show_grid()


func show_tab(id: String) -> void:
	tab = id
	_restyle()
	_show_grid()


func show_filter(id: String) -> void:
	filter = id
	_restyle()
	_show_grid()


func _build_choices() -> void:
	for entry: Array in TABS:
		var button := Button.new()
		button.name = "Tab_" + str(entry[0])
		button.text = str(entry[1])
		button.custom_minimum_size = TAB_SIZE
		button.add_theme_font_override("font", XomDaoUi.display_font(800))
		button.add_theme_font_size_override("font_size", 30)
		_plain(button)
		button.pressed.connect(show_tab.bind(str(entry[0])))
		_tabs.add_child(button)
	for entry: Array in FILTERS:
		var button := Button.new()
		button.name = "Filter_" + str(entry[0])
		button.text = str(entry[1])
		button.icon = XomDaoUi.icon(str(entry[2]))
		button.custom_minimum_size = FILTER_SIZE
		button.expand_icon = true
		button.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		button.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
		button.add_theme_constant_override("icon_max_width", 44)
		button.add_theme_font_override("font", XomDaoUi.display_font(800))
		button.add_theme_font_size_override("font_size", 26)
		_plain(button)
		button.pressed.connect(show_filter.bind(str(entry[0])))
		_filters.add_child(button)
	_restyle()


func _plain(button: Button) -> void:
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	button.button_down.connect(XomDaoUi.play.bind(button, XomDaoUi.SOUND_TAP))


## The chosen tab is a honey wood plate; the chosen filter a sheet of paper. The others are navy.
func _restyle() -> void:
	for button: Button in _tabs.get_children():
		var on: bool = button.name == "Tab_" + tab
		var fill: Color = XomDaoUi.HONEY if on else Color(XomDaoUi.NAVY, 0.0)
		var edge: Color = XomDaoUi.HONEY_DARK if on else Color(XomDaoUi.NAVY, 0.0)
		_dress(button, XomDaoUi.box(fill, edge, XomDaoUi.BORDER, 16.0), XomDaoUi.CREAM, on)
	for button: Button in _filters.get_children():
		var on: bool = button.name == "Filter_" + filter
		var fill: Color = XomDaoUi.PAPER if on else Color(XomDaoUi.NAVY, 0.94)
		var edge: Color = XomDaoUi.HONEY_DARK if on else XomDaoUi.NAVY_LINE
		var style: StyleBoxFlat = XomDaoUi.box(fill, edge, 2, 20.0)
		style.shadow_color = XomDaoPuff.SHADE
		style.shadow_size = 3
		style.shadow_offset = Vector2(0.0, 4.0)
		style.content_margin_top = 16.0
		style.content_margin_bottom = 10.0
		_dress(button, style, XomDaoUi.INK if on else XomDaoUi.CREAM, on)


func _dress(button: Button, style: StyleBoxFlat, text: Color, on: bool) -> void:
	var hover: StyleBoxFlat = style.duplicate()
	if not on:
		hover.bg_color = Color(XomDaoUi.NAVY_LINE, 0.6)
	for state: String in ["normal", "pressed", "hover_pressed", "disabled"]:
		button.add_theme_stylebox_override(state, style)
	button.add_theme_stylebox_override("hover", hover)
	var shown: Color = text if on else Color(text, 0.8)
	for state: String in ["font_color", "font_hover_color", "font_pressed_color"]:
		button.add_theme_color_override(state, shown)
	for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		button.add_theme_color_override(state, shown)


func _show_grid() -> void:
	for child: Node in _grid.get_children():
		_grid.remove_child(child)
		child.queue_free()
	for item: XomDaoShopItem in _items:
		# Free items belong to everyone: Chợ shows only what is for sale.
		if item.slot != tab or item.price <= 0:
			continue
		if (filter == "new" and item.owned) or (filter == "owned" and not item.owned):
			continue
		_grid.add_child(_card(item))
	_empty.visible = _grid.get_child_count() == 0
	_scroll.scroll_vertical = 0
	_layout()


func _card(item: XomDaoShopItem) -> HubShopCard:
	var card := HubShopCard.create(item)
	if item.owned:
		var chip := XomDaoChip.create("Đã có", "check-circle", XomDaoUi.BAMBOO_DARK)
		chip.name = "Owned_" + HubItemTile.key_of(item.id)
		chip.compact()
		chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		card.foot.add_child(chip)
		return card
	var buy: XomDaoButton = XomDaoButton.create(
		"Mua %s" % XomDaoUi.money(item.price), XomDaoUi.Kind.CONFIRM
	)
	buy.name = "Buy_" + HubItemTile.key_of(item.id)
	buy.pad = 12.0
	buy.custom_minimum_size = Vector2(HubShopCard.SIZE.x - 24.0, 60.0)
	buy.add_theme_font_size_override("font_size", 28)
	if item.price > _coins:
		buy.modulate = Color(1, 1, 1, 0.6)
	buy.pressed.connect(func() -> void: buy_requested.emit(item.id))
	card.foot.add_child(buy)
	return card


## The tabs across the top, the filters down the left, the grid in what is left: as many columns
## as fit.
func _layout() -> void:
	if size.x <= 0.0:
		return
	top._layout()
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = XomDaoSettings.current().margin
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	_tab_strip.reset_size()
	_tab_strip.position = Vector2(left, top.bottom() + 10.0)
	var body_top: float = _tab_strip.position.y + _tab_strip.size.y + GAP
	_filters.reset_size()
	_filters.position = Vector2(left, body_top)
	var grid_left: float = left + FILTER_SIZE.x + GAP + 6.0
	var room: float = maxf(HubShopCard.SIZE.x, right - grid_left)
	_grid.columns = maxi(1, int((room + GAP) / (HubShopCard.SIZE.x + GAP)))
	_scroll.position = Vector2(grid_left, body_top)
	_scroll.size = Vector2(room, maxf(0.0, size.y - body_top))
	_empty.position = _scroll.position
	_empty.size = Vector2(room, 200.0)
