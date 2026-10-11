shader_type canvas_item;
uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_linear_mipmap;
void fragment() {
 vec3 blurred = textureLod(screen_texture, SCREEN_UV, 2.5).rgb;
 COLOR = vec4(mix(blurred, vec3(0.227, 0.141, 0.086), 0.55), 1.0) * COLOR;
}
