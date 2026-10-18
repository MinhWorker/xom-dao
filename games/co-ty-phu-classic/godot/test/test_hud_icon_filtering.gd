extends GutTest

const HUD_ART_DIR := "res://content/co-ty-phu-classic/art"


func test_projected_hud_icons_have_mipmaps() -> void:
	var icon_paths: PackedStringArray = []
	for file_name: String in DirAccess.get_files_at(HUD_ART_DIR):
		if file_name.begins_with("hud-") and file_name.ends_with(".svg"):
			icon_paths.append("%s/%s" % [HUD_ART_DIR, file_name])
	assert_gt(icon_paths.size(), 0, "Expected HUD SVG icons in the art folder")

	for icon_path: String in icon_paths:
		var icon := load(icon_path) as Texture2D
		assert_not_null(icon, "%s should load as a texture" % icon_path)
		if icon == null:
			continue
		assert_true(
			icon.get_image().has_mipmaps(), "%s needs mipmaps for surface minification" % icon_path
		)
