

const axios         = require("axios/index");
const FormData      = require('form-data');
const fs            = require('fs');
const os            = require('os');
const path          = require('path');
const upath         = require('upath');
//const StreamConcat  = require("concat-stream")
const request       = require('request');

const DdLogger      = require('./DdLogger.js').logger;


// Pass axios to the imported 'axios-debug' function.
//require('axios-debug')(axios);

//Inspiration: https://github.jpl.nasa.gov/MIPL/DataDrive-Frontend/blob/develop/src/data/ocsLogic.js#L631



let DdUploader = (function () {

    const NO_RESPONSE_TIMEOUT = 5 * 60 * 1000; // 5 minute timeout to wait for lambda result

    //---------------------------------------------------------------------

    /**
     * Constructor
     * @param ocsServiceUrl Base-URL of the DataDrive middleware
     * @param cssotoken CSSO Token
     */

    let DdUploader = function (ocsServiceUrl, cssotoken) {

        this.serviceRoot = ocsServiceUrl;
        this.cssoToken   = cssotoken;

        this.requestTimeout = null;

        //-------------------
        //Config maps

        this.axiosConfig = {
            headers: {
                Cookie: `ssosession=${this.cssoToken}`
            },
//            withCredentials: true, //Do we include this?
            };

        this.streamConfig = {encoding: 'buffer'};

        //-------------------
        //massage data

        if (this.serviceRoot.endsWith("/")) {
            let srLen = this.serviceRoot.length;
            this.serviceRoot = this.serviceRoot.substring(0, srLen - 1);
        }

    };

    //---------------------------------------------------------------------

    /**
     * Check if the session is still valid by hitting the sso status endpoint.
     */

    DdUploader.prototype.isStillAuthenticated = function() {
        return new bbPromise((resolve, reject) => {
            axios.get(`${this.serviceRoot}/ssostatus`)
                .then(response => {
                    if (response.status === 200 &&
                        response['data'] !== undefined &&
                        response['data']['authenticated'] !== undefined &&
                        response['data']['authenticated'] === true) {
                        resolve(true);
                        return;
                    }

                reject(Error('No longer Authenticated'));
            })
            .catch(err => {
                reject(Error(err['message']));
            });

        });
    };

    //---------------------------------------------------------------------

    DdUploader.prototype.isNullOrEmpty = function(input) {
        input === null || input === undefined || input === ''
    };

    //---------------------------------------------------------------------

    DdUploader.prototype.isNullOrEmptyObj = function(input) {
        input === null || input === undefined || input === {}
    };

    //---------------------------------------------------------------------

    DdUploader.prototype.isNullOrEmptyArr = function(input) {
        input === null || input === undefined || !Array.isArray(input) || input.length < 1
    };

    //---------------------------------------------------------------------

    DdUploader.prototype.resetTimer = function() {
        if (this.requestTimeout !== null) {
            clearTimeout(this.requestTimeout);
            this.requestTimeout = null;
        }
    }

    //---------------------------------------------------------------------

    //---------------------------------------------------------------------

    //---------------------------------------------------------------------


    DdUploader.prototype.autoUpload = function(filepath, pkg, bucket, path, isOverwrite, callback) {

        let that = this;

        let restUrl = `${this.serviceRoot}/api/UploadAutoForce`;

        let wrappedCB = function(filepath, err, statusCode, body) {
            that.resetTimer();
            callback(filepath, err, statusCode, body);
        };

        this.autoUploadBackground(filepath, pkg, bucket, path, isOverwrite, restUrl, wrappedCB);

        that.resetTimer();
        this.requestTimeout = setTimeout(() => {
            let errMsg = "Timeout reached while waiting for upload request to process";
            DdLogger.error(errMsg);
            wrappedCB(filepath, errMsg, null, null);
        }, NO_RESPONSE_TIMEOUT);


    };

    //---------------------------------------------------------------------

    DdUploader.prototype.autoUploadBackground = function(filepath, ocspkg, s3Bucket, ocspath,
                                                         isOverwrite, url, callback) {

        let fileName   = path.basename(filepath);
        let fileStream = fs.createReadStream(filepath);

        let dbgMesg = "Upload request for: "+filepath+", pkg_id="+ocspkg+", ocs_path="+ocspath+",overwrite="+isOverwrite;
        dbgMesg = dbgMesg + "\nUpload URL: "+url;
        DdLogger.debug(dbgMesg);

        const _reqOptions = {
            url: url,
            method: 'POST',
            headers: {
                Cookie: request.cookie('ssosession=' + this.cssoToken )
            },

        };

        var req = request(_reqOptions, function (err, resp, body) {

            if (err) {
                dbgMesg = dbgMesg + "\nUpload URL: "+url;
                DdLogger.error("Upload error: "+err);
            } else {
                DdLogger.debug("Request for upload returned");
            }

            DdLogger.debug("Destroying stream associated with "+filepath);
            fileStream.destroy();
            //fileStream.close();


            callback(filepath, err, resp, body);

        });

        var form = req.form();

        let s3Filename = this.createS3Name(s3Bucket, ocspath.toString(), 
                                           fileName.toString());

        DdLogger.debug("s3Filename = "+s3Filename+" from components: bucket: "+s3Bucket+", ocspath: "+ocspath.toString()+", filename: "+fileName.toString());
        
        //form.append('file',       fileStream);
        form.append('pkg_id',     ocspkg.toString());
        form.append('ocs_path',   ocspath.toString());
        form.append('overwrite',  isOverwrite.toString());
        form.append('name',       s3Filename);
        //form.append('name',       fileName.toString());
        form.append('file',       fileStream);

    };

    //---------------------------------------------------------------------
    
    DdUploader.prototype.createS3Name = function(s3Bucket, path, filename) {

        if (s3Bucket === undefined || path === undefined) 
        {
            return filename;
        }

        // Remove potential trailing slashes from path
        if (path !== null) 
        {
            path = path.replace(/\/+$/, "");
        }
    
        return `s3://${s3Bucket}${path}/${filename}`;
    }

    //---------------------------------------------------------------------

    DdUploader.prototype.extractErrorMessage = function(axiosErr) {

        if (axiosErr['response'] !== undefined) { // it has response object
            let responseObj = axiosErr['response'];
            if (responseObj['data'] !== undefined) { // it has data object
                let responseData = responseObj['data'];
                if (typeof responseData === 'object') { // it's JSON object.
                    if (responseData['message'] !== undefined) { // it has message
                        return responseData['message'];
                    }
                    return JSON.stringify(responseData);
                }
                if (responseData !== '') { // assuming it's a string, it is not empty
                    return responseData;
                }

                // TODO it may be JSON obj

            }
            return `error with status: ${responseObj['status']}`;
        }

        if (axiosErr['message'] !== undefined) { // it has error message
            return axiosErr['message'];
        }

        return 'unkonwn error';
    };


    //---------------------------------------------------------------------


    return DdUploader;

})();

module.exports = DdUploader;
