extends Control
## Bom Nguyên Tố on the Godot client, in the **Hành động** layout (docs/experience.md): the island
## arena fills the middle over its sea; your friend's card sits at the top left under the hub's ☰,
## the clock at the top right with the other players' cards under it, the D-pad at the bottom left
## and Bom, Kỹ năng, Lướt at the bottom right. It draws `snapshot.view` (State in
## src/game/model.ts) and sends `choose {element}`, `ready`, `input {direction, at}`,
## `bomb {at}`, `skill` and `dash`. Keys: WASD or the arrows, Space, E, Shift.
##
## The match has beats: the friend select (select.gd), a 3, 2, 1, the open yard, a paper notice
## when the last minute starts, when the rocks start to fall and when two are left, a line for
## every knockout, the clock ticking red over the last ten seconds, and the game's own end beat
## (`wait_for_result_panel`) before the hub's result.
##
## The match is real time: the server ticks every 100 ms and follows where this screen shows
## you (`at`), so walking feels immediate.
##
## Named nodes for tests: Arena, Select, Pick_<element>, Ready, Pad, Bomb, Skill, Dash, Clock,
## Status, Count, Me, Card_<seat>, Fighter_<seat> (in the arena).

const Rules := preload("res://content/bom-nguyen-to/rules.gd")
const Arena := preload("res://content/bom-nguyen-to/arena.gd")
const Pad := preload("res://content/bom-nguyen-to/pad.gd")
const Action := preload("res://content/bom-nguyen-to/action.gd")
const Card := preload("res://content/bom-nguyen-to/card.gd")
const Select := preload("res://content/bom-nguyen-to/select.gd")
const ART := "res://content/bom-nguyen-to/art/"
const SOUNDS := "count crate dash explode go hurt ko lose pickup place rumble skill thud tick win"
const SAVED := "user://bom-nguyen-to.cfg"
const KEYS: Dictionary = {
	KEY_W: "up",
	KEY_UP: "up",
	KEY_S: "down",
	KEY_DOWN: "down",
	KEY_A: "left",
	KEY_LEFT: "left",
	KEY_D: "right",
	KEY_RIGHT: "right",
}
## Each action: its event, button name, label, ring colour and icon, and how long it recharges.
const ACTIONS: Array = [
	["bomb", "Bomb", "Bom", Color("#B8262A"), "icon-bomb", 400.0],
	["skill", "Skill", "Kỹ năng", Color("#b895ff"), "icon-skill", 14000.0],
	["dash", "Dash", "Lướt", Color("#1E8FA6"), "icon-dash", 5000.0],
]
## The hub's ☰ button keeps the top left square.
const MENU := 88.0
const RESEND_MS := 200.0
## The pointer index the real mouse uses (touches count from 0).
const MOUSE := 100

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
var _me: String = ""

var _arena: Control = Arena.new()
var _pad: Control = Pad.new()
var _actions: Array[Control] = []
var _me_card: Control = Card.new()
var _cards: Array[Control] = []
var _clock := Label.new()
var _clock_plate := Panel.new()
var _status := Label.new()
var _select: Control = Select.new()
var _count := Label.new()
var _notice := PanelContainer.new()
var _notice_text := Label.new()
var _feed := VBoxContainer.new()
var _sounds: Dictionary = {}

## Keys held (latest last) and fingers down: index → "pad" or an action button.
var _keys: Array[String] = []
var _touches: Dictionary = {}
var _touch_dir: Dictionary = {}
var _direction: String = "none"
var _sent: String = "none"
var _sent_at: float = 0.0

## Beats already played this match, and the countdown second last shown.
var _beats: Dictionary = {}
var _counted: int = -1
var _ticked: int = -1
var _picked: bool = false
var _ending: bool = false


## Options for a sandbox room (`?play=bom-nguyen-to` in a debug build): you and one easy bot.
func sandbox_options() -> Dictionary:
	return {"mode": "solo", "total": 2, "bots": 1, "level": "easy"}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults). The friend
## is chosen at the start of every match, not here.
func room_setup() -> Array:
	return [
		{
			"key": "mode",
			"label": "Chế độ",
			"options": [["Sinh tồn", "solo"], ["Đấu đội 2v2", "teams"]],
		},
		{
			"key": "total",
			"label": "Số nhân vật",
			"options": [["1", 1], ["2", 2], ["3", 3], ["4", 4]],
			"default": 3,
		},
		{
			"key": "bots",
			"label": "Máy chơi cùng",
			"options": [["Không", 0], ["1", 1], ["2", 2], ["3", 3]],
			"default": 3,
		},
		{
			"key": "level",
			"label": "Độ khó",
			"options": [["Dễ", "easy"], ["Thường", "normal"], ["Khó", "hard"]],
			"default": 1,
		},
		{
			"key": "friendlyFire",
			"label": "Sát thương đồng đội",
			"options": [["Tắt", false], ["Bật", true]]
		},
	]


