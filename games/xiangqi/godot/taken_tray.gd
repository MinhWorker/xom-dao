class_name XiangqiTakenTray
extends PanelContainer
## A player's tray beside their seat: the discs of the pieces they took, on a dark lacquer plate.
## Hidden while empty; `show_pieces` only rebuilds it when the pieces change.

const COLUMNS := 6
const PIECE := 36.0

var _key: String = ""
var _grid := GridContainer.new()


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false
	var style: StyleBoxFlat = XomDaoUi.box(XomDaoUi.HUD, Color(XomDaoUi.GOLD_DARK, 0.6), 2, 16.0)
	style.set_content_margin_all(6.0)
	add_theme_stylebox_override("panel", style)
	_grid.columns = COLUMNS
	_grid.add_theme_constant_override("h_separation", 2)
	_grid.add_theme_constant_override("v_separation", 2)
	add_child(_grid)


## Shows these pieces as TakenPiece_<i> (`letters` names them, `textures` draws them); true
## when they changed.
func show_pieces(letters: Array[String], textures: Array[Texture2D]) -> bool:
	var key: String = "".join(letters)
	if key == _key:
		return false
	_key = key
	for old: Node in _grid.get_children():
		old.queue_free()
	for i: int in textures.size():
		var texture: Texture2D = textures[i]
		var piece := TextureRect.new()
		piece.name = "TakenPiece_%d" % i
		piece.texture = texture
		piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		piece.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		piece.custom_minimum_size = Vector2.ONE * PIECE
		piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_grid.add_child(piece)
	visible = not letters.is_empty()
	return true
