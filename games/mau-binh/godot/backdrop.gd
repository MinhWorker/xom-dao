class_name MauBinhBackdrop
extends Control
## Behind the table: a hand-dyed indigo cloth (vải chàm) with its pale batik border, spread on a
## low honey wood table, the edges in a soft shade. Calm and even: a game of thinking.
## `skin()` is the table's HUD in the same materials: indigo plates with brass edges, madder red
## for Xong.

const INDIGO := Color("#1D2B4A")
const INDIGO_LIGHT := Color("#3A5688")
const INDIGO_DEEP := Color("#121B30")
const BRASS := Color("#C9A45A")
const MADDER := Color("#A63A2B")
const PALE := Color("#CFE0F2")
const CREAM := Color("#F4EAD6")

var _cloth := TextureRect.new()
var _shade := TextureRect.new()


func _init() -> void:
	name = "Backdrop"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var under := ColorRect.new()
	under.color = Color("#2A1A0E")
	under.set_anchors_preset(Control.PRESET_FULL_RECT)
	under.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(under)
	_cloth.texture = preload("res://content/mau-binh/art/indigo.webp")
	_cloth.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_cloth.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_cloth.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cloth.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_cloth)
	_shade.name = "Shade"
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.6, 1.0])
	gradient.colors = PackedColorArray(
		[Color(INDIGO_DEEP, 0.0), Color(INDIGO_DEEP, 0.12), Color(INDIGO_DEEP, 0.5)]
	)
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.05, 0.5)
	texture.width = 256
	texture.height = 256
	_shade.texture = texture
	_shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_shade.stretch_mode = TextureRect.STRETCH_SCALE
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_shade)


## The table's HUD materials.
static func skin() -> XomDaoTableSkin:
	var look := XomDaoTableSkin.new()
	look.plate = Color(INDIGO_DEEP, 0.94)
	look.edge = BRASS
	look.ink = CREAM
	look.radius = 10.0
	look.chip = INDIGO_LIGHT
	look.chip_edge = Color(PALE, 0.6)
	look.chip_ink = CREAM
	look.timer = BRASS
	look.timer_track = Color(INDIGO_DEEP, 0.6)
	look.primary = [MADDER, BRASS, CREAM]
	look.secondary = [INDIGO_LIGHT, INDIGO_DEEP, CREAM]
	look.danger = [Color("#2A3550"), INDIGO_DEEP, Color(CREAM, 0.9)]
	look.round_button = [INDIGO_DEEP, BRASS, CREAM]
	return look


## The round's indigo plate at the top of the table, holding `label`.
static func plate(look: XomDaoTableSkin, label: Label) -> PanelContainer:
	var plate_style: StyleBoxFlat = XomDaoUi.with_shadow(look.plate_box(2))
	plate_style.content_margin_left = 20.0
	plate_style.content_margin_right = 20.0
	plate_style.content_margin_top = 2.0
	plate_style.content_margin_bottom = 4.0
	var panel := PanelContainer.new()
	panel.name = "RoundPlate"
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override("panel", plate_style)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	label.add_theme_color_override("font_color", CREAM)
	panel.add_child(label)
	return panel


## Words straight on the cloth: cream with a soft indigo outline.
static func hud(label: Label, font_size: int) -> void:
	label.theme_type_variation = "HudLabel"
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	label.add_theme_color_override("font_outline_color", Color(INDIGO_DEEP, 0.9))
	label.add_theme_constant_override("outline_size", 7)


## A big word over the table at `at` for a moment: it springs in, holds, then fades.
static func announce(word: Label, text: String, at: Vector2) -> void:
	word.text = text
	word.visible = true
	word.reset_size()
	word.position = at - word.size / 2.0
	word.pivot_offset = word.size / 2.0
	word.scale = Vector2.ONE * 0.6
	word.modulate.a = 1.0
	var tween: Tween = word.create_tween()
	tween.tween_property(word, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_BACK)
	tween.tween_interval(0.8)
	tween.tween_property(word, "modulate:a", 0.0, 0.25)
	tween.tween_callback(func() -> void: word.visible = false)


## Turns a card to its face (card number 0–51), with a flip when `animate`.
static func turn_over(card: XomDaoCard, value: int, animate: bool) -> void:
	var rank: String = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"][value / 4]
	if card.rank == rank and card.suit == value % 4:
		return
	if not animate:
		card.show_face(rank, value % 4)
		return
	var tween: Tween = card.create_tween()
	tween.tween_property(card, "scale:x", 0.0, 0.13)
	tween.tween_callback(card.show_face.bind(rank, value % 4))
	tween.tween_property(card, "scale:x", 1.0, 0.13)


## A chi not being compared steps back into the cloth.
static func dim(card: XomDaoCard, away: bool) -> void:
	card.dim = away
	if away:
		card.self_modulate = Color(0.58, 0.6, 0.7)