## The figures for the hub's result board.
func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or str(_view["phase"]) != "ended":
		return {}
	var rows: Array = []
	var one: Dictionary = Rules.fighter(_view, _me)
	if not one.is_empty():
		rows.append(["Hạ gục", str(int(one["kills"]))])
		rows.append(["Thùng đã phá", str(int(one["crates"]))])
	return {"reason": str(_view.get("reason", "")), "rows": rows}


## The result board in the island's colours.
func result_theme() -> Dictionary:
	return {
		"paper": Color("#FBF1DC"),
		"ink": XomDaoUi.INK,
		"accent": Color("#B8262A"),
		"shade": Color(0.1, 0.07, 0.05, 0.55),
		"title": "Hết trận",
		"emblem": load(ART + "icon-bomb.webp"),
	}


## The end beat: the last blast settles, the winner cheers, a paper notice says how it went, with
## the outcome sound; then the hub's result board.
func wait_for_result_panel() -> void:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or str(_view.get("phase", "")) != "ended" or _ending:
		return
	_ending = true
	_release()
	var winners: Array = _view.get("winners", [])
	var won: bool = winners.has(_me)
	var words: String = "Hoà"
	if not winners.is_empty():
		if _me.is_empty():
			words = "%s thắng" % _name_of(Rules.fighter(_view, str(winners[0])))
			if str(_view.get("mode", "solo")) == "teams":
				words = (
					"Đội %s thắng"
					% ("A" if int(Rules.fighter(_view, str(winners[0]))["team"]) == 0 else "B")
				)
		else:
			words = "Chiến thắng!" if won else "Thua rồi"
	await get_tree().create_timer(0.7).timeout
	if not is_inside_tree():
		return
	for id: Variant in winners:
		_arena.call("celebrate", str(id))
	_play(
		(
			("win" if won else "lose")
			if not _me.is_empty()
			else ("win" if not winners.is_empty() else "lose")
		)
	)
	_say(words, XomDaoUi.GOLD if won else XomDaoUi.CREAM, 1.8)
	await get_tree().create_timer(1.9).timeout


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	_arena.name = "Arena"
	_arena.set_anchors_preset(Control.PRESET_FULL_RECT)
	_arena.connect("cue", _play)
	_arena.connect("knocked", _on_knocked)
	add_child(_arena)
	_me_card.name = "Me"
	_me_card.set("stats", true)
	add_child(_me_card)
	for seat: int in 4:
		var card: Control = Card.new()
		card.name = "Slot_%d" % seat
		card.visible = false
		add_child(card)
		_cards.append(card)
	var plate := StyleBoxFlat.new()
	plate.bg_color = XomDaoUi.HUD
	plate.set_corner_radius_all(28)
	_clock_plate.add_theme_stylebox_override("panel", plate)
	_clock_plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_clock_plate)
	_clock.name = "Clock"
	_hud(_clock, 36)
	_clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_clock.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_child(_clock)
	_status.name = "Status"
	_hud(_status, 24)
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_status)
	_pad.name = "Pad"
	add_child(_pad)
	for spec: Array in ACTIONS:
		var button: Control = Action.create(spec[1], spec[2], spec[3], spec[4])
		button.connect("pressed", _act.bind(spec[0]))
		add_child(button)
		_actions.append(button)
	_actions[1].set("eager", true)
	_feed.alignment = BoxContainer.ALIGNMENT_BEGIN
	_feed.add_theme_constant_override("separation", 6)
	_feed.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_feed)
	_build_notice()
	_count.name = "Count"
	_hud(_count, 150)
	_count.add_theme_constant_override("outline_size", 18)
	_count.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_count.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_count.visible = false
	add_child(_count)
	_select.name = "Select"
	_select.visible = false
	_select.connect("chosen", _choose)
	_select.connect("ready_pressed", _on_ready)
	add_child(_select)
	for sound: String in SOUNDS.split(" "):
		var player := AudioStreamPlayer.new()
		player.bus = XomDaoSettings.SFX_BUS
		player.stream = load("res://content/bom-nguyen-to/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


## The paper notice that slides down from the top middle (art-direction: "Thông báo nhanh").
func _build_notice() -> void:
	var paper: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(Color("#FBF1DC"), Color("#E6D2AA"), XomDaoUi.BORDER, 18)
	)
	paper.content_margin_left = 36
	paper.content_margin_right = 36
	paper.content_margin_top = 8
	paper.content_margin_bottom = 8
	_notice.add_theme_stylebox_override("panel", paper)
	_notice.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_notice.visible = false
	_notice_text.add_theme_font_override("font", XomDaoUi.display_font(800))
	_notice_text.add_theme_font_size_override("font_size", 40)
	_notice_text.add_theme_color_override("font_color", XomDaoUi.INK)
	_notice_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_notice.add_child(_notice_text)
	add_child(_notice)


