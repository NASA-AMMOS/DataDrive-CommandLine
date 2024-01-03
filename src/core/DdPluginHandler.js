const { FileMetadata }  = require('./DdFileMetadata.js');
const fs                = require('fs');
const path              = require('path');
const DdLogger          = require('./DdLogger.js').logger;
const DdSubConfig       = require('./DdSubConfig');
const DdPlugin          = require('./DdPlugin.js');
const DdUtils           = require('./DdUtils.js');
const _                 = require('lodash');


class PluginHandler {
    /**
     * Fires a single plugin.
     * @param {DdSubConfig} config 
     */
    constructor(config) {
        this.dict = {};
        this.config = config;
        // Default plugins directory
        if (!this.config.disableDownload) {
            this.dict['FileDownloader'] = require('../plugins/FileDownloaderPlugin.js');
        }
        // Custom plugins directory
        if (this.config.pluginPath) {
            this.dict['CustomPlugin'] = load_plugin(DdUtils.ensureAbsolutePath(this.config.pluginPath));
        }
    }

    /**
     * If plugin option is enabled, call every plugins in "plugins" folder's "processItem" function
     * @param {FileMetadata} metadata 
     */
    async callProcessItem(metadata) {
        for (let key in this.dict) {
            try {
                let config = _.cloneDeep(this.config);  // Objects in JS is pass by reference; deep copy config so plugins cannot mess with upper level DdSubConfig class
                let plug = new this.dict[key](config);
                DdLogger.debug(`calling ${key}`);
                await plug.processItem(metadata);
                DdLogger.debug(`called ${key}`);
            } catch (error) {
                DdLogger.error(`An error occurred when invoking function processItem for ${key}`);
                DdLogger.error(error.message);
                DdLogger.debug(error.stack);
            }
        }
        // await Promise.all(result);
    }
    // TODO: Look into adding checks to ensure each plugin is correct
}

class MultiPluginHandler {
    /**
     * Fires plugins synchronously based on a given folder; Currently runs them randomly, need ordering if this eventually becomes a production feature.
     * @param {DdSubConfig} config 
     */
    constructor(config) {
        this.dict = {};
        this.config = config;
        // Default plugins directory
        // load_plugins(this.dict, path.join(process.cwd(), 'plugins'));
        if (!this.config.disableDownload) {
            this.dict['FileDownloader'] = load_plugin(path.join(process.cwd(), 'plugins', 'FileDownloaderPlugin.js'));
        }
        // Custom plugins directory
        if (this.config.pluginsDir) {
            load_plugins(this.dict, DdUtils.ensureAbsolutePath(this.config.pluginsDir));
        }
    }

    /**
     * If plugin option is enabled, call every plugins in "plugins" folder's "processItem" function
     * @param {FileMetadata} metadata 
     */
    async callProcessItem(metadata) {
        // let result = []
        for (let key in this.dict) {
            try {
                let config = _.cloneDeep(this.config);  // Objects in JS is pass by reference; deep copy config so plugins cannot mess with upper level DdSubConfig class
                let plug = new this.dict[key](config);
                DdLogger.debug(`calling ${key}`);
                await plug.processItem(metadata);
                DdLogger.debug(`called ${key}`);
                // result.push(plug.processItem(metadata));
            } catch (error) {
                DdLogger.error(`An error occurred when invoking function processItem for ${key}`);
                DdLogger.error(error);
            }
        }
        // await Promise.all(result);
    }
    // TODO: Look into adding checks to ensure each plugin is correct
}

/**
 * @param {string} pluginPath
 */
let load_plugin = (pluginPath) => {
    try {
        let cls = require(pluginPath);
        if (cls.prototype instanceof DdPlugin) {
            return cls;
        }
        else {
            throw new Error(`Plugin does not inherit from Plugin class.`);
        }
    } catch (error) {
        DdUtils.errorAndExit(error);
    }
};

/**
 * @param {Object} dict
 */
let load_plugins = (dict, pluginsDir) => {
    try {
        let plugins = fs.readdirSync(pluginsDir);
        for (let plugin of plugins) {
            let cls = require(path.join(pluginsDir, plugin));
            if (cls.prototype instanceof DdPlugin) {
                dict[plugin] = cls
            }
            else {
                throw new Error(`Plugin ${plugin} does not inherit from Plugin class.`);
            }
        }
    } catch (error) {
        DdUtils.errorAndExit(error);
    }
};

module.exports = {
    'PluginHandler': PluginHandler,
    'MultiPluginHandler': MultiPluginHandler,
};