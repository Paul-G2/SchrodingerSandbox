/**
 * @classdesc
 * This is the application's title bar.
 * 
 */
class Topbar
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
        this.animating = false;
        this.umlautOpacity = 0.9;
        this.deltaOpacitySign = 1;

        this.titleSpan1 = UiUtils.CreateElement('span', 'title-span', 
            this.parentDiv, {top:'0%', height:'100%', left:'0px', width:'100%', 
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'rgba(0,0,0, 0.9)', fontFamily:'Arial', fontWeight:'bold', 
            fontStyle:'italic', fontSize: '4.25vh'}
        ); 
        this.titleSpan1.innerHTML = 'Schr' + String.fromCharCode(246) + 'dinger Sandbox'; // umlaut
        this.titleSpan1.className += " noselect"

        this.titleSpan2 = UiUtils.CreateElement('span', 'title-span', 
            this.parentDiv, {top:'0%', height:'100%', left:'0px', width:'100%', 
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'rgba(0,0,0, 1.0)', fontFamily:'Arial', fontWeight:'bold', 
            fontStyle:'italic', fontSize: '4.25vh'}
        ); 
        this.titleSpan2.innerHTML = 'Schrodinger Sandbox'; // no umlaut
        this.titleSpan2.className += " noselect"
    }


    /**
     * Starts the title animation
     */
    startAnimation()
    {
        if (!this.animating)
        {
            this.animating = true;
            const animLoop = function() {
                if ((this.umlautOpacity >= 0.9) || (this.umlautOpacity <= 0.0)) { this.deltaOpacitySign *= -1; }
                this.umlautOpacity += this.deltaOpacitySign*(1/60);
                this.titleSpan1.style.color = 'rgba(0,0,0, ' + this.umlautOpacity.toString() + ')';
                if (this.animating) {    
                    requestAnimationFrame(animLoop);
                } else {
                    this.animating = false;
                }
            }.bind(this);
            requestAnimationFrame(animLoop);
        }
    }

    /**
     * Stops the title animation
     */
    stopAnimation()
    {
        this.animating = false;
        this.umlautOpacity = 0.9;
        this.deltaOpacitySign = 1;
        this.titleSpan1.style.color = 'rgba(0,0,0, ' + this.umlautOpacity.toString() + ')';
    }
    
};