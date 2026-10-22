extends Node
## Test hooks of debug builds; a release build has none of it.
##
## Desktop: `-- --xd-port=<port> --xd-key=<key>` (the xd CLI, tools/xd) opens the control
## channel (core/xd_server.gd), which runs xd() below. `--xd-profile=<name>` keeps this run's
## login apart (Session), `--xd-sound` keeps the sound on.
##
## Web: window.xomdao, for headless browser tests (scripts/e2e, npm run shots):
##
##   xomdao.scene()         the current screen: "lobby", "select", "ben", "room", the game's id…
##   xomdao.tree(depth)     visible nodes as { name, type, text?, children? }
##   xomdao.text(name)      the text of the first visible node with that name, or null
##   xomdao.rect(name)      its box in CSS pixels of the page { x, y, width, height }, or null
##   xomdao.click(name)     presses that button (BaseButton.pressed); false when there is none
##   xomdao.state()         { scene, user, room: the latest room snapshot, balances, downloaded }
##   xomdao.request(ev, d)  sends a request to the server (e.g. `dev:coins`); its reply lands in
##                          xomdao.reply() (null until it does), and its `balances` in the client
##
## Each call runs synchronously in Godot (single-threaded build) and returns plain JSON data.

const SHIM := """
window.xomdao = {
	_call(name, args) {
		this._out = undefined;
		this._run(name, JSON.stringify(args));
		return this._out === undefined ? null : JSON.parse(this._out);
	},
	scene() { return this._call('scene', []); },
	tree(depth) { return this._call('tree', [depth ?? 99]); },
	text(name) { return this._call('text', [name]); },
	click(name) { return this._call('click', [name]); },
	state() { return this._call('state', []); },
	request(event, data) { return this._call('request', [event, data ?? {}]); },
	reply() { return this._call('reply', []); },
	rect(name) {
		const r = this._call('rect', [name]);
		if (!r) return null;
		const canvas = document.querySelector('canvas');
		const box = canvas.getBoundingClientRect();
		const k = box.width / canvas.width;
		return { x: box.x + r[0] * k, y: box.y + r[1] * k, width: r[2] * k, height: r[3] * k };
	},
};
"""

const CAPTURE_REQUEST := "res://.godot/xomdao_capture/request.json"
const CAPTURE_RESULT := "res://.godot/xomdao_capture/result.json"

## Set by the hub: the name of what is on screen.
var scene: String = "boot"
## Set by the hub: the hub itself (hub/main.gd), for xd's `go` and `login`.
var hub: Node

## The last reply to xomdao.request(), or null while it is on its way.
var _reply: Variant = null
var _api: JavaScriptObject
var _callback: JavaScriptObject
var _capture_pending: bool = false


func _ready() -> void:
	if OS.is_debug_build() and not OS.has_feature("web"):
		var timer := Timer.new()
		timer.wait_time = 0.2
		timer.timeout.connect(_poll_capture_request)
		add_child(timer)
		timer.start()
		_start_xd()
	if not OS.has_feature("web") or not OS.is_debug_build():
		return
	JavaScriptBridge.eval(SHIM, true)
	_api = JavaScriptBridge.get_interface("xomdao")
	_callback = JavaScriptBridge.create_callback(_on_call)
	_api["_run"] = _callback


## A `--name=value` argument after `--` on the command line, "" when absent.
static func user_arg(arg_name: String) -> String:
	var prefix: String = "--%s=" % arg_name
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with(prefix):
			return arg.trim_prefix(prefix)
		if arg == "--" + arg_name:
			return "true"
	return ""


func _start_xd() -> void:
	var port: int = user_arg("xd-port").to_int()
	if port <= 0:
		return
	var server: Node = (load("res://core/xd_server.gd") as GDScript).new()
	server.name = "XdServer"
	add_child(server)
	server.call("start", port, user_arg("xd-key"))
	if user_arg("xd-sound") == "":
		AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), true)


func _poll_capture_request() -> void:
	if _capture_pending or not FileAccess.file_exists(CAPTURE_REQUEST):
		return
	var file := FileAccess.open(CAPTURE_REQUEST, FileAccess.READ)
	if file == null:
		return
	var request: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not request is Dictionary or str(request.get("id", "")).is_empty():
		return
	_capture_pending = true
	_capture_viewport(str(request["id"]), str(request.get("output", "")))


