const fs           = require('fs');
const os           = require('os');
const path         = require('path');
const upath        = require('upath');
//const argv         = require('argv-parse');
const globToRegExp = require('glob-to-regexp');



const DdConsts   = require('./DdConstants.js');
const SsoToken   = require('./SsoToken.js');
const DdUtils    = require('./DdUtils.js');
const DdLogger   = require('./DdLogger.js').logger;
const {DdCliConfigFileIO} = require('./DdCliConfigFileIO');

/**
 * Definition of the DataDrive Web Socket client
 *
 * @type {DdPubConfig}
 */
let DdPubConfig = (function () {


    /**
     * @constructor
     */
    let DdPubConfig = function (program) {

        //lets assume the worst case...
        this.wasConfiguredSuccessfully = false;

        //-----------------

        let ddHost = DdCliConfigFileIO.builder().getDatadriveHost();

        if (! ddHost) {
            DdLogger.error('Missing required configuration: '+DdConsts.PROP_DATADRIVE_HOST);
            DdLogger.error('Please check your configuration via the "dd-config" command.');
            return null;
        }

        this.datadriveHost    = "https://"+ddHost;
        this.ocsHost = null;
        this.ocsAPIDeployment = null;

        //Check the environment for the DEBUG state
        let debugEnvVal = DdCliConfigFileIO.builder().getConfigValue(DdConsts.PROP_DEBUG_ENABLED);
        if (DdUtils.isValueTrue(debugEnvVal))
        {
            DdLogger.setDebugEnabled(true);
        }


        //-----------------

        //CSSO token
        this.ssoTokenApi = new SsoToken();
        let token    = this.ssoTokenApi.getToken();
        if (DdUtils.isEmptyOrNullString(token))
        {
            throw Error(`Could not load CSSO credentials/token.`);
        }
        this.cssoToken = token;



        this.packageId        = null;
        this.packageName      = null;
        this.packageBucket    = null;
        this.retainPath       = false;
        this.overwriteEnabled = false;

        //-----------------

        //this.parseArgv();
        this.processOptions(program);

        this.debugEnabled       = true;


    };


    //---------------------------------------------------------------------

    DdPubConfig.prototype.setOcsSettings = function(host, venue) {
        this.ocsHost = host;
        this.ocsAPIDeployment = venue;
    };


    //---------------------------------------------------------------------

    DdPubConfig.prototype.getCssoToken = function() {
        return this.cssoToken;
    };

    //---------------------------------------------------------------------

    DdPubConfig.prototype.processOptions = function (program) {

        this.packageName           =  program.packageName;
        this.sourceDir             =  program.sourceDir;
        this.fileWildcard          =  program.filter;
        this.destRoot              =  program.destPrefix;

        this.retainPath            =  program.retainPath || false;
        this.overwriteEnabled      =  program.overwrite  || false;
        this.packageId             =  null;
        this.packageBucket         =  null;

        //examine glob to make filter decisions
        this.filterIncludesPath    = (this.fileWildcard.indexOf("/") > -1);
        this.fileWildcardRegexObj  =  globToRegExp(this.fileWildcard);

        this.wasConfiguredSuccessfully = true;
    };



    // DdPubConfig.prototype.parseArgv = function () {
    //
    //     let args = argv({
    //         packageName: {         //name of package to which files will be published
    //             type: 'string',
    //             alias: 'p'
    //         },
    //         sourceDir: {           //source directory to which we will be listening
    //             type: 'string',
    //             alias: 's'
    //         },
    //         destRoot: {            //root location in package to which all files will be added (default: "")
    //             type: 'string',
    //             alias: 'd'
    //         },
    //         filter: {              //client-side filter on which files will be published
    //             type: 'string',
    //             alias: 'f'
    //         },
    //         overwrite: {              //flag that determines if file can be overwritten (default: false)
    //             type: 'boolean',
    //             alias: 'o'
    //         },
    //         retainPath: {          //flag that determines if subdir path will be maintained (default: false)
    //             type: 'boolean',
    //             alias: 'r'
    //         }
    //     });
    //
    //     //check args
    //     if (!args.packageName)
    //     {
    //         DdLogger.error('Missing required argument: packageName');
    //         return null;
    //     }
    //     if (!args.sourceDir)
    //     {
    //         DdLogger.error('Missing required argument: sourceDir');
    //         return null;
    //     }
    //
    //     //set defaults
    //     if (!args.filter)
    //     {
    //         args.filter = "*";
    //     }
    //     if (!args.destRoot)
    //     {
    //         args.destRoot = "";
    //     }
    //     if (!args.retainPath)
    //     {
    //         args.retainPath = false;
    //     }
    //     if (!args.overwrite)
    //     {
    //         args.overwrite = false;
    //     }
    //
    //     this.packageName        =  args.packageName;
    //     this.sourceDir          =  args.sourceDir;
    //     this.fileWildcard       =  args.filter;
    //     this.destRoot           =  args.destRoot;
    //     this.retainPath         =  args.retainPath;
    //     this.overwriteEnabled   =  args.overwrite;
    //     this.packageId          =  null;
    //
    //
    //     //examine glob to make filter decisions
    //     this.filterIncludesPath = (this.fileWildcard.indexOf("/") > -1);
    //     this.fileWildcardRegexObj  =  globToRegExp(this.fileWildcard);
    //
    //     this.wasConfiguredSuccessfully = true;
    // };

    //---------------------------------------------------------------------

    DdPubConfig.prototype.isConfigured = function()
    {
        return this.wasConfiguredSuccessfully;
    }

    //---------------------------------------------------------------------

    DdPubConfig.prototype.isOverwriteEnabled = function()
    {
        return this.overwriteEnabled;
    }

    //---------------------------------------------------------------------


    /**
     * Returns an OCS path for the local filepath, which is
     * relative to the OCS package.
     *
     * @param {string} filepath Local path of the file to be uploaded
     * @return (string} Path part of OCS URL
     */

    DdPubConfig.prototype.getOcsPath = function(filepath)
    {
        let parent   = path.dirname(filepath);
        let basename = path.basename(filepath);

        let dbgPrefix = "DdPubConfig:;getOcsPath: ";
        DdLogger.debug(dbgPrefix+" Parent = "+parent);
        DdLogger.debug(dbgPrefix+" basename = "+basename);

        let srcRoot  = this.sourceDir;

        //get the relative pat between srcDir and file's dir
        let relativePath = path.relative(srcRoot, parent);
        relativePath = upath.normalizeSafe(relativePath);

        DdLogger.debug(dbgPrefix+" relativePath = "+relativePath);

        //we are gonna build the prefix
        let prefix = "";

        //if we have a common destination root, use it
        if (! DdUtils.isEmptyOrNullString(this.destRoot))
        {
            prefix =  upath.normalizeSafe(this.destRoot);
        }

        DdLogger.debug(dbgPrefix+" prefix_A = "+prefix);

        //if we want to preserve the relative path, do so
        if (this.retainPath)
        {
            prefix = upath.joinSafe(prefix, relativePath);
        }

        DdLogger.debug(dbgPrefix+" prefix_B = "+prefix);

        //does OCS path include the filename?
        // let ocsPkgPath = upath.joinSafe(prefix, basename);
        let ocsPkgPath = prefix;

        DdLogger.debug(dbgPrefix+" ocsPkgPath_A = "+ocsPkgPath);

        //ensure we start with a slash?
        if (!ocsPkgPath.startsWith("/")) {
            ocsPkgPath = "/" + ocsPkgPath;
        }

        DdLogger.debug(dbgPrefix+" ocsPkgPath-B = "+ocsPkgPath);

        return ocsPkgPath;
    };


    //---------------------------------------------------------------------


    DdPubConfig.prototype.satisfiesFilter = function(fullpath)
    {
        let _glob  = this.fileWildcard;
        let _regex = this.fileWildcardRegexObj;
        if (!_glob || !_regex)
            return true;

        //Assume fullpath is target, but if filter
        //is pathless, then just look at the basename?
        var target = fullpath;
        if (!this.filterIncludesPath)
        {
            //var basename = DdUtils.extractFilenameFromPath(fullpath);
            var basename = path.basename(fullpath);
            target = basename;
        }

        let regexMatches = _regex.test(target);
        return regexMatches;
    };


    //---------------------------------------------------------------------

    /**
     * Returns a timeout for which we should wait before processing a new
     * file event.  The reason for this is to add a small delay in the case
     * of Windows as apparently Antivirus services can sometimes hold onto
     * a file early on, resulting in a read-access issue if we don't wait
     * for that to finish.
     * @return Timeout in milliseconds
     */

    DdPubConfig.prototype.getFileEventTimeout = function()
    {
        let sleepMs = 1;
        if (DdUtils.isWindows()) {
            sleepMs = 5000;
            DdLogger.debug("Sleeping for " + sleepMs + " ms (Thanks Windows Antivirus)");
        }

        return sleepMs;
    };

    //---------------------------------------------------------------------

    //---------------------------------------------------------------------

    return DdPubConfig;

})();

module.exports = DdPubConfig;
