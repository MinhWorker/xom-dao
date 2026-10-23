extends RefCounted
## Small, non-blocking board effects shared by moves and captures.

static var _spark_texture: Texture2D
static var _shadow_texture: Texture2D


static func castle_rook(from: int, to: int) -> Array:
	var row: int = from / 8
	return [row * 8 + 7, row * 8 + 5] if to > from else [row * 8, row * 8 + 3]


static func action_sounds(last: Dictionary, checked: bool, mate: bool) -> Array[String]:
	var cues: Array[String] = []
	if bool(last.get("castle", false)):
		cues.append("castle")
	if last.get("promotion") != null:
		cues.append("promote")
	if mate:
		cues.append("mate")
	elif checked:
		cues.append("check")
	return cues


static func play_move_sounds(
	owner: Control,
	play_sound: Callable,
	last: Dictionary,
	checked: bool,
	mate: bool,
	captured: bool,
	move_started: bool
) -> void:
	if not move_started:
		play_sound.call("move")
	if captured:
		if not move_started:
			await owner.get_tree().create_timer(0.12).timeout
			if not is_instance_valid(owner) or not play_sound.is_valid():
				return
		play_sound.call("capture")
	var cues: Array[String] = action_sounds(last, checked, mate)
	if cues.is_empty():
		return
	if captured or not move_started:
		await owner.get_tree().create_timer(0.12).timeout
		if not is_instance_valid(owner) or not play_sound.is_valid():
			return
	for i: int in cues.size():
		play_sound.call(cues[i])
		if i < cues.size() - 1:
			await owner.get_tree().create_timer(0.16).timeout
			if not is_instance_valid(owner) or not play_sound.is_valid():
				return


static func animate_capture(
	victim: TextureRect, impact_vector: Vector2, target: Vector2, anchor: Vector2
) -> void:
	victim.pivot_offset = victim.size * anchor
	victim.z_index = 20
	victim.move_to_front()
	var fall_angle: float = 1.08 if impact_vector.x >= 0.0 else -1.08
	if absf(impact_vector.x) < 8.0:
		fall_angle = -1.08 if impact_vector.y < 0.0 else 1.08
	var fall: Tween = victim.create_tween().set_parallel()
	fall.tween_property(victim, "rotation", fall_angle, 0.16).set_trans(Tween.TRANS_QUAD).set_ease(
		Tween.EASE_IN
	)
	fall.tween_property(victim, "position:y", victim.position.y + 3.0, 0.16)
	await fall.finished
	if not is_instance_valid(victim) or not victim.is_inside_tree():
		return
	var away: Tween = victim.create_tween().set_parallel()
	away.tween_property(victim, "position", target, 0.27).set_trans(Tween.TRANS_QUAD).set_ease(
		Tween.EASE_IN
	)
	away.tween_property(victim, "modulate:a", 0.0, 0.27)
	away.tween_property(victim, "scale", Vector2.ONE * 0.3, 0.27)
	away.chain().tween_callback(victim.queue_free)


static func spawn_impact(owner: Control, at: Vector2, promotion: bool) -> void:
	var particles := CPUParticles2D.new()
	particles.name = "PromotionSparks" if promotion else "CaptureSparks"
	particles.one_shot = true
	particles.amount = 20 if promotion else 12
	particles.lifetime = 0.42 if promotion else 0.34
	particles.explosiveness = 0.92
	particles.direction = Vector2.UP
	particles.spread = 180.0
	particles.initial_velocity_min = 34.0 if promotion else 24.0
	particles.initial_velocity_max = 106.0 if promotion else 78.0
	particles.gravity = Vector2(0.0, 54.0)
	particles.scale_amount_min = 1.5
	particles.scale_amount_max = 4.5 if promotion else 3.2
	particles.texture = _get_spark_texture()
	particles.z_index = 24
	var colors := Gradient.new()
	colors.set_color(0, Color("#FFF4C7"))
	colors.add_point(0.48, Color("#E6B84E"))
	colors.set_color(1, Color(0.72, 0.25, 0.08, 0.0))
	particles.color_ramp = colors
	particles.position = at
	owner.add_child(particles)
	particles.emitting = true
	particles.finished.connect(particles.queue_free)


static func _get_spark_texture() -> Texture2D:
	if _spark_texture != null:
		return _spark_texture
	var image := Image.create(20, 20, false, Image.FORMAT_RGBA8)
	for y: int in 20:
		for x: int in 20:
			var distance: float = Vector2(x - 9.5, y - 9.5).length() / 9.5
			var alpha: float = clampf(1.0 - distance, 0.0, 1.0)
			image.set_pixel(x, y, Color(1.0, 0.88, 0.52, alpha * alpha))
	_spark_texture = ImageTexture.create_from_image(image)
	return _spark_texture


## A soft round contact shadow for a piece, made once.
static func piece_shadow_texture() -> Texture2D:
	if _shadow_texture != null:
		return _shadow_texture
	const WIDTH := 96
	const HEIGHT := 64
	var image := Image.create(WIDTH, HEIGHT, false, Image.FORMAT_RGBA8)
	for y: int in HEIGHT:
		for x: int in WIDTH:
			var dx: float = (float(x) + 0.5 - WIDTH * 0.5) / (WIDTH * 0.5)
			var dy: float = (float(y) + 0.5 - HEIGHT * 0.5) / (HEIGHT * 0.5)
			var radius: float = sqrt(dx * dx + dy * dy)
			var alpha: float = pow(maxf(1.0 - radius, 0.0), 2.2) * 0.58
			image.set_pixel(x, y, Color(0.035, 0.022, 0.014, alpha))
	_shadow_texture = ImageTexture.create_from_image(image)
	return _shadow_texture
