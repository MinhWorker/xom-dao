class_name XomDaoLooks
extends RefCounted
## How players show, as the items they wear from Túi đồ (`ITEMS` in packages/shared/src/items.ts):
## their avatar's picture (`XomDaoUser.avatar`, an id of `AVATARS` in account.ts), the frame round
## it (`XomDaoPlayerInfo.frame`) and the back of their cards
## (`card_back`). Each look is a picture in `ui/looks/`; games draw card backs with `card_back`.

const DEFAULT_FRAME := "gold"
const DEFAULT_CARD_BACK := "lattice"
const _DIR := "res://addons/xomdao_sdk/ui/looks/"


## The round picture of an avatar id ("cat"), or null for an unknown or empty one.
static func avatar(id: String) -> Texture2D:
	var path: String = _DIR + "avatar-%s.webp" % id
	return load(path) if id != "" and ResourceLoader.exists(path) else null


## The ring for a frame id ("jade"), or null for none or an unknown one.
static func frame(id: String) -> Texture2D:
	var path: String = _DIR + "frame-%s.webp" % id
	return load(path) if id != "" and ResourceLoader.exists(path) else null


## The back of a card for a card-back id ("lotus"); an unknown or empty id gives the default.
static func card_back(id: String) -> Texture2D:
	var path: String = _DIR + "card-back-%s.webp" % id
	if id == "" or not ResourceLoader.exists(path):
		path = _DIR + "card-back-%s.webp" % DEFAULT_CARD_BACK
	return load(path)


## A shared emote sticker by its look id ("happy", "love"…). Unknown ids return null.
static func emote(id: String) -> Texture2D:
	var path: String = _DIR + "emote-%s.webp" % id
	return load(path) if id != "" and ResourceLoader.exists(path) else null


## The picture of an item for a shelf or a shop: its avatar, frame, card back, or emote.
static func preview(slot: String, look: String) -> Texture2D:
	match slot:
		"avatar":
			return avatar(look)
		"card-back":
			return card_back(look)
		"emote":
			return emote(look)
		_:
			return frame(look)
