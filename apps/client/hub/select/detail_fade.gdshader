shader_type canvas_item;
uniform vec4 tint : source_color = vec4(0.227, 0.141, 0.086, 0.9);
void fragment() {
	float fade = 1.0 - smoothstep(0.24, 1.0, UV.y);
	float edge = smoothstep(0.0, 0.035, UV.x) * (1.0 - smoothstep(0.94, 1.0, UV.x));
	COLOR = vec4(tint.rgb, tint.a * fade * edge);
}
