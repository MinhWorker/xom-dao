extends XomDaoButton
## Uses the same bright, engraved tooltip treatment across the tile HUD.

const BANK_ICON := preload("res://addons/xomdao_sdk/ui/icons/bank.svg")


func _make_custom_tooltip(for_text: String) -> Object:
	var panel := PanelContainer.new()
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color("#143A3D")
	panel_style.border_color = Color("#D8B46C")
	panel_style.set_border_width_all(2)
	panel_style.set_corner_radius_all(12)
	panel_style.shadow_color = Color("#061B22B0")
	panel_style.shadow_size = 6
	panel_style.content_margin_left = 12.0
	panel_style.content_margin_top = 7.0
	panel_style.content_margin_right = 14.0
	panel_style.content_margin_bottom = 7.0
	panel.add_theme_stylebox_override("panel", panel_style)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	panel.add_child(row)
	var icon := TextureRect.new()
	icon.texture = BANK_ICON
	icon.modulate = Color("#F7EED9")
	icon.custom_minimum_size = Vector2(22.0, 22.0)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	row.add_child(icon)

	var label := Label.new()
	label.text = for_text
	label.custom_minimum_size.x = 116.0
	label.add_theme_font_override("font", XomDaoUi.display_font(700))
	label.add_theme_font_size_override("font_size", 22)
	label.add_theme_color_override("font_color", Color("#FFF5D9"))
	label.add_theme_color_override("font_outline_color", Color("#082429"))
	label.add_theme_constant_override("outline_size", 2)
	row.add_child(label)
	return panel
