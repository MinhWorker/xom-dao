extends Control
## Surface print follows the local board axes and shrinks with camera depth.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const Details := preload("res://content/co-ty-phu-classic/special_details.gd")
const DICE_PAIR := preload("res://content/co-ty-phu-classic/art/tile-dice-pair.svg")
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
			"symbol_size": minf(span.x, span.y) * 0.43,
			"span": span
		}
	if not Rules.is_deed(i) and SYMBOLS.has(symbol_kind(i)):
		if symbol_kind(i) == "chest":
			return {
				"label": Vector2(0.35, 0.50),
				"symbol": Vector2(0.78, 0.50),
				"width": span.x * 0.58,
				"label_height": span.y * 0.70,
				"label_size": 24.0,
				"symbol_size": minf(span.x * 0.26, span.y * 0.68),
				"span": span
			}
		return {
			"label": Vector2(0.5, 0.25),
			"symbol": Vector2(0.5, 0.65),
			"width": span.x * 0.84,
			"label_height": span.y * 0.30,
			"label_size": 22.0,
			"symbol_size": minf(span.x * 0.76, span.y * 0.50),
			"span": span
		}

	var column: bool = (i > 10 and i < 20) or i > 30
	var x: float = 0.5
	if column:
		x = 0.48 if i < 20 else 0.52
	var top: bool = i > 20 and i < 30
	var y: float = 0.28 if i < 10 else 0.23
	if column:
		y = 0.25
	var symbol_at := Vector2(x - 0.17 if column else x, 0.65 if column else (0.45 if top else 0.53))
	var number_at := Vector2(x + 0.14 if column else x, 0.65 if column else (0.68 if top else 0.76))
	var number_width: float = span.x * (0.30 if column else 0.83)
	var symbol_size: float = minf(
		span.x * (0.64 if top else 0.74), span.y * (0.46 if column else 0.38)
	)
	if column and symbol_kind(i) in ["power", "water"]:
		symbol_at = Vector2(x - 0.22, 0.65)
		number_at = Vector2(x + 0.08, 0.65)
		number_width = span.x * 0.42
		symbol_size = minf(span.x * 0.40, span.y * 0.32)
	if symbol_kind(i) == "station":
		var station_number_y: float = 0.56 if column else (0.74 if top else 0.68)
		return {
			"label": Vector2(x, y),
			"symbol": Vector2(x - 0.17 if column else x, 0.56 if column else 0.46),
			"number": Vector2(x + 0.14 if column else x, station_number_y),
			"width": span.x * (0.60 if column else 0.83),
			"label_size": minf(22.0, span.y * 0.25),
			"number_width": span.x * (0.30 if column else 0.83),
			"number_size": minf(30.0, span.y * (0.26 if column else 0.20)),
			"symbol_size": minf(span.x * 0.64, span.y * (0.34 if column else 0.28)),
			"span": span
		}
	return {
		"label": Vector2(x, y),
		"symbol": symbol_at,
		"number": number_at,
		"width": span.x * (0.60 if column else 0.83),
		"label_size": minf(22.0, span.y * (0.29 if column else 0.25)),
		"number_width": number_width,
		"number_size": minf(22.0 if top else 29.0, span.y * (0.38 if column else 0.28)),
		"symbol_size": symbol_size,
		"span": span
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
			if kind in ["power", "water"] and deed.get("owner") != null:
				_draw_utility_multiplier(i, layout)
			else:
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


func _line(
	i: int,
	text: String,
	uv: Vector2,
	width: float,
	largest: float,
	ink: Color,
	left_aligned: bool = false
) -> void:
	var font: Font = _font
	var text_width: float = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 64).x
	var scale_of: float = minf(largest / 64.0, width / maxf(text_width, 1.0))
	draw_set_transform_matrix(surface_transform(i, uv, size).scaled_local(Vector2.ONE * scale_of))
	draw_string(
		font,
		Vector2(
			0.0 if left_aligned else -text_width / 2.0,
			(font.get_ascent(64) - font.get_descent(64)) / 2.0
		),
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
	if symbol_kind(i) in ["power", "water"]:
		return "×%d" % utility_display_multiplier(i)

	var rent: int = Rules.rent(view, i)
	if symbol_kind(i) == "station":
		var owner: int = int(deed["owner"])
		var station_count: int = 0
		for station_square: int in Rules.STATIONS:
			var station_owner: Variant = view["properties"][station_square].get("owner")
			if station_owner != null and int(station_owner) == owner:
				station_count += 1
		if station_count > 1:
			return "%s×%d" % [compact_number(Rules.STATION_FEE), station_count]
	var multiplier: int = Rules.rent_multiplier(view, i)
	if rent > 0 and multiplier > 1:
		var base_rent: int = int(float(rent) / float(multiplier))
		return "%s×%d" % [compact_number(base_rent), multiplier]
	return compact_number(rent)


static func utility_indicator_layout(layout: Dictionary) -> Dictionary:
	var center: Vector2 = layout["number"]
	var span_x: float = float(layout["span"].x) if layout.has("span") else 100.0
	var width_uv: float = float(layout["number_width"]) / span_x
	var left_uv: float = center.x - width_uv * 0.5
	var right_uv: float = center.x + width_uv * 0.5
	var icon_width_uv: float = width_uv * 0.48
	var gap_uv: float = width_uv * 0.015
	var icon_left_uv: float = left_uv
	var icon_right_uv: float = left_uv + icon_width_uv
	var text_left_uv: float = icon_right_uv + gap_uv
	var text_right_uv: float = right_uv
	var icon_center_uv: float = (icon_left_uv + icon_right_uv) * 0.5
	var text_center_uv: float = (text_left_uv + text_right_uv) * 0.5
	return {
		"left": left_uv,
		"right": right_uv,
		"icon_left": icon_left_uv,
		"icon_right": icon_right_uv,
		"icon_center": icon_center_uv,
		"icon_width": icon_width_uv * span_x,
		"gap": gap_uv * span_x,
		"text_left": text_left_uv,
		"text_right": text_right_uv,
		"text_center": text_center_uv,
		"text_width": (text_right_uv - text_left_uv) * span_x,
	}


func utility_display_multiplier(i: int) -> int:
	var owner: Variant = view["properties"][i].get("owner")
	if owner != null and bool(view["players"][int(owner)].get("jailed", false)):
		return 0
	return Rules.utility_multiplier(view, i)


func _draw_utility_multiplier(i: int, layout: Dictionary) -> void:
	var number: Vector2 = layout["number"]
	var indicator: Dictionary = utility_indicator_layout(layout)
	var texture_size: Vector2 = Vector2(DICE_PAIR.get_size())
	var frame: Transform2D = surface_transform(i, Vector2(indicator["icon_center"], number.y), size)
	var icon_aspect: float = texture_size.x / maxf(texture_size.y, 1.0)
	var icon_height: float = minf(
		float(layout["number_size"]) * 1.10,
		float(indicator["icon_width"]) * frame.x.length() * 0.90 / icon_aspect
	)
	var icon_width: float = icon_height * icon_aspect
	var scale_x: float = icon_width / (texture_size.x * maxf(frame.x.length(), 0.001))
	var scale_y: float = icon_height / (texture_size.y * maxf(frame.y.length(), 0.001))
	draw_set_transform_matrix(frame.scaled_local(Vector2(scale_x, scale_y)))
	draw_texture_rect(DICE_PAIR, Rect2(-texture_size / 2.0, texture_size), false, Color.WHITE)
	draw_set_transform_matrix(Transform2D.IDENTITY)
	_line(
		i,
		"×%d" % utility_display_multiplier(i),
		Vector2(indicator["text_left"], number.y),
		float(indicator["text_width"]),
		float(layout["number_size"]) * 0.82,
		INK,
		true
	)
