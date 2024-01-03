//TPS imports
const WebSocket = require('ws');
// const request = require('request');
// const Validator = require('jsonschema').Validator;
// const UrlLib = require('url');
// const HttpLib = require('http');
// const PathLib = require('path');

//Local imports
const DdUtils = require('./DdUtils.js');
const DdLogger = require('./DdLogger.js').logger;
const {jsonTryParse} = require('./utils')
const WebsocketException = require('./exceptions/WebsocketException')

const MAX_FAILED_ATTEMPTS = 3  //max number of failed to connect attempts before quitting
const REATTEMPT_WAIT_MS = 10000  //time to wait before attempting reconnection
const CHECK_IS_ALIVE_INTERVAL_MS = 2000

class DataDriveWsClient {
    static builder(config) {
        return new DataDriveWsClient(config)
    }
    constructor(config) {
        this._wsHost = null;
        this._cssoToken = null;
        this._packageId = null;
        this._packageName = null;

        this.__eventMsgHandler = _ => {}
        this.__errMsgHandler = _ => {}
        this.__finalConnectionClosedHandler = _ => {};

        this._isActive = true;
        this._wsClient = null;
        this.useReconn = true;

        this._connOpenTime = null;
        this._connCloseTime = null;
        this._isAlive = true

        this._sequentialClosedEvents = 0;
        this.updateConfig(config);
        DdLogger.debug(`Connecting to web socket with ${JSON.stringify(config)}.`)
    }

    updateConfig(newConfig) {  // TODO validation
        this._wsHost = newConfig.wsHost;
        this._cssoToken = newConfig.cssoToken;
        this._packageId = newConfig.packageId;
        this._packageName = newConfig.packageName;
        this._savedSearchName = newConfig.savedSearchName;
        this._savedSearchOwner = newConfig.savedSearchOwner;
    }

    setMessageCallback(handler) {
        this.__eventMsgHandler = handler
        return this
    }
    setErrorCallback(handler) {
        this.__errMsgHandler = handler
        return this
    }
    setFinalConnectionClosedCallback(handler) {
        this.__finalConnectionClosedHandler = handler
    }

    isActive() {
        return this._isActive
    }

    close() {
        this.useReconn = false;
        this._wsClient.close();
    }

    handleWsMessage(wsMessage) {
        if (DdUtils.isEmptyOrNullString(wsMessage)) {
            DdLogger.error("WS::HandleMessage: empty mesg");
            return
        }
        let wsJsonMsg = jsonTryParse(wsMessage)
        if (wsJsonMsg['error'] !== undefined) {
            DdLogger.error(`WS::HandleMessage: non json message: ${wsMessage}`);
            return
        }
        wsJsonMsg = wsJsonMsg['result']
        DdLogger.debug(`WS::HandleMessage: Message receieved: ${JSON.stringify(wsJsonMsg)}`);
        // handle datadrive upload status message, which for right now we want to ignore
        if (DdUtils.isValidDDUploadMessage(wsJsonMsg)) {
            // We want to ignore DataDrive Upload Messages because they aren't useful to the DataDrive CLI
            // As such, we will print it to debug in case we ever need to read it.
            DdLogger.debug(`WS::HandleMessage: Receieved DataDrive Upload Message: ${JSON.stringify(wsJsonMsg)}`);
            return;
        }
        //handle formatted error message from WS host
        if (DdUtils.isErrorOcsMessage(wsJsonMsg)) {
            DdLogger.error(`WS::HandleMessage: Received error message from WS host: ${JSON.stringify(wsJsonMsg)}`);
            this.__errMsgHandler(wsJsonMsg)
            return;
        }

        //check if we actually received a valid file message that is either OCS message or one that builds on top of an OCS message (ie. Saved Search Message)
        let ocsValidResult = DdUtils.isValidOcsMessage(wsJsonMsg);
        if (ocsValidResult !== true) {
            DdLogger.error("WS::HandleMessage: Could not validate WS-based OCS message: " + wsMessage);
            DdLogger.error("WS::HandleMessage: More info: " + ocsValidResult);
            return;
        }
        this.__eventMsgHandler(wsJsonMsg)
    }

