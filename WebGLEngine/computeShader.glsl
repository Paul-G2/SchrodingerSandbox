#version 300 es
//
// This is a compute shader that evolves the wavefunction by one time step. 
//
precision highp float;
precision highp int;
in vec4 aPosition;

//
// Vertex shader.
//
void main()
{
    gl_Position = aPosition;
}

// <End vertex shader>





#version 300 es
//
// Fragment shader
//
precision highp float;
precision highp int;
precision highp sampler2D;

const float foffset = 128.0;
const float fscale = 16777216.0; // 2**24
const vec4  bitFactors = pow(vec4(2, 2, 2, 2), vec4(24, 16, 8, 0)) * 255.0;
const uvec4 bitMask = uvec4(bitFactors + 0.5);

uniform sampler2D uRightWfSampler;
uniform sampler2D uLeftWfSampler;
uniform sampler2D uPotentialSampler;
uniform ivec2  uN;
uniform float uMass;
uniform float uGridSpacing;
uniform float uTimeStep;
uniform float uHamSign;
out vec4 outColor;

vec4 floatToRgba(float);
float rightWf(int, int);
float leftWf(int, int);

//
// Fragment shader main
// 
void main()
{
    int Nxm1 = uN.x - 1;
    int Nym1 = uN.y - 1;

    int x   = int(gl_FragCoord.x);
    int y   = int(gl_FragCoord.y);
    int xp  = x < Nxm1 ? x+1 : 0;
    int yp  = y < Nym1 ? y+1 : 0;
    int xm  = x > 0 ? x-1 : Nxm1;
    int ym  = y > 0 ? y-1 : Nym1;    
    int xpp = xp < Nxm1 ? xp+1 : 0;
    int ypp = yp < Nym1 ? yp+1 : 0;
    int xmm = xm > 0 ? xm-1 : Nxm1;
    int ymm = ym > 0 ? ym-1 : Nym1;

    float keFactor = 1.0/(2.0 * uMass * uGridSpacing * uGridSpacing);
    float rightWfxy = rightWf(x, y);
    float ke = keFactor * (
        5.0 * rightWfxy -
        ((4.0/3.0)  * ( rightWf(xm, y)   + rightWf(xp, y)  +  rightWf(x, ym)   + rightWf(x, yp)  )) +
        ((1.0/12.0) * ( rightWf(xmm, y)  + rightWf(xpp, y) +  rightWf(x, ymm)  + rightWf(x, ypp) ))
    );

    float V = texelFetch(uPotentialSampler, ivec2(x,y), 0).x;
    float Vreal = max(0.0, V);
    float Vimag = min(0.0, V); // Interpret negative potentials as imaginary

    // This is the Visscher discretization of the Schrodinger equation (see Computers in Physics 5, 596 (1991))
    float outVal = leftWf(x,y)*(1.0 + uTimeStep*Vimag) + uHamSign*uTimeStep*(ke + Vreal*rightWfxy);

    outColor = floatToRgba(outVal);
}

//
// Get's the "right-hand" wavefunction at a given point
//
float rightWf(int x, int y)
{
    return dot( texelFetch(uRightWfSampler, ivec2(x,y), 0), bitFactors/fscale ) - foffset;
}


//
// Get's the "left-hand" wavefunction at a given point
//
float leftWf(int x, int y)
{
    return dot( texelFetch(uLeftWfSampler, ivec2(x,y), 0), bitFactors/fscale ) - foffset;
}


//
// Encodes a floating-point value into an rgba texel.
//
vec4 floatToRgba(float fval)
{
    uvec4 uVal = uvec4( uint(round((fval + foffset)*fscale)) ); // All 4 elements the same
    return (vec4(uVal & bitMask) / bitFactors);
}