func _capture_viewport(request_id: String, output: String) -> void:
	await RenderingServer.frame_post_draw
	var image: Image = get_viewport().get_texture().get_image()
	var error: Error = ERR_INVALID_PARAMETER if output.is_empty() else image.save_png(output)
	var result: Dictionary = {
		"id": request_id,
		"ok": error == OK,
		"width": image.get_width(),
		"height": image.get_height(),
		"error": "" if error == OK else "save_png returned error %d for %s" % [error, output],
	}
	var file := FileAccess.open(CAPTURE_RESULT, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(result))
		file.close()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(CAPTURE_REQUEST))
	_capture_pending = false


func _on_call(args: Array) -> void:
	var call: String = str(args[0])
	var params: Array = JSON.parse_string(str(args[1]))
	_api["_out"] = JSON.stringify(_answer(call, params))


func _answer(call: String, params: Array) -> Variant:
	var arg: String = str(params[0]) if not params.is_empty() else ""
	var answers: Dictionary = {
		"scene": func() -> Variant: return scene,
		"tree": func() -> Variant: return node_tree(get_tree().root, int(arg)),
		"text": func() -> Variant: return _text(find(arg)),
		"rect": func() -> Variant: return node_rect(find(arg) as Control),
		"click": func() -> Variant: return _click(find(arg) as BaseButton),
		"state": func() -> Variant: return app_state(),
		"request": func() -> Variant: return _request(arg, params[1] if params.size() > 1 else {}),
		"reply": func() -> Variant: return _reply,
	}
	var answer: Callable = answers.get(call, func() -> Variant: return null)
	return answer.call()


func _text(node: Node) -> Variant:
	return node.get("text") if node != null and "text" in node else null


## The control's box in window pixels: [x, y, width, height].
func node_rect(control: Control) -> Variant:
	# A screen still behind the curtain is not there to tap yet.
	if control == null or not control.is_visible_in_tree():
		return null
	var local := Rect2(Vector2.ZERO, control.size)
	var box: Rect2 = (
		control.get_viewport().get_final_transform()
		* (control.get_global_transform_with_canvas() * local)
	)
	return [box.position.x, box.position.y, box.size.x, box.size.y]


func _click(button: BaseButton) -> bool:
	if button == null or button.disabled:
		return false
	button.pressed.emit()
	return true


func _request(event: String, data: Variant) -> bool:
	_reply = null
	_send(event, data if data is Dictionary else {})
	return true


func _send(event: String, data: Dictionary) -> void:
	var reply: Dictionary = await Net.client.request(event, data)
	if reply.get("balances") is Dictionary:
		Net.client.balances = reply["balances"]
	_reply = reply


func app_state() -> Dictionary:
	var client: XomDaoClient = Net.client
	return {
		"scene": scene,
		"user": client.user.to_dict() if client.user != null else null,
		"playerId": client.player_id,
		"room": client.snapshot.to_dict() if client.snapshot != null else null,
		"balances": client.balances,
		"downloaded": ContentLoader.downloaded,
	}


## The first visible node with this name, searching the whole tree. "Board/Cell_1_2" is the
## first visible Cell_1_2 under the first visible Board.
func find(node_name: String) -> Node:
	var node: Node = get_tree().root
	for part: String in node_name.split("/", false):
		node = _find(node, part)
		if node == null:
			return null
	return node if node != get_tree().root else null


func _find(node: Node, node_name: String) -> Node:
	if node is CanvasItem and not (node as CanvasItem).is_visible_in_tree():
		return null
	if node.name == node_name:
		return node
	for child: Node in node.get_children():
		var found: Node = _find(child, node_name)
		if found != null:
			return found
	return null


## Visible nodes as { name, type, text?, rect?, disabled?, children? }; `rects` adds each
## control's box in window pixels and whether a button is disabled.
func node_tree(node: Node, depth: int, rects: bool = false) -> Dictionary:
	var out: Dictionary = {"name": str(node.name), "type": node.get_class()}
	if "text" in node and str(node.get("text")) != "":
		out["text"] = node.get("text")
	if rects and node is Control:
		out["rect"] = node_rect(node as Control)
	if rects and node is BaseButton and (node as BaseButton).disabled:
		out["disabled"] = true
	var children: Array = []
	if depth > 0:
		for child: Node in node.get_children():
			if child is CanvasItem and not (child as CanvasItem).is_visible_in_tree():
				continue
			if child is HTTPRequest or child is XomDaoClient:
				continue
			children.append(node_tree(child, depth - 1, rects))
	if not children.is_empty():
		out["children"] = children
	return out
