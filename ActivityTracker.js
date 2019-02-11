const ioHook = require('iohook');
const monitor = require('./active-window');
const request = require('request');
const config = require('./config');
const browserHistory = require('./browserHistory');


module.exports = class ActivityTracker {
    constructor(userId) {
        this.activeWindowList = [];
        
        this.lastAwinObj = {};
        this.lastAwinObj.title = '';
        this.lastAwinObj.app = '';

        this.idleFrameStartTime = this.getDateTime(new Date);
        this.totalSeconds = 0;
        this._usreId = userId;
        this.startIdleTime = false;
        // If user idle more than 3 min, then calculate idle time 
        this.maxIdleTime = 180;
        setInterval( () => this.setTime(), 1000);
    }

    setTime() {
        ++this.totalSeconds;
        //console.log('maxIdleTime: '+ this.maxIdleTime);
        //console.log('totalSeconds: '+ this.totalSeconds);

        if (this.totalSeconds > this.maxIdleTime && !this.startIdleTime) {
            this.eventHandler();
        }
    }

    isBrowser(appName) {
        return appName === "Google Chrome" || appName === "firefox" || appName === "opera" || appName === "torch" || appName === "Safari" || appName === "seamonkey" || appName === "vivaldi" || appName === "maxthon" || appName === "";
    }

    getLatestURLS(browserName) {
        if (browserName === "Google Chrome") {
            console.log("Chrome tab clicked");
            return browserHistory.getChromeHistory(10);
        } else if (browserName === "firefox") {
            return browserHistory.getFirefoxHistory(10);
        } else if (browserName === "torch") {
            return browserHistory.getTorchHistory(10);
        } else if (browserName === "Safari") {
            console.log("Safari tab clicked");
            return browserHistory.getSafariHistory(10);
        } else if (browserName === "seamonkey") {
            return browserHistory.getSeaMonkeyHistory(10);
        } else if (browserName === "vivaldi") {
            return browserHistory.getVivaldiHistory(10);
        } else if (browserName === "opera") {
            return browserHistory.getOperaHistory(10);
        }

    }

    matchURL(urls, title, hasDoubleByte) {
        console.log(title);
        console.log(title.includes("\\u"));
        if (hasDoubleByte) {
            for (const url of urls) {
                //console.log(url.title);
                if (
                    (url.title.startsWith(title) && url.title !== '') 
                    || 
                    (url.title === '' && title === '')
                    ) {
                    console.log("*****************************");
                    console.log("URL matched!!!");
                    console.log("*****************************");
                    console.log("Title: " + url.title);
                    console.log("URL: " + url.url);
                    return url.url;
                }
            }
        } else if (title.includes("\\u")) {
            // console.log('title: ' + title.split("\\")[0]);
            for (const url of urls) {
                //console.log(url.title);
                if ((url.title.startsWith(title.split("\\")[0]) && url.title !== '') || (url.title === '' && title === '')) {
                    console.log("*****************************");
                    console.log("URL matched!!!");
                    console.log("*****************************");
                    console.log("Title: " + url.title);
                    console.log("URL: " + url.url);
                    return url.url;
                }
            }
        } else {
            for (const url of urls) {
               // console.log(url);
                if ((title.startsWith(url.title) && url.title !== '') || (url.title === '' && title === '')) {
                    console.log("*****************************");
                    console.log("URL matched!!!");
                    console.log("*****************************");
                    console.log("Full Title: " + title);
                    console.log("Title: " + url.title);
                    console.log("URL: " + url.url);
                    return url.url;
                }
            }
        }
        console.log("*****************************");
        console.log("URL not found");
        console.log("*****************************");
        return "";
    }

    doubleByteCheck(str) {
        for (var i = 0, n = str.length; i < n; i++) {
            if (str.charCodeAt(i) > 255) {
                return {
                    hasDoubleByte: true,
                    pos: i
                };
            }
        }
        return {
            hasDoubleByte: false
        };
    }

    end(){
        if (ioHook){
            ioHook.stop();
        }
        if (monitor){
            monitor.end();
        }
    }

    resetIdleTimer() {
        this.idleFrameStartTime = this.getDateTime(new Date);
        this.totalSeconds = 0;
    }

    eventHandler(event){
        //console.log('in eventHandler:')
        if (this.totalSeconds > this.maxIdleTime && !this.startIdleTime) {
            this.closeLastActiveWindow(new Date);
            this.startIdleTime = true;
            this.totalSeconds = 0;
        } else if( this.startIdleTime ){ 
            this.resetIdleTimer();
            this.createNewActiveWindow( this.lastAwinObj  , new Date );
            this.startIdleTime = false;
        }
        else {
            //console.log('in else:');
            this.resetIdleTimer();
        }
    }


    callApi(appdata) {
        var userActivity = {};
        userActivity.appData = appdata;
        userActivity.idleTime = [];
        userActivity.userId = this._usreId;
        if (process.platform === "darwin") {
            // eliminate "application process" prefix from active window name
            userActivity.appData.app = userActivity.appData.app.split(" ")[2]; 
        }
        console.log("APp name:");
        console.log(userActivity.appData.app);
        
        // userActivity.date = this.getDateTime(new Date(),'dateonly');
        if (this.isBrowser(userActivity.appData.app)) {
            //console.log(userActivity.appData);
            //console.log(userActivity.appData.title);

            // solve unicode issue
            let jsonStr = JSON.stringify(userActivity.appData).split('"')[7];
            let doubleByteCheck = this.doubleByteCheck(userActivity.appData.title);
            if (doubleByteCheck.hasDoubleByte) {
                userActivity.appData.title = userActivity.appData.title.slice(0, doubleByteCheck.pos);
            } else if (jsonStr.includes("\\u")) {
                userActivity.appData.title = jsonStr;
            }

            const matchingURL = this.matchURL(
                this.getLatestURLS(userActivity.appData.app),
                userActivity.appData.title,
                doubleByteCheck.hasDoubleByte);
            if (matchingURL !== "") {

                userActivity.appData.app = matchingURL;
            }
        }



        var reqBody = this.enctypt(JSON.stringify(userActivity));
        (function post(attempt) {
            console.log('Api called ... ');
            // console.dir(userActivity);

            request({
                url: config.dataDumpUrl,
                method: "POST",
                json: true,   // <--Very important!!!
                body: reqBody
            }, function (error, response, body) {                    
                    if (error) {
                    // so error happened
                    // for now, we will retry in every 30 seconds for 30 minutes
                    console.error('error posting activity data. attempt: ' + attempt, error);
                    if (attempt < 60) {
                        setTimeout(function () {
                            post(++attempt);
                        }, 30 * 1000);
                    } else {
                        console.error('max retry attempt exceeded for activity data. attempt: ' + attempt, reqBody);
                    }
                }
            });
        })(0);
    }

    twoDigit(i) {
        return ( +i < 10 ) ?  "0" + i : i;
    }

    getDateTime(today, type = null) {
        let date = today.getFullYear()  + '-' +  this.twoDigit( today.getMonth() + 1 ) + '-' + this.twoDigit( today.getDate() );
        return type == 'dateonly' ? date : today.getTime();
    }

    createNewActiveWindow(awin,today){
        awin.start = this.getDateTime(today);
        awin.end = this.getDateTime(today);
        this.activeWindowList.push(awin);
    }

    closeLastActiveWindow(today){
        // As previous window finished 1 sec before, so 2nd param is 1
        // previous -1 logic is removed
        this.activeWindowList[this.activeWindowList.length - 1].end = this.getDateTime(today);  
        this.activeWindowList[this.activeWindowList.length - 1].app; 
        this.callApi(this.activeWindowList.pop());   
        this.activeWindowList = [];
    }

    callback(awin) {
        try {
            awin.app = awin.name || awin.app;
            if (this.lastAwinObj.title !== awin.title && !this.startIdleTime) {

                var today = new Date();
                if (this.activeWindowList.length > 0) {
                    this.closeLastActiveWindow(today);
                }
                this.createNewActiveWindow(awin,today);
                // console.dir( JSON.stringify( activeWindowList ) );
            }

            this.lastAwinObj = awin;
        } catch (err) {
            console.log(err);
        }
    }

    start() {

        ioHook.start();
        ioHook.on('mouseclick', event => this.eventHandler(event));
        ioHook.on('keypress', event => this.eventHandler(event));
        ioHook.on('mousewheel', event => this.eventHandler(event));
        ioHook.on('mousemove', event => this.eventHandler(event));

        monitor.getActiveWindow(event => this.callback(event), -1, 1);
    }

    enctypt(text) {
        var crypto = require('crypto');
        var key = '00000000000000000000000000000000'; //replace with your key
        var iv = '0000000000000000'; //replace with your IV
        var cipher = crypto.createCipheriv('aes256', key, iv)
        var crypted = cipher.update(text, 'utf8', 'base64')
        crypted += cipher.final('base64');
        return crypted;
    }
}

