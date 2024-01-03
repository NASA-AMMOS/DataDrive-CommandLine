// Create a Datadrive/OCS publish session session by:
//
// 1) Using OCS Client, get the packageId associated with the
//    packageName argument passed to us.
//
// 2) Using filesystem sniffer, respond to each new file event by
//    pushing file to the Datadrive middleware, awaiting for metadata
//    response or error
//
// 3) If Metadata extracted, ptoceed with file upload to Datadrive
//    middleware.  If error, abort upload.
//
//
//
// Arguments:  --packageName packagenameWePublishTo               [Required]
//             --sourceDir   directoryFromWhichFilesWillBePushed  [Required]
//             --filter      wildcard-glob expression             [Optional]
//             --destRoot    S3-path-prefix                       [Optional]
//             --retainPath                                       [Optional]
//             --overwrite                                        [Optional]
//             What about this one:
//             --subdirs                                          [Optional]
//

//Node library imports

const fs           = require('fs');
const os           = require('os');
const path         = require('path');
const request      = require('request');
const cookie       = require('cookie');
const globToRegExp = require('glob-to-regexp');




//OCS library  (only need it to translate from packageName to packageId)
const OCS = require('@gov.nasa.jpl.m2020.cs3/ocs-js-client');

//local imports
const DdConsts       = require('./core/DdConstants.js');
const DdUtils        = require('./core/DdUtils.js');
const OcsUtils       = require('./core/OcsUtils.js');
const PubConfig      = require('./core/DdPubConfig.js');
const DdListener     = require('./core/DdDirectoryListener.js');
const DdUploader     = require('./core/DdUploader.js');
const DdOptions      = require('./core/DdOptions.js');
const DdLogger       = require('./core/DdLogger.js').logger;
const {DataDriveMWServiceSettings} = require('./core/DataDriveMWServiceSettings')

//--------------------------

//This is needed to be able to debug using self-signed certs
//remove for production tho!
//process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

//--------------------------

DdOptions.version('\n*** '+DdConsts.CLIENT_TITLE+' ***\n\n');
DdOptions.option('-p, --package-name <package name>', 'The name of the package.');
DdOptions.option('-s, --source-dir   <source dir>',   'The source directory.');
DdOptions.option('-d, --dest-prefix  [s3-prefix]',    'Prefix path to be prepended to S3 location', '');
DdOptions.option('-f, --filter  [value]',             'A wildcard expression to filter files', '*');
DdOptions.option('-r, --retain-path',                 'Use the relative path when creating S3 location of file');
DdOptions.option('-o --overwrite',                    'Allows existing files to be overwritten on the server');
DdOptions.parse(process.argv);

//-------------------------

function handleSuccessfulUpload(filepath) {
    DdLogger.info("File uploaded: "+filepath);
}

//---------------------------------------------------------------------




//---------------------------------------------------------------------

function upload_Callback(filepath, err, response, body)  {

    if (err !== null) { // has error
        let extractedErrMsg = pubConfig.ddUploader.extractErrorMessage(err);
        DdLogger.error(`Error uploading '${filepath}': ${extractedErrMsg}`);
        return;
    }

    let statusCode = response.statusCode;

    if (statusCode >= 500)
    {
        DdLogger.error(`Error uploading '${filepath}'.  Received server error code (`+statusCode+")");
        if (response.data !== undefined)
            DdLogger.printError(response.data);
        return;
    }
    else if (statusCode >= 400)
    {
        DdLogger.error(`Error uploading '${filepath}'.  Received error code (`+statusCode+")");
        if (response.data !== undefined)
            DdLogger.printError(response.data);
        return;
    }

    //let metadata = response.data;
    handleSuccessfulUpload(filepath);
};

//---------------------------------------------------------------------

function handleDirFileError(dirError) {
    DdLogger.printError(dirError);
};

//---------------------------------------------------------------------

function handleDirFileEvent(filepath, isChangeEvent)
{
    //If the event is for a file that passes filter, then get it
    if (!pubConfig.satisfiesFilter(filepath)) {
        let rejectMsg = "File '"+filepath+"' was skipped because it did not satisfy the filter: " + pubConfig.fileWildcard;
        DdLogger.debug(rejectMsg);
        return;
    }

    let eventType = isChangeEvent ? "Changed" : "New";
    let acceptMsg = eventType +" file event for : " + filepath;
    DdLogger.info(acceptMsg);

    let sleepMs = pubConfig.getFileEventTimeout();
    setTimeout(triggerFileUpload, sleepMs, filepath);

};


//---------------------------------------------------------------------

