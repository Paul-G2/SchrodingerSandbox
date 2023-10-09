/**
 * @classdesc
 * This class encapsulates all the parameters needed for a run of the 
 * wavefunction evolver.
 * 
 */
RunParams = class
{
    /**
     * @constructor
     * 
     * @param {App} app - The App instance.
     * @param {Number} gridSize - The number of points along each grid edge. 
     */
    constructor(app, gridSize)
    {
        this.app = app;

        // Set the grid params
        this.grid = {nx: gridSize, ny:gridSize, 
            spacing:160/gridSize, dampingBorder:Math.round(gridSize/6)};
        
        // Set the initial wavefunction
        this.initialWfParams = {
            p:      {x: 0.5,  y: 0.5}, 
            width:  {x: 0.1,  y: 0.1}, 
            center: {x: 0.25, y: 0.25}
        };
        this.initialWf = 
            Wavefunction.GaussianWavePacket(this.initialWfParams, this.grid);
        
        // Estimate the momentum in the initial wf (so we can calculate a reasonable Vmax, below)
        const [nx, ny, a, dbw] = [this.grid.nx, this.grid.ny, this.grid.spacing, this.grid.dampingBorder];
        const iwp = this.initialWfParams
        const pWf = Math.max(
            Math.abs(iwp.p.x) + 2*Math.abs(1/(iwp.width.x*a*(nx - 2*dbw))),
            Math.abs(iwp.p.y) + 2*Math.abs(1/(iwp.width.y*a*(ny - 2*dbw)))
        );

        this.mass               = 1;      
        this.showDampingBorder  = false;
        this.potential          = new Float32Array(nx * ny), 
        this.Vmax               = 4 * pWf**2 /(2*this.mass); // Several times the kinetic energy in the initial wavefunction
        this.timeStep           = 0.2 / (1/(this.mass*a*a) + this.Vmax); // Chosen to make the Visscher algorithm stable
        
        // Choose an evolutionChunkSize such that the apparent speed of the wave packet is (roughly) independent of the grid params
        const refTimeStep = 0.2 / (1/(this.mass*0.2*0.2) + this.Vmax);
        this.evolutionChunkSize = Math.max(1, Math.round(24*refTimeStep / this.timeStep)); 
        
        this.antiAlias = true;
        this.flatShade = false;
        this.wfScale = 0.18; // Determines the displayed height of the wavefunction

        // Colors and lighting
        this.wfColor               = [1.0, 0.5, 0.0, 1.0];
        this.wfBorderColor         = [0.6, 0.6, 0.6, 1.0];
        this.wfStripeColor         = [1.0, 1.0, 1.0, 1.0];
        this.ambientLightStrength  = 0.35;
        this.diffuseLightStrength  = 0.7;
        this.specularStrength      = 0.6;
        this.specularShininess     = 100;
        this.lightDir              = [-1, 0, 1];
        this.bkgndColor0           = [0.0, 0.28, 0.810, 1.0];
        this.bkgndColor1           = [0.0, 0.0, 0.263, 1.0];

        // No obstacles, initially
        this.obstacleSet = new ObstacleSet(app);
        this.updatePotential(true);
    } 


    /**
     * Recalculates the potential energy everywhere, based on the
     * current ObstacleSet.
     * 
     * @param {Boolean} [updateBorder=false] - Whether to recompute the damping-border. 
     * 
     */
    updatePotential(updateBorder=false)
    {
        const [nx, ny, dbw] = [this.grid.nx, this.grid.ny, this.grid.dampingBorder];
        const dbs = this.Vmax/2; // Damping strength

        let V = this.potential;
        if (!V || (V.length != nx*ny)) {
            V = this.potential = new Float32Array(nx*ny);
        }

        if (updateBorder) 
        { 
            // Precompute the damping-potential values
            const vDamping = [];
            for (let i=0; i<dbw; i++) {
                vDamping.push( -dbs*(1 - i/dbw)**3 );
            }

            // Fill the border regions with the damping-potential
            const nxy = nx * ny;
            for (let iy = 0; iy < dbw; iy++) {
                const yOffset = iy * nx;
                const Vd = vDamping[iy];
                for (let ix = 0; ix < nx; ix++) {
                    const i = ix + yOffset;
                    V[i] = V[nxy - 1 - i] = Vd;
                }
            }
            for (let ix = 0; ix < dbw; ix++) {
                const Vd = vDamping[ix];
                for (let iy = 0; iy < ny; iy++) {
                    const yOffset = iy * nx;
                    const i = ix + yOffset;
                    const ip = (nx - 1 - ix) + yOffset;
                    V[i]  = Math.min(V[i], Vd);
                    V[ip] = Math.min(V[ip], Vd);
                }
            }
        }

        // Zero the inner region
        for (let iy = dbw; iy < ny - dbw; iy++) {
            const yOffset = iy * nx;
            V.fill(0.0, yOffset + dbw, yOffset + nx - dbw, )
        }

        // Add the potential from the obstacles
        for (let ob of this.obstacleSet.obstacles)
        {
            const nxv = nx - 1 - 2*dbw;
            const nyv = ny - 1 - 2*dbw;
            const xmin = Math.max(dbw, dbw + Math.floor(ob.bbox.xmin * nxv));
            const ymin = Math.max(dbw, dbw + Math.floor(ob.bbox.ymin * nyv));
            const xmax = Math.min(nx-1-dbw,  dbw + Math.ceil(ob.bbox.xmax * nxv));
            const ymax = Math.min(ny-1-dbw,  dbw + Math.ceil(ob.bbox.ymax * nyv));
        
            for (let iy = ymin; iy <= ymax; iy++)
            {
                const iyv = iy - dbw;
                const yOffset = iy * nx;
                for (let ix = xmin; ix <= xmax; ix++)
                {
                    const ixv = ix - dbw;
                    const i = ix + yOffset;
                    const [xs, ys] = [ixv/nxv, iyv/nyv];
                    if ( ob.containsPoint(xs, ys, false) ) {
                        const vRel = ob.potentialIsConstant ? ob.vMax : ob.vFunc(xs, ys, false)
                        V[i] = Math.max(vRel*this.Vmax, V[i]);
                    }
                }
            }
        }
    }
    
}