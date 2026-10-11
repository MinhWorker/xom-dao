shader_type canvas_item;
// The lobby's islands away from the centre: blue-grey and paler (docs/experience.md, "Sảnh").
// dim 0 is full colour, 1 fully blue-grey.

uniform float dim : hint_range(0.0, 1.0) = 0.0;
uniform vec4 tint : source_color = vec4(0.62, 0.71, 0.8, 1.0);

void fragment() {
	float light = dot(COLOR.rgb, vec3(0.299, 0.587, 0.114));
	vec3 grey = tint.rgb * (0.55 + 0.6 * light);
	COLOR.rgb = mix(COLOR.rgb, grey, dim);
}
