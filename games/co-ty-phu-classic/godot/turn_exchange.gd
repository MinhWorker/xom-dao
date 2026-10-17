extends Control
## A banknote printed on the board: fixed POV cards, conditional icons and engraved transfers.

const Draw := preload("res://content/co-ty-phu-classic/surface_draw.gd")
const Model := preload("res://content/co-ty-phu-classic/banknote_model.gd")
const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const Money := preload("res://content/co-ty-phu-classic/art/hud-money.svg")
const Bus := preload("res://content/co-ty-phu-classic/art/tile-bus.svg")
const Bank := preload("res://content/co-ty-phu-classic/art/bank.svg")
const ICONS: Dictionary = {
	"land": preload("res://addons/xomdao_sdk/ui/icons/scroll.svg"),
	"houses": preload("res://addons/xomdao_sdk/ui/icons/house.svg"),
	"hotels": preload("res://addons/xomdao_sdk/ui/icons/storefront.svg"),
	"stations": Bus,
	"contributing": Bus,
	"jail": preload("res://content/co-ty-phu-classic/art/tile-jail.svg"),
	"power": preload("res://content/co-ty-phu-classic/art/tile-power.svg"),
	"water": preload("res://content/co-ty-phu-classic/art/tile-water.svg"),
	"tickets": preload("res://addons/xomdao_sdk/ui/icons/sign-out.svg")
}
var names: Array[String] = []
var balances: Array[int] = []
var cards: Array[XomDaoPlayerSlot] = []
var acting: int = 0
var busy: bool = false
var order: Array[int] = []
var details: Dictionary = {}
var _font: Font
var _progress: float = 0.0
var _transfer: Dictionary = {}
var _portraits: Array[Texture2D] = []
var _view: Dictionary = {}


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_font = Draw.ink_font()


func refresh(
	seat: int,
	labels: Array[String],
	cash: Array[int],
	figures: Array[Texture2D],
	slots: Array[XomDaoPlayerSlot],
	viewer: int,
	view: Dictionary
) -> void:
	if busy:
		return
	acting = seat
	names = labels.duplicate()
	for index: int in mini(names.size(), slots.size()):
		names[index] = slots[index].player_name
	balances = cash.duplicate()
	_portraits = figures
	cards = slots
	order = Model.seats(viewer, names.size())
	_view = view
	details = Model.summary(view, order[0]) if not order.is_empty() else {}
	queue_redraw()


func play(transfers: Array) -> void:
	busy = true
	for entry: Dictionary in transfers:
		if int(entry.get("amount", 0)) <= 0:
			continue
		_transfer = entry
		_progress = 0.0
		var tween: Tween = create_tween()
		tween.tween_property(self, "_progress", 1.0, 0.8)
		await tween.finished
		for seat: int in balances.size():
			balances[seat] += Model.delta(entry, seat)
		_transfer = {}
		queue_redraw()
		await get_tree().create_timer(0.08).timeout
	busy = false
	queue_redraw()


func _process(_delta: float) -> void:
	if not names.is_empty():
		queue_redraw()


func _draw() -> void:
	if _font == null or order.is_empty():
		return
	draw_set_transform_matrix(Transform2D.IDENTITY)
	_background()
	for index: int in order.size():
		_connection(index)
	_bank()
	for index: int in order.size():
		_player(index)
	_statistics()


func _background() -> void:
	var paper: Color = XomDaoUi.PAPER.lerp(XomDaoUi.SEA_DEEP, 0.055)
	_rect(Rect2(0.184, 0.184, 0.632, 0.178), paper, true)
	_rect(Rect2(0.188, 0.188, 0.624, 0.17), Color(XomDaoUi.SEA_DEEP, 0.25))
	for ring: int in 4:
		var points := PackedVector2Array()
		for step: int in 145:
			var angle: float = step * TAU / 144.0
			var radius: float = 0.052 + ring * 0.003 + sin(angle * 18.0) * 0.002
			points.append(Model.BANK + Vector2.from_angle(angle) * radius)
		_line(points, Color(XomDaoUi.SEA_DEEP, 0.22), 0.65)


