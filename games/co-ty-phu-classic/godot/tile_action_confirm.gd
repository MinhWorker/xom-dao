extends RefCounted
## A shared-game confirmation board for mortgage actions selected from the tile HUD.

signal confirmed(event: String, payload: Dictionary)

var _shade: ColorRect


func open_mortgage(host: Control, square: int, tile_name: String, amount: String) -> void:
	if is_instance_valid(_shade):
		return
	_shade = ColorRect.new()
	_shade.name = "MortgageConfirmShade"
	_shade.color = Color(XomDaoUi.INK, 0.58)
	_shade.mouse_filter = Control.MOUSE_FILTER_STOP
	_shade.z_index = 100
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	host.add_child(_shade)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.add_child(center)
	var board: XomDaoBoard = XomDaoBoard.create("Chắc chứ?", true)
	board.name = "MortgageConfirm"
	board.custom_minimum_size = Vector2(minf(host.size.x - 48.0, 540.0), 0.0)
	var title: Label = board.get("_title") as Label
	title.name = "MortgageConfirmTitle"
	center.add_child(board)
	var note := Label.new()
	note.name = "MortgageConfirmMessage"
	note.text = "Thế chấp %s để nhận %s ₫." % [tile_name, amount]
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.add_theme_font_override("font", XomDaoUi.body_font(true))
	note.add_theme_font_size_override("font_size", 24)
	note.add_theme_color_override("font_color", XomDaoUi.INK)
	board.content.add_child(note)
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 16)
	board.content.add_child(buttons)
	var cancel: XomDaoButton = XomDaoButton.create("Để sau", XomDaoUi.Kind.BACK)
	cancel.name = "CancelMortgage"
	cancel.pressed.connect(board.close)
	buttons.add_child(cancel)
	var accept: XomDaoButton = XomDaoButton.create("Thế chấp", XomDaoUi.Kind.SOCIAL)
	accept.name = "ConfirmMortgage"
	accept.pressed.connect(_confirm.bind(board, "mortgage", {"square": square}))
	buttons.add_child(accept)
	board.closed.connect(_dismiss.bind(_shade))
	board.open()


func _confirm(board: XomDaoBoard, event: String, payload: Dictionary) -> void:
	board.close()
	confirmed.emit(event, payload)


func _dismiss(shade: ColorRect) -> void:
	if is_instance_valid(shade):
		shade.queue_free()
	if _shade == shade:
		_shade = null
