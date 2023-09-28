//
// This shader renders the image we use for object-picking.
//
struct Uniforms {
    mvp: mat4x4f,
    rot: mat4x4f,
    wfColor : vec4f,
    wfBorderColor : vec4f,
    wfStripeColor : vec4f,
    N: vec2<u32>,
    zScale : f32,
    flatShade: u32,
    dampingBorderWidth: u32,
    showDampingBorder: u32,
    ambientLightStrength: f32,
    diffuseLightStrength: f32,
    specularStrength: f32,
    specularShininess: f32,
    attrsPerVertex: u32,
    lightDir: vec3f    
};

struct VSOutput {
    @builtin(position) position: vec4f,
    @location(1) @interpolate(flat) id: f32,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var<storage, read> wfR: array<f32>;
@group(0) @binding(2) var<storage, read> wfIp: array<f32>;
@group(0) @binding(3) var<storage, read> wfIm: array<f32>;
@group(0) @binding(4) var<storage, read> obstacles: array<f32>;


//
// Vertex shader.
//
@vertex fn vertMain(@builtin(vertex_index) vertexIndex : u32) -> VSOutput  
{
    let dbOffset = select(uni.dampingBorderWidth, 0, (uni.showDampingBorder != 0u)); 
    let numWfVerticesToRender = 6 * (uni.N.x - 1 - 2*dbOffset) * (uni.N.y - 1 - 2*dbOffset);

    if (vertexIndex < numWfVerticesToRender) {
        return wavefunctionVertShader(vertexIndex);
    } else {
        return obstacleVertShader(vertexIndex - numWfVerticesToRender);
    }
}


//
// Obstacle-vertex shader.
//
fn obstacleVertShader(vertexIndex : u32) -> VSOutput  
{
    var vsOut: VSOutput;

    let i = uni.attrsPerVertex * vertexIndex;
    var pos = vec4f(obstacles[i], obstacles[i+1], obstacles[i+2], 1f);
    if (uni.showDampingBorder != 0u)
    {
        let dbw = f32(uni.dampingBorderWidth);
        let kx = dbw / f32(uni.N.x - 1);
        let ky = dbw / f32(uni.N.y - 1);
        pos.x = pos.x * (1f - 2*kx) + kx;
        pos.y = pos.y * (1f - 2*ky) + ky;
    }
    vsOut.position = uni.mvp * pos;
    vsOut.id = obstacles[i+10];
    
    return vsOut;
}


//
// Wavefunction-vertex shader.
//
fn wavefunctionVertShader(vertexIndex : u32) -> VSOutput  
{
    var vsOut: VSOutput;

    let showDampingBorder = (uni.showDampingBorder != 0u);
    let dbw = i32(uni.dampingBorderWidth);
    let dbOffset = select(dbw, 0, showDampingBorder);
    
    let NxvM1 = i32(uni.N.x) - 1 - 2*dbOffset; // # of visible grid points along x
    let NyvM1 = i32(uni.N.y) - 1 - 2*dbOffset; // # of visible grid points along y
    let a = 1f / f32(max(NxvM1, NyvM1));

    // Calculate vertex position
    let triangle_index = vertexIndex / 3;
    let local_vertex_index = vertexIndex % 3;
    let upper_triangle_offset = i32(triangle_index % 2); 

    let triy = i32(triangle_index) / (2*NxvM1);
    let trix = i32(triangle_index) % (2*NxvM1);
    let sign = 1i - 2i*upper_triangle_offset;
    let fsign = f32(sign);

    var iLoc = array<vec2<i32>, 3>();
    iLoc[0] = vec2<i32>(trix/2 + upper_triangle_offset,  triy + upper_triangle_offset);
    iLoc[1] = vec2<i32>(iLoc[0].x + sign,  iLoc[0].y);
    iLoc[2] = vec2<i32>(iLoc[0].x,  iLoc[0].y + sign);

    let theLoc = iLoc[local_vertex_index];
    let theProb = getScaledProb( theLoc, dbOffset );
    let pos = vec4f(a*f32(theLoc.x), a*f32(theLoc.y), theProb, 1);
    vsOut.position = uni.mvp * pos;

    vsOut.id = 1f; // All wf vertices have id = 1

    return vsOut;
}


//
// Fragment shader
//
@fragment fn fragMain(vsOut: VSOutput) -> @location(0) u32 
{
    return u32(round(vsOut.id));     
}


//
// Gets the (scaled) proability at a given grid point.
//
fn getScaledProb(iLoc: vec2<i32>, offset: i32) -> f32
{
    let ixy = (iLoc.x + offset) + (iLoc.y + offset) * i32(uni.N.x);
    let R = wfR[ixy];
    return max(0f, (R*R + wfIm[ixy] * wfIp[ixy])) * uni.zScale;
}