func _bank() -> void:
	var ink: Color = XomDaoUi.SEA_DEEP
	if not _transfer.is_empty():
		ink = ink.lerp(XomDaoUi.GOLD, 0.65)
	_ring(Model.BANK, 0.050, Color(ink, 0.25), 3.5)
	_ring(Model.BANK, 0.046, ink, 1.2)
	_picture(Bank, Rect2(Model.BANK - Vector2.ONE * 0.032, Vector2.ONE * 0.064), ink)


func _player(index: int) -> void:
	var seat: int = order[index]
	var bounds: Rect2 = Model.slot(index)
	var players: Array = _view.get("players", [])
	var bankrupt: bool = seat < players.size() and bool(players[seat].get("bankrupt", false))
	var alpha: float = 0.42 if bankrupt else 1.0
	var accent: Color = _accent(seat)
	_panel(bounds, Color(XomDaoUi.PAPER, alpha), Color(accent.darkened(0.25), alpha), 0.003, 1.1)
	_panel(bounds.grow(-0.003), Color.TRANSPARENT, Color(accent, alpha * 0.30), 0.002, 0.6)
	var edge := Vector2(bounds.position.x + 0.005, bounds.position.y + 0.010)
	_line(
		PackedVector2Array([edge, Vector2(edge.x, bounds.end.y - 0.010)]),
		Color(accent, alpha * 0.8),
		2.0
	)
	if seat == acting:
		var remaining: float = (
			float(cards[seat].call("countdown_fraction"))
			if seat < cards.size() and cards[seat].has_method("countdown_fraction")
			else -1.0
		)
		if remaining >= 0.0:
			var ink: Color = XomDaoUi.GOLD if remaining > 0.25 else XomDaoUi.LACQUER
			var path: PackedVector2Array = Model.countdown_path(bounds, remaining)
			_line(path, Color(ink, 0.20), 6.0)
			_line(path, ink, 2.5)
		else:
			var pulse: float = 0.65 + 0.18 * sin(Time.get_ticks_msec() * 0.005)
			_panel(bounds, Color.TRANSPARENT, Color(XomDaoUi.GOLD, pulse), 0.003, 1.8)
	var large: bool = index == 0
	var center: Vector2 = (
		bounds.position + Vector2(0.040 if large else 0.026, 0.037 if large else 0.026)
	)
	_portrait(seat, center, 0.030 if large else 0.021, alpha)
	if not large:
		var band := Rect2(bounds.position + Vector2(0.052, 0.004), Vector2(0.142, 0.019))
		_panel(band, Color(accent, alpha * 0.12), Color.TRANSPARENT, 0.002)
		Draw.text(
			self, _font, names[seat], band.get_center(), 0.020, 0.135, Color(XomDaoUi.INK, alpha)
		)
	_balance(seat, bounds, large, alpha)


func _accent(seat: int) -> Color:
	if seat < cards.size() and "accent" in cards[seat]:
		return cards[seat].get("accent")
	var palette: Array[Color] = [XomDaoUi.LACQUER, XomDaoUi.BLUE, XomDaoUi.BAMBOO, XomDaoUi.GOLD]
	return palette[seat % palette.size()]


func _portrait(seat: int, center: Vector2, radius: float, alpha: float) -> void:
	var accent: Color = _accent(seat)
	_ring(center, radius + 0.0015, Color(XomDaoUi.INK, alpha * 0.45), 1.2)
	_ring(center, radius - 0.0005, Color(accent, alpha * 0.80), 2.4)
	var figure: Texture2D = cards[seat].picture if seat < cards.size() else null
	if figure == null and not _portraits.is_empty():
		figure = _portraits[seat % _portraits.size()]
	if figure != null:
		var inset: float = radius - 0.003
		_picture(
			figure,
			Rect2(center - Vector2.ONE * inset, Vector2.ONE * inset * 2.0),
			Color(1, 1, 1, alpha)
		)
	for tick: int in 3:
		var at: Vector2 = center + Vector2.from_angle(PI * (0.32 + tick * 0.18)) * (radius + 0.0015)
		_ring(at, 0.0015, Color(XomDaoUi.GOLD, alpha), 1.1)


