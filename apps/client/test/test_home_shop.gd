extends GutTest
## Nhà and Chợ against made-up replies (no server): what each item shows and offers.


func _items(owned: Array) -> Array[XomDaoShopItem]:
	var out: Array[XomDaoShopItem] = []
	for row: Array in [
		["core:frame-gold", "frame", "gold", "Khung vàng", 0],
		["core:frame-jade", "frame", "jade", "Khung ngọc bích", 200],
		["core:card-back-lattice", "card-back", "lattice", "Lưng bài ô trám", 0],
		["core:card-back-lotus", "card-back", "lotus", "Lưng bài hoa sen", 300],
	]:
		(
			out
			. append(
				(
					XomDaoShopItem
					. from_dict(
						{
							"id": row[0],
							"slot": row[1],
							"look": row[2],
							"name": row[3],
							"price": row[4],
							"owned": owned.has(row[0]),
						}
					)
				)
			)
		)
	return out


func _profile(frame: String, owned: Array) -> XomDaoProfile:
	return (
		XomDaoProfile
		. from_dict(
			{
				"id": "minh",
				"name": "Minh",
				"avatar": "boy",
				"frame": frame,
				"cardBack": "lattice",
				"owned": owned,
			}
		)
	)


func test_shop_offers_what_you_lack() -> void:
	var shop: HubShop = add_child_autofree(HubShop.new())
	var owned: Array = ["core:frame-gold", "core:card-back-lattice"]
	shop.show_items(_items(owned), 250)
	assert_null(shop.find_child("Item_frame-gold", true, false), "free items are not for sale")
	var buy: XomDaoButton = shop.find_child("Buy_frame-jade", true, false)
	assert_eq(buy.text, "Mua 200")
	watch_signals(shop)
	buy.pressed.emit()
	assert_signal_emitted_with_parameters(shop, "buy_requested", ["core:frame-jade"])
	(shop.find_child("Tab_card-back", true, false) as Button).pressed.emit()
	await wait_process_frames(1)
	assert_not_null(shop.find_child("Buy_card-back-lotus", true, false))
	shop.show_items(_items(owned + ["core:card-back-lotus"]), 0)
	assert_not_null(shop.find_child("Owned_card-back-lotus", true, false))
	(shop.find_child("Filter_new", true, false) as Button).pressed.emit()
	assert_null(shop.find_child("Item_card-back-lotus", true, false), "owned: not under Chưa có")
	(shop.find_child("Filter_owned", true, false) as Button).pressed.emit()
	assert_not_null(shop.find_child("Item_card-back-lotus", true, false))


func test_shop_grid_takes_as_many_columns_as_fit() -> void:
	var shop: HubShop = add_child_autofree(HubShop.new())
	shop.set_anchors_preset(Control.PRESET_TOP_LEFT)
	shop.size = Vector2(1280.0, 720.0)
	shop.show_items(_items([]), 0)
	assert_eq(shop._grid.columns, 4)
	shop.size = Vector2(900.0, 720.0)
	shop._layout()
	assert_lt(shop._grid.columns, 4)


func test_home_wears_owned_items() -> void:
	var home: HubHome = add_child_autofree(HubHome.new())
	var owned: Array = ["core:frame-gold", "core:frame-jade", "core:card-back-lattice"]
	home.show_profile(_profile("jade", owned), _items(owned))
	assert_null(home.find_child("Item_frame-jade", true, false), "Hồ sơ comes first")
	home.select("tui-do")
	assert_null(home.find_child("Equip_frame-jade", true, false), "the drawer is shut")
	var jade: HubBagCell = home.find_child("Item_frame-jade", true, false)
	var gold: HubBagCell = home.find_child("Item_frame-gold", true, false)
	assert_eq(jade.custom_minimum_size, gold.custom_minimum_size, "every cell the same size")
	assert_true(jade.worn, "the frame you wear is ticked")
	jade.pressed.emit()
	var worn: XomDaoButton = home.find_child("Equip_frame-jade", true, false)
	assert_true(worn.disabled, "the frame you wear")
	assert_eq(worn.text, "Đang dùng")
	assert_eq((home.find_child("ItemName", true, false) as Label).text, jade.item.name)
	assert_eq((home.find_child("ItemKind", true, false) as Label).text, "Khung")
	assert_null(home.find_child("Item_card-back-lotus", true, false), "not owned")
	assert_lt(jade.get_index(), gold.get_index(), "what was bought comes first")
	gold.pressed.emit()
	assert_null(home.find_child("Equip_frame-jade", true, false), "one item in the drawer")
	watch_signals(home)
	(home.find_child("Equip_frame-gold", true, false) as XomDaoButton).pressed.emit()
	assert_signal_emitted_with_parameters(home, "equip_requested", ["core:frame-gold"])
	assert_eq((home.find_child("HomeAvatar", true, false) as XomDaoAvatar).frame, "jade")
	# The kinds in the top right corner keep one slot's items.
	(home.find_child("BagKinds", true, false) as XomDaoChoice).choose(2)
	assert_null(home.find_child("Item_frame-jade", true, false), "frames are filtered out")
	assert_not_null(home.find_child("Item_card-back-lattice", true, false))


func test_home_stacks_its_tabs_left_of_the_page() -> void:
	var settings := XomDaoSettings.new()
	settings.path = ""
	var home: HubHome = add_child_autofree(HubHome.new(settings))
	home.set_anchors_preset(Control.PRESET_TOP_LEFT)
	home.size = XomDaoFrame.SIZE
	await wait_process_frames(2)
	var plate: Control = home.find_child("HomePlate", true, false)
	var above: Control = null
	for id: String in ["ho-so", "tui-do", "thanh-tich", "lich-su"]:
		var tab: Control = home.find_child("Tab_" + id, true, false)
		assert_lt(tab.global_position.x + tab.size.x, plate.global_position.x + 1.0, id)
		if above != null:
			assert_gt(tab.global_position.y, above.global_position.y, "%s is below" % id)
		above = tab
	assert_gt(plate.size.x, home.size.x * 0.6, "the page takes the rest")


func test_someone_elses_home_is_read_only() -> void:
	var home: HubHome = add_child_autofree(HubHome.new(null, false))
	var owned: Array = ["core:frame-gold", "core:card-back-lattice"]
	home.show_profile(_profile("gold", owned), _items(owned))
	home.select("tui-do")
	var cell: HubBagCell = home.find_child("Item_frame-gold", true, false)
	cell.pressed.emit()
	assert_eq((home.find_child("ItemName", true, false) as Label).text, cell.item.name)
	assert_null(home.find_child("Equip_frame-gold", true, false), "nothing to do with it")


func test_looks_have_pictures() -> void:
	assert_not_null(XomDaoLooks.frame("jade"))
	assert_null(XomDaoLooks.frame(""))
	assert_not_null(XomDaoLooks.card_back("lotus"))
	assert_eq(XomDaoLooks.card_back("nope"), XomDaoLooks.card_back("lattice"), "the default back")
