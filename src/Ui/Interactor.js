/**
 * @classdesc
 * This class handles user interactions with the canvas.
 * 
 */
Interactor = class
{
    /**
	 * @constructor
     *
	 * @param {App} [app] - The App instance.
	 * 
     */
    constructor(app)
	{
		// Cache the input arguments
		this.app = app;
		this.canvas = app.display.canvas;

		// Initialize data members
		this.enabled = true;
		this.awaiting = false;
		this.pointers = new Map();
		this.pinchInfo = null;
		this.MaxZoom = 32.0;
		this.MinZoom = 0.1;
		this.activeObject = null;
		this.activeObjectPivotPt = null;
		this.mode = 'none'; 
		this.timerId = undefined;
		this.removeShapeSound = new Audio('Ui/media/removeShapeSound.mp3');
		this.removeShapeSound.preload = 'auto';

		// Precompute the model transform
		const [vec4, mat4] = [glMatrix.vec4, glMatrix.mat4];
		const f = 1/Math.sqrt(3);
		this.modelMatrix = mat4.fromScaling(mat4.create(), [f,f,f]); // Scale so that the diagonal of our grid just fits into clip space.
		const shift = mat4.fromTranslation(mat4.create(), [-f/2, -f/2, 1/2-f/2]); // Center our volume in clip space.
		mat4.multiply(this.modelMatrix, shift, this.modelMatrix)

		// Initial pose
		this.zoom = 1;
		this.pan = [0, 0.19];
		this.persp = 3;
		this.rot = mat4.fromXRotation(mat4.create(), -0.7*Math.PI)
		this.mvp = mat4.create();
		const cornerProj = vec4.transformMat4([0,0,0,0], [1,1,0,1], this.getTransforms()[0]);
        this.zoom *= 0.85 * cornerProj[3]/Math.max(Math.abs(cornerProj[0]), Math.abs(cornerProj[1]));

		// Listen for mouse/touchscreen events
		this.canvas.addEventListener('pointerdown',   this._onPointerDown.bind(this));	
		this.canvas.addEventListener('pointermove',   this._onPointerMove.bind(this));
		this.canvas.addEventListener('pointerup',     this._onPointerUp.bind(this));		
		this.canvas.addEventListener('pointercancel', this._onPointerCancel.bind(this));		
		this.canvas.addEventListener('wheel',         this._onMouseWheelChange.bind(this));	
	
		// Disable default actions on the source
		this.canvas.style["touch-action"] = "none";
	}


	/**
	 * Getter for the 'active' property.
	 */
	get active() {
        return (this.pointers.size > 0);
    }
    

	/**
	 * Sets the current pan, zoom and rotate values.
	 * 
	 * @param {Object} values
	 * @param {vec2} values.pan - The pan value to set.
	 * @param {Number} values.zoom - The zoom value to set.
	 * @param {Array} values.rot - The rotation matrix to set.
	 * @param {Number} values.persp - The perspective value to set.
	 * 
	 */
	setPose({pan = null, zoom = null, rot = null, persp = null} = {})
	{
		if (zoom) {this.zoom = Math.max(this.MinZoom, Math.min(this.MaxZoom, zoom)); }
		if (pan) { glMatrix.vec2.copy(this.pan, pan); }
		if (rot) { glMatrix.mat4.copy(this.rot, rot); }
		if (persp || (persp === 0)) { this.persp = persp; }
	}	

	
	/**
	 * Handler for pointer-down events.
	 * @private
	 * 
	 * @param {Event} event - Event info.
	 * 
	 */
    async _onPointerDown(event)
	{
		// Maybe do nothing
		if (!this.enabled || this.awaiting || (this.pointers.size >= 2)) { return; }
		const vec4 = glMatrix.vec4;

		// Sanity check
		const ptrId = event.pointerId;
		if (this.pointers.get(ptrId) !== undefined) { return; } // This shouldn't happen. Bail if it does.	

		// Record the new pointer info
		const currPos = {x:event.offsetX, y:event.offsetY};
		const ptr = {
			id: ptrId,
			startPos:{...currPos}, 
			currPos:{...currPos}, 
			prevPos:{...currPos}, 
			button: (!event.button && (event.button !== 0)) ? -1 : event.button,
			ctrl: event.ctrlKey || false,
			shift: event.shiftKey || false,
			alt: event.altKey || false
		}
		this.pointers.set(ptrId, ptr);
		if (this.pointers.size === 2) {
			this.pinchInfo = new PinchInfo(this.pointers, this.zoom);
		}

		// Check if an object is being selected
		const canv = this.canvas;
		const x = currPos.x * (canv.width/canv.clientWidth);
		const y = currPos.y * (canv.height/canv.clientHeight);
		this.awaiting = true;
		const objId = await this.app.engine.getPickedObject(x, y);
		this.awaiting = false;
		if (!this.active) { 
			return; // Pointer-up may have occurred while we were awaiting
		} 
		if (this.pointers.size === 1) {
			this.activeObject = this.app.engine.runParams.obstacleSet.get(objId) || null;
		}
		else {  // this.pointers.size == 2
			this.activeObject = (this.activeObject && (this.activeObject.id === objId)) ?
				this.activeObject : null;
		}
		if (this.activeObject) {
			const objCtr = [...this.activeObject.bboxCenter(), 1];
			objCtr[2] = this.activeObject.bbox.zmax;
			const objCtrProj = vec4.transformMat4(vec4.create(), objCtr, this.mvp);
			this.activeObjectPivotPt = [ objCtrProj[0]/objCtrProj[3], -objCtrProj[1]/objCtrProj[3] ];
		}
		
		// Determine our interaction mode
		if (this.pointers.size == 1)
		{
			if (this.activeObject) {
				this.mode = (ptr.shift || (ptr.button == 2)) ? 'rotate-object' : 'move-object';
			}
			else {
				this.mode = (ptr.ctrl || (ptr.button == 1)) ? 'zoom' :
					(ptr.shift || (ptr.button == 2)) ? 'pan' : 
					((ptr.button === 0) || (ptr.button == -1)) ? 'rotate' : 'none';
			}
		}
		else if (this.pointers.size == 2) 
		{
			this.mode = (this.activeObject) ? 'pinch-pose-object' : 'pinch-pose';
		}

		// Start animating 
		if (this.active){
			this.app.animate();
		}

		this.canvas.setPointerCapture(ptrId);
		event.preventDefault();
	};

	

	/**
	 * Handler for move events.
	 * @private
	 * 
	 * @param {Event} event - Event info.
	 * 
	 */
	_onPointerMove(event)
	{
		// Maybe do nothing
		if (!this.enabled || !this.active || this.awaiting) { return; }
		const ptr = this.pointers.get(event.pointerId);		
		if (ptr === undefined) { return; } 

		// Update the pointer info
		ptr.prevPos = {...ptr.currPos}
		ptr.currPos = {x:event.offsetX, y:event.offsetY};

		// Take action based on the current mode
		const [vec2, mat4] = [glMatrix.vec2, glMatrix.mat4];
		const [cw, ch] = [this.canvas.clientWidth, this.canvas.clientHeight];
		const [dx, dy] = [ptr.currPos.x - ptr.prevPos.x, ptr.currPos.y - ptr.prevPos.y];
		if (this.mode == 'pan')
		{
			const panScale = 2.25 * 2.0/(this.zoom * Math.min(cw, ch));
			this.pan[0] += panScale * dx;
			this.pan[1] -= panScale * dy;			
		}
		else if (this.mode == 'zoom')
		{
			this.zoom *= Math.pow(1.01, -dy);
			this.zoom = Math.max(Math.min(this.zoom, this.MaxZoom), this.MinZoom);		
		}
		else if (this.mode == 'rotate')
		{
			const trackballSize = [cw, ch];
			const deltaRot = Interactor._CalcRotationMatrix(null, ptr.prevPos, ptr.currPos, trackballSize);
			mat4.multiply(this.rot, deltaRot, this.rot);		
		}
		else if (this.mode == 'move-object')
		{
			const objDelta = this._getObjectDeltaFromMouseDelta(dx, dy);
			if (!isNaN(objDelta[0]) && !isNaN(objDelta[1])) {
				this.activeObject.translate(objDelta[0], objDelta[1]);
				this._renderUpdatedObstacles();
			}
		}
		else if (this.mode == 'rotate-object')
		{
			const prevRel = [ 2*ptr.prevPos.x/cw - 1 - this.activeObjectPivotPt[0],  2*ptr.prevPos.y/ch - 1 - this.activeObjectPivotPt[1] ];
			const currRel = [ 2*ptr.currPos.x/cw - 1 - this.activeObjectPivotPt[0],  2*ptr.currPos.y/ch - 1 - this.activeObjectPivotPt[1] ];
			const prevLen = vec2.length(prevRel);
			const currLen = vec2.length(currRel);
			if ((prevLen > 0.02) && (currLen > 0.02)) {
				const deltaAngle = Math.asin( (prevRel[0]*currRel[1] - prevRel[1]*currRel[0])/(prevLen*currLen) );
				this.activeObject.rotate(deltaAngle);
				this._renderUpdatedObstacles();
			}
		}
		else if (this.mode == 'pinch-pose')
		{
			if (this.pinchInfo) {
				const [dxp, dyp] = this.pinchInfo.calcDeltaCenter(this.pointers);
				const panScale = 2.25 * 2.0/(this.zoom * Math.min(cw, ch));
				this.pan[0] += panScale * dxp;
				this.pan[1] -= panScale * dyp;	
				
				const newZoom = this.pinchInfo.calcZoom(this.pointers);
				if (newZoom !== undefined) {
					this.zoom = Math.max(Math.min(newZoom, this.MaxZoom), this.MinZoom);
				}

				const deltaAngle = this.pinchInfo.calcDeltaAngle(this.pointers);
				if (deltaAngle) {
					const deltaRot = mat4.fromZRotation(mat4.create(), -deltaAngle);
					mat4.multiply(this.rot, deltaRot, this.rot);
				}
			}
		}
		else if (this.mode == 'pinch-pose-object')
		{
			if (this.pinchInfo) {
				const deltaAngle = this.pinchInfo.calcDeltaAngle(this.pointers);
				if (deltaAngle) {
					this.activeObject.rotate(deltaAngle);
				}
				
				const [dxp, dyp] = this.pinchInfo.calcDeltaCenter(this.pointers);
				const objDelta = this._getObjectDeltaFromMouseDelta(dxp, dyp);
				if (!isNaN(objDelta[0]) && !isNaN(objDelta[1])) {
					this.activeObject.translate(objDelta[0], objDelta[1]);
				}

				this._renderUpdatedObstacles();
			}
		}
		event.preventDefault();
	};


	/**
	 * Converts pointer-movement units to object-movement units, 
	 * 
	 */
	_getObjectDeltaFromMouseDelta(mouseDx, mouseDy)
	{
		const [vec2, mat2, vec4] = [glMatrix.vec2, glMatrix.mat2, glMatrix.vec4];
		const epsilon = 1e-5;

		const objCtr = [...this.activeObject.bboxCenter(), 1];
		const pA = vec4.transformMat4(vec4.create(), objCtr, this.mvp);
		const pB = vec4.transformMat4(vec4.create(), [objCtr[0] + epsilon, objCtr[1], objCtr[2], 1], this.mvp);
		const pC = vec4.transformMat4(vec4.create(), [objCtr[0], objCtr[1] + epsilon, objCtr[2], 1], this.mvp);
		for (let pt of [pA, pB, pC]) { vec4.scale(pt, pt, 1/pt[3]); }
		const m = mat2.fromValues(pB[0]-pA[0], pB[1]-pA[1], pC[0]-pA[0], pC[1]-pA[1]);
		mat2.multiplyScalar(m, m, 1/epsilon);
		mat2.invert(m, m);

		const rp = this.app.engine.runParams;
		const borderFactor = !rp.showDampingBorder ? [1, 1] :
			[1/(1 - 2*rp.grid.dampingBorder/rp.grid.nx), 1/(1 - 2*rp.grid.dampingBorder/rp.grid.ny)];

		const [cw, ch] = [this.canvas.clientWidth, this.canvas.clientHeight];
		const objDelta = vec2.transformMat2(vec2.create(), 
			[2*borderFactor[0]*mouseDx/cw, -2*borderFactor[1]*mouseDy/ch], m);

		return objDelta;
	}


	/**
	 * Redraws the obstacles after they have been moved or rotated.
	 * 
	 */
	_renderUpdatedObstacles()
	{	
		if (this.timerId === undefined) {
			this.timerId = setTimeout( function() {
				this.app.engine.onObstaclesChanged();
				if (!this.app.animating) { this.app.redrawScene(); }
				this.timerId = undefined;
			}.bind(this), 20);
		}
	}

	
	/**
	 * Handler for pointer-up events.
	 * @private
	 * 
	 * @param {Event} event - Event info.
	 * 
	 */
	_onPointerUp(event)
	{
		const app = this.app;
		const ptr = this.pointers.get(event.pointerId);		
		if (ptr !== undefined) 
		{ 
			this.pointers.forEach( 
				(p) => this.canvas.releasePointerCapture(p.id)
			);
			this.pointers.clear();

			// Check whether an object was dragged off the grid
			if ((this.mode == 'move-object') && this.activeObject)
			{
				if (this.activeObject.isOutOfBounds()) {
					this.removeShapeSound.currentTime = 0;
					this.removeShapeSound.play();
					app.engine.runParams.obstacleSet.remove(this.activeObject);
				}
			}

			this.pinchInfo = null;
			this.activeObject = null;
			this.activeObjectPivotPt = null;
			
			if (!app.animating) { app.redrawScene(); }
			event.preventDefault();
		}
	}


	/**
	 * Handler for pointer-cancel events.
	 * @private
	 * 
	 * @param {Event} event - Event info.
	 * 
	 */
	_onPointerCancel(event)
	{
		this._onPointerUp(event);
	}


	/**
	 * Handler for mousewheel events.
	 * @private
	 * 
	 * @param {Event} event - Event info.
	 * 
	 */
	_onMouseWheelChange(event)
	{
		// Get some event parameters
		let deltaMode, deltaY;
		const oEvent = event.originalEvent;
		if ( (event.deltaMode || (event.deltaMode === 0)) && (event.deltaY || (event.deltaY === 0)) ) {
			deltaMode = event.deltaMode;
			deltaY = event.deltaY;
		}
		else if (oEvent && ((oEvent.deltaMode || (oEvent.deltaMode === 0)) && (oEvent.deltaY || (oEvent.deltaY === 0))) ) {
			deltaMode = event.originalEvent.deltaMode;
			deltaY = event.originalEvent.deltaY;		
		}
		else { 
			return; 
		}

		// Change the zoom factor
		const scale = (deltaMode === 0) ? 50 : 1.5;
		const deltaZoom = Math.pow(1.01, -deltaY/scale);
		this.zoom *= deltaZoom;
		if (!this.app.animating) 
        {
            requestAnimationFrame( function() {
                this.app.engine.setTransforms(...this.getTransforms());
                this.app.engine.evolveAndRender(0);
            }.bind(this));
        }

		event.preventDefault();							
	}


	/**
	 * Calculates the rotation matrix given two cursor positions.
	 * @static
	 * @private
	 * 
	 * @param {vec2} prevPoint - The previous pointer position.
	 * @param {vec2} currPoint - The current pointer position.
	 * @param {vec2} trackballSize - The dimensions of the virtual trackball.
	 * 
	 */
	static _CalcRotationMatrix(result, prevPoint, currPoint, trackballSize) 
	{	
		const vec2 = glMatrix.vec2;
		const vec3 = glMatrix.vec3;
		const mat4 = glMatrix.mat4;
		result = result || mat4.create();
		
		// First convert to centered x,y coords.
		const tbHalfSize = vec2.clone(trackballSize);   vec2.scale(tbHalfSize, tbHalfSize, 0.5);
		const tbRadius = Math.min(tbHalfSize[0], tbHalfSize[1]);
		const tbRadiusSq = tbRadius * tbRadius;

		let curr = vec2.fromValues(currPoint.x, currPoint.y);  vec2.subtract(curr, curr, tbHalfSize);
		let prev = vec2.fromValues(prevPoint.x, prevPoint.y);  vec2.subtract(prev, prev, tbHalfSize);
		curr[0] = -curr[0];   prev[0] = -prev[0];

		// Snap the coords to the required range
		let currLength = vec2.length(curr);
		if ( currLength > tbRadius ) 
		{
			vec2.scale(curr, curr, tbRadius/currLength);
			currLength = tbRadius;
		}
		curr = vec3.fromValues(curr[0], curr[1], Math.sqrt(Math.max(0, tbRadiusSq - currLength*currLength)));

		let prevLength = vec2.length(prev);
		if ( prevLength > tbRadius ) 
		{
			vec2.scale(prev, prev, tbRadius/prevLength);
			prevLength = tbRadius;
		}
		prev = vec3.fromValues(prev[0], prev[1], Math.sqrt(Math.max(0, tbRadiusSq - prevLength*prevLength)));

		// Maybe short circuit
		if ( (Math.abs(curr[0]-prev[0]) < 0.0001) && (Math.abs(curr[1]-prev[1]) < 0.0001) ) {
			mat4.identity(result);
			return result;
		}

		// Now calculate the rotation axis
		let n = vec3.create();
		vec3.cross(n, curr, prev);
		const nNorm = vec3.length(n);
		if ( Math.abs(nNorm) < 0.0001 ) {
			mat4.identity(result);
			return result;
		}

		// Calculate matrix elements
		const sinth  = nNorm / tbRadiusSq;
		const costh  = Math.sqrt( Math.max(0, (1.0 - sinth*sinth)) );
		const sinth2 = Math.sqrt( Math.max(0, (1.0 - costh)/2) );
		const costh2 = Math.sqrt( Math.max(0, (1.0 + costh)/2) );

		vec3.scale(n, n, -1.0/nNorm);

		const e0 = costh2;
		const e1 = n[0] * sinth2;
		const e2 = n[1] * sinth2;
		const e3 = n[2] * sinth2;

		result[0] = e0*e0 + e1*e1 - e2*e2 - e3*e3 ;
		result[1] = 2.0 * ( e1*e2 + e0*e3 );
		result[2] = 2.0 * ( e1*e3 - e0*e2 );
		result[3] = 0.0;

		result[4] = 2.0 * ( e1*e2 - e0*e3 );
		result[5] = e0*e0 - e1*e1 + e2*e2 - e3*e3 ;
		result[6] = 2.0 * ( e2*e3 + e0*e1 );
		result[7] = 0.0;

		result[8] = 2.0 * ( e1*e3 + e0*e2 );
		result[9] = 2.0 * ( e2*e3 - e0*e1 );
		result[10] = ( e0*e0 - e1*e1 - e2*e2 + e3*e3 );
		result[11] = 0.0;

		return result;
	}


	/**
	 * Computes and returns the current model-view-projection transform,
	 *   along with the current rotation transform.
	 * 
	 */
	getTransforms()
	{    
		const mat4 = glMatrix.mat4;

		// View Transform: Rotate, then pan, then zoom
		let shift = mat4.fromTranslation(mat4.create(), [0, 0, -0.5]);
		const rotAboutCenter = mat4.multiply(mat4.create(), this.rot, shift);
		shift = mat4.fromTranslation(mat4.create(), [0, 0, 0.5]);
		const viewMatrix = mat4.multiply(mat4.create(), shift, rotAboutCenter);
		
		const panMatrix = mat4.fromTranslation(mat4.create(), [this.pan[0], this.pan[1], 0]);
		mat4.multiply(viewMatrix, panMatrix, viewMatrix);
		
		const zoomMatrix = mat4.fromScaling(mat4.create(), [this.zoom, this.zoom, 1]);
		mat4.multiply(viewMatrix, zoomMatrix, viewMatrix); 
		

		// Projection Transform:
		const aspect = this.canvas.width / this.canvas.height;
		const projMatrix = mat4.create();
		projMatrix[0] = Math.min(1/aspect, 1);
		projMatrix[5] = Math.min(aspect, 1);
		projMatrix[11] = this.persp - 1;
		projMatrix[15] = 1;


		// MVP Transform:
		mat4.copy(this.mvp, this.modelMatrix);
		mat4.multiply(this.mvp, viewMatrix, this.mvp);
		mat4.multiply(this.mvp, projMatrix, this.mvp); 

		return [this.mvp, this.rot];
	}	
}



