shader_type canvas_item;
uniform int kind = 0;
uniform float phase = 0.0;
varying vec4 ink;

void vertex() {
	ink = COLOR;
	float t = TIME + phase;
	if (kind == 2) {
		float a = sin(t * 0.85) * 0.10;
		VERTEX = mat2(vec2(cos(a), sin(a)), vec2(-sin(a), cos(a))) * VERTEX;
	} else if (kind == 3) {
		// Only the chest lid rises; its base stays anchored to the print.
		VERTEX.y -= smoothstep(0.48, 0.20, UV.y) * pow(max(0.0, sin(t * 1.1)), 6.0) * 11.0;
	} else if (kind == 4) {
		VERTEX.y -= sin(t * 2.0 + UV.y * 7.0) * 2.8;
	} else if (kind == 5) {
		VERTEX.y += sin(t * 3.0) * 1.8;
	} else if (kind == 6) {
		VERTEX.x += sin(t * 0.7) * 14.0;
		VERTEX.y += cos(t * 0.7) * 8.0;
	}
}

void fragment() {
	float t = TIME + phase;
	vec2 uv = UV;
	if (kind == 1) {
		uv.x += sin(uv.y * 13.0 + t * 2.2) * 0.009 * sin(uv.y * 3.14159);
	}
	vec4 body = texture(TEXTURE, uv);
	float shine = 0.0;
	if (kind == 0) {
		float cycle = mod(t, 4.6);
		shine = (exp(-pow((cycle - 0.35) / 0.09, 2.0)) + 0.65 * exp(-pow((cycle - 0.65) / 0.12, 2.0))) * 0.78;
	} else if (kind == 1) {
		shine = smoothstep(0.45, 1.0, sin(uv.x * 8.0 + uv.y * 19.0 - t * 2.8)) * 0.20;
	} else {
		float sweep = abs(uv.x + uv.y * 0.4 - mod(t * 0.30, 2.2) + 0.4);
		shine = (1.0 - smoothstep(0.0, 0.12, sweep)) * 0.36;
	}
	COLOR = vec4(mix(body.rgb * ink.rgb, vec3(1.0, 0.95, 0.77), shine), body.a * ink.a);
}
