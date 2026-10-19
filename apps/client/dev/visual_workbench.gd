extends Control
## Isolated visual preview host controlled by tools/godot/preview.mjs over file IPC.
## Preview scenes should contain their own stage, lighting, camera, and object composition.

const STATE_ROOT := "res://.godot/visual-preview"
const DEFAULT_SIZE := Vector2i(960, 540)
const REQUEST_POLL_SECONDS := 0.1
const BACKGROUND := Color("#172b3d")

var _index: int = -1
var _scene_path: String = ""
var _request_path: String = ""
var _result_path: String = ""
var _ready_path: String = ""
var _subject: Node
var _animation_player: AnimationPlayer
var _animated_sprite: AnimatedSprite2D
var _animation_kind: String = ""
var _current_animation: String = ""
var _busy: bool = false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	RenderingServer.set_default_clear_color(BACKGROUND)
	var arguments: Dictionary = _parse_launch_arguments(OS.get_cmdline_user_args())
	_index = int(arguments.get("index", -1))
	_scene_path = str(arguments.get("scene", ""))
	_request_path = "%s/%d/request.json" % [STATE_ROOT, _index]
	_result_path = "%s/%d/result.json" % [STATE_ROOT, _index]
	_ready_path = "%s/%d/ready.json" % [STATE_ROOT, _index]
	_configure_window(arguments)

	var load_result: Dictionary = await _load_subject(_scene_path)
	_write_json(
		_ready_path,
		{
			"ok": bool(load_result.get("ok", false)),
			"index": _index,
			"scene": _scene_path,
			"pid": OS.get_process_id(),
			"error": str(load_result.get("error", "")),
		}
	)

	var timer := Timer.new()
	timer.wait_time = REQUEST_POLL_SECONDS
	timer.timeout.connect(_poll_request)
	add_child(timer)
	timer.start()


func _parse_launch_arguments(arguments: PackedStringArray) -> Dictionary:
	var parsed: Dictionary = {}
	var cursor: int = 0
	while cursor < arguments.size():
		var argument: String = str(arguments[cursor])
		if argument.begins_with("--preview-index="):
			parsed["index"] = argument.trim_prefix("--preview-index=")
		elif argument == "--preview-index" and cursor + 1 < arguments.size():
			cursor += 1
			parsed["index"] = arguments[cursor]
		elif argument.begins_with("--preview-scene="):
			parsed["scene"] = argument.trim_prefix("--preview-scene=")
		elif argument == "--preview-scene" and cursor + 1 < arguments.size():
			cursor += 1
			parsed["scene"] = arguments[cursor]
		elif argument.begins_with("--preview-size="):
			parsed["size"] = argument.trim_prefix("--preview-size=")
		elif argument.begins_with("--preview-position="):
			parsed["position"] = argument.trim_prefix("--preview-position=")
		cursor += 1
	return parsed


func _configure_window(arguments: Dictionary) -> void:
	var window := get_window()
	var size_text: String = str(arguments.get("size", ""))
	var size: Vector2i = DEFAULT_SIZE
	if size_text.contains("x"):
		var pieces: PackedStringArray = size_text.split("x")
		if pieces.size() == 2:
			size = Vector2i(int(pieces[0]), int(pieces[1]))
	window.size = size
	var position_text: String = str(arguments.get("position", ""))
	if position_text.contains(","):
		var coordinates: PackedStringArray = position_text.split(",")
		if coordinates.size() == 2:
			window.position = Vector2i(int(coordinates[0]), int(coordinates[1]))
	window.title = "Xóm Đảo · Preview #%d · %s" % [_index, _scene_path.get_file()]


