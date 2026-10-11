extends Control
## Luật on the table: the rules of Cờ Cá Ngựa one page at a time on a paper board over a shade,
## each page a title, large text and, for some, a picture of the dice faces and the home squares.
## The ‹ and › buttons turn the pages; the board's ✕ or a tap on the shade closes it.
##
##   var panel := RulesPanel.new()   # preload("res://content/co-ca-ngua/rules_panel.gd")
##   add_child(panel)
##   panel.open()
##
## Named nodes for tests: RulesPanel, RulesText, RulesArt, RulesPrev, RulesNext, RulesPage,
## RulesClose.

const PAGES: Array[Dictionary] = [
	{
		"title": "Xuất chuồng",
		"text":
		(
			"Mỗi người có bốn ngựa cùng màu. Tung được một trong hai mặt dưới đây để đưa ngựa ra ô"
			+ " xuất phát."
		),
		"art": "spawn",
	},
	{
		"title": "Thêm lượt",
		"text":
		(
			"Tung được mặt dưới đây thì được tung tiếp, kể cả khi không có nước đi. Đá ngựa và về"
			+ " đích không tự cho thêm lượt."
		),
		"art": "six",
	},
	{
		"title": "Chạy trên bàn",
		"text":
		(
			"Đi đúng số nút trên xúc xắc. Không vượt qua bất kỳ ngựa nào, kể cả ngựa của mình."
			+ " Không dừng ở ô có ngựa cùng màu."
		),
	},
	{
		"title": "Đá ngựa",
		"text":
		(
			"Đến đúng ô có ngựa đối thủ thì đá ngựa đó về chuồng. Ô xuất phát cũng đá được; không"
			+ " có ô an toàn."
		),
	},
	{
		"title": "Đến cửa chuồng",
		"text":
		(
			"Đi hết một vòng và dừng đúng cửa chuồng của màu mình, ngay trước ô xuất phát. Không"
			+ " dùng số dư để đi thẳng vào chuồng."
		),
	},
	{
		"title": "Vào chuồng",
		"text":
		(
			"Ở cửa chuồng, tung được mặt nào thì vào ô mang số đó. Không được vượt qua ngựa khác"
			+ " hoặc đi quá ô đích đang cần."
		),
		"art": "entry",
	},
	{
		"title": "Nhích trong chuồng",
		"text":
		(
			"Trong chuồng, chỉ nhích một ô khi tung đúng số của ô tiếp theo. Ví dụ: đang ở ô ngay"
			+ " trước ô minh họa dưới đây."
		),
		"art": "promote",
	},
	{
		"title": "Về đích",
		"text":
		"Đưa bốn ngựa lần lượt tới các ô dưới đây. Ngựa đã về đích đứng yên và không đi" + " tiếp.",
		"art": "finish",
	},
	{
		"title": "Thường hoặc phân hạng",
		"text":
		(
			"Thường: ván kết thúc khi có người về đích đủ bốn ngựa. Phân hạng: người đã hoàn thành"
			+ " nghỉ lượt; bàn chơi tiếp đến khi xác định hết thứ hạng. Người còn lại cuối cùng"
			+ " nhận hạng cuối."
		),
	},
	{
		"title": "Thời gian và rời bàn",
		"text":
		(
			"Mỗi lần tung hoặc chọn ngựa có 30 giây. Hết giờ, máy tự chơi. Không có nước đi thì bỏ"
			+ " lượt. Người rời bàn được bỏ qua; người chưa hoàn thành rời bàn không được xếp"
			+ " hạng."
		),
	},
]
## The board's paper: wide enough for the five-picture rows, the text about three lines.
const WIDTH := 720.0
const TEXT_HEIGHT := 128.0
const ART_HEIGHT := 112.0
## One picture (a dice face or a home square), and its colours (Phaser's red home square).
const TILE := 84.0
const SQUARE := Color("#BF443E")
const SQUARE_LINE := Color("#FFB5A4")
const SQUARE_TEXT := Color("#FFF4DE")

## The page on show (0-based).
var page: int = 0

var _shade := ColorRect.new()
var _board: XomDaoBoard = XomDaoBoard.create("", true)
var _text := Label.new()
var _art := Control.new()
var _prev: XomDaoButton = XomDaoButton.create("‹", XomDaoUi.Kind.BACK)
var _next: XomDaoButton = XomDaoButton.create("›", XomDaoUi.Kind.BACK)
var _count := Label.new()
var _faces: Array[Texture2D] = []


## What a page's picture shows, left to right, as offsets from the middle of the board:
## {kind: "dice" | "square" | "word", value: the face, the square or the word, x}.
static func art(kind: String) -> Array[Dictionary]:
	match kind:
		"spawn":
			return [_item("dice", 1, -112.0), _item("word", "hoặc", 0.0), _item("dice", 6, 112.0)]
		"six":
			return [_item("dice", 6, 0.0)]
		"entry":
			return [
				_item("dice", 1, -228.0),
				_item("word", "→", -140.0),
				_item("square", 1, -52.0),
				_item("dice", 6, 52.0),
				_item("word", "→", 140.0),
				_item("square", 6, 228.0),
			]
		"promote":
			return [
				_item("square", 2, -224.0),
				_item("word", "+", -112.0),
				_item("dice", 3, 0.0),
				_item("word", "→", 112.0),
				_item("square", 3, 224.0),
			]
		"finish":
			var items: Array[Dictionary] = []
			for index: int in 4:
				var at: float = -228.0 + index * 152.0
				items.append(_item("square", 6 - index, at))
				if index < 3:
					items.append(_item("word", "→", at + 76.0))
			return items
	return []


