extends Control
## Blender-authored dice and small pawns share the exact board camera and contact plane.

const BoardProjection := preload("res://content/co-ty-phu-classic/piece_projection.gd")
const Models := preload("res://content/co-ty-phu-classic/art/board-pieces.glb")
const Shadow := preload("res://content/co-ty-phu-classic/piece_shadow.gdshader")
const COLORS: Array[String] = ["red", "blue", "green", "yellow"]
const PAWN_SCALE := 0.09

var aircraft: Node3D = preload("res://content/co-ty-phu-classic/aircraft_flight.gd").new()
var host: Control
var _viewport := SubViewport.new()
var _surface := TextureRect.new()
var _atlas := AtlasTexture.new()
var _world := Node3D.new()
var _camera := Camera3D.new()
var _pawns: Array[Node3D] = []
var _dice: Array[Node3D] = []
var _pawn_shadows: Array[MeshInstance3D] = []
var _die_shadows: Array[MeshInstance3D] = []
var _force_render: bool = true
var _stage_visible: bool = false
var _aircraft_visible: bool = false


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_viewport.transparent_bg = true
	_viewport.own_world_3d = true
	_viewport.handle_input_locally = false
	_viewport.msaa_3d = Viewport.MSAA_4X
	_viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
	_viewport.size = Vector2i(1400, 1200)
	add_child(_viewport)
	_viewport.add_child(_world)
	_world.add_child(_camera)
	_world.add_child(aircraft)
	_camera.position = BoardProjection.CAMERA
	_camera.look_at(Vector3(0, -0.02, 0))
	_camera.keep_aspect = Camera3D.KEEP_WIDTH
	_camera.fov = BoardProjection.FOV
	_camera.current = true
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_CLEAR_COLOR
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("#DDE7E5")
	environment.environment.ambient_light_energy = 0.65
	_world.add_child(environment)
	_light(Vector3(-3.5, 7, 4), 0.85)
	_light(Vector3(4, 5, -2), 0.30)
	var models: Node3D = Models.instantiate()
	_world.add_child(models)
	for color: String in COLORS:
		var pawn: Node3D = models.get_node("Pawn_" + color)
		pawn.scale = Vector3.ONE * PAWN_SCALE
		_pawns.append(pawn)
		_pawn_shadows.append(_shadow())
	var die: Node3D = models.get_node("Die")
	_dice.append(die)
	var second: Node3D = die.duplicate()
	models.add_child(second)
	_dice.append(second)
	for k: int in 2:
		_die_shadows.append(_shadow())
	_atlas.atlas = _viewport.get_texture()
	_surface.texture = _atlas
	_surface.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_surface.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_surface.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(_surface)


func _light(at: Vector3, energy: float) -> void:
	var light := DirectionalLight3D.new()
	_world.add_child(light)
	light.position = at
	light.look_at(Vector3.ZERO)
	light.light_energy = energy


func _shadow() -> MeshInstance3D:
	var shadow := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2.ONE * 2.0
	shadow.mesh = plane
	var material := ShaderMaterial.new()
	material.shader = Shadow
	shadow.material_override = material
	shadow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_world.add_child(shadow)
	return shadow


func _process(_delta: float) -> void:
	if not is_visible_in_tree():
		_stage_visible = false
		_force_render = true
		_viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
		return
	if not _stage_visible:
		_force_render = true
	_stage_visible = true
	if host == null:
		_viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
		return
	var board: Control = host.get("board")
	if board == null or board.size.x <= 0.0:
		_force_render = true
		_viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
		return
	var density: float = clampf(board.size.x * 1.5 / BoardProjection.CROP.size.x, 0.5, 2.0)
	var changed: bool = false
	var target_size := Vector2i((BoardProjection.RENDER_SIZE * density).round())
	if _viewport.size != target_size:
		_viewport.size = target_size
		changed = true
	var actual: Vector2 = Vector2(_viewport.size) / BoardProjection.RENDER_SIZE
	var region := Rect2(BoardProjection.CROP.position * actual, BoardProjection.CROP.size * actual)
	if _atlas.region != region:
		_atlas.region = region
		changed = true
	if _surface.position != board.position:
		_surface.position = board.position
	if _surface.size != board.size:
		_surface.size = board.size
	if _sync_pawns(board):
		changed = true
	if _sync_dice(board):
		changed = true
	if aircraft.visible:
		changed = true
	if _aircraft_visible != aircraft.visible:
		changed = true
	_aircraft_visible = aircraft.visible
	if changed or _force_render:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
		_force_render = false
	else:
		_viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED


