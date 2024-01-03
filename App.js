/**
 * @classdesc
 * This is the main class for the App.  
 * 
 */
class App
{
    /**
     * @constructor
     * 
     */
    constructor() 
    { 
        // Create the app components
        this.topBar = new Topbar(this, document.getElementById('topbar_area'));
        this.display = new Display(this, document.getElementById('display_area'));
        this.toolPalette = new ToolPalette(this, document.getElementById('controls_area'));
        this.controls = new Controls(this, document.getElementById('controls_area'));
        this.interactor = new Interactor(this);
        this.engine = null;

        // State variables
        this.evolving = false;
        this.animating = false;
        this.autoStopTimer = null;

        // Cache any url arguments
        try {
            let urlArgs = {};
            for (let item of window.location.search.substring(1).split("&")) {
                if (item !== "") {
                    const param = item.split("=");
                    if (param && param.length == 2) {
                        urlArgs[decodeURIComponent(param[0]).toLowerCase()] = 
                            decodeURIComponent(param[1] || "");
                    }
                }
            }
            this.forceWebGL = !!(urlArgs.forcewebgl ? parseInt(urlArgs.forcewebgl) : 0);
            this.showBorder = !!(urlArgs.showborder ? parseInt(urlArgs.showborder) : 0);
            this.popupLogs = (urlArgs.popuplogs ? parseInt(urlArgs.popuplogs) : 0);
            if (this.popupLogs > 0) { Logger.popupErrors(true); }
            if (this.popupLogs > 1) { Logger.popupWarnings(true); }
            if (this.popupLogs > 2) { Logger.popupInfoMessages(true); }
        }
        catch {
            Logger.warn('Error reading url args.');
        }
    }
    

    /**
     * Creates the WebGPU or WebGL context and sets initial parameters.
     * 
     */
    async initialize()
    {        
        // Try to create an engine
        this.raiseShield('Initializing...');
        try 
        {
            let engineOk = true;
            let rp = new RunParams(this, 128);  // Initial (dummy) RunParams
            if (this.forceWebGL) {
                this.engine = new WebGLEngine(this);
                if ( !(await this.engine.initialize(rp)) ) {
                    engineOk = false;
                }     
            } 
            else {
                this.engine = new WebGpuEngine(this);
                if ( !(await this.engine.initialize(rp)) ) {
                    this.engine = new WebGLEngine(this);
                    if ( !(await this.engine.initialize(rp)) ) {
                        engineOk = false;
                    }
                }
            }
            if (!engineOk) {
                const msg = "Sorry, initialization failed. This app needs WebGPU or WebGL to run."
                alert(msg);
                Logger.error(msg);
                return;
            }
            Logger.info("Using " + this.engine.constructor.name);

            // Determine the optimal grid resolution for the current device
            const [rez, fps] = await this._getOptimalGridResolution();
            rp = new RunParams(this, rez); 

            this.controls.infoDialog.textDiv.innerHTML = this.controls.infoDialog.textDiv.innerHTML.replace(
                '#Note1#', 'Found ' + this.engine.type + ' on this device.');
            this.controls.infoDialog.textDiv.innerHTML = this.controls.infoDialog.textDiv.innerHTML.replace(
                '#Note2#', 'Grid size set to ' + rp.grid.nx.toString() + ', FPS = ' + fps.toString() + '.' );

            // Render the initial scene
            rp.showDampingBorder = this.showBorder;
            rp.obstacleSet.add( new DoubleSlit(), false );
            this.engine.setRunParams(rp);
            this.engine.resetEvolution();
            requestAnimationFrame(function() {
                this.engine.evolveAndRender(0); 
                this.lowerShield();
            }.bind(this));     
            setTimeout( function(){ this.controls.animatePlayButton() }.bind(this), 1500 );
        }
        catch (err) {
            const rawMsg = (err && err.message) ? err.message : null;
            let userMsg = "Initialization failed due to low graphics memory. Try closing other browser tabs, then reload this page."
            if (rawMsg) { userMsg += "\n\nError details: " + rawMsg; }
            Logger.error(userMsg);
            alert(userMsg);
            this.raiseShield("");
        }
    }


