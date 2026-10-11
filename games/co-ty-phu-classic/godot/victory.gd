extends Control
## Cờ tỷ phú's win, after the old board's VictoryEffect: the table darkens, the winner's pawn
## grows and hops, fireworks burst and the winner's total assets count up. Then it fades so the
## final board can be seen. Named Victory, with VictoryTitle and VictoryAssets.

const SHADE := Color("#102034", 0.84)
const SPARKS: Array[Color] = [
	Color("#FFD36B"), Color("#FF8177"), Color("#82C9FF"), Color("#A5EDAA")
]
const SECONDS := 6.2
const COUNT_SECONDS := 2.6

var _pawn := TextureRect.new()
var _title := Label.new()
var _assets := Label.new()
## Seconds since the fireworks began; below 0 when none are shown.
var _clock: float = -1.0
var _total: int = 0


func _init() -> void:
	name = "Victory"
	visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_pawn.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_pawn.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_pawn.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_pawn)
	_title.name = "VictoryTitle"
	_assets.name = "VictoryAssets"
	for label: Label in [_title, _assets]:
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		label.add_theme_font_override("font", XomDaoUi.display_font(800))
		label.add_theme_color_override("font_outline_color", XomDaoUi.INK)
		label.add_theme_constant_override("outline_size", 8)
		add_child(label)
	_title.add_theme_font_size_override("font_size", XomDaoUi.TITLE)
	_title.add_theme_color_override("font_color", Color("#FFE4A0"))
	_assets.add_theme_font_size_override("font_size", XomDaoUi.TEXT + 8)
	_assets.add_theme_color_override("font_color", Color.WHITE)


## "Tổng tài sản\n2.450 ₫".
static func assets_text(amount: int) -> String:
	return "Tổng tài sản\n%s ₫" % XomDaoUi.money(maxi(amount, 0))


## Celebrates `title` ("Bạn chiến thắng!") with the winner's `pawn` and `total` assets.
func play(pawn: Texture2D, title: String, total: int) -> void:
	_pawn.texture = pawn
	_title.text = title
	_total = maxi(total, 0)
	_assets.text = assets_text(0)
	modulate.a = 1.0
	visible = true
	_layout_texts()
	var tall: float = size.y * 0.42
	var middle := Vector2(size.x / 2.0, size.y * 0.52)
	_pawn.pivot_offset = Vector2(tall * 0.36, tall * 0.85)
	_pawn.size = Vector2(tall * 0.72, tall)
	_pawn.position = middle - _pawn.pivot_offset
	_pawn.scale = Vector2.ONE * 0.23
	var grow: Tween = create_tween()
	grow.tween_property(_pawn, "scale", Vector2.ONE, 0.6).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)
	for k: int in 8:
		grow.tween_property(_pawn, "position:y", _pawn.position.y - tall * 0.28, 0.28).set_trans(
			Tween.TRANS_SINE
		)
		grow.parallel().tween_property(_pawn, "rotation", deg_to_rad(-8.0), 0.28)
		grow.tween_property(_pawn, "position:y", _pawn.position.y, 0.28).set_trans(Tween.TRANS_SINE)
		grow.parallel().tween_property(_pawn, "rotation", 0.0, 0.28)
	var count: Tween = create_tween()
	(
		count
		. tween_method(_count, 0.0, float(_total), COUNT_SECONDS)
		. set_trans(Tween.TRANS_CUBIC)
		. set_ease(Tween.EASE_OUT)
	)
	_clock = 0.0
	var fireworks: Tween = create_tween()
	fireworks.tween_property(self, "_clock", SECONDS, SECONDS)
	await fireworks.finished
	_clock = -1.0
	_assets.text = assets_text(_total)
	var fade: Tween = create_tween()
	fade.tween_property(self, "modulate:a", 0.0, 0.6).set_delay(1.2)
	await fade.finished
	visible = false


func _count(value: float) -> void:
	_assets.text = assets_text(roundi(value))


func _layout_texts() -> void:
	_title.position = Vector2(40.0, size.y * 0.17 - 32.0)
	_title.size = Vector2(size.x - 80.0, 64.0)
	_assets.position = Vector2(40.0, size.y * 0.74 - 40.0)
	_assets.size = Vector2(size.x - 80.0, 100.0)


func _process(_delta: float) -> void:
	if visible:
		queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), SHADE)
	if _clock < 0.0:
		return
	var elapsed: float = _clock * 1000.0
	for burst: int in 8:
		var age: float = elapsed - burst * 480.0
		if age < 0.0:
			continue
		age = fmod(age, 2100.0)
		if age > 1500.0:
			continue
		var x: float = size.x * (0.15 + ((burst * 37) % 70) / 100.0)
		var y: float = size.y * (0.18 + ((burst * 17) % 35) / 100.0)
		if age < 300.0:
			var rocket: float = size.y - (size.y - y) * age / 300.0
			draw_line(Vector2(x, rocket), Vector2(x, rocket + 24.0), Color("#FFEFBD"), 2.0)
			continue
		var t: float = (age - 300.0) / 1200.0
		var ink: Color = Color(SPARKS[burst % 4], 1.0 - t)
		for ray: int in 24:
			var angle: float = ray * PI / 12.0
			var along := Vector2(cos(angle), sin(angle))
			var tip: Vector2 = Vector2(x, y) + along * 115.0 * t + Vector2(0.0, 50.0 * t * t)
			draw_line(tip, tip - along * 10.0, ink, 2.0)
