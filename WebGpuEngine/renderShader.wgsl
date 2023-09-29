//
// This shader renders our wavefunction and obstacles.
//
struct Uniforms {
    mvp: mat4x4f,
    rot: mat4x4f,
    wfColor : vec4f,
    wfBorderColor : vec4f,
    wfStripeColor : vec4f,
    N: vec2<u32>,
    wfScale : f32,
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
    @location(0) normal: vec3f,
    @location(1) color: vec4f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var<storage, read> wfR: array<f32>;
@group(0) @binding(2) var<storage, read> wfIp: array<f32>;
@group(0) @binding(3) var<storage, read> wfIm: array<f32>;
@group(0) @binding(4) var<storage, read> obstacles: array<f32>;



//
// Vertex shader
//
@vertex fn vertMain(@builtin(vertex_index) vertexIndex : u32) -> VSOutput  
{
    let dbOffset = select(uni.dampingBorderWidth, 0, (uni.showDampingBorder != 0u));    
    let numWfVerticesToRender = 6 * (uni.N.x - 1 - 2*dbOffset) * (uni.N.y - 1 - 2*dbOffset);

    if (vertexIndex < numWfVerticesToRender) {
        if (uni.flatShade > 0) {
            return wavefunctionVertFlat(vertexIndex);
        } else {
            return wavefunctionVertSmooth(vertexIndex);
        }
    } else {
        return obstacleVert(vertexIndex - numWfVerticesToRender);
    }
}


//
// Obstacle-vertex shader
//
fn obstacleVert(vertexIndex : u32) -> VSOutput  
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

    let normal = normalize( vec3f(obstacles[i+3], obstacles[i+4], obstacles[i+5]) );
    vsOut.normal = (uni.rot * vec4f(normal, 1)).xyz; 
    vsOut.color = vec4f( obstacles[i+6], obstacles[i+7], obstacles[i+8], obstacles[i+9] );
    
    return vsOut;
}


//
// Wavefunction-vertex shader (flat-shading version).
//
fn wavefunctionVertFlat(vertexIndex : u32) -> VSOutput  
{
    var vsOut: VSOutput;

    let showDampingBorder = (uni.showDampingBorder != 0u);
    let dbw = i32(uni.dampingBorderWidth);
    let dbOffset = select(dbw, 0, showDampingBorder);
    
    let NxvM1 = i32(uni.N.x) - 1 - 2*dbOffset; // # of visible grid points along x
    let NyvM1 = i32(uni.N.y) - 1 - 2*dbOffset; // # of visible grid points along y
    let a = 1f / f32(max(NxvM1, NyvM1));

    // Calculate the vertex position
    let triangle_index = vertexIndex / 3;
    let local_vertex_index = vertexIndex % 3;
    let upper_triangle_offset = i32(triangle_index % 2); 
    
    let triy  = i32(triangle_index) / (2*NxvM1);
    let trix  = i32(triangle_index) % (2*NxvM1);
    let sign  = 1i - 2i*upper_triangle_offset;
    let fsign = f32(sign);

    var ix = array<i32, 3>();
    var iy = array<i32, 3>();
    ix[0] = trix/2 + upper_triangle_offset;
    iy[0] = triy + upper_triangle_offset;
    
    ix[1] = ix[0] + sign;
    iy[1] = iy[0];

    ix[2] = ix[0]; 
    iy[2] = iy[0] + sign;

    var prob = array<f32, 3>();
    prob[0] = getScaledProb(ix[0], iy[0], dbOffset);
    prob[1] = getScaledProb(ix[1], iy[1], dbOffset);
    prob[2] = getScaledProb(ix[2], iy[2], dbOffset);

    let ixL = ix[local_vertex_index];
    let iyL = iy[local_vertex_index];
    let theProb = prob[local_vertex_index];
    let pos = vec4f(a*f32(ixL), a*f32(iyL), theProb, 1);
    vsOut.position = uni.mvp * pos;


    // Calculate the vertex normal
    let normal = vec3f( fsign*(prob[0] - prob[1]), fsign*(prob[0] - prob[2]), a );
    vsOut.normal = (uni.rot * vec4f(normalize(normal), 1)).xyz; 


    // Calculate the vertex color 
    let ixyL = (ixL + dbOffset) + (iyL + dbOffset) * i32(uni.N.x);
    var stripeWeight = select(
        0f,
        pow( max(0f, wfIm[ixyL] * wfIp[ixyL]) * uni.wfScale / theProb, 12f ),
        (theProb > 0) && (wfIm[ixyL] > 0f)
    );
    stripeWeight *= select(1f, 1e3*theProb, theProb < 1e-3);

    let wfColor = select(uni.wfColor, uni.wfBorderColor, 
        showDampingBorder && ((ixL < dbw) || (iyL < dbw) || (ixL > NxvM1-dbw) || (iyL > NyvM1-dbw)) );
    vsOut.color = mix(wfColor, uni.wfStripeColor, stripeWeight);

    return vsOut;
}


