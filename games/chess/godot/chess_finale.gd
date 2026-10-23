extends Control
## The end beat the hub waits for before its result board (`wait`): the beaten king wobbles and
## tips over onto the board with a thud, gold rings swell round the winning king, and the royal
## banner comes in with how the game ended (CHIẾU HẾT, ĐẦU HÀNG…) and what it means from your
## side (THẮNG RỒI!, THUA RỒI, HOÀ; someone watching reads who won), with the outcome sound and,
## for a win, gold sparks off the winning king. A draw keeps both kings standing. A tap skips it;
## Hiệu ứng: Tắt lays the king down at once and only plays the sound.
##
## `arm()` when the end arrives, `play()` once the last move has landed, `reset()` for a new game.

signal done

enum Step { IDLE, ARMED, PLAYING, DONE }

const ROYAL_CREST = preload("res://content/chess/royal_crest.gd")
const CHESS_EFFECTS = preload("res://content/chess/chess_effects.gd")
const OXBLOOD := Color("#351019")
const BRASS := Color("#D0A74E")
const GLOW := Color("#F3D98C")
## Seconds the banner stays before the result board may come up.
const HOLD := 1.8
const REASONS: Dictionary = {
	"checkmate": "CHIẾU HẾT",
	"stalemate": "HẾT NƯỚC ĐI",
	"resign": "ĐẦU HÀNG",
	"left": "RỜI BÀN",
	"repetition": "LẶP THẾ CỜ",
	"move-limit": "50 NƯỚC",
	"material": "KHÔNG ĐỦ QUÂN",
	"agreement": "HAI BÊN ĐỒNG Ý",
}

var step: Step = Step.IDLE
## The beaten king lies on the board (the table keeps it so on a new layout).
var toppled: bool = false
## Which way it fell: 1 to the right, -1 to the left.
var fall_side: float = 1.0

var _banner := PanelContainer.new()
var _crest := Control.new()
var _crest_piece := TextureRect.new()
var _overline := Label.new()
var _title := Label.new()
var _timeline: Tween
var _sound := Callable()
var _thud := Callable()
var _piece: TextureRect
var _shadow: TextureRect
var _glow_at := Vector2.ZERO
var _glow_size := Vector2.ONE
var _glow: float = -1.0:
	set(value):
		_glow = value
		queue_redraw()


func _init() -> void:
	name = "Finale"
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.name = "EndBanner"
	_banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.visible = false
	var style: StyleBoxFlat = XomDaoUi.box(OXBLOOD, BRASS, 3, 12.0)
	style.content_margin_left = 22.0
	style.content_margin_right = 30.0
	style.content_margin_top = 14.0
	style.content_margin_bottom = 14.0
	style.shadow_color = Color("#0A0507", 0.75)
	style.shadow_size = 16
	style.shadow_offset = Vector2(0, 8)
	_banner.add_theme_stylebox_override("panel", style)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 18)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.add_child(row)
	_crest.set_script(ROYAL_CREST)
	_crest.custom_minimum_size = Vector2(88.0, 96.0)
	_crest.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(_crest)
	_crest_piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_crest_piece.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_crest_piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_crest_piece.position = Vector2(14.0, 34.0)
	_crest_piece.size = Vector2(60.0, 58.0)
	_crest.add_child(_crest_piece)
	var rule := ColorRect.new()
	rule.color = Color("#C99B43")
	rule.custom_minimum_size = Vector2(2.0, 72.0)
	rule.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(rule)
	var copy := VBoxContainer.new()
	copy.alignment = BoxContainer.ALIGNMENT_CENTER
	copy.add_theme_constant_override("separation", 0)
	copy.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(copy)
	_overline.name = "EndReason"
	_overline.add_theme_font_override("font", XomDaoUi.display_font(700))
	_overline.add_theme_font_size_override("font_size", 24)
	_overline.add_theme_color_override("font_color", Color("#E3C685"))
	_overline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	copy.add_child(_overline)
	_title.name = "EndHeadline"
	_title.add_theme_font_override("font", XomDaoUi.display_font(900))
	_title.add_theme_font_size_override("font_size", 52)
	_title.add_theme_color_override("font_color", Color("#FFF2D4"))
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	copy.add_child(_title)
	add_child(_banner)


