const path = require("path");
const fs = require("fs");
const https = require("https");
const fetch = require("node-fetch");
const urllib = require("url");
const nodeUtil = require("node:util");
const exec = nodeUtil.promisify(require("node:child_process").exec);

const ocsJSClientMdms = require("@gov.nasa.jpl.ammos.ids/mdms-aocs-js-client");
const ocsJSClientM20 =
    require("@gov.nasa.jpl.m2020.cs3/ocs-js-client").OcsClient;

const CSsoClient = require("@gov.nasa.jpl.m2020.cs3/ocs-js-client/core/csso");
const SsoClient = require("@gov.nasa.jpl.ammos.ids/mdms-aocs-js-client/core/sso");

const DdLogger = require("./DdLogger").logger;
const DdConsts = require("./DdConstants");
const config = require("./config.js").config;
const utils = require("./utils.js");

const OCS_MESG_SCHEMA = {
    type: "object",
    properties: {
        package_id: { type: "string" },
        dataset_id: { type: "string" },
        ocs_full_name: { type: "string" },
        ocs_url: { type: "string" },
        package_dataset_event: { type: "string" },
        identity: { type: "string" },
        package_dataset_event_time: { type: "number" },
    },
    required: [
        "package_id",
        "dataset_id",
        "ocs_full_name",
        "ocs_url",
        "package_dataset_event",
        "identity",
        "package_dataset_event_time",
    ],
};

const OCS_ERR_SCHEMA = {
    type: "object",
    properties: {
        error: { type: "Boolean" },
        message: { type: "string" },
    },
    required: ["error", "message"],
};

const DD_UPLOAD_STATUS_SCHEMA = {
    type: "object",
    properties: {
        upload_status: { type: "string" },
        username: { type: "string" },
        failed: { type: "boolean" },
        upload_name: { type: "string" },
    },
    required: ["upload_status", "username", "upload_name", "failed"],
};

const DD_SAVED_SEARCH_MESG_SCHEMA = {
    type: "object",
    properties: {
        package_id: { type: "string" },
        dataset_id: { type: "string" },
        ocs_full_name: { type: "string" },
        ocs_url: { type: "string" },
        package_dataset_event: { type: "string" },
        identity: { type: "string" },
        package_dataset_event_time: { type: "number" },
        ss_type: { type: "string" },
        ss_name: { type: "string" },
        ss_owner: { type: "string" },
    },
    required: [
        "package_id",
        "dataset_id",
        "ocs_full_name",
        "ocs_url",
        "package_dataset_event",
        "identity",
        "package_dataset_event_time",
        "ss_type",
        "ss_name",
        "ss_owner",
    ],
};

function getAllPackages(ocsClient, callback) {
    const options = {
        [ocsClient.ssoKey]: {
            sessionToken: ocsClient.token,
        },
    };

    return ocsClient.client.describeAllPackages(options, callback);
}

function getPackageID(ocsClient, package) {
    const options = {
        [ocsClient.ssoKey]: {
            sessionToken: ocsClient.token,
        },
    };

    return new Promise((resolve, reject) => {
        ocsClient.client.describeAllPackages(options, (err, res) => {
            if (err) {
                DdLogger.errorAndExit(`Error making request to OCS: ${err}`);
            }
            resolve(res.data.find((pkg) => pkg.name === package));
        });
    });
}

function parseS3Url(s3Url) {
    if (!s3Url.startsWith(DdConsts.S3_PROTOCOL)) {
        return undefined;
    }
    const _matches = s3Url.match(DdConsts.S3_URL_REGEX);
    return {
        bucket: _matches[1],
        key: _matches[2],
    };
}

function getPermalinkFromFileDataViaPEP(pepUrl, fileData) {
    const parsedUrl = parseS3Url(fileData.ocs_url);
    if (parsedUrl && parsedUrl.bucket && parsedUrl.key) {
        // This is an S3 URL.
        if (pepUrl) {
            pepUrl = pepUrl.startsWith("https://")
                ? pepUrl
                : "https://" + pepUrl;
            return `${pepUrl}/${parsedUrl.bucket}/${parsedUrl.key}`;
        } else {
            throw Error(
                "The PEP server information is not defined. The configuration needs to be updated.",
            );
        }
    } else {
        // Not an S3 URL, so we just return as is. Assume the resource is already protected by CSSO.
        return url;
    }
}