func _load_subject(path: String) -> Dictionary:
	if not path.begins_with("res://"):
		return {"ok": false, "error": "Preview scene must use a res:// path."}
	var packed_scene: PackedScene = (
		ResourceLoader.load(path, "PackedScene", ResourceLoader.CACHE_MODE_REPLACE_DEEP)
		as PackedScene
	)
	if packed_scene == null:
		return {"ok": false, "error": "Could not load PackedScene: %s" % path}
	var instance: Node = packed_scene.instantiate()
	if instance == null:
		return {"ok": false, "error": "Could not instantiate PackedScene: %s" % path}

	if _subject != null:
		remove_child(_subject)
		_subject.queue_free()
	_subject = instance
	_scene_path = path
	_current_animation = ""
	_animation_kind = ""
	add_child(_subject)
	if _subject is Control:
		(_subject as Control).set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_animation_player = _find_animation_player(_subject)
	_animated_sprite = _find_animated_sprite(_subject)
	await get_tree().process_frame
	return {"ok": true, "scene": _scene_path}


func _find_animation_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child: Node in node.get_children():
		var found: AnimationPlayer = _find_animation_player(child)
		if found != null:
			return found
	return null


func _find_animated_sprite(node: Node) -> AnimatedSprite2D:
	if node is AnimatedSprite2D:
		return node as AnimatedSprite2D
	for child: Node in node.get_children():
		var found: AnimatedSprite2D = _find_animated_sprite(child)
		if found != null:
			return found
	return null


func _poll_request() -> void:
	if _busy or not FileAccess.file_exists(_request_path):
		return
	var file := FileAccess.open(_request_path, FileAccess.READ)
	if file == null:
		return
	var request: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not request is Dictionary:
		_remove_file(_request_path)
		return
	_remove_file(_request_path)
	_busy = true
	var response: Dictionary = await _dispatch(request as Dictionary)
	response["id"] = str(request.get("id", ""))
	_write_json(_result_path, response)
	_busy = false
	if str(request.get("action", "")) == "close":
		get_tree().quit()


func _dispatch(request: Dictionary) -> Dictionary:
	var action: String = str(request.get("action", ""))
	var response: Dictionary = {}
	match action:
		"open":
			var path: String = str(request.get("scene", ""))
			response = await _load_subject(path)
			if response.get("ok", false):
				get_window().title = "Xóm Đảo · Preview #%d · %s" % [_index, path.get_file()]
		"resize":
			var size: Dictionary = request.get("size", {})
			get_window().size = Vector2i(
				int(size.get("width", DEFAULT_SIZE.x)), int(size.get("height", DEFAULT_SIZE.y))
			)
			var position: Dictionary = request.get("position", {})
			get_window().position = Vector2i(int(position.get("x", 0)), int(position.get("y", 0)))
			response = {"ok": true, "size": size, "position": position}
		"refresh":
			response = await _load_subject(_scene_path)
		"inspect":
			response = _inspect()
		"play":
			response = _play(str(request.get("animation", "")))
		"pause":
			response = _pause()
		"resume":
			response = _resume()
		"seek":
			response = _seek(float(request.get("seconds", 0.0)))
		"capture":
			response = await _capture(str(request.get("output", "")))
		"capture_sequence":
			response = await _capture_sequence(request)
		"close":
			response = {"ok": true, "closed": true}
		_:
			response = {"ok": false, "error": "Unknown preview action: %s" % action}
	return response


func _inspect() -> Dictionary:
	var animations: Array[String] = []
	var animation_position: float = 0.0
	var is_playing: bool = false
	if _animation_kind == "sprite" and _animated_sprite != null:
		animations = _sprite_animation_names()
		animation_position = _sprite_animation_position()
		is_playing = _animated_sprite.is_playing()
	elif _animation_player != null:
		for animation_name: String in _animation_player.get_animation_list():
			animations.append(str(animation_name))
		animation_position = _animation_player.current_animation_position
		is_playing = _animation_player.is_playing()
	elif _animated_sprite != null:
		animations = _sprite_animation_names()
		animation_position = _sprite_animation_position()
		is_playing = _animated_sprite.is_playing()
	return {
		"ok": true,
		"index": _index,
		"scene": _scene_path,
		"animation": _current_animation,
		"animation_kind": _animation_kind,
		"playing": is_playing,
		"position": animation_position,
		"animations": animations,
	}


