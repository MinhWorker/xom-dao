extends RefCounted
## Keyboard predicate for the roll shortcut; turn eligibility remains owned by the table.


static func should_roll(event: InputEvent, can_roll: bool) -> bool:
	if not can_roll or not (event is InputEventKey):
		return false
	var key: InputEventKey = event as InputEventKey
	return key.pressed and not key.echo and key.keycode == KEY_SPACE
