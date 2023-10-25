/**
 * @classdesc
 * This class wraps the main display canvas.  
 * 
 */
class Display
{
    /**
     * @constructor
     * 
     * @param {App} app - The App instance.
     * @param {HTMLElement} parentDiv - The div that hosts this element.
     * 
     */
    constructor(app, parentDiv) 
    { 
        this.app = app;

        // Create my canvas
        this.canvas = UiUtils.CreateElement('canvas', 'display-canvas', parentDiv, 
            {position: 'absolute', width:'100%', height:'100%', background:'#000000'}
        );
        UiUtils.RightsizeCanvas(this.canvas);  

        // Create a "shield" to hide flickering during speed-testing 
        this.shield = UiUtils.CreateElement('div', 'display-shield', parentDiv, 
            {position: 'absolute', width:'100%', height:'100%', background:'rgba(0, 33, 134, 0.99)',
            backgroundColor:'rgba(0, 33, 134, 0.99)', zIndex:'5', 
            alignItems:'center', justifyContent:'center',
            color:'#ffffff', fontFamily:'Arial', fontWeight:'normal', 
            fontStyle:'italic', fontSize: '4.25vh', display:'flex'}
        );

        // Disable context menu and selection
        document.getElementById('display-canvas').className += ' noselect';
        document.getElementById('display-shield').className += ' noselect';
        [this.canvas, this.shield].forEach( elem => {
            elem.addEventListener('contextmenu', function(e) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault(); 
                return false;
            });
        });       
    }


    /**
     * Raises the shield.
     * 
     */
    raiseShield(message)
    {
        this.shield.innerHTML = message || ""; 
        this.shield.style.display = 'flex';
    }

    /**
     * Lowers the shield.
     * 
     */
    lowerShield()
    {
        this.shield.style.display = 'none';
    }
};
