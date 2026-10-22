extends Node
## The xd control channel (tools/xd): a desktop debug build started with `-- --xd-port=<port>
## --xd-key=<key>` listens on 127.0.0.1 for one JSON request per line,
## `{ "key", "id", "cmd", "args" }`, and answers each with `{ "id", "ok", "result" | "error" }`.
## TestBridge adds it; release and web builds never have it. The commands are the _cmd_*
## methods below; tools/xd/README.md describes them for people.
##
## A node is a selector as TestBridge.find() takes it: "Play", "Board/Cell_1_2",
## "Seat_0/type:Label[1]", "text:Đầu hàng". Points and boxes are window pixels, the same
## pixels a `shot` has.

const WAIT_MS := 10_000

var _server := TCPServer.new()
var _key: String = ""
var _peers: Array[StreamPeerTCP] = []
var _buffers: Dictionary = {}


## Listens on 127.0.0.1:`port`; requests must carry `key`.
func start(port: int, key: String) -> bool:
	_key = key
	var error: Error = _server.listen(port, "127.0.0.1")
	if error != OK:
		push_error("xd: cannot listen on port %d (error %d)" % [port, error])
		return false
	print("xd:listening %d" % port)
	return true


func _process(_delta: float) -> void:
	while _server.is_connection_available():
		var peer: StreamPeerTCP = _server.take_connection()
		_peers.append(peer)
		_buffers[peer] = ""
	for peer: StreamPeerTCP in _peers.duplicate():
		peer.poll()
		if peer.get_status() != StreamPeerTCP.STATUS_CONNECTED:
			_peers.erase(peer)
			_buffers.erase(peer)
			continue
		var available: int = peer.get_available_bytes()
		if available <= 0:
			continue
		var chunk: Array = peer.get_data(available)
		if chunk[0] != OK:
			continue
		var text: String = (
			str(_buffers[peer]) + (chunk[1] as PackedByteArray).get_string_from_utf8()
		)
		var lines: PackedStringArray = text.split("\n")
		_buffers[peer] = lines[lines.size() - 1]
		for i: int in lines.size() - 1:
			if lines[i].strip_edges() != "":
				_handle(peer, lines[i])


func _handle(peer: StreamPeerTCP, line: String) -> void:
	var request: Variant = JSON.parse_string(line)
	if request is not Dictionary:
		_reply(peer, {"id": null, "ok": false, "error": "Not a JSON object"})
		return
	var id: Variant = request.get("id")
	if str(request.get("key", "")) != _key:
		_reply(peer, {"id": id, "ok": false, "error": "Wrong key"})
		return
	var command: String = str(request.get("cmd", ""))
	var method: String = "_cmd_" + command
	if command == "" or not has_method(method):
		_reply(peer, {"id": id, "ok": false, "error": "Unknown command: %s" % command})
		return
	var args: Variant = request.get("args", {})
	var answer: Variant = await call(method, args if args is Dictionary else {})
	if answer is not Dictionary:
		answer = _fail("%s hit a script error; see xd logs" % command)
	answer["id"] = id
	_reply(peer, answer)
	if command == "quit":
		await get_tree().process_frame
		get_tree().quit()


func _reply(peer: StreamPeerTCP, answer: Dictionary) -> void:
	if peer.get_status() == StreamPeerTCP.STATUS_CONNECTED:
		peer.put_data((JSON.stringify(_plain(answer)) + "\n").to_utf8_buffer())


static func _ok(result: Variant = true) -> Dictionary:
	return {"ok": true, "result": result}


static func _truthy(value: Variant) -> bool:
	return true if value else false


static func _fail(message: String) -> Dictionary:
	return {"ok": false, "error": message}


# ── Looking ───────────────────────────────────────────────────────────────────────────────


func _cmd_ping(_args: Dictionary) -> Dictionary:
	var client: XomDaoClient = Net.client
	var window: Window = get_window()
	return _ok(
		{
			"scene": TestBridge.scene,
			"pid": OS.get_process_id(),
			"user": client.user.username if client.user != null else null,
			"room": client.room_code,
			"window": [window.size.x, window.size.y],
			"frame": [window.content_scale_size.x, window.content_scale_size.y],
		}
	)


