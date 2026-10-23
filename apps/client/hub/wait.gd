class_name HubWait
extends CanvasLayer
## The beat while the hub waits on the server: when a request a player is looking at (opening
## Chợ, Nhiệm vụ, Nhà…) takes longer than DELAY, a "Đang tải" badge with a spinner fades in at
## the bottom middle over a navy band that thins out upwards. It never blocks taps. Once shown it
## stays at least HOLD, so a reply just after DELAY does not flicker it.
##
##   var reply: Dictionary = await HubWait.ask(XomDaoProtocol.SHOP_LIST)       # Net.client
##   var reply: Dictionary = await HubWait.ask(XomDaoProtocol.QUESTS_GET, {}, client)
##
## Without a HubWait in the tree `ask` is a plain `client.request`. Background requests
## (refreshes, pushes) call the client directly and show nothing.
## Named nodes for tests: Wait (the badge), WaitLabel.

## Seconds a request may take before the badge shows.
const DELAY := 0.35
## Seconds the badge stays at least once it shows.
const HOLD := 0.45
const FADE := 0.15
const BAND := 150.0
const BADGE := Vector2(232.0, 60.0)
const SPINNER := 30.0

static var _on: HubWait

## Requests on their way that want the badge.
var waiting: int = 0

var _root := Control.new()
var _band := Control.new()
var _badge := Control.new()
var _label := Label.new()
var _spin: float = 0.0
var _since: float = 0.0
var _shown_at: float = -1.0
var _fade: Tween


## `client.request(event, data)` (Net.client when null), showing the badge if the reply is slow.
static func ask(event: String, data: Dictionary = {}, client: XomDaoClient = null) -> Dictionary:
	var on: HubWait = _on if is_instance_valid(_on) else null
	if on != null:
		on.hold()
	var reply: Dictionary = await (client if client != null else Net.client).request(event, data)
	if on != null and is_instance_valid(on):
		on.release()
	return reply


func _init() -> void:
	name = "WaitLayer"
	layer = 90
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.modulate.a = 0.0
	_root.visible = false
	add_child(_root)
	_band.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_band.draw.connect(_draw_band)
	_root.add_child(_band)
	_badge.name = "Wait"
	_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_badge.size = BADGE
	_badge.draw.connect(_draw_badge)
	_root.add_child(_badge)
	_label.name = "WaitLabel"
	_label.text = "Đang tải"
	_label.theme_type_variation = "HudLabel"
	_label.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_badge.add_child(_label)
	_root.resized.connect(_layout)


func _enter_tree() -> void:
	_on = self


func _exit_tree() -> void:
	if _on == self:
		_on = null


func _ready() -> void:
	_layout()


## One more request wants the badge; it shows after DELAY unless all are answered by then.
func hold() -> void:
	waiting += 1
	if waiting == 1 and _shown_at < 0.0:
		_since = 0.0


## A request was answered.
func release() -> void:
	waiting = maxi(0, waiting - 1)


## True while the badge is on screen (or fading in).
func showing() -> bool:
	return _shown_at >= 0.0


func _process(delta: float) -> void:
	if showing():
		_shown_at += delta
		_spin = fmod(_spin + delta * 5.0, TAU)
		_badge.queue_redraw()
		if waiting == 0 and _shown_at >= HOLD:
			_hide()
	elif waiting > 0:
		_since += delta
		if _since >= DELAY:
			_show()


func _show() -> void:
	_shown_at = 0.0
	_root.visible = true
	_layout()
	_fade_to(1.0)


func _hide() -> void:
	_shown_at = -1.0
	_fade_to(0.0)


func _fade_to(alpha: float) -> void:
	if _fade != null:
		_fade.kill()
	_fade = create_tween()
	_fade.tween_property(_root, "modulate:a", alpha, FADE)
	if alpha == 0.0:
		_fade.tween_callback(func() -> void: _root.visible = false)


func _layout() -> void:
	if not _root.is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(_root)
	var full: Vector2 = _root.size
	_band.position = Vector2(0.0, full.y - BAND)
	_band.size = Vector2(full.x, BAND)
	_label.reset_size()
	var text_w: float = _label.get_minimum_size().x
	_badge.size = Vector2(maxf(BADGE.x, 22.0 + SPINNER + 12.0 + text_w + 26.0), BADGE.y)
	_badge.position = Vector2((full.x - _badge.size.x) / 2.0, full.y - inset.y - 24.0 - BADGE.y)
	_label.position = Vector2(22.0 + SPINNER + 12.0, (BADGE.y - _label.size.y) / 2.0)
	_band.queue_redraw()


## Navy at the very bottom, clear at the top of the band.
func _draw_band() -> void:
	var w: float = _band.size.x
	var h: float = _band.size.y
	var clear := Color(XomDaoUi.NAVY, 0.0)
	var dark := Color(XomDaoUi.NAVY, 0.6)
	_band.draw_polygon(
		PackedVector2Array([Vector2(0, 0), Vector2(w, 0), Vector2(w, h), Vector2(0, h)]),
		PackedColorArray([clear, clear, dark, dark])
	)


## A pill whose fill is firm at the bottom and see-through at the top, a spinner on its left.
func _draw_badge() -> void:
	var w: float = _badge.size.x
	var h: float = _badge.size.y
	var r: float = h / 2.0
	var outline := PackedVector2Array()
	var colors := PackedColorArray()
	for i: int in 17:
		var a: float = PI / 2.0 + PI * i / 16.0
		outline.append(Vector2(r + cos(a) * r, r + sin(a) * r))
	for i: int in 17:
		var a: float = -PI / 2.0 + PI * i / 16.0
		outline.append(Vector2(w - r + cos(a) * r, r + sin(a) * r))
	for point: Vector2 in outline:
		var t: float = point.y / h
		colors.append(Color(XomDaoUi.NAVY, lerpf(0.3, 0.92, t)))
	_badge.draw_polygon(outline, colors)
	var edge := outline.duplicate()
	edge.append(outline[0])
	_badge.draw_polyline(edge, Color(XomDaoUi.CREAM, 0.18), 2.0, true)
	var c := Vector2(22.0 + SPINNER / 2.0, h / 2.0)
	var ring: float = SPINNER / 2.0 - 3.0
	_badge.draw_arc(c, ring, 0.0, TAU, 32, Color(XomDaoUi.CREAM, 0.25), 4.0, true)
	_badge.draw_arc(c, ring, _spin, _spin + TAU * 0.3, 12, XomDaoUi.SUN, 4.0, true)
