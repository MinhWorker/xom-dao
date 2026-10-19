shader_type canvas_item;

uniform vec4 tint : source_color = vec4(0.29, 0.23, 0.12, 1.0);

void fragment() {
	vec4 logo = texture(TEXTURE, UV);
	COLOR = vec4(tint.rgb, logo.a * tint.a * COLOR.a);
}
