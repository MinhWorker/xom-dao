extends GutTest
## The shared UI kit (addons/xomdao_sdk/ui): formatting, the player slot, settings and the menu.


func _settings() -> XomDaoSettings:
	var settings := XomDaoSettings.new()
	settings.path = ""
	return settings


func test_money_has_dots_between_thousands() -> void:
	assert_eq(XomDaoUi.money(0), "0")
	assert_eq(XomDaoUi.money(950), "950")
	assert_eq(XomDaoUi.money(2450), "2.450")
	assert_eq(XomDaoUi.money(1234567), "1.234.567")
	assert_eq(XomDaoUi.money(-20), "−20")


func test_changes_are_signed_and_coloured() -> void:
	assert_eq(XomDaoUi.delta(120), "+120")
	assert_eq(XomDaoUi.delta(-20), "−20")
	assert_eq(XomDaoUi.delta(0), "0")
	assert_eq(XomDaoUi.delta_color(5), XomDaoUi.UP)
	assert_eq(XomDaoUi.delta_color(-5, true), XomDaoUi.DOWN_ON_PAPER)
	assert_eq(XomDaoUi.delta_color(0, false, XomDaoUi.CREAM), XomDaoUi.CREAM)


func test_each_kind_of_action_has_its_own_background() -> void:
	var seen: Array[Color] = []
	for kind: XomDaoUi.Kind in XomDaoUi.Kind.values():
		if kind == XomDaoUi.Kind.PLAY:
			continue
		var background: Color = XomDaoUi.kind_colors(kind)[0]
		assert_false(seen.has(background), "kind %d" % kind)
		seen.append(background)
	var play: XomDaoButton = autofree(XomDaoButton.create("CHƠI", XomDaoUi.Kind.PLAY))
	var leave: XomDaoButton = autofree(XomDaoButton.create("Rời phòng", XomDaoUi.Kind.DANGER))
	assert_eq(play.custom_minimum_size.y, XomDaoButton.PLAY_HEIGHT)
	assert_true(leave.custom_minimum_size.y >= XomDaoUi.TOUCH)


func test_player_slot_runs_the_turn_timer_down() -> void:
	var slot: XomDaoPlayerSlot = add_child_autofree(XomDaoPlayerSlot.new())
	watch_signals(slot)
	assert_false(slot.is_turn())
	slot.start_turn(20.0, 5.0)
	assert_true(slot.is_turn())
	assert_almost_eq(slot.time_left(), 15.0, 0.001)
	assert_almost_eq(slot.avatar.turn, 0.75, 0.001)
	slot._process(10.0)
	assert_almost_eq(slot.avatar.turn, 0.25, 0.001)
	assert_signal_not_emitted(slot, "turn_ended")
	slot._process(10.0)
	assert_signal_emitted(slot, "turn_ended")
	assert_eq(slot.time_left(), 0.0)
	assert_false(slot.is_processing())
	slot.end_turn()
	assert_false(slot.is_turn())
	slot.show_turn()
	assert_eq(slot.avatar.turn, 1.0)


func test_player_slot_shows_host_level_and_counter() -> void:
	var slot: XomDaoPlayerSlot = add_child_autofree(XomDaoPlayerSlot.new())
	slot.player_name = "minh"
	assert_eq(slot.avatar.initial, "M")
	assert_false(slot.avatar.crown)
	slot.host = true
	assert_true(slot.avatar.crown)
	assert_false(slot._level.visible, "no level chip at 0")
	slot.level = 12
	assert_true(slot._level.visible)
	assert_eq(slot._level.text, "12")
	assert_false(slot._extra.visible)
	slot.extra = "8 lá"
	assert_true(slot._extra.visible)
	slot.extra = ""
	assert_false(slot._extra.visible)
	assert_eq(slot.avatar.custom_minimum_size.x, XomDaoPlayerSlot.AVATAR)
	slot.compact = true
	assert_eq(slot.avatar.custom_minimum_size.x, XomDaoPlayerSlot.AVATAR_COMPACT)


func test_settings_keep_to_their_choices() -> void:
	var settings: XomDaoSettings = _settings()
	watch_signals(settings)
	settings.set_value("ui_scale", 1.2)
	assert_eq(settings.ui_scale, 0.85, "the nearest offered scale")
	settings.set_value("margin", 7)
	assert_eq(settings.margin, 24, "an unknown margin is ignored")
	settings.set_value("margin", 40)
	assert_eq(settings.margin, 40)
	settings.set_value("quality", "low")
	assert_eq(settings.quality, "low")
	assert_signal_emit_count(settings, "changed", 4)


func test_settings_are_saved_and_loaded() -> void:
	var path: String = "user://test_settings.cfg"
	var settings: XomDaoSettings = _settings()
	settings.path = path
	settings.set_value("ui_scale", 0.85)
	settings.set_value("quality", "medium")
	var again: XomDaoSettings = _settings()
	again.path = path
	again.load_file()
	assert_eq(again.ui_scale, 0.85)
	assert_eq(again.quality, "medium")
	DirAccess.remove_absolute(path)


