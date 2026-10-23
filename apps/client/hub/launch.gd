class_name HubLaunch
extends RefCounted
## What the hub was opened with: the page's URL on the web, `-- --<key>=<value>` on the
## command line.


## The gallery page asked for in the URL or on the command line, 0 when none.
static func gallery_page() -> int:
	var args: String = " ".join(OS.get_cmdline_user_args())
	if OS.has_feature("web"):
		args += " " + str(JavaScriptBridge.eval("window.location.search", true))
	var found: RegExMatch = RegEx.create_from_string("gallery(?:=(\\d+))?").search(args)
	if found == null:
		return 0
	return maxi(1, found.get_string(1).to_int())


## A query parameter of the page's URL; off the web, `-- --<key>=<value>` on the command line.
static func query(key: String) -> String:
	if not OS.has_feature("web"):
		return TestBridge.user_arg(key)
	var js: String = "new URLSearchParams(location.search).get('%s') || ''" % key
	return str(JavaScriptBridge.eval(js, true))


## The link that opens the hub straight into room `code`.
static func room_link(code: String) -> String:
	if not OS.has_feature("web"):
		return code
	var page: String = str(JavaScriptBridge.eval("location.origin + location.pathname", true))
	return "%s?room=%s" % [page, code]
