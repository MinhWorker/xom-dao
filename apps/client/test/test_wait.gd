extends GutTest
## The wait badge: only for slow replies, and never a flicker.


func test_a_quick_reply_shows_nothing() -> void:
	var wait: HubWait = add_child_autofree(HubWait.new())
	wait.hold()
	wait._process(HubWait.DELAY * 0.5)
	wait.release()
	wait._process(HubWait.DELAY)
	assert_false(wait.showing())


func test_a_slow_reply_shows_the_badge_and_keeps_it_a_moment() -> void:
	var wait: HubWait = add_child_autofree(HubWait.new())
	wait.hold()
	wait._process(HubWait.DELAY + 0.01)
	assert_true(wait.showing())
	wait.release()
	wait._process(HubWait.HOLD * 0.3)
	assert_true(wait.showing(), "stays at least HOLD")
	wait._process(HubWait.HOLD)
	assert_false(wait.showing())


func test_it_waits_for_every_request() -> void:
	var wait: HubWait = add_child_autofree(HubWait.new())
	wait.hold()
	wait.hold()
	wait._process(HubWait.DELAY + 0.01)
	wait.release()
	wait._process(HubWait.HOLD + 0.01)
	assert_true(wait.showing(), "one still on its way")
	wait.release()
	wait._process(0.01)
	assert_false(wait.showing())


func test_ask_without_a_connection_answers_offline() -> void:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	var wait: HubWait = add_child_autofree(HubWait.new())
	var reply: Dictionary = await HubWait.ask(XomDaoProtocol.SHOP_LIST, {}, client)
	assert_eq(reply.get("error"), XomDaoClient.OFFLINE)
	assert_eq(wait.waiting, 0)