static func _hud(label: Label, font_size: int) -> void:
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	label.add_theme_color_override("font_outline_color", Color("#2a180c"))
	label.add_theme_constant_override("outline_size", 8)


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary or (snapshot.view as Dictionary).is_empty():
		return
	var viewer: String = str(_client.player_id)
	var me: String = viewer if not Rules.fighter(snapshot.view, viewer).is_empty() else ""
	var fresh: bool = me != _me or _view.is_empty()
	var phase_before: String = str(_view.get("phase", ""))
	if fresh:
		_release()
		_arena.call("reset")
	_me = me
	_view = snapshot.view
	var phase: String = str(_view["phase"])
	if phase == "select" and phase_before != "select":
		_beats.clear()
		_counted = -1
		_ticked = -1
		_picked = false
		_ending = false
		for line: Node in _feed.get_children():
			line.queue_free()
	_arena.set("me", me)
	_arena.call("show_view", _view, not fresh)
	if phase != "playing":
		_release()
	if phase == "playing" and phase_before == "countdown" and not fresh:
		_count.text = "Bắt đầu!"
		_pop(_count)
		_play("go")
		var hide := create_tween()
		hide.tween_interval(0.7)
		hide.tween_property(_count, "modulate:a", 0.0, 0.25)
		hide.tween_callback(_count.hide)
	_show_cards()
	_show_select()
	var hud: bool = phase != "select"
	for node: Control in [_me_card, _clock_plate, _clock, _status, _feed]:
		node.visible = hud
	if not hud:
		for card: Control in _cards:
			card.visible = false
	var playing: bool = phase == "playing"
	var alive: bool = not me.is_empty() and int(Rules.fighter(_view, me)["hp"]) > 0
	var controls: bool = (playing or phase == "countdown") and alive
	_pad.visible = controls
	for button: Control in _actions:
		button.visible = controls
	if playing:
		_beats_now()


func _show_cards() -> void:
	var fighters: Array = _view["fighters"]
	var mine: Dictionary = Rules.fighter(_view, _me)
	_me_card.call("show_fighter", mine, "Bạn" if not mine.is_empty() else "", _view)
	var others: Array = fighters.filter(func(one: Dictionary) -> bool: return str(one["id"]) != _me)
	for i: int in _cards.size():
		var card: Control = _cards[i]
		if i >= others.size():
			card.visible = false
			continue
		var one: Dictionary = others[i]
		card.name = "Card_%d" % int(one["seat"])
		card.call("show_fighter", one, _name_of(one), _view)
	var skill: Control = _actions[1]
	if not mine.is_empty():
		skill.set("rim", Rules.CHARACTERS[str(mine["element"])]["bar"])


func _name_of(one: Dictionary) -> String:
	if one.is_empty():
		return ""
	if bool(one.get("bot", false)):
		return str(Rules.CHARACTERS[str(one["element"])]["name"])
	return str(one["name"])


func _show_select() -> void:
	var choosing: bool = str(_view["phase"]) == "select"
	_select.visible = choosing
	if not choosing:
		return
	_select.call("show_view", _view, _me)
	# Your last friend comes back by itself.
	if not _picked and not _me.is_empty():
		_picked = true
		var saved := ConfigFile.new()
		if saved.load(SAVED) == OK:
			var element: String = str(saved.get_value("pick", "element", ""))
			var mine: Dictionary = Rules.fighter(_view, _me)
			if Rules.ELEMENTS.has(element) and str(mine["element"]) != element:
				_client.send("choose", {"element": element})


