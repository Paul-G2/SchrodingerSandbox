/**
 * @classdesc
 * This is the WebGL-based renderer.
 * 
 */
class WebGLEngine 
{
    /**
     * @constructor
     *
     * @param {App} app - The App instance.
     */
    constructor(app) 
    {
        this.app = app;
        this.canvas = app.display.canvas;
        this.glContext = null;
        this.initialized = false;
        this.runParams = null;

        this.computeProgram = null;
        this.bkgndProgram = null;   
        this.renderProgram = null;   
        this.pickProgram = null;   
        
        this.wfTextures = {real:null, imagM:null, imagP: null, real2: null, imagP2: null};
        this.potentialTexture = null;
        this.obstaclesTexture = null;

        this.frameBuffer = null;
        this.vertexIdBuffer = null;
    }

    
    /**
     * Initializes the engine. Fails if WebGL2 is not available.
     *  
     */
    async initialize(runParams)
    {
        this.runParams = runParams;

        // Maybe we are already initialized
        if (this.initialized) { return true; }

        // Try to get a WebGL contextL
        let gl = null;
        if ( window.WebGLRenderingContext ) {
            gl = this.glContext = this.canvas.getContext('webgl2');
        }
        if (!gl) { 
            return false; 
        }

        // Set some context properties 
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // Allow buffers to have sizes that are non-multiples-of-4 
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        // Create programs
        this.computeProgram = await this._createProgram("compute", 'WebGLEngine/computeShader.glsl');
        this.bkgndProgram = await this._createProgram("bkgnd", 'WebGLEngine/backgroundShader.glsl');
        this.renderProgram = await this._createProgram("render", 'WebGLEngine/renderShader.glsl');
        this.pickProgram = await this._createProgram("pick", 'WebGLEngine/pickShader.glsl');

        // Create buffers
        this.frameBuffer = gl.createFramebuffer();
        this.vertexIdBuffer = new WebGLAttributeBuffer(gl, gl.FLOAT, 1, [0,1,2]);
        this.rectangle2DBuffer = new WebGLAttributeBuffer(gl, gl.FLOAT, 2, [-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
        
        // Create textures
        this.obstaclesTexture  = new WebGLTexture2D(gl, 0, 768, 768, gl.R32F, gl.NEAREST, null);
        this.wfTextures.real   = new WebGLTexture2D(gl, 1, 8, 8, gl.RGBA, gl.NEAREST, null);
        this.wfTextures.imagM  = new WebGLTexture2D(gl, 2, 8, 8, gl.RGBA, gl.NEAREST, null);
        this.wfTextures.imagP  = new WebGLTexture2D(gl, 3, 8, 8, gl.RGBA, gl.NEAREST, null);
        this.wfTextures.real2  = new WebGLTexture2D(gl, 4, 8, 8, gl.RGBA, gl.NEAREST, null); 
        this.wfTextures.imagP2 = new WebGLTexture2D(gl, 5, 8, 8, gl.RGBA, gl.NEAREST, null);
        this.potentialTexture  = new WebGLTexture2D(gl, 6, 8, 8, gl.R32F, gl.NEAREST, null);

        // Inform the shaders about the textures
        this.computeProgram.setInputTexture('uPotentialSampler', this.potentialTexture);
        for (let prog of [this.renderProgram, this.pickProgram]) {
            prog.setInputTexture('uObstaclesSampler', this.obstaclesTexture);
            prog.setInputTexture('uWfRealSampler', this.wfTextures.real);
            prog.setInputTexture('uWfImagMSampler', this.wfTextures.imagM);
            prog.setInputTexture('uWfImagPSampler', this.wfTextures.imagP);
        }
        
        return true;
    }


    /**
     * Creates a shader program.
     * 
     * @param {String} name - A name for the module.
     * @param {String} glslFile - The path to a file containing the shader code.
     * @param {Object} vSubs - A map of text substitutions to be made in the shader code.
     */
    async _createProgram(name, glslFile, vSubs=null, fSubs=null)
    {
        // Read the code file as text
        const fetchResponse = await fetch(glslFile);
        const codeFileContents = await fetchResponse.text();

        const codeStrings = codeFileContents.split('// <End vertex shader>');
        let [vCode, fCode] = [codeStrings[0].trim(), codeStrings[1].trim()];

        // Apply any code substitutions
        if (vSubs) {
            for (let key in vSubs) {
                if (vSubs.hasOwnProperty(key)) {           
                    vCode = vCode.split(key).join(vSubs[key]); // Replaces all occurrences of key
                }
            }    
        }
        if (fSubs) {
            for (let key in fSubs) {
                if (fSubs.hasOwnProperty(key)) {           
                    fCode = fCode.split(key).join(vSubs[key]);
                }
            }    
        }

        const prog = new WebGLProgram(this.glContext, name, vCode, fCode)
        return prog;
    }
    

    /**
     * Sets the run parameters. 
     * 
     */
    setRunParams(runParams)
    {
        this.runParams = runParams;
        this.setWavefunction(this.runParams.initialWf);
        this.onObstaclesChanged();
    }


    /**
     * Resets the wavefunction evolution to its initial state.
     * 
     */
    resetEvolution()
    {
        this.setWavefunction( this.runParams.initialWf );
    }


    /**
     * Sets the initial wavefunction.
     * 
     */
    setWavefunction(wf)
    {
        // Pack the floating-point wavefunction values into rgba format
        const convertWfToRgbaFormat = function(wf)
        {
            const toRGBA = function(floatVals, maxAbs)
            {
                const N = floatVals.length;    
                const scale = 2**24;
                const offset = 2**7;        
                const result = new Uint8Array(4*N);
                for (let i=0; i<N; i++) {
                    const i4 = i*4;
                    const uVal = Math.round((floatVals[i]/maxAbs + offset) * scale); 
                    result[i4]     = (uVal & 0xFF000000) >> 24;
                    result[i4 + 1] = (uVal & 0x00FF0000) >> 16;
                    result[i4 + 2] = (uVal & 0x0000FF00) >> 8;
                    result[i4 + 3] = uVal & 0x000000FF;    
                }
                return result;
            }
    
            const maxAbs = Math.sqrt(wf.maxProb);
            return {
                realPart:  toRGBA(wf.realPart,  maxAbs),
                imagPartM: toRGBA(wf.imagPartM, maxAbs),
                imagPartP: toRGBA(wf.imagPartP, maxAbs)
            }
        }        
        const wfData = convertWfToRgbaFormat(wf);


        // Resize buffers if necessary
        if ((wf.nx != this.wfTextures.real.width) || (wf.ny != this.wfTextures.real.height)) 
        {
            this.wfTextures.real.resize(wf.nx, wf.ny, wfData.realPart);
            this.wfTextures.imagM.resize(wf.nx, wf.ny, wfData.imagPartM);
            this.wfTextures.imagP.resize(wf.nx, wf.ny, wfData.imagPartP);
            this.wfTextures.real2.resize(wf.nx, wf.ny, null);
            this.wfTextures.imagP2.resize(wf.nx, wf.ny, null);
        }

        // Otherwise just copy the wavefunction data into our textures 
        else 
        {
            this.wfTextures.real.setData(wfData.realPart);
            this.wfTextures.imagM.setData(wfData.imagPartM);
            this.wfTextures.imagP.setData(wfData.imagPartP);
        }

        // Send the new grid params to the shaders
        this.updateUniforms();
    }


    /**
     * Copies potential-energy values into a gpu buffer.
     * 
     */
    onPotentialChanged()
    {
        const [nx, ny] = [this.runParams.grid.nx, this.runParams.grid.ny];
        const V = this.runParams.potential;

        // Resize buffer if necessary
        if ((nx != this.potentialTexture.width) || (ny != this.potentialTexture.height)) {
            this.potentialTexture.resize(nx, ny, V);
        }
        // Otherwise just copy the potential values into our textures 
        else {
            this.potentialTexture.setData(V);
        }     
    }


    /**
     * Copies obstacle triangles into a gpu buffer
     * 
     */
    onObstaclesChanged()
    {
        let vertices = this.runParams.obstacleSet.getTriangleVertices();
        
        const remainder = vertices.length % this.obstaclesTexture.width;
        if (remainder > 0) {
            const requiredPadding = this.obstaclesTexture.width - remainder;
            vertices = vertices.concat(Array(requiredPadding).fill(0));
        }

        this.obstaclesTexture.setData(new Float32Array(vertices));

        this.runParams.updatePotential();
        this.onPotentialChanged();
    }

    
    /**
     * Informs the engine about a new active object.
     * 
     */
    onActiveObjectChanged(newActiveObjectId)
    {
        this.renderProgram.setUniform('uActiveObjectId', newActiveObjectId, true);
    }


    /**
     * Sends the transformation matrices to the gpu.
     *  
     */
    setTransforms(mvp, rot)
    {
        this.pickProgram.setUniform('uMvp', mvp); 
        this.renderProgram.setUniform('uMvp', mvp); 
        this.renderProgram.setUniform('uRot', rot);       
    }


    /**
     * Sends the current unifom values to the gpu.
     * 
     */
    updateUniforms()
    {
        const rp = this.runParams;
        const rProg = this.renderProgram;
        const cProg = this.computeProgram;
        const pProg = this.pickProgram;
        const bProg = this.bkgndProgram;

        rProg.setUniform('uWfColor', rp.wfColor, true);
        rProg.setUniform('uWfBorderColor', rp.wfBorderColor, false);
        rProg.setUniform('uWfStripeColor', rp.wfStripeColor, false);    
        rProg.setUniform('uN', [rp.grid.nx, rp.grid.ny], false);
        rProg.setUniform('uWfScale', rp.wfScale, false); 
        rProg.setUniform('uFlatShade', rp.flatShade ? 1 : 0, false);
        rProg.setUniform('uDampingBorderWidth', rp.grid.dampingBorder, false); 
        rProg.setUniform('uShowDampingBorder', rp.showDampingBorder ? 1 : 0, false); 
        rProg.setUniform('uAttrsPerVertex', Obstacle.AttrsPerVertex, false);         
        rProg.setUniform('uAmbientLightStrength', rp.ambientLightStrength, false); 
        rProg.setUniform('uDiffuseLightStrength', rp.diffuseLightStrength, false); 
        rProg.setUniform('uSpecularStrength', rp.specularStrength, false); 
        rProg.setUniform('uSpecularShininess', rp.specularShininess, false); 
        rProg.setUniform('uLightDir', rp.lightDir, false); 

        bProg.setUniform('uColor0', rp.bkgndColor0, true);
        bProg.setUniform('uColor1', rp.bkgndColor1, false);   

        cProg.setUniform('uN', [rp.grid.nx, rp.grid.ny], true);
        cProg.setUniform('uGridSpacing', rp.grid.spacing, false);
        cProg.setUniform('uTimeStep', rp.timeStep, false);
        cProg.setUniform('uMass', rp.mass, false);

        pProg.setUniform('uN', [rp.grid.nx, rp.grid.ny], true);
        pProg.setUniform('uWfScale', rp.wfScale, false); 
        pProg.setUniform('uDampingBorderWidth', rp.grid.dampingBorder, false); 
        pProg.setUniform('uShowDampingBorder', rp.showDampingBorder ? 1 : 0, false); 
        pProg.setUniform('uAttrsPerVertex', Obstacle.AttrsPerVertex, false); 
    }


    /**
     * Evolves the wavefunction for a given number of time steps and then 
     * renders the result.
     * 
     */
    evolveAndRender(numEvolutionSteps) 
    {
        const gl = this.glContext;
        const wfs = this.wfTextures;
        const rp = this.runParams;
        const [Nx, Ny] = [rp.grid.nx, rp.grid.ny];
        const bw = rp.grid.dampingBorder;
        const numWfTriangles = rp.showDampingBorder ? 2*(Nx-1)*(Ny-1) : 2*(Nx-2*bw-1)*(Ny-2*bw-1);
        const numObTriangles = rp.obstacleSet.numTriangles();

        if (numEvolutionSteps > 0)
        {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
            gl.useProgram(this.computeProgram.glProgram);
            this.computeProgram.setAttribute('aPosition', this.rectangle2DBuffer);
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.clearColor(0, 0, 0, 1);
            gl.disable(gl.DEPTH_TEST);
            
            for (let k=0; k<Math.floor((numEvolutionSteps+1)/2); k++)
            {
                // "Ping"
                // Compute pass to update the real part of the wf
                this.computeProgram.setInputTexture('uLeftWfSampler', wfs.real, false);
                this.computeProgram.setInputTexture('uRightWfSampler', wfs.imagP, false);
                this.computeProgram.setUniform('uHamSign', 1.0, false);
                gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, wfs.real2.glTexture, 0);
                gl.viewport(0, 0, wfs.real.width, wfs.real.height);
                gl.clear(gl.COLOR_BUFFER_BIT);     
                gl.drawArrays(gl.TRIANGLES, 0, 6);                

                // Compute pass to update the imaginary part of the wf
                this.computeProgram.setInputTexture('uLeftWfSampler', wfs.imagP, false);
                this.computeProgram.setInputTexture('uRightWfSampler', wfs.real2, false);
                this.computeProgram.setUniform('uHamSign', -1.0, false);
                gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, wfs.imagP2.glTexture, 0);
                gl.viewport(0, 0, wfs.real.width, wfs.real.height);
                gl.clear(gl.COLOR_BUFFER_BIT);     
                gl.drawArrays(gl.TRIANGLES, 0, 6); 

                
                // "Pong"
                // Compute pass to update the real part of the wf
                this.computeProgram.setInputTexture('uLeftWfSampler', wfs.real2, false);
                this.computeProgram.setInputTexture('uRightWfSampler', wfs.imagP2, false);
                this.computeProgram.setUniform('uHamSign', 1.0, false);
                gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, wfs.real.glTexture, 0);
                gl.viewport(0, 0, wfs.real.width, wfs.real.height);
                gl.clear(gl.COLOR_BUFFER_BIT);     
                gl.drawArrays(gl.TRIANGLES, 0, 6);                

                // Compute pass to update the imaginary part of the wf
                this.computeProgram.setInputTexture('uLeftWfSampler', wfs.imagP2, false);
                this.computeProgram.setInputTexture('uRightWfSampler', wfs.real, false);
                this.computeProgram.setUniform('uHamSign', -1.0, false);
                gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, wfs.imagP.glTexture, 0);
                gl.viewport(0, 0, wfs.real.width, wfs.real.height);
                gl.clear(gl.COLOR_BUFFER_BIT);     
                gl.drawArrays(gl.TRIANGLES, 0, 6); 
            }

