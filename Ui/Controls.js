/**
 * @classdesc
 * This class implements the play/pause/reset buttons.  
 * 
 */
class Controls
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
        this.infoDialog = new InfoDialog(parentDiv);
        this.flashPlayBtn = true;
        const backgndColor = this.backgndColor = '#679ab9';


        // Play
        const self = this;
        this.playBtn = UiUtils.CreateElement('button', 'play-btn', this.parentDiv, 
            {left:'5%', top:'40%', width:'26%', height:'auto', background:backgndColor, borderWidth:'0px'});
        this.playBtn.className += " play_button noselect";
        this.playBtn.innerHTML = '<img class="button-img" src="./media/play.png" border="0" width="100%" height="auto" draggable="false">';
        this.playBtn.onclick = function(e) { self.flashPlayBtn = false; self.app.startEvolving(); }


        // Pause
        this.pauseBtn = UiUtils.CreateElement('button', 'pause-btn', this.parentDiv, 
            {left:'37%', top:'40%', width:'26%', height:'auto', background:backgndColor, borderWidth:'0px'});
        this.pauseBtn.className += " play_button noselect";
        this.pauseBtn.innerHTML = '<img class="button-img" src="./media/pause.png" border="0" width="100%" height="auto" draggable="false">';
        this.pauseBtn.onclick = function(e) { self.app.stopEvolving(); }

        
        // Reset
        this.resetBtn = UiUtils.CreateElement('button', 'reset-btn', this.parentDiv, 
            {left:'69%', top:'40%', width:'26%', height:'auto', background:backgndColor, borderWidth:'0px'});
        this.resetBtn.className += " play_button noselect";
        this.resetBtn.innerHTML = '<img class="button-img" src="./media/reset.png" border="0" width="100%" height="auto" draggable="false">';
        this.resetBtn.onclick = function(e) { self.app.stopEvolving(); self.app.resetEvolution(); }


        // Spacer 1
        UiUtils.CreateElement('div', 'spacer1', this.parentDiv, 
            {left: '31%', top:'40%', width:'6%', height:'auto', background:backgndColor, borderWidth:'0px'});


        // Spacer 2
        UiUtils.CreateElement('div', 'spacer2', this.parentDiv, 
            {left:'63%', top:'40%', width:'6%', height:'auto', background:backgndColor, borderWidth:'0px'});


        // About button
        this.aboutBtn = UiUtils.CreateElement('button', 'about-btn', this.parentDiv, 
            {left:'20%', top:'90%', width:'60%', height:'auto', borderRadius:'1vh',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#404040', fontFamily:'Arial', fontWeight:'bold',
            fontSize: '3vh', background:'#679ab9', border:'3px solid #404040'});
        this.aboutBtn.innerHTML = 'About';
        this.aboutBtn.onclick = function(e) { 
            if ( self.infoDialog.isShown() ) {
                self.infoDialog.hide();
            } else {
                self.infoDialog.show();
            }
        };

        // Create a "shield" to prevent interaction when initializing
        this.shield = UiUtils.CreateElement('div', 'controls-shield', parentDiv, 
            {position: 'absolute', width:'100%', height:'100%', background:'rgba(0, 0, 0, 0.5)',
            backgroundColor:'rgba(0, 0, 0, 0.5)', zIndex:'5', display:'flex'}
        );

        // Disable context menu and selection
        document.getElementById('controls_area').className += ' noselect';
        this.parentDiv.addEventListener('contextmenu', function(e) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault(); 
            return false;
        } );
    }


    /**
     * Raises the shield.
     * 
     */
    raiseShield()
    {
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


    /**
     * Flashes the play button a few times, to draw attention to it.
     */
    animatePlayButton()
    {
        const playBtn1 = this.playBtn;
        const playBtn2 = UiUtils.CreateElement('button', 'play-btn2', this.parentDiv, 
            {left:'5%', top:'40%', width:'26%', height:'auto', background:this.backgndColor, borderWidth:'0px'});
        playBtn2.className += " play_button noselect";
        playBtn2.innerHTML = '<img class="button-img" src="./media/play2.png" "opacity=0" border="0" width="100%" height="auto" draggable="false">';
        playBtn2.onclick = function(e) { this.flashPlayBtn = false; this.app.startEvolving(); }.bind(this);

        let opacity = 1.0;
        let opDeltaSign = 1;
        let numFlashes = 0;
        const animLoop = function() {
            if ((opacity >= 1.0) || (opacity <= 0.0)) { 
                opDeltaSign *= -1; 
                numFlashes += 1;
            }
            opacity += opDeltaSign * (1/75);
            playBtn1.style.opacity = opacity.toString();
            playBtn2.style.opacity = (1-opacity).toString();
            if (this.flashPlayBtn) {    
                requestAnimationFrame(animLoop);
            } 
            else {
                playBtn1.style.opacity = '1.0';
                this.parentDiv.removeChild(playBtn2);
            }
        }.bind(this);
        
        requestAnimationFrame(animLoop);
    }

};