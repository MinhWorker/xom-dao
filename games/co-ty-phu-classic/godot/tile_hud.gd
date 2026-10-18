extends Control
## A perspective-aligned deed summary for the square the viewer's pawn occupies.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const Marks := preload("res://content/co-ty-phu-classic/marks.gd")
const Draw := preload("res://content/co-ty-phu-classic/surface_draw.gd")
const BUILD_BUTTON := preload("res://content/co-ty-phu-classic/art/board-button-primary.webp")
const BUILD_BUTTON_PRESSED := preload(
	"res://content/co-ty-phu-classic/art/board-button-primary-pressed.webp"
)
const HOUSE_ICON := preload("res://content/co-ty-phu-classic/art/hud-house.svg")
const HOTEL_ICON := preload("res://content/co-ty-phu-classic/art/hud-hotel.svg")
const CONSTRUCTION_ICON := preload("res://content/co-ty-phu-classic/art/hud-construction.svg")
const INKS: Array[Color] = [Color("#DF6554"), Color("#5793D3"), Color("#60AF72"), Color("#E6BE52")]
const PANEL_BACK := Rect2(Vector2(0.995, 0.19), Vector2(0.27, 0.70))
const PANEL_FACE := Rect2(Vector2(1.005, 0.20), Vector2(0.25, 0.68))
const PANEL_INNER := Rect2(Vector2(1.012, 0.207), Vector2(0.236, 0.666))
const PANEL_INK := Color("#153A42")
const PANEL_FACE_INK := Color("#E8D2A6")
const PANEL_INNER_INK := Color("#F7EED9")
const PANEL_LINE := Color("#A37E4D")
const PANEL_TEXT := Color("#19383B")
const PANEL_MUTED := Color("#526864")
const BUILD_BUTTON_RECT := Rect2(Vector2(1.027, 0.8), Vector2(0.206, 0.064))
const DRAWER_RECT := Rect2(Vector2(1.018, 0.444), Vector2(0.224, 0.356))
const DRAWER_COST_ROW_Y := 0.512
const DRAWER_DIVIDER_Y := 0.532
const DRAWER_COLUMNS_Y := 0.548
const DRAWER_RENT_ROW_Y := 0.582
const DRAWER_RENT_ROW_STEP := 0.040
const DRAWER_RENT_ROW_HEIGHT := 0.026
const GROUP_NAMES: Dictionary = {
	"nau": "Nâu",
	"xanh-nhat": "Xanh nhạt",
	"hong": "Hồng",
	"cam": "Cam",
	"do": "Đỏ",
	"vang": "Vàng",
	"xanh-la": "Xanh lá",
	"xanh-dam": "Xanh đậm",
}
const KIND_NAMES: Dictionary = {
	"street": "Đất phố",
	"station": "Bến xe",
	"utility": "Tiện ích",
	"start": "Xuất phát",
	"jail": "Nhà tù",
	"go-jail": "Vào tù",
	"chance": "Cơ hội",
	"chest": "Khí vận",
	"tax": "Thuế",
	"airport": "Sân bay",
}

var current_square: int = -1
var details: Dictionary = {}
var _display: Font
var _body: Font
var _board_extent := Vector2.ZERO
var _draw_offset := Vector2.ZERO
var _paused_for_motion: bool = false
var _motion_time: float = 0.0
var _build_button: XomDaoButton
var _drawer_open: bool = false
var _drawer_progress: float = 0.0
var _drawer_tween: Tween


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_display = Draw.ink_font()
	var body: FontFile = XomDaoUi.body_font(true).duplicate() as FontFile
	body.generate_mipmaps = true
	_body = body
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	set_process(false)
	_build_button = XomDaoButton.create("^", XomDaoUi.Kind.CONFIRM)
	_build_button.name = "BuildPriceDrawerButton"
	_build_button.mouse_filter = Control.MOUSE_FILTER_STOP
	_build_button.modulate.a = 0.0
	_build_button.custom_minimum_size = Vector2.ZERO
	_build_button.add_theme_font_size_override("font_size", 1)
	_build_button.pressed.connect(_toggle_build_drawer)
	add_child(_build_button)


func refresh(view: Dictionary, square: int, names: Array[String], viewer: int) -> void:
	current_square = square
	details = summary(view, square, names, viewer)
	_sync_build_button()
	queue_redraw()


func layout_on_board(board: Control) -> void:
	_board_extent = board.size
	var points: PackedVector2Array = Draw.quad(PANEL_BACK.grow(0.012), _board_extent)
	var low := Vector2(INF, INF)
	var high := Vector2(-INF, -INF)
	for point: Vector2 in points:
		low = low.min(point)
		high = high.max(point)
	_draw_offset = low
	position = board.position + low
	size = high - low
	_layout_build_button()
	queue_redraw()


