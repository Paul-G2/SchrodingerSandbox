//
// This shader draws our gradient backgrount.
//
struct Uniforms {
    color0 : vec4f,
    color1 : vec4f,
};

struct VSOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f
};

@group(0) @binding(0) var<uniform> uni: Uniforms;



//
// Vertex shader.
//
@vertex fn vertMain(@builtin(vertex_index) vertexIndex : u32) -> VSOutput  
{
    var vsOut: VSOutput;

    switch vertexIndex {
        case 0:  { vsOut.position = vec4f(-1, -1, 0, 1);  vsOut.color = uni.color0; break; }
        case 1:  { vsOut.position = vec4f(-1,  1, 0, 1);  vsOut.color = uni.color1; break; }
        case 2:  { vsOut.position = vec4f( 1, -1, 0, 1);  vsOut.color = uni.color0; break; }
        case 3:  { vsOut.position = vec4f(-1,  1, 0, 1);  vsOut.color = uni.color1; break; }
        case 4:  { vsOut.position = vec4f( 1, -1, 0, 1);  vsOut.color = uni.color0; break; }
        default: { vsOut.position = vec4f( 1,  1, 0, 1);  vsOut.color = uni.color1; break; }
    }

    return vsOut;
}


//
// Fragment shader.
//
@fragment fn fragMain(vsOut: VSOutput) -> @location(0) vec4f 
{
    return vsOut.color;       
}



