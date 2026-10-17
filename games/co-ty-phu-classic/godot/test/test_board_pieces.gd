extends GutTest
## Verify the actual Godot camera against the independent Blender-generated board geometry.

const BoardProjection := preload("res://content/co-ty-phu-classic/piece_projection.gd")
const Draw := preload("res://content/co-ty-phu-classic/surface_draw.gd")
const Rules := preload("res://content/co-ty-phu-classic/rules.gd")


func test_live_camera_matches_the_baked_board_at_every_corner_and_center() -> void:
	var viewport: SubViewport = add_child_autofree(SubViewport.new())
	viewport.size = Vector2i(BoardProjection.RENDER_SIZE)
	var camera := Camera3D.new()
	viewport.add_child(camera)
	camera.position = BoardProjection.CAMERA
	camera.look_at(Vector3(0, -0.02, 0))
	camera.keep_aspect = Camera3D.KEEP_WIDTH
	camera.fov = BoardProjection.FOV
	camera.current = true
	for uv: Vector2 in [Vector2.ZERO, Vector2.RIGHT, Vector2.DOWN, Vector2.ONE, Vector2(0.5, 0.5)]:
		var point := Vector3((uv.x - 0.5) * 4, BoardProjection.FLOOR, (uv.y - 0.5) * 4)
		var actual: Vector2 = (
			(camera.unproject_position(point) - BoardProjection.CROP.position)
			/ BoardProjection.CROP.size
		)
		var expected: Vector2 = Rules.plane_point(uv)
		assert_lt(((actual - expected) * BoardProjection.CROP.size).length(), 0.02, str(uv))


func test_all_six_server_values_put_the_numbered_blender_face_on_top() -> void:
	var normals: Array[Vector3] = [
		Vector3.UP, Vector3.FORWARD, Vector3.RIGHT, Vector3.LEFT, Vector3.BACK, Vector3.DOWN
	]
	for value: int in range(1, 7):
		assert_almost_eq(
			BoardProjection.face_up(value) * normals[value - 1], Vector3.UP, Vector3.ONE * 0.00001
		)


func test_rounded_blender_die_never_cuts_through_the_surface_during_tumble() -> void:
	var models: Node3D = add_child_autofree(
		preload("res://content/co-ty-phu-classic/art/board-pieces.glb").instantiate()
	)
	var die: MeshInstance3D = models.get_node("Die")
	for angles: Vector3 in [Vector3.ZERO, Vector3(1.2, 2.3, 0.7), Vector3(2.4, 0.6, 1.8)]:
		var orientation := Basis.from_euler(angles)
		var minimum: float = INF
		for surface: int in die.mesh.get_surface_count():
			var vertices: PackedVector3Array = die.mesh.surface_get_arrays(surface)[
				Mesh.ARRAY_VERTEX
			]
			for point: Vector3 in vertices:
				minimum = minf(
					minimum, (orientation * point).y + BoardProjection.clearance(orientation)
				)
		assert_gte(minimum, -0.0001, "The lowest vertex remains on or above the board")
		assert_lt(minimum, 0.015, "Contact padding does not leave the die hovering")


func test_ink_card_near_edge_is_longer_than_far_edge_throughout_slide_and_flip() -> void:
	for start: Vector2 in [Vector2(0.245, 0.61), Vector2(0.755, 0.61)]:
		for step: int in range(11):
			var t: float = step / 10.0
			var at: Vector2 = start.lerp(Vector2(0.5, 0.53), t)
			for width: float in [1.0, 0.5, 0.012]:
				var extent := Vector2(width, 1) * (1.0 + t * 0.9) / 1000.0
				var bounds := Rect2(at - Vector2(52, 74) * extent, Vector2(104, 148) * extent)
				var points: PackedVector2Array = Draw.quad(bounds, Vector2(1280, 1006))
				assert_gt(
					points[3].distance_to(points[2]),
					points[0].distance_to(points[1]),
					"The near/bottom edge must be wider"
				)
				var corners: Array[Vector2] = [
					bounds.position,
					Vector2(bounds.end.x, bounds.position.y),
					bounds.end,
					Vector2(bounds.position.x, bounds.end.y)
				]
				for i: int in 4:
					assert_almost_eq(
						points[i],
						Rules.plane_point(corners[i]) * Vector2(1280, 1006),
						Vector2.ONE * 0.001
					)
