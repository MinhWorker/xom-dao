extends TextureRect
## Input anchor for the Blender die rendered by the shared board stage.

var value: int = 1
var tumble := Vector3.ZERO
var ground := Vector2.ZERO
var lift: float = 0.0


func _has_point(point: Vector2) -> bool:
	# The rendered side faces and a forgiving margin belong to the same roll target.
	return Rect2(-size * 0.38, size * 1.76).has_point(point)
