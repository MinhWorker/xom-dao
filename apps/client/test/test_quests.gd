extends GutTest
## Nhiệm vụ hằng ngày: each quest's progress and its Nhận, when it can be taken.


func test_rows_show_progress_and_what_can_be_claimed() -> void:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	var quests: HubQuests = add_child_autofree(HubQuests.new(client))
	var board := (
		XomDaoQuestBoard
		. from_dict(
			{
				"day": "2026-10-23",
				"endsIn": 2.5 * 3600000.0,
				"quests":
				[
					{
						"id": "diem-danh",
						"title": "Điểm danh",
						"goal": 1,
						"progress": 1,
						"reward": 20,
						"claimed": false
					},
					{
						"id": "choi-3",
						"title": "Chơi 3 ván",
						"goal": 3,
						"progress": 1,
						"reward": 30,
						"claimed": false
					},
					{
						"id": "thang-1",
						"title": "Thắng 1 ván",
						"goal": 1,
						"progress": 1,
						"reward": 40,
						"claimed": true
					},
				],
			}
		)
	)
	quests.call("_show", board)
	assert_false((quests.find_child("Claim_diem-danh", true, false) as BaseButton).disabled)
	assert_true((quests.find_child("Claim_choi-3", true, false) as BaseButton).disabled)
	var taken: XomDaoButton = quests.find_child("Claim_thang-1", true, false)
	assert_true(taken.disabled)
	assert_eq(taken.text, "Đã nhận")
	assert_eq(
		(quests.find_child("QuestsRefresh", true, false) as Label).text,
		"Đổi nhiệm vụ sau 2 giờ 30 phút"
	)
