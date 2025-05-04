/**
 * @classdesc
 * A really basic logging utility.  
 * 
 */
class Logger
{
    /**
     * @constructor
     * 
     */
    constructor() { }
  
  
    /**
     * Reports an informational message.
     */
    static info(msg)
    {
        if (msg && (msg.length > Logger.maxMsgLength)) {
            msg = msg.substring(0, Logger.maxMsgLength) + "...";
        }
        
        console.info(msg);
        if (Logger.popupErrorsFlag) { alert(msg); }
    }       
    

    /**
     * Reports a warning message.
     */
    static warn(msg)
    {
        if (msg && (msg.length > Logger.maxMsgLength)) {
            msg = msg.substring(0, Logger.maxMsgLength) + "...";
        }

        console.warn(msg);
        if (Logger.popupWarningsFlag) { alert(msg); }
    }    
    
       
    /**
     * Reports an error message.
     */
    static error(msg)
    {
        if (msg && (msg.length > Logger.maxMsgLength)) {
            msg = msg.substring(0, Logger.maxMsgLength) + "...";
        }

        console.error(msg);
        if (Logger.popupInfoFlag) { alert(msg); }
    }
    
    
    /**
     * Sets whether to display error messages in a pop-up.
     */    
    static popupErrors(val) {
        Logger.popupErrorsFlag = val;
    }


    /**
     * Sets whether to display warning messages in a pop-up.
     */
    static popupWarnings(val) {
        Logger.popupWarningsFlag = val;
    }


    /**
     * Sets whether to display info messages in a pop-up.
     */    
    static popupInfoMessages(val) {
        Logger.popupInfoFlag = val;
    }
}

Logger.popupErrorsFlag = false;
Logger.popupWarningsFlag = false;
Logger.popupInfoFlag = false;
Logger.maxMsgLength = 512;