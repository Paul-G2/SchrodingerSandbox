#version 300 es
//
// This shader renders our wavefunction and obstacles.
//
precision highp float;
precision highp int;
precision highp sampler2D;

const float foffset = 128.0;
const float fscale = 16777216.0; // 2**24

uniform mat4   uMvp;
uniform mat4   uRot;
uniform vec4   uWfColor;
uniform vec4   uWfBorderColor;
uniform vec4   uWfStripeColor;
uniform ivec2  uN;
uniform float  uWfScale;
uniform bool   uFlatShade;
uniform int    uDampingBorderWidth;
uniform bool   uShowDampingBorder;
uniform int    uAttrsPerVertex;
uniform float  uAmbientLightStrength;
uniform float  uDiffuseLightStrength;
uniform float  uSpecularStrength;
uniform float  uSpecularShininess;
uniform int    uActiveObjectId;
uniform vec3   uLightDir;

uniform sampler2D uWfRealSampler;
uniform sampler2D uWfImagMSampler;
uniform sampler2D uWfImagPSampler;
uniform sampler2D uObstaclesSampler;

in float aLocalVertexIndex;
out vec3 vNormal;
out vec4 vColor;

void wavefunctionVertFlat(int);
void wavefunctionVertSmooth(int);
void obstacleVert(int);
float getScaledProb(int, int, int);
vec3 getWfVals(int, int, int);
float rgbaToFloat(vec4);


//
// Vertex shader main.
//
void main()
{
    int dbOffset = uShowDampingBorder ? 0 : uDampingBorderWidth;
    int numWfTrianglesToRender = 2 * (uN.x - 1 - 2*dbOffset) * (uN.y - 1 - 2*dbOffset);
    
    if (gl_InstanceID < numWfTrianglesToRender) {
        if (uFlatShade) {
            wavefunctionVertFlat(gl_InstanceID);
        } else {
            wavefunctionVertSmooth(gl_InstanceID);
        }
    }
    else {
        obstacleVert(gl_InstanceID - numWfTrianglesToRender);
    }
}


//
// Obstacle-vertex shader
//
void obstacleVert(int triangleInstanceID)
{
    int vertexIndex = 3*triangleInstanceID + int(aLocalVertexIndex + 0.5);

    vec4 pos = vec4(0,0,0,1);
    vec3 normal = vec3(0,0,0);
    vec4 color = vec4(0,0,0,1);
    int textureWidth = textureSize(uObstaclesSampler, 0).x;
    int base = uAttrsPerVertex * vertexIndex;

    ivec2 tc = ivec2(base % textureWidth, base/textureWidth);
    pos.x = texelFetch(uObstaclesSampler, tc, 0).x;

    tc.x += 1;
    if (tc.x == textureWidth) { tc.x = 0;  tc.y += 1; } 
    pos.y = texelFetch(uObstaclesSampler, tc, 0).x;

    tc.x += 1;
    if (tc.x == textureWidth) { tc.x = 0;  tc.y += 1; } 
    pos.z = texelFetch(uObstaclesSampler, tc, 0).x;

    tc.x += 1;
    if (tc.x == textureWidth) { tc.x = 0;  tc.y += 1; } 
    normal.x = texelFetch(uObstaclesSampler, tc, 0).x;

    tc.x += 1;
    if (tc.x == textureWidth) { tc.x = 0;  tc.y += 1; } 
    normal.y = texelFetch(uObstaclesSampler, tc, 0).x;

    tc.x += 1;
    if (tc.x == textureWidth) { tc.x = 0;  tc.y += 1; } 
    normal.z = texelFetch(uObstaclesSampler, tc, 0).x;

    tc.x += 1;
    if (tc.x == textureWidth) { tc.x = 0;  tc.y += 1; } 
    color.r = texelFetch(uObstaclesSampler, tc, 0).x;

    tc.x += 1;
    if (tc.x == textureWidth) { tc.x = 0;  tc.y += 1; } 
    color.g = texelFetch(uObstaclesSampler, tc, 0).x;

    tc.x += 1;
    if (tc.x == textureWidth) { tc.x = 0;  tc.y += 1; } 
    color.b = texelFetch(uObstaclesSampler, tc, 0).x;

    tc.x += 1;
    if (tc.x == textureWidth) { tc.x = 0;  tc.y += 1; } 
    color.a = texelFetch(uObstaclesSampler, tc, 0).x;

    tc.x += 1;
    if (tc.x == textureWidth) { tc.x = 0;  tc.y += 1; } 
    int objId = int(texelFetch(uObstaclesSampler, tc, 0).x + 0.5);

    // Highlight the active obstacle
    if (objId == uActiveObjectId) {
        color *= 1.4; 
        color.a = 1.0;
    }

    if (uShowDampingBorder)
    {
        float dbw = float(uDampingBorderWidth);
        float kx = dbw / float(uN.x - 1);
        float ky = dbw / float(uN.y - 1);
        pos.x = pos.x * (1.0 - 2.0*kx) + kx;
        pos.y = pos.y * (1.0 - 2.0*ky) + ky;
    }
    gl_Position = uMvp * pos;
    vNormal = (uRot * vec4(normalize(normal), 1)).xyz; 
    vColor = color;
}



