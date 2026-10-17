class_name XomDaoMenu
extends Control
## The shell's one in-game control: the ☰ button in the top left corner (88 × 88, the margin
## from the edge set in the settings) and the shared menu board it opens: the settings on two
## tabs (Giao diện: HUD size, margin, picture quality; Âm thanh: music and sound effects, each
## with a switch and a volume), then leave the room, rules and emotes. Games leave that corner
## empty.
##
##   var menu := XomDaoMenu.new()
##   add_child(menu)                 # covers its parent; only the button and board take input
##   menu.leave_requested.connect(...)
## The settings apply by themselves (XomDaoSettings); the rest is up to the screen.
## After `leave_requested`, the screen can call `confirm_leave(title, message, label, action)`;
## the confirmed action is returned through `leave_confirmed`.

signal leave_requested
signal leave_confirmed(game_action: bool)
signal rules_requested
signal emote_chosen(emote: String)

## Emotes offered in the menu, by id; each is a Phosphor icon of the same name.
const EMOTES: Array[String] = [
	"smiley", "smiley-wink", "smiley-sad", "smiley-angry", "thumbs-up", "hands-clapping"
]
const SCALE_LABELS: Array[String] = ["Vừa", "Lớn"]
const MARGIN_LABELS: Array[String] = ["Hẹp", "Vừa", "Rộng"]
const QUALITY_LABELS: Array[String] = ["Thấp", "Vừa", "Cao"]
const TAB_LABELS: Array[String] = ["Giao diện", "Âm thanh"]
## A page is three rows tall whatever its tab holds, so the board keeps its size.
const PAGE_SIZE := Vector2(640.0, 3.0 * XomDaoChoice.HEIGHT + 2.0 * 16.0)

var button: XomDaoIconButton = XomDaoIconButton.create("list")
var board: XomDaoBoard = XomDaoBoard.create("Menu", true)
var music: XomDaoSlider = XomDaoSlider.create()
var music_switch: XomDaoIconButton = XomDaoIconButton.create("speaker-high")
var sfx: XomDaoSlider = XomDaoSlider.create()
var sfx_switch: XomDaoIconButton = XomDaoIconButton.create("speaker-high")
var ui_scale: XomDaoChoice = XomDaoChoice.create(SCALE_LABELS)
var margin: XomDaoChoice = XomDaoChoice.create(MARGIN_LABELS)
var quality: XomDaoChoice = XomDaoChoice.create(QUALITY_LABELS)

var _settings: XomDaoSettings
var _shade := ColorRect.new()
var _side := VBoxContainer.new()
var _tabs: Array[Button] = []
var _pages: Array[Control] = []
var _tab: int = 0


func _init(settings: XomDaoSettings = null) -> void:
	_settings = settings if settings != null else XomDaoSettings.current()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	button.pressed.connect(open)
	add_child(button)
	_shade.color = Color(XomDaoUi.INK, 0.45)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.visible = false
	_shade.gui_input.connect(_on_shade_input)
	add_child(_shade)
	board.visible = false
	board.closed.connect(_on_closed)
	add_child(board)
	_build_board()
	_settings.changed.connect(_sync)
	resized.connect(_layout)
	_sync()


func is_open() -> bool:
	return board.visible


func open() -> void:
	board.title = "Menu"
	_side.visible = true
	_show()


## Only the settings (⚙ outside a game): no leaving, rules or emotes.
func open_settings() -> void:
	board.title = "Cài đặt"
	_side.visible = false
	_show()


func confirm_leave(
	title: String, message: String, confirm_label: String, game_action: bool = false
) -> void:
	close()
	var confirm: XomDaoBoard = XomDaoBoard.create(title, true)
	confirm.name = "ConfirmLeaveBoard"
	confirm.custom_minimum_size = Vector2(minf(size.x - 48.0, 540.0), 0.0)
	var shade := ColorRect.new()
	shade.name = "ConfirmLeaveShade"
	shade.color = Color(XomDaoUi.INK, 0.45)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.add_child(center)
	center.add_child(confirm)
	var note := Label.new()
	note.text = message
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	confirm.content.add_child(note)
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 16)
	confirm.content.add_child(buttons)
	var stay: XomDaoButton = XomDaoButton.create("Ở lại", XomDaoUi.Kind.BACK)
	stay.name = "Stay"
	stay.pressed.connect(shade.queue_free)
	buttons.add_child(stay)
	var leave: XomDaoButton = XomDaoButton.create(confirm_label, XomDaoUi.Kind.DANGER)
	leave.name = "ConfirmLeave"
	leave.pressed.connect(
		func() -> void:
			shade.queue_free()
			leave_confirmed.emit(game_action)
	)
	buttons.add_child(leave)
	confirm.closed.connect(shade.queue_free)
	confirm.open()


