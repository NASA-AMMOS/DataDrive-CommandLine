/**
 * @author nttoole
 * Created on 6/5/18.
 */

const winston = require('winston');

let debugEnabled = false;
const infoForUserFlag = true;


const { combine, timestamp, label, json, prettyPrint, printf } = winston.format;



const logger = winston.createLogger({
    level: 'info',
    format: combine(
        label({ label: 'DataDrive' }),
        timestamp(),
        // json(({ level, message, label, timestamp }) => {
        //     return `${timestamp} [${label}] ${level}: ${message}`;
        // }),
        printf(({ level, message, label, timestamp }) => {
            return `${timestamp} [${label}] ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        //new winston.transports.Console({format: winston.format.simple()})  winston.format.prettyPrint()
        new winston.transports.Console({})
    ]
});


if (debugEnabled) {
    logger.level = "debug";
}

exports.logger = {
    setDebugEnabled: (flag) => {
        if (flag) {
            logger.level = "debug";
            logger.log({
                level: 'debug',
                message: "Debug logging enabled"
            });
        }
        else
            logger.level = "info";
    },
    info: (msg) => logger.log({
        level: 'info',
        message: msg
    }),
    debug: (msg) => logger.log({
        level: 'debug',
        message: msg
    }),
    warn: msg => logger.log({
        level: 'warn',
        message: msg
    }),
    error: msg => logger.log({
        level: 'error',
        message: msg
    }),
    printError: (...args) => {

        if (args.length > 1) {
            console.error(...args);
        } else {
            let err = args[0];
            let _msg;
            if (err instanceof Error) {
                _msg = `error: ${err.toString()}`;
            } else if (typeof err === 'object') {
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
                if (err.toString().startsWith('ERROR') || err.toString().startsWith('error')) {
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

            logger.error('');
            logger.error(_msg);
        }
    },
};