//
// Wavefunction-vertex shader (smooth-shading version).
//
fn wavefunctionVertSmooth(vertexIndex : u32) -> VSOutput   
{
    var vsOut: VSOutput;

    let showDampingBorder = (uni.showDampingBorder != 0u);
    let dbw = i32(uni.dampingBorderWidth);
    let dbOffset = select(dbw, 0, showDampingBorder);
    
    let NxvM1 = i32(uni.N.x) - 1 - 2*dbOffset; // # of visible grid points along x
    let NyvM1 = i32(uni.N.y) - 1 - 2*dbOffset; // # of visible grid points along y
    let a = 1f / f32(max(NxvM1, NyvM1));


    // Calculate the vertex position
    let triangle_index = vertexIndex / 3;
    let local_vertex_index = vertexIndex % 3;
    let upper_triangle_offset = i32(triangle_index % 2); 
    let sign = 1i - 2i*upper_triangle_offset;

    let triy = i32(triangle_index) / (2*NxvM1);
    let trix = i32(triangle_index) % (2*NxvM1);

    var ix0 = trix/2 + upper_triangle_offset + select(0i, sign, local_vertex_index == 1u);
    var iy0 = triy + upper_triangle_offset + select(0i, sign, local_vertex_index == 2u);

    let prob0 = getScaledProb(ix0, iy0, dbOffset);
    let pos = vec4f(a*f32(ix0), a*f32(iy0), prob0, 1);
    vsOut.position = uni.mvp * pos;


    // Calculate the vertex normal (average of nearby normals)
    let ixp = select(0, ix0 + 1, ix0 < NxvM1);
    let iyp = select(0, iy0 + 1, iy0 < NyvM1);
    let ixm = select(NxvM1, ix0 - 1, ix0 > 0);
    let iym = select(NyvM1, iy0 - 1, iy0 > 0);

    let probA = getScaledProb(ixp, iy0, dbOffset);
    let probB = getScaledProb(ix0, iyp, dbOffset);
    let probC = getScaledProb(ixm, iyp, dbOffset);
    let probD = getScaledProb(ixm, iy0, dbOffset);
    let probE = getScaledProb(ix0, iym, dbOffset);
    let probF = getScaledProb(ixp, iym, dbOffset);

    let normX = ( 2f*(probD - probA) + (probC - probB) + (probE - probF) ) / 6f;
    let normY = ( 2f*(probE - probB) + (probF - probA) + (probD - probC) ) / 6f;

    let normal = vec3f( normX, normY, a );
    vsOut.normal = (uni.rot * vec4f(normalize(normal), 1)).xyz; 


    // Calculate the vertex color 
    let ixy0 = (ix0 + dbOffset) + (iy0 + dbOffset) * i32(uni.N.x);
    var stripeWeight = select(
        0f,
        pow( max(0f, wfIm[ixy0] * wfIp[ixy0]) * uni.wfScale / prob0, 12f ),
        (prob0 > 0) && (wfIm[ixy0] > 0f)
    );
    stripeWeight *= select(1f, 1e4*prob0, prob0 < 1e-4);

    let wfColor = select(uni.wfColor, uni.wfBorderColor, 
        showDampingBorder && ((ix0 < dbw) || (iy0 < dbw) || (ix0 > NxvM1-dbw) || (iy0 > NyvM1-dbw)) );
    vsOut.color = mix(wfColor, uni.wfStripeColor, stripeWeight); 
    
    return vsOut;
}


//
// Gets the (scaled) proability at a given grid point.
//
fn getScaledProb(ix: i32, iy: i32, offset: i32) -> f32
{
    let ixy = (ix + offset) + (iy + offset) * i32(uni.N.x);
    let R = wfR[ixy];
    return max(0f, (R*R + wfIm[ixy] * wfIp[ixy])) * uni.wfScale;
}


//
// Fragment shader
//
@fragment fn fragMain(vsOut: VSOutput) -> @location(0) vec4f 
{
    let vNormal = normalize(vsOut.normal);
    let lightDir = normalize(uni.lightDir);
    let cdot = clamp(-dot(vNormal, lightDir), 0f, 1f);

    let diffuseLight = uni.diffuseLightStrength * cdot;
    let specularLight = uni.specularStrength * pow(cdot, uni.specularShininess);
    let totalLight = diffuseLight + specularLight + uni.ambientLightStrength;

    return vec4f(vsOut.color.xyz * totalLight, vsOut.color.w);       
}
