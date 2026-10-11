class_name HubGameArt
extends RefCounted
## Lightweight catalog art belongs to the hub, so it is visible before mounting a game pack:
## each game's splash (`art/<id>/splash.webp`) and flat logo (`logo/<id>.svg`), and the object
## that stands for a genre (`logo/genre-<id>.svg`).

const DIR := "res://hub/select/art/"
const LOGOS := "res://hub/select/logo/"


static func splash(id: String) -> Texture2D:
	return _texture(DIR + id + "/splash.webp")


## The game's emblem, drawn over its splash; null for a game without one.
static func logo(id: String) -> Texture2D:
	return _texture(LOGOS + id + ".svg")


## The object of a genre ("co": a rook); a die for a genre without its own.
static func genre(id: String) -> Texture2D:
	var own: Texture2D = _texture(LOGOS + "genre-" + id + ".svg")
	return own if own != null else _texture(LOGOS + "genre-any.svg")


static func _texture(path: String) -> Texture2D:
	return load(path) as Texture2D if ResourceLoader.exists(path) else null
