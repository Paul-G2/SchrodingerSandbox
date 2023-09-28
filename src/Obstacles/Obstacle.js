/**
 * @classdesc
 * This is the base class for all scattering Obstacles.
 * 
 */
Obstacle = class
{
    /**
	 * @constructor
     *
     */
    constructor(name = "")
	{
        this.name = name;
		this.id = undefined;
		this.potentialIsConstant = true;
		this.shapeVertices = [];
		this.triangleVertices = [];
		this.bbox = {
			xmin: undefined, xmax: undefined, 
			ymin: undefined, ymax: undefined,
			zmin: undefined, zmax: undefined
		};        
	}


	/**
	 * Gets the obstacle's vertices.
	 * 
	 */
	getTriangleVertices()
    {
		return this.triangleVertices;
    }
	
	
	/**
	 * Gets the center of the obstacle's bounding box.
	 * 
	 */	
	bboxCenter()
	{
		return [
			(this.bbox.xmin + this.bbox.xmax)/2, 
			(this.bbox.ymin + this.bbox.ymax)/2,
			(this.bbox.zmin + this.bbox.zmax)/2];
	}


    /**
	 * Translates the Obstacle by a given amount.
     *  
	 */
	translate(dx, dy, constrain=true)
	{
		if (constrain) {
			const lim = 0.15;
			const cx = this.center[0];
			const cy = this.center[1];
			if ((cx + dx) > 1 + lim) { dx = 1 + lim - cx; }
			if ((cy + dy) > 1 + lim) { dy = 1 + lim - cy; }
			if ((cx + dx) < -lim)    { dx = -lim - cx; }
			if ((cy + dy) < -lim)    { dy = -lim - cy; }
		}

		this.center[0] += dx;
		this.center[1] += dy;
		
		this.bbox.xmin += dx;
		this.bbox.xmax += dx;
		this.bbox.ymin += dy;
		this.bbox.ymax += dy;
		
		for (let sv of this.shapeVertices) {
			sv[0] += dx;
			sv[1] += dy;
		}

        const tv = this.triangleVertices;
        const ntv = tv.length;
		for (let i=0; i<ntv; i+=Obstacle.AttrsPerVertex) {
			tv[i] += dx;
			tv[i+1] += dy;
		}
	}


    /**
	 * Rotates the Obstacle by a given amount.
     *  
	 */
	rotate(deltaRads)
	{
		const cx = this.center[0];
		const cy = this.center[1];
		const cos = Math.cos(deltaRads);
		const sin = Math.sin(deltaRads);
		
		const bbox = this.bbox;
		bbox.xmin = bbox.xmax = bbox.ymin = bbox.ymax = undefined;
		
		for (let sv of this.shapeVertices)
		{
			const [relx, rely] = [sv[0] - cx, sv[1] - cy];
			const x = sv[0] = cx + cos*relx - sin*rely;
			const y = sv[1] = cy + sin*relx + cos*rely;

			if ((bbox.xmin === undefined) || (bbox.xmin > x)) { bbox.xmin = x; }
			if ((bbox.xmax === undefined) || (bbox.xmax < x)) { bbox.xmax = x; }
			if ((bbox.ymin === undefined) || (bbox.ymin > y)) { bbox.ymin = y; }
			if ((bbox.ymax === undefined) || (bbox.ymax < y)) { bbox.ymax = y; }
		}

        const tv = this.triangleVertices;
        const ntv = tv.length;
		for (let i=0; i<ntv; i+=Obstacle.AttrsPerVertex)
		{
			const [relx, rely] = [tv[i] - cx, tv[i+1] - cy];
			tv[i]   = cx + cos*relx - sin*rely;
			tv[i+1] = cy + sin*relx + cos*rely;

			// Normals
			const [nx, ny] = [tv[i+3], tv[i+4]];
			tv[i+3] = cos*nx - sin*ny;
			tv[i+4] = sin*nx + cos*ny;			
		}
	}


	/**
	 * Determines whether the obstacle is outside the grid boundaries.
	 * 
	 */
	isOutOfBounds()
	{
		const oobThresh = 0.05;
		return (this.center[0] < -oobThresh) || (this.center[1] < -oobThresh) ||
			(this.center[0] > 1 + oobThresh) || (this.center[1] > 1 + oobThresh);
	}
}

Obstacle.AttrsPerVertex = 11;