func _layout_build_button() -> void:
	if _build_button == null or _board_extent == Vector2.ZERO:
		return
	var points: PackedVector2Array = _quad(BUILD_BUTTON_RECT)
	var low := Vector2(INF, INF)
	var high := Vector2(-INF, -INF)
	for point: Vector2 in points:
		low = low.min(point)
		high = high.max(point)
	_build_button.position = low
	_build_button.size = high - low


func _sync_build_button() -> void:
	if _build_button == null:
		return
	var available: bool = (
		bool(details.get("can_show_build_prices", false)) and not _paused_for_motion
	)
	if not available and _drawer_open:
		_set_drawer_open(false, true)
	_build_button.visible = available
	_build_button.text = "v" if _drawer_open else "^"
	_layout_build_button()


func _toggle_build_drawer() -> void:
	if bool(details.get("can_show_build_prices", false)):
		_set_drawer_open(not _drawer_open)


func _set_drawer_open(open: bool, immediate: bool = false) -> void:
	if open and not bool(details.get("can_show_build_prices", false)):
		return
	_drawer_open = open
	if _build_button != null:
		_build_button.text = "v" if open else "^"
	if _drawer_tween != null and _drawer_tween.is_running():
		_drawer_tween.kill()
	var target: float = 1.0 if open else 0.0
	if immediate or not is_inside_tree():
		_set_drawer_progress(target)
		return
	_drawer_tween = create_tween()
	(
		_drawer_tween
		. tween_method(_set_drawer_progress, _drawer_progress, target, 0.32)
		. set_trans(Tween.TRANS_CUBIC)
		. set_ease(Tween.EASE_OUT)
	)


func _set_drawer_progress(value: float) -> void:
	_drawer_progress = value
	queue_redraw()


func follow(
	view: Dictionary,
	positions: Array[int],
	names: Array[String],
	viewer: int,
	square_override: int = -1
) -> void:
	if _paused_for_motion:
		return
	if view.is_empty() or positions.is_empty():
		return
	if view.get("winner") != null:
		hide()
		return
	var seat: int = (
		viewer if viewer >= 0 and viewer < positions.size() else Rules.decision_seat(view)
	)
	seat = clampi(seat, 0, positions.size() - 1)
	var square: int = positions[seat] if square_override < 0 else square_override
	refresh(view, square, names, seat)
	show()


func movement_started(seat: int, viewer: int) -> void:
	if seat != viewer and viewer >= 0:
		return
	_set_drawer_open(false, true)
	_paused_for_motion = true
	_motion_time = 0.0
	_sync_build_button()
	set_process(true)
	show()
	queue_redraw()


func movement_stopped(
	seat: int, view: Dictionary, positions: Array[int], names: Array[String], viewer: int
) -> void:
	if seat != viewer and viewer >= 0:
		return
	_paused_for_motion = false
	set_process(false)
	follow(view, positions, names, viewer)


func _process(delta: float) -> void:
	if not _paused_for_motion:
		set_process(false)
		return
	_motion_time += delta
	queue_redraw()


