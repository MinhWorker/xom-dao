extends Control
## Two physical card piles and a stable pair of thin, surface-attached action buttons.

const Draw := preload("res://content/co-ty-phu-classic/surface_draw.gd")
const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const BUTTON_PRIMARY := preload("res://content/co-ty-phu-classic/art/board-button-primary.webp")
const BUTTON_PRIMARY_PRESSED := preload(
	"res://content/co-ty-phu-classic/art/board-button-primary-pressed.webp"
)
const BUTTON_SECONDARY := preload("res://content/co-ty-phu-classic/art/board-button-secondary.webp")
const BUTTON_SECONDARY_PRESSED := preload(
	"res://content/co-ty-phu-classic/art/board-button-secondary-pressed.webp"
)
const BUTTON_DANGER := preload("res://content/co-ty-phu-classic/art/board-button-danger.webp")
const BUTTON_DANGER_PRESSED := preload(
	"res://content/co-ty-phu-classic/art/board-button-danger-pressed.webp"
)
const BUTTON_SOCIAL := preload("res://content/co-ty-phu-classic/art/board-button-social.webp")
const BUTTON_SOCIAL_PRESSED := preload(
	"res://content/co-ty-phu-classic/art/board-button-social-pressed.webp"
)
const REVEAL_CENTER := Vector2(0.5, 0.58)
const REVEAL_ZOOM := 1.35
const PRIORITY: Dictionary = {
	"Confirm": 100,
	"EndTurn": 90,
	"Buy": 80,
	"Bid": 80,
	"PayDebt": 80,
	"Bail": 80,
	"UseCard": 70,
	"Build": 60,
	"Skip": 30,
	"Pass": 30,
	"Bankrupt": 20
}
const SYMBOLS: Array[Texture2D] = [
	preload("res://content/co-ty-phu-classic/art/tile-chest.svg"),
	preload("res://content/co-ty-phu-classic/art/tile-chance.svg")
]
var _buttons: Array[XomDaoButton] = []
var _font: Font
var _flight: Dictionary = {}
var _progress: float = 0.0


static func event_changed(before: Variant, after: Variant) -> bool:
	if before is not Dictionary or after is not Dictionary:
		return (before is Dictionary) != (after is Dictionary)
	var old: Dictionary = before.duplicate()
	var next: Dictionary = after.duplicate()
	old.erase("ready")
	next.erase("ready")
	return old != next


static func title(event: Dictionary) -> String:
	var kind: String = str(event.get("kind", ""))
	if kind != "card":
		return str(event.get("reason", "Vào tù" if kind == "jail" else "Sự kiện"))
	var card: Dictionary = event["card"]
	var wording: String = str(card["text"]).to_lower()
	var names: Dictionary = {
		"cổ tức": "Cổ tức",
		"trả lãi": "Lãi ngân hàng",
		"lợi nhuận": "Chia lợi nhuận",
		"tốc độ": "Phạt tốc độ",
		"khám bệnh": "Khám bệnh",
		"học tập": "Học tập",
		"thừa kế": "Thừa kế",
		"trúng giải": "Trúng thưởng",
		"hoàn thuế": "Hoàn thuế",
		"cổ phiếu": "Bán cổ phiếu"
	}
	for key: String in names:
		if key in wording:
			return names[key]
	match str(card["kind"]):
		"jail":
			return "Vào tù"
		"free":
			return "Vé ra tù"
		"repairs":
			return "Tu sửa nhà"
		"shortage":
			return "Thiếu điện" if int(card["square"]) == 12 else "Thiếu nước"
		"move":
			return "Đến " + str(Rules.SQUARES[int(card["target"])]["name"])
		"nearest":
			return "Ghé bến xe" if card["target"] == "station" else "Ghé tiện ích"
	return "Quà bất ngờ" if int(card.get("amount", 0)) > 0 else "Khoản chi"