## The match's notices: the last minute, the falling rocks, the last two.
func _beats_now() -> void:
	var now: float = _arena.call("now")
	var left: float = Rules.MATCH_TIME - Rules.played(_view, now)
	if left <= 60000.0 and left > 50000.0 and not _beats.has("minute"):
		_beats["minute"] = true
		_say("Còn 1 phút", XomDaoUi.CREAM, 1.4)
	if Rules.closing_in(_view, now) >= 0.0 and int(_view.get("ring", 0)) == 0:
		if not _beats.has("rocks"):
			_beats["rocks"] = true
			_say("Đá lở sắp rơi!", Color("#ffb08a"), 1.8)
	var alive: Array = (_view["fighters"] as Array).filter(
		func(one: Dictionary) -> bool: return int(one["hp"]) > 0
	)
	var sides: Dictionary = {}
	for one: Dictionary in alive:
		sides[one["team"] if str(_view.get("mode", "solo")) == "teams" else one["id"]] = true
	var fighters: int = (_view["fighters"] as Array).size()
	if fighters > 2 and alive.size() == 2 and sides.size() == 2 and not _beats.has("duel"):
		_beats["duel"] = true
		_say("Hai bạn cuối!", XomDaoUi.GOLD, 1.6)


func _on_knocked(victim: Dictionary, by: Dictionary) -> void:
	var line: String = "%s bị hạ" % _name_of(victim)
	if not by.is_empty():
		line = "%s hạ %s" % [_name_of(by), _name_of(victim)]
	if str(victim["id"]) == _me:
		line = "Bạn bị hạ" if by.is_empty() else "%s hạ bạn" % _name_of(by)
	elif str(by.get("id", "")) == _me:
		line = "Bạn hạ %s" % _name_of(victim)
	var chip: XomDaoChip = XomDaoChip.create(line, "", XomDaoUi.HUD)
	chip.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	if str(by.get("id", "")) == _me:
		chip.color = XomDaoUi.LACQUER
	_feed.add_child(chip)
	_feed.move_child(chip, 0)
	while _feed.get_child_count() > 3:
		_feed.get_child(_feed.get_child_count() - 1).queue_free()
		_feed.remove_child(_feed.get_child(_feed.get_child_count() - 1))
	var fade := chip.create_tween()
	fade.tween_interval(4.0)
	fade.tween_property(chip, "modulate:a", 0.0, 0.6)
	fade.tween_callback(chip.queue_free)
	if str(victim["id"]) == _me:
		_say("Bạn đã bị hạ", XomDaoUi.CREAM, 1.6)


## Slides the paper notice down with `text` for `hold` seconds.
func _say(text: String, accent: Color, hold: float) -> void:
	_notice_text.text = text
	var paper: StyleBoxFlat = _notice.get_theme_stylebox("panel")
	paper.border_color = accent.darkened(0.25) if accent != XomDaoUi.CREAM else Color("#E6D2AA")
	paper.set_border_width_all(4 if accent != XomDaoUi.CREAM else 3)
	_notice.visible = true
	_notice.reset_size()
	var width: float = _notice.get_combined_minimum_size().x
	var top: float = float(XomDaoSettings.current().margin) + 104.0
	_notice.position = Vector2((size.x - width) / 2.0, top - 40.0)
	_notice.modulate.a = 0.0
	var tween := _notice.create_tween()
	tween.set_parallel(true)
	tween.tween_property(_notice, "position:y", top, 0.28).set_trans(Tween.TRANS_BACK)
	tween.tween_property(_notice, "modulate:a", 1.0, 0.2)
	tween.chain().tween_interval(hold)
	tween.chain().tween_property(_notice, "modulate:a", 0.0, 0.3)
	tween.chain().tween_callback(_notice.hide)


func _pop(label: Label) -> void:
	label.visible = true
	label.modulate.a = 1.0
	label.pivot_offset = label.size / 2.0
	label.scale = Vector2(1.6, 1.6)
	var tween := label.create_tween()
	tween.tween_property(label, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)


