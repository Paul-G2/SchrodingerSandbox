/**
 * @classdesc
 * This class implements a dialog for displaying help info.
 * 
 */
InfoDialog = class 
{

    /**
     * @constructor
     * 
     * @param {HTMLElement} parent - The html div that will host the dialog.
     */
    constructor(parent) 
    {
        this.parent     = parent;
        this.fontFamily = 'verdana, arial, helvetica, sans-serif';
        this.width      = 60; // %
        this.height     = 60; // %

        // Container div
        this.mainDiv = UiUtils.CreateElement('div', 'dialog_maindiv', this.parent.parentNode, 
            {display:'none', width:this.width.toString() + '%', 
            height:this.height.toString() + '%', 
            left:((100 - this.width)/2).toString() + '%', 
            top:((100 - this.height)/2).toString() + '%', 
            zIndex:'10', backgroundColor:'#d5bfa2',
            border:'1px solid black'} );
            
        // Titlebar 
        const titleFontSize = (.03 * this.height).toString() + 'vh';
        this.titleDiv = UiUtils.CreateElement('div', 'dialog_titlediv', this.mainDiv, 
            {width:'95%',height:'7%', left:'0px', top:'0px', display:'flex', alignItems:'center', 
            justifyContent:'center', backgroundColor:'#c09f72', fontSize:titleFontSize, 
            fontFamily:this.fontFamily} 
        );
        this.titleDiv.innerHTML = 'App info';
        this.titleDiv.className += ' noselect';

        // Close button
        this.closeDiv = UiUtils.CreateElement('div', 'dialog_closediv', this.mainDiv,
            {width:'5%', height:'7%', right:'0px', top:'0px', display:'flex', 
            alignItems:'center', justifyContent:'center',
            backgroundColor:'#c09f72', fontSize:titleFontSize, fontFamily:this.fontFamily} 
        );
        this.closeDiv.innerHTML = 'X';
        this.closeDiv.className += ' noselect';
        this.closeDiv.addEventListener('click', this.hide.bind(this) ); 
        this.closeDiv.addEventListener( 
            'mouseover', function() { this.closeDiv.style.fontWeight = 'bold'; }.bind(this) ); 
        this.closeDiv.addEventListener( 
            'mouseout',  function() { this.closeDiv.style.fontWeight = 'normal'; }.bind(this) ); 

        // Escape key
        document.onkeydown = function(evt) {
            evt = evt || window.event;
            const isEscape = ("key" in evt) ? (evt.key === "Escape" || evt.key === "Esc") : (evt.keyCode === 27);
            if (isEscape) { this.hide(); }
        }.bind(this);


        // User content div
        this.userDiv = UiUtils.CreateElement('div', 'dialog_userdiv', this.mainDiv, 
            {bottom:'0px', left:'0px', 
            width:'100%', height:'93%', overflowX:'auto', overflowY:'auto'} 
        ); 
        
        this.textDiv = UiUtils.CreateElement('div', 'text-div',
            this.userDiv, {left:'3%', width:'94%', height:'100%',
            fontSize:'20px', fontFamily:this.fontFamily, color:'#3f3930'}
        );

        this.textDiv.innerHTML =
        '<p></p>' + 
        '<p>This app simulates quantum mechanical wavepacket scattering, by solving the Schr\xF6dinger equation in real time on a 2-dimensional grid.</p>' +

        '<p>The height of the orange surface gives the probability of finding the scattered particle at each grid point, and the white bands show where the phase of the wavefunction is zero.</p>' +

        '<p>The calculations are done on your device\'s GPU, via WebGPU or WebGL, whichever is available.</p>' +
        '<p>(If your device doesn\'t have a GPU, then the app won\'t run!)</p>' +

        '<p>The scattering obstacles can be chosen from the upper-right palette, ' +
        'and then moved and rotated interactively.</p>' +

        '<p>If you\'re interested in  the implementation details, you can check out the ' + 
        '<a href="https://github.com/Paul-G2/Schrodinger-Sandbox">project repository</a> on GitHub.</p>' +
        '<br />';
    } 


    /**
     * Shows the dialog.
     * 
     * @param {Function} [onOk] - Function to invoke if the dialog's OK button is clicked.
     * @param {Function} [onCancel] - Function to invoke if the dialog is cancelled.
     * 
     */
    show()
    {
        this.mainDiv.style.display = 'inline-block';  
    }


    /**
     * Hides the dialog.
     * 
     */
    hide()
    {
        this.mainDiv.style.display = 'none';  
    }


    /**
     * Indicates whether the dialog is currenty shown.
     * 
     */
    isShown()
    {
        return this.mainDiv.style.display != 'none';  
    }

};