func _cmd_scene(_args: Dictionary) -> Dictionary:
	return _ok(TestBridge.scene)


## { node?, depth = 99, rects = false }
func _cmd_tree(args: Dictionary) -> Dictionary:
	var from: Node = get_tree().root
	if str(args.get("node", "")) != "":
		from = TestBridge.find(str(args["node"]))
		if from == null:
			return _fail("No visible node %s" % args["node"])
	return _ok(TestBridge.node_tree(from, int(args.get("depth", 99)), args.get("rects") == true))


## { node }: its path, type, text, box, and whether it is disabled; null when not visible.
func _cmd_find(args: Dictionary) -> Dictionary:
	var node: Node = TestBridge.find(str(args.get("node", "")))
	return _ok(_describe(node) if node != null else null)


func _cmd_text(args: Dictionary) -> Dictionary:
	var node: Node = TestBridge.find(str(args.get("node", "")))
	if node == null:
		return _fail("No visible node %s" % args.get("node", ""))
	return _ok(node.get("text") if "text" in node else null)


func _cmd_state(_args: Dictionary) -> Dictionary:
	return _ok(TestBridge.app_state())


## { path, node? | rect? [x, y, w, h], pad = 0, scale = 1 }: saves the window, one node's
## box or an area as a PNG.
func _cmd_shot(args: Dictionary) -> Dictionary:
	var path: String = str(args.get("path", ""))
	if path == "":
		return _fail("shot needs a path")
	await RenderingServer.frame_post_draw
	var image: Image = get_viewport().get_texture().get_image()
	var box: Variant = args.get("rect")
	if str(args.get("node", "")) != "":
		box = TestBridge.node_rect(TestBridge.find(str(args["node"])) as Control)
		if box == null:
			return _fail("No visible control %s" % args["node"])
	if box != null:
		if box is not Array or (box as Array).size() != 4:
			return _fail("rect is [x, y, width, height]")
		var pad: float = float(args.get("pad", 0))
		var area := Rect2(box[0] - pad, box[1] - pad, box[2] + pad * 2, box[3] + pad * 2)
		area = area.intersection(Rect2(Vector2.ZERO, Vector2(image.get_size())))
		if area.size.x < 1 or area.size.y < 1:
			return _fail("That area is off screen")
		image = image.get_region(Rect2i(area))
	var scale: float = float(args.get("scale", 1.0))
	if scale > 0.0 and not is_equal_approx(scale, 1.0):
		var size := Vector2i((Vector2(image.get_size()) * scale).round()).max(Vector2i.ONE)
		image.resize(size.x, size.y, Image.INTERPOLATE_LANCZOS)
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var error: Error = image.save_png(path)
	if error != OK:
		return _fail("save_png returned error %d for %s" % [error, path])
	return _ok({"path": path, "width": image.get_width(), "height": image.get_height()})


# ── Acting ────────────────────────────────────────────────────────────────────────────────


## { node }: emits the button's pressed, as a script would (no mouse involved).
func _cmd_click(args: Dictionary) -> Dictionary:
	var button: BaseButton = TestBridge.find(str(args.get("node", ""))) as BaseButton
	if button == null:
		return _fail("No visible button %s" % args.get("node", ""))
	if button.disabled:
		return _fail("%s is disabled" % args["node"])
	button.pressed.emit()
	await _settle()
	return _ok()


## { node } or { x, y }: a real left click (motion, press, release) at the node's centre.
func _cmd_tap(args: Dictionary) -> Dictionary:
	var at: Variant = _point(args)
	if at is String:
		return _fail(at)
	await _mouse_move(at, at)
	await _mouse_button(at, true)
	await _mouse_button(at, false)
	await _settle()
	return _ok({"x": (at as Vector2).x, "y": (at as Vector2).y})


