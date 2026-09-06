varying vPosition: vec3f;
varying vNormal: vec3f;
varying vTint: vec4f;
varying vDepth: f32;
uniform cameraPosition: vec3f;
uniform tint: vec3f;
uniform flash: f32;
uniform fade: f32;

// The other mages in the room. Deliberately not the player's own shader: they
// are read at distance against snow, so they get a flat key, a hard rim in
// their own colour and nothing else. `vTint.a` is how much of the part takes
// the player colour — 1 on the cloak, 0 on skin, fur and the staff.
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let N = normalize(input.vNormal);
    let V = normalize(uniforms.cameraPosition - input.vPosition);
    let albedo = mix(input.vTint.rgb, uniforms.tint * input.vTint.rgb * 2.6, input.vTint.a);
    let key = 0.40 + max(0.0, dot(N, normalize(vec3f(0.55, 0.92, -0.38)))) * 0.9;
    let rim = pow(1.0 - max(0.0, dot(N, V)), 2.4);

    var col = albedo * key * 2.6;
    col += uniforms.tint * rim * 2.2;
    col += vec3f(5.0, 1.1, 0.9) * uniforms.flash;
    // Down in the snow: the silhouette stays, the colour drains out of it.
    col = mix(col, vec3f(dot(col, vec3f(0.3, 0.6, 0.1))) * 0.35, uniforms.fade);
    fragmentOutputs.color = vec4f(col, 1.0);
}
