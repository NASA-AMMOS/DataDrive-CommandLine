const { Command, Option } = require("commander");
const program = new Command();

const licenseText = `${LICENSE_TEXT}`;

function main() {
    console.log(licenseText);
}

main();
