/**
 * @author wphyo
 * Created on 6/1/22.
 */

const Validator = require("jsonschema").Validator;
const v = new Validator();
const fs = require("fs");
const crypto = require("crypto");
const OsLib = require("os");
const FsLib = require("fs");
const PathLib = require("path");
const DdConstants = require("./DdConstants.js");

const isValidJson = (obj, schema) => {
    if (obj === null || obj === undefined) {
        return false;
    }
    return v.validate(obj, schema).valid;
};

/**
 *
 * @param input
 * @return {{result: undefined, error: string}|{result: any, error: undefined}}
 */
const jsonTryParse = (input) => {
    try {
        return {
            result: JSON.parse(input),
            error: undefined,
        };
    } catch (error) {
        return {
            result: undefined,
            error: error.toString(),
        };
    }
};

async function getFileHash(filePath) {
    const hashPromise = new Promise((resolve, reject) => {
        const hash = crypto.createHash("md5");
        const readableStream = fs.createReadStream(filePath);
        readableStream.on("data", (chunk) => {
            hash.update(chunk);
        });
        readableStream.on("end", (_) => {
            resolve(hash.digest("hex"));
        });
    });
    return await hashPromise;
}

function filterToRegexp(filter) {
    let filterString = filter.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    filterString = "^" + filterString.replace(/\*/g, ".*") + "$";
    return new RegExp(filterString);
}

function parseLogRollingOptionIntoWinstonDatePattern(optionString) {
    switch (optionString) {
        case "monthly":
            return "YYYYMM";
        case "weekly":
            return "YYYY-[w]w";
        case "daily":
            return "YYYYMMDD";
        default:
            return optionString;
    }
}

function getCfgFilepath() {
    let HOME = OsLib.homedir();
    let SEP = PathLib.sep;
    let CFG_FILE = `${HOME}${SEP}${DdConstants.CFG_FILEDIR}${SEP}${DdConstants.CFG_FILENAME}`;

    return CFG_FILE;
}

module.exports = {
    isValidJson,
    jsonTryParse,
    getFileHash,
    filterToRegexp,
    parseLogRollingOptionIntoWinstonDatePattern,
    getCfgFilepath,
};
