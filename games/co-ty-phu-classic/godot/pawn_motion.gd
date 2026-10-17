extends RefCounted
## Move along the actual surface while a separate world-space elevation makes the hop.


static func move(host: Node, pawn: Control, target: Vector2, seconds: float, height: float) -> void:
	var travel: Tween = host.create_tween()
	travel.tween_property(pawn, "position", target, seconds).set_trans(Tween.TRANS_SINE)
	var hop: Tween = host.create_tween()
	(
		hop
		. tween_property(pawn, "elevation", height, seconds / 2.0)
		. set_trans(Tween.TRANS_SINE)
		. set_ease(Tween.EASE_OUT)
	)
	hop.tween_property(pawn, "elevation", 0.0, seconds / 2.0).set_trans(Tween.TRANS_SINE).set_ease(
		Tween.EASE_IN
	)
	await travel.finished
