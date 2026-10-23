extends PanelContainer
## A player's horses home, beside their slot: four little horses of their colour on a paper
## inset, in full colour for each horse home and as faint brown outlines for the others.
## `show_home(count)` pops the newly lit ones.
##
##   var tally := HomeTally.new()      # preload("res://content/co-ca-ngua/home_tally.gd")
##   tally.horse = frame               # the colour's horse picture
##   tally.show_home(2)

const SIDE := 34.0

var horse: Texture2D:
	set(value):
		horse = value
		for icon: TextureRect in _icons:
			icon.texture = value

var home: int = 0
var _icons: Array[TextureRect] = []


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.PAPER_DARK, 2, 22.0)
	)
	style.content_margin_left = 6.0
	style.content_margin_right = 6.0
	style.content_margin_top = 2.0
	style.content_margin_bottom = 2.0
	add_theme_stylebox_override("panel", style)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", -4)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(row)
	for i: int in 4:
		var icon := TextureRect.new()
		icon.name = "Lit_%d" % i
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.custom_minimum_size = Vector2.ONE * SIDE
		icon.pivot_offset = Vector2.ONE * SIDE / 2.0
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(icon)
		_icons.append(icon)
	_paint()


## Lights `count` horses; with `animate`, the ones lit since last time hop up.
func show_home(count: int, animate: bool = true) -> void:
	var before: int = home
	home = clampi(count, 0, 4)
	_paint()
	if not animate:
		return
	for i: int in range(before, home):
		var icon: TextureRect = _icons[i]
		icon.scale = Vector2.ONE * 1.6
		var tween: Tween = icon.create_tween()
		tween.tween_property(icon, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(
			Tween.EASE_OUT
		)


func _paint() -> void:
	for i: int in _icons.size():
		_icons[i].modulate = Color.WHITE if i < home else Color(0.42, 0.3, 0.2, 0.32)
