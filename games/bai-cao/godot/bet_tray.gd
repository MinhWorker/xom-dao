class_name BaiCaoBetTray
extends Control
## The three bets as the chips themselves, big on the table in front of you: tap one (or press
## 1, 2, 3) and it slides to your betting spot. Each chip is a button (Bet_5, Bet_10, Bet_20)
## with its amount on a plate under it; one hovered lifts a little.

signal chosen(amount: int)

const BETS: Array[int] = [5, 10, 20]
## A chip's side, and the room under it for its plate.
const CHIP := 132.0
const PLATE := 40.0
const GAP := 36.0

var buttons: Array[BaseButton] = []


func _init() -> void:
	name = "BetTray"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for i: int in BETS.size():
		var amount: int = BETS[i]
		var button := TextureButton.new()
		button.name = "Bet_%d" % amount
		button.ignore_texture_size = true
		button.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
		button.texture_normal = load("res://content/bai-cao/art/chip-%d.webp" % amount)
		button.size = Vector2.ONE * CHIP
		button.pivot_offset = button.size / 2.0
		button.focus_mode = Control.FOCUS_NONE
		button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		button.tooltip_text = "Cược %d (phím %d)" % [amount, i + 1]
		button.pressed.connect(_choose.bind(amount))
		button.mouse_entered.connect(_lift.bind(button, true))
		button.mouse_exited.connect(_lift.bind(button, false))
		add_child(button)
		buttons.append(button)
		var plate := Label.new()
		plate.name = "Plate_%d" % amount
		plate.text = "Cược %d" % amount
		plate.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		plate.add_theme_font_override("font", XomDaoUi.display_font(800))
		plate.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN + 2)
		plate.add_theme_color_override("font_color", BaiCaoBackdrop.CREAM)
		plate.add_theme_color_override("font_outline_color", Color("#140B06", 0.85))
		plate.add_theme_constant_override("outline_size", 7)
		plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(plate)
	resized.connect(_place)


## The tray's size for its three chips.
static func span() -> Vector2:
	return Vector2(CHIP * 3.0 + GAP * 2.0, CHIP + PLATE)


## Where the chip of `amount` sits (its centre, in the tray's parent's coordinates).
func chip_center(amount: int) -> Vector2:
	var button: BaseButton = buttons[BETS.find(amount)]
	return position + button.position + button.size / 2.0


## The chips spring up one after the other (when betting opens).
func open() -> void:
	for i: int in buttons.size():
		var button: BaseButton = buttons[i]
		button.scale = Vector2.ONE * 0.4
		button.modulate.a = 0.0
		var tween: Tween = button.create_tween().set_parallel()
		tween.tween_property(button, "scale", Vector2.ONE, 0.3).set_delay(0.08 * i).set_trans(
			Tween.TRANS_BACK
		)
		tween.tween_property(button, "modulate:a", 1.0, 0.15).set_delay(0.08 * i)


func _place() -> void:
	for i: int in buttons.size():
		var button: BaseButton = buttons[i]
		button.position = Vector2(i * (CHIP + GAP), 0.0)
		var plate: Label = get_node("Plate_%d" % BETS[i])
		plate.size = Vector2(CHIP + GAP, PLATE)
		plate.position = Vector2(button.position.x - GAP / 2.0, CHIP)


func _choose(amount: int) -> void:
	chosen.emit(amount)


func _lift(button: BaseButton, up: bool) -> void:
	var tween: Tween = button.create_tween()
	tween.tween_property(button, "scale", Vector2.ONE * (1.07 if up else 1.0), 0.12)
