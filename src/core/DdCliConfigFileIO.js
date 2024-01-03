/**
 * @author wphyo
 * Created on 1/8/22.
 */
'use strict';


const DdUtils = require('./DdUtils.js');
const jsonTryParse = require('../core/utils').jsonTryParse
const DdLogger = require('./DdLogger.js').logger;
const DdConstants = require('./DdConstants.js');


//required for writing files synchronously
const fs = require('fs');
const fse = require('fs-extra');

//Setup the env config using user home dir

const DD_CFG_FILE = DdUtils.getDdCfgFilepath();

//Setup scripts to be called
const DD_CFG_SCRIPT = "dd-config";

let SINGLETON_INSTANCE = null

class DdCliConfigFileIO {
    constructor() {
        if (SINGLETON_INSTANCE === null) {
            this.__failOnError = true
            this.__cachedConfig = null
            SINGLETON_INSTANCE = this
        }
        return SINGLETON_INSTANCE
    }

    setFailOnError(value) {
        this.__failOnError = value
        return this
    }

    static builder() {
        return new DdCliConfigFileIO()
    }

    /**
     * Tests for existence of DataDrive config file
     * @return {boolean}
     */
    ddCfgFileExists() {
        return DdUtils.fileExists(DD_CFG_FILE)
    }

    readConfig(failOnError = true) {
        if (this.__cachedConfig !== null) {
            return this.__cachedConfig
        }
        if (!this.ddCfgFileExists()) {
            if (failOnError) {
                DdUtils.errorAndExit(`ERROR reading the configuration file ${DD_CFG_FILE}.\nRun '${DD_CFG_SCRIPT}' to save a valid configuration.`);
            }
            return null
        }
        let fileData = null
        try {
            fileData = fs.readFileSync(DD_CFG_FILE, 'utf8')
        } catch (e) {
            if (e.code !== 'ENOENT') {
                if (failOnError) {
                    DdUtils.errorAndExit(`ERROR reading the configuration file ${DD_CFG_FILE}.\n${e}`)
                } else {
                    return null
                }
            }
        }

        let tempConfig = jsonTryParse(fileData)
        if (tempConfig['error'] !== undefined) {
            if (failOnError) {
                DdUtils.errorAndExit(`ERROR reading the configuration file ${DD_CFG_FILE}. Run '${DD_CFG_SCRIPT}' to save a valid configuration.`);
            } else {
                return null
            }
        }
        tempConfig = tempConfig['result']

        // Fill in missing values with NULLs.
        if (!tempConfig.hasOwnProperty(DdConstants.PROP_DATADRIVE_HOST)) {
            tempConfig[DdConstants.PROP_DATADRIVE_HOST] = null;
        }

        if (!tempConfig.hasOwnProperty(DdConstants.PROP_PEP_HOST)) {
            tempConfig[DdConstants.PROP_PEP_HOST] = null;
        }

        this.__cachedConfig = tempConfig;

        return this.__cachedConfig;
    }

    /**
     * This only writes DataDrive specific configuration, ignoring
     * anything that is for OCS.
     */
    writeConfig(opt) {
        //don't fail if file does not already exist, but check for null
        let _cfg = this.readConfig(false);
        if (!_cfg) {
            _cfg = {};
        }
        // Overwrite the current configuration with the supplied values.
        if (opt.datadriveHost || opt.pepHost) {
            if (opt.datadriveHost) {
                _cfg[DdConstants.PROP_DATADRIVE_HOST] = opt.datadriveHost;
            }
            if (opt.pepHost) {
                _cfg[DdConstants.PROP_PEP_HOST] = opt.pepHost;
            }
        }
        // Write to the config file.
        try {
            console.log(DD_CFG_FILE, _cfg)
            fse.outputFileSync(DD_CFG_FILE, JSON.stringify(_cfg, null, 2))
        } catch (error) {
            DdUtils.errorAndExit(`Unable to write to the DataDrive configuration file ${DD_CFG_FILE}. Make sure that the path exists and that the directory is accessible to the logged in user.`)
        }
        this.__cachedConfig = _cfg
    }

    getConfigValue(cfgName) {
        let cfg = this.readConfig(this.__failOnError);
        if (cfg[cfgName] !== undefined) {
            return cfg[cfgName]
        }
        return null
    }

    /**
     * Get environment variable value
     * @param {string} envName
     */
    getEnvValue(envName) {
        if (envName in process.env) {
            return process.env[envName]
        }
        return null
    }

    getDatadriveHost() {
        return this.getEnvValue(DdConstants.ENV_DATADRIVE_HOST) || this.getConfigValue(DdConstants.PROP_DATADRIVE_HOST);
    }

    getPepHost() {
        return this.getEnvValue(DdConstants.ENV_PEP_HOST) || this.getConfigValue(DdConstants.PROP_PEP_HOST);
    }

    getDebugEnabled() {
        return this.getEnvValue(DdConstants.ENV_DEBUG_ENABLED) || this.getConfigValue(DdConstants.PROP_DEBUG_ENABLED);
    }
}

exports.DdCliConfigFileIO = DdCliConfigFileIO
