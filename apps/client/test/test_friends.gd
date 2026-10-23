extends GutTest
## Bạn bè in the hub: the list follows the server's pushes, unread messages count up unless that
## chat is open, and the Bến page shows requests, friends and their unread messages.


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


func test_the_ben_page_shows_requests_friends_and_unread() -> void:
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
