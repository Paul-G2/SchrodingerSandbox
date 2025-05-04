
/**
 * @classdesc
 * This class impelements a 1-particle, 2-dimensional Visscher wavefunction.
 * Reference: Computers in Physics 5, 596 (1991).
 * 
 */
Wavefunction = class
{
    /**
     * @constructor
     * 
     * @param {Number} nx - Number of grid points along x.
     * @param {Number} ny - Number of grid points along y.
     * 
     */
    constructor(nx, ny)
    {
        this.nx = nx;
        this.ny = ny;

        const N = nx * ny;
        this.realPart  = new Float32Array(N);  // Real part, at time t        
        this.imagPartM = new Float32Array(N);  // Imaginary part at time t - dt/2
        this.imagPartP = new Float32Array(N);  // Imaginary part at time t + dt/2
        this.maxProb = 0;
    }


    /**
     * Creates a Gaussian wavepacket.
     *  
     * @param {Object} wfParams - The wavepacket parameters. See the RunParams ctor for an example.
     * @param {Object} grid - The grid parameters. See the RunParams ctor for an example.
     * 
     */
    static GaussianWavePacket(wfParams, grid)
    {
        const [nx, ny, a, dbw] = [grid.nx, grid.ny, grid.spacing, grid.dampingBorder];
        const nxp = nx - 2*dbw;
        const nyp = ny - 2*dbw;

        // x dependence
        const xwfReal = new Float32Array(nx);
        const xwfImag = new Float32Array(nx);
        const xctr = (dbw - 1) + wfParams.center.x * (nxp + 1);
        const ixStart = Math.round(xctr - (nx-1)/2);
        const sigmaX = (wfParams.width.x) * (nxp + 1);
        for (let ix = ixStart; ix < ixStart + nx; ix++)
        {
            const expFactor = Math.exp( -0.5*((ix - xctr)/sigmaX)**2 );
            const phase = wfParams.p.x * (ix * a);
            let n = (ix < 0) ? ix + nx : ix % nx;
            xwfReal[n] = expFactor * Math.cos(phase);
            xwfImag[n] = expFactor * Math.sin(phase);
        }

        // y dependence
        const ywfReal = new Float32Array(ny);
        const ywfImag = new Float32Array(ny);
        const yctr = (dbw - 1) + wfParams.center.y * (nyp + 1);
        const iyStart = Math.round(yctr - (ny-1)/2);
        const sigmaY = (wfParams.width.y) * (nyp + 1);
        for (let iy = iyStart; iy < iyStart + ny; iy++)
        {
            const expFactor = Math.exp( -0.5*((iy - yctr)/sigmaY)**2 );
            const phase = wfParams.p.y * (iy * a);
            let n = (iy < 0) ? iy + ny : iy % ny;
            ywfReal[n] = expFactor * Math.cos(phase);
            ywfImag[n] = expFactor * Math.sin(phase);
        }

        // The overall Gaussian is a direct product of the x and y factors.
        const wf = new Wavefunction(nx, ny);
        let normSq = 0;
        for (let y = 0; y < ny; y++)
        {
            const ywfR = ywfReal[y];
            const ywfI = ywfImag[y];
            const yOffset = y * nx;
            for (let x = 0; x < nx; x++)
            {
                const xwfR = xwfReal[x];
                const xwfI = xwfImag[x];
                const n = x + yOffset;
                const re = wf.realPart[n] = xwfR * ywfR  -  xwfI * ywfI;
                const im = wf.imagPartM[n] = wf.imagPartP[n] = xwfR * ywfI  +  xwfI * ywfR;

                const prob = re**2 + im**2;
                if (prob > wf.maxProb) { wf.maxProb = prob; }
                normSq += prob;
            }
        }
        
        // Normalize
        wf.maxProb /= normSq;
        const normInv = 1 / Math.sqrt(normSq);
        const nxy = nx*ny;
        for (let n=0; n<nxy; n++)
        {
            wf.realPart[n]  *= normInv;
            wf.imagPartM[n] *= normInv;
            wf.imagPartP[n] *= normInv;
        }
        return wf;
    }

}