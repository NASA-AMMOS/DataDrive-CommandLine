// Create a Datadrive/OCS subscription session by:
//
// 1) Using OCS Client, get the packageId associated with the
//    packageName argument passed to us.
//
// 2) Using WebSockets, connect to DataDrive middleware layer for
//    notifications on newly indexed objects for the packageId.
//
// 3) Using OCS Client, respond to each WS event by querying OCS
//    for that file's details, including a downloadable URL.
//
// 4) Use that download URL to perform the actual download
//    of the file to this system, into the outputDir.
//
//
// Arguments:  --packageName packagenameWeSubscribeTo          [Required]
//             --outputDir   directoryToWhichFilesWillBeSaved  [Required]
//             --filter      wildcard-glob-expression          [Optional]
//             --retainPath                                    [Optional]
//

//Node library imports

const fs = require("fs");
const util = require("util");
const path = require("path");
const moment = require("moment");
const { FileMetadata } = require("./core/DdFileMetadata.js");
const { Command, Option } = require("commander");
const program = new Command();
const Validator = require("jsonschema").Validator;

//local imports
const DdConsts = require("./core/DdConstants.js");
const DdUtils = require("./core/DdUtils.js");
const { DataDriveWsClient } = require("./core/DdWsClient.js");
const DdSubConfig = require("./core/DdSubConfig.js");
const DdOptions = require("./core/DdOptions.js");
const DdLogger = require("./core/DdLogger.js").logger;
const {
    DataDriveMWServiceSettings,
} = require("./core/DataDriveMWServiceSettings");
const { Processor, Queue } = require("./core/DdQueue.js");
const {
    QueueEmptyError,
    MaxProcessSizeError,
    CannotWriteToLocalFileError,
} = require("./core/DdError.js");
const DdPluginHandler = require("./core/DdPluginHandler.js").PluginHandler;
const { EmptyPromise } = require("./core/EmptyPromise");
const config = require("./core/config.js").config;
const SsoToken = require("./core/SsoToken.js");
const utils = require("./core/utils.js");
const ocs_utils = require("./core/ocs_utils.js");
const ws_utils = require("./core/websocket_utils.js");

const CSSO_RELOAD_ATTEMPT_INTERVAL_MS = 1000; // 1s
const CHECKPOINT_FILE_PATH = ".datadrive/checkpoint.txt";

//------------------------------------------------

async function checkpointFileWriter(checkpointData, checkpointFilePath) {
    return await fs.promises.writeFile(
        checkpointFilePath,
        JSON.stringify(checkpointData),
    );
}

async function writeCheckpoint(options, datetime = new Date()) {
    // Verfiy the checkpoint file exists, create it if not.
    const checkpointData = {
        datetime: datetime.toISOString(),
    };

    if (options.packageInfo) {
        checkpointData.package_name = options.packageName;
    } else if (options.savedSearchName) {
        checkpointData.saved_search_name = options.savedSearchName;
    }

    const checkpointFilePath = `${options.outputDir}/${CHECKPOINT_FILE_PATH}`;

    try {
        await fs.promises.mkdir(path.dirname(checkpointFilePath));
    } catch (e) {
        if (e.code !== "EEXIST") {
            DdLogger.error(
                `Unable to write checkpoint file to path ${checkpointFilePath}. Check that you have permission to write to this location.`,
            );
            return;
        }
    }

    try {
        await checkpointFileWriter(checkpointData, checkpointFilePath);
        return;
    } catch (e) {
        if (e.code !== "ENOENT") {
            DdLogger.error(
                `Unable to write checkpoint file to path ${checkpointFilePath}. Check that you have permission to write to this location.`,
            );
            return;
        }
    }

    // If we get to this point, it's because the checkpoint file doesn't exist yet

    // Create checkpoint dir
    try {
        await fs.promises.mkdir(path.dirname(checkpointFilePath), {
            recursive: true,
        });
    } catch (e) {
        DdLogger.error(
            `Unable to write checkpoint file to path ${checkpointFilePath}. Check that you have permission to write to this location.`,
        );
        return;
    }

    // Write checkpoint file
    console.log("writing checkpoint");
    try {
        checkpointFileWriter(checkPointData, checkpointFilePath);
    } catch (e) {
        DdLogger.error(
            `Unable to write checkpoint file to path ${checkpointFilePath}. Check that you have permission to write to this location.`,
        );
        return;
    }
}

