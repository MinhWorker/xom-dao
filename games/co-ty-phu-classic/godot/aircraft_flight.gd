extends Node3D
## Same-camera transport: approach, lift the pawn under the belly, cruise, drop and depart.

const BoardProjection := preload("res://content/co-ty-phu-classic/piece_projection.gd")
const Model := preload("res://content/co-ty-phu-classic/art/aircraft.glb")
var _plane: Node3D
var _board: Control
var _cargo: Control
var _follow: bool = false


func _ready() -> void:
	_plane = Model.instantiate()
	_plane.scale = Vector3.ONE * 0.70
	add_child(_plane)
	hide()


func _foot(pawn: Control) -> Vector3:
	return BoardProjection.world(_board, pawn.position + pawn.size * Vector2(0.5, 0.92))


func _process(_delta: float) -> void:
	if _follow and is_instance_valid(_cargo):
		position = _foot(_cargo) + Vector3.UP * (float(_cargo.get("elevation")) + 0.18)


func play(board: Control, pawn: Control, target: Vector2, landed: Callable = Callable()) -> void:
	_board = board
	_cargo = pawn
	var start: Vector3 = _foot(pawn)
	var destination: Vector3 = BoardProjection.world(board, target + pawn.size * Vector2(0.5, 0.92))
	var heading: Vector3 = (destination - start).normalized()
	if heading.length() < 0.1:
		heading = Vector3.RIGHT
	rotation.y = atan2(-heading.x, -heading.z)
	position = start - heading * 3.0 + Vector3.UP * 0.60
	show()
	var approach: Tween = create_tween()
	approach.tween_property(self, "position", start + Vector3.UP * 0.215, 0.55).set_trans(
		Tween.TRANS_SINE
	)
	await approach.finished
	var pickup: Tween = create_tween()
	pickup.tween_property(pawn, "elevation", 0.035, 0.28).set_trans(Tween.TRANS_SINE)
	await pickup.finished
	_follow = true
	var cruise: Tween = create_tween().set_parallel()
	cruise.tween_property(pawn, "position", target, 1.05).set_trans(Tween.TRANS_SINE)
	cruise.tween_method(
		func(t: float) -> void: pawn.set("elevation", 0.035 + sin(t * PI) * 0.35), 0.0, 1.0, 1.05
	)
	await cruise.finished
	_follow = false
	position = destination + Vector3.UP * 0.215
	var drop: Tween = create_tween()
	drop.tween_property(pawn, "elevation", 0.0, 0.30).set_trans(Tween.TRANS_SINE).set_ease(
		Tween.EASE_IN
	)
	await drop.finished
	var departure: Tween = create_tween()
	(
		departure
		. tween_property(self, "position", destination + heading * 3.0 + Vector3.UP * 0.8, 0.5)
		. set_trans(Tween.TRANS_SINE)
	)
	departure.finished.connect(hide, CONNECT_ONE_SHOT)
	if landed.is_valid():
		await landed.call()
	if departure.is_running():
		await departure.finished
	hide()
	_cargo = null
