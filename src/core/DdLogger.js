/**
 * @author nttoole
 * Created on 6/5/18.
 */

const path = require("node:path");
const winston = require("winston");
require("winston-daily-rotate-file");
const utils = require("./utils.js");
const { Command, Option } = require("commander");

// This section does some inspection of CLI args in case the user has overridden the configured values.
const program = new Command();

program
    .option("-l --logdir [logdir]")
    .option("--log-date-pattern [log-date-pattern]")
    .option("--no_gzip_rolling_logs")
    .allowUnknownOption()
    .exitOverride()
    .configureOutput({
        writeOut: (_) => null,
        writeErr: (_) => null,
        outputError: (_) => null,
    });

// We mute all the output of this args processor, since the user will never be calling this file directly.
// We want any error handling or help messages to be handled by the args processor of the file that has called this one.
let configOverrides = {};
try {
    program.parse();
    configOverrides = program.opts();
} catch (e) {}

// Get the base config from disk and combine it with any overrides that have been specified in the CLI
let config;
try {
    config = require("./config.js").getConfig();
} catch (e) {
    config = {};
}

config = { ...config, ...configOverrides };

let debugEnabled = false;
const infoForUserFlag = true;

const { combine, timestamp, label, json, prettyPrint, printf } = winston.format;

const baseLogPath = config.logdir || "./logs";

const transports = [new winston.transports.Console({})];

if (config.logDatePattern) {
    const logRotationTransport = new winston.transports.DailyRotateFile({
        filename: "combined-%DATE%.log",
        datePattern: utils.parseLogRollingOptionIntoWinstonDatePattern(
            config.logDatePattern,
        ),
        zippedArchive: Boolean(config.gzipRollingLogs),
        // maxSize: "20m",
        // maxFiles: "14d",
        dirname: baseLogPath,
    });
    transports.push(logRotationTransport);
} else {
    transports.push(
        new winston.transports.File({
            filename: path.join(baseLogPath, "combined.log"),
        }),
    );
}

const logger = winston.createLogger({
    level: "info",
    format: combine(
        label({ label: "DataDrive" }),
        timestamp(),
        // json(({ level, message, label, timestamp }) => {
        //     return `${timestamp} [${label}] ${level}: ${message}`;
        // }),
        printf(({ level, message, label, timestamp }) => {
            return `${timestamp} [${label}] ${level}: ${message}`;
        }),
    ),
    transports,
});

if (debugEnabled) {
    logger.level = "debug";
}

exports.logger = {
    setDebugEnabled: (flag) => {
        if (flag) {
            logger.level = "debug";
            logger.log({
                level: "debug",
                message: "Debug logging enabled",
            });
        } else logger.level = "info";
    },
    info: (msg) =>
        logger.log({
            level: "info",
            message: msg,
        }),
    debug: (msg) =>
        logger.log({
            level: "debug",
            message: msg,
        }),
    warn: (msg) =>
        logger.log({
            level: "warn",
            message: msg,
        }),
    error: (msg) =>
        logger.log({
            level: "error",
            message: msg,
        }),
    printError: (...args) => {
        if (args.length > 1) {
            console.error(...args);
        } else {
            let err = args[0];
            let _msg;
            if (err instanceof Error) {
                _msg = `error: ${err.toString()}`;
            } else if (typeof err === "object") {
                if (err.Message) {
                    _msg = `error: ${err.Message}`;
                } else if (err.message) {
                    _msg = `error: ${err.message}`;
                } else if (err.reason) {
                    _msg = `error: ${err.reason}\n      ${err.exception}`;
                } else {
                    _msg = JSON.stringify(err, null, 2);
                }
            } else {
                if (
                    err.toString().startsWith("ERROR") ||
                    err.toString().startsWith("error")
                ) {
                    _msg = err;
                } else {
                    _msg = `error: ${err.toString()}`;
                }
            }

            // Add causes, if any
            if (err.causes) {
                _msg = `${_msg}\nCaused By:`;
                for (let c of err.causes) {
                    if (c.message) {
                        _msg = `${_msg}\n${c.message}`;
                    } else if (c.error.message) {
                        _msg = `${_msg}\n${c.error.message}`;
                    } else {
                        _msg = `${_msg}\n${c}`;
                    }
                }
            }

            logger.error("");
            logger.error(_msg);
        }
    },
    errorAndExit: function (err) {
        if (err instanceof Error) {
            logger.error(err.message);
            logger.debug(err.stack);
        } else {
            logger.error(err);
        }
        process.exit(1);
    },
};
