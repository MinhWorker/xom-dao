extends Control
## A small offline checkpoint using the real table, viewed as a spectator.

const Table := preload("res://content/co-ty-phu-classic/main.tscn")
const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const SCENES: Array[String] = [
	"Bàn trống", "Màu chủ sở hữu", "Đổi chủ", "Thế chấp", "Hai ô và đủ bộ", "Thu hồi"
]

var _scene: int = 1
var _table: Control
var _client: XomDaoClient
var _next: XomDaoButton


func _ready() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--review="):
			_scene = clampi(int(arg.trim_prefix("--review=")), 0, SCENES.size() - 1)
	_next = XomDaoButton.create(SCENES[1], XomDaoUi.Kind.SOCIAL)
	_next.name = "ReviewNext"
	_next.add_theme_font_size_override("font_size", 24)
	_next.pressed.connect(_advance)
	add_child(_next)
	resized.connect(_layout)
	_show()
	print("tycoon:visual-review-ready")
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--save="):
			_save.call_deferred(arg.trim_prefix("--save="))


func _save(path: String) -> void:
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var error: Error = get_viewport().get_texture().get_image().save_png(path)
	get_tree().quit(error)


func _advance() -> void:
	_scene = (_scene + 1) % SCENES.size()
	_show()


func _show() -> void:
	if is_instance_valid(_table):
		remove_child(_table)
		_table.queue_free()
	if is_instance_valid(_client):
		_client.queue_free()
	_client = XomDaoClient.new()
	_client.player_id = "review"
	add_child(_client)
	_client.snapshot = _snapshot()
	_table = Table.instantiate()
	add_child(_table)
	move_child(_table, 0)
	_table.call("bind", _client)
	_next.text = SCENES[(_scene + 1) % SCENES.size()]
	_layout.call_deferred()


func _layout() -> void:
	_next.reset_size()
	_next.position = Vector2(size.x - _next.size.x - 24.0, 24.0)


func _snapshot() -> XomDaoRoomSnapshot:
	var people: Array = []
	var players: Array = []
	var properties: Array = []
	var names: Array[String] = ["Minh", "Lan", "Nam", "An"]
	var positions: Array[int] = [1, 21, 31, 10]
	if _scene == 0:
		positions.assign([0, 0, 0, 0])
	for seat: int in 4:
		people.append({"id": "p%d" % seat, "name": names[seat]})
		(
			players
			. append(
				{
					"cash": 1000 + 250 * seat,
					"position": positions[seat],
					"jailed": seat == 3 and _scene > 0,
					"jailRolls": 0,
					"freeCards": [],
					"bankrupt": false,
				}
			)
		)
	for i: int in 40:
		var deed: Dictionary = {"owner": null, "houses": 0, "mortgaged": false}
		if _scene > 0 and Rules.is_deed(i):
			var seat: int = mini(floori(i / 10.0), 3)
			deed["owner"] = seat
			if Rules.SQUARES[i]["kind"] == "street":
				deed["houses"] = (
					{
						1: 1,
						2: 2,
						3: 3,
						6: 4,
						8: 5,
						11: 1,
						13: 2,
						16: 3,
						18: 5,
						21: 1,
						23: 2,
						24: 3,
						26: 4,
						27: 5,
						31: 1,
						32: 2,
						34: 3,
						37: 5
					}
					. get(i, 0)
				)
			if _scene == 3 and i in [3, 12, 16, 24, 31, 37]:
				deed["mortgaged"] = true
				deed["mortgage"] = {"borrower": seat, "deadline": 3, "principal": 200}
		properties.append(deed)
	if _scene == 2:
		for square: int in [1, 2, 3]:
			properties[square]["owner"] = 1
		properties[5]["owner"] = 2
		properties[12]["owner"] = 0
	elif _scene == 4:
		var owners: Dictionary = {
			1: 0,
			2: 0,
			3: 1,
			6: 1,
			8: 1,
			9: 1,
			11: 3,
			13: 3,
			14: 2,
			16: 2,
			18: 2,
			19: 2,
			21: 3,
			23: 3,
			24: 3,
			26: 0,
			27: 0,
			31: 1,
			32: 1,
			34: 1,
			36: 0,
			37: 0,
			39: 3,
		}
		for square: int in 40:
			properties[square]["owner"] = owners.get(square)
			if not owners.has(square):
				properties[square]["houses"] = 0
	elif _scene == 5:
		for square: int in [3, 12, 16, 24, 31, 37]:
			properties[square] = {"owner": null, "houses": 0, "mortgaged": false}
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "REVIEW",
				"gameId": "co-ty-phu-classic",
				"hostId": "p0",
				"players": people,
				"spectators": [],
				"seats": people,
				"status": "playing",
				"view":
				{
					"players": players,
					"properties": properties,
					"turn": 0,
					"playerTurns": [0, 0, 0, 0],
					"round": 0,
					"phase": "roll",
					"after": "end",
					"doubles": 0,
					"dice": [3, 4],
					"pending": null,
					"buildable": null,
					"auction": null,
					"stationAuctions": {},
					"shortages": [],
					"debt": null,
					"trade": null,
					"notice": SCENES[_scene],
					"lastCard": null,
					"winner": null,
					"lastAutoAction": null,
					"specialEvent": null,
					"moneySequence": 0,
					"transfers": [],
				},
				"result": null,
				"score": {"wins": [0, 0, 0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)
