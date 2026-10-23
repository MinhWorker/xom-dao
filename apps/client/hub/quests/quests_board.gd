class_name HubQuests
extends Control
## Nhiệm vụ hằng ngày, over the lobby: a board with today's quests (Điểm danh first), each with
## its picture, title, a bar of how far you are ("2/3"), its reward in coins and Nhận (then
## "Đã nhận"); under them, when the quests change. Opened from the Nhiệm vụ shortcut or the gift
## button; tapping the shade or the close mark closes it.
##
## Named for tests: Quests, Quest_<id>, Claim_<id>, QuestsRefresh.

## A reward was paid: the new balances.
signal paid(balances: Dictionary)

const WIDTH := 720.0
## The picture of each kind of quest, by id prefix.
const ICONS: Dictionary = {
	"diem-danh": "calendar-check",
	"choi": "game-controller",
	"thang": "trophy",
	"bai": "cards",
	"co": "crown",
	"nguoi": "users",
}

var _client: XomDaoClient
var _board: XomDaoBoard = XomDaoBoard.create("Nhiệm vụ hằng ngày", true)
var _rows := VBoxContainer.new()
var _refresh := Label.new()
var _claiming: bool = false


## How many of today's quests wait to be claimed (the lobby's red dots); -1 when offline.
static func claimable(client: XomDaoClient) -> int:
	var reply: Dictionary = await client.request(XomDaoProtocol.QUESTS_GET)
	if not bool(reply.get("ok", false)):
		return -1
	var count: int = 0
	for quest: XomDaoQuest in XomDaoQuestBoard.from_dict(reply).quests:
		count += 1 if quest.progress >= quest.goal and not quest.claimed else 0
	return count


## Opens the board over `host`; `on_paid(balances)` hears each reward, `on_closed` its closing.
static func open_over(
	host: Control, client: XomDaoClient, on_paid: Callable, on_closed: Callable
) -> HubQuests:
	var quests := HubQuests.new(client)
	quests.paid.connect(on_paid)
	quests.tree_exited.connect(on_closed)
	host.add_child(quests)
	return quests


## Sets the lobby's quest dots from the server.
static func mark(lobby: HubLobby, client: XomDaoClient) -> void:
	var waiting: int = await claimable(client)
	if is_instance_valid(lobby):
		lobby.show_quests(waiting)


func _init(client: XomDaoClient) -> void:
	name = "Quests"
	_client = client
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.color = Color(XomDaoUi.INK, 0.45)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.gui_input.connect(
		func(event: InputEvent) -> void:
			if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
				queue_free()
	)
	add_child(shade)
	_board.closed.connect(queue_free)
	_board.custom_minimum_size.x = WIDTH
	add_child(_board)
	_rows.add_theme_constant_override("separation", 10)
	_board.content.add_child(_rows)
	_refresh.name = "QuestsRefresh"
	_refresh.theme_type_variation = "SmallLabel"
	_refresh.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_board.content.add_child(_refresh)
	resized.connect(_place)


func _ready() -> void:
	_place()
	_board.open()
	_load()


func _place() -> void:
	_board.reset_size()
	var fit: float = minf(1.0, (size.y - 32.0) / maxf(_board.size.y, 1.0))
	_board.pivot_offset = _board.size / 2.0
	_board.scale = Vector2.ONE * fit
	_board.position = (size - _board.size) / 2.0


func _load() -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.QUESTS_GET)
	if not is_inside_tree():
		return
	if not bool(reply.get("ok", false)):
		_refresh.text = str(reply.get("error", "Không tải được nhiệm vụ"))
		return
	_show(XomDaoQuestBoard.from_dict(reply))


func _show(board: XomDaoQuestBoard) -> void:
	for child: Node in _rows.get_children():
		_rows.remove_child(child)
		child.queue_free()
	for quest: XomDaoQuest in board.quests:
		_rows.add_child(_row(quest))
	var minutes: int = int(board.ends_in / 60000.0)
	_refresh.text = "Đổi nhiệm vụ sau %d giờ %d phút" % [minutes / 60, minutes % 60]
	_place.call_deferred()


