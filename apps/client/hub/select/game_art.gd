class_name HubGameArt
extends RefCounted
## Lightweight catalog art belongs to the hub, so it is visible before mounting a game pack.

const DIR := "res://hub/select/art/"


static func island(id: String) -> Texture2D:
	return _texture(id + "/island.webp")


static func splash(id: String) -> Texture2D:
	return _texture(id + "/splash.webp")


static func _texture(file: String) -> Texture2D:
	var path: String = DIR + file
	return load(path) as Texture2D if ResourceLoader.exists(path) else null
