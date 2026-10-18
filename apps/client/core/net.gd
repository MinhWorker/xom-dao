extends Node
## The connection to the game server (WebSocket + JSON): one XomDaoClient for the whole app.

## Where the server is when nothing says otherwise (the editor, desktop runs).
const LOCAL_URL := "ws://localhost:8033/ws"

var client := XomDaoClient.new()


func _ready() -> void:
	client.name = "Client"
	add_child(client)


## The server's /ws URL. On the web: window.XOMDAO_SERVER when the build sets it (godot:export
## writes it from XOMDAO_SERVER_URL or VITE_SERVER_URL), else this page's own origin, which the
## dev server and the Nest server both answer. Elsewhere: XOMDAO_SERVER or the local server.
func server_url() -> String:
	if OS.has_feature("web"):
		var configured: String = str(JavaScriptBridge.eval("window.XOMDAO_SERVER || ''", true))
		if configured != "":
			return _ws(configured)
		return _ws(str(JavaScriptBridge.eval("location.origin", true)))
	var env: String = OS.get_environment("XOMDAO_SERVER")
	return _ws(env) if env != "" else LOCAL_URL


## http(s)://host → ws(s)://host/ws; a ws(s):// URL stays as it is.
static func _ws(url: String) -> String:
	if url.begins_with("ws"):
		return url
	return url.trim_suffix("/").replace("http", "ws") + "/ws"


## Reloads the page, clearing Service Worker and Cache Storage on the web so stale builds
## don't loop on "Đã có bản mới".
func reload_fresh() -> void:
	if OS.has_feature("web"):
		(
			JavaScriptBridge
			. eval(
				"""
			(function() {
				var reloaded = false;
				var reload = function() {
					if (reloaded) return;
					reloaded = true;
					window.location.reload();
				};
				var clearAndReload = async function() {
					try {
						if ('serviceWorker' in navigator) {
							var registrations = await navigator.serviceWorker.getRegistrations();
							await Promise.all(registrations.map(function(r) { return r.unregister(); }));
						}
						if ('caches' in window) {
							var keys = await caches.keys();
							await Promise.all(keys.map(function(k) { return caches.delete(k); }));
						}
					} catch (e) {
						console.error(e);
					}
					reload();
				};
				clearAndReload();
				setTimeout(reload, 800);
			})();
		""",
				true
			)
		)
	else:
		get_tree().reload_current_scene()
