// Create a Datadrive/OCS subscription session by:
//
// 1) Using OCS Client, get the packageId associated with the
//    packageName argument passed to us.
//
// 2) Using WebSockets, connect to DataDrive middleware layer for
//    notifications on newly indexed objects for the packageId.
//
// 3) Using OCS Client, respond to each WS event by querying OCS
//    for that file's details, including a downloadable URL.
//
// 4) Use that download URL to perform the actual download
//    of the file to this system, into the outputDir.
//
//
// Arguments:  --packageName packagenameWeSubscribeTo          [Required]
//             --outputDir   directoryToWhichFilesWillBeSaved  [Required]
//             --filter      wildcard-glob-expression          [Optional]
//             --retainPath                                    [Optional]
//

//Node library imports


const fs = require('fs');
//const argv         = require('argv-parse');
const util = require('util');
const moment = require('moment');
const {FileMetadata} = require('./core/DdFileMetadata.js');

//local imports
const DdConsts = require('./core/DdConstants.js');
const DdUtils = require('./core/DdUtils.js');
const {DataDriveWsClient} = require('./core/DdWsClient.js');
const DdSubConfig = require('./core/DdSubConfig.js');
const DdOptions = require('./core/DdOptions.js');
const DdLogger = require('./core/DdLogger.js').logger;
const {DataDriveMWServiceSettings} = require('./core/DataDriveMWServiceSettings')
const {Processor, Queue} = require('./core/DdQueue.js');
const {QueueEmptyError, MaxProcessSizeError, CannotWriteToLocalFileError} = require('./core/DdError.js');
const DdPluginHandler = require('./core/DdPluginHandler.js').PluginHandler;
const {EmptyPromise} = require('./core/EmptyPromise')

const CSSO_RELOAD_ATTEMPT_INTERVAL_MS = 1000  // 1s
//------------------------------------------------

class DataDriveSubscriber {
    static builder() {
        return new DataDriveSubscriber()
    }
    constructor() {
        this.__playbackQueue = new Queue()  // queue for playback events
        this.__wsQueue = new Queue()  // queue for websocket events
        this.__playbackProcessor = new Processor(this.__playbackQueue)  // processor class processing playback events
        this.__wsProcessor = new Processor(this.__wsQueue)  // processor class processing ws events
        this.__wsProcessorLocked = true  // lock to prevent wsProcessor from downloading until "initEventPlayback" function has finished
        this.__notifySubscriptionStart = true

        DdOptions.parseSubscriptionOptions(process.argv)  // parse command line arguments
        this.__subscriptionConfig = new DdSubConfig(DdOptions.program)  // load initial config/env
        this.__wsClient = null  // initialize web socket to null first before initiate() method creates the object
        this.__pluginHandler = new DdPluginHandler(this.__subscriptionConfig)  // used for plugins
        if (! this.__subscriptionConfig.isConfigured()) {
            DdLogger.error('Configuration unsuccessful.  Aborting.');
            DdOptions.exit(1); // exit the application when configuration is unsuccessful
        }
        if (!DdUtils.fsChecks(this.__subscriptionConfig.outputDir)) {
            DdUtils.errorAndExit(Error('Directory specified does not exist.'));
        }
    }

    /**
     * Using file metadata object and configuration, constructs the final
     * output path for the associated file, and checks if file exists
     * @param fileMetadata
     * @returns {boolean}
     */

    __fileExistsViaMetadata(fileMetadata)
    {
        let outFilepath  = this.__subscriptionConfig.getOutputLocationViaMetadata(fileMetadata);
        if (outFilepath == null)
            return false;

        return DdUtils.fileExists(outFilepath);
    }

