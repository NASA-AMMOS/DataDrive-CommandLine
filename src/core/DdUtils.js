

'use strict';

const Validator    = require('jsonschema').Validator;
const UrlLib       = require('url');
const HttpLib      = require('http');
const OsLib        = require('os');
const FsLib        = require('fs');
const PathLib      = require('path');
const request      = require('request');
const util         = require('util');
const fs           = require('fs');
const path         = require('path');
const moment       = require('moment');

const DdLogger    = require('./DdLogger.js').logger;
const DdConstants = require('./DdConstants.js');
const {AxiosWrapper} = require('./axios_wrapper')

//Setup the env config using user home dir

const HOME = OsLib.homedir();
const SEP = PathLib.sep;
const CFG_FILEDIR  = DdConstants.ENV_FILEDIR;
const CFG_FILENAME = DdConstants.ENV_FILENAME;
const CFG_FILE = `${HOME}${SEP}${CFG_FILEDIR}${SEP}${CFG_FILENAME}`;
// const env = require('dotenv').config({
//     path: CFG_FILE
// });
// if (env.error) {
//     throw env.error
// }

let utils = (function () {

    const OCS_MESG_SCHEMA_NS = "/ocsMessage";
    const OCS_MESG_SCHEMA = {
        "type": "object",
        "properties": {
            "package_id": {"type": "string"},
            "dataset_id": {"type": "string"},
            "ocs_full_name": {"type": "string"},
            "ocs_url": {"type": "string"},
            "package_dataset_event": {"type": "string"},
            "identity": {"type": "string"},
            "package_dataset_event_time": {"type": "number"},
        },
        "required": ["package_id", "dataset_id", "ocs_full_name", "ocs_url",
            "package_dataset_event",  "identity",
            "package_dataset_event_time"]
    };

    const DD_SAVED_SEARCH_MESG_SCHEMA_NS = "/ssMessage";
    const DD_SAVED_SEARCH_MESG_SCHEMA = {
        "type": "object",
        "properties": {
            "package_id": {"type": "string"},
            "dataset_id": {"type": "string"},
            "ocs_full_name": {"type": "string"},
            "ocs_url": {"type": "string"},
            "package_dataset_event": {"type": "string"},
            "identity": {"type": "string"},
            "package_dataset_event_time": {"type": "number"},
            "ss_type": {"type": "string"},
            "ss_name": {"type": "string"},
            "ss_owner": {"type": "string"}
        },
        "required": ["package_id", "dataset_id", "ocs_full_name", "ocs_url",
            "package_dataset_event",  "identity",
            "package_dataset_event_time", "ss_type", "ss_name", "ss_owner"]
    }

    const OCS_ERR_SCHEMA_NS = "/ocsErrMessage";
    const OCS_ERR_SCHEMA = {
        "type": "object",
        "properties": {
            "error": {"type": "Boolean"},
            "message": {"type": "string"},
        },
        "required": ["error", "message"]
    };

    const DD_UPLOAD_STATUS_NS = "/ddUploadStatusMessage"
    const DD_UPLOAD_STATUS_SCHEMA = {
        "type": "object",
        "properties": {
            "upload_status": {"type": "string"},
            "username": {"type": "string"},
            "failed": {"type": "boolean"},
            "upload_name": {"type": "string"},
        },
        "required": ["upload_status", "username", "upload_name", "failed"]
    };

    const validator = new Validator();
    validator.addSchema(OCS_MESG_SCHEMA, OCS_MESG_SCHEMA_NS);
    validator.addSchema(DD_SAVED_SEARCH_MESG_SCHEMA, DD_SAVED_SEARCH_MESG_SCHEMA_NS);
    validator.addSchema(OCS_ERR_SCHEMA,  OCS_ERR_SCHEMA_NS);
    validator.addSchema(DD_UPLOAD_STATUS_SCHEMA, DD_UPLOAD_STATUS_NS);

    let utils = function () {
        //this.validator = new Validator();
        //this.validator.addSchema(OCS_MESG_SCHEMA, '/ocsMessage');
        //this.validator.addSchema(OCS_ERR_SCHEMA,  '/ocsErrMessage');



    };

    /**
     * Validates the JSON object and returns either TRUE if it matches
     * the DataDrive Saved Search Message schema.
     * @param {Object} mesgObj - The OCS file message object
     * @return {boolean} - Either TRUE or FALSE
     */
    utils.isValidDDSavedSearchMessage = function (mesgObj) {
        let _rslt = utils.validateRequest(mesgObj, DD_SAVED_SEARCH_MESG_SCHEMA, validator);
        if (_rslt === true) {
            return true;
        }

        return false;
    }

    /**
     * Validates the JSON object and returns either TRUE if it matches
     * the DataDrive Upload Status Message schema.
     * @private
     *
     * @param {Object} mesgObj - The OCS file message object
     * @return {boolean} - Either TRUE or FALSE
     */

    utils.isValidDDUploadMessage = function (mesgObj) {

        let _rslt = utils.validateRequest(mesgObj, DD_UPLOAD_STATUS_SCHEMA, validator);
        if (_rslt === true) {
            return true;
        }

        return false;
    };


    /**
     * Validates the JSON object and returns either TRUE if it matches
     * the OCS Message schema or an error message.
     * @private
     *
     * @param {Object} mesgObj - The OCS file message object
     * @return {boolean} - Either TRUE or FALSE
     */

    utils.isErrorOcsMessage = function (mesgObj) {

        let _rslt = utils.validateRequest(mesgObj, OCS_ERR_SCHEMA, validator);
        if (_rslt === true) {
            return true;
        }

        return false;
    };


    /**
     * Validates the JSON object and returns either TRUE if it matches
     * the OCS Message schema or an error message.
     * @private
     *
     * @param {Object} mesgObj - The OCS file message object
     * @return {boolean|string} - Either TRUE, or an erro message.
     */

    utils.isValidOcsMessage = function (mesgObj) {

        let _rslt = utils.validateRequest(mesgObj, OCS_MESG_SCHEMA, validator);
        if (_rslt === true) {
            return true;
        }
        return false;
    };

    /**
     * Validates the input parameters and returns either TRUE or an error message.
     * @private
     *
     * @param {JSON} request - The request object (see {})
     * @param {JSON} schema - The schema against which to validate
     * @param {function} validator - The validator to use.
     * @return {boolean|string} - Either TRUE, or an error message.
     */
    utils.validateRequest = function (request, schema, validator) {
        let _results = validator.validate(request, schema);
        let _ret = true;
        if (!_results.valid) {
            _ret = 'Invalid input parameters:';
            for (let e of _results.errors) {
                _ret = _ret + ' ' + e.toString();
            }
        }
        return _ret;
    };

    /**
     * Check if the current file location can be written to based on DdSubConfig's overwrite property
     *
     * @param {string} filepath - Path to file location
     * @param {Object} config - DdSubConfig that contains information on how to check if we can write to file path
     */
    utils.canWriteToLocalFile = function (filepath, config) {
        // check if file exists
        if (fs.existsSync(filepath)) {
            if (config.overwrite) {
                // overwrite flag is set to true
                return true;
            }
            return false; // default for file exist is to not overwrite
        }
        // can write b/c file does not exist
        return true;
    };

    /**
     * Makes sure that parent directory(s) exists; if not create them recursively
     * @param {string} filepath - Path to file location
     */
    utils.ensureDirectory = function(filepath) {
        let fpParsed = path.parse(filepath);
        fs.mkdirSync(fpParsed.dir, {recursive: true});
    }

    /**
     * Makes sure that the file path returned is always an absolute path
     * @param {string} filepath - file path
     * @returns {string}
     */
    utils.ensureAbsolutePath = function(filepath) {
        if (path.isAbsolute(filepath)) {
            return filepath;
        }
        return path.resolve(filepath);
    }

    /**
     * Instructions for checking the file system should be here; currently this only checks if the directory exists
     * @param {string} path - path to the given directory
     */
    utils.fsChecks = function(path) {
        // check if directory exists
        if (fs.existsSync(path)) {
            return true;
        }
        return false;
    }

    utils.extractFilenameFromUrl = function (url) {
        let _parsedUrl = UrlLib.parse(url);
        let _basename  = PathLib.basename(_parsedUrl.pathname);

        return _basename;
    };

    utils.downloadFromUrl = function (url, dest, cb) {

        let _file = fs.createWriteStream(dest);
        let request = HttpLib.get(url, function (response) {
            response.pipe(_file);
            _file.on('finish', function () {
                _file.close(cb);  // close() is async, call cb after close completes.
            });
        }).on('error', function (err) { // Handle errors
            fs.unlink(dest); // Delete the file async. (But we don't check the result)
            if (cb)
                cb(err.message);
        });
    }

    //--------------------------------------------

    utils.isOcsUnauthError = function (err) {

        if (!err)
            return false;

        if (!err.message)
            return false;

        let _mesg = err.message;

        let flag = _mesg.startsWith("UNAUTHORIZED: ");
        return flag;
    }

    //--------------------------------------------

    utils.preauthThen = function(url, token, callMeIfSuccessfull) {

        const reqOptions = {
            url: url,
            method: 'GET',
            headers: {
                Cookie: request.cookie('ssosession=' + token)
            }
        };

        DdLogger.info("Sending initial HTTP request to  "+url+"\n");
        request(reqOptions, (err, res, body) => {
                if (err) {
                    DdLogger.error("Request error: "+err);
                    return;
                }
                if (res.headers['set-cookie'] === undefined || res.headers['set-cookie'].length < 1)
                {
                    DdLogger.error('no cookies in http response');
                    return;
                }

                // TODO check body to see if it's authenticated.
                let auth_token = '';
                res.headers['set-cookie'].forEach(e => {
                    if (e.startsWith('authorization_token'))
                    {
                        auth_token = e.split(';', 1)[0].replace('authorization_token=', '');
                        DdLogger.debug("Auth_Token = ["+auth_token+"]\n");

                    }
                });  //end_forEach

                if (auth_token === '')
                {
                    DdLogger.error('no auth token');
                    return;
                }

                callMeIfSuccessfull();
            }
        );

    }

    //--------------------------------------------

    utils.isEmptyOrNullString = function (str) {

        if (!str)
            return true;

        if (str === "")
            return true;

        return false;
    }

    //--------------------------------------------

    utils.fileExists = function(filepath) {

        try {
            if (FsLib.existsSync(filepath)) {
                return true;
            }
        } catch(err) {
        }

        return false;
    };

    //--------------------------------------------

    utils.isWindows = function() {
        var opsys = process.platform;
        if (opsys == "win32" || opsys == "win64") {
            return true;
        }
        return false;
    };

    /**
     * Given wildcard glob regex and user specified regex, check whichever one is valid
     * then return whether given filename matches either one. If both glob and regex are
     * valid, default to glob
     *
     * @param {string} filename - file name
     * @param {RegExp} regex - regex object based on "--regex" option
     */
    utils.filterFilePath = function(filename, regex) {
        let regexMatches = regex.test(filename);
        return regexMatches;
    }

    //---------------------------------------------------------------

    utils.getCurrentTimeMillis = function() {
        let myDate = new Date();
        return myDate.getTime();
    };

    //---------------------------------------------------------------

    utils.getCfgFilepath = function(subdir, filename) {
        let HOME         = OsLib.homedir();
        let SEP          = PathLib.sep;
        let CFG_FILE = `${HOME}${SEP}${subdir}${SEP}${filename}`;

        return CFG_FILE;
    };

    //---------------------------------------------------------------

    utils.getDdCfgFilepath = function() {
        return utils.getCfgFilepath(DdConstants.CFG_FILEDIR,
                                    DdConstants.CFG_FILENAME);
    };

    utils.getOcsCfgFilepath = function() {
        return utils.getCfgFilepath(DdConstants.OCS_CFG_FILEDIR,
                                    DdConstants.OCS_CFG_FILENAME);

    };

    /**
     * Print error message and exit the application
     * @param {string|Error} err
     */
    utils.errorAndExit = function (err) {
        if (err instanceof Error) {
            DdLogger.error(err.message);
            DdLogger.debug(err.stack);
        }
        else {
            DdLogger.error(err);
        }
        process.exit(1);
    };

    //---------------------------------------------------------------

    utils.isValueTrue = function(value) {
        if (value)
        {
            let boolValue = value.toString().toLowerCase() === 'true' ? true : false;
            return boolValue;
        }
        return false;
    };

    //---------------------------------------------------------------
    // TODO: JEFF... need to create regex query for this
    // get playback event from DataDrive middleware
    utils.getPlaybackEvents = async function(startTime, endTime, config) {
        DdLogger.info(`start: ${startTime}, end: ${endTime}`);
        let response;
        if (config.packageName) {
            DdLogger.debug(`getPlaybackEvents with package name: ${config.packageName}`)
            response = await utils.getPlaybackPackageEvents(startTime, endTime, config);
        }
        else {
            DdLogger.debug(`getPlaybackEvents with saved search name: ${config.savedSearchName}`)
            response = await utils.getPlaybackSavedSearchEvents(startTime, endTime, config);
        }
        return response
        // if (utils.validHTTPResponse(response)) {
        //     DdLogger.debug(JSON.stringify(response)); // TODO: Remove me
        //     return response;
        // }
        // else {
        //     throw Error(`getPlaybackEvents returned a status code: ${response.statusCode} and body: ${JSON.stringify(response.body)}`);
        // }
    };

    utils.getPlaybackPackageEvents = async function(startTime, endTime, config) {
        let body = {
            start_time: startTime,
            end_time: endTime,
            all_pkg: false,
            pkg: [config.packageId]
        };
        if (config.fileRegexObj) {
            body['regex'] = config.fileRegex;
        }
        else {
            body['glob_regex'] = config.fileWildcard;
        }
        const options = {
            method: 'POST',
            url: `${config.dataDriveHost}/api/playback/v2`,
            headers: {
                'Content-Type': 'application/json',
                Cookie: `ssosession=${config.cssoToken}`
            },
            data: body,
        }
        DdLogger.debug(`getPlaybackPackageEvents request options: ${JSON.stringify(options)}`);
        let allResults = []
        let esResult = await AxiosWrapper.builder().request(options)
        while (esResult['results'].length > 0) {
            allResults.push(esResult['results'])
            body['pagination_marker'] = esResult['marker']
            esResult = await AxiosWrapper.builder().request(options)
        }
        return allResults.flat(2)
        // return this.executeDdRequest(url, method, body, config.cssoToken)
    };

    utils.getPlaybackSavedSearchEvents = async function(startTime, endTime, config) {
        let body = {
            start_time: startTime,
            end_time: endTime,
            ss_name: config.savedSearchName
        }; // currently we will only query for personnel saved searches
        const options = {
            method: 'POST',
            url: `${config.dataDriveHost}/api/ss/playback/v2`,
            headers: {
                'Content-Type': 'application/json',
                Cookie: `ssosession=${config.cssoToken}`
            },
            data: body,
        }
        DdLogger.debug(`getPlaybackSavedSearchEvents request options: ${JSON.stringify(options)}`);
        let allResults = []
        let esResult = await AxiosWrapper.builder().request(options)
        while (esResult['results'].length > 0) {
            allResults.push(esResult['results'])
            body['pagination_marker'] = esResult['marker']
            esResult = await AxiosWrapper.builder().request(options)
        }
        return allResults.flat(2)
    };

    //---------------------------------------------------------------
    // Get saved search; This is used to verify that a saved search exists
    /**
     *
     * @param {String} ss_type "personnel" or "general"
     * @param {String} name name of saved search
     * @param {String} owner this is for "general" saved search only; name of the owner for a "general" saved search
     * @param {DdSubConfig} config config that stores information about DataDrive
     */
    utils.getSavedSearch = async function(ss_type, name, owner, config) {
        let url;
        if (ss_type === "general") {
            url = `${config.dataDriveHost}/api/saved_search/get/${owner}/${name}`;
        }
        else {
            url = `${config.dataDriveHost}/api/saved_search/get/${name}`;
        }
        return this.executeDdRequest(url, "GET", null, config.cssoToken);
    }

    utils.verifySavedSearch = async function(ss_type, name, owner, config, callback) {
        let response = await this.getSavedSearch(ss_type, name, owner, config);
        if (utils.validHTTPResponse(response)) {
            callback()
        }
        else {
            this.errorAndExit('Saved search specified does not exist.');
        }
    }

    /**
     * Helper function to build and execute a request to DataDrive Middleware Server
     * @param {*} url URL of the request
     * @param {*} method HTTP Method of the request; this has to be all upper case
     * @param {*} body Body of the request
     * @param {*} cssoToken CSSO Token that will be passed into `ssosession` header; this will log in the user
     * @returns {Promise} Promise with Response object
     */
    utils.executeDdRequest = function(url, method, body, cssoToken) {
        const reqOptions = {
            url: url,
            method: method,
            headers: {
                Cookie: request.cookie('ssosession=' + cssoToken )
            },
            json: true
        };
        if (body) {
            reqOptions['body'] = body;
        }
        DdLogger.debug(`Executing DdRequest with reqOptions: ${JSON.stringify(reqOptions)}`);
        const requestAsync = util.promisify(request);
        let promise = requestAsync(reqOptions);
        return promise;
    }

    //---------------------------------------------------------------
    // comparator to help sort array of objects with ocs_updated_at field as the field to sort by
    utils.playbackEventsComparator = function(event1, event2) {
        return new Date(event1.ocs_updated_at).getTime() - new Date(event2.ocs_updated_at).getTime();
    }

    /**
     * Check if status code returned from HTTP response is either 2xx (success) or 3xx (redirection)
     * https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
     * @param {HttpLib.IncomingMessage} response
     */
    utils.validHTTPResponse = function(response) {
        if (response.statusCode) {
            if (response.statusCode >= 200 && response.statusCode < 400) {
                return true;
            }
        }
        return false;
    }

    /**
     * Write Date object to File
     * @param {string} filePath
     * @param {Date} date
     * @returns {Promise}
     */
    utils.writeDateToFile = function(filePath, date) {
        // write to file in the folder the date
        // for multiple download workers, you want to maybe use a queue or something like that
        // this is to make sure there are no file read/write collisions
        const fsWriteFileAsync = util.promisify(fs.writeFile);
        let dateStr = moment(date).format('YYYY-MM-DDTHH:mm:ss.SSSZZ'); // write to local time zone
        return fsWriteFileAsync(filePath, dateStr);
    }

    /**
     * Write Date object to File
     * @param {string} filePath
     * @param {string} packageName
     * @returns {Promise}
     */
    utils.writePackageNameToFile = function(filePath, packageName) {
        // write package name to file
        const fsWriteFileAsync = util.promisify(fs.writeFile);
        return fsWriteFileAsync(filePath, packageName);
    }

    /**
     * Read checkpoint date from given file path
     * @param {string} filePath
     * @returns {Promise}
     */
    utils.getCheckPointDate = function(filePath) {
        const fsReadFileAsync = util.promisify(fs.readFile);
        return fsReadFileAsync(filePath);
    }

    /**
     * Read contents from given file path
     * @param {string} filePath
     * @returns {Promise}
     */
    utils.readFile = function(filePath) {
        const fsReadFileAsync = util.promisify(fs.readFile);
        return fsReadFileAsync(filePath, 'utf8');
    }

    return utils;
})();

module.exports = utils;
