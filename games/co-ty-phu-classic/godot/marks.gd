extends Control
## The marks Cờ tỷ phú draws over board.webp (this control covers the whole picture): each deed's
## owner band with its houses or hotel, a dark veil on a mortgaged deed, the contributions at a
## bus station, a ring round the tapped and the pending square, and on every square its name
## and, on a deed, its price. Owner strips and buildings use the shared Blender atlas.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const Sets := preload("res://content/co-ty-phu-classic/deed_sets.gd")
const INKS: Array[Color] = [Color("#DF6554"), Color("#5793D3"), Color("#60AF72"), Color("#E6BE52")]
## The ink of names and prices: on a deed, and on the other squares.
const DEED_INK := Color("#234746")
const SPECIAL_INK := Color("#234746")
## Printed labels and symbols share the camera axes of each tile.
const TileInk := preload("res://content/co-ty-phu-classic/tile_ink.gd")

var view: Dictionary = {}
var focus: int = -1

var _atlas: Texture2D
var _frames: Dictionary = {}
var _rects: Array = []
var _print: Control = TileInk.new()
var _print_viewport := SubViewport.new()
var _print_surface := TextureRect.new()


func _ready() -> void:
	_atlas = load("res://content/co-ty-phu-classic/art/deed-layers.webp")
	var data: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string("res://content/co-ty-phu-classic/art/deed-layers.json")
	)
	_frames = data["frames"]
	_rects = data["meta"]["boardRects"]
	_print_viewport.transparent_bg = true
	_print_viewport.disable_3d = true
	_print_viewport.handle_input_locally = false
	_print_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_print_viewport.size = Vector2i(2, 2)
	add_child(_print_viewport)
	_print.set("host", self)
	_print_viewport.add_child(_print)
	_print_surface.texture = _print_viewport.get_texture()
	_print_surface.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	_print_surface.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_print_surface.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	add_child(_print_surface)


func _draw_layer(frame_name: String, square: int, tint: Color = Color.WHITE) -> void:
	var entry: Dictionary = _frames[frame_name]
	var frame: Dictionary = entry["frame"]
	var trim: Dictionary = entry["spriteSourceSize"]
	var source: Dictionary = entry["sourceSize"]
	var target: Array = _rects[square]
	var extent := Vector2(target[2], target[3]) * size
	var scale_of: Vector2 = extent / Vector2(source["w"], source["h"])
	draw_texture_rect_region(
		_atlas,
		Rect2(
			Vector2(target[0], target[1]) * size + Vector2(trim["x"], trim["y"]) * scale_of,
			Vector2(frame["w"], frame["h"]) * scale_of
		),
		Rect2(frame["x"], frame["y"], frame["w"], frame["h"]),
		tint
	)


## Ownership colors are independent of the permanent monopoly-set inlay on the board.
static func appearance(properties: Array, square: int) -> Dictionary:
	var deed: Dictionary = properties[square]
	var held: Variant = deed.get("owner")
	if held == null:
		return {"badge": "", "building": "", "symbol": DEED_INK}
	var seat: int = int(held) % INKS.size()
	var level: int = int(deed["houses"])
	return {
		"badge": "owner-%d-%d" % [seat, square],
		"building": "houses-%d-%d-%d" % [seat, level, square] if level > 0 else "",
		"symbol": INKS[seat].darkened(0.15),
	}


func _draw() -> void:
	if view.is_empty():
		return
	# Supersample only surface ink, preserving the board and shared HUD resolution.
	var ink_size := Vector2i((size * 2.0).ceil())
	_print_viewport.size = ink_size
	_print_surface.size = size
	_print.call("refresh", view, Vector2(ink_size))
	_draw_sets()
	var pending: Variant = view.get("pending")
	for i: int in 40:
		var quad := PackedVector2Array()
		for corner: Vector2 in Rules.CELLS[i]:
			quad.append(corner * size)
		if Rules.is_deed(i):
			_draw_deed(i, quad)
		if i == focus or (pending != null and int(pending) == i):
			var center: Vector2 = (quad[0] + quad[2]) / 2.0
			var ring := PackedVector2Array()
			for point: Vector2 in quad:
				ring.append(center + (point - center) * 0.96)
			ring.append(ring[0])
			var color: Color = XomDaoUi.CREAM if i == focus else XomDaoUi.GOLD
			draw_polyline(ring, Color("#173B40"), 6.0, true)
			draw_polyline(ring, color, 2.5, true)


