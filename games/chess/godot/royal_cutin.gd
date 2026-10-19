extends RefCounted
## The British royal-style check banner, kept out of the chess table's game-state code.

const ROYAL_CREST = preload("res://content/chess/royal_crest.gd")


static func present(
	owner: Control,
	board: Control,
	mate: bool,
	checker: String,
	attacker: String,
	piece_texture: Texture2D
) -> Control:
	var overlay := Control.new()
	overlay.name = "CutIn"
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.modulate.a = 0.0
	owner.add_child(overlay)
	var shade := ColorRect.new()
	shade.color = Color("#10080A", 0.40)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.add_child(shade)

	var banner := PanelContainer.new()
	banner.name = "RoyalBanner"
	banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var width: float = minf(620.0, board.size.x * 0.92)
	banner.custom_minimum_size.x = width
	var style: StyleBoxFlat = XomDaoUi.box(Color("#351019"), Color("#D0A74E"), 3, 12.0)
	style.content_margin_left = 22.0
	style.content_margin_right = 26.0
	style.content_margin_top = 14.0
	style.content_margin_bottom = 14.0
	style.shadow_color = Color("#0A0507", 0.75)
	style.shadow_size = 16
	style.shadow_offset = Vector2(0, 8)
	banner.add_theme_stylebox_override("panel", style)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 18)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	banner.add_child(row)
	var crest := Control.new()
	crest.name = "RoyalCrest"
	crest.set_script(ROYAL_CREST)
	crest.custom_minimum_size = Vector2(88.0, 96.0)
	crest.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(crest)
	var piece := TextureRect.new()
	piece.name = "CheckingPiece"
	piece.texture = piece_texture
	piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	piece.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
	piece.position = Vector2(14.0, 34.0)
	piece.size = Vector2(60.0, 58.0)
	crest.add_child(piece)
	var rule := ColorRect.new()
	rule.color = Color("#C99B43")
	rule.custom_minimum_size = Vector2(2.0, 72.0)
	rule.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(rule)
	var copy := VBoxContainer.new()
	copy.alignment = BoxContainer.ALIGNMENT_CENTER
	copy.add_theme_constant_override("separation", 2)
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	copy.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(copy)
	var piece_name: String = str(
		{"k": "VUA", "q": "HẬU", "r": "XE", "b": "TƯỢNG", "n": "MÃ", "p": "TỐT"}.get(
			checker.to_lower(), "QUÂN CHIẾU"
		)
	)
	var overline := Label.new()
	overline.text = "%s RA CHIẾU · %s" % [attacker.to_upper(), piece_name]
	overline.add_theme_font_override("font", XomDaoUi.display_font(700))
	overline.add_theme_font_size_override("font_size", 24)
	overline.add_theme_color_override("font_color", Color("#E3C685"))
	overline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	overline.mouse_filter = Control.MOUSE_FILTER_IGNORE
	copy.add_child(overline)
	var title := Label.new()
	title.text = "CHIẾU HẾT!" if mate else "CHIẾU TƯỚNG!"
	title.add_theme_font_override("font", XomDaoUi.display_font(900))
	title.add_theme_font_size_override("font_size", 44)
	title.add_theme_color_override("font_color", Color("#FFF2D4"))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	copy.add_child(title)
	overlay.add_child(banner)
	banner.reset_size()
	var target: Vector2 = board.position + (board.size - banner.size) / 2.0
	banner.position = target + Vector2(-minf(72.0, width * 0.12), 0.0)
	banner.pivot_offset = banner.size / 2.0
	banner.scale = Vector2.ONE * 0.94
	var tween: Tween = overlay.create_tween()
	tween.tween_property(overlay, "modulate:a", 1.0, 0.12)
	tween.parallel().tween_property(banner, "position", target, 0.3).set_trans(Tween.TRANS_BACK)
	tween.parallel().tween_property(banner, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK)
	tween.tween_interval(0.72)
	tween.tween_property(overlay, "modulate:a", 0.0, 0.25)
	tween.tween_callback(overlay.queue_free)
	return overlay
