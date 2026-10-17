extends XomDaoButton
## A tangible deed, utility, station or ticket; click and drag share the same selection.

const Paper := preload("res://content/co-ty-phu-classic/art/deed-paper.svg")
const Ui := preload("res://content/co-ty-phu-classic/ledger_ui.gd")
const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const Money := preload("res://content/co-ty-phu-classic/art/hud-money.svg")
const Check := preload("res://addons/xomdao_sdk/ui/icons/check-circle.svg")
const Lock := preload("res://addons/xomdao_sdk/ui/icons/lock-simple.svg")
const House := preload("res://addons/xomdao_sdk/ui/icons/house.svg")
const Hotel := preload("res://addons/xomdao_sdk/ui/icons/storefront.svg")
const ICONS: Dictionary = {
	"street": preload("res://content/co-ty-phu-classic/art/tile-house.svg"),
	"station": preload("res://content/co-ty-phu-classic/art/tile-bus.svg"),
	"utility": preload("res://content/co-ty-phu-classic/art/tile-power.svg"),
	"water": preload("res://content/co-ty-phu-classic/art/tile-water.svg"),
	"ticket": preload("res://addons/xomdao_sdk/ui/icons/sign-out.svg")
}
var square: int = -1
var owner_seat: int = -1
var picked: bool = false
var draggable: bool = false
var drag_side: int = 0
var deed: Dictionary = {}
var contribution: int = 0
var _font: Font = XomDaoUi.display_font(800)


func _init() -> void:
	super()
	custom_minimum_size = Vector2(116, 168)
	body.face = Color.WHITE
	body.edge = Ui.CARD_BORDER
	body.radius = 12
	body.depth = 4
	body.lit = false
	body.hide()


func configure(i: int, seat: int, property: Dictionary, selected: bool = false) -> void:
	square = i
	owner_seat = seat
	deed = property
	picked = selected
	body.edge = Ui.GOLD_ACCENT if picked else Ui.CARD_BORDER
	body.border = 3 if picked else 2
	queue_redraw()


func _get_drag_data(_at: Vector2) -> Variant:
	if not draggable or disabled:
		return null
	var preview: Control = get_script().new()
	preview.call("configure", square, owner_seat, deed, true)
	preview.custom_minimum_size = Vector2(116, 168)
	preview.size = preview.custom_minimum_size
	set_drag_preview(preview)
	return {"estate": square, "seat": owner_seat, "side": drag_side}


