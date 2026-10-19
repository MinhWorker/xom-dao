extends RefCounted
## Maps the screen-space square to its baked, position-aware piece frame.

const SIZE := 8
const ORDER: Dictionary = {"king": 0, "queen": 1, "rook": 2, "bishop": 3, "knight": 4, "pawn": 5}
const ART: Dictionary = {
	"k": "king", "q": "queen", "r": "rook", "b": "bishop", "n": "knight", "p": "pawn"
}
const CELL := 260.0
const GUTTER := 2.0
const FRAME_SIZE := 256.0
const COLUMNS := 8

var _atlases: Dictionary = {}
var _frames: Dictionary = {}


func texture_for(letter: String, square: int, flipped: bool) -> Texture2D:
	var side: String = "white" if letter == letter.to_upper() else "black"
	var kind: String = str(ART[letter.to_lower()])
	var grid := Vector2i(3, 3)
	if square >= 0:
		var row: int = square / SIZE
		var col: int = square % SIZE
		if flipped:
			row = SIZE - 1 - row
			col = SIZE - 1 - col
		grid = Vector2i(col, row)
	var frame_index: int = int(ORDER[kind]) * SIZE + grid.y
	var key: String = "%s:%d" % [side, frame_index]
	if not _frames.has(key):
		var atlas_name: String = "pieces-%s-view" % side
		if not _atlases.has(atlas_name):
			_atlases[atlas_name] = load("res://content/chess/art/%s.webp" % atlas_name)
		var frame := AtlasTexture.new()
		frame.atlas = _atlases[atlas_name]
		frame.filter_clip = true
		var page_column: int = frame_index % COLUMNS
		var page_row: int = frame_index / COLUMNS
		frame.region = Rect2(
			Vector2(page_column, page_row) * CELL + Vector2.ONE * GUTTER, Vector2.ONE * FRAME_SIZE
		)
		_frames[key] = frame
	return _frames[key]
