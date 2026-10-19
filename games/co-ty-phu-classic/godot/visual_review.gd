extends Control
## A small offline checkpoint using the real table, viewed as a spectator.

const Table := preload("res://content/co-ty-phu-classic/main.tscn")
const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const SCENES: Array[String] = [
	"Bàn trống",
	"Màu chủ sở hữu",
	"Đổi chủ",
	"Thế chấp",
	"Hai ô và đủ bộ",
	"Thu hồi",
	"Giá mua bến xe",
	"Rút Khí vận",
	"Rút Cơ hội",
	"Thuế",
	"Mua đất",
	"Xây nhà"
]

var _scene: int = 1
var _table: Control
var _client: XomDaoClient
var _next: XomDaoButton
var _toss: XomDaoButton
var _money: XomDaoButton
var _money_round: int = 0


func _ready() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--review="):
			_scene = clampi(int(arg.trim_prefix("--review=")), 0, SCENES.size() - 1)
	_next = XomDaoButton.create(SCENES[1], XomDaoUi.Kind.SOCIAL)
	_next.name = "ReviewNext"
	_next.add_theme_font_size_override("font_size", 24)
	_next.pressed.connect(_advance)
	add_child(_next)
	_toss = XomDaoButton.create("Tung thử", XomDaoUi.Kind.GO)
	_toss.name = "ReviewToss"
	_toss.pressed.connect(_preview_throw)
	add_child(_toss)
	_money = XomDaoButton.create("Thử tiền", XomDaoUi.Kind.SOCIAL)
	_money.name = "ReviewMoney"
	_money.pressed.connect(_preview_cash)
	add_child(_money)
	resized.connect(_layout)
	_show()
	print("tycoon:visual-review-ready")
	if "--toss" in OS.get_cmdline_user_args():
		_preview_throw.call_deferred()
	if "--cash-demo" in OS.get_cmdline_user_args():
		for button: XomDaoButton in [_next, _toss, _money]:
			button.hide()
		_cash_demo.call_deferred()
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--save="):
			_save.call_deferred(arg.trim_prefix("--save="))


func _save(path: String) -> void:
	if "--open-ledger" in OS.get_cmdline_user_args():
		_next.hide()
		_toss.hide()
		_money.hide()
		await get_tree().process_frame
		_table.get("_ledger").call("open")
		if "--trade-page" in OS.get_cmdline_user_args():
			_table.get("_ledger").set("page", 1)
			_table.get("_ledger").call("_render")
		for arg: String in OS.get_cmdline_user_args():
			if arg.begins_with("--select-estate="):
				var sq: int = int(arg.trim_prefix("--select-estate="))
				_table.get("_ledger").get("_estate").call("select", sq)
			elif arg.begins_with("--view-player="):
				var p: int = int(arg.trim_prefix("--view-player="))
				_table.get("_ledger").call("_choose_player", p)
		await get_tree().process_frame
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var error: Error = get_viewport().get_texture().get_image().save_png(path)
	get_tree().quit(error)


func _cash_demo() -> void:
	await get_tree().create_timer(0.6).timeout
	await _preview_cash()
	await get_tree().create_timer(0.7).timeout
	await _preview_cash()
	if "--bank-demo" in OS.get_cmdline_user_args():
		await get_tree().create_timer(0.7).timeout
		await _preview_cash()
		await get_tree().create_timer(0.7).timeout
		await _preview_cash()


func _preview_cash() -> void:
	_next.disabled = true
	_toss.disabled = true
	_money.disabled = true
	for button: XomDaoButton in [_next, _toss, _money]:
		button.hide()
	var view: Dictionary = _table.get("_view")
	var routes: Array = [[1, 0], [0, 1], [null, 0], [0, null]]
	var route: Array = routes[_money_round % routes.size()]
	_money_round += 1
	if route[0] != null:
		view["players"][int(route[0])]["cash"] -= 200
	if route[1] != null:
		view["players"][int(route[1])]["cash"] += 200
	await _table.call("_money", [{"from": route[0], "to": route[1], "amount": 200}])
	_table.call("_refresh")
	_next.disabled = false
	_toss.disabled = false
	_money.disabled = false
	if "--cash-demo" not in OS.get_cmdline_user_args():
		for button: XomDaoButton in [_next, _toss, _money]:
			button.show()


func _preview_throw() -> void:
	_next.disabled = true
	_toss.disabled = true
	_money.disabled = true
	var values: Array[int] = [randi_range(1, 6), randi_range(1, 6)]
	await _table.call("_roll", values, 0)
	var view: Dictionary = _table.get("_view")
	var from: int = int(view["players"][0]["position"])
	view["players"][0]["position"] = (from + values[0] + values[1]) % 40
	await _table.call("_walk", 0, from, values[0] + values[1])
	_table.call("_refresh")
	_next.disabled = false
	_toss.disabled = false
	_money.disabled = false


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
	_client.player_id = "p0"
	add_child(_client)
	_client.snapshot = _snapshot()
	_table = Table.instantiate()
	add_child(_table)
	move_child(_table, 0)
	_table.call("bind", _client)
	if _scene in [7, 8] and "--save=" not in " ".join(OS.get_cmdline_user_args()):
		_preview_reveal.call_deferred()
	_next.text = SCENES[(_scene + 1) % SCENES.size()]
	_layout.call_deferred()


func _preview_reveal() -> void:
	_table.set("_running", true)
	_table.call("_refresh")
	var view: Dictionary = _table.get("_view")
	await _table.call("_draw_event", view["specialEvent"])
	_table.set("_running", false)
	_table.call("_refresh")


func _layout() -> void:
	_next.reset_size()
	_next.position = Vector2(size.x - _next.size.x - 24.0, 8.0)
	_toss.reset_size()
	_toss.position = Vector2(size.x - _toss.size.x - 24.0, _next.position.y + _next.size.y + 4.0)
	_money.reset_size()
	_money.position = Vector2(size.x - _money.size.x - 24.0, _toss.position.y + _toss.size.y + 4.0)


func _snapshot() -> XomDaoRoomSnapshot:
	var people: Array = []
	var players: Array = []
	var properties: Array = []
	var names: Array[String] = ["Minh", "Lan", "Nam", "An"]
	var positions: Array[int] = [1, 21, 31, 10]
	if _scene == 0:
		positions.assign([0, 0, 0, 0])
	for seat: int in 4:
		people.append(
			{"id": "p%d" % seat, "name": names[seat], "avatar": ["boy", "girl", "cat", "dog"][seat]}
		)
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
	if _scene == 6:
		for square: int in Rules.STATIONS:
			properties[square]["owner"] = null
	var result: XomDaoRoomSnapshot = (
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

	var view: Dictionary = result.view
	if _scene in [7, 8, 9]:
		var card: Dictionary = {"kind": "cash", "amount": 100, "text": "Nhận cổ tức 100."}
		view["phase"] = "event"
		view["specialEvent"] = {
			"kind": "card",
			"card": card,
			"deck": "chest" if _scene == 7 else "chance",
			"roll": 7,
			"id": 40,
			"ready": true
		}
		view["notice"] = card["text"]
		if _scene == 9:
			view["specialEvent"] = {
				"kind": "tax", "reason": "Thuế thu nhập", "amount": 200, "id": 41, "ready": true
			}
			view["notice"] = "Thuế thu nhập: cần nộp 200 ₫."
	elif _scene == 10:
		view["phase"] = "buy"
		view["pending"] = 6
		view["notice"] = "Mua Hải Phòng với giá 320 ₫."
	elif _scene == 11:
		view["phase"] = "end"
		view["buildable"] = 1
	return result
