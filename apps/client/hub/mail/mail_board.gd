class_name HubMailBoard
extends Control
## Hộp thư, over the lobby: a board with your letters on the left (an envelope, sealed red while
## unread, the title, when it came, a coin while its coins wait) and the open letter on the right
## as a sheet of paper: title, when, the words, and its coins with Nhận (then "Đã nhận"). Opening
## a letter reads it. Tapping the shade or the close mark closes the board.
##
## Named for tests: MailBoard, Letter_<n>, LetterTitle, LetterBody, ClaimLetter, MailEmpty.

const LIST := Vector2(340.0, 440.0)
const PAGE := Vector2(500.0, 440.0)

var _mail: HubMail
var _board: XomDaoBoard = XomDaoBoard.create("Hộp thư", true)
var _list := VBoxContainer.new()
var _page := PanelContainer.new()
## The open letter's id.
var _open: String = ""
var _claiming: bool = false


func _init(mail: HubMail) -> void:
	name = "MailBoard"
	_mail = mail
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.color = Color(XomDaoUi.INK, 0.45)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.gui_input.connect(
		func(event: InputEvent) -> void:
			if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
				queue_free()
	)
	add_child(shade)
	_board.closed.connect(queue_free)
	add_child(_board)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	_board.content.add_child(row)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = LIST
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	row.add_child(scroll)
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 8)
	scroll.add_child(_list)
	_page.custom_minimum_size = PAGE
	var paper: StyleBoxFlat = XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.PAPER_DARK, 2, 6.0)
	paper.set_content_margin_all(22.0)
	paper.shadow_color = XomDaoUi.SHADOW
	paper.shadow_size = 6
	paper.shadow_offset = Vector2(0.0, 3.0)
	_page.add_theme_stylebox_override("panel", paper)
	row.add_child(_page)
	mail.changed.connect(_fill)
	resized.connect(_place)


func _ready() -> void:
	_open = _first()
	_fill()
	_place()
	_board.open()
	_read_open()


func _place() -> void:
	_board.reset_size()
	var fit: float = minf(
		1.0,
		minf((size.y - 32.0) / maxf(_board.size.y, 1.0), (size.x - 32.0) / maxf(_board.size.x, 1.0))
	)
	_board.pivot_offset = _board.size / 2.0
	_board.scale = Vector2.ONE * fit
	_board.position = (size - _board.size) / 2.0


## The letter to open first: the newest one waiting for you, else the newest.
func _first() -> String:
	for letter: XomDaoLetter in _mail.box.letters:
		if not letter.read or (letter.coins > 0 and not letter.claimed):
			return letter.id
	return _mail.box.letters[0].id if not _mail.box.letters.is_empty() else ""


func _fill() -> void:
	for parent: Node in [_list, _page]:
		for child: Node in parent.get_children():
			parent.remove_child(child)
			child.queue_free()
	var letters: Array[XomDaoLetter] = _mail.box.letters
	if letters.is_empty():
		var empty := Label.new()
		empty.name = "MailEmpty"
		empty.text = "Chưa có thư"
		empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		empty.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		_page.add_child(empty)
		return
	for index: int in letters.size():
		_list.add_child(_row(letters[index], index))
		if letters[index].id == _open:
			_page.add_child(_sheet(letters[index]))
	_place.call_deferred()


