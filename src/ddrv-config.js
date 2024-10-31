const fs = require("fs");
const { Command, Option } = require("commander");
const program = new Command();
const Table = require("easy-table");

const DdConsts = require("./core/DdConstants.js");
const DdLogger = require("./core/DdLogger.js").logger;
const getConfig = require("./core/config.js").getConfig;
const utils = require("./core/utils.js");

function displayExistingConfig() {
    const t = new Table();
    let config;
    try {
        config = getConfig();
    } catch (e) {
        DdLogger.errorAndExit(e.message);
    }

    [
        { key: "datadriveHost", text: "DataDrive Host" },
        { key: "pepHost", text: "PEP Host" },
        { key: "logdir", text: "Log Directory" },
        { key: "logDatePattern", text: "Date pattern used for rolling logs" },
        { key: "gzipRollingLogs", text: "Gzip rolling logs" },
        { key: "authType", text: "Authentication type (M20 or MGSS)" },
    ].forEach((row) => {
        t.cell(row.text, config[row.key] || "(undefined)");
    });
    t.newRow();
    DdLogger.info("\nDataDrive configuration is: \n" + t.printTransposed());
}

function writeNewConfig(options) {
    let existingConfig = {};
    try {
        existingConfig = getConfig();
    } catch (e) {}

    const outObj = {
        pepHost:
            options.pepHost ||
            existingConfig.pepHost ||
            DdConsts.DEFAULT_PEP_HOST,
        datadriveHost:
            options.ddHost ||
            existingConfig.datadriveHost ||
            DdConsts.DEFAULT_DD_HOST,
        logdir:
            options.logdir ||
            existingConfig.logdir ||
            DdConsts.DEFAULT_LOG_PATH,
        logDatePattern: options.logDatePattern,
        gzipRollingLogs: !options.noGzip,
        authType:
            options.authType ||
            existingConfig.authType ||
            DdConsts.DEFAULT_AUTH_TYPE,
    };

    const cfgPath = utils.getCfgFilepath();
    try {
        fs.writeFileSync(cfgPath, JSON.stringify(outObj));
    } catch (e) {
        DdLogger.errorAndExit(
            `Unable to write configuration file at ${cfgPath}. Do you have write permission to this location?`,
        );
    }
}

function main() {
    program
        .option("-p, --pep-host [pep-host]", "PEP host.")
        .option("-d, --dd-host  [dd-host]", "DataDrive middleware host.")
        .option(
            "-l --logdir [logdir]",
            `Directory to store log files. Default is current directory.`,
        )
        .option("-r --reset", `Reset configuration to default values.`)
        .option(
            "--log-date-pattern [log-date-pattern]",
            "Turns on log rolling using the specified format. Options are: monthly, weekly, daily. This option can also accept a custom format (more info: https://momentjs.com/docs/#/displaying/format/). This format will define the frequency of the log rotation, with the logs rotating on the smallest date/time increment specified in the format.",
        )
        .option(
            "--no_gzip_rolling_logs",
            "Disable gzipping of output logs if log-rolling is used.",
        )
        .addHelpText(
            "after",
            "\n  When no arguments are specified, the command displays the current configuration.",
        );

    program.addOption(
        new Option("-a, --auth-type <auth-type>", "Auth Type").choices([
            "M20",
            "MGSS",
        ]),
    );

    program.parse();

    const options = program.opts();

    // Handle no arguments (just display existing config)
    if (!Object.keys(options).length) {
        return displayExistingConfig();
    }

    // if (options.reset) {
    //     console.log("RESET");
    //     return;
    // }

    // Handle saving of new options
    writeNewConfig(options);
}

main();
