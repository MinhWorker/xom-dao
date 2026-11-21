extends RefCounted
## The Bridge over `postMessage`: how a Game in the Hub's iframe talks to the Hub (same origin).
## Only web exports have it. One JSON string crosses each way; the JS side checks the sender.

const JS_HELPER := """
window.__xomdaoBridge = {
	post(text) {
		window.parent.postMessage(JSON.parse(text), location.origin);
	},
	listen(callback) {
		window.addEventListener('message', (event) => {
			if (event.source !== window.parent || event.origin !== location.origin) return;
			if (event.data === undefined) return;
			callback(JSON.stringify(event.data));
		});
	},
};
"""

var _on_message: Callable
var _js: JavaScriptObject
var _callback: JavaScriptObject


func _init(on_message: Callable) -> void:
	_on_message = on_message


func open() -> bool:
	if not OS.has_feature("web"):
		return false
	JavaScriptBridge.eval(JS_HELPER, true)
	_js = JavaScriptBridge.get_interface("__xomdaoBridge")
	_callback = JavaScriptBridge.create_callback(_on_js_message)
	_js.listen(_callback)
	return true


func is_open() -> bool:
	return _js != null


func post(text: String) -> void:
	if _js != null:
		_js.post(text)


func poll(_delta: float) -> void:
	pass


func close() -> void:
	_js = null


func _on_js_message(args: Array) -> void:
	if args.size() > 0:
		_on_message.call(String(args[0]))