/**
 * @classdesc
 * This class encapsulates info about a pinch gesture.
 * 
 */
PinchInfo = class
{
    /**
	 * @constructor
	 * 
     */
    constructor(initialPointers, initialZoom)
	{
		this.initialZoom = initialZoom;

		const iter = initialPointers.values();
		const inPtrA = iter.next().value;
		const inPtrB = iter.next().value;
		const ptrA = this.initialPtrA = {id:inPtrA.id, startPos:{...(inPtrA.currPos)}};
		const ptrB = this.initialPtrB = {id:inPtrB.id, startPos:{...(inPtrB.currPos)}};

		this.prevCtr = {
			x:(ptrA.startPos.x + ptrB.startPos.x)/2, 
			y:(ptrA.startPos.y + ptrB.startPos.y)/2
		};

		const sepSq = (ptrB.startPos.x - ptrA.startPos.x)**2 + (ptrB.startPos.y - ptrA.startPos.y)**2;
		this.initialSep = Math.max(1, Math.sqrt(sepSq));

		this.prevAngle = 
			Math.atan2((ptrB.startPos.y - ptrA.startPos.y), (ptrB.startPos.x - ptrA.startPos.x));
	}


	/**
	 * Gets the change in the pinch's center point.
	 * 
	 */
	calcDeltaCenter(currentPointers) 
	{
		if (currentPointers.size != 2) { return undefined; }

		const iter = currentPointers.values();
		const ptrA = iter.next().value;
		const ptrB = iter.next().value;		

		const currCtr = { x:(ptrA.currPos.x + ptrB.currPos.x)/2,  y:(ptrA.currPos.y + ptrB.currPos.y)/2 };
		const [dx, dy] = [currCtr.x - this.prevCtr.x, currCtr.y - this.prevCtr.y];
		this.prevCtr = currCtr;

		return [dx, dy];
	}


	/**
	 * Calculates the modified zoom value based on how 
	 * much the pinch length has changed.
	 * 
	 */
	calcZoom(currentPointers) 
	{
		if (currentPointers.size != 2) { return undefined; }

		const iter = currentPointers.values();
		const ptrA = iter.next().value;
		const ptrB = iter.next().value;

		const sepX = ptrA.currPos.x - ptrB.currPos.x;
		const sepY = ptrA.currPos.y - ptrB.currPos.y;
		const currSep = Math.sqrt(sepX*sepX + sepY*sepY);

		return this.initialZoom * (1 + 0.5*(currSep/this.initialSep - 1));
	}


	/**
	 * Calculates a modified rotation angle based on how 
	 * much the pinch angle has changed.
	 * 
	 */
	calcDeltaAngle(currentPointers) 
	{
		if (currentPointers.size != 2) { return undefined; }

		const iter = currentPointers.values();
		const ptrA = iter.next().value;
		const ptrB = iter.next().value;		

		const ang = Math.atan2((ptrB.currPos.y - ptrA.currPos.y), (ptrB.currPos.x - ptrA.currPos.x));
		const deltaAngle = ang - this.prevAngle;
		this.prevAngle = ang;

		while (deltaAngle >  2*Math.PI) { deltaAngle -= 2*Math.PI; }
		while (deltaAngle < -2*Math.PI) { deltaAngle += 2*Math.PI; }
		return deltaAngle;
	}
	
}