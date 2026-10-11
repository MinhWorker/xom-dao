// XomDaoLit (lit.gd): a baked piece lit by its normal map, without Light2D. COLOR is the picture
// times the node's modulate; it is scaled by ambient plus the key light on the surface.
shader_type canvas_item;
render_mode unshaded;

// Toward the light in the normal map's space: +X right, +Y up, +Z toward the viewer.
uniform vec3 key = vec3(-0.3, 0.4, 0.7);
uniform vec3 key_color = vec3(1.0, 0.953, 0.875);
uniform float ambient = 0.8;
uniform float energy = 0.45;

void fragment() {
	vec3 normal = texture(NORMAL_TEXTURE, UV).rgb * 2.0 - 1.0;
	float facing = max(dot(normalize(normal), normalize(key)), 0.0);
	COLOR.rgb *= ambient + energy * facing * key_color;
}
