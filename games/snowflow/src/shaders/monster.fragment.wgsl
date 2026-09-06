varying vPosition: vec3f;
varying vNormal: vec3f;
varying vTint: vec4f;
varying vDepth: f32;
uniform cameraPosition: vec3f;
uniform flash: f32;
uniform time: f32;

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let N = normalize(input.vNormal);
    let V = normalize(uniforms.cameraPosition - input.vPosition);
    let rim = pow(1.0 - max(0.0, dot(N, V)), 2.2);
    let diffuse = 0.5 + max(0.0, dot(N, normalize(vec3f(0.6, 1.0, -0.4))));
    var col = input.vTint.rgb * diffuse * 2.8 + vec3f(0.35, 1.4, 2.8) * rim;
    col += input.vTint.rgb * input.vTint.a * (65.0 + sin(uniforms.time * 4.0) * 9.0);
    col += vec3f(5.0, 14.0, 20.0) * uniforms.flash;
    fragmentOutputs.color = vec4f(col, 1.0);
}
