const util     = require('util');
const DdConsts         = require('./DdConstants.js');
const SsoToken         = require('./SsoToken.js');
const DdUtils          = require('./DdUtils.js');
const DdLogger         = require('./DdLogger.js').logger;
const {EmptyPromise} = require('./EmptyPromise')

class OcsUtils {
    static builder(ocsClient, ocsToken) {
        return new OcsUtils(ocsClient, ocsToken)
    }
    constructor(ocsClient, ocsToken) {
        this._ocsClient = ocsClient;
        this._token     = ocsToken;
    }

    __validateOCSResult (err, result, methodName) {
        if (err !== null) {
            return `${methodName}-ends-in-error: ${err.toString()}`;
        }
        if (result === null || result === undefined) {
            return `result for ${methodName} is NULL or UNDEFINED`;
        }
        if (result['statusCode'] !== 200) { // status return is not 200
            if (result['error'] !== undefined && result['error'] !== null) { // there is an error message
                let errMsg = JSON.stringify(result['error']);
                DdLogger.error(`ocs-api-error for ${methodName}: ${errMsg}`, this._user);
                return errMsg;
            } else {
                return `ocs status for ${methodName} returned is not 200. code: ${result['statusCode']}`;
            }
        }
        return undefined;
    }

    async __executeOCS (param, methodName) {
        DdLogger.debug(`${methodName} : ${util.inspect(param, {depth: null})}`);
        const instance = this;

        let promise = EmptyPromise.builder()
        this._ocsClient[methodName](param, (err, result) => {
            let validateOCSResponse = instance.__validateOCSResult(err, result, methodName); // checking the result
            if (validateOCSResponse !== undefined) {
                DdLogger.error("Error occurred while requesting all package information from OCS.");
                DdLogger.printError(validateOCSResponse);

                if (DdUtils.isOcsUnauthError(validateOCSResponse)) {  // TODO
                    DdLogger.error("Please ensure your OCS CSSO login credentials are valid.");
                }
                promise.reject(new Error(validateOCSResponse));
                return;
            }
            promise.resolve(result['data']);
        });
        return await promise.get();
    }

    toBucketKey(s3Url) {
        if (!s3Url.startsWith(DdConsts.S3_PROTOCOL)) {
            return undefined
        }
        const _matches = s3Url.match(DdConsts.S3_URL_REGEX);
        return {
            bucket: _matches[1],
            key: _matches[2]
        }
    }

    /**
     * Returns a permalink to an object indexed in OCS. Copied via https://github.jpl.nasa.gov/M2020-CS3/m2020-data-lake repo
     *
     * @param {string} pepUrl - The URL of the PEP server
     * @param {string} url - The URL of the data object that was indexed in OCS. Typeically, this is an S3 URL.
     * @return {string} - A permalink to the URL.
     */
    getPermalinkviaPEP(pepUrl, url) {
        const _bucketKey = this.toBucketKey(url)
        if (_bucketKey && _bucketKey.bucket && _bucketKey.key) {
            // This is an S3 URL.
            if (pepUrl) {
                return `${pepUrl}/${_bucketKey.bucket}/${_bucketKey.key}`
            } else {
                throw Error('The PEP server information is not defined. The configuration needs to be updated.')
            }
        } else {
            // Not an S3 URL, so we just return as is. Assume the resource is already protected by CSSO.
            return url
        }
    }

    createLsQuery(packageId, ocsFullname, expr) {
        let patternsArray = [ `${ocsFullname}` ];
        let searchDoc = {
            packageName: packageId,
            patterns:    patternsArray,
            dirOnly:     false,
            recursive:   false,
        };

        if (expr)
        {
            searchDoc.expr = expr;
        }

        return searchDoc;
    }

    createLsRequest(packageId, ocsFullname, expr) {

        let lsQueryObj = this.createLsQuery(packageId, ocsFullname, expr);
        return  {
            csso: {
                sessionToken: this._token
            },
            input: lsQueryObj
        }
    }

    /**
     *
     * @param packageName : String
     * @return {Promise<{packageS3Bucket: (null|*), packageId: *}|{packageS3Bucket: null, packageId: null}>}
     */
    async translatePackageNameToId(packageName) {
        if (!this._ocsClient) {
            throw new Error("No OCS client available");
        }
        if (!this._token) {
            throw new Error("No OCS token set");
        }
        if (DdUtils.isEmptyOrNullString(packageName)) {
            throw new Error("No packageName parameter");
        }
        let _descAllPkgsReq = {
            csso: {
                sessionToken: this._token
            }
        }
        const ocsPkgs = await this.__executeOCS(_descAllPkgsReq, 'describeAllPackages')
        if(ocsPkgs.length < 1) {
            DdLogger.warn('no package found in OCS')
            return {
                packageId: null,
                packageS3Bucket: null,
            }
        }
        const filteredPkg = ocsPkgs.filter(e => e['name'] === packageName)
        if (filteredPkg.length < 1) {
            DdLogger.debug(`no package name: ${packageName} in OCS`)
            return {
                packageId: null,
                packageS3Bucket: null,
            }
        }
        return {
            packageId: filteredPkg[0]['package_id'],
            packageS3Bucket: filteredPkg[0]['s3Bucket'] === undefined ? null : filteredPkg[0]['s3Bucket']
        }
    }

    async getOcsFileMetadata(packageName, ocsFullname) {
        if (!ocsFullname || ocsFullname === "") {
            DdLogger.error("getOcsFileMetadata: Missing ocsFullname parameter");
            return
        }
        const ocsFileArray = await this.__executeOCS(this.createLsRequest(packageName, ocsFullname, null), 'searchLS')

        if (ocsFileArray.length < 1) {
            DdLogger.debug(`no file found for ${ocsFullname}`)
            return {}
        }
        if (ocsFileArray.length > 1) {
            DdLogger.warn(`OCS sent multiple results (count = ${ocsFileArray.length}) for the OCS LS query for: ${ocsFullname}`);
            DdLogger.warn("If this issue exists beyond G6.0 testing, please inform OCS/CS3 team (its their bug?)");
        }
        return ocsFileArray[0]
    }
}

module.exports = OcsUtils