    // Gets events from the queue, download, decrement processor count, check if folder exist, lastly update checkpoint file with date of last downloaded item
    async processItems() {
        /**
         * @type {FileMetadata} filemetadata
         */
        let fileMetadata = null;
        let processor;
        if (this.__playbackProcessor.queue.isEmpty() && !this.__wsProcessorLocked) {
            processor = this.__wsProcessor;
        }
        else {
            processor = this.__playbackProcessor;
        }

        if (this.__notifySubscriptionStart) {
            if (this.__playbackProcessor.queue.isEmpty() && !this.__wsProcessorLocked) {
                if (this.__subscriptionConfig.playback) {  // don't show playback finished message if playback option was not enabled
                    DdLogger.info('Playback has finished.');
                }
                DdLogger.info('Listening for subscriptions...')
                this.__notifySubscriptionStart = false;
            }
        }

        try {
            let node = await processor.process();
            let event = node.value.event;
            let event_type = node.value.event_type;
            let changed_flag = node.value.file_changed;
            DdLogger.debug("Decrementing processor size.");
            processor.size -= 1;  // this is to ensure that only 1 item is processed at a time by the processor
            DdLogger.debug("Increment remaining count size.");

            DdLogger.debug("Called getOcsFileMetadata");

            let url = this.__subscriptionConfig.getOcsUtils().getPermalinkviaPEP(this.__subscriptionConfig.getPepUrl(), event.ocs_url);
            DdLogger.info(`Download URL: ${url}`);
            event['ocs_download_url'] = url;
            fileMetadata = new FileMetadata();
            if (event_type === DdConsts.EVENTTYPE_OCS) {
                fileMetadata.unmarshallOCS(event);
            } else {
                fileMetadata.unmarshallPlayback(event);
            }

            //check if options indicate we should skip file if its not considered changed (i.e. OCS metadata update only)
            let skip_file = false;
            if (this.__subscriptionConfig.skipUnchanged && !changed_flag && this.__fileExistsViaMetadata(fileMetadata)) {
                let ocs_name = fileMetadata.getOcsName()
                DdLogger.info(`Skipping event for existing file that did not change: ${ocs_name}"`);
                skip_file = true;
            }

            //Invoke plugin handlers only if file is not skipped
            if (!skip_file) {
                DdLogger.debug('Invoke "processItem" function for every plugin in the plugin/ folder');
                // This includes the file download plugin
                await this.__pluginHandler.callProcessItem(fileMetadata);
            }

            //--------------

            //Still need to update cache/tracking files if file is downloaded or not

            DdLogger.debug("Attempting to create directory.")
            const mkdirPromise = EmptyPromise.builder()
            fs.mkdir(`${this.__subscriptionConfig.outputDir}/.datadrive`, {recursive: true}, err => {
                if (err) {
                    mkdirPromise.reject(err)
                    return
                }
                mkdirPromise.resolve({})
            })
            await mkdirPromise.get()
            // write date of file updated to checkpoint file
            await DdUtils.writeDateToFile(this.__subscriptionConfig.checkpointPath, fileMetadata.getOcsUpdatedAt());

            // check if packageName specified and if package name state file does not exist and write package name to it
            if (this.__subscriptionConfig.packageName && !fs.existsSync(this.__subscriptionConfig.savedPackageNamePath)) {
                await DdUtils.writePackageNameToFile(this.__subscriptionConfig.savedPackageNamePath, this.__subscriptionConfig.packageName);
                DdLogger.debug(`${this.__subscriptionConfig.savedPackageNamePath} has been written.`);
            }
            if (this.__subscriptionConfig.savedSearchName && !fs.existsSync(this.__subscriptionConfig.savedSavedSearchNamePath)) {
                await DdUtils.writePackageNameToFile(this.__subscriptionConfig.savedSavedSearchNamePath, this.__subscriptionConfig.savedSearchName);
                DdLogger.debug(`${this.__subscriptionConfig.savedSavedSearchNamePath} has been written.`);
            }

            //--------------
        }
        catch (err) {
            if (err instanceof CannotWriteToLocalFileError) {
                DdLogger.warn(err.message);
            }
            else if (!(err instanceof QueueEmptyError) && !(err instanceof MaxProcessSizeError)) {
                DdLogger.error(err.message);
                DdLogger.debug(err.stack);
            }
            else {
                DdLogger.debug(err.message);
            }
            processor.size -= 1;
        }
    }

