extends RefCounted
## Projects the board and its touch bounds through the camera profile exported by Blender.

const SIZE := 8
const PIECE_HIT_RADIUS := 0.43
const PIECE_HEIGHTS: Dictionary = {
	"k": 1.69,
	"q": 1.51,
	"r": 1.52,
	"b": 1.68,
	"n": 1.49,
	"p": 1.19,
}
const CAMERA_PROFILE = preload("res://content/chess/projection_profile.gd")


static func display_grid(sq: int, flipped: bool) -> Vector2:
	var row: int = sq / SIZE
	var col: int = sq % SIZE
	if flipped:
		row = SIZE - 1 - row
		col = SIZE - 1 - col
	return Vector2(col, row)


static func project_board_point(
	col: float, row: float, board_position: Vector2, board_size: Vector2
) -> Vector2:
	var world_point := _grid_world_point(col, row, float(_profile()["board_surface_z"]))
	return project_world_point(world_point, board_position, board_size)


static func project_world_point(
	world_point: Vector3, board_position: Vector2, board_size: Vector2
) -> Vector2:
	var profile := _profile()
	var camera_position := _vector3(profile["camera_position"])
	var camera_target := _vector3(profile["camera_target"])
	var forward: Vector3 = (camera_target - camera_position).normalized()
	var right: Vector3 = forward.cross(Vector3(0.0, 0.0, 1.0)).normalized()
	var up: Vector3 = right.cross(forward).normalized()
	var camera_space: Vector3 = world_point - camera_position
	var depth: float = camera_space.dot(forward)
	if depth <= 0.0:
		return board_position
	var lens: float = float(profile["lens"])
	var image_x: float = (
		0.5 + camera_space.dot(right) * lens / (float(profile["sensor_width"]) * depth)
	)
	var image_y: float = (
		0.5 - camera_space.dot(up) * lens / (float(profile["sensor_height"]) * depth)
	)
	return board_position + Vector2(image_x * board_size.x, image_y * board_size.y)


static func square_points(
	sq: int, flipped: bool, board_position: Vector2, board_size: Vector2
) -> PackedVector2Array:
	var grid := display_grid(sq, flipped)
	return PackedVector2Array(
		[
			project_board_point(grid.x, grid.y, board_position, board_size),
			project_board_point(grid.x + 1.0, grid.y, board_position, board_size),
			project_board_point(grid.x + 1.0, grid.y + 1.0, board_position, board_size),
			project_board_point(grid.x, grid.y + 1.0, board_position, board_size),
		]
	)


static func square_size(
	sq: int, flipped: bool, board_position: Vector2, board_size: Vector2
) -> Vector2:
	var points := square_points(sq, flipped, board_position, board_size)
	return Vector2(points[0].distance_to(points[1]), points[0].distance_to(points[3]))


static func square_at(
	sq: int, flipped: bool, board_position: Vector2, board_size: Vector2
) -> Vector2:
	return square_points(sq, flipped, board_position, board_size)[0]


static func center_of(
	sq: int, flipped: bool, board_position: Vector2, board_size: Vector2
) -> Vector2:
	var grid := display_grid(sq, flipped)
	return project_board_point(grid.x + 0.5, grid.y + 0.5, board_position, board_size)


static func piece_rect(
	sq: int,
	flipped: bool,
	board_position: Vector2,
	board_size: Vector2,
	disc: float,
	anchor: Vector2
) -> Rect2:
	var profile := _profile()
	var grid := display_grid(sq, flipped)
	var base := _grid_world_point(grid.x + 0.5, grid.y + 0.5, float(profile["piece_base_z"]))
	var side: float = square_size(sq, flipped, board_position, board_size).x * 0.9 / disc
	var center: Vector2 = project_world_point(base, board_position, board_size)
	return Rect2(center - anchor * side, Vector2(side, side))