async function readCheckpoint(options) {
    const checkpointFilePath = `${options.outputDir}/${CHECKPOINT_FILE_PATH}`;
    try {
        const res = await fs.promises.readFile(checkpointFilePath, "utf-8");
        return JSON.parse(res);
    } catch (e) {
        return null;
    }
}

// Basic checks for user-inputted options before we get started
function validateOptions(options = {}) {
    const errors = [];

    // Does the output dir exist?
    if (!fs.existsSync(options.outputDir)) {
        msg = `Output directory ${options.outputDir} not found. Please create it before starting a subscription.`;
        errors.push(msg);
    }

    if (errors.length) {
        const outMsg = errors.join("\n");
        return DdUtils.errorAndExit(outMsg);
    }

    return options;
}

function getArgs() {
    program
        .option("-p, --package-name [pkg name]", "The name of the package.")
        .requiredOption(
            "-o, --output-dir   <output dir>",
            "The output directory.",
        )
        .addOption(
            new Option(
                "-f, --filter [value]",
                "A wildcard expression to filter files based on OCS Full Name.",
            ).conflicts("regex"),
        )
        .addOption(
            new Option(
                "-x, --regex [value]",
                "A regex expression to filter files based on OCS Full Name. Please reference https://www.elastic.co/guide/en/elasticsearch/reference/6.4/query-dsl-regexp-query.html#regexp-syntax and NodeJS RegExp.",
            ).conflicts("filter"),
        )
        .option(
            "-s, --saved-search-name [value]",
            "Name of your personal saved search.",
        )
        .option(
            "-r, --retain-path",
            "Use the S3 path as relative path when writing files",
        )
        .option(
            "-P, --playback",
            "Get events that has since happened after the last downloaded file.",
        )
        .option(
            "-if, --include-full-path",
            "If filter and regex expressions include only the name or the full path. defaulted to `NO`.",
        )
        .option(
            "-O, --overwrite",
            "Overwrite file if it already exists in that path.",
        )
        .option(
            "-S, --skip-unchanged",
            "Only download files that are new or have changed.",
        )
        .option(
            "--plugin-path [value]",
            "Path to the custom plugin file that implements class DdPlugin.",
        )
        .option(
            "--disable-download",
            "Disable downloading of files. Make sure to still include an output-dir option.",
        )
        .option(
            "-l --logdir [logdir]",
            `Directory to store log files. Default is current directory.`,
        )
        .option(
            "--log-date-pattern [log-date-pattern]",
            "Turns on log rolling using the specified format. Options are: monthly, weekly, daily. This option can also accept a custom format (more info: https://momentjs.com/docs/#/displaying/format/). This format will define the frequency of the log rotation, with the logs rotating on the smallest date/time increment specified in the format.",
        );

    program.parse();
    return validateOptions(program.opts());
}

// Creates a JSON schema validator we can use to check if incoming WS messages are relevant
function createMessageValidator() {
    const validator = new Validator();
    validator.addSchema(ocs_utils.OCS_ERR_SCHEMA, "/OCSError");
    validator.addSchema(ocs_utils.DD_UPLOAD_STATUS_SCHEMA, "/OCSUploadStatus");
    validator.addSchema(ocs_utils.OCS_MESG_SCHEMA, "/OCSMessage");
    validator.addSchema(
        ocs_utils.DD_SAVED_SEARCH_MESG_SCHEMA,
        "/OCSSavedSearchMessage",
    );
    return validator;
}

