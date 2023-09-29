/**
 * @classdesc
 * This class implements a ramp-shaped obstacle.
 * 
 */
class Ramp extends Obstacle
{
    /**
     * @constructor
     * 
     */
    constructor({center=[.5, .5], length=0.4, depth=0.35, angle=-45, 
        height=0.12, vMax=1.0, color=[1,1,0,1]} = {}) 
    { 
        // Inherit from Obstacle
        super('ramp');
        
        this.center = [...center];
        this.length = length;
        this.depth = depth;
        this.angle = angle;
        this.height = height;
        this.vMax = vMax;
        this.color = [...color];
        this.potentialIsConstant = false;

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
        const cos = Math.cos(this.angle * Math.PI/180);
        const sin = Math.sin(this.angle * Math.PI/180);
        const cx = this.center[0];
        const cy = this.center[1];
        const hd = this.depth/2; 
        const hL = this.length/2; 

        // Bottom vertices
        let [vx, vy] = [hL, hd];
        sv.push( [vx*cos - vy*sin + cx, vx*sin + vy*cos + cy, 0] );

        [vx, vy] = [-hL, hd];
        sv.push( [vx*cos - vy*sin + cx, vx*sin + vy*cos + cy, 0] );

        [vx, vy] = [-hL, -hd];
        sv.push( [vx*cos - vy*sin + cx, vx*sin + vy*cos + cy, 0] );

        [vx, vy] = [hL, -hd];
        sv.push( [vx*cos - vy*sin + cx, vx*sin + vy*cos + cy, 0] );
        
        // Top vertices
        sv.push( [sv[0][0], sv[0][1], this.height] );
        sv.push( [sv[1][0], sv[1][1], this.height] );
        sv.push( [sv[2][0], sv[2][1], 0] );
        sv.push( [sv[3][0], sv[3][1], 0] );

        // Update the bounding box
        this.bbox = {xmin:sv[0][0], xmax:sv[0][0], ymin:sv[0][1], ymax:sv[0][1], zmin:0, zmax:this.height};
        for (let v of sv) {
            if ((this.bbox.xmin > v[0])) { this.bbox.xmin = v[0]; }
            if ((this.bbox.xmax < v[0])) { this.bbox.xmax = v[0]; }
            if ((this.bbox.ymin > v[1])) { this.bbox.ymin = v[1]; }
            if ((this.bbox.ymax < v[1])) { this.bbox.ymax = v[1]; }
        }

        // Update the triangle vertices
        const vec3 = glMatrix.vec3;
        const color = this.color;
        const tv = this.triangleVertices = [];

        let normal = [sv[1][1] - sv[0][1], sv[0][0] - sv[1][0], 0];
        vec3.normalize(normal, normal);
        tv.push(...sv[0], ...normal, ...color, this.id);
        tv.push(...sv[1], ...normal, ...color, this.id);
        tv.push(...sv[5], ...normal, ...color, this.id);

        tv.push(...sv[0], ...normal, ...color, this.id);
        tv.push(...sv[5], ...normal, ...color, this.id);
        tv.push(...sv[4], ...normal, ...color, this.id);

        normal = [sv[2][1] - sv[1][1], sv[1][0] - sv[2][0], 0];
        vec3.normalize(normal, normal);
        tv.push(...sv[2], ...normal, ...color, this.id);
        tv.push(...sv[1], ...normal, ...color, this.id);
        tv.push(...sv[5], ...normal, ...color, this.id);
        
        vec3.negate(normal, normal);
        tv.push(...sv[3], ...normal, ...color, this.id);
        tv.push(...sv[0], ...normal, ...color, this.id);
        tv.push(...sv[4], ...normal, ...color, this.id);    

        normal = vec3.normalize([0,0,0], [-this.height,0, this.depth]);
        tv.push(...sv[6], ...normal, ...color, this.id);
        tv.push(...sv[7], ...normal, ...color, this.id);
        tv.push(...sv[5], ...normal, ...color, this.id);

        tv.push(...sv[7], ...normal, ...color, this.id);
        tv.push(...sv[4], ...normal, ...color, this.id);
        tv.push(...sv[5], ...normal, ...color, this.id);
    }


    /**
     * Determines whether a given point is inside the shape's footprint.
     * 
     */
    containsPoint = function (x, y, checkBBox=false) 
    {
        // Quick bbox check
        if (checkBBox) {
            const bbox = this.bbox;
            if ( (x < bbox.xmin) || (x > bbox.xmax) || (y < bbox.ymin) || (y > bbox.ymax) ) {
                return false;
            }
        }

        // Detailed check
        let result = false;
        const sv = this.shapeVertices
        const numFootprintVertices = 4;
        for ( let i=0, j=numFootprintVertices-1; i<numFootprintVertices; j=i++ )
        {
            const [Vi0, Vi1] = [ sv[i][0], sv[i][1] ];
            const [Vj0, Vj1] = [ sv[j][0], sv[j][1] ];

            const testA = (Vj1 - Vi1) * (x - Vi0);
            const testB = (Vj0 - Vi0) * (y - Vi1);

            if ( ( (Vi1 <= y)  &&  (y < Vj1)  &&  (testA < testB)  ) ||
                 ( (Vj1 <= y)  &&  (y < Vi1)  &&  (testA > testB)  ) )  { 
                result = !result; 
            }
        }
        return result;
    };


    /**
     * Computes the ramp potential at a given point.
     * 
     */
    vFunc(x, y, checkBBox=false)
    {
        if (checkBBox && !this.containsPoint(x,y,true)) {
            return 0.0;
        }

        const xyRel0 = x - this.center[0];
        const xyRel1 = y - this.center[1];
        const yDir0 = this.shapeVertices[1][0] - this.shapeVertices[2][0];
        const yDir1 = this.shapeVertices[1][1] - this.shapeVertices[2][1];
        const yDirLen = Math.sqrt(yDir0*yDir0 + yDir1*yDir1);
        
        const yp = (xyRel0*yDir0 + xyRel1*yDir1) / yDirLen;
        return (yp/this.depth) * this.vMax;
    }
}

