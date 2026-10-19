shader_type canvas_item;

float hash_value(vec2 point) {
	return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float value_noise(vec2 point) {
	vec2 cell = floor(point);
	vec2 fraction = fract(point);
	fraction = fraction * fraction * (3.0 - 2.0 * fraction);
	float a = hash_value(cell);
	float b = hash_value(cell + vec2(1.0, 0.0));
	float c = hash_value(cell + vec2(0.0, 1.0));
	float d = hash_value(cell + vec2(1.0, 1.0));
	return mix(mix(a, b, fraction.x), mix(c, d, fraction.x), fraction.y);
}

void fragment() {
	vec2 uv = UV;
	float broad_grain = value_noise(uv * vec2(8.0, 18.0));
	float fine_grain = value_noise(uv * vec2(54.0, 72.0));
	float warped = uv.y * 42.0 + (value_noise(uv * vec2(5.0, 34.0)) - 0.5) * 1.3;
	warped += sin(uv.x * 17.0 + uv.y * 3.0) * 0.12;
	float streaks = pow(max(0.0, sin(warped * 6.28318) * 0.5 + 0.5), 10.0);
	float grain = clamp(0.18 + broad_grain * 0.32 + fine_grain * 0.06 + streaks * 0.075, 0.16, 0.64);
	vec3 dark_wood = vec3(0.085, 0.052, 0.032);
	vec3 warm_wood = vec3(0.27, 0.17, 0.105);
	vec3 wood = mix(dark_wood, warm_wood, grain);
	vec2 edge = abs(uv * 2.0 - 1.0) * vec2(0.78, 1.0);
	float vignette = smoothstep(0.45, 1.28, length(edge));
	wood *= 1.0 - vignette * 0.52;
	COLOR = vec4(wood, 1.0);
}
