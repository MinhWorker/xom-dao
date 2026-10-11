class_name HubLoading
extends Control
## What the player looks at while the app connects or a game loads: the games' splash art one
## after another, each with the game's name and a few lines of where the game comes from, and
## the status ("Đang tải") in the bottom right corner. The slides turn by themselves; a tap or
## a swipe turns them sooner. The art is the hub's own (`hub/select/art/<id>/splash.webp`), so
## it shows before any game pack or the catalog is there.
##
##   var loading := HubLoading.new("tien-len")   # opens on that game's slide ("": any)
##   loading.status = "Đang tải"
##
## Named nodes for tests: Status, LoadingName, LoadingStory, LoadingDots.

## One slide per game: [id, name, story].
const SLIDES: Array[Array] = [
	[
		"tic-tac-toe",
		"Caro",
		(
			"Caro là họ hàng của gomoku, trò nối năm quân rất thịnh ở Nhật Bản từ thế kỷ 19."
			+ " Ở Việt Nam, nó gắn với trang giấy ô ly và giờ ra chơi của bao lớp học trò."
		),
	],
	[
		"xiangqi",
		"Cờ Tướng",
		(
			"Cờ Tướng thành hình ở Trung Hoa, luật như ngày nay có từ khoảng thời Tống."
			+ " Con sông chia đôi bàn cờ mang tên “Sở hà Hán giới”, nhắc cuộc tranh hùng Hán Sở."
		),
	],
	[
		"chess",
		"Cờ Vua",
		(
			"Cờ Vua bắt nguồn từ chaturanga ở Ấn Độ khoảng thế kỷ 6, qua Ba Tư rồi tới châu Âu."
			+ " Mãi cuối thế kỷ 15, quân Hậu mới trở thành quân mạnh nhất bàn cờ."
		),
	],
	[
		"go",
		"Cờ Vây",
		(
			"Cờ Vây ra đời ở Trung Hoa hơn 2.500 năm trước và vẫn được chơi gần như nguyên luật."
			+ " Bàn 19 × 19 có nhiều thế cờ hơn số nguyên tử trong vũ trụ nhìn thấy được."
		),
	],
	[
		"checkers",
		"Cờ Đam",
		(
			"Cờ Đam có họ với alquerque, một trò chơi cổ vùng Trung Đông."
			+ " Khoảng thế kỷ 12 ở Pháp, người ta đưa nó lên bàn cờ vua và trò chơi có dáng như nay."
		),
	],
	[
		"co-ca-ngua",
		"Cờ Cá Ngựa",
		(
			"Cờ Cá Ngựa đến từ trò Petits Chevaux, “những chú ngựa nhỏ”, của Pháp và cùng họ với"
			+ " pachisi của Ấn Độ. Vào Việt Nam, nó thành món quen của mọi nhà."
		),
	],
	[
		"co-ty-phu-classic",
		"Cờ Tỷ Phú",
		(
			"Cờ Tỷ Phú bắt nguồn từ The Landlord's Game, được Elizabeth Magie đăng ký sáng chế"
			+ " năm 1904. Bản Monopoly quen thuộc ra mắt năm 1935."
		),
	],
	[
		"tien-len",
		"Tiến Lên",
		(
			"Tiến Lên là trò bài của người Việt, lan khắp ba miền trong thế kỷ 20."
			+ " Theo chân người Việt ra nước ngoài, nó còn được gọi là “Thirteen”: mười ba lá."
		),
	],
	[
		"mau-binh",
		"Mậu Binh",
		(
			"Mậu Binh, hay Binh Xập Xám, cùng gốc với một trò bài mười ba lá của người Hoa."
			+ " “Xập xám” chính là “mười ba” đọc theo tiếng Quảng Đông."
		),
	],
	[
		"bai-cao",
		"Bài Cào",
		(
			"Bài Cào chỉ tính hàng đơn vị của tổng ba lá, chín nút là cao nhất, giống cách tính"
			+ " của baccarat. Ván nào cũng chóng vánh nên bài cào hay góp mặt trong ngày Tết."
		),
	],
	[
		"battleship",
		"Bắn Tàu",
		(
			"Bắn Tàu vốn là trò giấy bút có từ khoảng Thế chiến thứ nhất."
			+ " Năm 1967, bản bàn nhựa cắm chốt ra đời và đưa trò chơi đi khắp thế giới."
		),
	],
	[
		"bom-nguyen-to",
		"Bom Nguyên Tố",
		(
			"Bom Nguyên Tố nối dài dòng game đặt bom trong mê cung, nổi lên từ các máy điện tử"
			+ " thập niên 1980. Ở Xóm Đảo, mỗi bạn nhỏ mang thêm một nguyên tố của riêng mình."
		),
	],
	[
		"trung-thu",
		"Trung Thu",
		(
			"Trung Thu, rằm tháng Tám, là Tết của thiếu nhi với đèn lồng và mâm cỗ trông trăng."
			+ " Đèn cá chép gợi tích cá chép vượt vũ môn hoá rồng."
		),
	],
]
## Seconds a slide stays before the next one comes.
const HOLD := 7.0
const FADE := 0.6
const SIDE := 64.0
const TEXT_W := 780.0

var status: String = "":
	set(value):
		status = value
		_status.text = value

## The slide on show (an index of the slides that have art).
var slide: int = 0

var _slides: Array[Array] = []
var _back := TextureRect.new()
var _front := TextureRect.new()
var _shade := Control.new()
var _kicker := Label.new()
var _name := Label.new()
var _story := Label.new()
var _dots := Control.new()
var _status := Label.new()
var _held: float = 0.0
var _press := Vector2.INF
var _fade: Tween


