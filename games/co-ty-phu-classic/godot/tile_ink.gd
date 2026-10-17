extends Control
## Surface print follows the local board axes and shrinks with camera depth.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const Coins := preload("res://content/co-ty-phu-classic/station_coins.gd")
const Details := preload("res://content/co-ty-phu-classic/special_details.gd")
const SYMBOLS: Dictionary = {
	"start": preload("res://content/co-ty-phu-classic/art/tile-start.svg"),
	"airport": preload("res://content/co-ty-phu-classic/art/tile-airport.svg"),
	"jail": preload("res://content/co-ty-phu-classic/art/tile-jail.svg"),
	"go-jail": preload("res://content/co-ty-phu-classic/art/tile-go-jail.svg"),
	"chance": preload("res://content/co-ty-phu-classic/art/tile-chance.svg"),
	"chest": preload("res://content/co-ty-phu-classic/art/tile-chest.svg"),
	"tax": preload("res://content/co-ty-phu-classic/art/tile-tax.svg"),
	"street": preload("res://content/co-ty-phu-classic/art/tile-house.svg"),
	"station": preload("res://content/co-ty-phu-classic/art/tile-bus.svg"),
	"power": preload("res://content/co-ty-phu-classic/art/tile-power.svg"),
	"water": preload("res://content/co-ty-phu-classic/art/tile-water.svg"),
}
const MOTION := preload("res://content/co-ty-phu-classic/special_ink.gdshader")
const INK := Color("#234746")

var view: Dictionary = {}
var host: Control
var _symbols: Dictionary = {}
var _font: FontVariation


func _ready() -> void:
	# A private font cache keeps minification filtering local to the table.
	_font = XomDaoUi.display_font(700).duplicate() as FontVariation
	var source_font: FontFile = _font.base_font.duplicate() as FontFile
	source_font.generate_mipmaps = true
	_font.base_font = source_font
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	for i: int in 40:
		if not SYMBOLS.has(symbol_kind(i)):
			continue
		var symbol := Sprite2D.new()
		symbol.name = "TileSymbol_%d" % i
		var kind: String = symbol_kind(i)
		symbol.texture = SYMBOLS[kind]
		if kind != "street":
			var shader := ShaderMaterial.new()
			shader.shader = MOTION
			shader.set_shader_parameter(
				"kind",
				(
					{
						"power": 0,
						"water": 1,
						"chance": 2,
						"chest": 3,
						"tax": 4,
						"station": 5,
						"airport": 6
					}
					. get(kind, 7)
				)
			)
			shader.set_shader_parameter("phase", i * 0.73)
			symbol.material = shader
		add_child(symbol)
		_symbols[i] = symbol


func refresh(snapshot: Dictionary, extent: Vector2) -> void:
	view = snapshot
	size = extent
	for i: int in _symbols:
		var sprite: Sprite2D = _symbols[i]
		var layout: Dictionary = rows(i)
		var side: float = layout["symbol_size"]
		sprite.transform = surface_transform(i, layout["symbol"], size).scaled_local(
			Vector2.ONE * side / 256.0
		)
		var ink: Color = Color("#E8F4EA") if symbol_kind(i) == "airport" else INK
		if Rules.is_deed(i):
			var style: Dictionary = host.call("appearance", view["properties"], i)
			ink = style["symbol"]
			if view["properties"][i]["mortgaged"]:
				ink = ink.darkened(0.32)
		sprite.modulate = ink
	queue_redraw()


static func symbol_kind(i: int) -> String:
	return (
		("power" if i == 12 else "water") if i in Rules.UTILITIES else str(Rules.SQUARES[i]["kind"])
	)


static func plane_size(i: int) -> Vector2:
	var q: Array = Rules.CELLS[i]
	return (
		Vector2(
			(_unproject(q[1]) - _unproject(q[0])).length(),
			(_unproject(q[3]) - _unproject(q[0])).length()
		)
		* 1000.0
	)


static func _unproject(p: Vector2) -> Vector2:
	var h: Array[float] = Rules.HOMOGRAPHY
	var a: float = h[0] - p.x * h[6]
	var b: float = h[1] - p.x * h[7]
	var c: float = p.x * h[8] - h[2]
	var d: float = h[3] - p.y * h[6]
	var e: float = h[4] - p.y * h[7]
	var f: float = p.y * h[8] - h[5]
	return Vector2(c * e - b * f, a * f - c * d) / (a * e - b * d)


static func surface_transform(i: int, uv: Vector2, extent: Vector2) -> Transform2D:
	var span: Vector2 = plane_size(i)
	var x_axis: Vector2 = (
		(Rules.cell_point(i, 1.0, uv.y) - Rules.cell_point(i, 0.0, uv.y)) * extent / span.x
	)
	var y_axis: Vector2 = (
		(Rules.cell_point(i, uv.x, 1.0) - Rules.cell_point(i, uv.x, 0.0)) * extent / span.y
	)
	return Transform2D(x_axis, y_axis, Rules.cell_point(i, uv.x, uv.y) * extent)