func _draw_sets() -> void:
	for frame: Dictionary in Sets.frames(view["properties"]):
		var points: PackedVector2Array = Sets.outline(frame["squares"], size)
		var ink: Color = Sets.INKS[frame["group"]]
		var complete: bool = frame["complete"]
		draw_polyline(points, Color(ink, 0.22), 8.0 if complete else 4.0, true)
		draw_polyline(points, ink, 3.0 if complete else 1.5, true)
		if complete:
			draw_polyline(points, Color("#FFF6E3"), 0.8, true)


func _draw_deed(i: int, quad: PackedVector2Array) -> void:
	var deed: Dictionary = view["properties"][i]
	var style: Dictionary = appearance(view["properties"], i)
	if style["badge"] != "":
		_draw_layer(style["badge"], i)
	if style["building"] != "":
		_draw_layer(style["building"], i)
	if bool(deed["mortgaged"]):
		draw_colored_polygon(quad, Color(0.10, 0.18, 0.18, 0.32))
		var point := Vector2(0.915, 0.095)
		if i > 10 and i < 20:
			point = Vector2(0.905, 0.915)
		elif i > 20 and i < 30:
			point = Vector2(0.915, 0.905)
		elif i > 30:
			point = Vector2(0.095, 0.915)
		var at: Vector2 = Rules.cell_point(i, point.x, point.y) * size
		var side: float = size.x * 0.0065
		draw_circle(at, side * 0.65, Color("#3F5754"))
		draw_texture_rect(
			XomDaoUi.icon("lock-simple"),
			Rect2(at - Vector2.ONE * side / 2, Vector2.ONE * side),
			false,
			XomDaoUi.CREAM
		)
	var auctions: Dictionary = view.get("stationAuctions", {})
	var auction: Variant = auctions.get(str(i), auctions.get(i))
	if auction is Dictionary:
		var bids: Array = (auction as Dictionary)["bids"]
		var center: Vector2 = (quad[0] + quad[1] + quad[2] + quad[3]) / 4.0
		var step: float = (quad[1] - quad[0]).length() / 5.0
		for seat: int in bids.size():
			if int(bids[seat]) > 0:
				draw_circle(center + Vector2(step * (seat - 1.5), 0.0), step * 0.4, INKS[seat % 4])


## Where a square's name goes (u from–to across it, v from–to down it, 0–1): on the side towards
## the field on the rows, above the symbol and the price on the columns, under the corner's symbol.
static func name_box(i: int) -> Rect2:
	if i % 10 == 0:
		return Rect2(0.04, 0.68, 0.92, 0.28)
	if i < 10:
		return Rect2(0.07, 0.15, 0.86, 0.30)
	if i > 20 and i < 30:
		return Rect2(0.07, 0.57, 0.86, 0.29)
	return Rect2(0.16, 0.04, 0.68, 0.43)


## The lines and font size that fit `text` in `box` (pixels), at most `largest`: one line, or the
## two-line split with the narrowest longer line when that is bigger.
static func fit_name(text: String, font: Font, box: Vector2, largest: int) -> Dictionary:
	var options: Array = [[text]]
	var words: PackedStringArray = text.split(" ")
	var narrowest: float = INF
	var split: Array = []
	for k: int in range(1, words.size()):
		var pair: Array = [" ".join(words.slice(0, k)), " ".join(words.slice(k))]
		var widest: float = maxf(_width(pair[0], font, largest), _width(pair[1], font, largest))
		if widest < narrowest:
			narrowest = widest
			split = pair
	if not split.is_empty():
		options.append(split)
	var best: Dictionary = {}
	for lines: Array in options:
		var widest: float = 0.0
		for line: String in lines:
			widest = maxf(widest, _width(line, font, largest))
		var by_width: float = largest * box.x / maxf(widest, 1.0)
		var by_height: float = box.y / (lines.size() * 1.05)
		var fitted: int = floori(minf(largest, minf(by_width, by_height)))
		if best.is_empty() or fitted > int(best["size"]):
			best = {"lines": lines, "size": fitted}
	return best


static func _width(text: String, font: Font, font_size: int) -> float:
	return font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x


## A player's colour darkened like an owner's ink.
static func owner_ink(seat: int) -> Color:
	var ink: Color = INKS[seat % 4]
	return Color(ink.r * 0.55, ink.g * 0.55, ink.b * 0.55)
