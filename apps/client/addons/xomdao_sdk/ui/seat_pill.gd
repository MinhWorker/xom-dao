class_name XomDaoSeatPill
extends PanelContainer
## A player kept small on a card table, so your own cards get the room: the avatar (its ring can
## run down with a clock), the name, how they stand ("Đang xếp", "Đã lật"…) in `tag`, their points
## on a chip and an optional `badge` on the avatar (the dealer's mark). Painted in the table's
## XomDaoTableSkin with `dress`; yours gets a brighter edge.
##
##   var pill := XomDaoSeatPill.new()
##   pill.dress(skin, seat == me)
##   pill.show_player(info, "Máy 1", 12, "Xong", Color.WHITE, -1.0)

const AVATAR := 56.0
const WIDTH := 236.0

var avatar := XomDaoAvatar.new()
var tag := Label.new()
var points: XomDaoChip = XomDaoChip.create("")
## A small picture on the avatar's lower right (the dealer's mark); null hides it.
var badge: Texture2D:
	set(value):
		badge = value
		_badge.texture = value
		_badge.visible = value != null

var _name := Label.new()
var _badge := TextureRect.new()


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size.x = WIDTH
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(row)
	avatar.custom_minimum_size = Vector2.ONE * AVATAR
	avatar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(avatar)
	_badge.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_badge.size = Vector2.ONE * AVATAR * 0.5
	_badge.position = Vector2.ONE * AVATAR * 0.58
	_badge.visible = false
	avatar.add_child(_badge)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", -4)
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(column)
	_name.add_theme_font_override("font", XomDaoUi.display_font(800))
	_name.add_theme_font_size_override("font_size", 24)
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_name.custom_minimum_size.x = 76.0
	column.add_child(_name)
	tag.add_theme_font_override("font", XomDaoUi.body_font(true))
	tag.add_theme_font_size_override("font_size", 19)
	column.add_child(tag)
	points.compact()
	points.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(points)


## Paints the seat in the table's skin; `mine` gets the bright edge.
func dress(skin: XomDaoTableSkin, mine: bool) -> void:
	var style: StyleBoxFlat = XomDaoUi.with_shadow(skin.plate_box(3 if mine else 2))
	if mine:
		style.border_color = skin.edge.lightened(0.35)
	style.content_margin_left = 8.0
	style.content_margin_right = 10.0
	style.content_margin_top = 6.0
	style.content_margin_bottom = 6.0
	add_theme_stylebox_override("panel", style)
	_name.add_theme_color_override("font_color", skin.ink)
	points.dress(skin.chip, skin.chip_edge, skin.chip_ink)
	avatar.timer_color = skin.timer
	avatar.timer_track = skin.timer_track


## Shows a player. `clock`: the share of the arranging time left while they still arrange (the
## avatar's ring), or -1.
func show_player(
	info: XomDaoPlayerInfo, title: String, score: int, words: String, tint: Color, clock: float
) -> void:
	_name.text = title
	avatar.initial = title
	avatar.frame = info.frame
	if info.id != "":
		avatar.picture = XomDaoLooks.avatar("bot" if info.bot else info.avatar)
	points.text = "%d điểm" % score
	tag.text = words
	tag.visible = words != ""
	tag.add_theme_color_override("font_color", tint)
	avatar.turn = clock