static func summary(view: Dictionary, square: int, names: Array[String], viewer: int) -> Dictionary:
	if square < 0 or square >= Rules.SQUARES.size():
		return {}
	var cell: Dictionary = Rules.SQUARES[square]
	var properties: Array = view.get("properties", [])
	if square >= properties.size():
		return {}
	var deed: Dictionary = properties[square]
	var held: Variant = deed.get("owner")
	var owner: int = -1 if held == null else int(held)
	var kind: String = str(cell["kind"])
	var group: String = str(cell.get("group", ""))
	var group_squares: Array[int] = Rules.group_of(square)
	var group_owner: int = owner if owner >= 0 else viewer
	var group_count: int = 0
	var group_owners: Array[int] = []
	for i: int in group_squares:
		var member_owner: Variant = properties[i].get("owner")
		var member_seat: int = -1 if member_owner == null else int(member_owner)
		group_owners.append(member_seat)
		if member_seat == group_owner:
			group_count += 1
	var dice: Variant = view.get("dice")
	var roll: int = 7
	if dice is Array and dice.size() == 2:
		roll = int(dice[0]) + int(dice[1])
	var rent: int = Rules.rent(view, square, roll)
	if owner < 0 and kind == "street":
		rent = int((cell["rent"] as Array)[0])
	var mortgaged: bool = bool(deed.get("mortgaged", false))
	var jailed_owner: bool = owner >= 0 and bool(view["players"][owner].get("jailed", false))
	var rent_ladder: Array[int] = []
	if kind == "street":
		var multiplier: int = Rules.rent_multiplier(view, square)
		for base_rent: Variant in cell["rent"]:
			rent_ladder.append(int(base_rent) * multiplier)
	var rent_note: String = "Tiền thuê hiện tại" if owner >= 0 else "Thuê cơ bản"
	var rent_text: String = XomDaoUi.money(rent) + " ₫"
	var station_turn: String = ""
	var station_rows: Array[Dictionary] = []
	var info_label: String = ""
	var info_value: String = ""
	var price_label: String = "Góp đầu" if kind == "station" and owner < 0 else "Giá mua"
	if owner < 0 and kind == "station":
		rent_note = "Phí thuê"
		rent_text = "%s ₫ mỗi bến" % XomDaoUi.money(Rules.STATION_FEE)
	elif owner < 0 and kind == "utility":
		rent_note = "Phí thuê"
		rent_text = "×4 / ×10 xúc xắc"
	if kind == "station":
		var auctions: Dictionary = view.get("stationAuctions", {})
		var station: Variant = auctions.get(str(square), auctions.get(square))
		var active_auction: Variant = view.get("auction")
		if active_auction is Dictionary and int(active_auction.get("square", -1)) == square:
			station = active_auction
			var bidder_value: Variant = active_auction.get("bidder")
			var bidder: int = -1 if bidder_value == null else int(bidder_value)
			if bidder >= 0:
				station_turn = names[bidder] if bidder < names.size() else "Người %d" % (bidder + 1)
		if station is Dictionary:
			var bids: Array = station.get("bids", [])
			var contributions: Array = station.get("contributions", [])
			var leader_value: Variant = station.get("leader")
			var leader: int = -1 if leader_value == null else int(leader_value)
			for seat: int in mini(bids.size(), names.size()):
				var amount: int = int(bids[seat])
				if amount <= 0:
					continue
				var count: int = 1
				if seat < contributions.size():
					count = maxi(1, int(contributions[seat]))
				(
					station_rows
					. append(
						{
							"seat": seat,
							"name": names[seat],
							"amount": amount,
							"count": count,
							"leading": seat == leader,
						}
					)
				)
	var owner_name: String = "Chưa có chủ"
	if owner >= 0:
		owner_name = names[owner] if owner < names.size() else "Người %d" % (owner + 1)
	var group_owner_name: String = "Bạn"
	if group_owner >= 0 and group_owner != viewer:
		group_owner_name = (
			names[group_owner] if group_owner < names.size() else "Người %d" % (group_owner + 1)
		)
	var description: String = ""
	match kind:
		"start":
			info_label = "Qua hoặc dừng"
			info_value = "+200 ₫"
		"jail":
			description = "Ghé thăm bình thường."
		"go-jail":
			description = "Đi thẳng tới Nhà tù."
		"chance":
			description = "Rút một lá bài Cơ hội."
		"chest":
			description = "Rút một lá bài Khí vận."
		"airport":
			description = "Bay tới một ô ngẫu nhiên."
		"tax":
			var cash: int = int(view["players"][viewer]["cash"]) if viewer >= 0 else 0
			var amount: int = maxi(int(cell.get("tax", 0)), floori(cash * 0.1))
			info_label = "Thuế phải nộp"
			info_value = XomDaoUi.money(amount) + " ₫"
	return {
		"square": square,
		"name": str(cell["name"]),
		"kind": kind,
		"kind_name": str(KIND_NAMES.get(kind, "Ô ĐẤT")),
		"price_label": price_label,
		"description": description,
		"info_label": info_label,
		"info_value": info_value,
		"price": Rules.deed_price(properties, square),
		"rent": rent,
		"rent_note": rent_note,
		"rent_text": rent_text,
		"rent_ladder": rent_ladder,
		"station_turn": station_turn,
		"station_rows": station_rows,
		"rent_collectible": owner >= 0 and not mortgaged and not jailed_owner,
		"owner": owner,
		"owner_name": owner_name,
		"mortgaged": mortgaged,
		"jailed_owner": jailed_owner,
		"houses": int(deed.get("houses", 0)),
		"house_cost": int(cell.get("houseCost", 0)),
		"group": group,
		"group_name": str(GROUP_NAMES.get(group, "")),
		"group_count": group_count,
		"group_size": group_squares.size(),
		"group_owner_name": group_owner_name,
		"group_owners": group_owners,
		"accent": Rules.GROUP_COLORS.get(group, XomDaoUi.GOLD),
		"title_ink":
		(
			Marks.owner_ink(owner)
			if owner >= 0
			else Rules.GROUP_COLORS.get(group, XomDaoUi.INK).darkened(0.35)
		),
		"can_show_build_prices": owner >= 0 and owner == viewer and kind == "street",
	}