            wfs.imagP.copyTo(wfs.imagM, this.frameBuffer);
        }

        // Render pass
        gl.useProgram(this.bkgndProgram.glProgram);        
        this.bkgndProgram.setAttribute('aLocalVertexIndex', this.vertexIdBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disable(gl.DEPTH_TEST); 
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);   
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, numWfTriangles + numObTriangles);    

        gl.useProgram(this.renderProgram.glProgram);        
        this.renderProgram.setAttribute('aLocalVertexIndex', this.vertexIdBuffer);
        gl.enable(gl.DEPTH_TEST); 
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);  
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, numWfTriangles + numObTriangles);           
    }


    /**
     * Renders the image we use for picking.
     * 
     */
    async getPickedObject(pixelX, pixelY) 
    { 
        const rp = this.runParams;
        const [Nx, Ny] = [rp.grid.nx, rp.grid.ny];
        const bw = rp.grid.dampingBorder;
        const numWfTriangles = rp.showDampingBorder ? 2*(Nx-1)*(Ny-1) : 2*(Nx-2*bw-1)*(Ny-2*bw-1);
        const numObTriangles = rp.obstacleSet.numTriangles();

        const gl = this.glContext;
        gl.useProgram(this.pickProgram.glProgram);        
        this.pickProgram.setAttribute('aLocalVertexIndex', this.vertexIdBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.enable(gl.DEPTH_TEST);  
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);   
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, numWfTriangles + numObTriangles);         

        const pixels = new Uint8Array(4);
        gl.readPixels( Math.round(pixelX), Math.round(this.canvas.height-1 - pixelY), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const id = pixels[0];   

        return Math.round(id);
    }     
}