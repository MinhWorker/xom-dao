// The sea around the island: turquoise shallows fading to deep water away from the island, with
// slow glinting swells. `cell` is a cell's width in pixels and `island` the island's centre.
shader_type canvas_item;

uniform vec4 deep : source_color = vec4(0.118, 0.561, 0.651, 1.0);
uniform vec4 shallow : source_color = vec4(0.243, 0.757, 0.788, 1.0);
uniform vec2 rect_size = vec2(1280.0, 720.0);
uniform vec2 island = vec2(640.0, 360.0);
uniform vec2 reach = vec2(640.0, 420.0);
uniform float cell = 64.0;
uniform float dusk = 0.0;

void fragment() {
	vec2 px = UV * rect_size;
	vec2 p = px / cell;
	float d = length((px - island) / reach);
	vec3 c = mix(shallow.rgb, deep.rgb, smoothstep(0.85, 1.9, d));
	float swell = sin(p.x * 0.9 + sin(p.y * 0.6 + TIME * 0.35) * 1.8 + TIME * 0.5)
		* sin(p.y * 1.7 - TIME * 0.42 + sin(p.x * 0.45 + TIME * 0.2) * 1.3);
	c += vec3(1.0) * smoothstep(0.78, 0.98, swell) * 0.13;
	c -= vec3(0.03, 0.05, 0.04) * smoothstep(-0.2, -0.95, swell);
	c = mix(c, c * vec3(1.05, 0.78, 0.7), dusk);
	COLOR = vec4(c, 1.0);
}