func _draw() -> void:
	if details.is_empty() or _display == null or _board_extent == Vector2.ZERO:
		return
	var shadow := PANEL_BACK.grow(0.012)
	shadow.position += Vector2(0.008, 0.012)
	_paint_surface(shadow, Color("#081C2B"), XomDaoUi.NAVY)
	_paint_surface(PANEL_BACK, PANEL_INK, XomDaoUi.NAVY_LINE)
	_paint_surface(PANEL_FACE, PANEL_FACE_INK, XomDaoUi.GOLD_DARK)
	_paint_surface(PANEL_INNER, PANEL_INNER_INK, PANEL_LINE)
	_paint_surface(
		Rect2(
			PANEL_FACE.position + Vector2(0.009, 0.004), Vector2(PANEL_FACE.size.x - 0.018, 0.006)
		),
		details["accent"],
		details["accent"]
	)
	if _paused_for_motion:
		_draw_runner_panel()
		return
	_draw_header()
	_surface_line(
		Vector2(PANEL_INNER.position.x + 0.016, 0.345),
		Vector2(PANEL_INNER.end.x - 0.016, 0.345),
		PANEL_LINE,
		1.5
	)
	if int(details["price"]) > 0:
		_draw_property()
	else:
		_draw_special()
	if _drawer_progress > 0.001:
		_draw_build_price_drawer()
	if bool(details.get("can_show_build_prices", false)):
		_draw_build_price_button()


func _draw_header() -> void:
	var center_x: float = PANEL_INNER.get_center().x
	var width: float = PANEL_INNER.size.x - 0.04
	var category: String = str(details["kind_name"]).to_upper()
	_surface_text(category, Vector2(center_x, 0.232), 0.020, width, PANEL_MUTED)
	var group_name: String = str(details["group_name"])
	if not group_name.is_empty():
		_surface_text(
			group_name.to_upper(),
			Vector2(center_x, 0.258),
			0.022,
			width,
			details["accent"].darkened(0.28)
		)
	_surface_text(
		str(details["name"]),
		Vector2(center_x, 0.303),
		0.043,
		width,
		details["title_ink"],
		HORIZONTAL_ALIGNMENT_CENTER,
		_display
	)


func _draw_property() -> void:
	var row_width: float = PANEL_INNER.size.x - 0.038
	var center_x: float = PANEL_INNER.get_center().x
	_value_row(
		str(details["price_label"]),
		XomDaoUi.money(int(details["price"])) + " ₫",
		0.382,
		row_width,
		PANEL_TEXT
	)
	_surface_text("CHỦ SỞ HỮU", Vector2(center_x, 0.423), 0.018, row_width, PANEL_MUTED)
	_surface_text(
		str(details["owner_name"]),
		Vector2(center_x, 0.453),
		0.032,
		row_width,
		details["title_ink"] if int(details["owner"]) >= 0 else PANEL_TEXT,
		HORIZONTAL_ALIGNMENT_CENTER,
		_display
	)
	_surface_line(
		Vector2(PANEL_INNER.position.x + 0.016, 0.485),
		Vector2(PANEL_INNER.end.x - 0.016, 0.485),
		PANEL_LINE,
		1.0
	)
	if bool(details["mortgaged"]):
		_surface_text(
			"ĐANG THẾ CHẤP", Vector2(center_x, 0.520), 0.024, row_width, XomDaoUi.DOWN_ON_PAPER
		)
	elif bool(details["jailed_owner"]):
		_surface_text("CHỦ ĐANG Ở TÙ", Vector2(center_x, 0.520), 0.024, row_width, Color("#80511F"))
	else:
		var is_current_rent: bool = str(details["rent_note"]) == "Tiền thuê hiện tại"
		var rent_label_size: float = 0.05 if is_current_rent else 0.021
		var rent_label_share: float = 0.5
		if is_current_rent:
			rent_label_share = 0.72 if str(details["rent_text"]).length() <= 5 else 0.66
		_value_row(
			str(details["rent_note"]),
			str(details["rent_text"]),
			0.520,
			row_width,
			PANEL_TEXT,
			rent_label_size,
			rent_label_share,
			_display if is_current_rent else null,
			PANEL_TEXT if is_current_rent else PANEL_MUTED
		)
	if int(details["group_size"]) > 0:
		_value_row(
			"Bộ đất",
			"%d / %d" % [details["group_count"], details["group_size"]],
			0.575,
			row_width,
			details["accent"]
		)
		_draw_group_marks(row_width)
		_surface_text(
			"Của " + str(details["group_owner_name"]),
			Vector2(center_x, 0.632),
			0.020,
			row_width,
			PANEL_MUTED
		)
	if str(details["kind"]) == "station":
		_draw_station_status(row_width)
	if int(details["house_cost"]) > 0:
		_surface_line(
			Vector2(PANEL_INNER.position.x + 0.016, 0.663),
			Vector2(PANEL_INNER.end.x - 0.016, 0.663),
			PANEL_LINE,
			1.0
		)
		var houses: int = int(details["houses"])
		_draw_building_level(houses, Vector2(center_x, 0.688), row_width)
		_icon_value_row(
			CONSTRUCTION_ICON, XomDaoUi.money(int(details["house_cost"])) + " ₫", 0.727, row_width
		)


