extends TextureRect
## The named interaction/animation anchor; board_stage.gd draws the Blender model at its foot.

var elevation: float = 0.0


func _ready() -> void:
	self_modulate.a = 0.0