// Validates that the incoming message is valid and is of a message type we care about
function validateWSMessage(options, msgValidator, msg) {
    // Ignore if this is an upload message
    if (msgValidator.validate(msg, ocs_utils.DD_UPLOAD_STATUS_SCHEMA).valid) {
        DdLogger.debug(
            `WS::HandleMessage: Receieved DataDrive Upload Message: ${JSON.stringify(
                msg,
            )}`,
        );
        return;
    }

    // Ignore if it's an error message
    if (msgValidator.validate(msg, ocs_utils.OCS_ERR_SCHEMA).valid) {
        return;
    }

    // Check that it's an OCS message in an expected format
    let res = msgValidator.validate(msg, ocs_utils.OCS_MESG_SCHEMA).valid;
    if (!res) {
        DdLogger.error(
            "WS::HandleMessage: Could not validate WS-based OCS message: " +
                msg,
        );
        DdLogger.error("WS::HandleMessage: More info: " + res);
        return;
    }

    // If this is a saved search, check that this is a saved-search related message
    if (options.savedSearchName) {
        res = msgValidator.validate(
            msg,
            ocs_utils.DD_SAVED_SEARCH_MESG_SCHEMA,
        ).valid;
        if (!res) {
            DdLogger.debug(
                "Saved search message received but message format is not valid: " +
                    JSON.stringify(msg),
            );

            return;
        }
    }

    const fileChanged = Object.keys(msg).includes("s3_object_changed")
        ? msg.s3_object_changed
        : true;
    DdLogger.debug(
        `Event[${msg.package_dataset_event}] Dataset: ${msg.dataset_id}; Package: ${msg.package_id}; Name: ${msg.ocs_full_name}; URL: ${msg.ocs_url}.; Changed: ${fileChanged}`,
    );

    // Check that there's enough information in the message to do something with, bail if not
    const requiredKeys = [
        "package_id",
        "dataset_id",
        "package_dataset_event",
        "ocs_url",
        "ocs_full_name",
    ];

    if (requiredKeys.some((key) => !msg[key])) {
        DdLogger.error("Message was missing required attributes.");
        DdLogger.debug(`${JSON.stringify(wsOcsObject)}`);
        return;
    }

    return msg;
}

// Filters valid websocket messages to get only the ones this subscription cares about
function filterWSMessage(options, msg) {
    // If this is a packaged-based subscription, check if this is in the package we are looking at
    if (options.packageInfo) {
        if (!options.packageInfo.package_id === msg.package_id) {
            DdLogger.debug(
                `Message received is for package ${msg.package_id} but selected package is ${options.packageInfo.package_id}`,
            );
            return;
        }

        const filename = ocs_utils.getFilenameFromOCSURL(msg.ocs_full_name);

        // Skip hidden files
        if (filename.startsWith(".")) {
            DdLogger.debug(
                `Update is for hidden file: ${msg.ocs_full_name}. Skipping...`,
            );
            return;
        }

        // Apply any/all user-provided filters
        if (options.filter) {
            // https://stackoverflow.com/questions/52143451/javascript-filter-with-wildcard
            let filterString = options.filter.replace(
                /[.+?^${}()|[\]\\]/g,
                "\\$&",
            );
            filterString = "^" + filterString.replace(/\*/g, ".*") + "$";
            const filterRegexp = new RegExp(filterString);

            const searchText = options.includeFullPath
                ? msg.ocs_full_name
                : filename;
            let res = filterRegexp.test(searchText);
            if (!res) {
                DdLogger.debug(
                    `Filename ${searchText} fails test against filter: ${options.filter}.`,
                );

                return;
            }
        }

        if (options.regex) {
            // Anchor both ends of regexp to match how it's done in Lucene (ES)
            let regexpString = options.regex.startsWith("^")
                ? options.regex
                : "^" + options.regex;
            regexpString = regexpString.endsWith("$")
                ? regexpString
                : regexpString + "$";

            const userRegexp = new RegExp(regexpString);
            const searchText = options.includeFullPath
                ? msg.ocs_full_name
                : filename;
            res = userRegexp.test(searchText);
            if (!res) {
                DdLogger.debug(
                    `Filename ${searchText} fails test against regexp: ${options.regex}`,
                );

                return;
            }
        }
    } else if (options.savedSearchName) {
        // Verify that this saved search is the one we are looking for (should always be the case!)
        if (msg.ss_name !== options.savedSearchName) {
            DdLogger.debug(
                `Got a message belonging to saved search ${msg.ss_name} but we are subscribed to ${options.savedSearchName}!`,
            );
            return;
        }
    }
    return msg;
}

