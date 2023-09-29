  
    
/**
 * @classdesc
 * This class provides some utility functions needed by the UI classes.
 * 
 */
class UiUtils
{    
    /**
     * Creates an html element and appends it to the parent.
     *
     */
    static CreateElement(type, id, parent, styles, props) 
    {
        const elem = document.createElement(type);
        elem.id = id;

        if (parent) { parent.append(elem); }

        if (styles) {
            for (let styName in styles) {
                if (Object.prototype.hasOwnProperty.call(styles, styName)) {
                    const val = styles[styName];
                    if (typeof val === 'number') { 
                        val = val.toString() + 'px'; 
                    }
                    else if ((typeof val === 'string') && (val.trim().length > 1) && 
                        !isNaN(Number(val.slice(0,-1))) && val.endsWith("n")) {
                            val = Number(val.slice(0,-1));  // 'e.g., 123n'
                    }
                    elem.style[styName] = val;
                }
            }
        }
        if (props) {
            for (let propName in props) {
                if (Object.prototype.hasOwnProperty.call(props, propName)) {
                    elem[propName] = props[propName];
                }
            }        
        }

        // Set some default styles
        if (!styles || !Object.prototype.hasOwnProperty.call(styles, 'position')) { elem.style.position = 'absolute'; }
        if (!styles || !Object.prototype.hasOwnProperty.call(styles, 'margin'))   { elem.style.margin = '0px'; }
        if (!styles || !Object.prototype.hasOwnProperty.call(styles, 'padding'))  { elem.style.padding = '0px'; }

        return elem;
    };


    /** 
     * Resizes a given canvas's raster to match its display size.
     *
     */
    static RightsizeCanvas(canv)
    {
        const clientWidth = Math.round(canv.clientWidth);
        const clientHeight = Math.round(canv.clientHeight);
        if ( (clientWidth < 1) || (clientHeight < 1) ) { return false; }

        const dpr = window.devicePixelRatio || 1;
        const requiredCanvasWidth = Math.round(dpr * clientWidth);
        const requiredCanvasHeight = Math.round(dpr * clientHeight);

        if ( (canv.width != requiredCanvasWidth) || 
            (canv.height != requiredCanvasHeight) ) { 
                canv.width = requiredCanvasWidth;  
                canv.height = requiredCanvasHeight;
                canv.setAttribute('width', requiredCanvasWidth.toString() + 'px'); 
                canv.setAttribute('height', requiredCanvasHeight.toString() + 'px'); 
        } 
        return true;
    };  

}