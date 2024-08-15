const { Command } = require("commander");
const program = new Command();
const Table = require("easy-table");

const DdConsts = require("./core/DdConstants.js");
const DdUtils = require("./core/DdUtils.js");
const DdLogger = require("./core/DdLogger.js").logger;
const ocs_utils = require("./core/ocs_utils.js");

async function getPackages() {
    const ocsClient = await ocs_utils.getOCSClient();
    ocs_utils.getAllPackages(ocsClient, (err, res) => {
        if (err) {
            DdUtils.errorAndExit(`Error making request to OCS: ${err}`);
        }
        const t = new Table();

        res.data.forEach((row) => {
            t.cell("Name:", row[DdConsts.OCS_PACKAGE_NAME] || "(undefined)");
            t.cell(
                "Description:",
                row[DdConsts.OCS_PACKAGE_DESCRIPTION] || "(undefined)",
            );
            t.newRow();
        });
        console.log(t.toString());
    });
}

async function main() {
    // Configure CLI
    program.argument(
        "<resource>",
        `type of resource to show (i.e. "packages")`,
    );
    program.parse();

    switch (program.args[0]) {
        case "packages":
            return await getPackages();
        default:
            console.log(`Only "packages" is supported.`);
    }
}

main();
