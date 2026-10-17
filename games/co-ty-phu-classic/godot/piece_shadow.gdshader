shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never;
uniform float opacity = 0.22;
void fragment() {
	vec2 p = (UV - vec2(0.5)) * 2.0;
	float falloff = exp(-dot(p,p) * 3.0) * (1.0 - smoothstep(0.7, 1.0, length(p)));
	ALBEDO = vec3(0.09, 0.17, 0.15);
	ALPHA = falloff * opacity;
}
