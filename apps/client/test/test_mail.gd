extends GutTest
## Hộp thư in the hub: the letters follow the server's pushes, the lobby's envelope gets a dot
## while some wait, and the board opens the newest waiting letter with its coins and Nhận.


func _letter(id: String, title: String, coins: int, read: bool, claimed: bool) -> Dictionary:
	return {
		"id": id,
		"title": title,
		"body": "Chúc bạn chơi vui!",
		"coins": coins,
		"sentAt": Time.get_unix_time_from_system() * 1000.0 - 3 * 3600000.0,
		"read": read,
		"claimed": claimed,
	}


func _mail(letters: Array, waiting: int) -> Array:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	var mail: HubMail = add_child_autofree(HubMail.new(client, func(_b: Dictionary) -> void: pass))
	var box := XomDaoMailbox.from_dict({"letters": letters, "waiting": waiting})
	client.event_received.emit("mail:changed", box)
	return [client, mail]


func test_the_envelope_dot_follows_what_waits() -> void:
	var made: Array = _mail([_letter("a", "Chào", 0, true, false)], 0)
	var client: XomDaoClient = made[0]
	var lobby: HubLobby = add_child_autofree(HubLobby.new())
	lobby.watch_mail(made[1])
	assert_null(lobby.mail.get_node_or_null("Dot"))
	var fresh := XomDaoMailbox.from_dict(
		{
			"letters":
			[_letter("b", "Quà", 50, false, false), _letter("a", "Chào", 0, true, false)],
			"waiting": 1
		}
	)
	client.event_received.emit("mail:changed", fresh)
	assert_not_null(lobby.mail.get_node_or_null("Dot"))


func test_the_board_opens_the_letter_that_waits() -> void:
	var letters: Array = [
		_letter("new", "Đình làng đã sửa xong", 0, true, false),
		_letter("gift", "Quà cả xóm", 200, true, false),
		_letter("old", "Chào mừng", 100, true, true),
	]
	var mail: HubMail = _mail(letters, 1)[1]
	var host: Control = add_child_autofree(Control.new())
	var board: HubMailBoard = mail.open(host)
	await wait_process_frames(1)
	assert_eq((board.find_child("LetterTitle", true, false) as Label).text, "Quà cả xóm")
	var claim: XomDaoButton = board.find_child("ClaimLetter", true, false)
	assert_false(claim.disabled)
	assert_eq(claim.text, "Nhận")
	assert_not_null(board.find_child("Letter_2", true, false))


func test_an_empty_box_says_so() -> void:
	var mail: HubMail = _mail([], 0)[1]
	var host: Control = add_child_autofree(Control.new())
	var board: HubMailBoard = mail.open(host)
	await wait_process_frames(1)
	assert_eq((board.find_child("MailEmpty", true, false) as Label).text, "Chưa có thư")
