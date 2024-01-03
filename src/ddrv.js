'use strict';

//local imports
const DdConsts      = require('./core/DdConstants.js');
const DdUtils       = require('./core/DdUtils.js');
const DdOptions     = require('./core/DdOptions.js');
DdOptions.version('\n*** '+DdConsts.CLIENT_TITLE+' ***\n\n');
DdOptions.command('config', 'configure the DataDrive CLI.');
DdOptions.command('subscribe [parameters]', 'subscribe to an OCS package.');
DdOptions.command('publish [parameters]', 'publish to an OCS package.');
DdOptions.command('show <parameters>', 'display one or many OCS resources.')


DdOptions.parseTopArgs(process.argv);

// Verify that the command exits.
if (!DdOptions.program.commands.find(function (cmd) {
    return (cmd._name === process.argv[2]);
})) {
    DdUtils.errorAndExit(`ERROR: Unknown command ${process.argv[2]}`);
}