func _draw() -> void:
	draw_style_box(Ui.surface(Paper, 12), Rect2(Vector2.ZERO, size))
	if picked:
		draw_style_box(
			XomDaoUi.box(Color.TRANSPARENT, Ui.GOLD_ACCENT, 3, 12.0), Rect2(Vector2.ZERO, size)
		)
	if square == -1:
		var slot_box: StyleBoxFlat = XomDaoUi.box(
			Color(1, 1, 1, 0.4), Color(Ui.CARD_BORDER, 0.8), 2, 12.0
		)
		draw_style_box(slot_box, Rect2(Vector2.ZERO, size))
		_text("+", Vector2(size.x / 2, size.y / 2 - 6), 34, Ui.INK_MUTED)
		_text("Chọn thẻ", Vector2(size.x / 2, size.y / 2 + 18), 16, Ui.INK_MUTED)
		return
	var cell: Dictionary = (
		Rules.SQUARES[square] if square >= 0 else {"name": "Vé ra tù", "kind": "ticket"}
	)
	var tint: Color = Rules.GROUP_COLORS.get(str(cell.get("group", "")), XomDaoUi.SEA_DEEP)

	# Top banner
	var banner_height: float = clampf(size.y * 0.17, 26.0, 34.0)
	var banner_box: StyleBoxFlat = XomDaoUi.box(tint, tint, 0, 10.0)
	banner_box.corner_radius_bottom_left = 4
	banner_box.corner_radius_bottom_right = 4
	draw_style_box(banner_box, Rect2(4, 4, size.x - 8, banner_height))

	# Houses badge or Station contribution
	var houses: int = int(deed.get("houses", 0))
	if houses > 0:
		var icon_of: Texture2D = Hotel if houses == 5 else House
		var badge_rect := Rect2(8, 6, 36, banner_height - 4)
		draw_style_box(XomDaoUi.box(Color(0, 0, 0, 0.4), Color.TRANSPARENT, 0, 6), badge_rect)
		draw_texture_rect(icon_of, Rect2(11, 8, 16, 16), false, Color.WHITE)
		_text("1" if houses == 5 else str(houses), Vector2(34, 21), 16, Color.WHITE)
	elif contribution > 0:
		var bid_rect := Rect2(8, 6, 42, banner_height - 4)
		draw_style_box(XomDaoUi.box(Color(0, 0, 0, 0.4), Color.TRANSPARENT, 0, 6), bid_rect)
		_text("+" + str(contribution), Vector2(29, 21), 15, Color.WHITE)

	# Property name
	var heading: String = str(cell["name"])
	var words: PackedStringArray = heading.split(" ")
	var text_y: float = banner_height + 6
	if heading.length() > 8 and words.size() > 1:
		var last: String = words[-1]
		words.remove_at(words.size() - 1)
		_text(" ".join(words), Vector2(size.x / 2, text_y + 16), 19, Ui.INK_DARK)
		_text(last, Vector2(size.x / 2, text_y + 36), 19, Ui.INK_DARK)
	else:
		_text(heading, Vector2(size.x / 2, text_y + 22), 20, Ui.INK_DARK)

	# Property center icon with soft pastel circular backdrop
	var kind_of: String = "water" if square == 28 else str(cell["kind"])
	var symbol: Texture2D = ICONS[kind_of]
	var icon_size: float = clampf(size.x * 0.36, 36.0, 48.0)
	var icon_cy: float = (text_y + 44 + (size.y - 34)) / 2.0
	draw_circle(
		Vector2(size.x / 2, icon_cy), icon_size / 2.0 + 3, Color(tint.r, tint.g, tint.b, 0.12)
	)
	var icon_tint: Color = tint if tint.get_luminance() < 0.65 else tint.darkened(0.35)
	draw_texture_rect(
		symbol,
		Rect2(size.x / 2 - icon_size / 2, icon_cy - icon_size / 2, icon_size, icon_size),
		false,
		icon_tint
	)

	# Bottom price row with golden coin & bold price
	var amount: int = 200 if square == -2 else Rules.price(square)
	var coin_w: float = 24.0
	var coin_h: float = 19.0
	var price_y: float = size.y - 28.0
	draw_texture_rect(Money, Rect2(12, price_y, coin_w, coin_h), false, Color.WHITE)
	_text(XomDaoUi.money(amount), Vector2(size.x / 2 + 13, price_y + 14), 22, Ui.GOLD_TEXT)

	# Mortgaged state
	if bool(deed.get("mortgaged", false)):
		draw_rect(Rect2(4, 4, size.x - 8, size.y - 8), Color(0.1, 0.1, 0.15, 0.45))
		var badge := Rect2(6, size.y / 2 - 13, size.x - 12, 26)
		draw_style_box(XomDaoUi.box(XomDaoUi.LACQUER, XomDaoUi.LACQUER_DARK, 1, 6), badge)
		draw_texture_rect(Lock, Rect2(10, size.y / 2 - 9, 18, 18), false, Color.WHITE)
		_text("THẾ CHẤP", Vector2(size.x / 2 + 10, size.y / 2 + 6), 15, Color.WHITE)

	# Picked checkmark
	if picked:
		draw_texture_rect(Check, Rect2(size.x - 26, 6, 20, 20), false, Ui.GOLD_ACCENT)


func _text(value: String, at: Vector2, pixels: int, ink: Color = Ui.INK_DARK) -> void:
	var width: float = _font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, pixels).x
	draw_string(
		_font, at - Vector2(width / 2, 0), value, HORIZONTAL_ALIGNMENT_LEFT, -1, pixels, ink
	)
