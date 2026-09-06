attribute position: vec3f;
attribute normal: vec3f;
attribute color: vec4f;
uniform world: mat4x4f;
uniform viewProjection: mat4x4f;
varying vPosition: vec3f;
varying vNormal: vec3f;
varying vTint: vec4f;
varying vDepth: f32;

@vertex
fn main(input: VertexInputs) -> FragmentInputs {
    let worldPosition = uniforms.world * vec4f(input.position, 1.0);
    let clip = uniforms.viewProjection * worldPosition;
    vertexOutputs.position = clip;
    vertexOutputs.vPosition = worldPosition.xyz;
    vertexOutputs.vNormal = normalize((uniforms.world * vec4f(input.normal, 0.0)).xyz);
    vertexOutputs.vTint = input.color;
    vertexOutputs.vDepth = clip.w;
}