func _draw_station_status(width: float) -> void:
	var center_x: float = PANEL_INNER.get_center().x
	_surface_line(
		Vector2(PANEL_INNER.position.x + 0.016, 0.568),
		Vector2(PANEL_INNER.end.x - 0.016, 0.568),
		PANEL_LINE,
		1.0
	)
	_surface_text("GÓP BẾN XE", Vector2(center_x, 0.589), 0.019, width, PANEL_MUTED)
	var top: float = 0.615
	var turn: String = str(details.get("station_turn", ""))
	if not turn.is_empty():
		_surface_text("Lượt: " + turn, Vector2(center_x, top), 0.019, width, PANEL_MUTED)
		top += 0.029
	var rows: Array = details.get("station_rows", [])
	if rows.is_empty():
		_surface_text("Chưa có khoản góp", Vector2(center_x, top + 0.012), 0.021, width, PANEL_TEXT)
		return
	for index: int in mini(rows.size(), 4):
		var contribution: Dictionary = rows[index]
		var y: float = top + index * 0.045
		var half: float = width * 0.5
		var leader: bool = bool(contribution["leading"])
		var label: String = "%s · %d lượt" % [contribution["name"], contribution["count"]]
		_surface_text(
			label,
			Vector2(center_x - half * 0.43, y),
			0.019,
			half * 0.82,
			details["accent"] if leader else PANEL_TEXT,
			HORIZONTAL_ALIGNMENT_LEFT
		)
		_surface_text(
			XomDaoUi.money(int(contribution["amount"])) + " ₫",
			Vector2(center_x + half * 0.49, y),
			0.020,
			half * 0.88,
			PANEL_TEXT,
			HORIZONTAL_ALIGNMENT_RIGHT,
			_display
		)


func _draw_runner_panel() -> void:
	var center_x: float = PANEL_INNER.get_center().x
	var width: float = PANEL_INNER.size.x - 0.038
	_surface_text("ĐANG DI CHUYỂN", Vector2(center_x, 0.389), 0.027, width, PANEL_MUTED)
	_surface_line(
		Vector2(PANEL_INNER.position.x + 0.016, 0.424),
		Vector2(PANEL_INNER.end.x - 0.016, 0.424),
		PANEL_LINE,
		1.0
	)
	_draw_running_figure(Vector2(center_x, 0.690), _motion_time)
	_surface_text("·  ·  ·", Vector2(center_x, 0.816), 0.020, width, PANEL_MUTED)


func _draw_running_figure(base: Vector2, elapsed: float) -> void:
	var phase: float = elapsed * 9.0
	var stride: float = sin(phase)
	var lift: float = absf(cos(phase)) * 0.007
	var x: float = base.x + sin(elapsed * 1.7) * 0.006
	var y: float = base.y - lift
	var ink: Color = PANEL_INK
	for index: int in 3:
		var alpha: float = 0.28 + 0.12 * sin(phase - index * 0.8)
		var line_ink := Color(PANEL_MUTED.r, PANEL_MUTED.g, PANEL_MUTED.b, alpha)
		var line_y: float = y - 0.078 + index * 0.034
		_surface_line(
			Vector2(x - 0.078 - index * 0.009, line_y),
			Vector2(x - 0.043 - index * 0.009, line_y),
			line_ink,
			2.2
		)
	_surface_line(Vector2(x - 0.065, y + 0.086), Vector2(x + 0.061, y + 0.086), PANEL_LINE, 1.0)
	var shoulder := Vector2(x + 0.009, y - 0.063)
	var hip := Vector2(x - 0.009, y + 0.008)
	var back_elbow := Vector2(x - 0.039, y - 0.027 + stride * 0.018)
	var back_hand := Vector2(x - 0.052 - stride * 0.010, y + 0.006 + stride * 0.014)
	var front_elbow := Vector2(x + 0.038, y - 0.097 - stride * 0.014)
	var front_hand := Vector2(x + 0.055, y - 0.126 + stride * 0.016)
	var back_knee := Vector2(x - 0.041, y + 0.050 + stride * 0.018)
	var back_foot := Vector2(x - 0.069 + stride * 0.027, y + 0.078)
	var front_knee := Vector2(x + 0.026, y + 0.043 - stride * 0.021)
	var front_foot := Vector2(x + 0.061 - stride * 0.025, y + 0.077)
	_runner_limb(hip, back_knee, back_foot, ink)
	_runner_limb(shoulder, back_elbow, back_hand, ink)
	var torso := PackedVector2Array(
		[
			_project(shoulder + Vector2(-0.010, -0.008)),
			_project(shoulder + Vector2(0.012, -0.014)),
			_project(hip + Vector2(0.010, 0.018)),
			_project(hip + Vector2(-0.013, 0.014)),
		]
	)
	draw_colored_polygon(torso, ink)
	_draw_runner_circle(Vector2(x + 0.017, y - 0.094), 0.018, ink)
	_runner_limb(hip, front_knee, front_foot, ink)
	_runner_limb(shoulder, front_elbow, front_hand, ink)
	var scarf := PackedVector2Array(
		[
			_project(shoulder + Vector2(-0.006, -0.006)),
			_project(shoulder + Vector2(-0.032, -0.014 - stride * 0.008)),
			_project(shoulder + Vector2(-0.017, 0.006)),
		]
	)
	draw_colored_polygon(scarf, ink)