    /**
     * Starts the wavefunction evolution.
     */
    startEvolving()
    {
        if (!this.evolving)
        {
            this.evolving = true;
            this.animate();
            this.topBar.startAnimation();

            this.autoStopTimer = setTimeout(
                function() {this.stopEvolving()}.bind(this), 60000);
        }
    }


    /**
     * Stops the wavefunction evolution.
     */
    stopEvolving()
    {
        this.evolving = false;
        this.topBar.stopAnimation();

        if (this.autoStopTimer !== null) {
            clearTimeout(this.autoStopTimer);
            this.autoStopTimer = null;
        }
    }
    

    /**
     * Resets the wavefunction evolution to its initial state.
     */    
    resetEvolution()
    {
        this.engine.resetEvolution();
        if (!this.animating) { this.redrawScene(); }
    }


    /**
     * Starts the animation loop, if it's not already running.
     */
    animate()
    {
        if (!this.animating)
        {
            this.animating = true;
            const animLoop = function() {
                this.engine.setTransforms(...this.interactor.getTransforms());
                this.engine.evolveAndRender(this.evolving ? this.engine.runParams.evolutionChunkSize : 0);

                if (this.evolving || this.interactor.active) {    
                    requestAnimationFrame(animLoop);
                } else {
                    this.animating = false;
                }
            }.bind(this);
            requestAnimationFrame(animLoop);
        }
    }


    /**
     * Draws the scene with the current parameters.
     */
    redrawScene()
    {
        requestAnimationFrame(function() {
            this.engine.setTransforms(...this.interactor.getTransforms());
            this.engine.evolveAndRender(0);                
        }.bind(this));  
    }


    /**
     * Finds the highest grid resolution that gives acceptable performance.
     * 
     */
    async _getOptimalGridResolution()
    {
        this.engine.setTransforms(...this.interactor.getTransforms());

        // Gradually increase resolution until the performance degrades
        let fpsVals = [];
        let fpsText = [];
        const rezList = [128, 192, 256, 384, 512, 768, 1024, 1536, 2048];
        let r = 0;
        for (r=0; r < rezList.length; r++) {
            try {
                const rp = new RunParams(this, rezList[r]); 
                rp.obstacleSet.add( new DoubleSlit(), false );
                this.engine.setRunParams(rp);

                let fps = await this._measureFps(15, 8, rp.evolutionChunkSize);
                if (fps < 50) { 
                    fps = await this._measureFps(15, 8, rp.evolutionChunkSize); // Retry
                }
                fpsVals.push(Math.round(fps));
                fpsText.push('rez: ' + rezList[r].toString() + '.  fps: ' + Math.round(fps).toString());
                if (fps < 50) {
                    r -= 1;
                    break;
                }
            }
            catch {
                r -= 1;
                break;
            }
        }
        r = Math.max(0, Math.min(rezList.length-1, r));
        fpsText.push('Chosen ' + fpsText[r]);
        Logger.info(fpsText.join('\n'));

        return [rezList[r], fpsVals[r]];
    }


    /**
     * Measures the frame rate.
     *
     */
    async _measureFps(numIters, warmup, chunkSize)
    {
        this.frameCount = 0;
        this.startTime = -1;

        const self = this;
        await new Promise(resolve => {
            function _animate() {
                if (self.frameCount == warmup) { 
                    self.startTime = Date.now(); 
                }
                if (self.frameCount++ < numIters) {
                    self.engine.evolveAndRender(chunkSize);
                    requestAnimationFrame(_animate);
                } else {
                    resolve();
                }
            }
            requestAnimationFrame(_animate);
        });

        const fps = (numIters - warmup) * 1000/(Date.now() - this.startTime);
        this.frameCount = this.startTime = undefined;
        return fps;
    }


    /**
     * Raises the shield.
     * 
     */
    raiseShield(message)
    {
        this.display.raiseShield(message);
        this.controls.raiseShield();
    }


    /**
     * Lowers the shield.
     * 
     */
    lowerShield()
    {
        this.display.lowerShield();
        this.controls.lowerShield();
    }

};
