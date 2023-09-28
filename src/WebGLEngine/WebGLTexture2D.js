/**
 * @classdesc
 * This class wraps a WebGL TEXTURE_2D object.
 * 
 */
class WebGLTexture2D
{ 
    /**
	 * @constructor
     *
     * @param {WebGL2RenderingContext} glContext - A WebGL2 rendering context.
     * @param {Number} txIndex - The texture index. Must be in the range [0, gl.MAX_TEXTURE_IMAGE_UNITS-1].
     * @param {Number} width - The desired width of the texture.
     * @param {Number} height - The desired height of the texture.
     * @param {GLenum} colorComponents - The pixel internal format (gl.RGB, gl.RGBA, gl.R32F, etc).
     * @param {GLenum} interpType - The interpolation type (gl.LINEAR or gl.NEAREST).
     * @param {TypedArray} data - The data to place in the texture.
	 */
	constructor(glContext, txIndex, width, height, colorComponents, interpType, data=null) 
    {
        // Initialize members    
        this.glContext       = glContext;      
        this.txIndex         = txIndex;
        this.width           = Math.round(width);
        this.height          = Math.round(height);
        this.colorComponents = colorComponents;
        this.interpType      = interpType;

        const gl = this.glContext;
        if ((colorComponents === gl.RGBA) || (colorComponents === gl.RGB)) {
            this.pixelFormat = colorComponents;
            this.pixelType = gl.UNSIGNED_BYTE;
            this.numColorComponents = (colorComponents === gl.RGBA) ? 4 : 3;
        }
        else if (colorComponents === gl.R32F) {
            this.pixelFormat = gl.RED;
            this.pixelType = gl.FLOAT; 
            this.numColorComponents = 1;          
        }
        else if (colorComponents === gl.R32I) {
            this.pixelFormat = gl.RED_INTEGER;
            this.pixelType = gl.INT; 
            this.numColorComponents = 1;           
        }
        else {
            throw new Error('Unsupported colorComponents, in WebGLTexture2D ctor.');
        }

        // Create the GL texture object
        this.glTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + this.txIndex);
        gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.interpType);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.interpType);    
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);       
        gl.texImage2D(gl.TEXTURE_2D, 0, this.colorComponents, this.width, this.height, 0, 
            this.pixelFormat, this.pixelType, data);
    }


    /**
     * Resizes the Texture.
     * 
     * @param {Number} newWidth - The desired width of the texture.
     * @param {Number} newHeight - The desired height of the texture.
     * @param {TypedArray} data - The data to place in the texture.
     */
    resize(newWidth, newHeight, data=null) 
    { 
        const gl = this.glContext;
        this.width = Math.round(newWidth);
        this.height = Math.round(newHeight);

        gl.activeTexture(gl.TEXTURE0 + this.txIndex);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.colorComponents, this.width, this.height, 0, 
            this.pixelFormat, this.pixelType, data);
    }


    /**
     * Copies data into the Texture.
     * 
     * @param {TypedArray} data - The data to place in the texture.
     */
    setData(data)
    {
        if (data.length == 0) { return; }

        const numTexels = data.length/this.numColorComponents;
        if ( ((data.length % this.numColorComponents) !== 0) || ((numTexels % this.width) !== 0) ) {
            Logger.error("WebGLTexture2D.setData: Invalid data size.");
            return;
        }

        const numRows = Math.round(numTexels/this.width);
        if ( numRows > this.height ) {
            Logger.error("WebGLTexture2D.setData: Invalid data size.");
            return;
        }

        const gl = this.glContext;
        gl.activeTexture(gl.TEXTURE0 + this.txIndex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, numRows, this.pixelFormat, this.pixelType, data);       
    }


    /**
     * Copies this texture's data into another texture.
     * The size and format of the two textures must match.
     * 
     * @param {Texture2D} dest - The destination texture.
     * @param {WebGLFrameBuffer} frameBuffer - A WebGL framebuffer.
     */
    copyTo(dest, frameBuffer)
    {
        const gl = this.glContext;
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.glTexture, 0);
        gl.activeTexture(gl.TEXTURE0 + dest.txIndex);
        gl.copyTexImage2D(gl.TEXTURE_2D, 0, this.colorComponents, 0, 0, this.width, this.height, 0);
    }
}