func _show() -> void:
	_shade.visible = true
	_layout()
	board.open()


func close() -> void:
	if board.visible:
		board.close()


func _on_closed() -> void:
	_shade.visible = false


func _on_shade_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close()


## Shows a settings tab: 0 Giao diện, 1 Âm thanh.
func show_tab(index: int) -> void:
	_tab = clampi(index, 0, _pages.size() - 1)
	for i: int in _pages.size():
		_pages[i].visible = i == _tab
		_style_tab(_tabs[i], i == _tab)


func _build_board() -> void:
	ui_scale.changed.connect(
		func(index: int) -> void: _settings.set_value("ui_scale", XomDaoSettings.SCALES[index])
	)
	margin.changed.connect(
		func(index: int) -> void: _settings.set_value("margin", XomDaoSettings.MARGINS[index])
	)
	quality.changed.connect(
		func(index: int) -> void: _settings.set_value("quality", XomDaoSettings.QUALITIES[index])
	)
	music.name = "MusicVolume"
	music.changed.connect(func(value: float) -> void: _settings.set_value("music_volume", value))
	music_switch.name = "MusicSwitch"
	music_switch.pressed.connect(func() -> void: _settings.set_value("music", not _settings.music))
	sfx.name = "SfxVolume"
	sfx.changed.connect(func(value: float) -> void: _settings.set_value("sfx_volume", value))
	sfx_switch.name = "SfxSwitch"
	sfx_switch.pressed.connect(func() -> void: _settings.set_value("sfx", not _settings.sfx))
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 24)
	board.content.add_child(columns)
	# Left: the settings. Tabs on top, then the tab's rows: a label and its control each.
	var settings := VBoxContainer.new()
	settings.add_theme_constant_override("separation", 8)
	columns.add_child(settings)
	var tabs := HBoxContainer.new()
	tabs.name = "Tabs"
	tabs.add_theme_constant_override("separation", 8)
	settings.add_child(tabs)
	for i: int in TAB_LABELS.size():
		var tab := Button.new()
		tab.name = "Tab_%d" % i
		tab.text = TAB_LABELS[i]
		tab.focus_mode = Control.FOCUS_NONE
		tab.custom_minimum_size = Vector2(200.0, XomDaoUi.TOUCH)
		tab.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		tab.add_theme_font_override("font", XomDaoUi.display_font(800))
		tab.add_theme_font_size_override("font_size", 30)
		tab.pressed.connect(_on_tab.bind(i))
		tabs.add_child(tab)
		_tabs.append(tab)
	settings.add_child(XomDaoDivider.create())
	_pages.append(
		_page(
			"Interface", [["Cỡ giao diện", ui_scale], ["Lề", margin], ["Chất lượng hình", quality]]
		)
	)
	_pages.append(
		_page(
			"Audio",
			[["Nhạc", _volume(music_switch, music)], ["Hiệu ứng", _volume(sfx_switch, sfx)]]
		)
	)
	for page: Control in _pages:
		settings.add_child(page)
	show_tab(0)
	# Right: leave, rules, then the emotes.
	var side: VBoxContainer = _side
	side.add_theme_constant_override("separation", 12)
	side.custom_minimum_size.x = 3.0 * XomDaoIconButton.SIZE + 16.0
	columns.add_child(side)
	var leave: XomDaoButton = XomDaoButton.create("Rời phòng", XomDaoUi.Kind.DANGER)
	leave.name = "Leave"
	leave.icon = XomDaoUi.icon("sign-out")
	leave.pressed.connect(_leave)
	side.add_child(leave)
	var rules: XomDaoButton = XomDaoButton.create("Luật", XomDaoUi.Kind.INFO)
	rules.name = "Rules"
	rules.icon = XomDaoUi.icon("book-open")
	rules.pressed.connect(_rules)
	side.add_child(rules)
	side.add_child(XomDaoDivider.create())
	var emotes := GridContainer.new()
	emotes.name = "Emotes"
	emotes.columns = 3
	emotes.add_theme_constant_override("h_separation", 8)
	emotes.add_theme_constant_override("v_separation", 8)
	for emote: String in EMOTES:
		var pick: XomDaoIconButton = XomDaoIconButton.create(emote)
		pick.name = emote
		pick.pressed.connect(_emote.bind(emote))
		emotes.add_child(pick)
	side.add_child(emotes)


