/**
 * @classdesc
 * This class encapsulates a WebGL program (a vertex shader
 * together with a fragment shader).
 * 
 */
class WebGLProgram 
{ 
    static setterFunctions = null;

    /**
    * @param {WebGLRenderingContext} context - The rendering context. 
    * @param {String} name - A name for the program.
    * @param {String} vCode - The vertex shader code.
    * @param {String} fCode - The fragment shader code.
    */
    constructor(context, name, vCode, fCode) 
    {
        // Initialize data members
        this.glContext   = context;
        this.name        = name || "";
        this.glProgram   = null;
        this.uniforms    = {};
        this.attributes  = {};
        this.lenient     = false; // Whether to silently ignore unrecognized variable names in SetUniform.

        // Initialize the table of setter functions, if necessary
        if (!WebGLProgram.setterFunctions) {
            WebGLProgram.setterFunctions = WebGLProgram._tabulateUniformSetters(context);
        }

        // Create the vertex shader
        const gl = this.glContext;
        const vShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vShader, vCode);
        gl.compileShader(vShader);
        if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
            Logger.error(this.name + " vShader compilation error(s):\n" + gl.getShaderInfoLog(vShader));
        } 
    
        // Create the fragment shader
        const fShader = gl.createShader(gl.FRAGMENT_SHADER);     
        gl.shaderSource(fShader, fCode);
        gl.compileShader(fShader);
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
            Logger.error(this.name + " fShader compilation error(s):\n" + gl.getShaderInfoLog(fShader));
        } 
    
        // Create the program
        const glProgram = this.glProgram = gl.createProgram();
        gl.attachShader(this.glProgram, vShader);
        gl.attachShader(this.glProgram, fShader);
        
        // Link it
        gl.linkProgram(glProgram);
        if ( !gl.getProgramParameter(glProgram, gl.LINK_STATUS) && !gl.isContextLost() ) {
            Logger.error(this.name + " link error(s):\n" + gl.getProgramInfoLog(glProgram)); 
        }	
        else 
        {
            // Cache info about the program's uniforms and attributes, for quick access later.
            const  numUniforms = gl.getProgramParameter(glProgram, gl.ACTIVE_UNIFORMS);
            for (let i = 0; i < numUniforms; ++i) {
                const u = gl.getActiveUniform(glProgram, i);
                const name = ((u.name.length > 3) && (u.name.lastIndexOf('[0]') == u.name.length-3)) ? u.name.slice(0,-3) :  u.name;
                this.uniforms[name] = {index:i, type:u.type, size:u.size, loc:gl.getUniformLocation(glProgram, u.name)};
            }    

            const numAttributes = gl.getProgramParameter(glProgram, gl.ACTIVE_ATTRIBUTES);
            for (let i = 0; i < numAttributes; ++i) {
                const a = gl.getActiveAttrib(glProgram, i);
                this.attributes[a.name] = {index:i, type:a.type, size:a.size, loc:gl.getAttribLocation(glProgram, a.name), 
                    attrBuffer:null, bufferOffset:0};
            }

            // Once the program is linked, the shaders can be deleted
            gl.detachShader(glProgram, vShader);
            gl.detachShader(glProgram, fShader);
            gl.deleteShader(vShader);
            gl.deleteShader(fShader);
        }
    }


    /**
     * Sets the value of a uniform variable.
     * 
     * @param {string} name - The name of the variable to set.
     * @param {number} val - The value to set.
     * @param {boolean} [setProgram=true] - Whether to call gl.useProgram before setting the uniform value.
     */
    setUniform(name, val, setProgram=true)
    {
        // In order to set a uniform, this program must be WebGL's current program
        const gl = this.glContext;
        if (setProgram) { gl.useProgram(this.glProgram); }

        // Get the appropriate setter function for the given variable name
        let success = false;
        if ((name.length > 3) && (name.lastIndexOf('[0]') == name.length-3)) { name = name.slice(0,-3); }
        const uni = this.uniforms[name];
        if (uni) {
            const loc = uni.loc;
            const setterFunc = WebGLProgram.setterFunctions[uni.type];
            if (loc && setterFunc) {
                setterFunc(loc, val);
                success = true;
            }
        } 
        if (!success && !this.lenient) {
            Logger.warn("ShaderProgram.setUniform: Unrecognized uniform: " + name);
        }
    }


    /**
     * Gets the value of a uniform variable.
     * Note: This method can be slow, because it requires communication with the GPU.
     *
     * @param {string} name - The name of the variable to get.
     * @param {number} [index] - The index of the array element to get. (Only required when the
     *   named variable is an array.)
     */
    getUniform(name, index)
    {
        // In order to get a uniform, this program must be WebGL's current program
        const gl = this.glContext;
        gl.setCurrentProgram(this);
    
        const uni = this.uniforms[name];
        if (!uni) { return null; }

        if (index === undefined) {
            return gl.getUniform(this.glProgram, uni.loc);
        } 
        else {
            const loc = gl.getUniformLocation(this.glProgram, name + '[' + index.toString() + ']');
            return loc ? gl.getUniform(this.glProgram, loc) : null;        
        }
    }


    /**
     * Sets a vertex-attribute buffer.
     * 
     * @param {string} name - The name of the vertex attribute.
     * @param {AttributeBuffer} attrBuffer - An AttributeBuffer containing the vertex-attribute values.
     * @param {Boolean} [bind=true] - Whether to bind the buffer in WebGL.
     * @param {number} [bufferOffset=0] - The offset in bytes to the first component in the buffer.
     */
    setAttribute(name, attrBuffer, bind=true, bufferOffset=0)
    {
        if (this.attributes[name]) 
        {
            // Cache the buffer object
            this.attributes[name].attrBuffer = attrBuffer;
            this.attributes[name].bufferOffset = bufferOffset;
            if (bind) { this.bindAttributes([name]); }
        }
        else {
            Logger.warn("WebGLProgram.setAttribute: Unrecognized attribute: " + name);   
        }
    }


    /**
     * Binds the program's vertex attribute arrays in WebGL.
     * 
     * @param {Array} [names=empty] - The names of the attributes to bind. If null or 
     *     empty, then all attributes will be bound.
     */
    bindAttributes(names=[])
    {
        names = names || [];
        const gl = this.glContext;
        for (let attrName in this.attributes) {
            if (this.attributes.hasOwnProperty(attrName)) { 
                if ((names.length === 0) || (names.indexOf(attrName) >= 0)) { 
                    const a = this.attributes[attrName];
                    if (a.attrBuffer) {
                        gl.bindBuffer(gl.ARRAY_BUFFER, a.attrBuffer.glBuffer);
                        gl.enableVertexAttribArray(a.loc);
                        gl.vertexAttribPointer(a.loc, a.attrBuffer.attrDim, a.attrBuffer.dataType, 
                            a.attrBuffer.normalizeValues, 0, a.bufferOffset);
                    } 
                }   
            }
        }      
    }


    /**
     * Sets an input texture, or array of input textures.
     * 
     * @param {String} samplerName - The name of the corresponding sampler in the shader GLSL code.
     * @param {WebGLTexture2D} texture - The input texture.
     * @param {boolean} [setProgram=true] - Whether to call gl.useProgram before setting the texture.
     */
    setInputTexture(samplerName, texture, setProgram=true)
    {
        if (texture) {
            this.setUniform(samplerName, texture.txIndex, setProgram); 
        }
        else {
            this.setUniform(samplerName, -1, setProgram); 
        }
    }


   /**
    * Creates a table of setter functions for uniform variables.
    * 
    */
   static _tabulateUniformSetters(gl)
   {
        const uTable = {};
    
        const IsArray = function(x) {
            return Array.isArray(x) || (ArrayBuffer.isView(x) && !(x instanceof DataView));
        };
    
        // Map each of the uniform types to a setter function
        uTable[gl.FLOAT_VEC2] = function(loc, val) { return gl.uniform2fv(loc, val); };
        uTable[gl.FLOAT_VEC3] = function(loc, val) { return gl.uniform3fv(loc, val); };
        uTable[gl.FLOAT_VEC4] = function(loc, val) { return gl.uniform4fv(loc, val); };
        uTable[gl.FLOAT_MAT2] = function(loc, val) { return gl.uniformMatrix2fv(loc, false, val); };
        uTable[gl.FLOAT_MAT3] = function(loc, val) { return gl.uniformMatrix3fv(loc, false, val); };
        uTable[gl.FLOAT_MAT4] = function(loc, val) { return gl.uniformMatrix4fv(loc, false, val); };
        uTable[gl.FLOAT]      = function(loc, val) { return IsArray(val) ? gl.uniform1fv(loc, val) : gl.uniform1f(loc, val); };
    
        uTable[gl.INT_VEC2]   = function(loc, val) { return gl.uniform2iv(loc, val); };
        uTable[gl.INT_VEC3]   = function(loc, val) { return gl.uniform3iv(loc, val); };
        uTable[gl.INT_VEC4]   = function(loc, val) { return gl.uniform4iv(loc, val); };
        uTable[gl.INT]        = function(loc, val) { return IsArray(val) ? gl.uniform1iv(loc, val) : gl.uniform1i(loc, val); };
        uTable[gl.SAMPLER_2D] = uTable[gl.INT];
        uTable[gl.SAMPLER_CUBE] = uTable[gl.INT];
    
        const bMap = function(v) { return v ? 1 : 0; };
        uTable[gl.BOOL_VEC2]  = function(loc, val) { return gl.uniform2iv(loc, val.map(bMap)); };
        uTable[gl.BOOL_VEC3]  = function(loc, val) { return gl.uniform3iv(loc, val.map(bMap)); };
        uTable[gl.BOOL_VEC4]  = function(loc, val) { return gl.uniform4iv(loc, val.map(bMap)); };
        uTable[gl.BOOL]       = function(loc, val) { return IsArray(val) ? gl.uniform1iv(loc, val.map(bMap)) : gl.uniform1i(loc, bMap(val)); };
    
        // WebGL2 setters
        uTable[gl.SAMPLER_3D]                    = uTable[gl.INT];
        uTable[gl.SAMPLER_2D_SHADOW]             = uTable[gl.INT];
        uTable[gl.SAMPLER_2D_ARRAY]              = uTable[gl.INT];
        uTable[gl.SAMPLER_2D_ARRAY_SHADOW]       = uTable[gl.INT];
        uTable[gl.SAMPLER_CUBE_SHADOW]           = uTable[gl.INT];
        uTable[gl.INT_SAMPLER_2D]                = uTable[gl.INT];
        uTable[gl.INT_SAMPLER_3D]                = uTable[gl.INT];
        uTable[gl.INT_SAMPLER_CUBE]              = uTable[gl.INT];
        uTable[gl.INT_SAMPLER_2D_ARRAY]          = uTable[gl.INT];
        uTable[gl.UNSIGNED_INT_SAMPLER_2D]       = uTable[gl.INT];
        uTable[gl.UNSIGNED_INT_SAMPLER_3D]       = uTable[gl.INT];
        uTable[gl.UNSIGNED_INT_SAMPLER_CUBE]     = uTable[gl.INT];
        uTable[gl.UNSIGNED_INT_SAMPLER_2D_ARRAY] = uTable[gl.INT];

        uTable[gl.UNSIGNED_INT_VEC2] = function(loc, val) { return gl.uniform2uiv(loc, val); };
        uTable[gl.UNSIGNED_INT_VEC3] = function(loc, val) { return gl.uniform3uiv(loc, val); };
        uTable[gl.UNSIGNED_INT_VEC4] = function(loc, val) { return gl.uniform4uiv(loc, val); };
        uTable[gl.UNSIGNED_INT]      = function(loc, val) { return IsArray(val) ? gl.uniform1uiv(loc, val) : gl.uniform1ui(loc, val); };

        uTable[gl.FLOAT_MAT2x3] = function(loc, val) { return gl.uniformMatrix2x3fv(loc, false, val); };
        uTable[gl.FLOAT_MAT2x4] = function(loc, val) { return gl.uniformMatrix2x4fv(loc, false, val); };
        uTable[gl.FLOAT_MAT3x2] = function(loc, val) { return gl.uniformMatrix3x2fv(loc, false, val); };        
        uTable[gl.FLOAT_MAT3x4] = function(loc, val) { return gl.uniformMatrix3x4fv(loc, false, val); };
        uTable[gl.FLOAT_MAT4x2] = function(loc, val) { return gl.uniformMatrix4x2fv(loc, false, val); };
        uTable[gl.FLOAT_MAT4x3] = function(loc, val) { return gl.uniformMatrix4x3fv(loc, false, val); };        
                                   
        return uTable;
   };    
}


