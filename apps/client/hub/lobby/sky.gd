class_name HubSky
extends Control
## The lobby's backdrop (docs/experience.md, "Sảnh"): a soft sky over Vietnamese karst mountains,
## distant pagodas on the peaks, water below and clouds drifting through, all pale so the HUD and
## the centre island stand out. `hub/lobby/backdrop.webp` replaces the drawing when it exists
## (cover-scaled, 16:9 or wider). Fills its parent and takes no input.

const ART := "res://hub/lobby/backdrop.webp"
const SKY_TOP := Color("#78C3EE")
const SKY_LOW := Color("#DDF2FB")
const FAR := Color("#B4CFDE")
const NEAR := Color("#8DB5C9")
const WATER := Color("#86C9D9")
## Cloud drift, units a second.
const DRIFT := 6.0

var _art: Texture2D
var _drift: float = 0.0
var _drawn_drift: float = 0.0


func _init() -> void:
	name = "Sky"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	if ResourceLoader.exists(ART):
		_art = load(ART)
	resized.connect(queue_redraw)


func _process(delta: float) -> void:
	_drift += delta * DRIFT
	# Redraw only once the clouds moved a whole unit.
	if _art == null and _drift - _drawn_drift >= 1.0:
		_drawn_drift = _drift
		queue_redraw()


func _draw() -> void:
	var w: float = size.x
	var h: float = size.y
	if _art != null:
		var k: float = maxf(w / _art.get_width(), h / _art.get_height())
		var art_size: Vector2 = _art.get_size() * k
		draw_texture_rect(_art, Rect2((size - art_size) / 2.0, art_size), false)
		return
	var bands: int = 16
	for i: int in bands:
		var t: float = float(i) / bands
		draw_rect(Rect2(0, h * t, w, h / bands + 1.0), SKY_TOP.lerp(SKY_LOW, t))
	# The sun's glow, top left.
	for i: int in 5:
		draw_circle(Vector2(w * 0.12, h * 0.05), h * (0.5 - i * 0.08), Color(1, 0.97, 0.85, 0.08))
	var water_top: float = h * 0.84
	_mountains(7, FAR, h * 0.72, h * 0.18, h * 0.42, water_top, true)
	_clouds(11, h * 0.5, h * 0.7, 0.55)
	_mountains(13, NEAR, h * 0.8, h * 0.1, h * 0.3, water_top, false)
	draw_rect(Rect2(0, water_top, w, h - water_top), WATER)
	for i: int in int(w / 90.0):
		var x: float = fposmod(i * 137.0, w)
		var y: float = water_top + 10.0 + fposmod(i * 53.0, h - water_top - 14.0)
		draw_line(Vector2(x, y), Vector2(x + 34.0, y), Color(1, 1, 1, 0.35), 2.0)
	_clouds(5, h * 0.8, h * 0.92, 0.75)
	_clouds(4, h * 0.12, h * 0.3, 0.6)


## A row of tall rounded karst peaks standing on `base`, a pagoda on some when `pagodas`.
func _mountains(
	seed: int, color: Color, base: float, low: float, high: float, foot: float, pagodas: bool
) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var x: float = -rng.randf_range(0.0, 60.0)
	var index: int = 0
	while x < size.x + 60.0:
		var wide: float = rng.randf_range(70.0, 150.0)
		var tall: float = rng.randf_range(low, high)
		var peak := PackedVector2Array()
		for i: int in 17:
			var t: float = i / 16.0
			var dx: float = (t - 0.5) * 2.0
			var y: float = base - tall * pow(maxf(0.0, 1.0 - dx * dx), 0.45)
			peak.append(Vector2(x + wide * t, y))
		peak.append(Vector2(x + wide, foot))
		peak.append(Vector2(x, foot))
		draw_colored_polygon(peak, color)
		if pagodas and index % 3 == 1:
			_pagoda(Vector2(x + wide / 2.0, base - tall + 2.0), color.darkened(0.15))
		x += wide * rng.randf_range(0.55, 0.9)
		index += 1


## A three-tiered pagoda's silhouette standing at `at`.
func _pagoda(at: Vector2, color: Color) -> void:
	for tier: int in 3:
		var y: float = at.y - tier * 11.0
		var half: float = 15.0 - tier * 3.5
		var roof := PackedVector2Array(
			[
				Vector2(at.x - half - 4.0, y - 6.0),
				Vector2(at.x + half + 4.0, y - 6.0),
				Vector2(at.x + half, y - 10.0),
				Vector2(at.x - half, y - 10.0),
			]
		)
		draw_rect(Rect2(at.x - half * 0.6, y - 6.0, half * 1.2, 6.0), color)
		draw_colored_polygon(roof, color)
	draw_line(at - Vector2(0, 34), at - Vector2(0, 42), color, 2.0)


## Soft clouds between `top` and `bottom`, drifting right.
func _clouds(seed: int, top: float, bottom: float, alpha: float) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var span: float = size.x + 400.0
	for i: int in int(size.x / 160.0) + 2:
		var x: float = fposmod(rng.randf_range(0.0, span) + _drift * (0.5 + seed % 3 * 0.3), span)
		var at := Vector2(x - 200.0, rng.randf_range(top, bottom))
		var r: float = rng.randf_range(26.0, 48.0)
		for puff: int in 5:
			var off := Vector2((puff - 2) * r * 0.75, -absf(puff - 2) * -r * 0.18 - r * 0.2)
			draw_circle(at + off, r * (1.0 - absf(puff - 2) * 0.18), Color(1, 1, 1, alpha))