func _balance(seat: int, card: Rect2, large: bool, alpha: float) -> void:
	var bounds := Rect2(card.position + Vector2(0.080, 0.012), Vector2(0.160, 0.050))
	if not large:
		bounds = Rect2(card.position + Vector2(0.055, 0.026), Vector2(0.139, 0.022))
	var accent: Color = _accent(seat)
	var change: int = Model.delta(_transfer, seat)
	if change != 0:
		accent = XomDaoUi.UP if change > 0 else XomDaoUi.DOWN
	_panel(
		bounds,
		Color(XomDaoUi.NAVY, alpha * 0.95),
		Color(accent, alpha * 0.65),
		0.004 if large else 0.002,
		0.9
	)
	var icon_size := Vector2(0.026, 0.0205) if large else Vector2(0.018, 0.0143)
	var icon_at: Vector2 = bounds.position + Vector2(0.008, (bounds.size.y - icon_size.y) / 2.0)
	_picture(Money, Rect2(icon_at, icon_size), Color(1, 1, 1, alpha))
	var text_at: Vector2 = bounds.position + Vector2(0.098 if large else 0.086, bounds.size.y / 2.0)
	var cash: int = Model.balance(balances, _transfer, seat, _progress)
	Draw.text(
		self,
		_font,
		XomDaoUi.money(cash),
		text_at,
		0.036 if large else 0.023,
		0.110 if large else 0.095,
		Color(XomDaoUi.CREAM, alpha)
	)
	if large:
		var y: float = bounds.position.y + 0.005
		_line(
			PackedVector2Array(
				[Vector2(bounds.position.x + 0.008, y), Vector2(bounds.end.x - 0.008, y)]
			),
			Color(XomDaoUi.GOLD, alpha * 0.35),
			0.65
		)


func _statistics() -> void:
	var left: Vector2 = Model.LOCAL.position
	var accent: Color = _accent(order[0])
	for index: int in Model.NUMBERS.size():
		var key: String = Model.NUMBERS[index]
		var bay := Rect2(left + Vector2(0.010 + index * 0.060, 0.074), Vector2(0.054, 0.034))
		_panel(bay, XomDaoUi.PAPER.lerp(accent, 0.09), Color(accent, 0.32), 0.003, 0.65)
		_stat(key, bay.position + Vector2(0.004, 0.016), int(details.get(key, 0)), XomDaoUi.INK)
	var divider_y: float = left.y + 0.116
	_line(
		PackedVector2Array(
			[Vector2(left.x + 0.010, divider_y), Vector2(Model.LOCAL.end.x - 0.010, divider_y)]
		),
		Color(accent, 0.30),
		0.65
	)
	for index: int in Model.STATES.size():
		var key: String = Model.STATES[index]
		if not details.has(key):
			continue
		var bay := Rect2(left + Vector2(0.010 + index * 0.0475, 0.124), Vector2(0.041, 0.027))
		_panel(
			bay,
			XomDaoUi.PAPER.lerp(XomDaoUi.SEA_DEEP, 0.10),
			Color(XomDaoUi.SEA_DEEP, 0.35),
			0.004,
			0.65
		)
		_stat(
			key,
			bay.position + Vector2(0.003, 0.013),
			-1 if key in ["power", "water"] else int(details[key]),
			XomDaoUi.SEA_DEEP
		)


func _stat(key: String, at: Vector2, value: int, ink: Color) -> void:
	var state: bool = key in Model.STATES
	var position: Vector2 = at + (Vector2(0.007, 0) if value < 0 else Vector2.ZERO)
	_picture(ICONS[key], Rect2(position - Vector2(0, 0.0105), Vector2.ONE * 0.021), ink)
	if key == "contributing":
		_ring(position + Vector2(0.017, 0.006), 0.005, XomDaoUi.COIN_DARK, 1.0)
	if value >= 0:
		Draw.text(
			self,
			_font,
			str(value),
			at + Vector2(0.030 if state else 0.036, 0.002),
			0.018 if state else 0.021,
			0.014 if state else 0.018,
			ink
		)


