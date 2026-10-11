extends Control
## Cờ tỷ phú's dice throw, after the old board's Dice3D: the two dice fly in on one of four paths
## (tumble, arc, skipping, spiral), spinning and showing faces as they turn, their shadows shrink
## as they lift, and both settle on the server's faces. The notice then shows the sum for a
## moment. This control covers the table and draws the shadows; main.gd owns the dice.

const MOTIONS: Array[String] = ["tumble", "arc", "skipping", "spiral"]
## How long a throw takes, and how long the sum stays.
const SECONDS := 1.08
const RESULT_SECONDS := 0.7
const SHADOW := Color("#644424")
## Turns each die makes on each path.
const TURNS: Dictionary = {
	"tumble": [3.35, 3.7], "arc": [2.8, 3.4], "skipping": [4.6, 4.1], "spiral": [4.2, 4.8]
}

var dice: Array[TextureRect] = []
var faces: Array[Texture2D] = []

## The throw now: its path, its progress (0–1) and where the dice rest; empty when still.
var _motion: String = ""
var _progress: float = 1.0
var _rest: Array[Vector2] = []


## Where die `index` (0 or 1) is on `motion` at `progress` (0–1), in half die widths: `x` aside,
## `lift` up, and `spin`, the angle still to turn. Every path ends at {0, 0, 0}.
static func pose(motion: String, index: int, progress: float) -> Dictionary:
	var t: float = clampf(progress, 0.0, 1.0)
	var remaining: float = 1.0 - t
	var side: float = -1.0 if index == 0 else 1.0
	var x: float
	var lift: float
	match motion:
		"arc":
			x = side * (2.7 * remaining - sin(t * PI) * remaining)
			lift = sin(t * PI) * 3.3 + remaining * 0.8
		"skipping":
			x = side * remaining * (2.2 + sin(t * PI * 4.0) * 0.65)
			lift = absf(sin(t * PI * 5.0)) * remaining * 2.0 + remaining * 0.4
		"spiral":
			x = sin(t * PI * 3.0) * remaining * 1.1 + side * remaining * 1.5
			lift = remaining * (1.8 + sin(t * PI * 3.0 + index * PI) * 0.7)
		_:
			x = side * 1.5 * remaining
			lift = absf(sin(t * PI * 3.3)) * remaining * 1.5 + remaining * 1.2
	if t >= 1.0:
		x = 0.0
		lift = 0.0
	var turns: float = float(TURNS.get(motion, TURNS["tumble"])[index])
	return {"x": x, "lift": lift, "spin": TAU * turns * remaining * remaining}


## "3 + 4 = 7".
static func sum_text(values: Array) -> String:
	var a: int = int(values[0])
	var b: int = int(values[1])
	return "%d + %d = %d" % [a, b, a + b]


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


## Throws the dice to `values`; `notice` says who throws, then the sum.
func roll(values: Array, notice: Label, who: String) -> void:
	_motion = MOTIONS[randi() % MOTIONS.size()]
	_rest.clear()
	for die: TextureRect in dice:
		_rest.append(die.position)
	notice.text = "%s gieo xúc xắc" % who
	var start: int = Time.get_ticks_msec()
	var shown: Array[int] = [-1, -1]
	_progress = 0.0
	while _progress < 1.0:
		_progress = minf(1.0, (Time.get_ticks_msec() - start) / (SECONDS * 1000.0))
		for k: int in dice.size():
			var at: Dictionary = pose(_motion, k, _progress)
			var die: TextureRect = dice[k]
			var unit: float = die.size.x / 2.0
			die.position = _rest[k] + Vector2(float(at["x"]), -float(at["lift"])) * unit
			var spin: float = float(at["spin"])
			die.rotation = fmod(spin, TAU)
			# A new face shows each quarter turn; the last one is the server's.
			var quarter: int = floori(spin / (PI / 2.0))
			if _progress >= 1.0:
				die.texture = faces[clampi(int(values[k]), 1, 6) - 1]
			elif quarter != shown[k]:
				shown[k] = quarter
				die.texture = faces[randi() % 6]
			die.scale = Vector2(1.0, 1.0 - 0.18 * absf(sin(spin * 2.0)))
		queue_redraw()
		await get_tree().process_frame
		if not is_inside_tree():
			return
	for k: int in dice.size():
		dice[k].position = _rest[k]
		dice[k].rotation = 0.0
		dice[k].scale = Vector2.ONE
		XomDaoUi.bounce(dice[k])
	_motion = ""
	queue_redraw()
	notice.text = sum_text(values)
	await get_tree().create_timer(RESULT_SECONDS).timeout


func _draw() -> void:
	for k: int in dice.size():
		var die: TextureRect = dice[k]
		if not die.visible:
			continue
		var lift: float = 0.0
		var x: float = 0.0
		var rest: Vector2 = die.position
		if _motion != "" and k < _rest.size():
			var at: Dictionary = pose(_motion, k, _progress)
			lift = float(at["lift"])
			x = float(at["x"])
			rest = _rest[k]
		var unit: float = die.size.x / 2.0
		var shrink: float = 1.0 / (1.0 + lift * 0.3)
		var middle: Vector2 = rest + Vector2(unit + x * unit, die.size.y * 0.96)
		draw_set_transform(middle, 0.0, Vector2(1.0, 0.28))
		draw_circle(Vector2.ZERO, unit * 1.1 * shrink, Color(SHADOW, 0.22 * shrink))
	draw_set_transform(Vector2.ZERO)