    /**
     * To handle an OCS event that is received via web socket connection to the middleware
     * @param {Object} wsOcsObject
     * @param {string} wsOcsObject.package_id
     * @param {string} wsOcsObject.dataset_id
     * @param {string} wsOcsObject.ocs_full_name
     * @param {string} wsOcsObject.ocs_url
     * @param {string} wsOcsObject.package_dataset_event
     * @param {number} wsOcsObject.package_dataset_event_time
     * @param {string} wsOcsObject.s3_object_changed ('true' or 'false')
     */
    handleWsOcsEvent(wsOcsObject) {
        let pkgId = wsOcsObject.package_id;
        let datasetId = wsOcsObject.dataset_id;
        let eventType = wsOcsObject.package_dataset_event;
        let ocs_url = wsOcsObject.ocs_url;
        let ocs_full_name = wsOcsObject.ocs_full_name;
        let ocs_updated_at = moment(wsOcsObject.package_dataset_event_time).toDate();
        let file_changed = wsOcsObject.hasOwnProperty('s3_object_changed') ? DdUtils.isValueTrue(wsOcsObject.s3_object_changed) : true;

        DdLogger.debug(`Event[${eventType}] Dataset: ${datasetId}; Package: ${pkgId}; Name: ${ocs_full_name}; URL: ${ocs_url}.; Changed: ${file_changed}`);

        if (DdUtils.isEmptyOrNullString(pkgId)       ||
            DdUtils.isEmptyOrNullString(datasetId)   ||
            DdUtils.isEmptyOrNullString(eventType)   ||
            DdUtils.isEmptyOrNullString(ocs_url)     ||
            DdUtils.isEmptyOrNullString(ocs_full_name)) {
            DdLogger.error("Message was missing required attributes.");
            DdLogger.debug(`${JSON.stringify(wsOcsObject)}`);
            //console.error("Message was missing required attributes: "+wsMessage);
            return;
        }

        // Determine if this is a package event type or saved search event type
        if (this.__subscriptionConfig.packageName) {
            //make sure event matches our expected package
            if (pkgId !== this.__subscriptionConfig.packageId) {
                return
            }
            //If the event is for a file that does not pass filter, reject it
            if (! this.__subscriptionConfig.satisfiesFilter(ocs_full_name)) {
                let rejectMSg = `File was rejected because it did not satisfy the filter: ${this.__subscriptionConfig.fileWildcard} or ${this.__subscriptionConfig.fileRegex}`;
                DdLogger.debug(`${ocs_full_name} ${rejectMSg}`)
                return
            }
            this.__wsQueue.enqueue(datasetId, {"name": ocs_full_name, "date": ocs_updated_at, "event": wsOcsObject,
                "event_type": DdConsts.EVENTTYPE_OCS, "file_changed": file_changed})
            return
        }
        if (this.__subscriptionConfig.savedSearchName) {
            // not if saved search name is specified and is a valid saved search message
            if (DdUtils.isValidDDSavedSearchMessage(wsOcsObject) === false) {
                DdLogger.debug(`Message is not a saved search message: ${JSON.stringify(wsOcsObject)}.`)
                return
            }
            this.__wsQueue.enqueue(datasetId, {"name": ocs_full_name, "date": ocs_updated_at, "event": wsOcsObject,
                "event_type": DdConsts.EVENTTYPE_OCS, "file_changed": file_changed})
            return
        }
        DdLogger.debug(`Package Name or Saved Search Name was not specified, so we are ignore this message as we don't know what to do with it.`);
    }

    __createWsClient() {
        const wsHost = this.__subscriptionConfig.getDataDriveHost().replace('https', 'wss');

        let wsConfig = {
            wsHost:      wsHost,
            cssoToken:   this.__subscriptionConfig.getCssoToken(),
            packageName: this.__subscriptionConfig.packageName,
            packageId:   this.__subscriptionConfig.packageId,
            savedSearchName: this.__subscriptionConfig.savedSearchName,
            savedSearchOwner: this.__subscriptionConfig.getUserNameFromCssoToken()
        };
        const instance = this
        let wsClient = DataDriveWsClient.builder(wsConfig)
        wsClient.setMessageCallback(msg => instance.handleWsOcsEvent(msg))
        wsClient.setErrorCallback(errMsg => DdLogger.printError(errMsg))
        wsClient.setFinalConnectionClosedCallback(() => DdOptions.exit(1))
        return wsClient;
    }

