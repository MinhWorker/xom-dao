shader_type canvas_item;
uniform float active = 0.0;
uniform vec4 tint : source_color = vec4(1.0);
uniform float impact = 0.0;
uniform vec4 impact_color : source_color = vec4(1.0);
void fragment() {
	vec2 q = abs(UV - vec2(0.5)) - vec2(0.5 - 0.055, 0.5 - 0.13);
	float edge = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - 0.025;
	float ring = 1.0 - smoothstep(0.008, 0.027, abs(edge));
	float sweep = pow(max(0.0, cos((UV.x + UV.y * 0.24 - TIME * 0.33) * 6.283)), 18.0);
	float pulse = 0.5 + 0.5 * sin(TIME * 3.0);
	vec3 light = mix(tint.rgb, vec3(1.0, 0.89, 0.55), 0.65);
	float amount = ring * active * (0.18 + 0.28 * pulse + sweep * 0.5);
	float flash = (1.0 - smoothstep(-0.04, 0.03, edge)) * impact * 0.22;
	COLOR = vec4(mix(light, impact_color.rgb, step(0.001, flash)), max(amount, flash));
}