    __onOpen() {
        this._connOpenTime = DdUtils.getCurrentTimeMillis();
        this._connCloseTime = null;
        this._isActive = true;
        this._isAlive = true
        this._sequentialClosedEvents = 0;  //since we have an open event, zero out close event count
        DdLogger.info('Connected to DataDrive WS service ');
        // Silence upload status events as we don't care about them and will want to ignore them.
        this._wsClient.send(JSON.stringify({send_upload_status_msg: false}))

        //send websocket the packageId in which we are interested
        if (this._packageId) {
            DdLogger.debug("Requesting OCS events from package '" + this._packageName + "' (" + this._packageId + ")...");
            this._wsClient.send(JSON.stringify({
                client_type: 'dd_cli',
                all_pkg: false,
                pkg: [this._packageId],
            }));
        } else if (this._savedSearchName) {
            DdLogger.debug("Requesting Saved Search events '" + this._savedSearchName + "' ...");
            this._wsClient.send(JSON.stringify({
                client_type: "NA",
                all_pkg: false,
                pkg: ["invalidId"]}))  // this disables package level events
            let payload = {
                'interested_saved_searches': [
                    {
                        type: 'personal',
                        owner: this._savedSearchOwner,
                        name: this._savedSearchName
                    }
                ]
            };
            this._wsClient.send(JSON.stringify(payload));
        } else {
            DdUtils.errorAndExit("Error during web socket open. Package Name was not provided or incorrect, or saved search name was not provided.")
        }
    }

    __onClose(event) {
        this._connCloseTime = DdUtils.getCurrentTimeMillis();
        let connTimeInfo = "";
        if (!(this._connCloseTime === null || this._connOpenTime === null)) {
            let connTime = this._connCloseTime - this._connOpenTime;
            connTimeInfo = "(alive for " + (connTime / 1000) + " seconds)";
        }

        DdLogger.info("Disconnected from websocket " + connTimeInfo + "");
        DdLogger.info("WS.close(): " + JSON.stringify(event));

        this._isActive = false;
        this._sequentialClosedEvents = this._sequentialClosedEvents + 1;

        if (this.useReconn) {
            if (this._sequentialClosedEvents >= MAX_FAILED_ATTEMPTS) {
                DdLogger.error("WS.close(): Maximum connection attempts have failed.  Giving up.");
                //console.log("WS.close(): Maximum connection attempts have failed.  Giving up.");
                this.__finalConnectionClosedHandler();
                return;
            }
            let reconnTime = REATTEMPT_WAIT_MS * this._sequentialClosedEvents;
            DdLogger.info("WS.close(): We are going to try reconnecting shortly...");
            const instance = this
            //console.log("WS.close(): We are going to try reconnecting shortly...");
            setTimeout(() => instance.buildWebSocketClient(), reconnTime);
        }
    }

    __onError(errMessage) {
        let now = DdUtils.getCurrentTimeMillis();
        DdLogger.error("Error happened with websocket [" + now + "] : " + JSON.stringify(errMessage));
        this.__errMsgHandler(errMessage)
    }

    __onMessage(message) {
        try {
            this.handleWsMessage(message)
        } catch (error) {
            DdLogger.printError(error);
            DdLogger.error("Error occurred while handling WS message: " + JSON.stringify(message));
        }
    }

    __checkSocketStatus() {
        if (this._isAlive === false) {
            DdLogger.error('closing socket coz isAlive is false. This is a temporary workaround')
            throw new WebsocketException('closing socket coz isAlive is false')
        }
        this._isAlive = false
        this._wsClient.ping(() => {})
    }

    startSession() {
        this.buildWebSocketClient()
        return this
    }

    buildWebSocketClient() {
        const instance = this
        const wsOptions = {
            // rejectUnauthorized: false,  // enable this when testing it locally where https is using self-signed certs
            headers: {
                Cookie: `ssosession=${this._cssoToken}`
            }
        };

        DdLogger.debug("Connecting to " + this._wsHost + "...\n");
        //console.log("Connecting to "+this._wsHost+"...\n");
        this._wsClient = new WebSocket(this._wsHost, [], wsOptions);
        this._wsClient.on('pong', () => instance._isAlive = true) // result of ping. if it responds, it's still alive
        this._wsClient.on('open', () => instance.__onOpen())
        this._wsClient.on('close', event => instance.__onClose(event))
        this._wsClient.on('error', errEvent => instance.__onError(errEvent))
        this._wsClient.on('message', message => instance.__onMessage(message))
        setInterval(() => instance.__checkSocketStatus(), CHECK_IS_ALIVE_INTERVAL_MS)
    }
}
exports.DataDriveWsClient = DataDriveWsClient
