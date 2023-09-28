/**
 * @classdesc
 * This class implements an arc-shaped obstacle.
 * 
 */
class Arc extends Obstacle
{
    /**
	 * @constructor
	 * 
	 */
	constructor({center=[0.5, 0.5], radius=0.2, thickness=0.05, angle=45, span=180, 
		height=0.1999, vMax=1.0, color=[0.85, 0, 0.85, 1]} = {}) 
	{ 
		// Inherit from Obstacle
		super('arc');
		
		this.center = [...center];
		this.radius = radius;
		this.thickness = thickness;
		this.angle = angle;
		this.span = span;
		this.height = height;
		this.vMax = vMax;
		this.color = [...color];

		this.minRsq = (radius - thickness/2)**2;
		this.maxRsq = (radius + thickness/2)**2;
		
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
		const numSegs = Math.abs(Math.round(this.span/6)); // About 6 degrees per segment
		const segSizeRads = Math.abs(this.span/numSegs) * (Math.PI/180);
		const angleStartRads = (this.angle - this.span/2) * (Math.PI/180);

		const rm = this.radius - this.thickness/2;
		const rp = this.radius + this.thickness/2;
		const cx = this.center[0];
		const cy = this.center[1];
		const bbox = this.bbox;

		// Bottom vertices
		for (let s=0; s<numSegs+1; s++)
		{
			const theta = angleStartRads + s*segSizeRads;
			const cos = Math.cos(theta);
			const sin = Math.sin(theta);
			let [xm, ym] = [cx + rm*cos, cy + rm*sin];
			let [xp, yp] = [cx + rp*cos, cy + rp*sin];
			sv.push( [xm, ym, 0] );
			sv.push( [xp, yp, 0] );

			if (s == 0) {
				[bbox.xmin, bbox.xmax] = [Math.min(xm, xp), Math.max(xm, xp)];
				[bbox.ymin, bbox.ymax] = [Math.min(ym, yp), Math.max(ym, yp)];
			} else {
				[bbox.xmin, bbox.xmax] = [Math.min(bbox.xmin, xm, xp), Math.max(bbox.xmax, xm, xp)];
				[bbox.ymin, bbox.ymax] = [Math.min(bbox.ymin, ym, yp), Math.max(bbox.ymax, ym, yp)];
			}
		}
		[bbox.zmin, bbox.zmax] = [0, this.height];

		// Top vertices
		for (let s=0; s<2*(numSegs+1); s++)
		{
			sv.push( [sv[s][0], sv[s][1], this.height] );
		}

		// Update the triangle vertices
		const vec3 = glMatrix.vec3;
		const color = this.color;
		const tv = this.triangleVertices = [];
		const ns = numSegs;
		const d = 2*(ns + 1);

		for (let s=0; s<2*ns; s+=2)
		{
			let normalA = [cx - sv[s][0], cy - sv[s][1], 0];
			let normalB = [cx - sv[s+2][0], cy - sv[s+2][1], 0];
			vec3.normalize(normalA, normalA);
			tv.push(...sv[s],   ...normalA, ...color, this.id);
			tv.push(...sv[s+d], ...normalA, ...color, this.id);
			tv.push(...sv[s+2], ...normalB, ...color, this.id);		
			
			tv.push(...sv[s+d],   ...normalA, ...color, this.id);
			tv.push(...sv[s+2],   ...normalB, ...color, this.id);
			tv.push(...sv[s+d+2], ...normalB, ...color, this.id);			

			normalA = [-normalA[0], -normalA[1], 0];
			normalB = [-normalB[0], -normalB[1], 0];
			tv.push(...sv[s+1],   ...normalA, ...color, this.id);
			tv.push(...sv[s+1+d], ...normalA, ...color, this.id);
			tv.push(...sv[s+3],   ...normalB, ...color, this.id);		

			tv.push(...sv[s+1+d], ...normalA, ...color, this.id);
			tv.push(...sv[s+3],   ...normalB, ...color, this.id);
			tv.push(...sv[s+d+3], ...normalB, ...color, this.id);	
			
			// Top face
			let normal = [0, 0, 1];
			const sd = s + d;
			tv.push(...sv[sd],   ...normal, ...color, this.id);
			tv.push(...sv[sd+1], ...normal, ...color, this.id);
			tv.push(...sv[sd+2], ...normal, ...color, this.id);		
			
			tv.push(...sv[sd+1], ...normal, ...color, this.id);
			tv.push(...sv[sd+2], ...normal, ...color, this.id);
			tv.push(...sv[sd+3], ...normal, ...color, this.id);		
		}
			
		// End faces
		let normal = [sv[1][1]-sv[0][1], sv[0][0]-sv[1][0], 0];
		tv.push(...sv[0],   ...normal, ...color, this.id);
		tv.push(...sv[1],   ...normal, ...color, this.id);
		tv.push(...sv[d+1], ...normal, ...color, this.id);		
		tv.push(...sv[0],   ...normal, ...color, this.id);
		tv.push(...sv[d],   ...normal, ...color, this.id);
		tv.push(...sv[d+1], ...normal, ...color, this.id);		

		const ns2 = 2*ns;
		normal = [sv[ns2][1]-sv[ns2+1][1], sv[ns2+1][0]-sv[ns2][0], 0];
		tv.push(...sv[ns2],     ...normal, ...color, this.id);
		tv.push(...sv[ns2+1],   ...normal, ...color, this.id);
		tv.push(...sv[ns2+d+1], ...normal, ...color, this.id);		
		tv.push(...sv[ns2],     ...normal, ...color, this.id);
		tv.push(...sv[ns2+d],   ...normal, ...color, this.id);
		tv.push(...sv[ns2+d+1], ...normal, ...color, this.id);	
	}


	/**
	 * Determines whether a given point is inside the shape's footprint.
	 * 
	 */
	containsPoint = function (x, y, checkBBox=true) 
    {
        // Quick bbox check
		if (checkBBox) {
			const bbox = this.bbox;
			if ( (x < bbox.xmin) || (x > bbox.xmax) || (y < bbox.ymin) || (y > bbox.ymax) ) {
				return false;
			}
		}

		const vec2 = glMatrix.vec2;
		const d2r = Math.PI/180;
		const pTestRel = vec2.fromValues(x - this.center[0], y - this.center[1]);
        const rTestSq = vec2.dot(pTestRel, pTestRel);
		if ((rTestSq < this.minRsq) || (rTestSq > this.maxRsq)) { return false; }

		const pMidRel = vec2.fromValues(Math.cos(d2r*this.angle), Math.sin(d2r*this.angle));
		const testVal = vec2.dot(pMidRel, pTestRel)/Math.sqrt(rTestSq);
		return (testVal >= Math.cos((d2r*this.span)/2));
    };


	/**
	 * Rotates the Arc by a given amount.
     *  
	 * @param {Number} deltaRads - The angle to rotate by.
	 */
	rotate(deltaRads)
	{
		this.angle += (180/Math.PI) * deltaRads;
		while(this.angle >= 360) { this.angle -= 360; }
		while(this.angle < 0) { this.angle += 360; }

		super.rotate(deltaRads);
	}
}