async function downloadFileFromMetadata(
    ocsClient,
    fileData,
    destPath,
    options,
) {
    // CHECK FOR OVERWRITE
    const overwrite = Boolean(options.overwrite);
    let fileExists;
    try {
        fileExists = !(await fs.promises.access(destPath));
    } catch (e) {
        fileExists = false;
    }
    if (!overwrite && fileExists) {
        DdLogger.debug(`Skipping overwrite of ${destPath}`);
        return;
    }

    DdLogger.info(`Write out file ${fileData.ocs_full_name} to ${destPath}`);

    // Check that the output dir exists, create if not
    const destDir = path.dirname(destPath);
    let pathExists;
    try {
        pathExists = !(await fs.promises.access(destDir));
    } catch (e) {
        pathExists = false;
    }

    if (!pathExists) {
        try {
            await fs.promises.mkdir(destDir, { recursive: true });
        } catch (e) {
            DdLogger.error(
                `Can't create path at ${destDir} for file ${fileData.ocs_full_name}`,
            );
            return;
        }
    }

    const downloadUrl = getPermalinkFromFileDataViaPEP(
        config.pepHost,
        fileData,
    );

    const fetchOptions = {
        headers: {
            Cookie: `${DdConsts.SSO_SESSION_KEY_LOOKUP[config.authType]}=${
                ocsClient.token
            }`,
        },
        followRedirect: true,
        gzip: true,
        timeout: 60 * 1000,
        time: true,
    };

    if (config.authType === "MGSS") {
        fetchOptions.headers["Content-Type"] = "application/json";
    }

    let res = await fetch(downloadUrl, fetchOptions);

    if (!res.ok) {
        DdLogger.error(
            `Couldn't download file: ${fileData.ocs_full_name}: ${res}`,
        );
        return;
    }

    if (config.authType === "MGSS") {
        const presigned_url_msg = await res.json();
        delete fetchOptions.headers["Content-Type"];
        res = await fetch(presigned_url_msg.presigned_url, fetchOptions);
        if (!res.ok) {
            DdLogger.error(
                `Couldn't download file: ${fileData.ocs_full_name}: ${res}`,
            );
            return;
        }
    }

    const fileStream = fs.createWriteStream(destPath);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
    });

    // Kick off callback command if there is one
    if (options.callback) {
        const env = {
            ...process.env,
            FILENAME: getFilenameFromOCSURL(fileData.ocs_full_name),
            SRC_PATH: fileData.ocs_full_name,
            DEST_PATH: destPath,
        };
        const { stdout, stderr } = await exec(options.callback, { env });
        DdLogger.info(stdout);
        if (stderr) {
            DdLogger.error(
                `Error encountered running file download callback: "${options.callback}": ${stderr}`,
            );
        }
    }

    // Check that file on disk matches checksum
    // const hash = await utils.getFileHash(destPath);
    // if (hash !== fileData.ocs_etag) {
    //     throw new Error("Downloaded file hash doesn't match ocs_etag value.");
    // }
}