func _runner_limb(start: Vector2, joint: Vector2, end: Vector2, ink: Color) -> void:
	_surface_line(start, joint, ink, 6.5)
	_surface_line(joint, end, ink, 6.5)
	_draw_runner_circle(joint, 0.007, ink)


func _draw_runner_circle(at: Vector2, radius: float, ink: Color) -> void:
	var frame := _surface_frame(at)
	var pixel_radius: float = radius * frame.x.length()
	draw_set_transform_matrix(Transform2D(0.0, frame.origin))
	var points := PackedVector2Array()
	for s: int in 16:
		var angle: float = s * TAU / 16.0
		points.append(Vector2(cos(angle), sin(angle)) * pixel_radius)
	draw_colored_polygon(points, ink)
	draw_set_transform_matrix(Transform2D.IDENTITY)


func _draw_special() -> void:
	var row_width: float = PANEL_INNER.size.x - 0.038
	var center_x: float = PANEL_INNER.get_center().x
	var info_label: String = str(details["info_label"])
	var info_value: String = str(details["info_value"])
	if not info_label.is_empty() and not info_value.is_empty():
		_value_row(info_label, info_value, 0.410, row_width, PANEL_TEXT)
		_surface_line(
			Vector2(PANEL_INNER.position.x + 0.016, 0.455),
			Vector2(PANEL_INNER.end.x - 0.016, 0.455),
			PANEL_LINE,
			1.0
		)
	var description: String = str(details["description"])
	if not description.is_empty():
		_draw_paragraph(description, Vector2(center_x, 0.530), row_width, 0.030, 4)


func _draw_build_price_button() -> void:
	var texture: Texture2D = BUILD_BUTTON_PRESSED if _build_button.is_pressed() else BUILD_BUTTON
	var points: PackedVector2Array = _quad(BUILD_BUTTON_RECT)
	draw_polygon(
		points,
		PackedColorArray([Color.WHITE]),
		PackedVector2Array([Vector2.ZERO, Vector2.RIGHT, Vector2.ONE, Vector2.DOWN]),
		texture
	)
	var center: Vector2 = BUILD_BUTTON_RECT.get_center()
	var left: Vector2
	var tip: Vector2
	var right: Vector2
	if _drawer_open:
		left = center + Vector2(-0.011, -0.004)
		tip = center + Vector2(0.0, 0.006)
		right = center + Vector2(0.011, -0.004)
	else:
		left = center + Vector2(-0.011, 0.004)
		tip = center + Vector2(0.0, -0.006)
		right = center + Vector2(0.011, 0.004)
	_surface_line(left, tip, XomDaoUi.CREAM, 3.0)
	_surface_line(tip, right, XomDaoUi.CREAM, 3.0)


