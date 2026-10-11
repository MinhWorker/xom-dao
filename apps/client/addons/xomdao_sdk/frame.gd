class_name XomDaoFrame
extends RefCounted
## The landscape frame every screen is designed on (docs/ui-guide.md): always 1280 × 720 units
## (16:9), with black bars on screens of another shape. The 960 × 720 core in its middle is where
## a table goes.

const HEIGHT := 720.0
const SIZE := Vector2(1280.0, 720.0)
const CORE := Vector2(960.0, 720.0)
const WEB_SAFE_AREA := """
(() => {
 let probe = document.getElementById('xomdao-safe-area');
 if (!probe) {
  probe = document.createElement('div');
  probe.id = 'xomdao-safe-area';
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = [
   'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none',
   'padding-top:env(safe-area-inset-top,0px)',
   'padding-right:env(safe-area-inset-right,0px)',
   'padding-bottom:env(safe-area-inset-bottom,0px)',
   'padding-left:env(safe-area-inset-left,0px)'
  ].join(';');
  document.body.appendChild(probe);
 }
 const s = getComputedStyle(probe);
 return JSON.stringify([
  Math.max(parseFloat(s.paddingLeft) || 0, parseFloat(s.paddingRight) || 0),
  Math.max(parseFloat(s.paddingTop) || 0, parseFloat(s.paddingBottom) || 0),
  innerWidth, innerHeight
 ]);
})()
"""


## The core's rectangle inside a viewport of the given size, centred.
static func core_rect(viewport_size: Vector2) -> Rect2:
	return Rect2((viewport_size - CORE) / 2.0, CORE)


## A window inset in frame units, less what the black bars around the frame already cover.
## `inset` and `window_size` share a unit (CSS or screen pixels).
static func inset_in_frame(inset: Vector2, window_size: Vector2, frame_size: Vector2) -> Vector2:
	var scale: float = minf(window_size.x / frame_size.x, window_size.y / frame_size.y)
	var bars: Vector2 = (window_size - frame_size * scale) / 2.0
	return (inset - bars).max(Vector2.ZERO) / scale


## The notch and rounded corners on the top left, in frame units: what HUD corners stay clear of.
static func safe_inset(node: CanvasItem) -> Vector2:
	if not node.is_inside_tree():
		return Vector2.ZERO
	var frame_size: Vector2 = node.get_viewport_rect().size
	if OS.has_feature("web"):
		# Browser env() values are CSS pixels; canvas pixels also include device density.
		var values: Variant = JSON.parse_string(str(JavaScriptBridge.eval(WEB_SAFE_AREA, true)))
		if values is Array and values.size() == 4 and values[2] > 0 and values[3] > 0:
			return inset_in_frame(
				Vector2(float(values[0]), float(values[1])),
				Vector2(float(values[2]), float(values[3])),
				frame_size
			)
	var window := Vector2(DisplayServer.window_get_size())
	if window.x <= 0.0 or window.y <= 0.0:
		return Vector2.ZERO
	var safe: Rect2i = DisplayServer.get_display_safe_area()
	var origin := Vector2(DisplayServer.window_get_position())
	var inset: Vector2 = (Vector2(safe.position) - origin).max(Vector2.ZERO)
	return inset_in_frame(inset, window, frame_size)
