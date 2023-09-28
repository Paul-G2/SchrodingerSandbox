/**
 * @classdesc
 * This class wraps a WebGL buffer for storing vertex attributes.
 * 
 */
class WebGLAttributeBuffer
{ 
    /**
     * @param {WebGLRenderingContext} glContext - The rendering context.
     * @param {GLenum} [dataType] - The buffer's data type (gl.FLOAT, gl.BYTE, gl.SHORT, gl.UNSIGNED_BYTE, gl.UNSIGNED_SHORT, or gl.HALF_FLOAT)
     * @param {Number} [attrDim] - The number of components per attribute. Must be 1, 2, 3, or 4.
     * @param {Array} data - The data to be stored in the buffer.
     * @param {Object} [options] - Optional parameters. 
     * @param {GLenum} options.drawMode=gl.STATIC_DRAW - A data-usage hint for WebGL (gl.STATIC_DRAW, gl.DYNAMIC_DRAW, or gl.STREAM_DRAW)
     * @param {Boolean} options.normalizeValues=false - Whether to normalize integer data values when casting to float. 
     */
    constructor(glContext, dataType, attrDim, data, options={}) 
    {
        // Initialize members
        this.glContext       = glContext;    
        this.dataType        = dataType; 
        this.attrDim         = attrDim;
        this.drawMode        = options.drawMode || glContext.STATIC_DRAW;  
        this.normalizeValues = !!options.normalizeValues;
        this.bytesPerVertex  = attrDim * WebGLAttributeBuffer.sizeOf(dataType, glContext); 
        this.numBytes        = 0;
        this.glBuffer        = null;

        // Check the input
        if ( (attrDim !== 1) && (attrDim !== 2) && (attrDim !== 3) && (attrDim !== 4) ) {
            Logger.error("WebGLAttributeBuffer.ctor: Invalid attribute dimension.");
            return;
        }
        const aData = this._coerceData(data);
        if (!aData) {
            Logger.error("WebGLAttributeBuffer.ctor: Invalid data array.");
            return;
        }
        this.numBytes = aData.buffer ? aData.buffer.byteLength : aData.byteLength;

        // Fill a WebGL buffer with the supplied data
        const gl = glContext;
        this.glBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, aData, this.drawMode);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }


    /**
     * Deletes the buffer.
     * 
     */
    destroy() 
    { 
        // Check if we are already destroyed
        const gl = this.glContext;
        if (!gl) { return; } 
        
        // Clean up
        if (this.glBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, 1, gl.STATIC_DRAW); // Set buffer size to the smallest allowed value before deleting.
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.deleteBuffer(this.glBuffer);
            this.glBuffer = null;
        }
        this.glContext = null;
    }


    /**
     * Tries to coerce a given data array to this buffer's data type.
     * 
     * @param {Array} data - The data to convert.
     */
    _coerceData(data) 
    { 
        const gl = this.glContext;
        try 
        {
            if (this.dataType === gl.FLOAT) {
                return (data instanceof Float32Array) ? data : new Float32Array(data);
            }
            else if (this.dataType === gl.UNSIGNED_SHORT) {
                return (data instanceof Uint16Array) ? data : new Uint16Array(data);
            }
            else if (this.dataType === gl.UNSIGNED_BYTE) {
                return (data instanceof Uint8Array) ? data : new Uint8Array(data);
            }
            else if (this.dataType === gl.INT) {
                return (data instanceof Int32Array) ? data : new Int32Array(data);
            }            
            else if (this.dataType === gl.SHORT) {
                return (data instanceof Int16Array) ? data : new Int16Array(data);
            }
            else if (this.dataType === gl.BYTE) {
                return (data instanceof Int8Array) ? data : new Int8Array(data);
            }
            else if ((this.glContext.glVersion > 1) && (this.dataType === gl.HALF_FLOAT)) {
                // For HALF_FLOAT data, the client is responsible for packing the 16-bit floats, 
                // probably into a Uint16Array or Uint32Array.
                return data; 
            }
        }
        catch (err) { 
            Logger.error("WebGLAttributeBuffer._coerceData: threw an exception. " +
                ((err && err.message) ? err.message : ""));
        }

        return null;
    }


    /**
     * Sets the buffer's data (reallocates the buffer to fit the data size).
     * 
     * @param {ArrayBuffer} newData - The new data to set in the buffer.
     */
    setData(newData) 
    { 
        const cData = this._coerceData(newData);   
        if (!cData) {
            Logger.error("WebGLAttributeBuffer.setData: Invalid data array.");
            return;
        } 
        this.numBytes = cData.buffer ? cData.buffer.byteLength : cData.byteLength;

        const gl = this.glContext;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, cData, this.drawMode);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }


    /**
     * Modifies the buffer's data.
     * 
     * @param {ArrayBuffer} newData - The new data to set in the buffer. (It must fit in the current buffer size.)
     * @param {Number} [offset=0] - The offset in bytes where the data replacement will start.
     */
    subData(newData, offset=0) 
    { 
        const cData = this._coerceData(newData);   
        if (!cData) {
            Logger.error("WebGLAttributeBuffer.subData: Invalid data array.");
            return;
        } 

        const gl = this.glContext;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, offset, cData); // WebGL will raise an error if newData is invalid or too large
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }


    /**
     * Returns the size (in bytes) of a given data type.
     * 
     * @param {GLenum} type - The data type to evaluate.
     * @param {WebGLRenderingContext} glContext - A Webgl2 rendering context.
     */
    static sizeOf(type, glContext) 
    { 
        const gl = glContext;

        if ( (type === gl.FLOAT) || (type === gl.UNSIGNED_INT) || (type === gl.INT) ) {
            return 4;
        }
        else if ( (type === gl.UNSIGNED_SHORT) || (type === gl.SHORT) ) {
            return 2;
        }
        else if ( (type === gl.UNSIGNED_BYTE) || (type === gl.BYTE)) {
            return 1;
        }
        else if ((this.glVersion > 1) && (type === gl.HALF_FLOAT)) {
            return 2; 
        }

        Logger.error("WebGLAttributeBuffer.sizeOf: Unknown data type.")
        return undefined;
    }
}