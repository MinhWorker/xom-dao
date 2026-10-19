extends RefCounted
## Draws the projected mortgage, redemption or building sale action on the tile HUD.

const TILE_ACTION_BUTTON := preload("res://content/co-ty-phu-classic/art/tile-hud-action.svg")
const BANK_ICON := preload("res://addons/xomdao_sdk/ui/icons/bank.svg")
const HOUSE_ICON := preload("res://content/co-ty-phu-classic/art/tile-hud-house.svg")
const BUTTON_FACE := Color("#1E5560")


static func draw(
	canvas: Control, button: XomDaoButton, details: Dictionary, bounds: Rect2, font: Font
) -> void:
	var uvs := PackedVector2Array([Vector2.ZERO, Vector2.RIGHT, Vector2.ONE, Vector2.DOWN])
	var event: String = str(details.get("tile_action_event", ""))
	var has_icon: bool = event in ["mortgage", "sell-house"]
	var icon: Texture2D = BANK_ICON if event == "mortgage" else HOUSE_ICON
	canvas.draw_polygon(
		canvas.call("_quad", bounds), PackedColorArray([tint(button)]), uvs, TILE_ACTION_BUTTON
	)
	var center: Vector2 = bounds.get_center()
	if has_icon:
		var icon_rect := Rect2(
			Vector2(bounds.position.x + 0.024, bounds.position.y + 0.015), Vector2(0.034, 0.034)
		)
		canvas.draw_polygon(
			canvas.call("_quad", icon_rect), PackedColorArray([XomDaoUi.CREAM]), uvs, icon
		)
		canvas.call(
			"_surface_text",
			button.text,
			center + Vector2(0.027, -0.003),
			0.028,
			bounds.size.x - 0.058,
			XomDaoUi.CREAM,
			HORIZONTAL_ALIGNMENT_CENTER,
			font
		)
	else:
		canvas.call(
			"_surface_text",
			button.text,
			center - Vector2(0.0, 0.003),
			0.028,
			bounds.size.x - 0.012,
			XomDaoUi.CREAM,
			HORIZONTAL_ALIGNMENT_CENTER,
			font
		)


static func tint(button: Button) -> Color:
	if button.disabled:
		return Color(0.65, 0.70, 0.72, 1.0)
	if button.is_pressed():
		return Color(0.78, 0.82, 0.81, 1.0)
	if button.is_hovered():
		return Color(1.08, 1.08, 1.08, 1.0)
	return Color.WHITE