## { from: node | [x, y], to: node | [x, y], ms = 300 }: press, drag, release.
func _cmd_swipe(args: Dictionary) -> Dictionary:
	var from: Variant = _point_of(args.get("from"))
	var to: Variant = _point_of(args.get("to"))
	if from is String:
		return _fail(from)
	if to is String:
		return _fail(to)
	var steps: int = maxi(6, int(float(args.get("ms", 300)) / 16.0))
	await _mouse_move(from, from)
	await _mouse_button(from, true)
	var last: Vector2 = from
	for i: int in range(1, steps + 1):
		var point: Vector2 = (from as Vector2).lerp(to, float(i) / steps)
		await _mouse_move(point, last, true)
		last = point
	await _mouse_button(to, false)
	await _frames(2)
	return _ok()


## { node, text, submit = false }: puts the text in a LineEdit or TextEdit.
func _cmd_type(args: Dictionary) -> Dictionary:
	var node: Node = TestBridge.find(str(args.get("node", "")))
	var text: String = str(args.get("text", ""))
	if node is LineEdit:
		var edit := node as LineEdit
		edit.grab_focus()
		edit.text = text
		edit.caret_column = text.length()
		edit.text_changed.emit(text)
		if args.get("submit") == true:
			edit.text_submitted.emit(text)
	elif node is TextEdit:
		var area := node as TextEdit
		area.grab_focus()
		area.text = text
		area.text_changed.emit()
	else:
		return _fail("No visible LineEdit or TextEdit %s" % args.get("node", ""))
	await _frames(2)
	return _ok()


## { key }: presses and releases a key by name ("Escape", "Enter", "Left", "A").
func _cmd_key(args: Dictionary) -> Dictionary:
	var code: Key = OS.find_keycode_from_string(str(args.get("key", "")))
	if code == KEY_NONE:
		return _fail("Unknown key %s" % args.get("key", ""))
	for pressed: bool in [true, false]:
		var event := InputEventKey.new()
		event.keycode = code
		event.physical_keycode = code
		event.pressed = pressed
		Input.parse_input_event(event)
		await _frames(1)
	await _frames(1)
	return _ok()


## { event, data = {} }: a request to the server; its whole reply.
func _cmd_request(args: Dictionary) -> Dictionary:
	var data: Variant = args.get("data", {})
	var reply: Dictionary = await Net.client.request(
		str(args.get("event", "")), data if data is Dictionary else {}
	)
	if reply.get("balances") is Dictionary:
		Net.client.balances = reply["balances"]
		if is_instance_valid(TestBridge.hub):
			TestBridge.hub.set("_coins", int(Net.client.balances.get("core:coin", 0)))
	return _ok(reply)


## { event, payload = {} }: one of the game's moves, through the real rules.
func _cmd_send(args: Dictionary) -> Dictionary:
	var payload: Variant = args.get("payload", {})
	var sent: bool = await Net.client.send(
		str(args.get("event", "")), payload if payload is Dictionary else {}
	)
	return _ok() if sent else _fail(Net.client.last_error)


## { place, arg = "" }: lobby, select [genre], ben [game], nha, cho, dinh, play <game>,
## rules [game].
func _cmd_go(args: Dictionary) -> Dictionary:
	if not is_instance_valid(TestBridge.hub):
		return _fail("The hub is not up")
	var nav: GDScript = load("res://hub/xd_nav.gd")
	var error: String = await nav.call(
		"go", TestBridge.hub, str(args.get("place", "")), str(args.get("arg", ""))
	)
	if error != "":
		return _fail(error)
	await _settle()
	return _ok(TestBridge.scene)


