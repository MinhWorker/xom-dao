class_name HubTouchCancel
extends RefCounted
## Web Godot releases a touch on DOM touchcancel without setting ScreenTouch.canceled.
## Capture that event before the engine's release so a canceled gesture cannot commit.

var _window: JavaScriptObject
var _callback: JavaScriptObject


func _init(owner: Node, cancel: Callable) -> void:
	if not OS.has_feature("web"):
		return
	_window = JavaScriptBridge.get_interface("window")
	_callback = JavaScriptBridge.create_callback(func(_args: Array) -> void: cancel.call())
	_window.addEventListener("touchcancel", _callback, true)
	owner.tree_exiting.connect(_disconnect)


func _disconnect() -> void:
	_window.removeEventListener("touchcancel", _callback, true)
	_callback = null
	_window = null