async function downloadFileAndUpdateCheckpoint(ocsClient, options, fileData) {
    /// Determine the local output path
    const destPath = path.join(
        options.outputDir,
        options.retainPath
            ? fileData.ocs_full_name
            : ocs_utils.getFilenameFromOCSURL(fileData.ocs_full_name),
    );

    // Handle various config options
    if (options.skipUnchanged) {
        let file_changed = Object.keys(fileData).includes("s3_object_changed")
            ? fileData.s3_object_changed
            : true;

        let fileExists;
        try {
            fileExists = !(await fs.promises.access(destPath));
        } catch (e) {
            fileExists = false;
        }

        // if (fileExists) {
        //  const hash = await utils.getFileHash(destPath);
        //  fileChanged = hash !== fileData.ocs_etag;
        // }

        if (fileExists && !file_changed) {
            DdLogger.info(
                `File at path ${fileData.ocs_full_name} updated but not changed.`,
            );
            return;
        }
    }

    if (options.disableDownload) {
        DdLogger.info(
            `File at path ${fileData.ocs_full_name} updated, skipping download...`,
        );
        return;
    }

    // Kick file info out to download/save process
    let max_tries = 3;
    for (let i = 0; i <= max_tries; i++) {
        if (i === max_tries) {
            DdLogger.error(
                `Tried 3 times to download file at ${destPath} but hash was incorrect each time, giving up...`,
            );
            break;
        }
        try {
            await ocs_utils.downloadFileFromMetadata(
                ocsClient,
                fileData,
                destPath,
                options.overwrite,
            );
            break;
        } catch (e) {
            DdLogger.error(e.message);
            continue;
        }
    }

    // Update the checkpoint file
    await writeCheckpoint(options);
}

async function wsMessageHandler(ocsClient, msg, options, msgValidator) {
    const validatedMsg = validateWSMessage(options, msgValidator, msg);
    if (!validatedMsg) return;

    const filteredMsg = filterWSMessage(options, msg);
    if (!filteredMsg) return;

    await downloadFileAndUpdateCheckpoint(ocsClient, options, msg);
}

async function startPlayback(ocsClient, options) {
    // Get playback query results from MW using the last stored checkpoint time as the start time
    const checkpoint = await readCheckpoint(options);
    const startDateTime = new Date(Date.parse(checkpoint.datetime));
    const endDateTime = new Date();
    const playbackQueryResults = await ocs_utils.getPlaybackEvents(
        ocsClient,
        options,
        startDateTime,
        endDateTime,
    );

    // Separate playback entries by name and get only the latest entry for each
    const filesToUpdate = Object.entries(
        playbackQueryResults.reduce((acc, entry) => {
            acc[entry.ocs_full_name] = acc[entry.ocs_full_name] || [];
            acc[entry.ocs_full_name].push(entry);
            return acc;
        }, {}),
    ).reduce((acc, [name, entries]) => {
        entries.sort((a, b) => {
            return (
                new Date(Date.parse(b.updated_at)) -
                new Date(Date.parse(a.updated_at))
            );
        });
        acc.push(entries[0]);
        return acc;
    }, []);

    // Write out all files that need updating
    try {
        await Promise.all(
            filesToUpdate.map((fileData) =>
                downloadFileAndUpdateCheckpoint(ocsClient, options, fileData),
            ),
        );
    } catch (e) {
        DdLogger.error(`Error restoring playback: ${e.message}`);
        return;
    }

    DdLogger.info("All playback events restored.");
}