func _panel(bounds: Rect2, fill: Color, ink: Color, cut: float, weight: float = 1.0) -> void:
	var a: Vector2 = bounds.position
	var b: Vector2 = bounds.end
	var uv := PackedVector2Array(
		[
			Vector2(a.x + cut, a.y),
			Vector2(b.x - cut, a.y),
			Vector2(b.x, a.y + cut),
			Vector2(b.x, b.y - cut),
			Vector2(b.x - cut, b.y),
			Vector2(a.x + cut, b.y),
			Vector2(a.x, b.y - cut),
			Vector2(a.x, a.y + cut)
		]
	)
	if fill.a > 0.0:
		draw_set_transform_matrix(Transform2D.IDENTITY)
		var points := PackedVector2Array()
		for point: Vector2 in uv:
			points.append(Rules.plane_point(point) * size)
		draw_colored_polygon(points, fill)
	if ink.a > 0.0:
		uv.append(uv[0])
		_line(uv, ink, weight)


func _path(index: int) -> PackedVector2Array:
	var bounds: Rect2 = Model.slot(index)
	if index == 0:
		return PackedVector2Array(
			[
				Vector2(bounds.end.x, 0.275),
				Vector2(0.452, 0.275),
				Vector2(0.463, 0.286),
				Vector2(0.478, 0.286)
			]
		)
	var y: float = bounds.get_center().y
	var port := Vector2(0.572, 0.275 + (index - 2) * 0.014)
	return PackedVector2Array(
		[Vector2(bounds.position.x, y), Vector2(0.595, y), Vector2(0.585, port.y), port]
	)


func _connection(index: int) -> void:
	var points: PackedVector2Array = _path(index)
	_line(points, Color(XomDaoUi.SEA_DEEP, 0.35), 1.0)
	var seat: int = order[index]
	var sender: bool = Model.endpoint(_transfer, "from") == seat
	var receiver: bool = Model.endpoint(_transfer, "to") == seat
	if _transfer.is_empty() or not (sender or receiver):
		return
	var ink: Color = XomDaoUi.GOLD
	_line(points, Color(ink, 0.17), 6.0)
	_line(points, Color(ink, 0.65), 2.5)
	var both: bool = Model.endpoint(_transfer, "from") >= 0 and Model.endpoint(_transfer, "to") >= 0
	var t: float = _progress
	if both:
		t = clampf(_progress * 2.0 - (1.0 if receiver else 0.0), 0, 1)
	if receiver:
		t = 1.0 - t
	var length: float = 0.0
	for i: int in range(1, points.size()):
		length += points[i - 1].distance_to(points[i])
	var distance: float = t * length
	for i: int in range(1, points.size()):
		var segment: float = points[i - 1].distance_to(points[i])
		if distance <= segment:
			_ring(
				points[i - 1].lerp(points[i], distance / maxf(segment, 0.00001)), 0.0032, ink, 2.0
			)
			break
		distance -= segment


func _rect(bounds: Rect2, ink: Color, fill: bool = false, weight: float = 1.0) -> void:
	draw_set_transform_matrix(Transform2D.IDENTITY)
	var points: PackedVector2Array = Draw.quad(bounds, size)
	if fill:
		draw_colored_polygon(points, ink)
	else:
		points.append(points[0])
		draw_polyline(points, ink, maxf(0.5, weight * size.x / 1000.0), true)


func _line(uv: PackedVector2Array, ink: Color, weight: float) -> void:
	draw_set_transform_matrix(Transform2D.IDENTITY)
	var points := PackedVector2Array()
	for point: Vector2 in uv:
		points.append(Rules.plane_point(point) * size)
	draw_polyline(points, ink, maxf(0.5, weight * size.x / 1000.0), true)


func _ring(at: Vector2, radius: float, ink: Color, weight: float) -> void:
	var points := PackedVector2Array()
	for step: int in 65:
		points.append(at + Vector2.from_angle(step * TAU / 64.0) * radius)
	_line(points, ink, weight)


func _picture(texture: Texture2D, bounds: Rect2, ink: Color) -> void:
	draw_set_transform_matrix(Transform2D.IDENTITY)
	draw_polygon(
		Draw.quad(bounds, size),
		PackedColorArray([ink]),
		PackedVector2Array([Vector2.ZERO, Vector2.RIGHT, Vector2.ONE, Vector2.DOWN]),
		texture
	)
