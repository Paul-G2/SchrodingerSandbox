#version 300 es
//
// This shader renders the image we use for object-picking.
//
precision highp float;
precision highp int;
precision highp sampler2D;

uniform mat4   uMvp;
uniform mat4   uRot;
uniform ivec2  uN;
uniform float  uWfScale;
uniform int    uDampingBorderWidth;
uniform bool   uShowDampingBorder;
uniform int    uAttrsPerVertex;

uniform sampler2D uWfRealSampler;
uniform sampler2D uWfImagMSampler;
uniform sampler2D uWfImagPSampler;
uniform sampler2D uObstaclesSampler;

in float aLocalVertexIndex;
flat out vec4 vObjectId;

void wavefunctionVertShader(int);
void obstacleVertShader(int);
float getScaledProb(int, int, int);
float rgbaToFloat(vec4);


//
// Vertex shader main.
//
void main()
{
	int dbOffset = uShowDampingBorder ? 0 : uDampingBorderWidth;
    int numWfTrianglesToRender = 2 * (uN.x - 1 - 2*dbOffset) * (uN.y - 1 - 2*dbOffset);
	
	if (gl_InstanceID < numWfTrianglesToRender) {
            wavefunctionVertShader(gl_InstanceID);
    }
    else {
        obstacleVertShader(gl_InstanceID - numWfTrianglesToRender);
    }
}


//
// Wavefunction-vertex shader.
//
void wavefunctionVertShader(int triangleInstanceID)
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

    int ixL = ix[local_vertex_index];
    int iyL = iy[local_vertex_index];
    float theProb = getScaledProb(ixL, iyL, dbOffset);
    vec4 pos = vec4(a*float(ixL), a*float(iyL), theProb, 1);
    gl_Position = uMvp * pos;

    // All wf vertices have id = 1
    vObjectId = vec4(1.0/255.0, 1.0/255.0, 1.0/255.0, 1);	
}


//
// Obstacle-vertex shader.
//
void obstacleVertShader(int triangleInstanceID)
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

    if (uShowDampingBorder)
    {
        float dbw = float(uDampingBorderWidth);
        float kx = dbw / float(uN.x - 1);
        float ky = dbw / float(uN.y - 1);
        pos.x = pos.x * (1.0 - 2.0*kx) + kx;
        pos.y = pos.y * (1.0 - 2.0*ky) + ky;
    }
    gl_Position = uMvp * pos;
    
    tc.x += 8;
    if (tc.x >= textureWidth) { tc.x -= textureWidth;  tc.y += 1; } 
    float objId = texelFetch(uObstaclesSampler, tc, 0).x;
    vObjectId = vec4(objId/255.0, objId/255.0, objId/255.0, 1);	
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
// Decodes an rgba-encoded float value.
//
float rgbaToFloat(vec4 inVec)
{
    uvec4 bytes = uvec4( inVec * 255.0 );
    uint uintVal = (bytes.r << 24) | (bytes.g << 16) | (bytes.b << 8) | (bytes.a);
    return float(uintVal)/16777216.0 - 128.0;
}

// <End vertex shader>






#version 300 es
//
// Fragment shader
//
precision highp float;
flat in vec4 vObjectId;
out vec4 outColor;

void main()
{
	outColor = vObjectId;
}