func _draw_build_price_drawer() -> void:
	var top: float = lerpf(DRAWER_RECT.end.y, DRAWER_RECT.position.y, _drawer_progress)
	var drawer := Rect2(
		Vector2(DRAWER_RECT.position.x, top), Vector2(DRAWER_RECT.size.x, DRAWER_RECT.end.y - top)
	)
	var shadow := drawer.grow(0.004)
	shadow.position += Vector2(0.004, 0.005)
	_paint_surface(shadow, Color("#102934"), PANEL_INK)
	_paint_surface(drawer, PANEL_INNER_INK, PANEL_LINE)
	var shift: float = top - DRAWER_RECT.position.y
	var center_x: float = drawer.get_center().x
	var content_width: float = DRAWER_RECT.size.x - 0.032
	var title_y: float = 0.463 + shift
	if _drawer_text_visible(title_y, top, 0.012):
		_surface_text(
			"Bảng giá xây",
			Vector2(center_x, title_y),
			0.024,
			content_width,
			PANEL_TEXT,
			HORIZONTAL_ALIGNMENT_CENTER,
			_display
		)
	if not bool(details["rent_collectible"]):
		var subtitle: String = (
			"Đang thế chấp, tạm ngừng thu"
			if bool(details["mortgaged"])
			else "Chủ đang ở tù, tạm ngừng thu"
		)
		var subtitle_y: float = 0.484 + shift
		if _drawer_text_visible(subtitle_y, top, 0.010):
			_surface_text(
				subtitle, Vector2(center_x, subtitle_y), 0.017, content_width, PANEL_MUTED
			)
	var cost_y: float = DRAWER_COST_ROW_Y + shift
	if _drawer_text_visible(cost_y, top, 0.013):
		_icon_value_row(
			CONSTRUCTION_ICON,
			XomDaoUi.money(int(details["house_cost"])) + " ₫",
			cost_y,
			content_width,
			PANEL_TEXT
		)
	var divider_y: float = DRAWER_DIVIDER_Y + shift
	if divider_y > top + 0.004 and divider_y < DRAWER_RECT.end.y - 0.004:
		_surface_line(
			Vector2(DRAWER_RECT.position.x + 0.014, divider_y),
			Vector2(DRAWER_RECT.end.x - 0.014, divider_y),
			PANEL_LINE,
			1.0
		)
	var columns_y: float = DRAWER_COLUMNS_Y + shift
	if _drawer_text_visible(columns_y, top, 0.010):
		var half: float = content_width * 0.5
		_surface_text("Bậc", Vector2(center_x - half * 0.5, columns_y), 0.016, half, PANEL_MUTED)
		_surface_text(
			"Tiền thuê", Vector2(center_x + half * 0.5, columns_y), 0.016, half, PANEL_MUTED
		)
	var rents: Array = details["rent_ladder"]
	for level: int in mini(rents.size(), 6):
		var row_y: float = DRAWER_RENT_ROW_Y + DRAWER_RENT_ROW_STEP * level + shift
		if not _drawer_text_visible(row_y, top, DRAWER_RENT_ROW_HEIGHT * 0.5):
			continue
		if level == int(details["houses"]):
			var row := Rect2(
				Vector2(DRAWER_RECT.position.x + 0.008, row_y - DRAWER_RENT_ROW_HEIGHT * 0.5),
				Vector2(DRAWER_RECT.size.x - 0.016, DRAWER_RENT_ROW_HEIGHT)
			)
			_paint_surface(row.grow(0.004), Color("#8FCF5A55"), Color("#8FCF5A55"))
			_paint_surface(row, Color("#E3F2B7"), Color("#56915A"))
		_draw_rent_row(level, int(rents[level]), row_y, content_width)


func _draw_building_level(houses: int, at: Vector2, width: float) -> void:
	if houses == 0:
		_surface_text("Đất trống", at, 0.022, width, PANEL_TEXT)
	elif houses == 5:
		_draw_surface_icon(HOTEL_ICON, at, Vector2(0.043, 0.036), PANEL_TEXT)
	else:
		_draw_surface_icons(HOUSE_ICON, houses, at, Vector2(0.030, 0.030), 0.007, PANEL_TEXT)


func _draw_rent_row(level: int, rent: int, y: float, width: float) -> void:
	var center_x: float = DRAWER_RECT.get_center().x
	var half: float = width * 0.5
	var label_at := Vector2(center_x - half * 0.5, y)
	if level == 0:
		_surface_text("Đất trống", label_at, 0.018, half - 0.008, PANEL_TEXT)
	elif level == 5:
		_draw_surface_icon(HOTEL_ICON, label_at, Vector2(0.039, 0.032), PANEL_TEXT)
	else:
		_draw_surface_icons(HOUSE_ICON, level, label_at, Vector2(0.022, 0.022), 0.001, PANEL_TEXT)
	_surface_text(
		XomDaoUi.money(rent) + " ₫",
		Vector2(center_x + half * 0.5, y),
		0.026,
		half - 0.008,
		PANEL_TEXT,
		HORIZONTAL_ALIGNMENT_RIGHT,
		_display
	)


func _icon_value_row(
	icon: Texture2D, value: String, y: float, width: float, value_ink: Color = PANEL_TEXT
) -> void:
	var center_x: float = PANEL_INNER.get_center().x
	var half: float = width * 0.5
	_draw_surface_icon(icon, Vector2(center_x - half * 0.5, y), Vector2(0.041, 0.041), PANEL_MUTED)
	_surface_text(
		value,
		Vector2(center_x + half * 0.5, y),
		0.026,
		half - 0.008,
		value_ink,
		HORIZONTAL_ALIGNMENT_RIGHT,
		_display
	)


func _draw_surface_icons(
	icon: Texture2D, count: int, at: Vector2, icon_size: Vector2, gap: float, tint: Color
) -> void:
	var total_width: float = icon_size.x * count + gap * (count - 1)
	var first_x: float = at.x - total_width * 0.5 + icon_size.x * 0.5
	for index: int in count:
		_draw_surface_icon(
			icon, Vector2(first_x + index * (icon_size.x + gap), at.y), icon_size, tint
		)


func _draw_surface_icon(icon: Texture2D, at: Vector2, icon_size: Vector2, tint: Color) -> void:
	draw_set_transform_matrix(_surface_frame(at).scaled_local(icon_size))
	draw_texture_rect(icon, Rect2(Vector2(-0.5, -0.5), Vector2.ONE), false, tint)
	draw_set_transform_matrix(Transform2D.IDENTITY)