func _process(delta: float) -> void:
	if _view.is_empty():
		return
	var phase: String = str(_view["phase"])
	var playing: bool = phase == "playing"
	var ms: float = Time.get_ticks_msec()
	if _direction != _sent or (_direction != "none" and ms - _sent_at >= RESEND_MS):
		_send_direction()
	_arena.call("step", minf(delta, 0.25), _direction)
	var now: float = _arena.call("now")
	_clock.text = Rules.clock(_view, now)
	if phase == "select":
		_select.call("show_time", now)
	if phase == "countdown":
		var second: int = Rules.countdown(_view, now)
		if second != _counted and second > 0:
			_counted = second
			_count.text = str(second)
			_pop(_count)
			_play("count")
	# The last ten seconds: the clock goes red and ticks.
	var left: float = Rules.MATCH_TIME - Rules.played(_view, now)
	var hurry: bool = playing and left <= 10000.0
	_clock.add_theme_color_override("font_color", Color("#ff8a7a") if hurry else XomDaoUi.CREAM)
	if hurry and ceili(left / 1000.0) != _ticked:
		_ticked = ceili(left / 1000.0)
		_play("tick")
		_clock.pivot_offset = _clock.size / 2.0
		_clock.scale = Vector2(1.25, 1.25)
		_clock.create_tween().tween_property(_clock, "scale", Vector2.ONE, 0.3)
	var mine: Dictionary = Rules.fighter(_view, _me)
	var status: String = ""
	if phase == "select":
		status = "Chọn bạn nhỏ"
	elif playing and not mine.is_empty() and int(mine["hp"]) == 0:
		status = "Đang xem"
	elif playing and int(_view.get("ring", 0)) > 0:
		status = "Đá lở"
	_status.text = status
	if playing:
		_beats_now()
	if mine.is_empty():
		return
	var lefts: Array[float] = [
		maxf(float(mine["nextBomb"]) - now, 0.0),
		maxf(float(mine["skillReady"]) - now, 0.0),
		maxf(float(mine["dashReady"]) - now, 0.0),
	]
	var free: bool = float(mine["frozenUntil"]) <= now and float(mine["stunUntil"]) <= now
	for i: int in _actions.size():
		var button: Control = _actions[i]
		var enabled: bool = _can_act() and lefts[i] <= 0.0 and free
		if i == 0:
			enabled = enabled and Rules.bombs_left(_view, mine) > 0
		button.set("enabled", enabled or (phase == "countdown" and i != 2))
		var glow: bool = i == 1 and float(mine["skillUntil"]) > now
		button.call("show_state", lefts[i], ACTIONS[i][5], glow)


func _can_act() -> bool:
	if _view.is_empty() or str(_view["phase"]) != "playing":
		return false
	var mine: Dictionary = Rules.fighter(_view, _me)
	return not mine.is_empty() and int(mine["hp"]) > 0


# ── Input ─────────────────────────────────────────────────────────────────────────────────


func _unhandled_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or key.echo and not KEYS.has(key.keycode):
		return
	if KEYS.has(key.keycode):
		var dir: String = KEYS[key.keycode]
		_keys.erase(dir)
		if key.pressed:
			_keys.append(dir)
		_refresh()
		get_viewport().set_input_as_handled()
	elif key.pressed and not key.echo:
		match key.keycode:
			KEY_SPACE:
				_act("bomb")
			KEY_E:
				_act("skill")
			KEY_SHIFT:
				_act("dash")
			_:
				return
		get_viewport().set_input_as_handled()


## Fingers and the mouse on the D-pad and the action buttons: every finger on its own, so one
## can hold a direction while another drops a bomb.
func _input(event: InputEvent) -> void:
	if not _can_act():
		return
	var pointer: Array = _pointer(event)
	if pointer.is_empty():
		return
	var index: int = pointer[0]
	var at: Vector2 = pointer[1]
	var down: Variant = pointer[2]
	if down == null:
		if _touches.get(index) is String:
			_touch_dir[index] = _pad.call("direction_at", _local(_pad, at))
			_refresh()
	elif not down:
		var held: Variant = _touches.get(index)
		_touches.erase(index)
		_touch_dir.erase(index)
		if held is Control:
			(held as Control).call("press", false)
		_refresh()
	elif _press(index, at):
		get_viewport().set_input_as_handled()


## [index, position, pressed (null for a move)] of a finger or the real mouse, else [].
static func _pointer(event: InputEvent) -> Array:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		return [touch.index, touch.position, touch.pressed]
	if event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		return [drag.index, drag.position, null]
	if event.device == InputEvent.DEVICE_ID_EMULATION:
		return []
	var button := event as InputEventMouseButton
	if button != null and button.button_index == MOUSE_BUTTON_LEFT:
		return [MOUSE, button.position, button.pressed]
	var motion := event as InputEventMouseMotion
	if motion != null:
		return [MOUSE, motion.position, null]
	return []


