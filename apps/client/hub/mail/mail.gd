class_name HubMail
extends Node
## Hộp thư for the whole hub: your letters from Xóm Đảo (kept fresh by the server's
## `mail:changed`, with a "Có thư mới" toast), reading them and taking their coins. The lobby's
## envelope shows a dot while `box.waiting` is above 0 and opens the board (`open`).
##
##   var mail := HubMail.new(client, on_paid)  # on_paid(balances) after coins are taken
##   add_child(mail)                           # it refreshes on every (re)connect

## The letters changed (one came, one was read or its coins taken).
signal changed

var box := XomDaoMailbox.new()

var _client: XomDaoClient
var _on_paid: Callable


func _init(client: XomDaoClient, on_paid: Callable) -> void:
	name = "Mail"
	_client = client
	_on_paid = on_paid
	client.event_received.connect(_on_event)
	client.connected.connect(refresh)


func refresh() -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.MAIL_GET)
	if bool(reply.get("ok", false)):
		_take(XomDaoMailbox.from_dict(reply))


func read(id: String) -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.MAIL_READ, {"id": id})
	if bool(reply.get("ok", false)):
		_take(XomDaoMailbox.from_dict(reply))


## Takes a letter's coins; "" when it went through, else the reason.
func claim(id: String) -> String:
	var reply: Dictionary = await HubWait.ask(XomDaoProtocol.MAIL_CLAIM, {"id": id}, _client)
	if not bool(reply.get("ok", false)):
		return str(reply.get("error", "Không nhận được"))
	var taken := XomDaoMailClaim.from_dict(reply)
	_take(taken.mailbox)
	_on_paid.call(taken.balances)
	return ""


## Opens the board over `host`.
func open(host: Control) -> HubMailBoard:
	var board := HubMailBoard.new(self)
	host.add_child(board)
	return board


func _on_event(_event: String, data: Variant) -> void:
	if not data is XomDaoMailbox:
		return
	var fresh := data as XomDaoMailbox
	var known: Dictionary = {}
	for letter: XomDaoLetter in box.letters:
		known[letter.id] = true
	var arrived: bool = fresh.letters.any(func(l: XomDaoLetter) -> bool: return not known.has(l.id))
	_take(fresh)
	var host: Node = get_parent()
	if arrived and host is Control:
		XomDaoToast.show_on(host as Control, "Có thư mới", "envelope-simple")


func _take(fresh: XomDaoMailbox) -> void:
	box = fresh
	changed.emit()