static func piece_hit_polygon(
	sq: int,
	flipped: bool,
	board_position: Vector2,
	board_size: Vector2,
	radius: float,
	height: float
) -> PackedVector2Array:
	var grid := display_grid(sq, flipped)
	var center_col: float = grid.x + 0.5
	var center_row: float = grid.y + 0.5
	var base_z: float = float(_profile()["piece_base_z"])
	var corners := PackedVector2Array()
	for x_offset: float in [-radius, radius]:
		for y_offset: float in [-radius, radius]:
			for z_offset: float in [0.0, height]:
				var point := _grid_world_point(
					center_col + x_offset * SIZE / _playable_side(),
					center_row - y_offset * SIZE / _playable_side(),
					base_z + z_offset
				)
				corners.append(project_world_point(point, board_position, board_size))
	return Geometry2D.convex_hull(corners)


static func piece_at_visual_point(
	point: Vector2,
	piece_squares: Array,
	letters: Dictionary,
	flipped: bool,
	board_position: Vector2,
	board_size: Vector2
) -> int:
	var order: Array = piece_squares.duplicate()
	# Use the same draw order as the sprites so a foreground piece wins an overlapping tap.
	order.sort_custom(
		func(a: int, b: int) -> bool:
			return (
				square_at(a, flipped, board_position, board_size).y
				> square_at(b, flipped, board_position, board_size).y
			)
	)
	for value: Variant in order:
		var sq: int = int(value)
		if not letters.has(sq):
			continue
		var kind: String = str(letters[sq]).to_lower()
		var height: float = float(PIECE_HEIGHTS.get(kind, 1.5))
		var hit_area: PackedVector2Array = piece_hit_polygon(
			sq, flipped, board_position, board_size, PIECE_HIT_RADIUS, height
		)
		if Geometry2D.is_point_in_polygon(point, hit_area):
			return sq
	return -1


static func square_at_point(
	point: Vector2, flipped: bool, board_position: Vector2, board_size: Vector2
) -> int:
	if board_size.x <= 0.0 or board_size.y <= 0.0:
		return -1
	var image_x: float = (point.x - board_position.x) / board_size.x
	var image_y: float = (point.y - board_position.y) / board_size.y
	if image_x < 0.0 or image_x > 1.0 or image_y < 0.0 or image_y > 1.0:
		return -1
	var profile := _profile()
	var camera_position := _vector3(profile["camera_position"])
	var camera_target := _vector3(profile["camera_target"])
	var forward: Vector3 = (camera_target - camera_position).normalized()
	var right: Vector3 = forward.cross(Vector3(0.0, 0.0, 1.0)).normalized()
	var up: Vector3 = right.cross(forward).normalized()
	var lens: float = float(profile["lens"])
	var ray: Vector3 = (
		forward
		+ right * ((image_x - 0.5) * float(profile["sensor_width"]) / lens)
		+ up * ((0.5 - image_y) * float(profile["sensor_height"]) / lens)
	)
	if is_zero_approx(ray.z):
		return -1
	var distance: float = (float(profile["board_surface_z"]) - camera_position.z) / ray.z
	if distance <= 0.0:
		return -1
	var world_point: Vector3 = camera_position + ray * distance
	var center: Array = profile["board_center"]
	var col_position: float = (
		(world_point.x - float(center[0])) / _playable_side() * SIZE + SIZE / 2.0
	)
	var row_position: float = (
		SIZE / 2.0 - (world_point.y - float(center[1])) / _playable_side() * SIZE
	)
	if col_position < 0.0 or col_position >= SIZE or row_position < 0.0 or row_position >= SIZE:
		return -1
	var col: int = floori(col_position)
	var row: int = floori(row_position)
	if flipped:
		row = SIZE - 1 - row
		col = SIZE - 1 - col
	return row * SIZE + col


static func _grid_world_point(col: float, row: float, z: float) -> Vector3:
	var profile := _profile()
	var center: Array = profile["board_center"]
	var side: float = _playable_side()
	return Vector3(
		float(center[0]) + (col / SIZE - 0.5) * side,
		float(center[1]) + (0.5 - row / SIZE) * side,
		z
	)


static func _playable_side() -> float:
	return float(_profile()["playable_side"])


static func _vector3(values: Array) -> Vector3:
	return Vector3(float(values[0]), float(values[1]), float(values[2]))


static func _profile() -> Dictionary:
	return CAMERA_PROFILE.PROFILE
