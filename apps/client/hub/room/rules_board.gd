class_name HubRulesBoard
extends Control
## Measured pages, optional art by section title, and a blurred modal backdrop.

var _shade := ColorRect.new()
var _board: XomDaoBoard = XomDaoBoard.create("Luật", true)
var _body := Control.new()
var _heading := Label.new()
var _text := Label.new()
var _placeholder := Panel.new()
var _image := TextureRect.new()
var _image_label := Label.new()
var _previous: XomDaoButton = XomDaoButton.create("Trước", XomDaoUi.Kind.INFO)
var _next: XomDaoButton = XomDaoButton.create("Sau", XomDaoUi.Kind.INFO)
var _counter := Label.new()
var _pages: Array[Dictionary] = []
var _sections: Array[Dictionary] = []
var _illustrations: Dictionary = {}
var _page: int = 0
var _closing: bool = false
var _gesture := Vector2.INF
var _page_tween: Tween
var _touch_index: int = -1
var _cancel_watch: HubTouchCancel


static func create(title: String, text: String, illustrations: Dictionary = {}) -> HubRulesBoard:
	var board := HubRulesBoard.new()
	board._board.title = title
	board._sections = sections(text)
	board._illustrations = illustrations
	return board


static func plain(markdown: String) -> String:
	var lines: PackedStringArray = []
	for line: String in markdown.split("\n"):
		if line.begins_with("# ") and lines.is_empty():
			continue
		var text: String = line.lstrip("#").strip_edges() if line.begins_with("#") else line
		if text.begins_with("- "):
			text = "• " + text.substr(2)
		lines.append(text.replace("**", "").replace("`", ""))
	return "\n".join(lines).strip_edges()


static func sections(markdown: String) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var title: String = "Giới thiệu"
	var lines: PackedStringArray = []
	for line: String in markdown.split("\n"):
		if line.begins_with("# "):
			continue
		if line.begins_with("##"):
			if not "\n".join(lines).strip_edges().is_empty():
				out.append({"title": title, "body": plain("\n".join(lines))})
			title = line.lstrip("#").strip_edges()
			lines.clear()
		else:
			lines.append(line)
	if not "\n".join(lines).strip_edges().is_empty():
		out.append({"title": title, "body": plain("\n".join(lines))})
	if out.is_empty():
		out.append({"title": title, "body": "Luật đang được cập nhật."})
	return out


static func paginate(
	source: Array[Dictionary], width: float, height: float, font_size: int
) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var font: Font = XomDaoUi.body_font()
	for section: Dictionary in source:
		var chunk: String = ""
		for line: String in str(section["body"]).split("\n"):
			var first: bool = true
			if line.is_empty() and chunk != "":
				chunk += "\n"
			for word: String in line.split(" ", false):
				var separator: String = ("\n" if first else " ") if chunk != "" else ""
				var candidate: String = chunk + separator + word
				var measured: Vector2 = font.get_multiline_string_size(
					candidate, HORIZONTAL_ALIGNMENT_LEFT, width, font_size
				)
				if measured.y > height - font_size and chunk != "":
					out.append({"title": section["title"], "body": chunk.strip_edges()})
					chunk = word
				else:
					chunk = candidate
				first = false
		if chunk != "":
			out.append({"title": section["title"], "body": chunk.strip_edges()})
	return out


func _init() -> void:
	name = "RulesBoard"
	theme = XomDaoUi.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.name = "RulesShade"
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var blur := ShaderMaterial.new()
	blur.shader = preload("res://hub/room/rules_blur.gdshader")
	_shade.material = blur
	_shade.gui_input.connect(_on_shade_input)
	add_child(_shade)
	_board.name = "RulesPanel"
	_board._close.name = "CloseRules"
	_board.closed.connect(_dismiss)
	add_child(_board)
	_body.mouse_filter = Control.MOUSE_FILTER_STOP
	_body.gui_input.connect(_on_body_input)
	_board.content.add_child(_body)
	_heading.name = "RulesHeading"
	_heading.add_theme_font_override("font", XomDaoUi.display_font())
	_heading.add_theme_font_size_override("font_size", 40)
	_heading.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text.name = "RulesText"
	_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text.add_theme_font_override("font", XomDaoUi.body_font())
	for label: Label in [_heading, _text, _counter, _image_label]:
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		label.add_theme_color_override("font_color", XomDaoUi.INK)
	for child: Control in [_heading, _text, _placeholder, _image, _previous, _counter, _next]:
		_body.add_child(child)
	_placeholder.name = "RulesArtPlaceholder"
	_placeholder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_placeholder.add_theme_stylebox_override(
		"panel", XomDaoUi.box(XomDaoUi.SAND, XomDaoUi.PAPER_DARK, 2, 16)
	)
	_image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	var image_icon := TextureRect.new()
	image_icon.texture = preload("res://hub/room/image_placeholder.svg")
	image_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	image_icon.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	image_icon.offset_left = -44
	image_icon.offset_right = 44
	image_icon.offset_top = -64
	image_icon.offset_bottom = 24
	_placeholder.add_child(image_icon)
	_image_label.text = "Ảnh minh họa"
	_image_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_image_label.add_theme_font_size_override("font_size", 26)
	_placeholder.add_child(_image_label)
	_previous.name = "RulesPrevious"
	_next.name = "RulesNext"
	_previous.pressed.connect(_turn_page.bind(-1))
	_next.pressed.connect(_turn_page.bind(1))
	_counter.name = "RulesPage"
	_counter.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_counter.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_counter.add_theme_font_override("font", XomDaoUi.display_font())
	_counter.add_theme_font_size_override("font_size", 28)
	resized.connect(_layout)


