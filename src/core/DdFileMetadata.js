const moment   = require('moment');
const DdConsts = require('./DdConstants.js');

/**
 * @typedef {Object} OCSPathObj
 * @property {string} ocs_path
 * @property {string} ocs_name
 */

/**
 * Splits ocs_full_name into ocs_path and ocs_name
 * Ex: /jeff/Slowpoke.gif to "/jeff" and "Slowpoke.gif"
 * @param {string} ocs_full_name
 * @returns {OCSPathObj}
 */
function getOCSPathObj(ocs_full_name) {
    let splits = ocs_full_name.split("/");
    let ocs_name = splits[splits.length - 1];
    let ocs_path_end_index = ocs_full_name.indexOf(ocs_name) - 1;
    let ocs_path = ocs_full_name.substring(0, ocs_path_end_index);
    return {'ocs_name': ocs_name, 'ocs_path': ocs_path};
}

class FileMetadata {
    constructor() {
        /** @type {Date} */
        this.ocs_updated_at = undefined;
        /** @type {string} */
        this.ocs_full_name = undefined;
        /** @type {string} */
        this.ocs_dataset_id = undefined;
        /** @type {string} */
        this.ocs_package_id = undefined;
        /** @type {string} */
        this.ocs_url = undefined;
        /** @type {string} */
        this.ocs_path = undefined;
        this.ocs_name = undefined;
        /** @type {string} */
        this.ocs_owner = undefined;
        /** @type {string} */
        this.download_url = undefined;
        /** @type {string} */
        this.event_type = undefined;
    }

    getOcsUpdatedAt() {
        return this.ocs_updated_at
    }

    getOcsName() {
        return this.ocs_name
    }

    /**
     * Converts JSON object into FileMetadata object that is common amongst events
     * @param {object} json
     */
    unmarshall(json) {
        this.ocs_full_name = json.ocs_full_name;
        this.ocs_url = json.ocs_url;
        this.download_url = json.ocs_download_url;
        this.getOCSPathObj = getOCSPathObj(this.ocs_full_name);
        this.ocs_path = this.getOCSPathObj.ocs_path;
        this.ocs_name = this.getOCSPathObj.ocs_name;
    }

    /**
     * Converts OCS event JSON object into FileMetadata object; this is to make type checking easier during development
     * @param {object} json
     */
    unmarshallOCS(json) {
        this.unmarshall(json);
        this.ocs_updated_at = json.package_dataset_event_time ? moment(json.package_dataset_event_time).toDate() : undefined;
        this.ocs_dataset_id = json.dataset_id;
        this.ocs_package_id = json.package_id;
        this.event_type = DdConsts.EVENTTYPE_OCS;
    }

    /**
     * Converts DataDrive PLAYBACK event JSON object into FileMetadata object; this is to make type checking easier during development
     * @param {object} json
     */
    unmarshallPlayback(json) {
        this.unmarshall(json);
        this.ocs_updated_at = json.ocs_updated_at ? moment(json.ocs_updated_at).toDate() : undefined;
        this.ocs_dataset_id = json.ocs_dataset_id;
        this.ocs_package_id = json.ocs_package_id;
        this.ocs_owner = json.ocs_owner;
        this.event_type = DdConsts.EVENTTYPE_PLAYBACK;
    }
}

module.exports = {
    "FileMetadata": FileMetadata
};
