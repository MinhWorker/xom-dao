class_name BattleshipEmotePicker
extends Control
## An SDK-styled picker for the player's equipped emotes, opened from their avatar.

const BOARD_HEADER_INSET := 12.0
const BOARD_CLOSE_INSET := 8.0

var _client: XomDaoClient
var _anchor: Control
var _shade := ColorRect.new()
var _board: XomDaoBoard = XomDaoBoard.create("Biểu cảm", true)
var _grid := GridContainer.new()
var _note := Label.new()
var _owned: Array[String] = []
var _loading: bool = false


func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _ready() -> void:
	theme = XomDaoUi.theme()
	_shade.color = Color(XomDaoUi.INK, 0.28)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.visible = false
	_shade.gui_input.connect(_on_shade_input)
	add_child(_shade)
	_board.name = "EmotePanel"
	var heading_font: Font = XomDaoUi.display_font(800)
	var heading_width: float = (
		heading_font.get_string_size("Biểu cảm", HORIZONTAL_ALIGNMENT_CENTER, -1, XomDaoUi.TITLE).x
	)
	# The SDK board's plain header doesn't contribute to its minimum width. Reserve room for the
	# centered title and the close button's touch target, even when the player owns one emote.
	_board.custom_minimum_size.x = (
		heading_width + 2.0 * (XomDaoUi.TOUCH + BOARD_HEADER_INSET + BOARD_CLOSE_INSET)
	)
	_board.visible = false
	_board.closed.connect(_on_board_closed)
	_grid.name = "Emotes"
	_grid.columns = 3
	_grid.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_grid.add_theme_constant_override("h_separation", 8)
	_grid.add_theme_constant_override("v_separation", 8)
	_note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_note.theme_type_variation = "SmallLabel"
	_note.add_theme_font_override("font", XomDaoUi.body_font(true))
	_note.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_note.add_theme_color_override("font_color", XomDaoUi.INK)
	_board.content.add_child(_note)
	_board.content.add_child(_grid)
	add_child(_board)
	_rebuild()
	resized.connect(_layout)
	if _client != null and _client.user != null:
		_load_owned.call_deferred()


func bind(client: XomDaoClient) -> void:
	_client = client
	if not client.connected.is_connected(_load_owned):
		client.connected.connect(_load_owned)
	if client.user != null:
		_load_owned.call_deferred()


func toggle(anchor: Control) -> void:
	if _board.visible:
		_board.close()
		return
	_anchor = anchor
	_rebuild()
	_shade.visible = true
	_board.visible = true
	_board.reset_size()
	_layout()
	_board.open()


func _on_shade_input(event: InputEvent) -> void:
	var mouse := event as InputEventMouseButton
	var touch := event as InputEventScreenTouch
	if (
		(mouse != null and mouse.button_index == MOUSE_BUTTON_LEFT and mouse.pressed)
		or (touch != null and touch.pressed)
	):
		_shade.accept_event()
		_board.close()


func _on_board_closed() -> void:
	_shade.visible = false
	_anchor = null


func _layout() -> void:
	if not _board.visible:
		return
	_board.reset_size()
	var panel_size: Vector2 = _board.size
	var popup: Vector2 = (size - panel_size) / 2.0
	if is_instance_valid(_anchor) and _anchor.is_inside_tree():
		var avatar: Rect2 = _anchor.get_global_rect()
		popup = (
			avatar.position + Vector2(avatar.size.x + 18.0, (avatar.size.y - panel_size.y) / 2.0)
		)
		if popup.x + panel_size.x > size.x - XomDaoFrame.safe_inset(self).x:
			popup.x = avatar.position.x - panel_size.x - 18.0
	var inset: Vector2 = (
		XomDaoFrame.safe_inset(self) + Vector2.ONE * float(XomDaoSettings.current().margin)
	)
	var maximum: Vector2 = size - inset - panel_size
	_board.position = (
		get_global_transform_with_canvas().affine_inverse() * popup.clamp(inset, maximum.max(inset))
	)


func _load_owned() -> void:
	if _client == null or _client.user == null or _loading:
		return
	_loading = true
	_rebuild()
	var looks: Array[String] = await _client.owned_emotes()
	_loading = false
	if not is_inside_tree():
		return
	_owned = looks
	_rebuild()
	if _board.visible:
		_layout()


func _rebuild() -> void:
	for child: Node in _grid.get_children():
		_grid.remove_child(child)
		child.queue_free()
	for look: String in _owned:
		var sticker: Texture2D = XomDaoLooks.emote(look)
		if sticker == null:
			continue
		var pick := XomDaoIconButton.create("")
		pick.name = "Emote_%s" % look
		pick.icon = sticker
		pick.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		for state: String in ["normal", "hover", "pressed", "disabled", "hover_pressed"]:
			var icon_style := StyleBoxEmpty.new()
			icon_style.set_content_margin_all(12.0)
			icon_style.content_margin_top = 10.0 - XomDaoIconButton.DEPTH / 2.0
			icon_style.content_margin_bottom = 10.0 + XomDaoIconButton.DEPTH / 2.0
			pick.add_theme_stylebox_override(state, icon_style)
		for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
			pick.add_theme_color_override(state, Color.WHITE)
		pick.tooltip_text = str(XomDaoMenu.EMOTE_LABELS.get(look, look))
		pick.pressed.connect(_choose.bind(look))
		_grid.add_child(pick)
	_grid.visible = _grid.get_child_count() > 0
	_note.visible = not _grid.visible
	_note.text = "Đang tải biểu cảm" if _loading else "Chưa có biểu cảm"


func _choose(look: String) -> void:
	if _client == null or not _owned.has(look):
		return
	_board.close()
	await _client.send_emote(look)
