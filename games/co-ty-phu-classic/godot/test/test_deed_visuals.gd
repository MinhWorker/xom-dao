extends GutTest
## Ownership changes must update every visual channel without changing monopoly membership.

const Marks := preload("res://content/co-ty-phu-classic/marks.gd")
const Sets := preload("res://content/co-ty-phu-classic/deed_sets.gd")
const Rules := preload("res://content/co-ty-phu-classic/rules.gd")


func _properties() -> Array:
	var properties: Array = []
	for i: int in 40:
		properties.append({"owner": null, "houses": 0, "mortgaged": false})
	return properties


func test_transfer_changes_buildings_badges_and_symbols_but_keeps_the_set() -> void:
	var properties: Array = _properties()
	properties[3] = {"owner": 0, "houses": 5, "mortgaged": false}
	var red: Dictionary = Marks.appearance(properties, 3)
	var group: String = Rules.SQUARES[3]["group"]
	var inlay: Color = Sets.INKS[group]
	properties[3]["owner"] = 1
	var blue: Dictionary = Marks.appearance(properties, 3)
	for channel: String in ["badge", "building", "symbol"]:
		assert_ne(red[channel], blue[channel], "Transfer must update " + channel)
	assert_eq(Rules.SQUARES[3]["group"], group)
	assert_eq(Sets.INKS[group], inlay)
	assert_eq(properties[3]["houses"], 5)
	properties[3]["mortgaged"] = true
	assert_eq(Marks.appearance(properties, 3), blue, "Mortgage retains ownership and buildings")
	properties[3] = {"owner": null, "houses": 0, "mortgaged": false}
	var cleared: Dictionary = Marks.appearance(properties, 3)
	assert_eq(cleared["badge"], "")
	assert_eq(cleared["building"], "")
	assert_eq(cleared["symbol"], Marks.DEED_INK)


func test_atlas_supports_all_owners_and_construction_levels() -> void:
	var data: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string("res://content/co-ty-phu-classic/art/deed-layers.json")
	)
	var frames: Dictionary = data["frames"]
	var properties: Array = _properties()
	for square: int in 40:
		if not Rules.is_deed(square):
			continue
		assert_true(frames.has("symbol-%d" % square))
		for seat: int in 4:
			for level: int in 6 if Rules.SQUARES[square]["kind"] == "street" else 1:
				properties[square] = {"owner": seat, "houses": level, "mortgaged": false}
				var style: Dictionary = Marks.appearance(properties, square)
				assert_true(frames.has(style["badge"]))
				if level > 0:
					assert_true(frames.has(style["building"]))


func test_set_frames_join_neighbors_but_never_cross_a_foreign_square() -> void:
	var properties: Array = _properties()
	for square: int in [6, 8, 9]:
		properties[square]["owner"] = 1
	var frames: Array[Dictionary] = Sets.frames(properties)
	assert_eq(frames.size(), 2, "The chance square splits this set into two runs")
	assert_eq(frames[0]["squares"], [6] as Array[int])
	assert_eq(frames[1]["squares"], [8, 9] as Array[int])
	assert_true(frames[0]["complete"])
	assert_true(frames[1]["complete"])
	properties[9]["owner"] = 0
	frames = Sets.frames(properties)
	assert_eq(frames.size(), 2)
	for frame: Dictionary in frames:
		assert_false(frame["complete"], "A transfer breaks monopoly immediately")
	properties[8]["owner"] = 0
	frames = Sets.frames(properties)
	assert_eq(frames.size(), 1)
	assert_eq(frames[0]["squares"], [8, 9] as Array[int])
	assert_false(frames[0]["complete"])


func test_surface_print_keeps_upright_rows_inside_every_deed() -> void:
	var print_script: GDScript = load("res://content/co-ty-phu-classic/tile_ink.gd")
	var font: Font = XomDaoUi.display_font(700)
	for i: int in 40:
		if not Rules.is_deed(i):
			continue
		var layout: Dictionary = print_script.call("rows", i)
		var span: Vector2 = print_script.call("plane_size", i)
		assert_lt(layout["label"].y, layout["symbol"].y)
		assert_lt(layout["symbol"].y, layout["number"].y)
		assert_gt(layout["symbol"].y - layout["symbol_size"] / span.y / 2.0, 0.27)
		assert_lt(layout["symbol"].y + layout["symbol_size"] / span.y / 2.0, 0.72)
		var fitted: float = minf(
			layout["label_size"] / 64.0,
			layout["width"] / font.get_string_size(Rules.SQUARES[i]["name"], 0, -1, 64).x
		)
		assert_lte(
			font.get_string_size(Rules.SQUARES[i]["name"], 0, -1, 64).x * fitted,
			layout["width"] + 0.001
		)
		var surface: Transform2D = print_script.call(
			"surface_transform", i, layout["symbol"], Vector2(1000, 786)
		)
		assert_gt(surface.x.x, 0.0, "Text reads left to right on every edge")
		assert_gt(surface.y.y, 0.0, "Text is upright on every edge")
	var near_side: Transform2D = print_script.call(
		"surface_transform", 2, Vector2(0.5, 0.5), Vector2(1000, 786)
	)
	var far_side: Transform2D = print_script.call(
		"surface_transform", 24, Vector2(0.5, 0.5), Vector2(1000, 786)
	)
	assert_lt(far_side.x.length(), near_side.x.length(), "Far tiles have smaller physical print")