func test_music_and_effects_have_their_own_bus() -> void:
	var settings: XomDaoSettings = _settings()
	var music: int = AudioServer.get_bus_index(XomDaoSettings.MUSIC_BUS)
	var sfx: int = AudioServer.get_bus_index(XomDaoSettings.SFX_BUS)
	assert_gt(music, 0)
	assert_gt(sfx, 0)
	settings.set_value("music", false)
	assert_true(AudioServer.is_bus_mute(music))
	assert_false(AudioServer.is_bus_mute(sfx), "effects stay on")
	settings.set_value("music", true)
	settings.set_value("sfx", false)
	assert_false(AudioServer.is_bus_mute(music))
	assert_true(AudioServer.is_bus_mute(sfx))
	settings.set_value("sfx", true)
	settings.set_value("sfx_volume", 0.5)
	assert_almost_eq(AudioServer.get_bus_volume_db(sfx), linear_to_db(0.5), 0.01)
	assert_almost_eq(AudioServer.get_bus_volume_db(music), linear_to_db(0.8), 0.01)
	settings.set_value("music_volume", 0.0)
	assert_true(AudioServer.is_bus_mute(music), "no volume is silence")
	settings.set_value("music_volume", 0.8)
	settings.set_value("sfx_volume", 1.0)


func test_an_old_sound_switch_turns_both_off() -> void:
	var path: String = "user://test_settings_old.cfg"
	var file := ConfigFile.new()
	file.set_value("ui", "sound", false)
	file.save(path)
	var settings := XomDaoSettings.new()
	settings.path = path
	settings.load_file()
	assert_false(settings.music)
	assert_false(settings.sfx)
	settings.set_value("music", true)
	settings.set_value("sfx", true)
	var again := XomDaoSettings.new()
	again.path = path
	again.load_file()
	assert_true(again.music)
	assert_almost_eq(again.music_volume, 0.8, 0.001)
	DirAccess.remove_absolute(path)


func test_slider_snaps_and_reports_only_changes() -> void:
	var slider: XomDaoSlider = add_child_autofree(XomDaoSlider.create(0.5))
	watch_signals(slider)
	slider.slide_to(0.5)
	assert_signal_not_emitted(slider, "changed")
	slider.slide_to(0.62)
	assert_almost_eq(slider.value, 0.6, 0.001)
	assert_signal_emit_count(slider, "changed", 1)
	slider.slide_to(7.0)
	assert_almost_eq(slider.value, 1.0, 0.001)


func test_menu_opens_and_reports_choices() -> void:
	var settings: XomDaoSettings = _settings()
	var menu: XomDaoMenu = add_child_autofree(XomDaoMenu.new(settings))
	watch_signals(menu)
	assert_false(menu.is_open())
	menu.button.pressed.emit()
	assert_true(menu.is_open())
	menu.board.find_child("Leave", true, false).pressed.emit()
	assert_signal_emitted(menu, "leave_requested")
	assert_false(menu.is_open())
	menu.emote_looks = ["happy", "love"]
	menu.open()
	assert_not_null(menu.board.find_child("Emote_love", true, false))
	assert_null(menu.board.find_child("Emote_wow", true, false), "only owned emotes are offered")
	menu.board.find_child("Emote_happy", true, false).pressed.emit()
	assert_signal_emitted_with_parameters(menu, "emote_chosen", ["happy"])
	assert_eq(
		(menu.board.find_child("Emote_happy", true, false) as Button).icon.resource_path,
		"res://addons/xomdao_sdk/ui/looks/emote-happy.webp"
	)
	menu.open()
	menu.board.find_child("Rules", true, false).pressed.emit()
	assert_signal_emitted(menu, "rules_requested")
	menu.button.visible = true
	var escape := InputEventAction.new()
	escape.action = "ui_cancel"
	escape.pressed = true
	menu._unhandled_input(escape)
	assert_true(menu.is_open(), "Escape opens the in-game menu")
	menu._unhandled_input(escape)
	assert_false(menu.is_open(), "Escape closes the menu")
	menu.confirm_leave("Rời ván?", "Bạn sẽ rời phòng.", "Rời phòng")
	menu._unhandled_input(escape)
	assert_false(menu.dismiss_confirmation(), "Escape dismisses the confirmation")


func test_bankruptcy_leave_title_keeps_clear_of_the_close_button() -> void:
	var menu: XomDaoMenu = add_child_autofree(XomDaoMenu.new(_settings()))
	menu.confirm_leave(
		"Phá sản và rời phòng?",
		"Tài sản sẽ về ngân hàng, số dư về 0 và bạn bị loại khỏi ván trước khi rời phòng.",
		"Phá sản & rời",
		true
	)
	await get_tree().process_frame
	await get_tree().process_frame
	var confirm: XomDaoBoard = menu.find_child("ConfirmLeaveBoard", true, false)
	var title: Label = confirm.get("_title")
	assert_true(confirm.close_button.visible)
	assert_false(
		title.get_global_rect().intersects(confirm.close_button.get_global_rect()),
		"The confirmation title must reserve space for the close mark"
	)
	var title_font: Font = title.get_theme_font("font")
	var title_size: int = title.get_theme_font_size("font_size")
	var text_width: float = (
		title_font.get_string_size(title.text, HORIZONTAL_ALIGNMENT_LEFT, -1, title_size).x
	)
	assert_lte(text_width, title.size.x, "The full confirmation title stays on one line")


