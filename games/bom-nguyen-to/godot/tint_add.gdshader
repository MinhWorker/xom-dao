// The additive twin of tint.gdshader, for glows (the skill aura).
shader_type canvas_item;
render_mode blend_add;

uniform vec4 shade : source_color = vec4(0.72, 0.21, 0.12, 1.0);
uniform vec4 hot : source_color = vec4(1.0, 0.96, 0.78, 1.0);

void fragment() {
	vec4 t = texture(TEXTURE, UV);
	vec3 c = mix(shade.rgb, hot.rgb, t.r * t.r * t.r);
	COLOR = vec4(c * t.a, t.a) * COLOR;
}
