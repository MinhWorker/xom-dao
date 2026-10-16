shader_type canvas_item;
uniform bool water = false;

void fragment() {
	vec2 uv = UV;
	vec4 tint = COLOR;
	if (water) {
		// Flow stays within the printed drop rather than moving the tile.
		uv.x += sin(uv.y * 13.0 + TIME * 2.2) * 0.009 * sin(uv.y * 3.14159);
		vec4 body = texture(TEXTURE, uv);
		float wave = sin(uv.x * 8.0 + uv.y * 19.0 - TIME * 2.8);
		float shine = smoothstep(0.45, 1.0, wave) * 0.20;
		COLOR = vec4(mix(body.rgb * tint.rgb, vec3(0.86, 0.98, 1.0), shine), body.a * tint.a);
	} else {
		// Two softened flashes followed by a long quiet interval.
		float cycle = mod(TIME, 4.6);
		float flash = exp(-pow((cycle - 0.35) / 0.09, 2.0)) + 0.65 * exp(-pow((cycle - 0.65) / 0.12, 2.0));
		vec4 body = texture(TEXTURE, uv);
		COLOR = vec4(mix(body.rgb * tint.rgb, vec3(1.0, 0.95, 0.68), flash * 0.78), body.a * tint.a);
	}
}
