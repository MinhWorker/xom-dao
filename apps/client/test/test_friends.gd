extends GutTest
## Bạn bè in the hub: the list follows the server's pushes, unread messages count up unless that
## chat is open, the Bạn bè board shows requests, friends and their unread messages, and Tìm kiếm
## shows people with where they stand with you.


func _list(rows: Array) -> XomDaoFriendList:
	return XomDaoFriendList.from_dict({"friends": rows})


func _friends() -> Array:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	var friends: HubFriends = add_child_autofree(HubFriends.new(client))
	var rows: Array = [
		{
			"id": "lan",
			"username": "lan",
			"name": "Lan",
			"avatar": "girl",
			"frame": "gold",
			"state": "incoming",
			"online": false,
			"unread": 0
		},
		{
			"id": "hoa",
			"username": "hoa",
			"name": "Hoa",
			"avatar": "cat",
			"frame": "gold",
			"state": "friend",
			"online": true,
			"gameId": "tien-len",
			"roomCode": "K7M2",
			"unread": 1
		},
	]
	client.event_received.emit("friends:changed", _list(rows))
	return [client, friends]


func test_the_list_follows_pushes_and_counts_what_waits() -> void:
	var made: Array = _friends()
	var client: XomDaoClient = made[0]
	var friends: HubFriends = made[1]
	assert_eq(friends.list.size(), 2)
	assert_eq(friends.attention(), 2, "a request and an unread message")
	friends.game_name = func(_id: String) -> String: return "Tiến Lên"
	assert_eq(friends.where_text(friends.friend("hoa")), "Đang chơi Tiến Lên")
	var said := XomDaoChatMessage.from_dict(
		{"id": "1", "from": "hoa", "to": "me", "text": "Chơi không?", "at": 1.0}
	)
	client.event_received.emit("chat:message", said)
	assert_eq(friends.friend("hoa").unread, 2)
	friends.chatting = "hoa"
	client.event_received.emit("chat:message", said)
	assert_eq(friends.friend("hoa").unread, 2, "an open chat reads its messages")


func test_the_friends_tab_shows_requests_friends_and_unread() -> void:
	var made: Array = _friends()
	var friends: HubFriends = made[1]
	var panel: HubFriendsPanel = add_child_autofree(HubFriendsPanel.new(friends, "me"))
	assert_not_null(panel.find_child("Accept_lan", true, false), "a request to you: Đồng ý")
	assert_not_null(panel.find_child("FriendRow_hoa", true, false))
	assert_eq((panel.find_child("Unread_hoa", true, false) as XomDaoChip).text, "1")
	assert_true((panel.find_child("ChatEmpty", true, false) as Label).visible)
	assert_eq((panel.find_child("ChatEmpty", true, false) as Label).text, "Chưa chọn ai")


func test_an_invitation_shows_a_card_with_vao() -> void:
	var made: Array = _friends()
	var client: XomDaoClient = made[0]
	var friends: HubFriends = made[1]
	var joined: Array[String] = []
	friends.join_requested.connect(func(code: String) -> void: joined.append(code))
	var invite := XomDaoRoomInvite.from_dict(
		{
			"fromId": "hoa",
			"fromName": "Hoa",
			"avatar": "cat",
			"frame": "gold",
			"roomCode": "K7M2",
			"gameId": "tien-len"
		}
	)
	client.event_received.emit("room:invite", invite)
	var card: Node = get_tree().root.find_child("InviteCard", true, false)
	assert_not_null(card)
	(card.find_child("AcceptInvite", true, false) as BaseButton).pressed.emit()
	assert_eq(joined, ["K7M2"] as Array[String])


func _person(id: String, recent: bool, online: bool) -> XomDaoPerson:
	return XomDaoPerson.from_dict(
		{
			"id": id,
			"username": id,
			"name": id.capitalize(),
			"avatar": "boy",
			"frame": "",
			"online": online,
			"recent": recent
		}
	)


func test_search_rows_say_where_people_stand() -> void:
	var made: Array = _friends()
	var friends: HubFriends = made[1]
	var search: HubFriendSearch = add_child_autofree(HubFriendSearch.new(friends))
	var people: Array[XomDaoPerson] = [
		_person("tuan", true, false), _person("lan", false, true), _person("hoa", false, true)
	]
	search.show_people(people)
	assert_not_null(search.find_child("Add_tuan", true, false), "a stranger: Kết bạn")
	assert_not_null(search.find_child("Accept_lan", true, false), "they asked you: Đồng ý")
	assert_null(search.find_child("Add_hoa", true, false), "already a friend")
	assert_true(_has_text(search.find_child("Person_tuan", true, false), "Vừa chơi cùng"))
	assert_true(_has_text(search.find_child("Person_hoa", true, false), "Bạn bè"))
	search.show_people([] as Array[XomDaoPerson])
	assert_true((search.find_child("PeopleEmpty", true, false) as Label).visible)


func test_the_board_counts_what_waits_and_switches_tabs() -> void:
	var made: Array = _friends()
	var friends: HubFriends = made[1]
	var host: Control = add_child_autofree(Control.new())
	var board: HubFriendsBoard = friends.open(host)
	var tabs: XomDaoChoice = board.find_child("FriendsTabs", true, false)
	assert_eq(tabs.options[0], "Bạn bè (2)")
	assert_true((board.find_child("FriendsPanel", true, false) as Control).visible)
	board.choose(1)
	assert_true((board.find_child("FriendSearch", true, false) as Control).visible)
	assert_false((board.find_child("FriendsPanel", true, false) as Control).visible)


func test_the_lobby_people_button_opens_the_board_with_a_dot() -> void:
	var made: Array = _friends()
	var friends: HubFriends = made[1]
	var settings := XomDaoSettings.new()
	settings.path = ""
	var lobby: HubLobby = add_child_autofree(HubLobby.new(settings))
	lobby.watch_friends(friends)
	assert_not_null(lobby.friends.get_node_or_null("Dot"))
	lobby.friends.pressed.emit()
	assert_not_null(lobby.find_child("FriendsBoard", true, false))


func _has_text(node: Node, text: String) -> bool:
	if node is Label and (node as Label).text == text:
		return true
	if node is XomDaoChip and (node as XomDaoChip).text == text:
		return true
	for child: Node in node.get_children():
		if _has_text(child, text):
			return true
	return false
