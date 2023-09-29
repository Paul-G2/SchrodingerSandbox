/**
 * @classdesc
 * This class implements a cylinder-shaped obstacle.
 * 
 */
class Cylinder extends Obstacle
{
    /**
     * @constructor
     * 
     */
    constructor({center=[0.5, 0.5], radius=0.05, height=0.25, vMax=1.0, color=[0,1,0,1]} = {}) 
    { 
        // Inherit from Obstacle
        super('cylinder');
        
        this.phiCount = 32;
        this.center = [...center];
        this.radius = radius;
        this.height = height;
        this.vMax = vMax;
        this.color = [...color];

        this.update();
    }


    /**
     * Recomputes the shape's vertices.
     * 
     */
    update()
    {
        // Update the shape vertices
        const sv = this.shapeVertices = [];

        const cx = this.center[0];
        const cy = this.center[1];
        const deltaPhi = 2*Math.PI/this.phiCount;
        const r = this.radius;
        for (let ip = 0; ip < this.phiCount; ip++) {
            const phi = ip * deltaPhi;
            sv.push( [r*Math.cos(phi) + cx, r*Math.sin(phi) + cy, this.height] );
        }
        for (let ip = 0; ip < this.phiCount; ip++) {
            sv.push( [sv[ip][0], sv[ip][1], 0] );
        }
        
        // Update the bounding box
        this.bbox = {
            xmin: cx - this.radius,  xmax: cx + this.radius, 
            ymin: cy - this.radius,  ymax: cy + this.radius,
            zmin: 0,  zmax: this.height
        };

        // Update the triangle vertices
        const tv = this.triangleVertices = [];
        const color = this.color;

        const normal = [0, 0, 1];
        for (let ip = 0; ip < this.phiCount; ip++)
        {
            const ipp = (ip+1) % this.phiCount;
            tv.push( cx, cy, this.height,  ...normal, ...color, this.id );
            tv.push( ...sv[ip],            ...normal, ...color, this.id );
            tv.push( ...sv[ipp],           ...normal, ...color, this.id );
        }
        
        const pc = this.phiCount;
        for (let ip = 0; ip < this.phiCount; ip++)
        {
            const ipp  = (ip+1) % this.phiCount;
            const phi  = ip * deltaPhi;
            const phip = ipp * deltaPhi;
            const normal = [Math.cos(phi), Math.sin(phi), 0];
            const normalp = [Math.cos(phip), Math.sin(phip), 0];
            
            tv.push( ...sv[ip],       ...normal,  ...color, this.id );
            tv.push( ...sv[ip + pc],  ...normal,  ...color, this.id );
            tv.push( ...sv[ipp],      ...normalp, ...color, this.id );
            
            tv.push( ...sv[ipp],      ...normalp, ...color, this.id );
            tv.push( ...sv[ipp + pc], ...normalp, ...color, this.id );
            tv.push( ...sv[ip  + pc], ...normal,  ...color, this.id );
        }
    }


    /**
     * Determines whether a given point is inside the shape's footprint.
     * 
     */
    containsPoint = function (x, y) 
    {
        const dx = x - this.center[0];
        const dy = y - this.center[1];

        return dx*dx + dy*dy <= this.radius*this.radius;
    };    

}