    async __initEventPlayback() {
        if (this.__subscriptionConfig.playback === false) {
            this.__wsProcessorLocked = false;
            return
        }
        let filePath = `${this.__subscriptionConfig.outputDir}/.datadrive/checkpoint.txt`;
        try {
            const checkPointData = await DdUtils.getCheckPointDate(filePath)
            let startDate = new Date(checkPointData.toString().trim());
            if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
                throw new TypeError('Bad start date.');
            }
            let startTime = startDate.getTime();
            let endTime = Date.now();
            const playBackEventData = await DdUtils.getPlaybackEvents(startTime, endTime, this.__subscriptionConfig);
            let events = playBackEventData
            DdLogger.debug(JSON.stringify(events))
            events.sort(DdUtils.playbackEventsComparator)
            DdLogger.info(`Playback started.`)
            DdLogger.info(`${events.length} playback events found since last checkpoint date.`)

            DdLogger.debug(`Events data... ${util.inspect(events, {depth: null})}`)
            for (let event of events) {
                DdLogger.debug(event);
                this.__playbackQueue.enqueue(event.ocs_dataset_id, {"name": event.ocs_full_name, "date": event.ocs_updated_at,
                    "event": event, "event_type": DdConsts.EVENTTYPE_PLAYBACK,
                    "file_changed": true});  // Assume all playback files are changed-files
            }
        } catch (e) {
            DdLogger.error(e.message);
            DdLogger.debug(e.stack);
            DdLogger.error('Failed to initialize event playback.')
        }
        this.__wsProcessorLocked = false;
    }

    async proceedWithSubscriptionAndProcessLoop() {
        // final check if configs are valid before starting playback and subscriptions
        await this.__subscriptionConfig.validateConfigs();
        await this.__initEventPlayback()
        //now we can create a web-socket client and run it
        this.__wsClient = this.__createWsClient()
        this.__wsClient.startSession()
        const instance = this
        setInterval(async () => {
            let reloaded = instance.__subscriptionConfig.reloadIfSSOTokenAboutToExpire();
            if (reloaded) {
                instance.__wsClient.close()
                instance.__wsClient = instance.__createWsClient()
                instance.__wsClient.startSession()
            }
            await this.processItems()

        }, CSSO_RELOAD_ATTEMPT_INTERVAL_MS)
    }

    async prepareSubscription(ocsHost, ocsStage) {
        this.__subscriptionConfig.setOcsSettings(ocsHost, ocsStage);
        this.__subscriptionConfig.initiate_OcsClient();
        if (this.__subscriptionConfig.packageName) {
            try {
                const pkgDetails = await this.__subscriptionConfig.getOcsUtils().translatePackageNameToId(this.__subscriptionConfig.packageName)
                if (pkgDetails['packageId'] === null) {
                    DdUtils.errorAndExit(`cannot find packageId for ${this.__subscriptionConfig.packageName}`)
                }
                this.__subscriptionConfig.packageId = pkgDetails['packageId']
                await this.proceedWithSubscriptionAndProcessLoop()
            } catch (err) {
                DdUtils.errorAndExit(err)
            }
        }
        else if (this.__subscriptionConfig.savedSearchName) {
            // TODO need to get `owner` of generalized saved search
            let response = await DdUtils.getSavedSearch(this.__subscriptionConfig.savedSearchType, this.__subscriptionConfig.savedSearchName, null, this.__subscriptionConfig)
            if (DdUtils.validHTTPResponse(response) === false) {
                DdUtils.errorAndExit('Saved search specified does not exist.');
            }
            await this.proceedWithSubscriptionAndProcessLoop()
        }
        else {
            DdUtils.errorAndExit("Package Name or saved search was not provided or incorrect.")
        }
    }

    async init() {
        const mwSetting = DataDriveMWServiceSettings.builder(this.__subscriptionConfig.getDataDriveHost(), this.__subscriptionConfig.getCssoToken())
        await mwSetting.loadSettings()
        await this.prepareSubscription(mwSetting.getOcsEndpointHost(), mwSetting.getOcsApiStage())
    }
}


DataDriveSubscriber.builder().init()
    .then(_ => {})
    .catch(err => {
        DdUtils.errorAndExit(`Error occurred while subscribing. ${err.toString()}`)
    })
