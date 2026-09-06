varying vPosition: vec3f;
varying vNormal: vec3f;
varying vTint: vec4f;
varying vDepth: f32;
uniform cameraPosition: vec3f;
uniform sunDir: vec3f;
uniform sunRadiance: vec3f;
uniform flash: f32;
uniform time: f32;

// The core of a frost whirl: a few hard-edged shards of clear ice, turning.
//
// Almost all of what you see is edge. A shard lit from behind by a thirteen
// degree sun is mostly rim and mostly refracted light, and the flat faces are
// nearly black — so the term that carries the read is the fresnel, not the
// diffuse, and the diffuse is kept low on purpose. Facet normals come out of
// the geometry rather than a normal map, so every edge is exactly hard.
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let N = normalize(input.vNormal);
    let V = normalize(uniforms.cameraPosition - input.vPosition);
    let L = normalize(uniforms.sunDir);

    let fresnel = pow(1.0 - max(0.0, dot(N, V)), 2.6);
    // Light that entered the far face. Ice is thin here, so this is bright and
    // takes the sun's own colour rather than the shard's.
    let through = pow(clamp(dot(-V, L) * 0.5 + 0.5, 0.0, 1.0), 4.0);
    let sheen = pow(max(0.0, dot(reflect(-L, N), V)), 34.0);

    let cold = vec3f(0.42, 0.74, 1.00);
    var col = input.vTint.rgb * (0.25 + max(0.0, dot(N, L)) * 0.55) * uniforms.sunRadiance * 0.22;
    col += cold * fresnel * (5.5 + 2.5 * sin(uniforms.time * 2.1 + input.vPosition.y * 3.0));
    col += uniforms.sunRadiance * through * 1.15;
    col += uniforms.sunRadiance * sheen * 2.4;
    // The heart of it, carried in the vertex alpha.
    col += cold * input.vTint.a * (9.0 + 3.0 * sin(uniforms.time * 3.4));
    col += vec3f(11.0, 13.0, 16.0) * uniforms.flash;

    fragmentOutputs.color = vec4f(col, 1.0);
}
