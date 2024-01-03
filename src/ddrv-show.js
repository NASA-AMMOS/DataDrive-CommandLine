'use strict';


const DdConsts = require('./core/DdConstants.js');
const DdOptions = require('./core/DdOptions.js');
const DdConfig = require('./core/DdConfig.js');
const {DataDriveMWServiceSettings} = require('./core/DataDriveMWServiceSettings')

const DdUtils = require('./core/DdUtils.js');
const DdLogger = require('./core/DdLogger.js').logger;

const Table = require('easy-table');


// load initial config/env
const config = new DdConfig(DdOptions.program);

/**
 * Initialize OCS client
 * @returns {Promise}
 */
async function initiate() {
    //get OCS settings from middleware
    let ddService = DataDriveMWServiceSettings.builder(config.dataDriveHost, config.cssoToken)
    try {
        await ddService.loadSettings()
    } catch (e) {
        DdUtils.errorAndExit(e.toString())
    }
    config.setOcsSettings(ddService.getOcsEndpointHost(), ddService.getOcsApiStage())
    config.initiate_OcsClient()
}

/**
 * Call OCS to get a list of packages
 * @returns {Promise}
 */
async function getPackages() {
    try {
        return new Promise((resolve, reject) => {
            const rqst = {
                csso: {
                    sessionToken: config.cssoToken
                }
            };
            config.ocsUtils._ocsClient.describeAllPackages(rqst, (err, resp) => {
                if (err) {
                    reject(err);
                }
                else if (resp.error) {
                    reject(resp.error);
                }
                else {
                    resolve(resp);
                }
            })
        });
    } catch (error) {
        DdUtils.errorAndExit(error);
    }
}

//Print config nicely
/**
 * Turns array of JSON information about packages into a table for console log
 * @param {Array} data
 * @returns {String}
 */
function stringifyPackages(data) {
    if (data) {
        const t = new Table();
        for (let i = 0; i < data.length; i++) {
            t.cell('Name:', data[i][DdConsts.OCS_PACKAGE_NAME] || '(undefined)');
            t.cell('Desc:', data[i][DdConsts.OCS_PACKAGE_DESCRIPTION] || '(undefined)');
            t.newRow();
        }
        return '\n' + t.toString();
    }
    return '';
}

/**
 * CLI entrypoint; Checks to see if right arguments and options are set then get the resource
 * @returns {Promise}
 */
async function main() {
    await initiate();
    // Configure CLI
    DdOptions.program.name("ddrv");
    DdOptions.program.usage("show <resource>");
    DdOptions.program.on('--help', () => {
        console.log('');
        console.log('Examples:');
        console.log('  # List packages in OCS.')
        console.log('  ddrv show packages')
    });
    //
    let resource = undefined;
    await new Promise((resolve, reject) => {
        DdOptions.program.arguments('<resource>').action(async (arg) => {
            resource = arg;
        });
        DdOptions.program.parse(process.argv);
        resolve();
    });

    if (resource == 'packages') {
        let results = await getPackages();
        console.log(stringifyPackages(results.data));
    }
    else if (resource === undefined) {
        console.log('You must specify the type of resource to show. Ex: packages');
        process.exit(1);
    }
    else {
        DdUtils.errorAndExit('Resource does not exist.')
    }
    process.exit(0);
}

main();
