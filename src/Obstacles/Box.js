/**
 * @classdesc
 * This class implements a cuboid-shaped obstacle.
 * 
 */
class Box extends Obstacle
{
    /**
	 * @constructor
	 * 
	 */
	constructor({center=[.5, .5], length=0.2, thickness=0.051, angle=-45, 
		height=0.2501, vMax=1.0, color=[0.33, 0.33, 1, 1]} = {}) 
	{ 
		// Inherit from Obstacle
		super('box');
		
		this.center = [...center];
		this.length = length;
		this.thickness = thickness;
		this.angle = angle;
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
		const cos = Math.cos(this.angle * Math.PI/180);
		const sin = Math.sin(this.angle * Math.PI/180);
		const cx = this.center[0];
		const cy = this.center[1];
		const ht = this.thickness/2; 
		const hL = this.length/2; 

		// Bottom shape vertices
		let vx = hL;
		let vy = ht;
		sv.push( [vx*cos - vy*sin + cx, vx*sin + vy*cos + cy, 0] );

		vx = -hL;
		vy = ht;
		sv.push( [vx*cos - vy*sin + cx, vx*sin + vy*cos + cy, 0] );

		vx = -hL;
		vy = -ht;
		sv.push( [vx*cos - vy*sin + cx, vx*sin + vy*cos + cy, 0] );

		vx = hL;
		vy = -ht;
		sv.push( [vx*cos - vy*sin + cx, vx*sin + vy*cos + cy, 0] );
		
		// Top shape vertices
		sv.push( [sv[0][0], sv[0][1], this.height] );
		sv.push( [sv[1][0], sv[1][1], this.height] );
		sv.push( [sv[2][0], sv[2][1], this.height] );
		sv.push( [sv[3][0], sv[3][1], this.height] );

		// Update the bounding box
		this.bbox = {xmin:sv[0][0], xmax:sv[0][0], ymin:sv[0][1], ymax:sv[0][1], zmin:0, zmax:this.height};
		for (let v of sv)
		{
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

		vec3.negate(normal, normal);
		tv.push(...sv[3], ...normal, ...color, this.id);
		tv.push(...sv[2], ...normal, ...color, this.id);
		tv.push(...sv[6], ...normal, ...color, this.id);

		tv.push(...sv[3], ...normal, ...color, this.id);
		tv.push(...sv[6], ...normal, ...color, this.id);
		tv.push(...sv[7], ...normal, ...color, this.id);

		normal = [sv[2][1] - sv[1][1], sv[1][0] - sv[2][0], 0];
		vec3.normalize(normal, normal);
		tv.push(...sv[2], ...normal, ...color, this.id);
		tv.push(...sv[1], ...normal, ...color, this.id);
		tv.push(...sv[5], ...normal, ...color, this.id);

		tv.push(...sv[2], ...normal, ...color, this.id);
		tv.push(...sv[5], ...normal, ...color, this.id);
		tv.push(...sv[6], ...normal, ...color, this.id);
		
		vec3.negate(normal, normal);
		tv.push(...sv[3], ...normal, ...color, this.id);
		tv.push(...sv[0], ...normal, ...color, this.id);
		tv.push(...sv[4], ...normal, ...color, this.id);

		tv.push(...sv[3], ...normal, ...color, this.id);
		tv.push(...sv[4], ...normal, ...color, this.id);
		tv.push(...sv[7], ...normal, ...color, this.id);		

		normal = [0, 0, 1];
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

}

