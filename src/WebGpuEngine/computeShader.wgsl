//
// This is a compute shader that evolves the wavefunction by one time step. 
//
struct Uniforms {
    n: vec2<u32>,
    gridSpacing: f32,
    timeStep: f32,
    mass: f32
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var<storage, read_write> leftWf: array<f32>;
@group(0) @binding(2) var<storage, read> rightWf: array<f32>;
@group(0) @binding(3) var<storage, read_write> wfIm: array<f32>;
@group(0) @binding(4) var<storage, read> V: array<f32>;

override workgroupSizeX: u32 = 8;
override workgroupSizeY: u32 = 8;
override hamSign: f32 = 1.0;

@compute @workgroup_size(workgroupSizeX, workgroupSizeY) fn computeMain(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>
) {
    let nx = uni.n.x;
    let ny = uni.n.y;
    let nxm1 = nx - 1;
    let nym1 = ny - 1;

    let x = workgroup_id.x * workgroupSizeX + local_invocation_id.x;
    let y = workgroup_id.y * workgroupSizeY + local_invocation_id.y;
    if ((x >= nx) || (y >= ny)) { return; }

    let yOffset = y * nx;
    let ypOffset  = (select(0, y+1, y < nym1)) * nx;  // wrap-around
    let yppOffset = (select(select(1u, 0, y+2 == ny), y+2, y+2 < ny)) * nx;
    let ymOffset  = (select(nym1, y-1, y > 0)) * nx;
    let ymmOffset = (select(select(ny-2, nym1, y == 1), y-2, y > 1)) * nx;

    let xp  = select(0, x+1, x < nxm1);
    let xpp = select(0, xp+1, xp < nxm1);
    let xm  = select(nxm1, x-1, x > 0);
    let xmm = select(nxm1, xm-1, xm > 0);
    let nxy = yOffset + x;

    // This is the Visscher discretization of the Schrodinger equation
    // (see Computers in Physics 5, 596 (1991)):
    let keFactor = 
        1.0/(2.0 * uni.mass * uni.gridSpacing * uni.gridSpacing);
    let ke = keFactor * (
        5 * rightWf[nxy] -
        (4.0/3.0)  * (rightWf[yOffset + xm]  + rightWf[yOffset + xp]  + rightWf[ymOffset + x]  + rightWf[ypOffset + x]) +
        (1.0/12.0) * (rightWf[yOffset + xmm] + rightWf[yOffset + xpp] + rightWf[ymmOffset + x] + rightWf[yppOffset + x])
    );

    let Vcomp = V[nxy];
    let Vreal = max(0f, Vcomp);
    let Vimag = min(0f, Vcomp); // Imaginary potentials are encoded as negative values.
    if (hamSign < 0.0) { wfIm[nxy] = leftWf[nxy]; }
    leftWf[nxy] += uni.timeStep * (hamSign*(ke + Vreal*rightWf[nxy]) + Vimag*leftWf[nxy]);
}