extends Node
## Select a fixed frame before the hub starts, and again when the window is resized or rotated.

var _window_size := Vector2i.ZERO


func _ready() -> void:
	_update_frame()


func _process(_delta: float) -> void:
	# With keep, a window resize can change only the bars and emit no viewport size_changed.
	_update_frame()


func _update_frame() -> void:
	var window: Window = get_tree().root
	if window.size == _window_size:
		return
	_window_size = window.size
	var preset: Vector2i = XomDaoFrame.size_for_window(Vector2(window.size))
	if window.content_scale_size != preset:
		window.content_scale_size = preset