//
// Wavefunction-vertex shader (flat-shading version).
//
void wavefunctionVertFlat(int triangleInstanceID)
{
    int dbw = uDampingBorderWidth;
    int dbOffset = uShowDampingBorder ? 0 : dbw;
    
    int NxvM1 = uN.x - 1 - 2*dbOffset; // # of visible grid points along x
    int NyvM1 = uN.y - 1 - 2*dbOffset; // # of visible grid points along y
    float a = 1.0 / float(max(NxvM1, NyvM1));


    // Calculate the vertex position
    int triangle_index = triangleInstanceID;
    int local_vertex_index = int(aLocalVertexIndex + 0.5);
    int upper_triangle_offset = triangle_index % 2; 

    int triy = triangle_index / (2*NxvM1);
    int trix = triangle_index % (2*NxvM1);
    int sign = 1 - 2*upper_triangle_offset;
    float fsign = float(sign);

    int ix[3];
    int iy[3];
    ix[0] = trix/2 + upper_triangle_offset;
    iy[0] = triy   + upper_triangle_offset;

    ix[1] = ix[0] + sign;
    iy[1] = iy[0];

    ix[2] = ix[0]; 
    iy[2] = iy[0] + sign;    

    float prob[3];
    prob[0] = getScaledProb(ix[0], iy[0], dbOffset);
    prob[1] = getScaledProb(ix[1], iy[1], dbOffset);
    prob[2] = getScaledProb(ix[2], iy[2], dbOffset);

    int ixL = ix[local_vertex_index];
    int iyL = iy[local_vertex_index];
    float theProb = prob[local_vertex_index];
    vec4 pos = vec4(a*float(ixL), a*float(iyL), theProb, 1);
    gl_Position = uMvp * pos;


    // Calculate the vertex normal 
    vec3 normal = vec3(fsign*(prob[0] - prob[1]), fsign*(prob[0] - prob[2]), a);
    vNormal = (uRot * vec4(normalize(normal), 1)).xyz; 


    // Calculate the vertex color 
    float pwr = max(2.0, min(12.0, float(uN.x)/128.0));
    vec3 wfVals = getWfVals(ixL, iyL, dbOffset);
    float stripeWeight = (theProb <= 0.0) || (wfVals.y <= 0.0) ? 0.0 :
        pow( max(0.0, wfVals.y*wfVals.z) * uWfScale/theProb, pwr );
    stripeWeight *= (theProb < 1e-4) ? 1e4*theProb : 1.0;

    vec4 wfColor = 
        (uShowDampingBorder && ((ixL < dbw) || (iyL < dbw) || (ixL > NxvM1-dbw) || (iyL > NyvM1-dbw))) ?
        uWfBorderColor : uWfColor; 
    vColor = mix(wfColor, uWfStripeColor, stripeWeight);     
}


