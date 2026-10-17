shader_type canvas_item;

uniform sampler2D art : source_color, filter_linear_mipmap, repeat_disable;
uniform bool has_art = true;
uniform vec2 uv_origin = vec2(0.0);
uniform vec2 uv_span = vec2(1.0);
uniform vec2 box = vec2(100.0);
uniform vec4 radii = vec4(14.0);
uniform vec4 scrim_color : source_color = vec4(0.055, 0.09, 0.16, 1.0);
uniform float scrim_left : hint_range(0.0, 1.0) = 0.92;
uniform float scrim_right : hint_range(0.0, 1.0) = 0.45;

void fragment() {
	vec2 at = UV * box;
	vec2 side = step(box * 0.5, at);
	float radius = mix(mix(radii.x, radii.y, side.x), mix(radii.w, radii.z, side.x), side.y);
	vec2 corner = abs(at - box * 0.5) - (box * 0.5 - radius);
	float edge = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - radius;
	float soft = max(fwidth(edge), 0.0001);
	float alpha = clamp(0.5 - edge / soft, 0.0, 1.0);

	vec3 tex = has_art ? texture(art, uv_origin + UV * uv_span).rgb : scrim_color.rgb;
	float scrim_factor = mix(scrim_left, scrim_right, smoothstep(0.05, 0.85, UV.x));
	vec3 final_color = mix(tex, scrim_color.rgb, scrim_factor);

	COLOR = vec4(final_color, alpha);
}
