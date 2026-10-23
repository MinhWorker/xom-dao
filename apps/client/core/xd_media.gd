extends Node
## xd's eyes and ears on motion (core/xd_server.gd adds it):
## - the sound log: every play() of an AudioStreamPlayer, with when, what, which bus and how
##   long, heard even while xd keeps the sound muted or there is no sound device;
## - the recorder: frames of the window (or of one area) at a steady rate, kept in memory while
##   recording and written as PNGs when it stops, so saving does not slow the motion down.

## The longest a recording runs before it stops by itself.
const RECORD_MAX_MS := 10_000
const SOUND_LOG_MAX := 500

var _started: int = Time.get_ticks_msec()
var _players: Dictionary = {}
var _sounds: Array[Dictionary] = []
## Where the last `sounds` call stopped reading.
var _read: int = 0
var _recording: Dictionary = {}
var _frames: Array[Dictionary] = []


func _ready() -> void:
	get_tree().node_added.connect(_watch)
	for node: Node in get_tree().root.find_children("*", "", true, false):
		_watch(node)


## Milliseconds since this run started: the clock of the sound log and of recordings.
func now() -> int:
	return Time.get_ticks_msec() - _started


func _watch(node: Node) -> void:
	if node is AudioStreamPlayer or node is AudioStreamPlayer2D or node is AudioStreamPlayer3D:
		_players[node.get_instance_id()] = {"node": node, "playback": 0}


func _process(_delta: float) -> void:
	_listen()
	if not _recording.is_empty():
		_record_frame()


## Every play() makes a new playback at once, with or without a sound device (xvfb has none,
## so `playing` never turns true there): a new playback is a sound starting.
func _listen() -> void:
	for id: int in _players.keys():
		var entry: Dictionary = _players[id]
		var held: Variant = entry["node"]
		if not is_instance_valid(held):
			_players.erase(id)
			continue
		var player: Node = held
		var playback: int = 0
		if player.call("has_stream_playback"):
			playback = (player.call("get_stream_playback") as Object).get_instance_id()
		if playback != 0 and playback != int(entry["playback"]):
			_log_sound(player)
		entry["playback"] = playback


func _log_sound(player: Node) -> void:
	var stream: AudioStream = player.get("stream")
	var path: String = stream.resource_path if stream != null else ""
	(
		_sounds
		. append(
			{
				"t": now(),
				"sound": path.get_file().get_basename(),
				"path": path,
				"seconds": snappedf(stream.get_length(), 0.01) if stream != null else 0.0,
				"bus": str(player.get("bus")),
				"volume_db": snappedf(float(player.get("volume_db")), 0.1),
				"node": str(get_tree().root.get_path_to(player)),
			}
		)
	)
	if _sounds.size() > SOUND_LOG_MAX:
		_sounds.pop_front()
		_read = maxi(0, _read - 1)


## The sounds since the last call (`all` for the whole log); `clear` empties it after.
func sounds(all: bool, clear: bool) -> Array[Dictionary]:
	var out: Array[Dictionary] = _sounds.slice(0 if all else _read)
	_read = _sounds.size()
	if clear:
		_sounds.clear()
		_read = 0
	return out


## The sounds heard between two times of the clock.
func sounds_between(from: int, to: int) -> Array[Dictionary]:
	return _sounds.filter(func(s: Dictionary) -> bool: return s["t"] >= from and s["t"] <= to)


## Starts recording `fps` frames a second, scaled by `scale`, of `area` (an empty Rect2 for the
## whole window).
func record_start(fps: float, scale: float, area: Rect2, max_ms: int) -> void:
	_frames.clear()
	var interval: float = 1000.0 / clampf(fps, 1.0, 30.0)
	_recording = {
		"from": now(),
		"next": float(now()),
		"interval": interval,
		"scale": clampf(scale, 0.1, 1.0),
		"area": area,
		"until": now() + clampi(max_ms, 100, RECORD_MAX_MS),
	}


func is_recording() -> bool:
	return not _recording.is_empty()


func _record_frame() -> void:
	var t: int = now()
	if t > int(_recording["until"]):
		_recording["stopped"] = true
		return
	if t < float(_recording["next"]) or _recording.has("stopped"):
		return
	_recording["next"] = float(_recording["next"]) + float(_recording["interval"])
	var image: Image = get_viewport().get_texture().get_image()
	var area: Rect2 = _recording["area"]
	if area.has_area():
		area = area.intersection(Rect2(Vector2.ZERO, Vector2(image.get_size())))
		if area.has_area():
			image = image.get_region(Rect2i(area))
	var scale: float = _recording["scale"]
	if scale < 1.0:
		var size := Vector2i((Vector2(image.get_size()) * scale).round()).max(Vector2i.ONE)
		image.resize(size.x, size.y, Image.INTERPOLATE_BILINEAR)
	_frames.append({"t": t, "image": image})


## Stops recording and writes the frames into `dir` as frame_<n>.png. Each frame lists the
## sounds that started since the frame before it.
func record_stop(dir: String) -> Dictionary:
	if _recording.is_empty():
		return {}
	var from: int = _recording["from"]
	var to: int = mini(now(), int(_recording["until"]))
	_recording = {}
	DirAccess.make_dir_recursive_absolute(dir)
	var out: Array[Dictionary] = []
	var before: int = from - 1
	for i: int in _frames.size():
		var frame: Dictionary = _frames[i]
		var path: String = dir.path_join("frame_%03d.png" % i)
		(frame["image"] as Image).save_png(path)
		var heard: Array = sounds_between(before + 1, int(frame["t"])).map(
			func(s: Dictionary) -> String: return str(s["sound"])
		)
		out.append({"t": int(frame["t"]) - from, "path": path, "sounds": heard})
		before = frame["t"]
	_frames.clear()
	var late: Array = sounds_between(before + 1, to).map(
		func(s: Dictionary) -> String: return str(s["sound"])
	)
	return {"ms": to - from, "frames": out, "after": late}
