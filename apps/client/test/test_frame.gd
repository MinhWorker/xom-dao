extends GutTest


func test_core_is_centred_in_the_frame() -> void:
	var rect: Rect2 = XomDaoFrame.core_rect(XomDaoFrame.SIZE)
	assert_eq(rect.position, Vector2(160.0, 0.0))
	assert_eq(rect.size, XomDaoFrame.CORE)


func test_project_base_frame_keeps_its_aspect_ratio() -> void:
	var size := Vector2(
		float(ProjectSettings.get_setting("display/window/size/viewport_width")),
		float(ProjectSettings.get_setting("display/window/size/viewport_height"))
	)
	assert_eq(size, XomDaoFrame.SIZE)
	assert_eq(ProjectSettings.get_setting("display/window/stretch/aspect"), "keep")
	assert_eq(get_tree().root.content_scale_aspect, Window.CONTENT_SCALE_ASPECT_KEEP)
	assert_true(get_tree().root.content_scale_size in XomDaoFrame.SIZES)


func test_common_phone_sizes_select_fixed_presets_at_any_density() -> void:
	var cases: Array = [
		[Vector2(640, 360), Vector2i(1280, 720)],
		[Vector2(667, 375), Vector2i(1280, 720)],
		[Vector2(720, 360), Vector2i(1440, 720)],
		[Vector2(852, 393), Vector2i(1560, 720)],
		[Vector2(800, 360), Vector2i(1600, 720)],
		[Vector2(915, 412), Vector2i(1600, 720)],
		[Vector2(1180, 820), Vector2i(1280, 720)],
		[Vector2(360, 800), Vector2i(1280, 720)],
		[Vector2(2560, 720), Vector2i(1600, 720)],
	]
	for item: Array in cases:
		for density: float in [1.0, 2.0, 2.625, 3.0]:
			assert_eq(XomDaoFrame.size_for_window(item[0] * density), item[1])


func test_arbitrary_windows_never_produce_a_free_frame() -> void:
	for width: int in range(300, 2501, 13):
		var window := Vector2(width, 720)
		var selected := Vector2(XomDaoFrame.size_for_window(window))
		assert_true(Vector2i(selected) in XomDaoFrame.SIZES)
		var scale: float = minf(window.x / selected.x, window.y / selected.y)
		var area: float = selected.x * selected.y * scale * scale
		for preset: Vector2i in XomDaoFrame.SIZES:
			var other_scale: float = minf(window.x / preset.x, window.y / preset.y)
			assert_gte(area + 0.001, preset.x * preset.y * other_scale * other_scale)


func test_empty_window_uses_the_base_frame() -> void:
	assert_eq(XomDaoFrame.size_for_window(Vector2.ZERO), Vector2i(1280, 720))
	assert_eq(XomDaoFrame.size_for_window(Vector2(800, 0)), Vector2i(1280, 720))


func test_inset_is_scaled_to_frame_units_on_a_16_9_screen() -> void:
	var inset: Vector2 = XomDaoFrame.inset_in_frame(
		Vector2(32.0, 0.0), Vector2(640.0, 360.0), XomDaoFrame.SIZE
	)
	assert_eq(inset, Vector2(64.0, 0.0))


func test_side_bars_absorb_a_notch_on_a_wide_phone() -> void:
	# 800 x 360 shows the frame 640 wide: 80 px of bar on each side hides a 47 px notch.
	var inset: Vector2 = XomDaoFrame.inset_in_frame(
		Vector2(47.0, 21.0), Vector2(800.0, 360.0), XomDaoFrame.SIZE
	)
	assert_eq(inset, Vector2(0.0, 42.0))


func test_top_bars_absorb_an_inset_on_a_tablet() -> void:
	# 1024 x 768 shows the frame 576 tall: 96 px of bar above and below.
	var inset: Vector2 = XomDaoFrame.inset_in_frame(
		Vector2(0.0, 24.0), Vector2(1024.0, 768.0), XomDaoFrame.SIZE
	)
	assert_eq(inset, Vector2.ZERO)


func test_wide_presets_protect_the_notch_and_keep_the_core_centred() -> void:
	for preset: Vector2i in XomDaoFrame.SIZES:
		var frame := Vector2(preset)
		assert_eq(XomDaoFrame.inset_in_frame(Vector2(32, 21), frame / 2.0, frame), Vector2(64, 42))
		var core: Rect2 = XomDaoFrame.core_rect(frame)
		assert_eq(core.get_center(), frame / 2.0)
		assert_true(Rect2(Vector2.ZERO, frame).encloses(core))


func test_autoloads_are_registered() -> void:
	for autoload: String in [
		"FramePresets", "Net", "Session", "Wallet", "ContentLoader", "TestBridge"
	]:
		assert_not_null(get_tree().root.get_node_or_null(autoload), autoload)


func test_main_scene_starts_by_connecting() -> void:
	var main: Control = add_child_autofree(load("res://hub/main.tscn").instantiate())
	var screen: Control = main.get_node("Screen")
	assert_eq(screen.size, main.size)
	await wait_process_frames(2)
	assert_eq(TestBridge.scene, "status")
