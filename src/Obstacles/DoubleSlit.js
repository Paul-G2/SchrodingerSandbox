/**
 * @classdesc
 * This class implements a double-slit obstacle.
 * 
 */
class DoubleSlit extends Obstacle
{
    /**
	 * @constructor
	 * 
	 */
	constructor({center=[0.5, 0.5], length=0.7, thickness=0.05, height=0.20, vMax = 1.0,
		slitWidth=0.06, slitSeparation=0.20, angle=-45, color=[0,1,1,1]} = {}) 
	{ 
		// Inherit from Obstacle
		super('double-slit');
		
		this.center = [...center];
		this.length = length;
		this.thickness = thickness;
		this.slitWidth = slitWidth;
		this.slitSeparation = slitSeparation;
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
		const cos = Math.cos(this.angle * Math.PI/180);
		const sin = Math.sin(this.angle * Math.PI/180);

		let len = (this.length - this.slitSeparation - this.slitWidth)/2;
		let dist = (len + this.slitSeparation + this.slitWidth)/2; 
		let ctr = [this.center[0] - dist*cos, this.center[1] - dist*sin];
		const boxA = new Box({center:ctr, length:len, thickness:this.thickness, angle:this.angle, height:this.height, color:this.color});

		ctr = [this.center[0] + dist*cos, this.center[1] + dist*sin];
		const boxC = new Box({center:ctr, length:len, thickness:this.thickness, angle:this.angle, height:this.height, color:this.color});

		len = this.slitSeparation - this.slitWidth;
		const boxB = new Box({center:this.center, length:len, thickness:this.thickness, angle:this.angle, height:this.height, color:this.color});

		// Update the vertices
		this.shapeVertices = [...boxA.shapeVertices, ...boxB.shapeVertices, ...boxC.shapeVertices];
		this.triangleVertices = [...boxA.triangleVertices, ...boxB.triangleVertices, ...boxC.triangleVertices];
		for (let i=10; i<this.triangleVertices.length; i+=Obstacle.AttrsPerVertex) { 
			this.triangleVertices[i] = this.id;
		}

		// Update the bounding box
		this.bbox.xmin = Math.min(boxA.bbox.xmin, boxB.bbox.xmin, boxC.bbox.xmin);
		this.bbox.xmax = Math.max(boxA.bbox.xmax, boxB.bbox.xmax, boxC.bbox.xmax);
		this.bbox.ymin = Math.min(boxA.bbox.ymin, boxB.bbox.ymin, boxC.bbox.ymin);
		this.bbox.ymax = Math.max(boxA.bbox.ymax, boxB.bbox.ymax, boxC.bbox.ymax);
		this.bbox.zmin = 0;
		this.bbox.zmax = this.height;
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

        // Detailed check
        let result = false;
		const sv = this.shapeVertices
		for (let k of [0, 8, 16])
		{
			for ( let i=k, j=k+3; i<k+4; j=i++ )
			{
				const Vi1 = sv[i][1];
				const Vj1 = sv[j][1];
				const testA = (Vi1 <= y)  &&  (y < Vj1);
				const testB = (Vj1 <= y)  &&  (y < Vi1);
				if ( testA || testB ) {
					const Vi0 = sv[i][0];
					const Vj0 = sv[j][0];
					const valA = (Vj1 - Vi1) * (x - Vi0);
					const valB = (Vj0 - Vi0) * (y - Vi1);

					if ((testA && (valA < valB)) || (testB && (valA > valB))) {
						result = !result;
					}
				}
			}
			if (result) {
				break;
			}
		}		
        return result;
    };
}

