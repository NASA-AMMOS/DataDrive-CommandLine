const fs           = require('fs');
const path         = require('path');
const globToRegExp = require('glob-to-regexp');
const DdUtils    = require('./DdUtils.js');
const DdLogger   = require('./DdLogger.js').logger;
const DdConfig   = require('./DdConfig.js');

/**
 * Definition of the DataDrive Config Class
 *
 * @type {DdSubConfig}
 */
class DdSubConfig extends DdConfig {
    /**
     * @constructor
     * @param {object} program - Command object from Commander library
     * @param {boolean} load_config - Default: true; load configs such as hostnames and csso token; not loading config is used for unit tests
     */
    constructor(program, load_config=true) {
        super(program, load_config=load_config);
        this.validateOptions(program);
        this.processOptions(program);
    };

    //---------------------------------------------------------------------

    //Replaces parseArgv now that we are using the Commander for options processing

    /**
     * Process options from Command object from Commander library
     * @param {object} program - object from the commander library
     */
    processOptions(program) {
        this.packageName           =  program.packageName;
        this.outputDir             =  program.outputDir;
        // file path for location we are tracking the checkpoint file
        this.checkpointPath        =  `${this.outputDir}/.datadrive/checkpoint.txt`;
        // file path for location we are tracking the package name file of last time CLI was run
        this.savedPackageNamePath  =  `${this.outputDir}/.datadrive/packagename.txt`;
        // file path for location we are tracking the saved search name file of the last time CLI was run
        this.savedSavedSearchNamePath = `${this.outputDir}/.datadrive/savedsearchname.txt`;
        this.fileWildcard          =  program.filter;
        this.fileWildcardRegexObj  =  globToRegExp(this.fileWildcard);
        this.retainPath            =  program.retainPath || false;
        this.playback              =  program.playback || false;
        this.overwrite             =  program.overwrite || false;
        this.disableDownload       =  program.disableDownload || false;
        this.skipUnchanged         =  program.skipUnchanged || false;

        // this.pluginsAsync       =  program.pluginsAsync || false;
        // this.pluginsDir            =  program.pluginsDir;
        this.pluginPath            =  program.pluginPath;

        this.packageId             =  null; //will get populated later

        //examine glob to make filter decisions
        this.filterIncludesPath    = program.includeFullPath || false
        this.fileRegex             =  program.regex;
        this.fileRegexObj          =  this.fileRegex ? new RegExp(this.fileRegex) : undefined;

        //saved search
        this.savedSearchName       =  program.savedSearchName;
        this.savedSearchType       =  "personnel";

        super.configured();
    };

    /**
     * Ensure options do not break rules specified in this function
     * @param {object} program
     */
    validateOptions(program) {
        return // no rules specified yet
    };

    /**
     * Ensure configs do not break rules specified in this function
     * @returns {Promise} Promise object represents a boolean
     */
    async validateConfigs() {
        if (this.disableDownload && this.pluginPath === undefined) {
            DdUtils.errorAndExit('Disable download option enabled but missing plugin path option.');
        }

        // default will be package name; meaning if you specify a package name, it will go down this code path
        if (this.packageName) {
            if (this.fileRegex !== undefined && this.fileWildcard !== '*') {
                DdUtils.errorAndExit('Please specify only 1 filter option; regex or wildcard.');
            }
            if (this.savedSearchName !== undefined) {
                DdUtils.errorAndExit('Cannot specify a saved search and package name together.');
            }
            await this.validateFolderStateFile(this.savedPackageNamePath, this.savedSavedSearchNamePath, this.packageName)
            return true;
        }
        if (this.savedSearchName) {
            await this.validateFolderStateFile(this.savedSavedSearchNamePath, this.savedPackageNamePath, this.savedSearchName);
            return true;
        }
        DdUtils.errorAndExit('Please specify a package name or a saved search name.');
    };

    /**
     * Verifies that the specified filename that should exist (packagename.txt or savedsearchname.txt) exists and one that shouldn't does not
     * @param {String} filenameShouldExist
     * @param {String} filenameShouldNotExist
     * @param {String} name
     */
    async validateFolderStateFile(filenameShouldExist, filenameShouldNotExist, name) {
        // if there is savedsearchname.txt file, we should immediately exist as this folder is for saved search
        if (fs.existsSync(filenameShouldNotExist)) {
            DdUtils.errorAndExit(`There is a ${filenameShouldNotExist} file in this folder. Exiting.`);
        }
        // make sure there is not a packagename.txt file or if there is, the package name matches this.PackageName
        if (fs.existsSync(filenameShouldExist)) {
            let file = await DdUtils.readFile(filenameShouldExist);
            if (name !== file.trim()) {
                DdUtils.errorAndExit(`Package name or saved search name specified (${name}) is not the same as the one specified in ${filenameShouldExist}.`);
            }
        }
    }

    /**
     * Returns a full output path for a given filename,
     * prepending the config-held output directory.
     *
     * @param {string} filepath Relative file path (can be empty)
     * @param {string} filename File name
     * @return (string} Full path or null if missing required
     *                  information
     */

    getOutputLocation(filepath, filename)
    {
        let _outputDir = this.outputDir;
        if (DdUtils.isEmptyOrNullString(_outputDir))
            return null;

        //assume filepath is empty and filename goes directly
        //into outputDir.  But if filepath is non-empty,
        //apprend it.
        let _parentPath = _outputDir;
        if (!DdUtils.isEmptyOrNullString(filepath))
            _parentPath = path.join(_outputDir, filepath);

        //now combine out parent path with filename for final result
        const _outFilepath = path.join(_parentPath, filename);

        return _outFilepath;
    };

    /**
     * Returns a full output path for a given file metadata object,
     * prepending the config-held output directory.
     *
     * @param {OCS filemetadata} fileMetadata OCS file metadata object
     * @return (string} Full path or null if missing required
     *                  information
     */

    getOutputLocationViaMetadata(fileMetadata)
    {
        if (fileMetadata == null ||
              ! (fileMetadata.hasOwnProperty('ocs_path') &&
                 fileMetadata.hasOwnProperty('ocs_name')))
            return null;

        let filename = fileMetadata.ocs_name;
        let relativePath = (this.retainPath) ? fileMetadata.ocs_path : null;
        let outFilepath = this.getOutputLocation(relativePath, filename);

        return outFilepath;
    };


    satisfiesFilter(fullpath)
    {
        //Assume fullpath is target, but if filter
        //is pathless, then just look at the basename?
        var target = fullpath;
        if (!this.filterIncludesPath)
        {
            var basename = DdUtils.extractFilenameFromUrl(fullpath);
            target = basename;
        }

        if (this.fileRegexObj) {  // always do user given regex first and then wildcard
            return DdUtils.filterFilePath(target, this.fileRegexObj);
        }
        else if (this.fileWildcardRegexObj) {
            return DdUtils.filterFilePath(target, this.fileWildcardRegexObj);
        }
        else {
            return false;
        }
    }
}

module.exports = DdSubConfig;
