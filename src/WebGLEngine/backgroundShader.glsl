#version 300 es
//
// This shader draws our gradient backgrount.
//
precision highp float;
precision highp int;
uniform vec4   uColor0;
uniform vec4   uColor1;
in float aLocalVertexIndex;
out vec4 vColor;

//
// Vertex shader main.
//
void main()
{
    int vertexIndex = 3*gl_InstanceID + int(aLocalVertexIndex + 0.5);

	switch (vertexIndex) {
        case 0:  { gl_Position = vec4(-1, -1, 0, 1);  vColor = uColor0; break; }
        case 1:  { gl_Position = vec4(-1,  1, 0, 1);  vColor = uColor1; break; }
        case 2:  { gl_Position = vec4( 1, -1, 0, 1);  vColor = uColor0; break; }
        case 3:  { gl_Position = vec4(-1,  1, 0, 1);  vColor = uColor1; break; }
        case 4:  { gl_Position = vec4( 1, -1, 0, 1);  vColor = uColor0; break; }
        default: { gl_Position = vec4( 1,  1, 0, 1);  vColor = uColor1; break; }
    }
}
// <End vertex shader>



#version 300 es
precision highp float;
in vec4 vColor;
out vec4 outColor;

//
// Fragment shader main
// 
void main()
{
	outColor = vColor;
}