async function verifyOutputPath(options) {
    // Make sure that the output directory isn't already being used for a different saved search or package
    const checkpoint = await readCheckpoint(options);

    if (checkpoint) {
        let errMsg;
        if (checkpoint.package_id) {
            if (checkpoint.package_name !== options.packageName) {
                errMsg = `The output directory ${options.outputDir} has already been used to store files from a different package: "${checkpoint.package_name}". Please use a different output directory.`;
            } else if (options.savedSearchName) {
                errMsg = `This output directory: ${options.outputDir} has already been used to store files from a saved search: "${checkpoint.saved_search_name}". Please use a different output directory.`;
            }
        } else if (checkpoint.saved_search_name) {
            if (checkpoint.saved_search_name !== options.savedSearchName) {
                errMsg = `This output directory: ${options.outputDir} has already been used to store files from a different saved search: "${checkpoint.saved_search_name}". Please use a different output directory.`;
            } else if (checkpoint.package_name) {
                errMsg = `This output directory: ${options.outputDir} has already been used to store files from a package: "${checkpoint.package_name}". Please use a different output directory.`;
            }
        }
        if (errMsg) {
            DdUtils.errorAndExit(errMsg);
        }
    }
}

async function startWsConnection(
    ocsClient,
    options,
    msgValidator,
    isRetry = false,
) {
    const wsClient = ws_utils.getWSClient(ocsClient, options);
    wsClient.on("open", async (_) => {
        if (isRetry) {
            startPlayback(ocsClient, options);
        } else {
            await writeCheckpoint(options);
        }
    });
    wsClient.on("message", (msg) => {
        wsMessageHandler(ocsClient, msg, options, msgValidator);
    });
    const retryInterval = 5000;
    wsClient.on("error", (e) => console.log(e));
    wsClient.on("close", async (_) => {
        DdLogger.warn(
            `Connection to middleware interrupted, retrying in ${
                retryInterval / 1000
            } seconds...`,
        );

        // Write checkpoint w/ a slightly earlier start time, to correct for the time that this socket may have been
        // dead before firing the "close" event.
        await writeCheckpoint(options, new Date(Date.now() - 30 * 1000));
        setTimeout((_) => {
            startWsConnection(ocsClient, options, msgValidator, true);
        }, retryInterval);
    });
}

async function main() {
    // Get CLI args and main config
    const options = getArgs();

    // Initialize the OCS client
    const ocsClient = await ocs_utils.getOCSClient(options);

    // Verify options
    if (options.regex) {
        try {
            new RegExp(options.regex);
        } catch (e) {
            DdUtils.errorAndExit(
                `Regexp ${options.regex} is not a valid regular expression.`,
            );
        }
    }

    if (options.savedSearchName && options.packageName) {
        DdUtils.errorAndExit(
            "Both a saved search and a package have been specified. Please choose only one",
        );
    }

    // Verify that the requested package or saved search exists
    if (options.packageName) {
        const packageInfo = await ocs_utils.getPackageID(
            ocsClient,
            options.packageName,
        );
        if (!packageInfo) {
            DdUtils.errorAndExit(`Cannot find package: ${options.packageName}`);
        }
        options.packageInfo = packageInfo;
    } else if (options.savedSearchName) {
        let savedSearch;

        // Check that there's actually a saved search by this name
        try {
            ocs_utils.getSavedSearchInfo(ocsClient, options.savedSearchName);
        } catch (e) {
            DdUtils.errorAndExit(e.message);
        }
    }

    await verifyOutputPath(options);
    const checkpoint = await readCheckpoint(options);

    if (options.playback) {
        if (checkpoint) {
            startPlayback(ocsClient, options);
        } else {
            DdLogger.debug("Playback requested but this is a new subscription");
        }
    }

    const msgValidator = createMessageValidator();
    startWsConnection(ocsClient, options, msgValidator);
}

main();