## { action, game?, code?, role?, options?, ready? }: create, quick, join, ready, start,
## options, leave, sit.
func _cmd_room(args: Dictionary) -> Dictionary:
	var client: XomDaoClient = Net.client
	var done: bool = false
	match str(args.get("action", "")):
		"create":
			done = await client.create_room(str(args.get("game", "")), args.get("options"))
		"quick":
			done = await client.quick_match(str(args.get("game", "")))
		"join":
			done = await client.join_room(
				str(args.get("code", "")).to_upper(), str(args.get("role", "player"))
			)
		"leave":
			done = await client.leave_room()
		"start":
			done = await client.start_game()
		"ready", "options", "sit":
			var event: String = "room:%s" % args["action"]
			var data: Dictionary = {}
			if args["action"] == "ready":
				data = {"ready": args.get("ready", true) != false}
			elif args["action"] == "options":
				data = {"options": args.get("options", {})}
			var reply: Dictionary = await client.request(event, data)
			done = reply.get("ok") == true
			if not done:
				client.last_error = str(reply.get("error", "refused"))
		_:
			return _fail("room needs create, quick, join, ready, start, options, leave or sit")
	if not done:
		return _fail(client.last_error if client.last_error != "" else "refused")
	await _settle()
	return _ok({"code": client.room_code, "scene": TestBridge.scene})


## { token }: starts again as the account of this login token.
func _cmd_login(args: Dictionary) -> Dictionary:
	if not is_instance_valid(TestBridge.hub):
		return _fail("The hub is not up")
	TestBridge.scene = "boot"
	Session.save_token(str(args.get("token", "")))
	await Net.client.reset()
	get_tree().reload_current_scene()
	return await _cmd_wait({"expr": "bridge.scene != 'boot' and bridge.scene != 'status'"})


## { width, height }: resizes the window; the hub picks the frame that fits it.
func _cmd_size(args: Dictionary) -> Dictionary:
	var size := Vector2i(int(args.get("width", 1280)), int(args.get("height", 720)))
	if size.x < 160 or size.y < 90:
		return _fail("Size must be at least 160x90")
	get_window().size = size
	await _frames(4)
	return await _cmd_ping({})


# ── Waiting and scripting ─────────────────────────────────────────────────────────────────


## Waits until every condition given holds: { scene, node (visible), gone (not visible),
## text: [node, part of its text], expr (GDScript, as in eval), timeout = 10000 ms }.
func _cmd_wait(args: Dictionary) -> Dictionary:
	var started: int = Time.get_ticks_msec()
	var timeout: int = int(args.get("timeout", WAIT_MS))
	var expression: Expression = null
	if str(args.get("expr", "")) != "":
		expression = Expression.new()
		if expression.parse(str(args["expr"]), _names()) != OK:
			return _fail(expression.get_error_text())
	while true:
		if _holds(args, expression):
			return _ok({"ms": Time.get_ticks_msec() - started, "scene": TestBridge.scene})
		if Time.get_ticks_msec() - started > timeout:
			return _fail("Timed out after %d ms on scene %s" % [timeout, TestBridge.scene])
		await get_tree().process_frame
	return _fail("unreachable")


## { expr }: one GDScript expression. Names: hub, client (Net.client), root, bridge
## (TestBridge); the base object is this server, so find("Play") and node("Play") work.
func _cmd_eval(args: Dictionary) -> Dictionary:
	var expression := Expression.new()
	if expression.parse(str(args.get("expr", "")), _names()) != OK:
		return _fail(expression.get_error_text())
	var result: Variant = expression.execute(_values(), self)
	if expression.has_execute_failed():
		return _fail(expression.get_error_text())
	return _ok(_plain(result))


func _cmd_quit(_args: Dictionary) -> Dictionary:
	return _ok()


## For eval and wait: the first visible node with this name (as TestBridge.find).
func find(node_name: String) -> Node:
	return TestBridge.find(node_name)


## For eval: like find, but described as find does in the reply.
func node(node_name: String) -> Variant:
	var found: Node = TestBridge.find(node_name)
	return _describe(found) if found != null else null


func _names() -> PackedStringArray:
	return PackedStringArray(["hub", "client", "root", "bridge"])


func _values() -> Array:
	var hub: Node = TestBridge.hub if is_instance_valid(TestBridge.hub) else null
	return [hub, Net.client, get_tree().root, TestBridge]


