extends Control
## Board-surface notifications and event confirmation; the 3D stage draws above this ink.

const Draw := preload("res://content/co-ty-phu-classic/surface_draw.gd")
var source: Label
var status_source: Label
var confirmation: bool = false
var heading: String = ""
var description: String = ""
var _font: FontVariation


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = XomDaoUi.display_font(800).duplicate() as FontVariation
	var file: FontFile = _font.base_font.duplicate() as FontFile
	file.generate_mipmaps = true
	_font.base_font = file
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	if confirmation:
		Draw.text(self, _font, heading, Vector2(0.5, 0.425), 0.042, 0.42)
		Draw.paragraph(self, _font, description, Vector2(0.5, 0.555), 0.035, 0.40)
	else:
		if source != null and not source.text.is_empty():
			Draw.paragraph(self, _font, source.text, Vector2(0.5, 0.42), 0.033, 0.56, 3)
		if status_source != null and not status_source.text.is_empty():
			Draw.text(
				self,
				_font,
				Draw.clean(status_source.text),
				Vector2(0.5, 0.655),
				0.029,
				0.40,
				Color(XomDaoUi.LACQUER_DARK, status_source.modulate.a)
			)