## One tab's rows, [[label, control], …], with a wave between them.
func _page(page_name: String, rows: Array) -> Control:
	var page := VBoxContainer.new()
	page.name = page_name
	page.custom_minimum_size = PAGE_SIZE
	page.add_theme_constant_override("separation", 0)
	for i: int in rows.size():
		if i > 0:
			page.add_child(XomDaoDivider.create())
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 16)
		var label := Label.new()
		label.text = rows[i][0]
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.add_theme_font_override("font", XomDaoUi.body_font(true))
		label.add_theme_font_size_override("font_size", 26)
		label.add_theme_color_override("font_color", XomDaoUi.INK)
		row.add_child(label)
		var control: Control = rows[i][1]
		control.size_flags_horizontal = Control.SIZE_SHRINK_END
		if control is XomDaoChoice:
			control.add_theme_constant_override("separation", 6)
		row.add_child(control)
		page.add_child(row)
	return page


## A sound row's control: its on/off switch, then its volume.
func _volume(switch: XomDaoIconButton, slider: XomDaoSlider) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	row.add_child(switch)
	slider.custom_minimum_size.x = 360.0
	row.add_child(slider)
	return row


func _on_tab(index: int) -> void:
	if index == _tab:
		return
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	show_tab(index)


## The chosen tab is a honey wood plate, like the board's frame; the others are plain text.
func _style_tab(tab: Button, on: bool) -> void:
	var fill: Color = XomDaoUi.HONEY if on else Color(XomDaoUi.PAPER_DARK, 0.0)
	var edge: Color = XomDaoUi.HONEY_DARK if on else Color(XomDaoUi.PAPER_DARK, 0.0)
	var style: StyleBoxFlat = XomDaoUi.box(fill, edge, XomDaoUi.BORDER, 20.0)
	style.content_margin_left = 20.0
	style.content_margin_right = 20.0
	var hover: StyleBoxFlat = style.duplicate()
	hover.bg_color = fill.lightened(0.08) if on else Color(XomDaoUi.PAPER_DARK, 0.5)
	for state: String in ["normal", "pressed", "hover_pressed", "disabled"]:
		tab.add_theme_stylebox_override(state, style)
	tab.add_theme_stylebox_override("hover", hover)
	tab.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	var text: Color = XomDaoUi.CREAM if on else Color(XomDaoUi.INK, 0.7)
	for state: String in ["font_color", "font_hover_color", "font_pressed_color"]:
		tab.add_theme_color_override(state, text)


func _leave() -> void:
	close()
	leave_requested.emit()


func _rules() -> void:
	close()
	rules_requested.emit()


func _emote(emote: String) -> void:
	close()
	emote_chosen.emit(emote)


## Shows the saved settings on the board and applies the HUD scale and margin to the button.
func _sync() -> void:
	music.value = _settings.music_volume
	music.dimmed = not _settings.music
	music_switch.icon_name = "speaker-high" if _settings.music else "speaker-slash"
	sfx.value = _settings.sfx_volume
	sfx.dimmed = not _settings.sfx
	sfx_switch.icon_name = "speaker-high" if _settings.sfx else "speaker-slash"
	ui_scale.selected = maxi(0, XomDaoSettings.SCALES.find(_settings.ui_scale))
	margin.selected = maxi(0, XomDaoSettings.MARGINS.find(_settings.margin))
	quality.selected = maxi(0, XomDaoSettings.QUALITIES.find(_settings.quality))
	button.scale = Vector2.ONE * _settings.ui_scale
	_layout()


func _layout() -> void:
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	button.position = inset + Vector2.ONE * _settings.margin
	board.reset_size()
	board.position = (size - board.size) / 2.0
