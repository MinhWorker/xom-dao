class_name HubFriends
extends Node
## Bạn bè for the whole hub: your friends and requests (kept fresh by the server's
## `friends:changed`), chat with them (`chat:message`) and their invitations to a room
## (`room:invite`, shown as a card at the top with Vào). Screens read `list`, call the actions and
## follow `changed` / `message`; `attention()` is what the lobby's Bạn bè button shows a dot for.
## `open(host)` puts the Bạn bè board (HubFriendsBoard) over a screen.
##
##   var friends := HubFriends.new(client)
##   add_child(friends)                        # it refreshes on every (re)connect
##   friends.join_requested.connect(client.join_room)

## The list changed (a request, an answer, someone online or into a room, unread messages).
signal changed
## A chat message came in, or one you sent went out.
signal message(message: XomDaoChatMessage)
## Vào on an invitation: join that room.
signal join_requested(code: String)

var list: Array[XomDaoFriend] = []
## The friend whose chat is open (their messages arrive read), "" for none.
var chatting: String = ""
## A game's name from its id (the hub's catalog), for "Đang chơi Tiến Lên".
var game_name := func(id: String) -> String: return id

var _client: XomDaoClient
var _invite_card: HubInviteCard


func _init(client: XomDaoClient) -> void:
	name = "Friends"
	_client = client
	client.event_received.connect(_on_event)
	client.connected.connect(refresh)


## Fetches the list again.
func refresh() -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.FRIENDS_LIST)
	_take(reply)


## Your friends (accepted), online first.
func friends() -> Array[XomDaoFriend]:
	return list.filter(func(friend: XomDaoFriend) -> bool: return friend.state == "friend")


func friend(id: String) -> XomDaoFriend:
	for one: XomDaoFriend in list:
		if one.id == id:
			return one
	return null


## Where a friend is: "Đang chơi <game>", "Đang online" or "Không online".
func where_text(one: XomDaoFriend) -> String:
	if not one.online:
		return "Không online"
	if one.game_id != "":
		return "Đang chơi %s" % game_name.call(one.game_id)
	return "Đang online"


## Where someone stands with you: "friend", "incoming", "outgoing", or "" for nobody yet.
func state_of(id: String) -> String:
	var one: XomDaoFriend = friend(id)
	return one.state if one != null else ""


## Requests to you plus unread messages: the Bạn bè button's dot.
func attention() -> int:
	var count: int = 0
	for one: XomDaoFriend in list:
		count += one.unread + (1 if one.state == "incoming" else 0)
	return count


## Asks someone by username; "" when it went through, else the reason.
func add(username: String) -> String:
	return _take(await HubWait.ask(XomDaoProtocol.FRIENDS_ADD, {"username": username}, _client))


func answer(id: String, accept: bool) -> String:
	var data: Dictionary = {"userId": id, "accept": accept}
	return _take(await HubWait.ask(XomDaoProtocol.FRIENDS_ANSWER, data, _client))


func remove(id: String) -> String:
	return _take(await HubWait.ask(XomDaoProtocol.FRIENDS_REMOVE, {"userId": id}, _client))


## The newest messages with a friend, oldest first (they become read).
func history(id: String) -> Array[XomDaoChatMessage]:
	var reply: Dictionary = await HubWait.ask(XomDaoProtocol.CHAT_HISTORY, {"userId": id}, _client)
	var out: Array[XomDaoChatMessage] = []
	if bool(reply.get("ok", false)):
		out = XomDaoChatHistory.from_dict(reply).messages
		var one: XomDaoFriend = friend(id)
		if one != null and one.unread > 0:
			one.unread = 0
			changed.emit()
	return out


## Sends a friend a message; "" when it went through, else the reason.
func send(id: String, text: String) -> String:
	var reply: Dictionary = await _client.request(
		XomDaoProtocol.CHAT_SEND, {"userId": id, "text": text}
	)
	if not bool(reply.get("ok", false)):
		return str(reply.get("error", "Không gửi được"))
	message.emit(XomDaoChatMessage.from_dict(reply.get("message", {})))
	return ""


## Asks a friend to your room; "" when it went through, else the reason.
func invite(id: String) -> String:
	var reply: Dictionary = await HubWait.ask(
		XomDaoProtocol.FRIENDS_INVITE, {"userId": id}, _client
	)
	return "" if bool(reply.get("ok", false)) else str(reply.get("error", "Không mời được"))


## People you might add: played with lately, then online (`friends:suggest`).
func suggest() -> Array[XomDaoPerson]:
	var reply: Dictionary = await HubWait.ask(XomDaoProtocol.FRIENDS_SUGGEST, {}, _client)
	if not bool(reply.get("ok", false)):
		return []
	return XomDaoPeopleList.from_dict(reply).people


## The account with exactly this username, or null (`friends:find`).
func find(username: String) -> XomDaoPerson:
	var data: Dictionary = {"username": username}
	var reply: Dictionary = await HubWait.ask(XomDaoProtocol.FRIENDS_FIND, data, _client)
	var people: Array[XomDaoPerson] = []
	if bool(reply.get("ok", false)):
		people = XomDaoPeopleList.from_dict(reply).people
	return people[0] if not people.is_empty() else null


## The Bạn bè board over `host`, on Bạn bè (`tab` 0) or Tìm kiếm (1).
func open(host: Control, tab: int = 0) -> HubFriendsBoard:
	var me: String = _client.user.id if _client.user != null else _client.player_id
	var board := HubFriendsBoard.new(self, me, tab)
	host.add_child(board)
	return board


## Mời bạn in a room: the friends online to ask, and the link to share.
func open_invite(host: Control) -> void:
	var picker := HubInvitePicker.new(self, _client.room_code)
	host.add_child(picker)


func _take(reply: Dictionary) -> String:
	if not bool(reply.get("ok", false)):
		return str(reply.get("error", "Không được"))
	list = XomDaoFriendList.from_dict(reply).friends
	changed.emit()
	return ""


func _on_event(_event: String, data: Variant) -> void:
	if data is XomDaoFriendList:
		list = (data as XomDaoFriendList).friends
		# A chat that is open reads its messages as they come.
		var open: XomDaoFriend = friend(chatting)
		if open != null:
			open.unread = 0
		changed.emit()
	elif data is XomDaoChatMessage:
		var said := data as XomDaoChatMessage
		var from: XomDaoFriend = friend(said.from)
		if from != null and said.from != chatting:
			from.unread += 1
			changed.emit()
		message.emit(said)
	elif data is XomDaoRoomInvite:
		_show_invite(data as XomDaoRoomInvite)


## A friend's invitation: a card at the top of the screen with Vào, for a while.
func _show_invite(invite: XomDaoRoomInvite) -> void:
	if invite.room_code == _client.room_code:
		return
	if is_instance_valid(_invite_card):
		_invite_card.queue_free()
	_invite_card = HubInviteCard.new(invite, game_name.call(invite.game_id))
	_invite_card.accepted.connect(join_requested.emit.bind(invite.room_code))
	var host: Node = get_parent()
	if host != null:
		host.add_child(_invite_card)
