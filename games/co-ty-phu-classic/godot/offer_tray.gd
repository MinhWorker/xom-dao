extends PanelContainer
## A physical offer area accepts only items belonging to its own side.

signal dropped(square: int)
var seat: int = -1
var side: int = 0
var locked: bool = false


func _can_drop_data(_at: Vector2, data: Variant) -> bool:
	return (
		not locked
		and data is Dictionary
		and data.get("seat") == seat
		and data.get("side") == side
		and data.has("estate")
	)


func _drop_data(_at: Vector2, data: Variant) -> void:
	if _can_drop_data(_at, data):
		dropped.emit(int(data["estate"]))
