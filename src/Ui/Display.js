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

        this.progressDiv = UiUtils.CreateElement('div', 'progress-div', this.shield, 
        {left:'0%', top:'43%', width:'100%', height:'25%', borderWidth:'0px', display:'flex', justifyContent:'center'});
        this.progressDiv.className += " noselect";
        this.progressDiv.innerHTML = '<img src="./media/ProgressBar.svg" border="0" width="100%" height="100%" draggable="false">';

        this.messageDiv = UiUtils.CreateElement('div', 'message-div', this.shield, 
        {left:'0%', top:'45%', width:'100%', height:'auto', display:'flex', justifyContent:'center', borderWidth:'0px', zIndex:'2'});
        this.messageDiv.className += " noselect";

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
        this.messageDiv.innerHTML = '&nbsp; ' + message || ""; 
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