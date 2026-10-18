extends Control
## Silent opaque video behind the board; cover keeps the source's 16:9 aspect on wide phones.

var _still := TextureRect.new()
var _video := VideoStreamPlayer.new()
var _camera_cover := false
var _camera_viewport := Vector2.ZERO
var _camera_focus := Vector2.ZERO
var _camera_target := Vector2.ZERO
var _camera_zoom := 1.0


func _ready() -> void:
	name = "Background"
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_still.texture = preload("res://content/co-ty-phu-classic/art/night-waterfront.webp")
	_still.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_still.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_still.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_still)
	_video.name = "BackgroundVideo"
	_video.stream = load("res://content/co-ty-phu-classic/art/night-waterfront.ogv")
	_video.expand = true
	_video.loop = true
	_video.volume_db = -80.0
	_video.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_video)
	_video.play()
	resized.connect(_layout)
	_layout()


func _input(event: InputEvent) -> void:
	if _video.is_playing():
		return
	if event is InputEventMouseButton and event.pressed:
		_video.play()
	elif event is InputEventScreenTouch and event.pressed:
		_video.play()


func _layout() -> void:
	if _camera_cover:
		_layout_camera_cover()
	else:
		position = Vector2.ZERO
	_layout_layers()


## Expands the background to cover every viewport position along the winner camera move.
func cover_camera_path(
	viewport_size: Vector2, focus: Vector2, target: Vector2, zoom: float
) -> void:
	_camera_cover = true
	_camera_viewport = viewport_size
	_camera_focus = focus
	_camera_target = target
	_camera_zoom = zoom
	_layout()


func clear_camera_cover() -> void:
	_camera_cover = false
	position = Vector2.ZERO
	size = _camera_viewport
	_layout()


func _layout_layers() -> void:
	_still.size = size
	var scale_of: float = maxf(size.x / 1280.0, size.y / 720.0)
	_video.size = Vector2(1280, 720) * scale_of
	_video.position = (size - _video.size) / 2.0


func _layout_camera_cover() -> void:
	if _camera_viewport == Vector2.ZERO:
		return
	var end_min: Vector2 = _camera_focus + (Vector2.ZERO - _camera_target) / _camera_zoom
	var end_max: Vector2 = _camera_focus + (_camera_viewport - _camera_target) / _camera_zoom
	var margin := Vector2(64.0, 64.0)
	var low: Vector2 = Vector2.ZERO.min(end_min) - margin
	var high: Vector2 = _camera_viewport.max(end_max) + margin
	position = low
	size = high - low
