extends GutTest


func _snapshot(winners: Array, rewards: Array) -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "tic-tac-toe",
				"hostId": "minh",
				"players":
				[
					{"id": "minh", "name": "Minh", "connected": true},
					{"id": "bot:1", "name": "Máy", "connected": true, "bot": true},
				],
				"status": "finished",
				"result": {"winners": winners, "rewards": rewards},
			}
		)
	)


func test_rewards_are_a_section_of_icon_tags_without_zeros() -> void:
	var settings := XomDaoSettings.new()
	settings.path = ""
	var paid: HubResult = add_child_autofree(HubResult.new(settings))
	(
		paid
		. show_result(
			_snapshot(
				["minh"],
				[
					{"player": "minh", "resource": "core:coin", "amount": 20},
					{"player": "bot:1", "resource": "core:coin", "amount": 5},
				]
			),
			"minh",
			100
		)
	)
	assert_true(paid.find_child("ResultRewards", true, false).visible)
	assert_eq(paid.find_child("Reward", true, false).amount, 20)
	assert_null(paid.find_child("EventReward", true, false), "no event points outside an event")
	var nothing: HubResult = add_child_autofree(HubResult.new(settings))
	nothing.show_result(
		_snapshot(["bot:1"], [{"player": "minh", "resource": "core:coin", "amount": 0}]),
		"minh",
		100
	)
	assert_false(nothing.find_child("ResultRewards", true, false).visible, "0 shows nothing")
	assert_null(nothing.find_child("Reward", true, false))
	var event: HubResult = add_child_autofree(HubResult.new(settings))
	event.show_result(
		_snapshot(["minh"], [{"player": "minh", "resource": "event:point", "amount": 3}]),
		"minh",
		100,
		true
	)
	assert_eq(event.find_child("EventReward", true, false).amount, 3)
	assert_null(event.find_child("Reward", true, false), "no coins, no coin tag")