func _sync_pawns(board: Control) -> bool:
	var changed: bool = false
	var anchors: Array = host.get("pawns")
	for seat: int in 4:
		var active: bool = seat < anchors.size() and (anchors[seat] as Control).visible
		if _pawns[seat].visible != active:
			_pawns[seat].visible = active
			changed = true
		if _pawn_shadows[seat].visible != active:
			_pawn_shadows[seat].visible = active
			changed = true
		if not active:
			continue
		var anchor: Control = anchors[seat]
		var foot: Vector2 = anchor.position + Vector2(anchor.size.x / 2.0, anchor.size.y * 0.92)
		var ground: Vector3 = BoardProjection.world(board, foot)
		var height: float = anchor.get("elevation")
		var pawn_position := ground + Vector3.UP * height
		if _pawns[seat].position != pawn_position:
			_pawns[seat].position = pawn_position
			changed = true
		if _contact(_pawn_shadows[seat], ground, 0.065, height):
			changed = true
	return changed


func _sync_dice(board: Control) -> bool:
	var changed: bool = false
	var anchors: Array = host.get("dice")
	for k: int in mini(2, anchors.size()):
		var anchor: Control = anchors[k]
		if _dice[k].visible != anchor.visible:
			_dice[k].visible = anchor.visible
			changed = true
		if _die_shadows[k].visible != anchor.visible:
			_die_shadows[k].visible = anchor.visible
			changed = true
		var foot: Vector2 = anchor.get("ground")
		var ground: Vector3 = BoardProjection.world(board, foot)
		var edge: float = ground.distance_to(
			BoardProjection.world(board, foot + Vector2(anchor.size.x * 0.66, 0))
		)
		var height: float = float(anchor.get("lift")) * edge * 0.8
		var orientation: Basis = (
			Basis.from_euler(anchor.get("tumble"))
			* Basis(Vector3.UP, 0.13 if k == 0 else -0.13)
			* BoardProjection.face_up(int(anchor.get("value")))
		)
		var support: float = edge * BoardProjection.clearance(orientation)
		var die_transform := (
			Transform3D(orientation, ground + Vector3.UP * (support + height))
			. scaled_local(Vector3.ONE * edge)
		)
		if _dice[k].transform != die_transform:
			_dice[k].transform = die_transform
			changed = true
		if _contact(_die_shadows[k], ground, edge * 0.83, height):
			changed = true
	return changed


func _contact(shadow: MeshInstance3D, ground: Vector3, radius: float, height: float) -> bool:
	var changed: bool = false
	var shadow_position := ground + Vector3.UP * 0.001
	var shadow_scale := Vector3.ONE * radius * (1.0 + height * 0.8)
	var opacity: float = 0.30 / (1.0 + height * 3.0)
	if shadow.position != shadow_position:
		shadow.position = shadow_position
		changed = true
	if shadow.scale != shadow_scale:
		shadow.scale = shadow_scale
		changed = true
	var material := shadow.material_override as ShaderMaterial
	if material.get_shader_parameter("opacity") != opacity:
		material.set_shader_parameter("opacity", opacity)
		changed = true
	return changed


func fly(board: Control, pawn: Control, target: Vector2, landed: Callable = Callable()) -> void:
	await aircraft.call("play", board, pawn, target, landed)