async function getMiddlewareSettings(config, token) {
    const options = {
        method: "GET",
        headers: {
            Cookie: `${DdConsts.SSO_SESSION_KEY_LOOKUP[config.authType]}=${token}`,
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    };

    let url = config.datadriveHost;
    if (!url.startsWith("https")) {
        url = "https://" + url;
    }

    let middlewareSettings;
    let res;
    try {
        res = await fetch(url, options);
        middlewareSettings = await res.json();
    } catch (e) {
        let outMsg = `Can't connect to middleware endpoint at url: ${url}.`;
        if (res && res.status === 401) {
            const authProgram =
                config.authType === "M20"
                    ? "CREDSS"
                    : "/etc/request_ssotoken.sh";
            outMsg = `Authentication error connecting to DataDrive. Have you updated your credentials via ${authProgram} recently?`;
        }

        return DdLogger.errorAndExit(outMsg);
    }

    DdLogger.debug(
        "OCS Settings from DataDrive middleware [Url: " +
            middlewareSettings.ocs_endpoint +
            ", Port: " +
            middlewareSettings.ocs_endpoint_port +
            ", " +
            " Stage: " +
            middlewareSettings.ocs_stage +
            "]",
    );

    return middlewareSettings;
}

async function getOCSClient(options) {
    // Get auth token and use it to get settings from middleware
    const venue = "";

    let token;
    try {
        token =
            config.authType === "MGSS"
                ? SsoClient.cliGetSSOTokens(venue)
                : CSsoClient.cliGetCSSOTokens(venue);
    } catch (e) {
        DdLogger.errorAndExit(e.message);
    }

    const middlewareSettings = await getMiddlewareSettings(config, token);
    let ocsConfig = {
        ocsEndpointHost: middlewareSettings.ocs_endpoint,
        ocsApiStage: middlewareSettings.ocs_stage,
    };

    let client;
    switch (config.authType) {
        case "MGSS":
            ocsConfig.ocsEndpointPort = middlewareSettings.ocs_endpoint_port;
            client = new ocsJSClientMdms(ocsConfig);
            break;
        case "M20":
            client = new ocsJSClientM20(ocsConfig);
            break;
    }

    return {
        client,
        token,
        ssoKey: DdConsts.SSO_KEY_LOOKUP[config.authType],
        username: token.split(":") ? token.split(":")[1] : "",
    };
}

function getFilenameFromOCSURL(url) {
    return path.basename(urllib.parse(url).pathname);
}

async function getPlaybackEvents(
    ocsClient,
    options,
    startDateTime,
    endDateTime,
) {
    let body = {
        start_time: startDateTime.getTime(),
        end_time: endDateTime.getTime(),
        include_full_path: Boolean(options.includeFullPath),
    };

    if (options.packageInfo) {
        body.all_pkg = false;
        body.pkg = [options.packageInfo.package_id];
    }

    if (options.savedSearchName) {
        body.ss_name = options.savedSearchName;
    }

    if (options.regex) {
        body.regex = options.regex;
    }

    if (options.filter) {
        console.log(options.filter);
        body.glob_regex = options.filter.endsWith("*")
            ? options.filter
            : options.filter + "*";
    }

    const pathPrefix = encodeURI(options.savedSearchName ? "/ss" : "");
    let url = `${config.datadriveHost}/api${pathPrefix}/playback/v2`;
    url = url.startsWith("https://") ? url : "https://" + url;

    const reqOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: `ssosession=${ocsClient.token}`,
        },
    };

    DdLogger.debug(
        `getPlaybackEvents request options: ${JSON.stringify(options)}`,
    );

    let total;
    let allResults = [];
    let paginationMarker;
    do {
        if (paginationMarker) {
            body.pagination_marker = paginationMarker;
        }
        reqOptions.body = JSON.stringify(body);
        const res = await fetch(url, reqOptions);
        if (!res.ok) {
            DdLogger.error(
                `Error getting playback search results from middleware. Error code: ${res.status}`,
            );
            return allResults;
        }
        const parsedResult = await res.json();
        total = parsedResult.total;
        allResults = allResults.concat(parsedResult.results);
        paginationMarker = parsedResult.marker;
    } while (allResults.length < total);

    return allResults;
}

async function getSavedSearchInfo(ocsClient, name) {
    const host = config.datadriveHost.startsWith("https://")
        ? config.datadriveHost
        : "https://" + config.datadriveHost;

    const formattedName = encodeURIComponent(name);

    // Start by checking if there's a personal search with this name
    let url = `${host}/api/saved_search/get/${ocsClient.username}/${formattedName}`;
    const reqOptions = {
        headers: {
            "Content-Type": "application/json",
            Cookie: `ssosession=${ocsClient.token}`,
        },
    };

    let res = await fetch(url, reqOptions);
    if (res.ok) {
        return await res.json();
    }

    // No personal search found, let's try general
    url = `${host}/api/saved_search/get/${formattedName}`;
    console.log(url);
    res = await fetch(url, reqOptions);

    if (!res.ok) {
        let errMsg = `Error getting saved search ${name} from middleware. Error code: ${res.status}`;
        try {
            const err = await res.json();
            if (err.message.toLowerCase() === "empty result") {
                errMsg = `Can't find saved search ${name}.`;
            }
            throw new Error(errMsg);
        } catch (e) {
            throw new Error(
                "Bad response from DataDrive Middleware, which may be down.",
            );
        }
    }
    return await res.json();
}

async function uploadFile(ocsClient, fileDataForm) {
    const host = config.datadriveHost.startsWith("https://")
        ? config.datadriveHost
        : "https://" + config.datadriveHost;

    let url = `${host}/api/UploadAutoForce`;
    const reqOptions = {
        headers: {
            Cookie: `ssosession=${ocsClient.token}`,
        },
        method: "POST",
        body: fileDataForm,
    };

    return await fetch(url, reqOptions);
}

module.exports = {
    getPackageID,
    OCS_ERR_SCHEMA,
    DD_UPLOAD_STATUS_SCHEMA,
    OCS_MESG_SCHEMA,
    DD_SAVED_SEARCH_MESG_SCHEMA,
    getOCSClient,
    getFilenameFromOCSURL,
    downloadFileFromMetadata,
    getPlaybackEvents,
    getSavedSearchInfo,
    uploadFile,
    getAllPackages,
};
