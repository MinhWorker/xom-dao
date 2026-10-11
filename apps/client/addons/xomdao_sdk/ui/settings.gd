class_name XomDaoSettings
extends RefCounted
## The player's settings, kept in user://settings.cfg: music and sound effects (each on or off,
## with a volume), the HUD scale, the margin to the screen edge and the picture quality. One
## shared instance:
##
##   XomDaoSettings.current().ui_scale
##   XomDaoSettings.current().changed.connect(_on_settings)
## Music plays on the MUSIC_BUS and every sound effect on the SFX_BUS (default_bus_layout.tres):
## give a player `bus = XomDaoSettings.SFX_BUS` and the volume and mute follow by themselves.

signal changed

## Choices offered in the menu (Cài đặt).
const SCALES: Array[float] = [0.7, 0.85]
const MARGINS: Array[int] = [12, 24, 40]
const QUALITIES: Array[String] = ["low", "medium", "high"]
const PATH := "user://settings.cfg"
const MUSIC_BUS := &"Music"
const SFX_BUS := &"Sfx"

static var _current: XomDaoSettings

var music: bool = true
## 0.0 to 1.0.
var music_volume: float = 0.8
## Sound effects: the UI's and every game's.
var sfx: bool = true
var sfx_volume: float = 1.0
## How big the player's HUD is drawn, against the sizes in docs/ui-guide.md: Vừa or Lớn.
var ui_scale: float = 0.7
## Distance in units from the screen edge (or the notch) to the corner buttons.
var margin: int = 24
var quality: String = "high"
## Where the settings are saved ("" keeps them in memory: tests).
var path: String = PATH


## The app's settings, loaded on first use.
static func current() -> XomDaoSettings:
	if _current == null:
		_current = XomDaoSettings.new()
		_current.load_file()
	return _current


func load_file() -> void:
	if path == "":
		return
	var file := ConfigFile.new()
	if file.load(path) != OK:
		return
	# Before music and effects were apart, one "sound" switch muted both.
	var sound: bool = bool(file.get_value("ui", "sound", true))
	music = bool(file.get_value("audio", "music", sound))
	music_volume = clampf(float(file.get_value("audio", "music_volume", music_volume)), 0.0, 1.0)
	sfx = bool(file.get_value("audio", "sfx", sound))
	sfx_volume = clampf(float(file.get_value("audio", "sfx_volume", sfx_volume)), 0.0, 1.0)
	ui_scale = _nearest(float(file.get_value("ui", "scale", ui_scale)))
	var saved_margin: int = int(file.get_value("ui", "margin", margin))
	margin = saved_margin if MARGINS.has(saved_margin) else 24
	var saved_quality: String = str(file.get_value("ui", "quality", quality))
	quality = saved_quality if QUALITIES.has(saved_quality) else "high"
	_apply()


## Changes one setting ("music", "music_volume", "sfx", "sfx_volume", "ui_scale", "margin",
## "quality"), saves and tells listeners.
func set_value(key: String, value: Variant) -> void:
	match key:
		"music":
			music = bool(value)
		"music_volume":
			music_volume = clampf(float(value), 0.0, 1.0)
		"sfx":
			sfx = bool(value)
		"sfx_volume":
			sfx_volume = clampf(float(value), 0.0, 1.0)
		"ui_scale":
			ui_scale = _nearest(float(value))
		"margin":
			margin = int(value) if MARGINS.has(int(value)) else margin
		"quality":
			quality = str(value) if QUALITIES.has(str(value)) else quality
		_:
			push_error("XomDaoSettings: no setting %s" % key)
			return
	_apply()
	save()
	changed.emit()


func save() -> void:
	if path == "":
		return
	var file := ConfigFile.new()
	file.set_value("audio", "music", music)
	file.set_value("audio", "music_volume", music_volume)
	file.set_value("audio", "sfx", sfx)
	file.set_value("audio", "sfx_volume", sfx_volume)
	file.set_value("ui", "scale", ui_scale)
	file.set_value("ui", "margin", margin)
	file.set_value("ui", "quality", quality)
	file.save(path)


func _apply() -> void:
	_apply_bus(MUSIC_BUS, music, music_volume)
	_apply_bus(SFX_BUS, sfx, sfx_volume)


func _apply_bus(bus_name: StringName, on: bool, volume: float) -> void:
	var bus: int = AudioServer.get_bus_index(bus_name)
	if bus < 0:
		return
	AudioServer.set_bus_mute(bus, not on or volume <= 0.0)
	AudioServer.set_bus_volume_db(bus, linear_to_db(maxf(volume, 0.0001)))


func _nearest(value: float) -> float:
	var best: float = SCALES[0]
	for option: float in SCALES:
		if absf(option - value) < absf(best - value):
			best = option
	return best
