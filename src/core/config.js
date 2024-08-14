const fs = require("fs");
const OsLib = require("os");
const PathLib = require("path");
const DdConstants = require("./DdConstants.js");

function getCfgFilepath() {
    let HOME = OsLib.homedir();
    let SEP = PathLib.sep;
    let CFG_FILE = `${HOME}${SEP}${DdConstants.CFG_FILEDIR}${SEP}${DdConstants.CFG_FILENAME}`;

    return CFG_FILE;
}

function getConfig() {
    const cfgPath = getCfgFilepath();
    let cfgFile;
    try {
        cfgFile = fs.readFileSync(cfgPath);
    } catch (e) {
        throw new Error(
            `Unable to read updated DataDrive configuration file at path: ${cfgPath}. You may need to initialize a new configuration using ddrv-config.`,
        );
    }

    try {
        config = JSON.parse(cfgFile);
        config.logdir = config.logdir || DdConstants.DEFAULT_LOG_PATH;
        config.venue = config.venue || DdConstants.DEFAULT_VENUE;
        return config;
    } catch (e) {
        if (ignoreErrors) return {};
        throw new Error(`Error parsing config file. Is it valid JSON?`);
    }
}

let config;
try {
    config = getConfig();
} catch (e) {}

module.exports = {
    getConfig,
    config,
};
