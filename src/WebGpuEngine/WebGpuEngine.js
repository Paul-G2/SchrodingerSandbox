/**
 * @classdesc
 * This is the WebGPU-based renderer.
 * 
 */
class WebGpuEngine 
{
    /**
     * @constructor
     *
     * @param {App} app - The App instance.
     */
    constructor(app, workgroupSize={x:8, y:8}) 
    {
        this.type = "WebGPU";
        this.app = app;
        this.canvas = app.display.canvas;
        this.workgroupSize = {...workgroupSize};
        this.device = null;
        this.initialized = false;
        this.runParams = null;

        this.computePipelineA = null;
        this.computePipelineB = null;
        this.renderPipeline = null;
        this.renderAntiAliasedPipeline = null;
        this.bkgndPipeline = null;
        this.bkgndAntiAliasedPipeline = null;
        this.pickPipeline = null;

        this.depthTexture = null;
        this.msaaTexture = null;
        this.pickTexture = null;

        this.wfBuffers = {real:null, imagM:null, imagP: null};
        this.potentialBuffer = null;
        this.obstaclesBuffer = null;
        this.computeUniformsBuffer = null;
        this.renderUniformsBuffer = null;
        this.bkgndUniformsBuffer = null;
    }


    /**
     * Initializes the engine. Fails if WebGPU is not available.
     *  
     */
    async initialize(runParams)
    {
        this.runParams = runParams;

        // Try to get a WebGPU device
        if (!navigator || !navigator.gpu) { return false; }
        const adapter = await navigator.gpu.requestAdapter(); 
        if (!adapter) { return false; }
        const device = this.device = await adapter.requestDevice();
        if (!device) { return false; }

        // Match the canvas format to the device format
        this.canvas.getContext('webgpu').configure(
            {device: device, format: navigator.gpu.getPreferredCanvasFormat()}
        );    
        
        // Create our display textures, sized to match the canvas
        this._resizeDisplayTextures();

        // Create our pipelines
        await this._createPipelines();

        // Create our uniform buffers
        this.computeUniformsBuffer = device.createBuffer({
            label: 'Compute uniforms',
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bkgndUniformsBuffer = device.createBuffer({
            label: 'Bkgnd uniforms',
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.renderUniformsBuffer = device.createBuffer({
            label: 'Render uniforms',
            size: 240,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Set initial inputs. This will create the remaining buffers.
        this.setWavefunction(this.runParams.initialWf);
        this.onObstaclesChanged();

        return true;
    }


    /**
     * Resizes the depth, msaa, and pick textures to match the canvas size
     * and the current sampleCount.
     * 
     */
    _resizeDisplayTextures()
    {
        const device = this.device;
        const sampleCount = this.runParams.antiAlias ? 4 : 1;

        if (!this.depthTexture || (this.depthTexture.sampleCount != sampleCount) || 
            (this.depthTexture.width != this.canvas.width) || (this.depthTexture.height != this.canvas.height) )
        {
            if (this.depthTexture) { 
                this.depthTexture.destroy(); 
            }
            this.depthTexture = device.createTexture({
                label: 'depth',
                size: [this.canvas.width, this.canvas.height],
                sampleCount: sampleCount, 
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
        }

        if (!this.msaaTexture || (this.msaaTexture.width != this.canvas.width) || 
            (this.msaaTexture.height != this.canvas.height) )
        {
            if (this.msaaTexture) { 
                this.msaaTexture.destroy(); 
                this.msaaTexture = null;
            }
            if (this.runParams.antiAlias)
            {
                this.msaaTexture = device.createTexture({
                    label: 'msaa', 
                    size: [this.canvas.width, this.canvas.height],
                    sampleCount: 4, 
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    usage: GPUTextureUsage.RENDER_ATTACHMENT
                });
            } 
        }
        
        if (!this.pickTexture || (this.pickTexture.sampleCount != 1) || 
            (this.pickTexture.width != this.canvas.width) || (this.pickTexture.height != this.canvas.height) )
        {
            if (this.pickTexture) { 
                this.pickTexture.destroy(); 
            }        
            this.pickTexture = device.createTexture({
                label: 'pick', 
                size: [this.canvas.width, this.canvas.height], 
                sampleCount: 1,  // Don't use anitaliasing when rendering the pick texture
                format: 'r8uint',
                usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
            });    
        } 
    }


    /**
     * Creates the compute, render, and pick pipelines
     * 
     */
    async _createPipelines()
    {
        const device = this.device;

        const computeShaderA = await this._createShaderModule('computeShaderA', 
            'WebGpuEngine/computeShader.wgsl'
        );    
        this.computePipelineA = device.createComputePipeline({
            label: 'Compute A',
            layout: 'auto',
            compute: {
                module: computeShaderA,
                entryPoint: 'computeMain',
                constants: {
                    workgroupSizeX: this.workgroupSize.x,
                    workgroupSizeY: this.workgroupSize.y,
                    hamSign: 1.0,
                }
            },
        });


        const computeShaderB = await this._createShaderModule('computeShaderB', 
            'WebGpuEngine/computeShader.wgsl'
        );   
        this.computePipelineB = device.createComputePipeline({
            label: 'Compute B',
            layout: 'auto',
            compute: {
                module: computeShaderB,
                entryPoint: 'computeMain',
                constants: {
                    workgroupSizeX: this.workgroupSize.x,
                    workgroupSizeY: this.workgroupSize.y,
                    hamSign: -1.0,
                }
            },
        });


        const renderShader = await this._createShaderModule('renderShader', 
            'WebGpuEngine/renderShader.wgsl'
        );
        const createRenderPipeline = function(antiAlias)
        {
            return device.createRenderPipeline({
                label: 'Render',
                layout: 'auto',
                primitive: {
                    topology: 'triangle-list'
                }, 
                depthStencil: {
                    depthWriteEnabled: true,
                    depthCompare: "less",
                    format: "depth24plus",
                },
                vertex: { 
                    module: renderShader, 
                    entryPoint: 'vertMain',
                },
                fragment: {    
                    module: renderShader, 
                    entryPoint: 'fragMain', 
                    targets: [{ 
                        format: navigator.gpu.getPreferredCanvasFormat(),
                    }] 
                },
                multisample: {
                    count: antiAlias ? 4 : 1,
                },  
            });          
        } 
        this.renderPipeline = createRenderPipeline(false);
        this.renderAntiAliasedPipeline = createRenderPipeline(true);
           

        const bkgndShader = await this._createShaderModule('bkgndShader', 
            'WebGpuEngine/backgroundShader.wgsl'
        );
        const creatBkgndPipeline = function(antiAlias)
        {
            return device.createRenderPipeline({
                label: 'Bkgnd',
                layout: 'auto',
                primitive: {
                    topology: 'triangle-list'
                }, 
                vertex: { 
                    module: bkgndShader, 
                    entryPoint: 'vertMain',
                },
                fragment: {    
                    module: bkgndShader, 
                    entryPoint: 'fragMain', 
                    targets: [{ 
                        format: navigator.gpu.getPreferredCanvasFormat(),
                    }] 
                },  
                multisample: {
                    count: antiAlias ? 4 : 1,
                }, 
            });          
        } 
        this.bkgndPipeline = creatBkgndPipeline(false); 
        this.bkgndAntiAliasedPipeline = creatBkgndPipeline(true); 


        const pickShader = await this._createShaderModule('pickShader', 
            'WebGpuEngine/pickShader.wgsl'
        ); 
        this.pickPipeline = device.createRenderPipeline({
            label: 'RenderPick',
            layout: 'auto',
            primitive: {
                topology: 'triangle-list'
            }, 
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus",
            },
            vertex: { 
                module: pickShader, 
                entryPoint: 'vertMain',
            },
            fragment: {    
                module: pickShader, 
                entryPoint: 'fragMain', 
                targets: [{ 
                    format: 'r8uint',
                }] 
            },
            multisample: {
                count: 1, // Don't use anitaliasing when rendering the pick texture
            },
        });
    }


    /**
     * Creates a shader.
     * 
     * @param {String} label - A name for the shader.
     * @param {String} wgslFile - The path to a file containing the shader code.
     * @param {Object} subs - A map of text substitutions to be made in the shader code.
     */
    async _createShaderModule(label, wgslFile, subs=null)
    {
        // Read the code file as text
        const fetchResponse = await fetch(wgslFile);
        let codeString = await fetchResponse.text();

        // Apply any code substitutions
        if (subs) {
            for (let key in subs) {
                if (subs.hasOwnProperty(key)) {           
                    codeString = codeString.split(key).join(subs[key]); // Replaces all occurrences of key
                }
            }    
        }

        const module = this.device.createShaderModule({
            label:label, 
            code:codeString
        });
        return module;
    }
    

    /**
     * Creates our bind groups.
     *
     * 
     */
    _updateBindGroups()
    {
        // Bounce out if we are not yet fully initialized
        if (!this.wfBuffers.real || !this.wfBuffers.imagP || !this.wfBuffers.imagM ||
            !this.potentialBuffer || !this.obstaclesBuffer || !this.renderUniformsBuffer || 
            !this.computeUniformsBuffer) { return; }

        this.computeBindGroupA = this.device.createBindGroup({
            label: 'BindGroupComputeA',
            layout: this.computePipelineA.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.computeUniformsBuffer } },
                { binding: 1, resource: { buffer: this.wfBuffers.real  } },
                { binding: 2, resource: { buffer: this.wfBuffers.imagP } },
                { binding: 3, resource: { buffer: this.wfBuffers.imagM } },
                { binding: 4, resource: { buffer: this.potentialBuffer } },
            ],
        });

        this.computeBindGroupB = this.device.createBindGroup({
            label: 'BindGroupComputeB',
            layout: this.computePipelineB.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.computeUniformsBuffer } },
                { binding: 1, resource: { buffer: this.wfBuffers.imagP  } },
                { binding: 2, resource: { buffer: this.wfBuffers.real } },
                { binding: 3, resource: { buffer: this.wfBuffers.imagM } },
                { binding: 4, resource: { buffer: this.potentialBuffer } },
            ],
        });


        this.bkgndBindGroup = this.device.createBindGroup({
            label: 'BindGroupBkgnd',
            layout: this.bkgndPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: this.bkgndUniformsBuffer }}
            ],
        });

        this.bkgndAntiAliasedBindGroup = this.device.createBindGroup({
            label: 'BindGroupBkgnd',
            layout: this.bkgndAntiAliasedPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: this.bkgndUniformsBuffer }}
            ],
        });


        this.renderBindGroup = this.device.createBindGroup({
            label: 'BindGroupRender',
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: this.renderUniformsBuffer }},
              { binding: 1, resource: { buffer: this.wfBuffers.real  } },
              { binding: 2, resource: { buffer: this.wfBuffers.imagP } },
              { binding: 3, resource: { buffer: this.wfBuffers.imagM } },
              { binding: 4, resource: { buffer: this.obstaclesBuffer } },
            ],
        });

        this.renderAntiAliasedBindGroup = this.device.createBindGroup({
            label: 'BindGroupRender',
            layout: this.renderAntiAliasedPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: this.renderUniformsBuffer }},
              { binding: 1, resource: { buffer: this.wfBuffers.real  } },
              { binding: 2, resource: { buffer: this.wfBuffers.imagP } },
              { binding: 3, resource: { buffer: this.wfBuffers.imagM } },
              { binding: 4, resource: { buffer: this.obstaclesBuffer } },
            ],
        });

        this.pickBindGroup = this.device.createBindGroup({
            label: 'BindGroupPick',
            layout: this.pickPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: this.renderUniformsBuffer }},
              { binding: 1, resource: { buffer: this.wfBuffers.real  } },
              { binding: 2, resource: { buffer: this.wfBuffers.imagP } },
              { binding: 3, resource: { buffer: this.wfBuffers.imagM } },
              { binding: 4, resource: { buffer: this.obstaclesBuffer } },
            ],
        });
    }
    
    
    /**
     * Sets the run parameters. 
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
        // Resize existing buffers if necessary
        const device = this.device;
        const bufferByteLength = wf.realPart.byteLength;
        if (this.wfBuffers.real && (this.wfBuffers.real.size != bufferByteLength)) {
            for (let key in this.wfBuffers) { 
                this.wfBuffers[key].destroy();
                this.wfBuffers[key] = null;
            }
        }

        if (!this.wfBuffers.real ) 
        {
            this.wfBuffers.real = device.createBuffer({
                label: 'wfReal',
                size: bufferByteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });

            this.wfBuffers.imagM = device.createBuffer({
                label: 'wfImagM',
                size: bufferByteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });

            this.wfBuffers.imagP = device.createBuffer({
                label: 'wfImagP',
                size: bufferByteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
        }

        // Copy the wavefunction values into our buffers
        const queue = device.queue;
        queue.writeBuffer(this.wfBuffers.real,  0, wf.realPart);
        queue.writeBuffer(this.wfBuffers.imagM, 0, wf.imagPartM);
        queue.writeBuffer(this.wfBuffers.imagP, 0, wf.imagPartP);
        
        this._updateBindGroups();
        this.updateUniforms();
    }


    /**
     * Copies potential-energy values into a gpu buffer.
     * 
     */
    onPotentialChanged()
    {
        const V = this.runParams.potential;
        const bufferByteLength = V.byteLength;
        if (this.potentialBuffer && (this.potentialBuffer.size != bufferByteLength)) {
            this.potentialBuffer.destroy();
            this.potentialBuffer = null; 
        }

        // Create new buffers if necessary
        if (!this.potentialBuffer ) 
        {
            this.potentialBuffer = this.device.createBuffer({
                label: 'Potential',
                size:  bufferByteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST 
            }); 
            this._updateBindGroups(); 
        }

        this.device.queue.writeBuffer(this.potentialBuffer, 0, V);
    }
    
    
    /**
     * Copies obstacle triangles into a gpu buffer
     * 
     */
    onObstaclesChanged()
    {
        const vertices = new Float32Array( this.runParams.obstacleSet.getTriangleVertices() );
        const bufferSize = Math.max(4, vertices.byteLength);

        if (this.obstaclesBuffer && (this.obstaclesBuffer.size != bufferSize)) {
            this.obstaclesBuffer.destroy();
            this.obstaclesBuffer = null; 
        }

        // Create new buffers if necessary
        if (!this.obstaclesBuffer ) 
        {
            this.obstaclesBuffer = this.device.createBuffer({
                label: 'Obstacles',
                size:  bufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST 
            }); 
            this._updateBindGroups();
        }
        this.device.queue.writeBuffer(this.obstaclesBuffer, 0, vertices);

        this.runParams.updatePotential();
        this.onPotentialChanged();
    }


    /**
     * Informs the engine about a new active object.
     * 
     */
    onActiveObjectChanged(newActiveObjectId)
    {
        this.device.queue.writeBuffer(this.renderUniformsBuffer, 220, new Uint32Array([newActiveObjectId])); 
    }


    /**
     * Sends the transformation matrices to the gpu.
     *  
     */
    setTransforms(mvp, rot)
    {
        this.device.queue.writeBuffer(this.renderUniformsBuffer, 0, mvp); 
        this.device.queue.writeBuffer(this.renderUniformsBuffer, 64, rot);         
    }


    /**
     * Sends the current unifom values to the gpu.
     * 
     */
    updateUniforms()
    {
        const rp = this.runParams;
        const queue = this.device.queue; 
        const rbuf = this.renderUniformsBuffer;
        const cbuf = this.computeUniformsBuffer;
        const bbuf = this.bkgndUniformsBuffer;
               
        queue.writeBuffer(rbuf, 128, new Float32Array(rp.wfColor));  
        queue.writeBuffer(rbuf, 144, new Float32Array(rp.wfBorderColor));  
        queue.writeBuffer(rbuf, 160, new Float32Array(rp.wfStripeColor));    
        queue.writeBuffer(rbuf, 176, new Uint32Array([rp.grid.nx, rp.grid.ny]));
        queue.writeBuffer(rbuf, 184, new Float32Array([rp.wfScale/rp.initialWf.maxProb]));
        queue.writeBuffer(rbuf, 188, new Float32Array(rp.flatShade ? [1] : [0]));   
        queue.writeBuffer(rbuf, 192, new Uint32Array([rp.grid.dampingBorder]));  
        queue.writeBuffer(rbuf, 196, new Uint32Array(rp.showDampingBorder ? [1] : [0]));  
        queue.writeBuffer(rbuf, 200, new Float32Array([rp.ambientLightStrength])); 
        queue.writeBuffer(rbuf, 204, new Float32Array([rp.diffuseLightStrength])); 
        queue.writeBuffer(rbuf, 208, new Float32Array([rp.specularStrength])); 
        queue.writeBuffer(rbuf, 212, new Float32Array([rp.specularShininess])); 
        queue.writeBuffer(rbuf, 216, new Uint32Array([Obstacle.AttrsPerVertex])); 
        queue.writeBuffer(rbuf, 224, new Float32Array(rp.lightDir)); 

        queue.writeBuffer(cbuf, 0,   new Uint32Array([rp.grid.nx, rp.grid.ny])); 
        queue.writeBuffer(cbuf, 8,   new Float32Array([rp.grid.spacing, rp.timeStep, rp.mass]));

        queue.writeBuffer(bbuf, 0,   new Float32Array(rp.bkgndColor0));  
        queue.writeBuffer(bbuf, 16,  new Float32Array(rp.bkgndColor1)); 
    }

    /**
     * Turns anti-aliasing on or off.
     *  
     */
    _setAntiAlias(val)
    {
        val = !!val;
        if (val != this.runParams.antiAlias) {
            this.runParams.antiAlias = val;
            this._resizeDisplayTextures();
        }       
    }


    /**
     * Evolves the wavefunction for a given number of time steps and then 
     * renders the result.
     * 
     */
    evolveAndRender(numEvolutionSteps) 
    {
        // Create a command encoder 
        const rp = this.runParams;
        const [Nx, Ny] = [rp.grid.nx, rp.grid.ny];
        const workgroupCount = {x: Math.ceil(Nx/this.workgroupSize.x), y: Math.ceil(Ny/this.workgroupSize.y) };
        const ctx = this.canvas.getContext('webgpu');
        const commandEncoder = this.device.createCommandEncoder({ label: 'evolveAndRender encoder' });
        {

            for (let k=0; k<numEvolutionSteps; k++)  
            {
                const computePassA = commandEncoder.beginComputePass({label: 'Compute pass A'});            
                computePassA.setPipeline(this.computePipelineA);
                computePassA.setBindGroup(0, this.computeBindGroupA);
                computePassA.dispatchWorkgroups(workgroupCount.x, workgroupCount.y); 
                computePassA.end();           
        
                const computePassB = commandEncoder.beginComputePass({label: 'Compute pass B'});
                computePassB.setPipeline(this.computePipelineB);
                computePassB.setBindGroup(0, this.computeBindGroupB);
                computePassB.dispatchWorkgroups(workgroupCount.x, workgroupCount.y);
                computePassB.end(); 
            }
            

            const bkgndPass = commandEncoder.beginRenderPass({
                label: 'Bkgnd pass',
                colorAttachments: [{
                    view: rp.antiAlias ? this.msaaTexture.createView() : ctx.getCurrentTexture().createView(),
                    resolveTarget: rp.antiAlias ? ctx.getCurrentTexture().createView() : undefined,
                    clearValue: [0, 0, 0, 1],
                    loadOp: 'clear',  
                    storeOp: 'store' 
                }],
            });
            if (rp.antiAlias) {
                bkgndPass.setPipeline(this.bkgndAntiAliasedPipeline);
                bkgndPass.setBindGroup(0, this.bkgndAntiAliasedBindGroup);
            } 
            else {
                bkgndPass.setPipeline(this.bkgndPipeline);
                bkgndPass.setBindGroup(0, this.bkgndBindGroup);
            }
            bkgndPass.draw(6);  
            bkgndPass.end();


            const renderPass = commandEncoder.beginRenderPass({
                label: 'Render pass',
                colorAttachments: [{
                    view: rp.antiAlias ? this.msaaTexture.createView() : ctx.getCurrentTexture().createView(),
                    resolveTarget: rp.antiAlias ? ctx.getCurrentTexture().createView() : undefined,
                    loadOp: 'load',  
                    storeOp: 'store' 
                }],
                depthStencilAttachment: {
                    view: this.depthTexture.createView(),
                    depthClearValue: 1.0,
                    depthLoadOp: "clear",
                    depthStoreOp: "store",
                },
            });
            if (rp.antiAlias) {
                renderPass.setPipeline(this.renderAntiAliasedPipeline);
                renderPass.setBindGroup(0, this.renderAntiAliasedBindGroup);
            } 
            else {
                renderPass.setPipeline(this.renderPipeline);
                renderPass.setBindGroup(0, this.renderBindGroup);
            }
            const bw = rp.grid.dampingBorder;
            const numWfVertices = rp.showDampingBorder ? 6*(Nx-1)*(Ny-1) : 6*(Nx-2*bw-1)*(Ny-2*bw-1);
            const numObVertices = 3 * rp.obstacleSet.numTriangles();
            renderPass.draw(numWfVertices + numObVertices);  
            renderPass.end();
        }
        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);  
    }


    /**
     * Renders the image used for picking.
     * 
     */
    async getPickedObject(pixelX, pixelY) 
    { 
        // Disable anti-aliasing 
        const rp = this.runParams;
        const prevAntiAliasFlag = rp.antiAlias;
        this._setAntiAlias(false);

        // Create a command encoder 
        const [Nx, Ny] = [rp.grid.nx, rp.grid.ny];
        const commandEncoder = this.device.createCommandEncoder({ label: 'renderPickImage encoder' });
        
        // Render the obstacle-id map
        const renderPass = commandEncoder.beginRenderPass({label: 'Render pick pass',
            colorAttachments: [{
                view: this.pickTexture.createView(),
                clearValue: [0, 0, 0, 0],
                loadOp: 'clear',  
                storeOp: 'store' 
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
        });

        const bw = rp.grid.dampingBorder
        const numWfVertices = rp.showDampingBorder ? 6*(Nx-1)*(Ny-1) : 6*(Nx-2*bw-1)*(Ny-2*bw-1);
        const numObVertices = 3 * rp.obstacleSet.numTriangles();
        renderPass.setPipeline(this.pickPipeline);
        renderPass.setBindGroup(0, this.pickBindGroup);
        renderPass.draw(numWfVertices + numObVertices);  
        renderPass.end();
        
        // Read the id value at the given location
        const pickBuffer = this.device.createBuffer({size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});
        commandEncoder.copyTextureToBuffer(
            { texture: this.pickTexture, origin: {x: pixelX, y: pixelY} }, 
            { buffer: pickBuffer },
            { width: 1 }
        );
        
        this.device.queue.submit([commandEncoder.finish()]);  
        await pickBuffer.mapAsync(GPUMapMode.READ);
        const ids = new Uint8Array(pickBuffer.getMappedRange());
        const id = ids[0];
        pickBuffer.unmap();
        pickBuffer.destroy();

        // Restore previous anti-alias setting
        this._setAntiAlias(prevAntiAliasFlag);
        
        return id;
    }
}