## A new game: nothing ended yet.
func reset() -> void:
	if _timeline != null:
		_timeline.kill()
	step = Step.IDLE
	toppled = false
	_piece = null
	_shadow = null
	_glow = -1.0
	_banner.visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## The end arrived. `live`: seen as it happened (not on joining a finished table, which skips it).
func arm(live: bool) -> void:
	if step == Step.IDLE:
		step = Step.ARMED if live else Step.DONE


func armed() -> bool:
	return step == Step.ARMED


## Returns once the beat is over (or never had to play).
func wait() -> void:
	while step == Step.ARMED or step == Step.PLAYING:
		await done


## Plays the beat. `spec`: outcome ("win", "lose", "draw", "watch"), headline, reason, board
## (Rect2), crest (the winning king's texture), winner_at and winner_size (the winning king's
## square, or no winner_at), piece and shadow (the beaten king's TextureRects, or null), fall_side,
## effects, sound and thud (Callables for the outcome sound and the king hitting the board).
func play(spec: Dictionary, owner: Control) -> void:
	if step != Step.ARMED:
		return
	step = Step.PLAYING
	_sound = spec["sound"]
	_thud = spec["thud"]
	_piece = spec.get("piece")
	_shadow = spec.get("shadow")
	fall_side = float(spec["fall_side"])
	if not bool(spec["effects"]):
		_land()
		return
	mouse_filter = Control.MOUSE_FILTER_STOP
	_overline.text = REASONS.get(str(spec["reason"]), "VÁN CỜ KHÉP LẠI")
	_title.text = str(spec["headline"]).to_upper()
	_crest_piece.texture = spec.get("crest")
	var board: Rect2 = spec["board"]
	_banner.custom_minimum_size.x = minf(560.0, board.size.x * 0.84)
	_banner.reset_size()
	_banner.pivot_offset = _banner.size / 2.0
	_banner.position = board.get_center() - _banner.size / 2.0
	var winner_at: Variant = spec.get("winner_at")
	if winner_at is Vector2:
		_glow_at = winner_at
		_glow_size = spec["winner_size"]
		# Its own tween: the king's fall and the banner don't wait for the glow.
		create_tween().tween_property(self, "_glow", 1.0, 1.4).from(0.0)
	_timeline = create_tween()
	if _piece != null:
		_timeline.tween_property(_piece, "rotation", -0.12 * fall_side, 0.09)
		_timeline.tween_property(_piece, "rotation", 0.1 * fall_side, 0.09)
		_timeline.tween_callback(_tip)
		_timeline.tween_interval(0.42)
	else:
		_timeline.tween_interval(0.4)
	_timeline.tween_callback(_announce.bind(spec["outcome"] == "win", owner))
	_timeline.tween_interval(HOLD)
	_timeline.tween_callback(_finish)


## The pose of a king lying on its side, from its pose standing on its square.
static func lay_down(piece: TextureRect, shadow: TextureRect, side: float) -> void:
	piece.rotation = 1.42 * side
	piece.position.y += piece.size.y * 0.035
	piece.modulate = Color(0.74, 0.7, 0.68)
	if shadow != null:
		shadow.pivot_offset = shadow.size / 2.0
		shadow.scale = Vector2(1.7, 0.85)
		shadow.position.x += shadow.size.x * 0.45 * side
		shadow.modulate.a = 0.6


## The table's HUD: the ☰ button in the seats' dark walnut with a gold edge.
static func skin() -> XomDaoTableSkin:
	var look := XomDaoTableSkin.new()
	look.round_button = [Color("#2B1A12"), Color("#C9A24E"), Color("#F4E9D4")]
	return look


## Hub hook: the result board in parchment, oxblood and brass, with the royal crest on top.
static func theme(view: Dictionary) -> Dictionary:
	var end: Variant = view.get("end")
	var mate: bool = end is Dictionary and str((end as Dictionary).get("reason", "")) == "checkmate"
	return {
		"paper": Color("#F4E9D4"),
		"ink": Color("#3A1A16"),
		"accent": Color("#7A1A2A"),
		"shade": Color("#110D0C", 0.6),
		"title": "Chiếu hết!" if mate else "Tàn cuộc",
		"emblem": preload("res://content/chess/art/emblem.webp"),
	}


