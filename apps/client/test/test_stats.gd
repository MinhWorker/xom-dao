extends GutTest
## Levels, achievements and rankings in the hub with made-up data (no server): Nhà's card and
## shelf, Đình's boards, and the lobby's level chip.


func _stats() -> XomDaoPlayerStats:
	return (
		XomDaoPlayerStats
		. from_dict(
			{
				"userId": "lan",
				"level": 2,
				"xp": 150,
				"levelXp": 100,
				"nextXp": 300,
				"played": 7,
				"won": 3,
				"achievements":
				[
					{
						"id": "core:played-10",
						"name": "Mười ván",
						"gameId": "",
						"stat": "played",
						"at": 10,
						"progress": 7,
						"unlocked": false,
						"reward": {"core:coin": 50},
						"xp": 50,
					},
					{
						"id": "tien-len:chop",
						"name": "Chặt heo",
						"gameId": "tien-len",
						"stat": "chop",
						"at": 1,
						"progress": 2,
						"unlocked": true,
						"reward": {"core:coin": 30},
						"xp": 30,
					},
				],
				"ranks":
				[
					{"board": "core", "value": 150, "rank": 4},
					{"board": "tien-len", "value": 3, "rank": 1},
				],
			}
		)
	)


func _entry(rank: int, id: String, value: int) -> Dictionary:
	return {"rank": rank, "id": id, "name": id, "avatar": "", "frame": "", "value": value}


func test_nha_shows_the_level_and_reached_achievements_first() -> void:
	var home: HubHome = add_child_autofree(HubHome.new())
	home.show_stats(_stats(), {"tien-len": "Tiến Lên"})
	assert_eq((home.find_child("HomeLevel", true, false) as XomDaoChip).text, "Cấp 2")
	var bar: ProgressBar = home.find_child("HomeXp", true, false)
	assert_eq([bar.value, bar.max_value], [50.0, 200.0])
	assert_eq((home.find_child("HomeWon", true, false) as Label).text, "3 thắng")
	assert_true((home.find_child("Tab_ho-so", true, false) as HubHomeTab).selected)
	(home.find_child("Tab_thanh-tich", true, false) as Button).pressed.emit()
	await wait_process_frames(1)
	var row: Node = home.find_child("AchievementList", true, false)
	var names: Array = row.get_children().map(func(n: Node) -> String: return str(n.name))
	assert_eq(names, ["Achievement_tien-len-chop", "Achievement_core-played-10"])
	var total: Label = home.find_child("AchievementCount", true, false)
	assert_eq(total.text, "1 / 2 đã đạt")
	var completed: HubAchievementTile = row.get_child(0)
	assert_eq((completed.find_child("AchievementReached", true, false) as Label).text, "Đã đạt")
	var logo: TextureRect = completed.find_child("GameLogo", true, false)
	assert_eq(logo.texture.resource_path, "res://hub/select/logo/tien-len.svg")
	assert_true(logo.material is ShaderMaterial)
	var game_filter: HubAchievementFilter = home.find_child(
		"AchievementFilter_tien-len", true, false
	)
	assert_eq(game_filter.tooltip_text, "Tiến Lên")
	game_filter.pressed.emit()
	await wait_process_frames(1)
	assert_eq(
		(home.find_child("AchievementList", true, false) as VBoxContainer).get_children().map(
			func(n: Node) -> String: return str(n.name)
		),
		["Achievement_tien-len-chop"]
	)


func test_nha_lists_your_finished_games_newest_first() -> void:
	var home: HubHome = add_child_autofree(HubHome.new())
	assert_null(home.find_child("Tab_xep-hang", true, false), "ranks live in Đình")
	(home.find_child("Tab_lich-su", true, false) as Button).pressed.emit()
	assert_eq((home.find_child("ShelfEmpty", true, false) as Label).text, "Đang tải")
	var matches: Array[XomDaoMatchRecord] = [
		(
			XomDaoMatchRecord
			. from_dict(
				{
					"id": "m2",
					"gameId": "tien-len",
					"outcome": "win",
					"startedAt": 1000.0,
					"endedAt": 1000.0 + 12 * 60000.0,
					"players":
					[
						{"name": "Minh", "bot": false, "won": true, "left": false, "me": true},
						{"name": "Lan", "bot": false, "won": false, "left": false, "me": false},
					],
				}
			)
		),
		XomDaoMatchRecord.from_dict({"id": "m1", "gameId": "go", "outcome": "loss"}),
	]
	home.show_history(matches, {"tien-len": "Tiến Lên"})
	var first: Node = home.find_child("Match_0", true, false)
	assert_eq((first.find_child("MatchOutcome", true, false) as Label).text, "Thắng")
	assert_eq((first.find_child("MatchGame", true, false) as Label).text, "Tiến Lên")
	assert_eq(HubMatchRow.took(matches[0]), "12 phút")
	assert_eq(HubMatchRow.ago(3 * 3600000.0), "3 giờ trước")
	var second: Node = home.find_child("Match_1", true, false)
	assert_eq((second.find_child("MatchOutcome", true, false) as Label).text, "Thua")
	var other: HubHome = add_child_autofree(HubHome.new(null, false))
	assert_null(other.find_child("Tab_lich-su", true, false), "someone else's games are theirs")


func test_dinh_shows_a_board_and_your_row_below_it() -> void:
	var dinh: HubDinh = add_child_autofree(HubDinh.new())
	watch_signals(dinh)
	dinh.set_boards([["tic-tac-toe", "Caro"]])
	assert_signal_emitted_with_parameters(dinh, "board_changed", ["core"])
	var ranking := (
		XomDaoRanking
		. from_dict(
			{
				"board": "core",
				"entries": [_entry(1, "an", 300), _entry(2, "binh", 200)],
				"me": _entry(9, "lan", 40),
			}
		)
	)
	dinh.show_ranking(ranking, "lan")
	await wait_process_frames(1)
	assert_not_null(dinh.find_child("Rank_1", true, false))
	var mine: Node = dinh.find_child("RankMe", true, false)
	assert_eq((mine.find_child("Value", true, false) as XomDaoChip).text, "40 kinh nghiệm")
	(dinh.find_child("Tab_tic-tac-toe", true, false) as XomDaoButton).pressed.emit()
	assert_signal_emitted_with_parameters(dinh, "board_changed", ["tic-tac-toe"])
	# A late reply for the board left behind changes nothing.
	dinh.show_ranking(ranking, "lan")
	await wait_process_frames(1)
	assert_eq(dinh.board, "tic-tac-toe")


func test_the_lobby_shows_your_level() -> void:
	var lobby: HubLobby = add_child_autofree(HubLobby.new())
	assert_false((lobby.find_child("LobbyLevel", true, false) as Control).visible)
	lobby.show_level(3)
	var chip: XomDaoChip = lobby.find_child("LobbyLevel", true, false)
	assert_true(chip.visible)
	assert_eq(chip.text, "Cấp 3")
