const fs = require('fs');
const request = require('request');
const {FileMetadata} = require('../core/DdFileMetadata.js');
const DdUtils = require('../core/DdUtils.js');
const DdLogger = require('../core/DdLogger.js').logger;
const DdPlugin = require('../core/DdPlugin.js');
const DdSubConfig = require('../core/DdSubConfig.js');
const {CannotWriteToLocalFileError} = require('../core/DdError.js');
const {EmptyPromise} = require('../core/EmptyPromise')

class FileDownloader extends DdPlugin {
    /**
     * Constructor for FileDownloader
     * @param {typeof DdSubConfig} config
     */
    constructor(config) {
        super();
        this.config = config;
    }

    /**
     *
     * @param {FileMetadata} item
     */
    async processItem(item) {
        DdLogger.info(`${item['ocs_full_name']} was called in FileDownloader`);
        try {
            await this.downloadFileFromMetadata(item);
        } catch (e) {
            DdLogger.error(`failed to download file: error: ${e.toString()}`)
        }
    }

    /**
     * Initiates a file download from extracting the
     * OCS-epecific download URL from the OCS file
     * metadata.
     *
     * @param {FileMetadata} ocsFileMetadata
     */
    async downloadFileFromMetadata(ocsFileMetadata) {
        DdLogger.debug("Called downloadFileFromMetadata");
        if (!ocsFileMetadata) {
            throw new Error('downloadFileFromMetadata: empty file metadata')
        }
        //get the standard OCS metadata we care about
        let ocsDownloadUrl = ocsFileMetadata['download_url'];
        let ocsLogicalUrl = ocsFileMetadata['ocs_url'];
        let ocsPath = ocsFileMetadata['ocs_path'];
        let ocsName = ocsFileMetadata['ocs_name'];
        let ocsModTimestamp = ocsFileMetadata['ocs_updated_at'];
        let filename     = ocsName;
        let relativePath = this.config.retainPath ? ocsPath : ''
        let outFilepath   = this.config.getOutputLocation(relativePath, filename);
        if (!DdUtils.canWriteToLocalFile(outFilepath, this.config)) {
            throw new CannotWriteToLocalFileError(`Overwrite setting not enabled cannot write to ${outFilepath}`)
        }
        DdLogger.debug("Downloading "+ocsDownloadUrl+" to "+outFilepath);
        //subConfig.printDebug("Downloading "+ocsDownloadUrl+" to "+outFilepath);
        DdUtils.ensureDirectory(outFilepath);
        const file = fs.createWriteStream(outFilepath, { flags: 'w' });
        const downloadRequestPromise = EmptyPromise.builder()
        request({
            method: 'GET',
            url: ocsDownloadUrl,  // Note: This requires PEP in order to generate a download URL
            headers: {
                Cookie: `ssosession=${this.config.cssoToken}`,
            },
            followRedirect: true,
            gzip: true,
            timeout: 60 * 1000,
            time: true,
        })
        .on('response', function(resp) {
            // resp.pause();
            if (!DdUtils.validHTTPResponse(resp)) {
                DdLogger.error("Error occurred when using PEP.")
                // throw new Error(`Invalid HTTP response status code from PEP: ${resp.statusCode}`)
                downloadRequestPromise.reject(`Invalid HTTP response status code from PEP: ${resp.statusCode}`)
            }
        })
        .pipe(file)
        .on('finish', () => {
            DdLogger.info("File downloaded: "+outFilepath);
            downloadRequestPromise.resolve()
        })
        .on('error', (err) => {
            DdLogger.printError(err);
            DdLogger.error("Error occurred while downloading file: "+ocsDownloadUrl)
            downloadRequestPromise.reject(`download file failed: ${err.toString()}`)
            // throw err
        })
        // .catch(err => {
        //     downloadRequestPromise.reject(`download file failed: ${err.toString()}`)
        //     DdLogger.error(`failed to download file: ${err}`)
        // })
        await downloadRequestPromise.get()
    }
}

module.exports = FileDownloader;
