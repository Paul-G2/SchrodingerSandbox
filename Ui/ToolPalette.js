/**
 * @classdesc
 * This clss holds the obstacle-creation buttons.  
 * 
 */
class ToolPalette
{
    /**
     * @constructor
     * 
     * @param {App} app - The App instance.
     * @param {HTMLElement} parentDiv - The div that hosts this ui.
     * 
     */
    constructor(app, parentDiv) 
    { 
        this.app = app;
        this.parentDiv = parentDiv;   
        this.addShapeSound = new Audio('./addShapeSound.mp3');
        this.addShapeSound.preload = 'auto';
        const btnColor = '#99d9ea';

        const self = this;
        this.cylBtn = this.createObstacleButton('cyl-obstacle-btn', 1, 1, btnColor, "./cyl.png");
        this.cylBtn.onclick = function() { self.addObstacle( new Cylinder({vMax:self.app.engine.runParams.Vmax}) ); };

        this.boxBtn = this.createObstacleButton('box-obstacle-btn', 1, 2, btnColor, "./box.png");
        this.boxBtn.onclick = function() { self.addObstacle( new Box({vMax:self.app.engine.runParams.Vmax}) ); };

        this.slitBtn = this.createObstacleButton('slit-obstacle-btn', 1, 3, btnColor, "./slits.png");
        this.slitBtn.onclick = function() { self.addObstacle( new DoubleSlit({vMax:self.app.engine.runParams.Vmax}) ); };

        this.rampBtn = this.createObstacleButton('ramp-obstacle-btn', 2, 1, btnColor, "./ramp.png");
        this.rampBtn.onclick = function() { self.addObstacle( new Ramp({vMax:0.6*self.app.engine.runParams.Vmax}) ); };

        this.arcBtn = this.createObstacleButton('arc-obstacle-btn', 2, 2, btnColor, "./arc.png");
        this.arcBtn.onclick = function() { self.addObstacle( new Arc({vMax:self.app.engine.runParams.Vmax}) ); };

        this.corralBtn = this.createObstacleButton('corral-obstacle-btn', 2, 3, btnColor, "./corral.png");
        this.corralBtn.onclick = function() { self.addObstacle( new Arc({vMax:self.app.engine.runParams.Vmax, 
            center:[0.6, 0.6], radius:0.19, span:320, height:0.1998, color:[0.86, 0.86, 0.86, 1]}) ); };
    }
    

    /**
     * Creates and configures an obstacle button.
     * 
     */
    createObstacleButton(name, gridRow, gridCol, color, imgSrc)
    {
        const border0 = '0px solid';
        const border1 = '3px solid rgba(58, 102, 129, 255)';
        const border2 = '6px solid rgba(58, 102, 129, 255)';

        const btn = UiUtils.CreateElement('button', name, this.parentDiv, 
            {top: (gridRow == 1) ? '0' : '15%',
            left: ((gridCol - 1)*33.3).toString() + '%',
            width: '33.3%', height: '15%', background:color, 
            borderLeft: (gridCol == 1) ? border0 : border1,
            borderTop: (gridRow == 1) ? border2 : border1,
            borderRight: (gridCol == 3) ? border0 : border1,
            borderBottom: (gridRow == 2) ? border2 : border1});

        btn.className += " obstacle_button noselect";

        if (imgSrc.length > 0) {
            btn.innerHTML = '<img class="button-img" src="' + imgSrc + 
                '" border="0" width="80%" height="80%" draggable="false">';

            btn.onpointerdown = (function() {
                this.addShapeSound.currentTime = 0; 
                this.addShapeSound.play();
            }).bind(this);
        }    
        
        return btn;
    }


    /**
     * Adds an obstacle to the grid.
     * 
     * @param {Obstacle} ob - The Obstacle to add. 
     */
    addObstacle(ob)
    {
        const app = this.app;
        const rp = app.engine.runParams;
        const obstacleSet = rp.obstacleSet;
        const maxObstacles = 25;
        const minSep = 0.09;
        const eps = 0.0001;
     
        // Offet the new obstacle from any existing ones
        if (obstacleSet.obstacles.length < maxObstacles) {
            let [dx, dy] = [0, 0];
            const others = obstacleSet.obstacles.filter((other) => other.name == ob.name);
            if (others.length > 0) {
                let done = false;
                for (dy=0; dy<5 && !done; dy++) {
                    for (dx=0; dx<5 && !done; dx++) {
                        const nearby = others.find((other) => 
                            (Math.abs(other.center[0]-ob.center[0]-dx*minSep) < (minSep - eps)) && 
                            (Math.abs(other.center[1]-ob.center[1]-dy*minSep) < (minSep - eps)));
                        if (!nearby) { done = true; }
                    }
                }
                dx -= 1;  dy -= 1;
            }
            
            ob.translate(dx*minSep, dy*minSep);
            obstacleSet.add(ob);   
            if (!app.animating) { app.redrawScene(); }
        }
    }
};
