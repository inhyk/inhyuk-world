varying vPosition: vec3f;
varying vNormal: vec3f;
varying vTint: vec4f;
varying vDepth: f32;
uniform cameraPosition: vec3f;
uniform sunDir: vec3f;
uniform sunRadiance: vec3f;
uniform flash: f32;

// Snowmen. Same lighting model as the snowballs — wrapped diffuse, cool sky
// fill, real sun radiance — but the albedo comes off the vertex colour, because
// a carrot is not snow. `vTint.a` is emissive, which is how the scarf reads at
// dusk when everything else has gone blue.
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let N = normalize(input.vNormal);
    let V = normalize(uniforms.cameraPosition - input.vPosition);
    let L = normalize(uniforms.sunDir);

    let wrap = clamp((dot(N, L) + 0.5) / 1.5, 0.0, 1.0);
    let ambient = vec3f(0.40, 0.55, 0.86) * 2.3;
    let albedo = input.vTint.rgb;

    var col = albedo * (uniforms.sunRadiance * wrap + ambient);
    col += albedo * input.vTint.a * 7.0;

    let rim = pow(1.0 - max(0.0, dot(N, V)), 3.2);
    col += vec3f(0.55, 0.78, 1.0) * rim * 1.8;
    // Struck. White, not red: this is snow bursting off snow.
    col += vec3f(9.0, 10.0, 12.0) * uniforms.flash;

    fragmentOutputs.color = vec4f(col, 1.0);
}