func _gui_input(event: InputEvent) -> void:
	var pressed: bool = (
		(event is InputEventMouseButton and (event as InputEventMouseButton).pressed)
		or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed)
	)
	if pressed and step == Step.PLAYING:
		accept_event()
		_land()


## Straight to the end of the beat: the king down, the sound played, the board free.
func _land() -> void:
	if _timeline != null:
		_timeline.kill()
	if _piece != null and not toppled and is_instance_valid(_piece):
		_piece.rotation = 0.0
		lay_down(_piece, _shadow, fall_side)
		toppled = true
	if _sound.is_valid():
		_sound.call()
		_sound = Callable()
	_finish()


## The king tips over its base and lands with a thud; its shadow slides out along it.
func _tip() -> void:
	if _piece == null or not is_instance_valid(_piece):
		return
	var from_rotation: float = _piece.rotation
	var from_position: Vector2 = _piece.position
	var shadow_from: Vector2 = _shadow.position if _shadow != null else Vector2.ZERO
	_piece.rotation = 0.0
	lay_down(_piece, _shadow, fall_side)
	toppled = true
	var tween: Tween = _piece.create_tween().set_parallel()
	(
		tween
		. tween_property(_piece, "rotation", _piece.rotation, 0.34)
		. from(from_rotation)
		. set_trans(Tween.TRANS_QUAD)
		. set_ease(Tween.EASE_IN)
	)
	tween.tween_property(_piece, "position", _piece.position, 0.34).from(from_position)
	tween.tween_property(_piece, "modulate", _piece.modulate, 0.34).from(Color.WHITE)
	if _shadow != null:
		tween.tween_property(_shadow, "position", _shadow.position, 0.34).from(shadow_from)
		tween.tween_property(_shadow, "scale", _shadow.scale, 0.34).from(Vector2.ONE)
	tween.chain().tween_callback(func() -> void: _thud.call())
	# A small bounce where it lands.
	var landed: float = _piece.rotation
	tween.chain().tween_property(_piece, "rotation", landed - 0.08 * fall_side, 0.07)
	tween.chain().tween_property(_piece, "rotation", landed, 0.09)


## The banner comes in with the outcome sound (and gold sparks off the winner's king on a win).
func _announce(won: bool, owner: Control) -> void:
	_banner.visible = true
	_banner.modulate.a = 0.0
	_banner.scale = Vector2.ONE * 0.9
	var tween: Tween = _banner.create_tween().set_parallel()
	tween.tween_property(_banner, "modulate:a", 1.0, 0.14)
	tween.tween_property(_banner, "scale", Vector2.ONE, 0.32).set_trans(Tween.TRANS_BACK).set_ease(
		Tween.EASE_OUT
	)
	if _sound.is_valid():
		_sound.call()
		_sound = Callable()
	if won and _glow >= 0.0:
		CHESS_EFFECTS.spawn_impact(owner, _glow_at, true)


## The beat is over: the banner fades as the result board comes in.
func _finish() -> void:
	if step == Step.DONE:
		return
	step = Step.DONE
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_glow = -1.0
	if _banner.visible:
		_banner.create_tween().tween_property(_banner, "modulate:a", 0.0, 0.3)
	done.emit()


## Gold rings swelling on the winning king's square, flattened like the board.
func _draw() -> void:
	if _glow < 0.0 or _glow >= 1.0 or step != Step.PLAYING:
		return
	var flat: float = _glow_size.y / maxf(_glow_size.x, 1.0)
	draw_set_transform(_glow_at, 0.0, Vector2(1.0, flat))
	for i: int in 3:
		var t: float = fposmod(_glow * 3.0 + i / 3.0, 1.0)
		var radius: float = _glow_size.x * (0.45 + 0.55 * t)
		draw_arc(Vector2.ZERO, radius, 0.0, TAU, 48, Color(GLOW, 0.9 * (1.0 - t)), 4.0, true)
	draw_set_transform(Vector2.ZERO)
