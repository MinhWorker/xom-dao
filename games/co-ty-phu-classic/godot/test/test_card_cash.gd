extends GutTest

const Cash := preload("res://content/co-ty-phu-classic/card_cash.gd")


func test_merge_precedes_counting_and_both_signs_reach_the_exact_balance() -> void:
	var cash: Control = add_child_autofree(Cash.new())
	cash.call("sync", 1000)
	cash.call("animate_to", 750, -250)
	assert_eq(int(cash.get("displayed")), 1000)
	assert_eq((cash.get("change") as Label).text, "−250")
	await get_tree().create_timer(0.3).timeout
	assert_eq(int(cash.get("displayed")), 1000, "The offset change is still merging")
	await get_tree().create_timer(0.38).timeout
	assert_gt(int(cash.get("displayed")), 750)
	assert_lt(int(cash.get("displayed")), 1000, "The balance counts through intermediate values")
	await get_tree().create_timer(0.4).timeout
	assert_eq(int(cash.get("displayed")), 750)
	assert_false(bool(cash.get("animating")))
	assert_eq((cash.get("label") as Label).get_theme_color("font_color"), XomDaoUi.INK)
	cash.call("animate_to", 950, 200)
	assert_eq((cash.get("change") as Label).text, "+200")
	await get_tree().create_timer(1.1).timeout
	assert_eq(int(cash.get("displayed")), 950)


func test_snapshot_refresh_does_not_jump_a_running_balance_animation() -> void:
	var cash: Control = add_child_autofree(Cash.new())
	cash.call("sync", 1000)
	cash.call("animate_to", 1100, 100)
	cash.call("sync", 1100)
	assert_eq(int(cash.get("displayed")), 1000)
	await get_tree().create_timer(1.1).timeout
	assert_eq(int(cash.get("displayed")), 1100)