func test_menu_changes_the_settings() -> void:
	var settings: XomDaoSettings = _settings()
	var menu: XomDaoMenu = add_child_autofree(XomDaoMenu.new(settings))
	menu.ui_scale.choose(1)
	assert_eq(settings.ui_scale, XomDaoSettings.SCALES[1])
	assert_eq(menu.button.scale, Vector2.ONE * XomDaoSettings.SCALES[1])
	menu.margin.choose(2)
	assert_eq(settings.margin, XomDaoSettings.MARGINS[2])
	menu.sfx_switch.pressed.emit()
	assert_false(settings.sfx)
	assert_true(settings.music)
	assert_eq(menu.sfx_switch.icon_name, "speaker-slash")
	menu.music.slide_to(0.3)
	assert_almost_eq(settings.music_volume, 0.3, 0.001)
	settings.set_value("sfx", true)
	settings.set_value("sfx_volume", 0.4)
	assert_almost_eq(menu.sfx.value, 0.4, 0.001, "the board follows the settings")


func test_menu_shows_one_settings_tab_at_a_time() -> void:
	var menu: XomDaoMenu = add_child_autofree(XomDaoMenu.new(_settings()))
	var interface: Control = menu.board.find_child("Interface", true, false)
	var audio: Control = menu.board.find_child("Audio", true, false)
	assert_true(interface.visible)
	assert_false(audio.visible)
	menu.board.find_child("Tab_1", true, false).pressed.emit()
	assert_false(interface.visible)
	assert_true(audio.visible)
	assert_eq(interface.custom_minimum_size, audio.custom_minimum_size, "the board keeps its size")


func test_a_bounce_leaves_a_scaled_button_where_it_was() -> void:
	var button: XomDaoIconButton = add_child_autofree(XomDaoIconButton.create("arrow-left"))
	button.scale = Vector2.ONE * 0.7
	button.position = Vector2(24.0, 24.0)
	button.size = Vector2(88.0, 88.0)
	XomDaoUi.bounce(button)
	await wait_seconds(0.04)
	assert_lt(button.scale.x, 0.7, "it shrinks")
	var centre: Vector2 = button.position + button.size * button.scale / 2.0
	assert_almost_eq(centre, Vector2(24.0, 24.0) + Vector2.ONE * 88.0 * 0.35, Vector2.ONE * 0.01)
	XomDaoUi.bounce(button)
	await wait_seconds(0.35)
	assert_almost_eq(button.position, Vector2(24.0, 24.0), Vector2.ONE * 0.01)
	assert_almost_eq(button.scale, Vector2.ONE * 0.7, Vector2.ONE * 0.001)
	assert_eq(button.pivot_offset, Vector2.ZERO)


func test_choice_reports_only_changes() -> void:
	var choice: XomDaoChoice = add_child_autofree(XomDaoChoice.create(["2", "3", "4"], 1))
	watch_signals(choice)
	choice.choose(1)
	assert_signal_not_emitted(choice, "changed")
	choice.choose(2)
	assert_signal_emitted_with_parameters(choice, "changed", [2])
	choice.choose(9)
	assert_eq(choice.selected, 2)


func test_game_tile_labels() -> void:
	assert_eq(XomDaoGameTile.players_label(2, 2), "2 người")
	assert_eq(XomDaoGameTile.players_label(2, 4), "2–4 người")
	assert_eq(XomDaoGameTile.duration_label({"min": 10, "max": 10}), "10 phút")
	assert_eq(XomDaoGameTile.duration_label({"min": 5, "max": 10}), "5–10 phút")
	var card := (
		XomDaoGameCard
		. from_dict(
			{
				"id": "tien-len",
				"name": "Tiến Lên",
				"minPlayers": 2,
				"maxPlayers": 4,
				"duration": {"min": 5, "max": 10},
				"playing": 32,
			}
		)
	)
	var tile: XomDaoGameTile = add_child_autofree(XomDaoGameTile.new())
	tile.show_card(card)
	assert_eq(tile.title, "Tiến Lên")
	assert_eq(tile.players_text, "2–4 người")
	assert_eq(tile.duration_text, "5–10 phút")
	assert_eq(tile.playing, 32)


func test_every_gallery_page_builds() -> void:
	var gallery: Control = add_child_autofree(load("res://hub/gallery/gallery.tscn").instantiate())
	for page: int in range(1, gallery.PAGES + 1):
		gallery.show_page(page)
		await wait_process_frames(2)
		assert_gt(gallery._core.get_child_count(), 0, "page %d" % page)