## A finger came down: on the D-pad or an action button it is theirs (true).
func _press(index: int, at: Vector2) -> bool:
	if _pad.call("covers", _local(_pad, at)):
		_touches[index] = "pad"
		_touch_dir[index] = _pad.call("direction_at", _local(_pad, at))
		_refresh()
		return true
	for button: Control in _actions:
		if button.call("covers", _local(button, at)):
			_touches[index] = button
			button.call("press", true)
			return true
	return false


static func _local(node: Control, at: Vector2) -> Vector2:
	return node.get_global_transform_with_canvas().affine_inverse() * at


func _refresh() -> void:
	var dir: String = "none"
	for index: Variant in _touch_dir:
		var touched: String = _touch_dir[index]
		if touched != "none" and touched != "":
			dir = touched
	if dir == "none" and not _keys.is_empty():
		dir = _keys[-1]
	_direction = dir if _can_act() else "none"
	_pad.set("held", _direction)
	if _direction != _sent:
		_send_direction()


## Where this screen shows you, sent with your input so the server follows it.
func _at() -> Dictionary:
	if _me.is_empty():
		return {}
	var at: Vector2 = _arena.call("shown_at", _me)
	return {"x": snappedf(at.x, 0.001), "y": snappedf(at.y, 0.001)}


func _send_direction() -> void:
	if not _me.is_empty() and not _view.is_empty() and str(_view["phase"]) == "playing":
		_client.send("input", {"direction": _direction, "at": _at()})
	_sent = _direction
	_sent_at = Time.get_ticks_msec()


func _release() -> void:
	_keys.clear()
	_touch_dir.clear()
	for index: Variant in _touches:
		if _touches[index] is Control:
			(_touches[index] as Control).call("press", false)
	_touches.clear()
	_direction = "none"
	_pad.set("held", "none")
	if _sent != "none":
		_send_direction()


func _act(action: String) -> void:
	if not _can_act():
		return
	# A bomb lands on the cell you see yourself on.
	_client.send(action, {"at": _at()} if action == "bomb" else {})


func _choose(element: String) -> void:
	if _me.is_empty():
		return
	_client.send("choose", {"element": element})
	var saved := ConfigFile.new()
	saved.load(SAVED)
	saved.set_value("pick", "element", element)
	saved.save(SAVED)


func _on_ready() -> void:
	if not _me.is_empty():
		_client.send("ready")


func _play(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sfx and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var top: float = edge
	var bottom: float = size.y - edge
	var column: float = clampf(size.x * 0.17, 200.0, 240.0)
	# Left column: your card under ☰, the D-pad at the bottom.
	_me_card.position = Vector2(left, top + MENU + 10.0)
	_me_card.size = Vector2(column + 20.0, 132.0)
	var pad: float = minf(column, 220.0)
	_pad.position = Vector2(left + (column - pad) / 2.0, bottom - pad)
	_pad.size = Vector2(pad, pad)
	# Right column: the clock, the other players, the knockouts; the actions at the bottom.
	var clock := Vector2(column * 0.78, 64.0)
	_clock_plate.position = Vector2(right - clock.x, top + 12.0)
	_clock_plate.size = clock
	_clock.position = _clock_plate.position
	_clock.size = clock
	_status.position = Vector2(right - column - 140.0, top + 12.0 + clock.y + 2.0)
	_status.size = Vector2(column + 140.0, 30.0)
	var card_h: float = 60.0
	for i: int in _cards.size():
		_cards[i].position = Vector2(
			right - column, top + 12.0 + clock.y + 34.0 + i * (card_h + 8.0)
		)
		_cards[i].size = Vector2(column, card_h)
	var big: float = 118.0
	var small: float = 96.0
	_place(_actions[0], Vector2(right - big, bottom - big), big)
	_place(_actions[1], Vector2(right - big - small - 8.0, bottom - small * 0.85), small)
	_place(_actions[2], Vector2(right - small * 0.92, bottom - big - small - 12.0), small)
	# The arena between the columns, as tall as the screen.
	var area_left: float = left + column + 8.0
	var area_right: float = right - column - 8.0
	_arena.call("fit", Rect2(area_left, top, area_right - area_left, bottom - top))
	_feed.position = Vector2(area_left + 8.0, bottom - 3.0 * 54.0)
	_feed.size = Vector2(area_right - area_left, 3.0 * 54.0)
	_count.position = Vector2(0, size.y * 0.3)
	_count.size = Vector2(size.x, size.y * 0.3)
	_select.position = Vector2.ZERO
	_select.size = size


func _place(button: Control, at: Vector2, side: float) -> void:
	button.position = at
	button.size = Vector2(side, side)
