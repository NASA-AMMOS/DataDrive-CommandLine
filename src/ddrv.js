const DdPackageJSON = require("./package.json");
const { Command } = require("commander");
const program = new Command();

program
    .name("ddrv")
    .description(
        "Command-line interface to the DataDrive file management system.",
    )
    .version(DdPackageJSON.version);

program.command("config", "Configure CLI");
program.command("subscribe [parameters]", "subscribe to an OCS package.");
program.command("publish [parameters]", "publish to an OCS package.");
program.command("show <parameters>", "display one or many OCS resources.");

program.parse();
