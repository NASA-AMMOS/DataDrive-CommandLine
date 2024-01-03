'use strict';


const DdConsts     = require('./core/DdConstants.js');
const DdUtils      = require('./core/DdUtils.js');
const DdOptions    = require('./core/DdOptions.js');
const DdLogger     = require('./core/DdLogger.js').logger;
const {DdCliConfigFileIO} = require('./core/DdCliConfigFileIO');

const Table        = require('easy-table');


//get initial state
let   _dHost  = DdConsts.DEFAULT_DD_HOST;
let   _pHost  = DdConsts.DEFAULT_PEP_HOST;
const _cfg    = DdCliConfigFileIO.builder().readConfig(false);
if (_cfg)
{
    if (_cfg[DdConsts.PROP_DATADRIVE_HOST])
        _dHost = _cfg[DdConsts.PROP_DATADRIVE_HOST];
    if (_cfg[DdConsts.PROP_PEP_HOST])
        _pHost = _cfg[DdConsts.PROP_PEP_HOST];
}


DdOptions.option( '-d, --dd-host  [dd-host]',    'DataDrive middleware host.');
DdOptions.option( '-p, --pep-host [pep-host]',   'PEP host.');
DdOptions.option( '-r --reset', `Reset configuration to default values.`);
DdOptions.setCustomHelp(function () {
    console.log('');
    console.log('  When no arguments are specified, the command displays the current configuration.');
});
DdOptions.parse(process.argv);


//Print config nicely
function stringifyDd(map) {
    if (map) {
        const t = new Table();
        t.cell('DataDrive Host:', map[DdConsts.PROP_DATADRIVE_HOST] || '(undefined)');
        t.cell('PEP Host:', map[DdConsts.PROP_PEP_HOST] || '(undefined)');
        t.newRow();
        return '\n' + t.printTransposed();
    } else{
        return "\nNo configuration available."
    }

}

function stringifyOcs(map) {
    if (map) {
        const t = new Table();
        t.cell('OCS Host:', map[DdConsts.PROP_OCS_HOST] || '(undefined)');
        t.cell('OCS API:', map[DdConsts.PROP_OCS_API_DEPLOYMENT] || '(undefined)');
        t.newRow();
        return '\n' + t.printTransposed();
    } else {
        return "\nNo configuration available."
    }
}



if (DdOptions.program.reset) {
    //check for incompatible options
    if (DdOptions.program.ddHost || DdOptions.program.pepHost) {
        DdUtils.errorAndExit('You cannot specify "--reset" with any other options.');
    } else {
        _dHost = DdConsts.DEFAULT_DD_HOST;
        _pHost = DdConsts.DEFAULT_PEP_HOST;
    }
} else if (!DdOptions.program.ddHost && !DdOptions.program.pepHost ) {

    DdLogger.info('\nDataDrive configuration is:' + stringifyDd(_cfg));

    //add the OCS config stuff users prolly care about
    //let ocsCfg = OcsCfg.getOcsConfig(false);
    //DdLogger.info('\nOCS configuration is:' + stringifyOcs(ocsCfg));
    //DdLogger.info( "");
    process.exit(0);
}

if (DdOptions.program.ddHost && DdOptions.program.ddHost !== true) {
    _dHost = DdOptions.program.ddHost;
}
 if (DdOptions.program.pepHost && DdOptions.program.pepHost !== true) {
     _pHost = DdOptions.program.pepHost;
}

//Save changes to config file
DdCliConfigFileIO.builder().writeConfig({ datadriveHost : _dHost, pepHost : _pHost});

//inform user of updated state
let _updatedCfg = DdCliConfigFileIO.builder().readConfig(false);
if (_updatedCfg)
    DdLogger.info('\nThe DataDrive configuration has been changed to:' + stringifyDd(_updatedCfg));
else
    DdUtils.errorAndExit('\nUnable to read updated DataDrive configuration file.');
