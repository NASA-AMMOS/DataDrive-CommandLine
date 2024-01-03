const fs           = require('fs');
const path         = require('path');
const globToRegExp = require('glob-to-regexp');
const DdConsts   = require('./DdConstants.js');
const SsoToken   = require('./SsoToken.js');
const DdUtils    = require('./DdUtils.js');
const DdLogger   = require('./DdLogger.js').logger;
const {DdCliConfigFileIO} = require('./DdCliConfigFileIO');
const OcsUtils    = require('./OcsUtils.js');
//OCS library
const OCS = require('@gov.nasa.jpl.m2020.cs3/ocs-js-client');

/**
 * Definition of the DataDrive Web Socket client
 *
 * @type {DdConfig}
 */
class DdConfig {
    /**
     * @constructor
     * @param {object} program - Command object from Commander library
     * @param {boolean} load_config - Default: true; load configs such as hostnames and csso token; not loading config is used for unit tests
     */
    constructor(program, load_config=true) {
        this.ocsUtils = null
        //lets assume the worst case...
        this.wasConfiguredSuccessfully = false;
        this.ssoTokenApi = undefined;
        this.cssoToken = undefined;
        this.dataDriveHost    = undefined;
        this.pepUrl           = undefined;
        this.ocsHost          = undefined;
        this.ocsAPIDeployment = undefined;

        if (load_config) {
            let ddHost = DdCliConfigFileIO.builder().getDatadriveHost();

            if (! ddHost) {
                DdLogger.error('Missing required configuration: '+DdConsts.PROP_DATADRIVE_HOST);
                DdLogger.error('Please check your configuration via the "dd-config" command.');
                return null;
            }
            let pepHost = DdCliConfigFileIO.builder().getPepHost();
            if (! pepHost) {
                DdLogger.error('Missing required configuration: '+DdConsts.PROP_PEP_HOST);
                DdLogger.error('Please check your configuration via the "dd-config" command.');
                return null;
            }

            this.dataDriveHost    = "https://" + ddHost;
            this.pepUrl           = "https://" + pepHost;

            //Check the environment for the DEBUG state
            let debugEnvVal = DdCliConfigFileIO.builder().getDebugEnabled();
            if (DdUtils.isValueTrue(debugEnvVal))
            {
                DdLogger.setDebugEnabled(true);
            }

            //CSSO token
            this.ssoTokenApi = new SsoToken();
            let token    = this.ssoTokenApi.getToken();
            if (DdUtils.isEmptyOrNullString(token))
            {
                throw Error(`Could not load CSSO credentials/token.`);
            }
            this.cssoToken = token;
        }
    };

    getPepUrl() {
        return this.pepUrl
    }

    getDataDriveHost() {
        return this.dataDriveHost
    }

    getOcsHost() {
        return this.ocsHost
    }

    getOcsUtils() {
        return this.ocsUtils
    }

    //---------------------------------------------------------------------

    setOcsSettings(host, venue) {
        this.ocsHost = host;
        this.ocsAPIDeployment = venue;
    };

    //---------------------------------------------------------------------

    getCssoToken() {
        return this.cssoToken;
    };

    getUserNameFromCssoToken() {
        // Ex: <venue>:<username>:<32 random characters>
        const splits = this.cssoToken.split(":");
        return splits[1];
    }

    reloadCssoToken() {
        this.ssoTokenApi.loadToken();
        let newToken = this.ssoTokenApi.getToken();
        if (newToken === this.cssoToken) {
            DdLogger.info("CSSO token has not changed, NOT reloading...");
            return false
        }
        DdLogger.info("CSSO token has changed, reloading...");
        this.cssoToken = newToken;
        return true
    }

    /**
     * Reload the CSSO Token from .cssotoken folder if ths token is about to expire; default is 1 hour before expiration
     * Note: This actually DOES NOT renew the token for you, unfortunately, right now you have to do that seperately via a cron job.
     * Note: This function also does not reconnect the websocket; this function will return true or false to denote whether or not
     * csso token has been reloaded.
     */
    reloadIfSSOTokenAboutToExpire() {
        if (this.ssoTokenApi.isTokenAboutToExpired()) {
            DdLogger.info("Attempting to reload CSSO token from 'ssosession' file because it is about to expire.");
            return this.reloadCssoToken();
        }
        return false;
    }

    //---------------------------------------------------------------------

    isConfigured() {
        return this.wasConfiguredSuccessfully;
    }

    configured() {
        this.wasConfiguredSuccessfully = true;
    }

    //---------------------------------------------------------------------

    /**
     * Create OCS client object based on ocsHost and ocsAPIDeployment
     */
    createOcsClient()
    {
        //CREATE OCS CLIENT
        let ocsConfig = {
            ocsEndpointHost: this.ocsHost,
            ocsApiStage: this.ocsAPIDeployment
        };

        let ocsClient = new OCS(ocsConfig);
        return ocsClient;
    }

    /**
     * Initialize OCS client and ocsUtils class
     */
    initiate_OcsClient()
    {

        //create an OCS client
        this.ocsClient = this.createOcsClient();

        //create an OCS utils layer
        this.ocsUtils = OcsUtils.builder(this.ocsClient, this.cssoToken)
    }
}

module.exports = DdConfig;
