class_name HubInviteCard
extends CanvasLayer
## A friend asks you to their room: a dark card slides down from the top middle with their
## picture, "<name> mời bạn chơi <game>", Vào and ✕. It leaves by itself after a while.

signal accepted

const STAY := 14.0
const WIDTH := 620.0

var card := PanelContainer.new()


func _init(invite: XomDaoRoomInvite, game: String = "") -> void:
	name = "InviteCard"
	layer = 90
	var holder := Control.new()
	holder.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(holder)
	card.name = "Invite"
	var style: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.NAVY_HUD, XomDaoUi.GOLD, 2, 18.0)
	)
	style.set_content_margin_all(12.0)
	style.content_margin_left = 14.0
	card.add_theme_stylebox_override("panel", style)
	holder.add_child(card)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	card.add_child(row)
	var avatar := XomDaoAvatar.new()
	avatar.custom_minimum_size = Vector2.ONE * 64.0
	avatar.initial = invite.from_name
	avatar.picture = XomDaoLooks.avatar(invite.avatar)
	avatar.frame = invite.frame
	row.add_child(avatar)
	var words := Label.new()
	words.name = "InviteText"
	words.text = (
		"%s mời bạn chơi %s" % [invite.from_name, game]
		if game != ""
		else "%s mời bạn vào phòng" % invite.from_name
	)
	words.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	words.custom_minimum_size.x = 280.0
	words.add_theme_font_override("font", XomDaoUi.display_font(800))
	words.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN + 2)
	words.add_theme_color_override("font_color", XomDaoUi.CREAM)
	words.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(words)
	var go: XomDaoButton = XomDaoButton.create("Vào", XomDaoUi.Kind.CONFIRM)
	go.name = "AcceptInvite"
	go.pressed.connect(_accept)
	row.add_child(go)
	var dismiss: XomDaoIconButton = XomDaoIconButton.create("x")
	dismiss.name = "DismissInvite"
	dismiss.pressed.connect(_leave)
	row.add_child(dismiss)


func _ready() -> void:
	card.custom_minimum_size.x = WIDTH
	card.reset_size()
	var width: float = card.get_parent_control().size.x
	card.position = Vector2((width - card.size.x) / 2.0, -card.size.y - 12.0)
	var tween: Tween = card.create_tween()
	tween.tween_property(card, "position:y", 20.0, 0.3).set_trans(Tween.TRANS_BACK)
	tween.tween_interval(STAY)
	tween.tween_callback(_leave)
	XomDaoUi.play(card, XomDaoUi.SOUND_PANEL)


func _accept() -> void:
	accepted.emit()
	_leave()


func _leave() -> void:
	var tween: Tween = card.create_tween()
	tween.tween_property(card, "position:y", -card.size.y - 12.0, 0.2)
	tween.tween_callback(queue_free)