static func _item(kind: String, value: Variant, x: float) -> Dictionary:
	return {"kind": kind, "value": value, "x": x}


func _init() -> void:
	name = "RulesPanel"
	visible = false
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.name = "RulesShade"
	_shade.color = Color(XomDaoUi.INK, 0.45)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.gui_input.connect(_on_shade_input)
	add_child(_shade)
	_board.closed.connect(close)
	add_child(_board)
	_board.close_button.name = "RulesClose"
	_text.name = "RulesText"
	_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text.custom_minimum_size = Vector2(WIDTH, TEXT_HEIGHT)
	_text.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	_board.content.add_child(_text)
	_art.name = "RulesArt"
	_art.custom_minimum_size = Vector2(WIDTH, ART_HEIGHT)
	_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_art.draw.connect(_draw_art)
	_board.content.add_child(_art)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 24)
	_board.content.add_child(row)
	_prev.name = "RulesPrev"
	_prev.custom_minimum_size = Vector2(120.0, XomDaoButton.HEIGHT)
	_prev.add_theme_font_size_override("font_size", 56)
	_prev.pressed.connect(turn.bind(-1))
	row.add_child(_prev)
	_count.name = "RulesPage"
	_count.custom_minimum_size.x = 120.0
	_count.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_count.theme_type_variation = "SmallLabel"
	row.add_child(_count)
	_next.name = "RulesNext"
	_next.custom_minimum_size = Vector2(120.0, XomDaoButton.HEIGHT)
	_next.add_theme_font_size_override("font_size", 56)
	_next.pressed.connect(turn.bind(1))
	row.add_child(_next)
	for face: int in 6:
		_faces.append(load("res://content/co-ca-ngua/art/dice-%d.webp" % (face + 1)))
	resized.connect(_layout)
	_show_page()


## Opens on the first page.
func open() -> void:
	page = 0
	_show_page()
	visible = true
	_board.open()
	_layout()


func close() -> void:
	visible = false


## Turns `delta` pages, staying within the first and the last.
func turn(delta: int) -> void:
	page = clampi(page + delta, 0, PAGES.size() - 1)
	_show_page()


func _show_page() -> void:
	var rule: Dictionary = PAGES[page]
	_board.title = str(rule["title"])
	_text.text = str(rule["text"])
	_count.text = "%d / %d" % [page + 1, PAGES.size()]
	_prev.disabled = page == 0
	_next.disabled = page == PAGES.size() - 1
	_art.visible = rule.has("art")
	_art.queue_redraw()
	_layout()


func _on_shade_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.pressed:
		close()


## The board in the middle, smaller on a short frame so it always fits.
func _layout() -> void:
	if not is_inside_tree():
		return
	_board.reset_size()
	var room: Vector2 = (size - Vector2(32.0, 16.0)) / _board.size
	_board.pivot_offset = _board.size / 2.0
	_board.scale = Vector2.ONE * clampf(minf(room.x, room.y), 0.5, 1.0)
	_board.position = (size - _board.size) / 2.0


func _draw_art() -> void:
	var rule: Dictionary = PAGES[page]
	if not rule.has("art"):
		return
	var middle := Vector2(_art.size.x / 2.0, _art.size.y / 2.0)
	var font: Font = XomDaoUi.display_font(800)
	for item: Dictionary in art(str(rule["art"])):
		var at: Vector2 = middle + Vector2(float(item["x"]), 0.0)
		var tile := Rect2(at - Vector2.ONE * TILE / 2.0, Vector2.ONE * TILE)
		match str(item["kind"]):
			"dice":
				# The dice pictures have a margin round the face: a little larger looks the same size.
				_art.draw_texture_rect(
					_faces[int(item["value"]) - 1], tile.grow(TILE * 0.18), false
				)
			"square":
				_art.draw_rect(tile, SQUARE)
				_art.draw_rect(tile, SQUARE_LINE, false, 3.0)
				_word(font, str(item["value"]), at, 40, SQUARE_TEXT)
			"word":
				var text: String = str(item["value"])
				_word(font, text, at, 30 if text.length() > 1 else 40, XomDaoUi.HONEY_DARK)


## A word drawn centred on a point.
func _word(font: Font, text: String, at: Vector2, font_size: int, color: Color) -> void:
	var width: float = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var baseline: float = at.y + (font.get_ascent(font_size) - font.get_descent(font_size)) / 2.0
	_art.draw_string(
		font,
		Vector2(at.x - width / 2.0, baseline),
		text,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		font_size,
		color
	)
