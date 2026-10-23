class_name MauBinhClockBar
extends Control
## The line under the seats while arranging: the round on its plate, a brass bar running down
## with the arranging time (madder in its last ten seconds), who is done ("Xong 3/4") and the
## seconds left. Comparing, only the round's plate stays, in the top left. Named for tests:
## Round, Info, Countdown.

var round_label := Label.new()
var info := Label.new()
var countdown := Label.new()
## The share of the arranging time left (-1: no clock) and the whole time in seconds.
var share: float = -1.0:
	set(value):
		share = value
		queue_redraw()
var total: float = 60.0

var _plate: PanelContainer
var _bar := Rect2()


func _init(skin: XomDaoTableSkin = null) -> void:
	name = "ClockBar"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	round_label.name = "Round"
	_plate = MauBinhBackdrop.plate(skin if skin != null else MauBinhBackdrop.skin(), round_label)
	add_child(_plate)
	info.name = "Info"
	countdown.name = "Countdown"
	for label: Label in [info, countdown]:
		MauBinhBackdrop.hud(label, XomDaoUi.TEXT_MIN)
		add_child(label)
	info.add_theme_color_override("font_color", MauBinhBackdrop.PALE)
	countdown.add_theme_color_override("font_color", Color("#FFE8A3"))


## Lays the line out in `area` (arranging) or keeps only the plate at `corner` (comparing).
func fit(area: Rect2, arranging: bool, corner: Vector2) -> void:
	position = Vector2.ZERO
	size = get_parent_control().size if get_parent_control() != null else area.end
	_plate.reset_size()
	info.visible = arranging
	countdown.visible = arranging
	if not arranging:
		_plate.position = corner
		_bar = Rect2()
		queue_redraw()
		return
	_plate.position = Vector2(area.position.x, area.position.y - 2.0)
	for label: Label in [info, countdown]:
		label.reset_size()
	countdown.position = Vector2(area.end.x - countdown.size.x, area.position.y)
	info.position = Vector2(countdown.position.x - 18.0 - info.size.x, area.position.y)
	var left: float = _plate.position.x + _plate.size.x + 18.0
	_bar = Rect2(
		Vector2(left, area.position.y + 12.0),
		Vector2(maxf(40.0, info.position.x - 18.0 - left), 10.0)
	)
	queue_redraw()


func _draw() -> void:
	if share < 0.0 or not _bar.has_area():
		return
	draw_rect(_bar, Color(MauBinhBackdrop.INDIGO_DEEP, 0.8), true)
	var urgent: bool = share * total <= 10.0
	var fill := Rect2(_bar.position, Vector2(_bar.size.x * share, _bar.size.y))
	draw_rect(fill, MauBinhBackdrop.MADDER if urgent else MauBinhBackdrop.BRASS, true)
	draw_rect(_bar, Color(MauBinhBackdrop.BRASS, 0.6), false, 1.5)
