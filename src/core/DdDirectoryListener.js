
//Libraries
const fs           = require('fs');
const os           = require('os');
const path         = require('path');
const chokidar     = require('chokidar');

//Local imports
const DdLogger     = require('./DdLogger.js').logger;
const DdUtils      = require('./DdUtils.js');
const DdPubConfig  = require('./DdPubConfig.js');



let DdDirectoryListener = (function () {


    //---------------------------------------------------------------------

    /**
     * Constructor.
     *
     * @constructor
     */
    let DdDirectoryListener = function (pubConfig) {
        this._config    = pubConfig;

        this._directory = path.resolve(this._config.sourceDir);

        this._eventCallback = null;
        this._errorCallback = null;

        this._watcher      = null;

    };


    //---------------------------------------------------------------------

    DdDirectoryListener.prototype.setMessageCallback = function(cb) {
        this._eventCallback = cb;
    };

    //---------------------------------------------------------------------

    DdDirectoryListener.prototype.setErrorCallback = function(cb) {
        this._errorCallback = cb;
    };

    //---------------------------------------------------------------------

    DdDirectoryListener.prototype.startSession = function() {
        this.listen();
    };

    //---------------------------------------------------------------------

    DdDirectoryListener.prototype.isActive = function() {
        return (null != this._watcher);
    };

    //---------------------------------------------------------------------

    DdDirectoryListener.prototype.getDirectory = function() {
        return this._directory;
    };


    //---------------------------------------------------------------------



    DdDirectoryListener.prototype.listen = function(url) {

        if (this._watcher) {
            return;
        }

        let that = this;

        this._watcher = chokidar.watch(this._directory, {
            ignored: /[\/\\]\./,
            persistent: true,
            ignoreInitial: true
        });

        if (this._watcher) {
            this._watcher.on('add', function (path) {
                that.handleNewFileEvent(path, false);
            });
            this._watcher.on('change', function (path) {
                that.handleNewFileEvent(path, true);
            });
        }
    };

    //---------------------------------------------------------------------

    DdDirectoryListener.prototype.handleNewFileEvent = function(filepath, changeFlag) {

        if (DdUtils.isEmptyOrNullString(filepath)) {
            return;
        }


        let fullpath = filepath;
        if (! path.isAbsolute(fullpath)) {
            fullpath = path.join(this._directory, filepath);
        }


        if (!this._config.satisfiesFilter(filepath)) {
            return;
        }


        if (this._eventCallback) {
            this._eventCallback(fullpath, changeFlag);
        }
    };

    //---------------------------------------------------------------------

    //---------------------------------------------------------------------
    //---------------------------------------------------------------------

    //Stops the token refresh timer.
    DdDirectoryListener.prototype.cancel = function() {

        //cleanup
        if (this._watcher)
        {
            this._watcher.close();
            this._watcher = null;
        }
    };

    //---------------------------------------------------------------------

    return DdDirectoryListener;

}());

module.exports = DdDirectoryListener;