static func description(event: Dictionary, notice: String) -> String:
	var kind: String = str(event.get("kind", ""))
	if kind == "tax":
		return "Cần nộp %s ₫." % XomDaoUi.money(int(event.get("amount", 0)))
	if kind == "jail" or kind == "airport":
		return ""
	if kind != "card":
		return notice
	var card: Dictionary = event["card"]
	match str(card.get("kind", "")):
		"cash":
			var amount: int = int(card.get("amount", 0))
			return (
				"Nhận %s ₫" % XomDaoUi.money(amount)
				if amount > 0
				else "Nộp %s ₫" % XomDaoUi.money(-amount)
			)
		"free":
			return "Giữ lại đến khi sử dụng."
		"jail":
			return ""
		"nearest":
			return "Phí thuê tại ô đó được nhân đôi."
		"shortage":
			return (
				"Thuê Điện lực ×2 trong vòng bàn kế tiếp."
				if int(card.get("square", 12)) == 12
				else "Thuê Cấp nước ×2 trong vòng bàn kế tiếp."
			)
		"repairs":
			return "Tính theo số nhà và khách sạn đang sở hữu."
		"move":
			return "Nhận 200 ₫ khi qua Xuất phát." if int(card.get("target", -1)) == 0 else ""
	return notice


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = Draw.ink_font()
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS


func attach(buttons: Dictionary) -> void:
	for key: String in PRIORITY:
		var button: XomDaoButton = buttons[key]
		button.reparent(self)
		button.modulate.a = 0.0
		button.add_theme_font_size_override("font_size", 1)
		button.visibility_changed.connect(_rearrange)
		_buttons.append(button)


func arrange(board: Control) -> void:
	position = board.position
	size = board.size
	_rearrange()


func _rearrange() -> void:
	var active: Array[XomDaoButton] = []
	for button: XomDaoButton in _buttons:
		if button.visible:
			active.append(button)
	active.sort_custom(
		func(a: XomDaoButton, b: XomDaoButton) -> bool:
			return int(PRIORITY[a.name]) > int(PRIORITY[b.name])
	)
	var extent := Vector2(size.x * (338.0 / 1330.0), size.y * (136.0 / 1045.0))
	for i: int in active.size():
		var button: XomDaoButton = active[i]
		var uv := Vector2(0.63 if i == 0 else 0.37, 0.745)
		button.set_meta("surface_uv", uv)
		var at: Vector2 = Rules.plane_point(uv) * size
		button.custom_minimum_size = Vector2.ZERO
		button.size = extent
		button.position = at - extent * Vector2(0.5, 0.485)
	queue_redraw()


func _button_texture(button: XomDaoButton) -> Texture2D:
	var pressed: bool = button.is_pressed()
	match button.kind:
		XomDaoUi.Kind.DANGER:
			return BUTTON_DANGER_PRESSED if pressed else BUTTON_DANGER
		XomDaoUi.Kind.SOCIAL:
			return BUTTON_SOCIAL_PRESSED if pressed else BUTTON_SOCIAL
		XomDaoUi.Kind.BACK:
			return BUTTON_SECONDARY_PRESSED if pressed else BUTTON_SECONDARY
		_:
			return BUTTON_PRIMARY_PRESSED if pressed else BUTTON_PRIMARY


