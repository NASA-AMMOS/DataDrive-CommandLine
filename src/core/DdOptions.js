"use strict";

const os = require("os");
const HOME = os.homedir();
const path = require("path");
const fs = require("fs");

const prog = require("commander");
const Client = require("@gov.nasa.jpl.m2020.cs3/ocs-js-client");
const DdConsts = require("./DdConstants.js");

let options = (function () {
    let parsed = false;

    let options = function () {
        parsed = false;
    };

    // Make module-local variables visible.
    options.program = prog;

    //--------------------------------------------------------------------------
    // Mirror API of commander.
    //--------------------------------------------------------------------------

    options.version = function (...args) {
        prog.version(...args);
    };

    options.option = function (...args) {
        prog.option(...args);
    };

    options.parseTopArgs = function (...args) {
        options.parseInternal(false, ...args);
    };

    options.parse = function (...args) {
        options.setName();
        options.parseInternal(true, ...args);
    };

    options.parseInternal = function (addStandard, ...args) {
        if (parsed) {
            throw Error("You can only call parse() once.");
        }
        // Add the standard options.
        if (addStandard) {
            addStandardOptions();
        }

        // Add the standard help if not already done.
        //if (typeof prog._events['--help'] === 'undefined') {
        prog.on("--help", printStandardHelp);
        //}

        // Parse.
        try {
            prog.parse(...args);
            parsed = true;
        } catch (err) {
            options.errorAndExit(err);
        }
        validateArgs(prog);
    };

    options.command = function (...args) {
        prog.command(...args);
    };

    options.usage = function (...args) {
        prog.usage(...args);
    };

    options.setArgs = function (...args) {
        prog.arguments(...args);
    };

    options.setName = function () {
        let cmdName = path.basename(require.main.filename);
        cmdName = cmdName.replace(/^([^-]+)-([^.]+)\.js/, "$1-$2");
        prog.name(cmdName);
    };

    //--------------------------------------------------------------------------
    // Value added methods.
    //--------------------------------------------------------------------------

    options.setCustomHelp = function (printCustomHelp) {
        if (parsed) {
            throw Error("Cannot call setCustomHelp after calling parse");
        }
        prog.on("--help", function () {
            printCustomHelp();
            //printStandardHelp();
        });
    };

    options.errorAndExit = function (err) {
        printErrMessage(err);
        process.exit(1);
    };

    options.exit = function (exitCode) {
        process.exit(exitCode);
    };

    /**
     *
     * @param {string[]} args
     */
    options.parseSubscriptionOptions = function (args) {
        //DdOptions.setArgs('[FILE...]', 'The files or expressions to list.');

        this.version("\n*** " + DdConsts.CLIENT_TITLE + " ***\n\n");
        this.option(
            "-p, --package-name [pkg name]",
            "The name of the package.",
        );
        this.option("-o, --output-dir   <output dir>", "The output directory.");
        this.option(
            "-f, --filter [value]",
            "A wildcard expression to filter files based on OCS Full Name.",
            "*",
        );
        this.option(
            "-x, --regex [value]",
            "A regex expression to filter files based on OCS Full Name. Please reference https://www.elastic.co/guide/en/elasticsearch/reference/6.4/query-dsl-regexp-query.html#regexp-syntax and NodeJS RegExp.",
        );
        this.option(
            "-s, --saved-search-name [value]",
            "Name of your personnel saved search.",
        );
        this.option(
            "-r, --retain-path",
            "Use the S3 path as relative path when writing files",
        );
        this.option(
            "-P, --playback",
            "Get events that has since happened after the last downloaded file.",
        );
        this.option(
            "-if, --include-full-path",
            "If filter and regex expressions include only the name or the full path. defaulted to `NO`.",
        );
        this.option(
            "-O, --overwrite",
            "Overwrite file if it already exists in that path.",
        );
        this.option(
            "-S, --skip-unchanged",
            "Only download files that are new or have changed.",
        );
        // DdOptions.option('--pluginsAsync',                   'Execute custom plugins asynchronously, this will be ignored if plugins are not enabled.');
        // this.option('--pluginsDir [plugin dir]',        'Directory to load custom plugins.');
        this.option(
            "--plugin-path [value]",
            "Path to the custom plugin file that implements class DdPlugin.",
        );
        this.option(
            "--disable-download",
            "Disable downloading of files. Make sure to still include an output-dir option.",
        );
        //DdOptions.parseTopArgs(process.argv);
        // Utils.setCustomHelp(function () {
        //     console.log('');
        //     console.log('  You can use the * and ? wildcards in FILE, as well as [].');
        // });

        this.parse(args);
    };

    //--------------------------------------------------------------------------
    // Internal methods.
    //--------------------------------------------------------------------------

    const validateArgs = function () {
        let _msg = "";
        prog.options.forEach(function (opt) {
            // if (opt.required !== 0 || opt.required === true) {
            if (opt.required === true) {
                let _name = optName(opt.long);
                //                    console.log("DEBUG::Opt.required? = "+_name+" = "+opt.required);
                if (!prog[_name]) {
                    _msg = _msg + `ERROR: ${opt.flags} is required.\n`;
                }
            }
        });
        if (_msg !== "") {
            options.errorAndExit(_msg);
        }
    };

    let optName = function (longFlag) {
        let _name = longFlag.replace("--", "");
        return _name.split("-").reduce(function (str, word) {
            return str + word[0].toUpperCase() + word.slice(1);
        });
    };

    let printStandardHelp = function () {
        console.log("");
        console.log(
            '  NOTE that you have to specify flags separately ("-p -d" and NOT "-pd").',
        );
        console.log("");
        //        console.log('  For a full explanation of all options, consult the online documentation');
        //        console.log('  at https://github.jpl.nasa.gov/M2020-CS3/m2020-data-lake/wiki/OCS-CLI-Reference');
    };

    let addStandardOptions = function () {
        prog.option(
            "-q, --quiet",
            "If specified, do not output progress messages",
            false,
        );
    };

    let printErrMessage = function (...args) {
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

            console.error("");
            console.error(_msg);
        }
    };

    return options;
})();

module.exports = options;