function triggerFileUpload(filepath)
{
    //get the expected OCS path
    let ocsPath = pubConfig.getOcsPath(filepath);

    //the uploaded wants a file object (is this the object type Axios expects?? Who knows...)
    // let theFile = fs.readFileSync(filepath);
    // if (theFile === null) {
    //     let readErrMsg = "Could not read the following file: ${filepath}";
    //     DdLogger.error(readErrMsg);
    //     return;
    // }


    //function(file, pkg, path, isOverwrite, callback)
    if (false) {
        pubConfig.ddUploader.verifyMetadata(filepath, pubConfig.packageId,
            pubConfig.packageBucket, ocsPath, pubConfig.overwriteEnabled,
            extractMetadata_Callback);
    }
    else{
        pubConfig.ddUploader.autoUpload(filepath, pubConfig.packageId,
                                  pubConfig.packageBucket,
                                  ocsPath, pubConfig.isOverwriteEnabled(),
                                   upload_Callback);

    }

};


//---------------------------------------------------------------------


function createOcsClient()
{

    //CREATE OCS CLIENT
    let ocsConfig = {
        ocsEndpointHost: pubConfig.ocsHost,
        ocsApiStage: pubConfig.ocsAPIDeployment
    };

    let ocsClient = new OCS(ocsConfig);
    return ocsClient;
}

//---------------------------------------------------------------------

function createDirListener()
{
    let dirListener = new DdListener(pubConfig);

    dirListener.setMessageCallback(handleDirFileEvent);
    dirListener.setErrorCallback(handleDirFileError);

    return dirListener;
}

//---------------------------------------------------------------------

function createFileUploader()
{
    let hostUrl = pubConfig.dataDriveHost;

    let fileUploader = new DdUploader(hostUrl, pubConfig.cssoToken);

    return fileUploader;

}
//---------------------------------------------------------------------

function startLocalSubscription()
{
    let _packageId   = pubConfig.packageId;
    let _packageName = pubConfig.packageName;

    if (DdUtils.isEmptyOrNullString(_packageId))
    {
        DdLogger.error("Error: startLocalSubscription: Missing required package id.");
        return;
    }
    if (DdUtils.isEmptyOrNullString(_packageName))
    {
        DdLogger.error("Error: startLocalSubscription: Missing required package name.");
        return;
    }

    //create local directory listener
    pubConfig.dirListener  = createDirListener();
    if(! pubConfig.dirListener) {
        DdLogger.error("Error: Unable to create a directory listener instance.");
        return;
    }

    //create the file uploader
    pubConfig.ddUploader = createFileUploader();
    if(! pubConfig.ddUploader) {
        DdLogger.error("Error: Unable to create a file uploaded instance.");
        return;
    }

    //start the listening session
    DdLogger.info("Listening for new files in "+pubConfig.dirListener.getDirectory()+"...");
    DdLogger.info("Will publish to "+_packageName+" ("+_packageId+")...");
    pubConfig.dirListener.startSession();
}


//---------------------------------------------------------------------

function initiate_OcsClient()
{

    //create an OCS client
    pubConfig.ocsClient = createOcsClient();

    //create an OCS utils layer
    pubConfig.ocsUtils = OcsUtils.builder(pubConfig.ocsClient, pubConfig.cssoToken)
}

//---------------------------------------------------------------------


function ddSrvcSettings_Callback(error, ocsHost, ocsStage)
{
    if (error)
    {
        DdUtils.errorAndExit(error);
    }

    pubConfig.setOcsSettings(ocsHost, ocsStage);
    initiate_OcsClient()
    pubConfig.ocsUtils.translatePackageNameToId(pubConfig.packageName)
        .then(pkgDetails => {
            xlate_PkgName_PkgId_Callback(err, pkgDetails['packageId'], pkgDetails['packageS3Bucket'])
        }).catch(err => {
            DdUtils.errorAndExit(err);
    })
}

//---------------------------------------------------------------------

function xlate_PkgName_PkgId_Callback(err,pkgId, pkgBucket) {

    if (err)  {
        DdLogger.printError(err);
        return;
    } else if (pkgId != null) {
        pubConfig.packageId = pkgId;
        pubConfig.packetBucket = pkgBucket;

        if (pkgBucket != null)
        {
            pubConfig.packageBucket = pkgBucket;
            startLocalSubscription();
        }
        else
        {
            DdLogger.error("Package '"+pubConfig.packageName+"' is not configured for file uploads.  Aborting.");
            return;
        }
    }
}


//---------------------------------------------------------------------

function initiate()
{
    //get OCS settings from middleware
    let ddService = DataDriveMWServiceSettings.builder(pubConfig.dataDriveHost, pubConfig.cssoToken)
    ddService.loadSettings().then(settingResult => {
        ddSrvcSettings_Callback(null, ddService.getOcsEndpointHost(), ddService.getOcsApiStage())
    }).catch(err => DdUtils.errorAndExit(err.toString()))
}

//---------------------------------------------------------------------

//------------------------------------------------
//------------------------------------------------

//------------------------------------------------

//load initial config/env
const pubConfig = new PubConfig(DdOptions.program);
if (!pubConfig.isConfigured() )
{
    DdLogger.error('Configuration unsuccessful.  Aborting.');
    return;
}

initiate();


//------------------------------------------------