func _holds(args: Dictionary, expression: Expression) -> bool:
	var holds: bool = not args.has("scene") or TestBridge.scene == str(args["scene"])
	holds = holds and (not args.has("node") or TestBridge.find(str(args["node"])) != null)
	holds = holds and (not args.has("gone") or TestBridge.find(str(args["gone"])) == null)
	if holds and args.get("text") is Array and (args["text"] as Array).size() == 2:
		var found: Node = TestBridge.find(str(args["text"][0]))
		holds = found != null and "text" in found
		holds = holds and str(found.get("text")).contains(str(args["text"][1]))
	if holds and expression != null:
		var value: Variant = expression.execute(_values(), self, false)
		holds = not expression.has_execute_failed() and _truthy(value)
	return holds


# ── Helpers ───────────────────────────────────────────────────────────────────────────────


func _describe(found: Node) -> Dictionary:
	var out: Dictionary = {
		"name": str(found.name),
		"type": found.get_class(),
		"path": str(get_tree().root.get_path_to(found)),
	}
	if "text" in found:
		out["text"] = found.get("text")
	if found is Control:
		out["rect"] = TestBridge.node_rect(found as Control)
	if found is BaseButton:
		out["disabled"] = (found as BaseButton).disabled
	return out


## The centre of { node } or the point { x, y }; an error message when there is none.
func _point(args: Dictionary) -> Variant:
	if args.get("node") != null and str(args["node"]) != "":
		var control: Control = TestBridge.find(str(args["node"])) as Control
		var box: Variant = TestBridge.node_rect(control)
		if box == null:
			return "No visible control %s" % args["node"]
		return Vector2(box[0] + box[2] / 2.0, box[1] + box[3] / 2.0)
	if args.has("x") and args.has("y"):
		return Vector2(float(args["x"]), float(args["y"]))
	return "Give a node or x and y"


## A swipe end: a node name or [x, y].
func _point_of(value: Variant) -> Variant:
	if value is String:
		return _point({"node": value})
	if value is Array and (value as Array).size() == 2:
		return _point({"x": value[0], "y": value[1]})
	return "Give a node or [x, y]"


func _mouse_move(at: Vector2, before: Vector2, held: bool = false) -> void:
	var event := InputEventMouseMotion.new()
	event.position = at
	event.global_position = at
	event.relative = at - before
	event.button_mask = MOUSE_BUTTON_MASK_LEFT if held else 0
	Input.parse_input_event(event)
	await _frames(1)


func _mouse_button(at: Vector2, pressed: bool) -> void:
	var event := InputEventMouseButton.new()
	event.position = at
	event.global_position = at
	event.button_index = MOUSE_BUTTON_LEFT
	event.button_mask = MOUSE_BUTTON_MASK_LEFT if pressed else 0
	event.pressed = pressed
	Input.parse_input_event(event)
	await _frames(1)


## Waits (up to 10 s) for the hub's curtain between screens and its loading screen to go.
func _settle() -> void:
	var started: int = Time.get_ticks_msec()
	await _frames(2)
	while Time.get_ticks_msec() - started < 10_000:
		var hub: Node = TestBridge.hub
		var curtain: Variant = hub.get("_transition") if is_instance_valid(hub) else null
		var moving: bool = curtain is Object and (curtain as Object).get("running") == true
		if not moving and TestBridge.scene != "status":
			return
		await get_tree().process_frame


func _frames(count: int) -> void:
	for i: int in count:
		await get_tree().process_frame


## JSON-safe data: protocol objects through to_dict(), nodes described, vectors as arrays.
func _plain(value: Variant) -> Variant:
	var out: Variant = value
	if value is Dictionary:
		var map: Dictionary = {}
		for key: Variant in value:
			map[str(key)] = _plain(value[key])
		out = map
	elif value is Array or value is PackedStringArray or value is PackedInt32Array:
		out = Array(value).map(_plain)
	elif value is Object:
		out = _plain_object(value)
	elif value is Vector2 or value is Vector2i:
		out = [value.x, value.y]
	elif value is Rect2 or value is Rect2i:
		out = [value.position.x, value.position.y, value.size.x, value.size.y]
	elif value is Color:
		out = (value as Color).to_html()
	return out


func _plain_object(value: Object) -> Variant:
	if value is Node:
		return _describe(value as Node)
	if value.has_method("to_dict"):
		return _plain(value.call("to_dict"))
	return str(value)