func _sprite_animation_names() -> Array[String]:
	var animations: Array[String] = []
	if _animated_sprite == null or _animated_sprite.sprite_frames == null:
		return animations
	for animation_name: String in _animated_sprite.sprite_frames.get_animation_names():
		animations.append(animation_name)
	return animations


func _sprite_animation_position() -> float:
	if _animated_sprite == null or _animated_sprite.sprite_frames == null:
		return 0.0
	var fps: float = _animated_sprite.sprite_frames.get_animation_speed(_current_animation)
	if fps <= 0.0:
		return 0.0
	return (float(_animated_sprite.frame) + _animated_sprite.frame_progress) / fps


func _play(animation_name: String) -> Dictionary:
	if animation_name.is_empty():
		if _animation_player != null and not _animation_player.get_animation_list().is_empty():
			animation_name = str(_animation_player.get_animation_list()[0])
		elif not _sprite_animation_names().is_empty():
			animation_name = _sprite_animation_names()[0]
		else:
			return {
				"ok": false, "error": "No AnimationPlayer or AnimatedSprite2D animations found."
			}
	if _animation_player != null and _animation_player.has_animation(animation_name):
		_animation_kind = "player"
		_animation_player.play(animation_name)
	elif (
		_animated_sprite != null
		and _animated_sprite.sprite_frames != null
		and _animated_sprite.sprite_frames.has_animation(animation_name)
	):
		_animation_kind = "sprite"
		_animated_sprite.animation = animation_name
		_animated_sprite.play()
	else:
		return {"ok": false, "error": "Animation not found: %s" % animation_name}
	_current_animation = animation_name
	return {"ok": true, "animation": _current_animation}


func _pause() -> Dictionary:
	if (
		_animation_kind == "sprite"
		or (_animation_kind.is_empty() and _animation_player == null and _animated_sprite != null)
	):
		_animation_kind = "sprite"
		if _current_animation.is_empty() and _animated_sprite != null:
			_current_animation = str(_animated_sprite.animation)
		if _animated_sprite == null:
			return {"ok": false, "error": "No animation is available in this preview scene."}
		_animated_sprite.pause()
	elif _animation_player != null:
		_animation_player.pause()
	else:
		return {"ok": false, "error": "No animation is available in this preview scene."}
	return {"ok": true, "animation": _current_animation}


func _resume() -> Dictionary:
	if _current_animation.is_empty():
		return _play("")
	if _animation_kind == "sprite" and _animated_sprite != null:
		_animated_sprite.play()
	elif _animation_player != null:
		_animation_player.play()
	else:
		return {"ok": false, "error": "No animation is available in this preview scene."}
	return {"ok": true, "animation": _current_animation}


func _seek(seconds: float) -> Dictionary:
	if _current_animation.is_empty():
		var play_result: Dictionary = _play("")
		if not play_result.get("ok", false):
			return play_result
	if (
		_animation_kind == "sprite"
		and _animated_sprite != null
		and _animated_sprite.sprite_frames != null
	):
		var fps: float = _animated_sprite.sprite_frames.get_animation_speed(_current_animation)
		var frame_count: int = _animated_sprite.sprite_frames.get_frame_count(_current_animation)
		if fps <= 0.0 or frame_count <= 0:
			return {"ok": false, "error": "Animation has no frames or playback speed."}
		var frame_position: float = maxf(seconds, 0.0) * fps
		if _animated_sprite.sprite_frames.get_animation_loop(_current_animation):
			frame_position = fmod(frame_position, float(frame_count))
		else:
			frame_position = minf(frame_position, float(frame_count - 1))
		var frame_index: int = floori(frame_position)
		_animated_sprite.set_frame_and_progress(frame_index, frame_position - float(frame_index))
	elif _animation_player != null:
		_animation_player.seek(maxf(seconds, 0.0), true)
	else:
		return {"ok": false, "error": "No animation is available in this preview scene."}
	return {
		"ok": true,
		"animation": _current_animation,
		"position":
		(
			_sprite_animation_position()
			if _animation_kind == "sprite"
			else _animation_player.current_animation_position
		),
	}


