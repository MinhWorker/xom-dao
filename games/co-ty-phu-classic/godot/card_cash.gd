extends Control
## Signed change merges into the ink balance before the balance counts to its target.

const MERGE_SECONDS := 0.38
const COUNT_SECONDS := 0.48
var label := Label.new()
var change := Label.new()
var displayed: int = 0
var target: int = 0
var initialized: bool = false
var animating: bool = false
var impact: Callable
var _tween: Tween


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for item: Label in [label, change]:
		item.mouse_filter = Control.MOUSE_FILTER_IGNORE
		item.add_theme_font_override("font", XomDaoUi.display_font(800))
		item.add_theme_font_size_override("font_size", 26)
		item.add_theme_color_override("font_color", XomDaoUi.INK)
		add_child(item)
	label.name = "Balance"
	change.name = "BalanceChange"
	change.visible = false
	label.text = "0"


func sync(value: int) -> void:
	if animating:
		return
	initialized = true
	target = value
	_count(value)


func animate_to(value: int, delta: int) -> void:
	if _tween != null:
		_tween.kill()
	if not initialized:
		sync(value - delta)
	target = value
	animating = true
	change.text = XomDaoUi.delta(delta)
	change.add_theme_color_override(
		"font_color", XomDaoUi.UP_ON_PAPER if delta > 0 else XomDaoUi.DOWN_ON_PAPER
	)
	change.reset_size()
	change.position = Vector2(4, -56)
	change.pivot_offset = change.size / 2.0
	change.scale = Vector2.ONE
	change.modulate.a = 1.0
	change.visible = true
	_tween = create_tween()
	_tween.tween_interval(0.14)
	(
		_tween
		. tween_property(change, "position", Vector2(3, 0), MERGE_SECONDS)
		. set_trans(Tween.TRANS_CUBIC)
		. set_ease(Tween.EASE_IN)
	)
	_tween.parallel().tween_property(change, "scale", Vector2.ONE * 0.55, MERGE_SECONDS)
	_tween.parallel().tween_property(change, "modulate:a", 0.0, 0.12).set_delay(
		MERGE_SECONDS - 0.12
	)
	_tween.tween_callback(_merged.bind(delta))
	(
		_tween
		. tween_method(_count, float(displayed), float(value), COUNT_SECONDS)
		. set_trans(Tween.TRANS_QUAD)
		. set_ease(Tween.EASE_OUT)
	)
	_tween.tween_callback(_finish)


func _merged(delta: int) -> void:
	change.visible = false
	if impact.is_valid():
		impact.call(delta)


func _count(value: float) -> void:
	displayed = roundi(value)
	label.text = XomDaoUi.money(displayed)


func _finish() -> void:
	_count(target)
	animating = false
	label.scale = Vector2.ONE