func _ready() -> void:
	_cancel_watch = HubTouchCancel.new(self, _cancel_gesture)
	_layout()
	_board.open()
	modulate.a = 0.0
	create_tween().tween_property(self, "modulate:a", 1.0, 0.2)


func _layout() -> void:
	if _sections.is_empty():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var width: float = minf(1180.0, size.x - inset.x * 2.0 - 32.0)
	var height: float = minf(650.0, size.y - inset.y * 2.0 - 32.0)
	_board.custom_minimum_size = Vector2(width, height)
	_body.custom_minimum_size = Vector2(0, height - 184.0)
	_board.size = _board.custom_minimum_size
	_board.position = (size - _board.size) / 2.0
	var content_width: float = width - 88.0
	var content_height: float = height - 184.0
	var column: float = (content_width - 32.0) * 0.5
	_heading.position = Vector2.ZERO
	_heading.size = Vector2(column, 68)
	_text.position = Vector2(0, 80)
	_text.size = Vector2(column, content_height - 184)
	_text.add_theme_font_size_override("font_size", 26)
	_placeholder.position = Vector2(column + 32.0, 0)
	_placeholder.size = Vector2(column, content_height - 112)
	_image.position = _placeholder.position
	_image.size = _placeholder.size
	_image_label.position = Vector2(0, _placeholder.size.y / 2 + 44)
	_image_label.size = Vector2(column, 40)
	var footer: float = content_height - 88.0
	_previous.position = Vector2(content_width / 2.0 - 254, footer)
	_previous.size = Vector2(176, 88)
	_counter.position = Vector2(content_width / 2.0 - 70, footer)
	_counter.size = Vector2(140, 88)
	_next.position = Vector2(content_width / 2.0 + 78, footer)
	_next.size = Vector2(176, 88)
	_pages = paginate(_sections, column, _text.size.y, 26)
	_page = clampi(_page, 0, maxi(0, _pages.size() - 1))
	_show_page()


func _show_page() -> void:
	if _pages.is_empty():
		return
	var page: Dictionary = _pages[_page]
	_heading.text = str(page["title"])
	_text.text = str(page["body"])
	_counter.text = "%d / %d" % [_page + 1, _pages.size()]
	_previous.disabled = _page == 0
	_next.disabled = _page == _pages.size() - 1
	_image.texture = _illustrations.get(page["title"]) as Texture2D
	_image.visible = _image.texture != null
	_placeholder.visible = not _image.visible


func _turn_page(direction: int) -> void:
	if _closing:
		return
	var next: int = clampi(_page + direction, 0, _pages.size() - 1)
	if next == _page:
		return
	_page = next
	if _page_tween != null:
		_page_tween.kill()
	_show_page()
	XomDaoUi.play(self, XomDaoUi.SOUND_PANEL)
	_text.modulate.a = 0.0
	_page_tween = create_tween()
	_page_tween.tween_property(_text, "modulate:a", 1.0, 0.18)


func _on_shade_input(event: InputEvent) -> void:
	if (
		(
			event is InputEventMouseButton
			and event.pressed
			and event.button_index == MOUSE_BUTTON_LEFT
		)
		or (event is InputEventScreenTouch and event.pressed)
	):
		_dismiss()


func _on_body_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed and _gesture == Vector2.INF:
		_touch_index = event.index
		_gesture = (
			get_global_transform_with_canvas().affine_inverse()
			* _body.get_global_transform_with_canvas()
			* event.position
		)
	elif (
		event is InputEventMouseButton
		and event.device != InputEvent.DEVICE_ID_EMULATION
		and event.button_index == MOUSE_BUTTON_LEFT
		and event.pressed
	):
		_gesture = get_local_mouse_position()


func _input(event: InputEvent) -> void:
	if _gesture == Vector2.INF:
		return
	if event is InputEventScreenTouch and event.index == _touch_index and not event.pressed:
		if event.canceled:
			_cancel_gesture()
		else:
			_swipe(get_global_transform_with_canvas().affine_inverse() * event.position)
		_touch_index = -1
	elif (
		_touch_index < 0
		and event is InputEventMouseButton
		and event.device != InputEvent.DEVICE_ID_EMULATION
		and event.button_index == MOUSE_BUTTON_LEFT
		and not event.pressed
	):
		_swipe(get_local_mouse_position())
	else:
		return
	get_viewport().set_input_as_handled()


func _cancel_gesture() -> void:
	_gesture = Vector2.INF
	_touch_index = -1


func _swipe(at: Vector2) -> void:
	var delta: Vector2 = at - _gesture
	_gesture = Vector2.INF
	if absf(delta.x) > 64.0 and absf(delta.x) > absf(delta.y):
		_turn_page(1 if delta.x < 0 else -1)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		_dismiss()
	elif event.is_action_pressed("ui_left"):
		_turn_page(-1)
	elif event.is_action_pressed("ui_right"):
		_turn_page(1)
	else:
		return
	get_viewport().set_input_as_handled()


func _dismiss() -> void:
	if _closing:
		return
	_closing = true
	_board.visible = true
	XomDaoUi.play(self, XomDaoUi.SOUND_PANEL)
	var tween: Tween = create_tween()
	tween.tween_property(self, "modulate:a", 0.0, 0.16)
	tween.tween_callback(queue_free)
