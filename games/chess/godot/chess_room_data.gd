extends RefCounted
## Room options and the result summary for the shared hub screens.

const CHESS_HUD = preload("res://content/chess/chess_hud.gd")


static func sandbox_options() -> Dictionary:
	return {"opponent": "bot"}


static func room_setup() -> Array:
	return [
		{"key": "opponent", "label": "Đối thủ", "options": [["Bạn bè", "human"], ["Máy", "bot"]]},
		{
			"key": "level",
			"label": "Máy chơi",
			"options": [["Dễ", "easy"], ["Vừa", "normal"], ["Khó", "hard"]],
			"default": 1,
		},
		{
			"key": "swap",
			"label": "Bạn cầm quân",
			"options": [["Trắng, đi trước", false], ["Đen", true]],
		},
	]


static func result_detail(view: Dictionary, taken_by: Callable, name_of: Callable) -> Dictionary:
	if view.is_empty() or view.get("end") == null:
		return {}
	var end: Dictionary = view["end"]
	var plies: int = int(view.get("plies", 0))
	return {
		"reason": CHESS_HUD.result_reason(end, name_of),
		"rows":
		[
			["Số nước", str(ceili(float(plies) / 2.0))],
			["Quân Trắng ăn", str(taken_by.call("w"))],
			["Quân Đen ăn", str(taken_by.call("b"))],
		],
		"layout": "right",
	}
