shader_type canvas_item;
// A piece of a picture that covers a bigger box (docs/experience.md, "Sảnh"), each corner with
// its own radius: the lobby card's art, darker towards its top and bottom, and the frosted panes
// over it, which show the blurred picture under a tint with a rim of light. `uv_origin` and
// `uv_span` say which part of the picture this piece shows; `box` is its size in units.

uniform sampler2D art : source_color, filter_linear, repeat_disable;
uniform bool has_art = false;
uniform vec4 backdrop : source_color = vec4(0.118, 0.561, 0.651, 1.0);
uniform vec2 uv_origin = vec2(0.0);
uniform vec2 uv_span = vec2(1.0);
uniform vec2 box = vec2(100.0);
// Top left, top right, bottom right, bottom left.
uniform vec4 radii = vec4(16.0);
uniform vec4 tint : source_color = vec4(0.0);
uniform float rim : hint_range(0.0, 1.0) = 0.0;
uniform float shade_top : hint_range(0.0, 1.0) = 0.0;
uniform float shade_bottom : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	vec2 at = UV * box;
	vec2 side = step(box * 0.5, at);
	float radius = mix(mix(radii.x, radii.y, side.x), mix(radii.w, radii.z, side.x), side.y);
	vec2 corner = abs(at - box * 0.5) - (box * 0.5 - radius);
	float edge = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - radius;
	float soft = max(fwidth(edge), 0.0001);
	vec3 color = has_art ? texture(art, uv_origin + UV * uv_span).rgb : backdrop.rgb;
	color *= 1.0 - shade_top * smoothstep(0.45, 0.0, UV.y);
	color *= 1.0 - shade_bottom * smoothstep(0.55, 1.0, UV.y);
	color = mix(color, tint.rgb, tint.a);
	float line = smoothstep(-3.0, -0.5, edge);
	color += rim * line * mix(1.0, 0.3, UV.y);
	COLOR = vec4(color, clamp(0.5 - edge / soft, 0.0, 1.0));
}
