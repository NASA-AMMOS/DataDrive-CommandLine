/**
 * @author wphyo
 * Created on 6/1/22.
 */
const AxiosWrapper = require('./AxiosWrapper').AxiosWrapper
const https = require('https');
const DdUtils = require('./DdUtils')
const DdLogger = require('./DdLogger').logger

class DataDriveMWServiceSettings {
    constructor(ddHost, cssoToken) {
        this._datadriveHost = ddHost;
        this._cssoToken = cssoToken;
        this._ocsVenue = null;
        this._ocsUrl = null;
        this._pepUrl = null;
    }

    static builder(ddHost, cssoToken) {
        return new DataDriveMWServiceSettings(ddHost, cssoToken)
    }

    getOcsEndpointHost() {
        return this._ocsUrl
    }

    getOcsApiStage() {
        return this._ocsVenue;
    }

    async loadSettings() {
        const options = {
            method: 'GET',
            url: `${this._datadriveHost}/`,
            headers: {
                Cookie: `ssosession=${this._cssoToken}`
            },
            httpsAgent: new https.Agent({rejectUnauthorized: false}),
        }
        try {
            const ddSetting = await AxiosWrapper.builder().request(options)
            this._ocsUrl = ddSetting['ocs_endpoint']
            this._ocsVenue = ddSetting['ocs_stage']
            DdLogger.debug("OCS Settings from DataDrive middleware [Url: " + this._ocsUrl + ", Stage: " + this._ocsVenue + "]");

        } catch (e) {
            DdUtils.errorAndExit(`Error occurred while querying DataDrive host for OCS settings. URL: "${options['url']}" Status code: ${e.statusCode} Error: ${e.message}`);
        }
    }
}

exports.DataDriveMWServiceSettings = DataDriveMWServiceSettings
