extends Node
## The Game's side of the Bridge (autoload `XomdaoBridge`): the messages a Game and the Hub send
## each other, as `packages/bridge/src/protocol.ts` defines them.
##
## Inside the Hub's iframe it talks to the Hub by `postMessage`. Run from the editor, headless,
## or in a browser tab with `?harness=<ws url>`, it talks to the Harness over a WebSocket (see
## `harness_url()`). The Game sees no difference:
##
##     func _ready() -> void:
##         XomdaoBridge.inited.connect(_on_init)            # redraw everything from `init`
##         XomdaoBridge.message_received.connect(_on_message)
##         XomdaoBridge.announce_ready()                    # handlers set: the Hub sends `init`
##
##     var result: Dictionary = await XomdaoBridge.send("place", {"x": 4, "y": 4})
##     if not result.ok: print(result.error)                # the server's refusal (Vietnamese)
##
##     XomdaoBridge.done()                                  # the end-of-match animation is over
##
## Every `init` (first load, reconnect, replay) must rebuild the whole screen from its `match`.
## JSON numbers arrive as floats: use `int(...)` for ids and coordinates.

## The Hub sent `init`: `{player, room, locale, settings, match}`. `match` is the Match state
## (the Game's own `view`), or null at the start of a Match.
signal inited(init: Dictionary)
## The server pushed `event` (`match:state` for each Match update) with `data` as the Game's
## server sent it.
signal message_received(event: String, data: Variant)
## Volume (0-1) and mute changed in the Hub's menu. Already applied to the Master bus.
signal settings_changed(settings: Dictionary)
## The tab was hidden or shown.
signal visibility_changed(hidden: bool)
## The WebSocket to the Harness closed (never emitted inside the Hub).
signal connection_lost

## Must equal `BRIDGE_VERSION` in packages/bridge/src/protocol.ts; the Hub refuses a mismatch.
const BRIDGE_VERSION := 1
const BRIDGE_TAG := "xomdao"
## The error of a `send` still waiting when a new `init` arrives.
const ERROR_RESET := "reset"
## The error of a `send` the Hub could not pass on (no connection): the Hub shows it.
const ERROR_UNAVAILABLE := "unavailable"
## Where a Game run outside the Hub looks for the Harness (player 0).
const DEFAULT_HARNESS_URL := "ws://127.0.0.1:8040/bridge?player=0"
const HARNESS_ENV := "XOMDAO_HARNESS"
const HARNESS_ARG := "--harness="

const WindowTransport := preload("window_transport.gd")
const SocketTransport := preload("socket_transport.gd")

## Set the Master bus to the Hub's volume and mute on every `settings`.
@export var apply_settings := true

## The latest `init`, empty before the first one.
var last_init: Dictionary = {}

var _transport: RefCounted
var _next_id := 1
var _pending: Dictionary = {}


class Pending:
	extends RefCounted
	signal resolved(result: Dictionary)


func _ready() -> void:
	var url := harness_url()
	if url != "":
		_transport = SocketTransport.new(url, _on_text, _on_lost)
		print("XomdaoBridge: Harness at ", url)
	elif OS.has_feature("web"):
		_transport = WindowTransport.new(_on_text)
	else:
		_transport = SocketTransport.new(DEFAULT_HARNESS_URL, _on_text, _on_lost)
		print("XomdaoBridge: Harness at ", DEFAULT_HARNESS_URL)
	_transport.open()


func _process(delta: float) -> void:
	if _transport != null:
		_transport.poll(delta)


func _exit_tree() -> void:
	if _transport != null:
		_transport.close()


## The Harness WebSocket URL this run was given, or "" when it talks to the Hub:
## the page's `?harness=` parameter (web), `--harness=<url>` after `--` in the command line, or
## the `XOMDAO_HARNESS` environment variable.
func harness_url() -> String:
	if OS.has_feature("web"):
		return String(JavaScriptBridge.eval("new URLSearchParams(location.search).get('harness') || ''", true))
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with(HARNESS_ARG):
			return arg.substr(HARNESS_ARG.length())
	return OS.get_environment(HARNESS_ENV)


## Loading progress (0-1) for the Hub's loading screen. Optional.
func progress(value: float) -> void:
	_post({"type": "progress", "value": clampf(value, 0.0, 1.0)})


## The Game is loaded and its handlers are connected: the Hub answers with `init`.
## (Named so because `ready` is a signal of every Node.)
func announce_ready() -> void:
	_post({"type": "ready", "version": BRIDGE_VERSION})


## Sends a message to the server. Await it: the result is `{ok: bool, error: String}`, `error`
## being the server's refusal, `ERROR_RESET` or `ERROR_UNAVAILABLE`.
func send(event: String, data: Variant = null) -> Dictionary:
	var id := _next_id
	_next_id += 1
	var pending := Pending.new()
	_pending[id] = pending
	_post({"type": "send", "id": id, "event": event, "data": data})
	return await pending.resolved


## The end-of-match animation is over: the Hub shows the results.
func done() -> void:
	_post({"type": "done"})


func _post(message: Dictionary) -> void:
	if _transport == null:
		return
	message["bridge"] = BRIDGE_TAG
	_transport.post(JSON.stringify(message))


func _on_text(text: String) -> void:
	var parsed: Variant = JSON.parse_string(text)
	if not parsed is Dictionary:
		return
	var message: Dictionary = parsed
	if message.get("bridge") != BRIDGE_TAG:
		return
	match message.get("type"):
		"init":
			var init: Variant = message.get("init")
			if init is Dictionary:
				_resolve_all({"ok": false, "error": ERROR_RESET})
				last_init = init
				_apply_settings(init.get("settings", {}))
				inited.emit(init)
		"ack":
			var id := int(message.get("id", -1))
			var pending: Pending = _pending.get(id)
			if pending != null:
				_pending.erase(id)
				var ok: bool = message.get("ok", false)
				pending.resolved.emit({"ok": ok, "error": "" if ok else String(message.get("error", "error"))})
		"message":
			message_received.emit(String(message.get("event", "")), message.get("data"))
		"settings":
			var settings: Variant = message.get("settings")
			if settings is Dictionary:
				_apply_settings(settings)
				settings_changed.emit(settings)
		"visibility":
			visibility_changed.emit(bool(message.get("hidden", false)))


func _on_lost() -> void:
	_resolve_all({"ok": false, "error": ERROR_UNAVAILABLE})
	connection_lost.emit()


func _resolve_all(result: Dictionary) -> void:
	var waiting := _pending.values()
	_pending.clear()
	for pending: Pending in waiting:
		pending.resolved.emit(result)


func _apply_settings(settings: Dictionary) -> void:
	if not apply_settings or settings.is_empty():
		return
	var master := AudioServer.get_bus_index("Master")
	AudioServer.set_bus_volume_db(master, linear_to_db(float(settings.get("volume", 1.0))))
	AudioServer.set_bus_mute(master, bool(settings.get("muted", false)))