static func rows(i: int) -> Dictionary:
	var span: Vector2 = plane_size(i)
	if i % 10 == 0:
		return {
			"label": Vector2(0.5, 0.81),
			"symbol": Vector2(0.5, 0.37),
			"width": span.x * 0.90,
			"label_height": span.y * 0.25,
			"label_size": 22.0,
			"symbol_size": minf(span.x, span.y) * 0.43
		}
	if not Rules.is_deed(i) and SYMBOLS.has(symbol_kind(i)):
		if symbol_kind(i) == "chest":
			return {
				"label": Vector2(0.35, 0.50),
				"symbol": Vector2(0.78, 0.50),
				"width": span.x * 0.58,
				"label_height": span.y * 0.70,
				"label_size": 24.0,
				"symbol_size": minf(span.x * 0.26, span.y * 0.68)
			}
		return {
			"label": Vector2(0.5, 0.25),
			"symbol": Vector2(0.5, 0.65),
			"width": span.x * 0.84,
			"label_height": span.y * 0.30,
			"label_size": 22.0,
			"symbol_size": minf(span.x * 0.76, span.y * 0.50)
		}

	var column: bool = (i > 10 and i < 20) or i > 30
	var x: float = 0.5
	if column:
		x = 0.48 if i < 20 else 0.52
	var top: bool = i > 20 and i < 30
	var y: float = 0.28 if i < 10 else 0.23
	if column:
		y = 0.25
	if symbol_kind(i) == "station":
		return {
			"label": Vector2(x, y),
			"symbol": Vector2(x - 0.17 if column else x, 0.56 if column else 0.46),
			"number": Vector2(x + 0.14 if column else x, 0.56 if column else 0.62),
			"width": span.x * (0.60 if column else 0.83),
			"label_size": minf(22.0, span.y * 0.25),
			"number_width": span.x * (0.30 if column else 0.83),
			"number_size": minf(24.0, span.y * 0.20),
			"symbol_size": minf(span.x * 0.64, span.y * (0.34 if column else 0.28))
		}
	return {
		"label": Vector2(x, y),
		"symbol": Vector2(x - 0.17 if column else x, 0.65 if column else (0.45 if top else 0.53)),
		"number": Vector2(x + 0.14 if column else x, 0.65 if column else (0.68 if top else 0.76)),
		"width": span.x * (0.60 if column else 0.83),
		"label_size": minf(22.0, span.y * (0.29 if column else 0.25)),
		"number_width": span.x * (0.30 if column else 0.83),
		"number_size": minf(22.0 if top else 29.0, span.y * (0.38 if column else 0.28)),
		"symbol_size": minf(span.x * (0.64 if top else 0.74), span.y * (0.46 if column else 0.38))
	}


static func compact_number(value: int) -> String:
	if absi(value) < 1000:
		return str(value)
	var thousands: String = ("%.2f" % (value / 1000.0)).rstrip("0").rstrip(".")
	return thousands.replace(".", ",") + "k"


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	if view.is_empty():
		return
	for i: int in 40:
		var kind: String = symbol_kind(i)
		if kind not in ["street", "power", "water"]:
			var layout: Dictionary = rows(i)
			draw_set_transform_matrix(surface_transform(i, layout["symbol"], size))
			Details.paint(
				self, kind, layout["symbol_size"], Time.get_ticks_msec() / 1000.0 + i * 0.73
			)
		var ink: Color = INK
		if Rules.is_deed(i):
			var deed: Dictionary = view["properties"][i]
			if deed.get("owner") != null:
				ink = host.call("owner_ink", int(deed["owner"]))
			if deed["mortgaged"]:
				ink = ink.darkened(0.32)
			var layout: Dictionary = rows(i)
			_line(
				i,
				str(Rules.SQUARES[i]["name"]),
				layout["label"],
				layout["width"],
				layout["label_size"],
				ink
			)
			_line(
				i,
				deed_amount_text(i),
				layout["number"],
				layout["number_width"],
				layout["number_size"],
				INK
			)
		else:
			var box: Rect2 = host.call("name_box", i)
			var span: Vector2 = plane_size(i)
			if SYMBOLS.has(symbol_kind(i)):
				var special: Dictionary = rows(i)
				var bounds := Vector2(special["width"] / span.x, special["label_height"] / span.y)
				box = Rect2(special["label"] - bounds / 2.0, bounds)
			var font: Font = _font
			var fit: Dictionary = host.call(
				"fit_name", str(Rules.SQUARES[i]["name"]), font, span * box.size * 4.0, 88
			)
			var lines: Array = fit["lines"]
			var letter_size: float = float(fit["size"]) / 4.0
			for row: int in lines.size():
				var uv: Vector2 = box.get_center()
				uv.y += (row - (lines.size() - 1) / 2.0) * letter_size * 1.05 / span.y
				_line(i, lines[row], uv, span.x * box.size.x, letter_size, ink)
	draw_set_transform_matrix(Transform2D.IDENTITY)
	var auctions: Dictionary = view.get("stationAuctions", {})
	for square: int in Rules.STATIONS:
		var auction: Variant = auctions.get(str(square), auctions.get(square))
		if auction is Dictionary:
			Coins.paint(self, square, auction, size, plane_size(square), surface_transform)


func _line(i: int, text: String, uv: Vector2, width: float, largest: float, ink: Color) -> void:
	var font: Font = _font
	var text_width: float = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 64).x
	var scale_of: float = minf(largest / 64.0, width / maxf(text_width, 1.0))
	draw_set_transform_matrix(surface_transform(i, uv, size).scaled_local(Vector2.ONE * scale_of))
	draw_string(
		font,
		Vector2(-text_width / 2.0, (font.get_ascent(64) - font.get_descent(64)) / 2.0),
		text,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		64,
		ink
	)


func deed_amount_text(i: int) -> String:
	var deed: Dictionary = view["properties"][i]
	if deed.get("owner") == null:
		return compact_number(Rules.price(i))

	var rent: int = Rules.rent(view, i)
	var multiplier: int = Rules.rent_multiplier(view, i)
	if rent > 0 and multiplier > 1:
		var base_rent: int = int(float(rent) / float(multiplier))
		return "%s×%d" % [compact_number(base_rent), multiplier]
	return compact_number(rent)
