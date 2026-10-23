extends RefCounted
## The table's emote pieces: a seat's speech bubble (`bubble`), the picker's sticker buttons
## (`fill`), and whether an event is a press (`pressed`).


## Seat `seat`'s hidden bubble (Emote_<seat>): the bubble art (upside down for the seat at the
## top) with an empty Sticker inside.
static func bubble(
	seat: int, art_texture: Texture2D, side: float, sticker_side := 128.0
) -> Control:
	var out := Control.new()
	out.name = "Emote_%d" % seat
	out.mouse_filter = Control.MOUSE_FILTER_IGNORE
	out.custom_minimum_size = Vector2.ONE * side
	var art := TextureRect.new()
	art.name = "BubbleArt"
	art.texture = art_texture
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	art.flip_v = seat == 1
	art.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	out.add_child(art)
	var sticker := TextureRect.new()
	sticker.name = "Sticker"
	sticker.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	sticker.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	sticker.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	sticker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sticker.custom_minimum_size = Vector2.ONE * sticker_side
	sticker.size = sticker.custom_minimum_size
	sticker.position = Vector2(26.0, 21.0)
	out.add_child(sticker)
	out.visible = false
	out.z_index = 5
	return out


## One button per owned look (Emote_<look>) in `grid`; a tap calls `on_pick` with the look.
static func fill(grid: GridContainer, looks: Array[String], on_pick: Callable) -> void:
	for look: String in looks:
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
		pick.pressed.connect(on_pick.bind(look))
		grid.add_child(pick)


## A left click or a touch going down.
static func pressed(event: InputEvent) -> bool:
	var mouse := event as InputEventMouseButton
	var touch := event as InputEventScreenTouch
	return (
		(mouse != null and mouse.button_index == MOUSE_BUTTON_LEFT and mouse.pressed)
		or (touch != null and touch.pressed)
	)