//
// Wavefunction-vertex shader (smooth-shading version).
//
void wavefunctionVertSmooth(int triangleInstanceID)
{
    int dbw = uDampingBorderWidth;
    int dbOffset = uShowDampingBorder ? 0 : dbw;
    
    int NxvM1 = uN.x - 1 - 2*dbOffset; // # of visible grid points along x
    int NyvM1 = uN.y - 1 - 2*dbOffset; // # of visible grid points along y
    float a = 1.0 / float(max(NxvM1, NyvM1));


    // Calculate the vertex position
    int triangle_index = triangleInstanceID;
    int local_vertex_index = int(aLocalVertexIndex + 0.5);
    int upper_triangle_offset = triangle_index % 2; 
    int sign = 1 - 2*upper_triangle_offset;

    int triy = triangle_index / (2*NxvM1);
    int trix = triangle_index % (2*NxvM1);

    int ix0 = trix/2 + upper_triangle_offset + (local_vertex_index == 1 ? sign : 0);
    int iy0 = triy   + upper_triangle_offset + (local_vertex_index == 2 ? sign : 0);

    float prob0 = getScaledProb(ix0, iy0, dbOffset);
    vec4 pos = vec4(a*float(ix0), a*float(iy0), prob0, 1);
    gl_Position = uMvp * pos;


    // Calculate the vertex normal (average of nearby normals)
    int ixp = ix0 < NxvM1 ? ix0 + 1 : 0; 
    int iyp = iy0 < NyvM1 ? iy0 + 1 : 0;
    int ixm = ix0 > 0 ? ix0 - 1 : NxvM1; 
    int iym = iy0 > 0 ? iy0 - 1 : NyvM1;

    float probA = getScaledProb(ixp, iy0, dbOffset);
    float probB = getScaledProb(ix0, iyp, dbOffset);
    float probC = getScaledProb(ixm, iyp, dbOffset);
    float probD = getScaledProb(ixm, iy0, dbOffset);
    float probE = getScaledProb(ix0, iym, dbOffset);
    float probF = getScaledProb(ixp, iym, dbOffset);

    float normX = ( 2.0*(probD - probA) + (probC - probB) + (probE - probF) ) / 6.0;
    float normY = ( 2.0*(probE - probB) + (probF - probA) + (probD - probC) ) / 6.0;

    vec3 normal = vec3(normX, normY, a);
    vNormal = (uRot * vec4(normalize(normal), 1)).xyz; 


    // Calculate the vertex color 
    float pwr = max(2.0, min(12.0, float(uN.x)/128.0));
    vec3 wfVals = getWfVals(ix0, iy0, dbOffset);
    float stripeWeight = (prob0 <= 0.0) || (wfVals.y <= 0.0) ? 0.0 :
        pow( max(0.0, wfVals.y*wfVals.z) * uWfScale/prob0, pwr );
    stripeWeight *= (prob0 < 1e-4) ? 1e4*prob0 : 1.0;

    vec4 wfColor = 
        (uShowDampingBorder && ((ix0 < dbw) || (iy0 < dbw) || (ix0 > NxvM1-dbw) || (iy0 > NyvM1-dbw))) ?
        uWfBorderColor : uWfColor; 
    vColor = mix(wfColor, uWfStripeColor, stripeWeight);     
}


//
// Returns the scaled probabilty density at a given location.
//
float getScaledProb(int ix, int iy, int offset)
{
    ivec2 tc = ivec2(ix + offset, iy + offset);
    float R = rgbaToFloat( texelFetch(uWfRealSampler, tc, 0) );
    float Im = rgbaToFloat( texelFetch(uWfImagMSampler, tc, 0) );
    float Ip = rgbaToFloat( texelFetch(uWfImagPSampler, tc, 0) );

    return max(0.0, (R*R + Im*Ip)) * uWfScale;    
}


//
// Returns the wavefunction values at a given location.
//
vec3 getWfVals(int ix, int iy, int offset)
{
    ivec2 tc = ivec2(ix + offset, iy + offset);
    float R = rgbaToFloat( texelFetch(uWfRealSampler, tc, 0) );
    float Im = rgbaToFloat( texelFetch(uWfImagMSampler, tc, 0) );
    float Ip = rgbaToFloat( texelFetch(uWfImagPSampler, tc, 0) );

    return vec3(R, Im, Ip);    
}


//
// Decodes an rgba-encoded float value.
//
float rgbaToFloat(vec4 inVec)
{
    uvec4 bytes = uvec4( inVec * 255.0 );
    uint uintVal = (bytes.r << 24) | (bytes.g << 16) | (bytes.b << 8) | (bytes.a);
    return float(uintVal)/fscale - foffset;
}

// <End vertex shader>







#version 300 es
//
// Fragment shader
//
precision highp float;

uniform float  uAmbientLightStrength;
uniform float  uDiffuseLightStrength;
uniform float  uSpecularStrength;
uniform float  uSpecularShininess;
uniform vec3   uLightDir;

in vec3 vNormal;
in vec4 vColor;
out vec4 outColor;

void main()
{
    vec3 normal = normalize(vNormal);    
    vec3 lightDir = normalize(uLightDir);    
    float cdot = clamp(-1.0*dot(normal, lightDir), 0.0, 1.0);

    float diffuseLight = uDiffuseLightStrength * cdot;
    float specularLight = uSpecularStrength * pow(cdot, uSpecularShininess);
    float totalLight = diffuseLight + specularLight + uAmbientLightStrength;

    outColor = vec4(vColor.xyz * totalLight, vColor.w);
}
