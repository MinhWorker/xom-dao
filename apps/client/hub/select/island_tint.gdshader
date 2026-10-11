shader_type canvas_item;
uniform float saturation : hint_range(0.0, 1.0) = 0.85;
uniform float inactive : hint_range(0.0, 1.0) = 0.0;
uniform float wash : hint_range(0.0, 1.0) = 0.0;
varying vec4 canvas_tint;
void vertex() {
	canvas_tint = COLOR;
}
void fragment() {
	vec4 pixel = texture(TEXTURE, UV);
	float grey = dot(pixel.rgb, vec3(0.299, 0.587, 0.114));
	vec3 fresh = mix(vec3(grey), pixel.rgb, saturation);
	vec3 quiet = vec3(grey) * vec3(0.67, 0.78, 0.88);
	vec3 softened = mix(mix(fresh, quiet, inactive), vec3(0.88, 0.84, 0.74), wash);
	COLOR = vec4(softened, pixel.a) * canvas_tint;
}