func reveal(event: Dictionary) -> void:
	_flight = {"deck": 0 if event.get("deck") == "chest" else 1, "title": title(event)}
	_progress = 0.0
	var tween: Tween = create_tween()
	tween.tween_property(self, "_progress", 1.0, 1.35)
	await tween.finished
	_flight = {}
	queue_redraw()


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	if _font == null:
		return
	for index: int in 2:
		var center := Vector2(0.245 if index == 0 else 0.755, 0.61)
		Draw.text(
			self,
			_font,
			"Khí vận" if index == 0 else "Cơ hội",
			center + Vector2(0, -0.103),
			0.022,
			0.14
		)
	for button: XomDaoButton in _buttons:
		if not button.visible:
			continue
		var uv: Vector2 = button.get_meta("surface_uv", Vector2(0.63, 0.745))
		var at: Vector2 = Rules.plane_point(uv) * size
		var tex: Texture2D = _button_texture(button)
		var b_size := Vector2(size.x * (338.0 / 1330.0), size.y * (136.0 / 1045.0))
		var b_rect := Rect2(at - b_size * Vector2(0.5, 0.485), b_size)
		var modulate_color := Color.WHITE
		if button.disabled:
			modulate_color = Color(0.65, 0.65, 0.65, 0.5)
		elif button.is_hovered():
			modulate_color = Color(1.08, 1.08, 1.08, 1.0)
		draw_set_transform_matrix(Transform2D.IDENTITY)
		var baked_right: bool = button.kind not in [XomDaoUi.Kind.BACK, XomDaoUi.Kind.DANGER]
		var mirror: bool = baked_right != (uv.x > 0.5)
		var corners := PackedVector2Array(
			[
				b_rect.position,
				Vector2(b_rect.end.x, b_rect.position.y),
				b_rect.end,
				Vector2(b_rect.position.x, b_rect.end.y)
			]
		)
		var uvs := PackedVector2Array(
			(
				[Vector2.RIGHT, Vector2.ZERO, Vector2.DOWN, Vector2.ONE]
				if mirror
				else [Vector2.ZERO, Vector2.RIGHT, Vector2.ONE, Vector2.DOWN]
			)
		)
		draw_polygon(corners, PackedColorArray([modulate_color]), uvs, tex)
		var text_uv := uv - Vector2(0, 0.003)
		if button.is_pressed():
			text_uv.y += 0.002
		Draw.text(self, _font, button.text, text_uv, 0.030, 0.205, XomDaoUi.CREAM)
	if not _flight.is_empty():
		var index: int = int(_flight["deck"])
		var start := Vector2(0.245 if index == 0 else 0.755, 0.61)
		var finish := REVEAL_CENTER
		var t: float = smoothstep(0.0, 0.45, _progress)
		var at: Vector2 = start.lerp(finish, t)
		var flip: float = smoothstep(0.50, 0.80, _progress)
		var width: float = maxf(0.012, absf(cos(flip * PI)))
		var alpha: float = 1.0 - smoothstep(0.88, 1.0, _progress)
		_card(
			at,
			index,
			flip >= 0.5,
			str(_flight["title"]),
			width,
			1.0 + t * (REVEAL_ZOOM - 1.0),
			alpha
		)


func _card(
	at: Vector2, index: int, front: bool, heading: String, width: float, zoom: float, alpha: float
) -> void:
	var extent := Vector2(width, 1.0) * zoom / 1000.0
	var bounds := Rect2(at - Vector2(52, 74) * extent, Vector2(104, 148) * extent)
	var ink := Color(XomDaoUi.INK, alpha)
	draw_set_transform_matrix(Transform2D.IDENTITY)
	_outline(bounds, ink, 2.0 * size.x * zoom / 1000.0)
	_outline(
		Rect2(at - Vector2(46, 68) * extent, Vector2(92, 136) * extent),
		Color(XomDaoUi.INK, alpha * 0.45),
		size.x * zoom / 1000.0
	)
	if not front:
		var symbol := Rect2(at - Vector2(28, 28) * extent, Vector2(56, 56) * extent)
		draw_polygon(
			Draw.quad(symbol, size),
			PackedColorArray([ink]),
			PackedVector2Array([Vector2.ZERO, Vector2.RIGHT, Vector2.ONE, Vector2.DOWN]),
			SYMBOLS[index]
		)
	elif width > 0.92:
		var text_alpha: float = alpha * smoothstep(0.92, 1.0, width)
		Draw.paragraph(
			self, _font, heading, at, 0.030 * zoom, 0.084 * zoom, 3, Color(ink, text_alpha)
		)


func _outline(bounds: Rect2, ink: Color, weight: float) -> void:
	var points: PackedVector2Array = Draw.quad(bounds, size)
	points.append(points[0])
	draw_polyline(points, ink, weight, true)