func _row(quest: XomDaoQuest) -> Control:
	var done: bool = quest.progress >= quest.goal
	var back := PanelContainer.new()
	back.name = "Quest_%s" % quest.id
	var tint: Color = (
		Color(XomDaoUi.GOLD, 0.22) if done and not quest.claimed else Color(XomDaoUi.INK, 0.06)
	)
	var style: StyleBoxFlat = XomDaoUi.box(tint, Color.TRANSPARENT, 0, 14.0)
	style.set_content_margin_all(10.0)
	back.add_theme_stylebox_override("panel", style)
	back.modulate.a = 0.6 if quest.claimed else 1.0
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	back.add_child(row)
	var picture := TextureRect.new()
	picture.texture = XomDaoUi.icon(_icon_of(quest.id))
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.custom_minimum_size = Vector2.ONE * 48.0
	picture.modulate = XomDaoUi.HONEY_DARK
	picture.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(picture)
	var words := VBoxContainer.new()
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	words.add_theme_constant_override("separation", 4)
	row.add_child(words)
	var title := Label.new()
	title.text = quest.title
	title.add_theme_font_override("font", XomDaoUi.display_font(800))
	words.add_child(title)
	var bar_row := HBoxContainer.new()
	bar_row.add_theme_constant_override("separation", 10)
	words.add_child(bar_row)
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.max_value = quest.goal
	bar.value = quest.progress
	bar.custom_minimum_size = Vector2(220.0, 14.0)
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar.add_theme_stylebox_override(
		"background", XomDaoUi.box(Color(XomDaoUi.INK, 0.15), Color.TRANSPARENT, 0, 7.0)
	)
	bar.add_theme_stylebox_override(
		"fill", XomDaoUi.box(XomDaoUi.GOLD if done else XomDaoUi.HONEY, Color.TRANSPARENT, 0, 7.0)
	)
	bar_row.add_child(bar)
	var count := Label.new()
	count.theme_type_variation = "SmallLabel"
	count.text = "%d/%d" % [quest.progress, quest.goal]
	bar_row.add_child(count)
	var reward := HBoxContainer.new()
	reward.add_theme_constant_override("separation", 6)
	reward.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var coin := XomDaoResourceIcon.new()
	coin.custom_minimum_size = Vector2.ONE * 34.0
	reward.add_child(coin)
	var amount := Label.new()
	amount.text = str(quest.reward)
	amount.add_theme_font_override("font", XomDaoUi.display_font(800))
	reward.add_child(amount)
	row.add_child(reward)
	var claim: XomDaoButton = XomDaoButton.create(
		"Đã nhận" if quest.claimed else "Nhận", XomDaoUi.Kind.CONFIRM
	)
	claim.name = "Claim_%s" % quest.id
	claim.custom_minimum_size = Vector2(150.0, 72.0)
	claim.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	claim.disabled = quest.claimed or not done
	claim.pressed.connect(_claim.bind(quest.id))
	row.add_child(claim)
	return back


static func _icon_of(id: String) -> String:
	for prefix: String in ICONS:
		if id.begins_with(prefix):
			return ICONS[prefix]
	return "star"


func _claim(id: String) -> void:
	if _claiming:
		return
	_claiming = true
	var reply: Dictionary = await _client.request(XomDaoProtocol.QUESTS_CLAIM, {"id": id})
	_claiming = false
	if not is_inside_tree():
		return
	if not bool(reply.get("ok", false)):
		XomDaoToast.show_on(self, str(reply.get("error", "")), "warning")
		return
	var claim := XomDaoQuestClaim.from_dict(reply)
	XomDaoUi.play(self, XomDaoUi.SOUND_COIN)
	paid.emit(claim.balances)
	_show(claim.board)
