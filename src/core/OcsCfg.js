import {jsonTryParse} from "./utils";

const fs = require('fs');
const os = require('os');
const path = require('path');

const DdConsts = require('./DdConstants.js');
const SsoToken = require('./SsoToken.js');
const DdUtils = require('./DdUtils.js');
const DdLogger = require('./DdLogger.js').logger;
const DEFAULT_CWD = '/'

class OcsConfig {
    constructor() {
        this.__ocsConfigFile = DdUtils.getOcsCfgFilepath()
        this.__cachedConfig = null
    }

    ocsCfgFileExists() {
        return DdUtils.fileExists(this.__ocsConfigFile)
    }

    __loadOcsConfig(ocsConfigData) {
        const nullConfig = {
            ocsEndpointHost: null,
            ocsApiStage: null,
            pkg: null,
            cwd: DEFAULT_CWD,
        }
        this.__cachedConfig = {...nullConfig, ...ocsConfigData}
    }

    getOcsConfig(failOnError=true) {
        if (this.__cachedConfig !== null) {
            return this.__cachedConfig
        }
        if (!this.ocsCfgFileExists()) {
            if (failOnError) {
                DdUtils.errorAndExit(`ERROR reading the configuration file ${this.__ocsConfigFile}.\nRun the OCS configuration command to save a valid configuration.`)
            }
            return null
        }

        let _fileCfg = {}; // Config as read from the file.

        // Read the metadata.
        try {
            const _data = fs.readFileSync(this.__ocsConfigFile, 'utf8')
            const jsonData = jsonTryParse(_data)
            if (jsonData['error'] !== undefined) {
                if (failOnError) {
                    DdUtils.errorAndExit(`ERROR reading the OCS configuration file ${OCS_CFG_FILE}. Run the OCS configuration command to save a valid configuration.`);
                }
                return null
            }
            this.__loadOcsConfig(jsonData['result'])
            return this.__cachedConfig
        } catch (error) {
            if (error.code !== 'ENOENT') {
                if (failOnError) {
                    DdUtils.errorAndExit(`ERROR reading the OCS configuration file ${OCS_CFG_FILE}.\n${error}`);
                }
                return null
            }
        }
    }
}

module.exports = OcsConfig;
