class_name HubRoomOptions
extends RefCounted
## A game's own room options, as its main scene describes them with `room_setup()`: a list of
##   { "key": "opponent", "label": "Chơi với", "options": [["Bạn bè", "human"], ["Máy", "bot"]] }
## The waiting room draws one row (HubRoomOption) per option; these read what is
## picked and find the choice that holds a value the room already has.


## The picked value of each option of `spec`, from its choice in `picked` (key → a control with
## `selected`).
static func values(spec: Array, picked: Dictionary) -> Dictionary:
	var out: Dictionary = {}
	for option: Variant in spec:
		if option is not Dictionary:
			continue
		var key: String = str(option.get("key", ""))
		var pairs: Array = option.get("options", [])
		var choice: Control = picked.get(key)
		if choice != null and int(choice.get("selected")) < pairs.size():
			out[key] = pairs[int(choice.get("selected"))][1]
	return out


## Which of an option's choices holds `value` (numbers from the server come back as floats);
## its "default" (else the first) when none does.
static func index_of(option: Dictionary, value: Variant) -> int:
	var pairs: Array = option.get("options", [])
	var number: bool = value is int or value is float
	for i: int in pairs.size():
		var own: Variant = pairs[i][1]
		if number and (own is int or own is float):
			if is_equal_approx(float(own), float(value)):
				return i
		elif typeof(own) == typeof(value) and own == value:
			return i
	return clampi(int(option.get("default", 0)), 0, maxi(0, pairs.size() - 1))