func _row(letter: XomDaoLetter, index: int) -> Control:
	var back := PanelContainer.new()
	back.name = "Letter_%d" % index
	back.mouse_filter = Control.MOUSE_FILTER_STOP
	back.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var open: bool = letter.id == _open
	var style: StyleBoxFlat = XomDaoUi.box(
		Color(XomDaoUi.GOLD, 0.28) if open else Color(XomDaoUi.INK, 0.06),
		XomDaoUi.GOLD_DARK if open else Color.TRANSPARENT,
		2 if open else 0,
		12.0
	)
	style.set_content_margin_all(10.0)
	back.add_theme_stylebox_override("panel", style)
	back.custom_minimum_size.y = 76.0
	back.gui_input.connect(_on_row_input.bind(letter.id))
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 12)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	back.add_child(line)
	var envelope := TextureRect.new()
	envelope.texture = XomDaoUi.icon("envelope-simple")
	envelope.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	envelope.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	envelope.custom_minimum_size = Vector2.ONE * 36.0
	envelope.modulate = XomDaoUi.LACQUER if not letter.read else Color(XomDaoUi.INK, 0.45)
	envelope.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(envelope)
	var words := VBoxContainer.new()
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	words.add_theme_constant_override("separation", -2)
	line.add_child(words)
	var title := Label.new()
	title.text = letter.title
	title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	title.add_theme_font_override("font", XomDaoUi.display_font(800 if not letter.read else 600))
	words.add_child(title)
	var when := Label.new()
	when.theme_type_variation = "SmallLabel"
	when.text = _when(letter)
	words.add_child(when)
	if letter.coins > 0 and not letter.claimed:
		var coin := XomDaoResourceIcon.new()
		coin.custom_minimum_size = Vector2.ONE * 30.0
		coin.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		line.add_child(coin)
	for child: Node in line.get_children():
		(child as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
	return back


## The open letter as a sheet: title, when it came, its words and its coins.
func _sheet(letter: XomDaoLetter) -> Control:
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	# Wrapping labels need a width, or they grow one word per line.
	column.custom_minimum_size.x = PAGE.x - 44.0
	var title := Label.new()
	title.name = "LetterTitle"
	title.text = letter.title
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.add_theme_font_override("font", XomDaoUi.display_font(800))
	title.add_theme_font_size_override("font_size", 32)
	title.add_theme_color_override("font_color", XomDaoUi.LACQUER_DARK)
	column.add_child(title)
	var when := Label.new()
	when.theme_type_variation = "SmallLabel"
	when.text = "Xóm Đảo · %s" % _when(letter)
	column.add_child(when)
	var rule := ColorRect.new()
	rule.color = XomDaoUi.PAPER_DARK
	rule.custom_minimum_size.y = 2.0
	column.add_child(rule)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	var body := Label.new()
	body.name = "LetterBody"
	body.text = letter.body
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_font_size_override("font_size", 26)
	scroll.add_child(body)
	if letter.coins > 0:
		column.add_child(_gift(letter))
	return column


func _gift(letter: XomDaoLetter) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.alignment = BoxContainer.ALIGNMENT_END
	var coin := XomDaoResourceIcon.new()
	coin.custom_minimum_size = Vector2.ONE * 40.0
	coin.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(coin)
	var amount := Label.new()
	amount.text = XomDaoUi.money(letter.coins)
	amount.add_theme_font_override("font", XomDaoUi.display_font(800))
	amount.add_theme_font_size_override("font_size", 30)
	row.add_child(amount)
	var claim: XomDaoButton = XomDaoButton.create(
		"Đã nhận" if letter.claimed else "Nhận", XomDaoUi.Kind.CONFIRM
	)
	claim.name = "ClaimLetter"
	claim.custom_minimum_size = Vector2(160.0, 72.0)
	claim.disabled = letter.claimed
	claim.pressed.connect(_claim.bind(letter.id, claim))
	row.add_child(claim)
	return row


func _when(letter: XomDaoLetter) -> String:
	return HubMatchRow.ago(Time.get_unix_time_from_system() * 1000.0 - letter.sent_at)


func _on_row_input(event: InputEvent, id: String) -> void:
	var press := event as InputEventMouseButton
	if press == null or not press.pressed or press.button_index != MOUSE_BUTTON_LEFT:
		return
	if id == _open:
		return
	_open = id
	_fill()
	_read_open()


func _read_open() -> void:
	for letter: XomDaoLetter in _mail.box.letters:
		if letter.id == _open and not letter.read:
			await _mail.read(letter.id)
			return


func _claim(id: String, button: XomDaoButton) -> void:
	if _claiming:
		return
	_claiming = true
	button.disabled = true
	var refused: String = await _mail.claim(id)
	_claiming = false
	if refused != "" and is_inside_tree():
		XomDaoToast.show_on(self, refused, "warning")
		if is_instance_valid(button):
			button.disabled = false