func _init(game_id: String = "") -> void:
	name = "Loading"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	for entry: Array in SLIDES:
		if HubGameArt.splash(str(entry[0])) != null:
			_slides.append(entry)
	var sea := ColorRect.new()
	sea.color = XomDaoUi.NAVY
	sea.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	sea.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(sea)
	for picture: TextureRect in [_back, _front]:
		picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		picture.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(picture)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_shade.draw.connect(_draw_shade)
	add_child(_shade)
	_kicker.text = "Chuyện trò chơi"
	_kicker.theme_type_variation = "HudLabel"
	_kicker.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_kicker.add_theme_color_override("font_color", XomDaoUi.SUN)
	add_child(_kicker)
	_name.name = "LoadingName"
	_name.theme_type_variation = "HudLabel"
	_name.add_theme_font_size_override("font_size", 60)
	add_child(_name)
	_story.name = "LoadingStory"
	_story.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_story.add_theme_font_override("font", XomDaoUi.body_font(true))
	_story.add_theme_font_size_override("font_size", 28)
	_story.add_theme_color_override("font_color", XomDaoUi.CREAM)
	add_child(_story)
	_dots.name = "LoadingDots"
	_dots.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dots.draw.connect(_draw_dots)
	add_child(_dots)
	_status.name = "Status"
	_status.theme_type_variation = "HudLabel"
	_status.add_theme_font_size_override("font_size", 28)
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_status)
	for label: Label in [_kicker, _name, _story, _status]:
		label.add_theme_color_override("font_outline_color", Color(XomDaoUi.NAVY, 0.8))
		label.add_theme_constant_override("outline_size", 6)
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(_layout)
	# Open on the game being loaded, else somewhere new each time.
	var first: int = randi() % maxi(1, _slides.size())
	for i: int in _slides.size():
		if str(_slides[i][0]) == game_id:
			first = i
	_show(first, false)


func _ready() -> void:
	_layout()


func _process(delta: float) -> void:
	_held += delta
	if _held >= HOLD:
		turn(1)


func _gui_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button == null or button.button_index != MOUSE_BUTTON_LEFT:
		return
	if button.pressed:
		_press = button.position
	elif _press != Vector2.INF:
		# A swipe to the right goes back; a tap or a swipe to the left goes on.
		turn(-1 if button.position.x - _press.x > 40.0 else 1)
		_press = Vector2.INF


## Goes `step` slides on (or back), round and round.
func turn(step: int) -> void:
	if _slides.size() < 2:
		_held = 0.0
		return
	_show(posmod(slide + step, _slides.size()), true)


func _show(index: int, faded: bool) -> void:
	_held = 0.0
	slide = index
	if _slides.is_empty():
		return
	var entry: Array = _slides[index]
	var picture: Texture2D = HubGameArt.splash(str(entry[0]))
	if _fade != null:
		_fade.kill()
	if faded and is_inside_tree():
		_back.texture = _front.texture
		_front.texture = picture
		_front.modulate.a = 0.0
		_fade = create_tween().set_parallel()
		_fade.tween_property(_front, "modulate:a", 1.0, FADE)
		for label: Label in [_name, _story]:
			label.modulate.a = 0.0
			_fade.tween_property(label, "modulate:a", 1.0, FADE)
	else:
		_front.texture = picture
		_front.modulate.a = 1.0
	_name.text = str(entry[1])
	_story.text = str(entry[2])
	_layout()
	_dots.queue_redraw()


## Darker towards the bottom, where the words are, and a little at the top.
func _draw_shade() -> void:
	var w: float = _shade.size.x
	var h: float = _shade.size.y
	var clear := Color(XomDaoUi.NAVY, 0.0)
	var dark := Color(XomDaoUi.NAVY, 0.92)
	var top: float = h * 0.38
	_shade.draw_polygon(
		PackedVector2Array([Vector2(0, top), Vector2(w, top), Vector2(w, h), Vector2(0, h)]),
		PackedColorArray([clear, clear, dark, dark])
	)
	var soft := Color(XomDaoUi.NAVY, 0.35)
	_shade.draw_polygon(
		PackedVector2Array(
			[Vector2(0, 0), Vector2(w, 0), Vector2(w, h * 0.2), Vector2(0, h * 0.2)]
		),
		PackedColorArray([soft, soft, clear, clear])
	)


func _draw_dots() -> void:
	for i: int in _slides.size():
		var on: bool = i == slide
		var at := Vector2(8.0 + i * 22.0, _dots.size.y / 2.0)
		var color: Color = XomDaoUi.SUN if on else Color(XomDaoUi.CREAM, 0.45)
		_dots.draw_circle(at, 7.0 if on else 5.0, color, true, -1.0, true)


func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var left: float = inset.x + SIDE
	var bottom: float = size.y - inset.y - 40.0
	var wide: float = minf(TEXT_W, size.x - left * 2.0)
	_dots.size = Vector2(_slides.size() * 22.0, 20.0)
	_dots.position = Vector2(left, bottom - _dots.size.y)
	_story.size = Vector2(wide, 0.0)
	_story.size.y = _story.get_minimum_size().y
	_story.position = Vector2(left, _dots.position.y - 20.0 - _story.size.y)
	_name.reset_size()
	_name.position = Vector2(left, _story.position.y - _name.size.y + 4.0)
	_kicker.reset_size()
	_kicker.position = Vector2(left, _name.position.y - _kicker.size.y + 10.0)
	_status.size = Vector2(420.0, 40.0)
	_status.position = Vector2(size.x - left - 420.0, bottom - 34.0)
	_shade.queue_redraw()
