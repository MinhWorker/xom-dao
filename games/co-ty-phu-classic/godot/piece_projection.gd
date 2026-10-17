extends RefCounted
## Shared board coordinates: Blender Z-up maps to Godot Y-up.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const FLOOR := 0.035
const RENDER_SIZE := Vector2(1400, 1200)
const CROP := Rect2(35, 145, 1330, 1045)
const CAMERA := Vector3(0, 8.7, 5.7)
const FOV := 26.99146656


static func unproject(p: Vector2) -> Vector2:
	var h: Array[float] = Rules.HOMOGRAPHY
	var a: float = h[0] - p.x * h[6]
	var b: float = h[1] - p.x * h[7]
	var c: float = p.x * h[8] - h[2]
	var d: float = h[3] - p.y * h[6]
	var e: float = h[4] - p.y * h[7]
	var f: float = p.y * h[8] - h[5]
	return Vector2(c * e - b * f, a * f - c * d) / (a * e - b * d)


static func world(board: Control, point: Vector2) -> Vector3:
	var uv: Vector2 = unproject((point - board.position) / board.size)
	return Vector3((uv.x - 0.5) * 4.0, FLOOR, (uv.y - 0.5) * 4.0)


static func face_up(value: int) -> Basis:
	match value:
		2:
			return Basis(Vector3.RIGHT, PI / 2.0)
		3:
			return Basis(Vector3.BACK, PI / 2.0)
		4:
			return Basis(Vector3.BACK, -PI / 2.0)
		5:
			return Basis(Vector3.RIGHT, -PI / 2.0)
		6:
			return Basis(Vector3.RIGHT, PI)
	return Basis.IDENTITY


static func clearance(rotation: Basis) -> float:
	# Support of a unit cube with a 0.095-radius Blender bevel, in world-up direction.
	return 0.405 * (absf(rotation.x.y) + absf(rotation.y.y) + absf(rotation.z.y)) + 0.095


static func pawn_position(
	seat: int, square: int, board: Control, extent: Vector2, jailed: bool
) -> Vector2:
	var u: float = 0.28 + 0.44 * (seat % 2)
	var v: float = 0.35 + 0.41 * floorf(seat / 2.0)
	if square % 10 == 0:
		u = 0.32 + 0.36 * (seat % 2)
		v = 0.24 + 0.28 * floorf(seat / 2.0)
	if square == 10:
		u = (0.57 if jailed else 0.18) + (seat % 2) * 0.20
		v = (0.34 + floorf(seat / 2.0) * 0.25) if jailed else 0.84
	var foot: Vector2 = board.position + Rules.cell_point(square, u, v) * board.size
	return foot - Vector2(extent.x / 2.0, extent.y * 0.92)