func _drawer_text_visible(y: float, top: float, half_height: float) -> bool:
	return y - half_height >= top + 0.004 and y + half_height <= DRAWER_RECT.end.y - 0.004


func _value_row(
	label: String,
	value: String,
	y: float,
	width: float,
	value_ink: Color = PANEL_TEXT,
	label_height: float = 0.021,
	label_share: float = 0.5,
	label_font: Font = null,
	label_ink: Color = PANEL_MUTED
) -> void:
	var center_x: float = PANEL_INNER.get_center().x
	var label_width: float = width * label_share
	var value_width: float = width - label_width
	_surface_text(
		label,
		Vector2(center_x - width * 0.5 + label_width * 0.5, y),
		label_height,
		label_width - 0.008,
		label_ink,
		HORIZONTAL_ALIGNMENT_LEFT,
		label_font
	)
	_surface_text(
		value,
		Vector2(center_x + width * 0.5 - value_width * 0.5, y),
		0.026,
		value_width - 0.008,
		value_ink,
		HORIZONTAL_ALIGNMENT_RIGHT,
		_display
	)


func _draw_group_marks(width: float) -> void:
	var owners: Array = details["group_owners"]
	if owners.is_empty():
		return
	var gap: float = 0.006
	var mark_width: float = (width - gap * (owners.size() - 1)) / owners.size()
	var left: float = PANEL_INNER.get_center().x - width * 0.5
	for i: int in owners.size():
		var at := Rect2(Vector2(left + i * (mark_width + gap), 0.602), Vector2(mark_width, 0.012))
		var owner: int = int(owners[i])
		var fill: Color = INKS[owner % INKS.size()] if owner >= 0 else Color("#395B60")
		_paint_surface(at, fill, PANEL_LINE)


func _draw_paragraph(
	value: String, at: Vector2, width: float, height: float, max_lines: int
) -> void:
	var lines: Array[String] = [""]
	for word: String in value.split(" "):
		var candidate: String = word if lines[-1].is_empty() else lines[-1] + " " + word
		var measured: float = _body.get_string_size(candidate, HORIZONTAL_ALIGNMENT_LEFT, -1, 64).x
		if measured * height / 64.0 > width and not lines[-1].is_empty():
			lines.append(word)
		else:
			lines[-1] = candidate
	var count: int = mini(lines.size(), max_lines)
	var step: float = height * 1.22 * minf(1.0, float(max_lines) / lines.size())
	for i: int in count:
		_surface_text(
			lines[i],
			at + Vector2(0.0, (i - (count - 1) * 0.5) * step),
			step / 1.22,
			width,
			PANEL_TEXT
		)


func _surface_text(
	value: String,
	at: Vector2,
	height: float,
	width: float,
	ink: Color,
	alignment: int = HORIZONTAL_ALIGNMENT_CENTER,
	font: Font = null
) -> void:
	if value.is_empty() or width <= 0.0:
		return
	var chosen: Font = _body if font == null else font
	var measured: Vector2 = chosen.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, 64)
	var scale_of: float = minf(height / 64.0, width / maxf(1.0, measured.x))
	var origin_x: float = -measured.x * 0.5
	if alignment == HORIZONTAL_ALIGNMENT_LEFT:
		origin_x = -width * 0.5 / scale_of
	elif alignment == HORIZONTAL_ALIGNMENT_RIGHT:
		origin_x = width * 0.5 / scale_of - measured.x
	draw_set_transform_matrix(_surface_frame(at).scaled_local(Vector2.ONE * scale_of))
	draw_string(chosen, Vector2(origin_x, 22.0), value, HORIZONTAL_ALIGNMENT_LEFT, -1, 64, ink)
	draw_set_transform_matrix(Transform2D.IDENTITY)


func _surface_frame(at: Vector2) -> Transform2D:
	var frame: Transform2D = Draw.frame(at, _board_extent)
	frame.origin -= _draw_offset
	return frame


func _paint_surface(bounds: Rect2, fill: Color, edge: Color) -> void:
	var points: PackedVector2Array = _quad(bounds)
	draw_colored_polygon(points, fill)
	points.append(points[0])
	draw_polyline(points, edge, maxf(1.1, size.x / 350.0), true)


func _surface_line(from: Vector2, to: Vector2, ink: Color, weight: float) -> void:
	var points := PackedVector2Array([_project(from), _project(to)])
	draw_polyline(points, ink, maxf(0.6, weight * _board_extent.x / 1000.0), true)


func _quad(bounds: Rect2) -> PackedVector2Array:
	var points: PackedVector2Array = Draw.quad(bounds, _board_extent)
	for i: int in points.size():
		points[i] -= _draw_offset
	return points


func _project(at: Vector2) -> Vector2:
	return Rules.plane_point(at) * _board_extent - _draw_offset