func _capture(output: String) -> Dictionary:
	if output.is_empty():
		return {"ok": false, "error": "Capture output path is empty."}
	await RenderingServer.frame_post_draw
	var image: Image = get_viewport().get_texture().get_image()
	var error: Error = image.save_png(output)
	return {
		"ok": error == OK,
		"output": output,
		"width": image.get_width(),
		"height": image.get_height(),
		"error": "" if error == OK else "save_png returned error %d" % error,
	}


func _capture_sequence(request: Dictionary) -> Dictionary:
	var animation_name: String = str(request.get("animation", ""))
	var duration: float = maxf(float(request.get("duration", 1.0)), 0.0)
	var frame_count: int = clampi(int(request.get("frames", 6)), 2, 24)
	var output_dir: String = str(request.get("output_dir", ""))
	var failure: Dictionary = {}
	if output_dir.is_empty():
		failure = {"ok": false, "error": "Sequence output directory is empty."}
	elif _animation_player == null and _animated_sprite == null:
		failure = {
			"ok": false, "error": "No AnimationPlayer or AnimatedSprite2D found in preview scene."
		}
	if failure.is_empty():
		if not animation_name.is_empty():
			var play_result: Dictionary = _play(animation_name)
			if not play_result.get("ok", false):
				failure = play_result
		elif _current_animation.is_empty():
			var default_play_result: Dictionary = _play("")
			if not default_play_result.get("ok", false):
				failure = default_play_result

	if failure.is_empty():
		var directory_error: Error = DirAccess.make_dir_recursive_absolute(output_dir)
		if directory_error != OK:
			failure = {
				"ok": false,
				"error": "Could not create sequence directory: %s" % output_dir,
			}
	var paths: Array[String] = []
	if failure.is_empty():
		for frame_index: int in range(frame_count):
			var seconds: float = duration * float(frame_index) / float(frame_count - 1)
			var seek_result: Dictionary = _seek(seconds)
			if not seek_result.get("ok", false):
				failure = seek_result
				break
			await RenderingServer.frame_post_draw
			var image: Image = get_viewport().get_texture().get_image()
			var output: String = output_dir.path_join("frame-%02d.png" % frame_index)
			var error: Error = image.save_png(output)
			if error != OK:
				failure = {
					"ok": false,
					"error": "Could not save frame %d (error %d)." % [frame_index, error],
				}
				break
			paths.append(output)
	if not failure.is_empty():
		return failure
	return {
		"ok": true,
		"animation": _current_animation,
		"duration": duration,
		"frames": paths,
	}


func _write_json(path: String, value: Dictionary) -> void:
	var absolute_path: String = ProjectSettings.globalize_path(path)
	var temporary_path: String = absolute_path + ".tmp"
	var file := FileAccess.open(temporary_path, FileAccess.WRITE)
	if file == null:
		push_error("Could not write preview IPC file: %s" % temporary_path)
		return
	file.store_string(JSON.stringify(value))
	file.close()
	_remove_file(absolute_path)
	var error: Error = DirAccess.rename_absolute(temporary_path, absolute_path)
	if error != OK:
		push_error("Could not publish preview IPC file: %s" % absolute_path)


func _remove_file(path: String) -> void:
	var absolute_path: String = path
	if not path.is_absolute_path():
		absolute_path = ProjectSettings.globalize_path(path)
	if FileAccess.file_exists(absolute_path):
		DirAccess.remove_absolute(absolute_path)
