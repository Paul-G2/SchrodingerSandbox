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

        this.titleSpan = UiUtils.CreateElement('span', 'title-span', 
            this.parentDiv, {top:'0%', height:'100%', left:'0px', width:'100%', 
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#000000', fontFamily:'Arial', fontWeight:'bold', 
            fontStyle:'italic', fontSize: '4.25vh'}
        ); 
        this.titleSpan.innerHTML = 'Schr' + String.fromCharCode(246) + 'dinger Sandbox';
        this.titleSpan.className += " noselect"
    }
    
};