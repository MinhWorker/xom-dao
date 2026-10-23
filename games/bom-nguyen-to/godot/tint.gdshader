// Gradient map for the grey Blender flipbooks (art/arena-fx3d): grey levels become an element's
// colours, from its smoke (darkest, also its alpha) through its shade and body to its hot core.
shader_type canvas_item;

uniform vec4 smoke : source_color = vec4(0.36, 0.29, 0.27, 0.8);
uniform vec4 shade : source_color = vec4(0.72, 0.21, 0.12, 1.0);
uniform vec4 body : source_color = vec4(1.0, 0.64, 0.23, 1.0);
uniform vec4 hot : source_color = vec4(1.0, 0.96, 0.78, 1.0);

void fragment() {
	vec4 t = texture(TEXTURE, UV);
	float v = t.r;
	float low = smoothstep(0.12, 0.45, v);
	vec3 c = v < 0.45 ? mix(smoke.rgb, shade.rgb, low)
		: v < 0.82 ? mix(shade.rgb, body.rgb, (v - 0.45) / 0.37)
		: mix(body.rgb, hot.rgb, clamp((v - 0.82) / 0.18, 0.0, 1.0));
	float a = v < 0.45 ? mix(smoke.a, 1.0, low) : 1.0;
	COLOR = vec4(c, t.a * a) * COLOR;
}
