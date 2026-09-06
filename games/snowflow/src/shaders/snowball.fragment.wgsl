varying vPosition: vec3f;
varying vNormal: vec3f;
varying vTint: vec4f;
varying vDepth: f32;
uniform cameraPosition: vec3f;
uniform sunDir: vec3f;
uniform sunRadiance: vec3f;
uniform tint: vec3f;

// A packed snowball, lit to sit in the same range as the field it came out of.
//
// The numbers here are not free. Sunlit snow in this scene lands around 12 in
// linear, and AgX puts that near the middle of its curve; a ball lit to 3 would
// read as a grey pebble against the ground it was scooped from, and one lit to
// 40 would clip to a white dot. So the key is the real sun radiance the sky
// solved, and the albedo is snow's, and the result lands where the snow lands.
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let N = normalize(input.vNormal);
    let V = normalize(uniforms.cameraPosition - input.vPosition);
    let L = normalize(uniforms.sunDir);

    // Wrapped diffuse. Snow scatters hard enough that the terminator is a broad
    // band rather than an edge — the single most recognisable thing about it.
    let wrap = clamp((dot(N, L) + 0.55) / 1.55, 0.0, 1.0);

    // Light that went in the far side and came back out. A snowball is small
    // enough that this is most of what you see when it flies at the sun.
    let through = pow(clamp(dot(-V, L) * 0.5 + 0.5, 0.0, 1.0), 3.0);
    let back = through * (0.35 + 0.65 * (1.0 - abs(dot(N, V))));

    // Cool sky fill, so the shadowed half is blue rather than black.
    let ambient = vec3f(0.40, 0.55, 0.86) * 2.4;
    let albedo = vec3f(0.92, 0.94, 0.97);

    var col = albedo * (uniforms.sunRadiance * wrap + ambient);
    col += uniforms.sunRadiance * albedo * back * 0.55;

    // Whose ball it is, carried in the rim rather than in the body — a pink
    // snowball is a beach ball, a snowball with a pink edge is still snow.
    let rim = pow(1.0 - max(0.0, dot(N, V)), 3.0);
    col += uniforms.tint * rim * 6.0;

    // Grain. Crushed snow is faceted and catches the sun in points; without
    // this the ball reads as a smooth plastic sphere at any distance.
    let grain = fract(sin(dot(floor(N * 14.0), vec3f(12.99, 78.23, 37.71))) * 43758.55);
    col += uniforms.sunRadiance * step(0.955, grain) * wrap * 1.6;

    fragmentOutputs.color = vec4f(col, 1.0);
}
