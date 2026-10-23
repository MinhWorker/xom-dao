class_name XomDaoTableSkin
extends RefCounted
## The materials a game dresses the shared table HUD in, so the kit's pieces belong to its world
## (a lacquer tray, a felt table, a straw mat) instead of the hub's dark pills:
##
##   - `XomDaoPlayerSlot.skin`: the name plate, the chips beside it and the turn timer;
##   - `dress_button(button, role)`: an `XomDaoButton` as the table's "primary", "secondary" or
##     "danger" action;
##   - `dress_icon_button(button)`: a round `XomDaoIconButton` (the game's own, and the hub's ☰
##     when the game's `table_skin()` returns this);
##   - `dress_all(nodes)`: each of these by its type (a button's role from its kind);
##   - `plate_box()`: a StyleBox of the plate for the game's own plaques;
##   - `dress_panel(panel)`: an existing panel (a turn plaque) in the plate, keeping its margins
##     and shadow.
##
##   var skin := XomDaoTableSkin.new()
##   skin.plate = Color("#3B2A1A"); skin.edge = Color("#C9A25A"); skin.ink = Color("#F6E7C8")
##   slot.skin = skin
##   skin.dress_button(play_button, "primary")
##
## Every colour has the kit's default, so a game sets only what it changes.

## The name plate and plaques: fill, border and words.
var plate: Color = XomDaoUi.HUD
var edge: Color = XomDaoUi.BAMBOO_DARK
var ink: Color = XomDaoUi.CREAM
## Corner radius of the plate (20 is a pill; a few units read as wood or paper).
var radius: float = 20.0
## The chips beside a name (cards left, wins, level).
var chip: Color = XomDaoUi.BAMBOO_DARK
var chip_edge: Color = Color.TRANSPARENT
var chip_ink: Color = XomDaoUi.CREAM
## The turn timer round the avatar, and the track it runs on.
var timer: Color = XomDaoUi.GOLD
var timer_track: Color = Color(XomDaoUi.HUD, 0.5)
## Buttons by role: [face, edge, words]. Empty keeps the button's kind.
var primary: Array[Color] = []
var secondary: Array[Color] = []
var danger: Array[Color] = []
## The round icon buttons (☰ included): [disc, edge, icon]. Empty keeps the dark disc.
var round_button: Array[Color] = []
## The face used for names and buttons; null keeps the display font.
var font: Font


## The plate as a StyleBox, `border` thick.
func plate_box(border: int = 2) -> StyleBoxFlat:
	return XomDaoUi.box(plate, edge, border, radius)


## Repaints a PanelContainer's (or Panel's) StyleBoxFlat in the plate's fill, edge and corners;
## its margins, border width and shadow stay.
func dress_panel(panel: Control) -> void:
	var key: String = "panel"
	var style: StyleBox = panel.get_theme_stylebox(key)
	if style is not StyleBoxFlat:
		return
	var flat: StyleBoxFlat = (style as StyleBoxFlat).duplicate()
	flat.bg_color = plate
	flat.border_color = edge
	flat.set_corner_radius_all(int(radius))
	panel.add_theme_stylebox_override(key, flat)


## Dresses `button` as this table's `role` action ("primary", "secondary" or "danger").
func dress_button(button: XomDaoButton, role: String) -> void:
	var colors: Array[Color] = {"primary": primary, "secondary": secondary, "danger": danger}.get(
		role, []
	)
	if colors.size() >= 3:
		button.dress(colors[0], colors[1], colors[2])
	if font != null:
		button.add_theme_font_override("font", font)


## Dresses a round icon button in the table's disc.
func dress_icon_button(button: XomDaoIconButton) -> void:
	if round_button.size() < 3:
		return
	button.background = round_button[0]
	button.edge = round_button[1]
	button.border = 2
	for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		button.add_theme_color_override(state, round_button[2])
	button.add_theme_color_override("icon_disabled_color", Color(round_button[2], 0.4))


## Dresses each node by what it is: a player slot, a round icon button, a text button (its role
## from its kind: DANGER is "danger", PLAY and CONFIRM "primary", the rest "secondary") or a
## panel (`dress_panel`).
func dress_all(nodes: Array) -> void:
	for node: Variant in nodes:
		if node is XomDaoPlayerSlot:
			(node as XomDaoPlayerSlot).skin = self
		elif node is XomDaoIconButton:
			dress_icon_button(node)
		elif node is XomDaoButton:
			var button: XomDaoButton = node
			var role: String = "secondary"
			if button.kind == XomDaoUi.Kind.DANGER:
				role = "danger"
			elif button.kind in [XomDaoUi.Kind.PLAY, XomDaoUi.Kind.CONFIRM]:
				role = "primary"
			dress_button(button, role)
		elif node is Control:
			dress_panel(node)


## The hub's ☰ `button` in `game`'s `table_skin()`, or back in the kit's disc.
static func dress_menu(button: XomDaoIconButton, game: Node) -> void:
	var skin: Variant = game.call("table_skin") if game.has_method("table_skin") else null
	if skin is XomDaoTableSkin:
		(skin as XomDaoTableSkin).dress_icon_button(button)
	else:
		undress_icon_button(button)


## Puts a round icon button back in the kit's dark disc.
static func undress_icon_button(button: XomDaoIconButton) -> void:
	button.background = XomDaoUi.HUD
	button.edge = Color.TRANSPARENT
	button.border = 0
	for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		button.add_theme_color_override(state, XomDaoUi.CREAM)
	button.add_theme_color_override("icon_disabled_color", Color(XomDaoUi.CREAM, 0.4))
