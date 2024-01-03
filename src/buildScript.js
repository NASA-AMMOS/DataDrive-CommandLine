'use strict';

const shelljs = require('shelljs');
const minimist = require('minimist');
const fs = require('fs-extra');
const path = require('path');

const WORKSPACE = process.env.WORKSPACE || process.cwd();
const DIST_DIR = `${__dirname}-dist`;
const SVC_NAME = 'cli'; //path.basename(__dirname);
const ZIP_FILE = `ddrv-${SVC_NAME}-bundle.zip`;
const DEPLOY_DIR = '../deployment';
const PKG_DIR = './ddrv-cli';

//console.log(`DIST_DIR = ${DIST_DIR}`)
//console.log(`DEPLOY_DIR = ${DEPLOY_DIR}`)
//console.log(`PKG_DIR = ${PKG_DIR}`)


const README_FILE = 'README.TXT';

const {
    clean,
    build,
    deploy
} = minimist(process.argv.slice(2));

let logLevel = 0;

function upLevel(lvlDelta) {
    logLevel += lvlDelta;
}

function log(msg) {
    console.log('  '.repeat(logLevel) + msg);
}

function err(msg) {
    console.error('  '.repeat(logLevel) + msg);
}

function doClean() {
    doBuildClean();
    doDeployClean();
}

function doBuildClean() {
    log(`Remove distribution directory ${DIST_DIR} `);
    shelljs.cd(`${DIST_DIR}/..`);
    fs.removeSync(DIST_DIR);
}

function doDeployClean() {
    let deplDir = path.resolve(DIST_DIR, DEPLOY_DIR);
    log(`Remove deployment directory ${deplDir} `);
    shelljs.cd(`${deplDir}/..`);
    fs.removeSync(deplDir);
}

function doInit() {
    log(`Initializing distribution directory ${DIST_DIR}.`);
    fs.emptyDirSync(DIST_DIR);
}

function doCopyRecursive(fromDir, toDir) {
    const files = fs.readdirSync(fromDir);
    if (!files || files.length === 0) {
        err(`Directory ${fromDir} is empty or not readable???.`);
        process.exit(1);
    }

    // For each file in the directory
    for (let i = 0; i < files.length; i++) {
        // get the full path of the file
        const fromFilePath = path.join(fromDir, files[i]);
        const toFilePath = path.join(toDir, files[i]);

        // Recurse if directory.
        const _stats = fs.lstatSync(fromFilePath);
        if (_stats.isDirectory()) {
            if (files[i] === 'core' || files[i] === 'plugins' || files[i] === 'exceptions') {
                log(`Copying directory ${fromFilePath}...`);
                upLevel(1);
                doCopyRecursive(fromFilePath, toFilePath);
                upLevel(-1);
            }
        } else {
            log(`Copying file ${files[i]}`);
            fs.copySync(fromFilePath, toFilePath);
        }

    }
}

function doCopy() {
    log(`Copying files from ${__dirname} to ${DIST_DIR}.`);
    upLevel(1);
    doCopyRecursive(__dirname, DIST_DIR);
    shelljs.cd(DIST_DIR);
    //log('Editing package.json');
    //shelljs.sed('-i', /file..*ocs-js-client/, 'file:./ocs-js-client', 'package.json');
    //log('Getting the OCS client');
    //shelljs.exec('git clone --depth 1 https://github.jpl.nasa.gov/MIPL/DataDrive-CommandLine.git');
    fs.removeSync(`${DIST_DIR}/DataDrive-CommandLine.git`);
    // shelljs.rm('-r', './DataDrive-CommandLine/test');
    // shelljs.rm('-r', './DataDrive-CommandLine/docs');
    upLevel(-1);
}

function doConfig() {
    log(`Setting up NPM config params in ${DIST_DIR}.`);
    if (process.env.VENUE || process.env.BRANCH) {
        log(`Found environment variables VENUE=${process.env.VENUE} and BRANCH=${process.env.BRANCH}`);
        const NPMRC = `${DIST_DIR}/.npmrc`;
        if (process.env.VENUE) {
            fs.writeFileSync(NPMRC, `venue = "${process.env.VENUE}"\n`);
        }
        if (process.env.BRANCH) {
            fs.appendFileSync(NPMRC, `branch = "${process.env.BRANCH}"\n`);
        }
    } else {
        log('No environment variables for VENUE/BRANCH. Deployment will use the defaults from package.json');
    }
}

function doInstall() {
    log(`Running NPM INSTALL in ${DIST_DIR}.`);
    shelljs.cd(DIST_DIR);
    shelljs.exec('npm install --production');
}

function doBuild(clean = true) {
    log(`Building ${__dirname} in ${DIST_DIR}:`);
    upLevel(1);
    doInit();
    doCopy();
    doConfig();
    doInstall();
    upLevel(-1);
}

function doPackage() {
    shelljs.cd(DIST_DIR);
    for (const tgtOS of ['linux', 'macos', 'win']) {
        log(`Packaging the DataDrive CLI for ${tgtOS}`);
        fs.ensureDirSync(`${PKG_DIR}/${tgtOS}-x64`);
        shelljs.exec(`pkg . -t ${tgtOS}-x64 --output ${PKG_DIR}/${tgtOS}-x64/ddrv`);
        shelljs.chmod(555, `${PKG_DIR}/${tgtOS}-x64/ddrv*`);
    }
    // Move the README
    log(`Copying ${README_FILE}.`);
    shelljs.cp(`${README_FILE}`, `${PKG_DIR}`);
    shelljs.cd(PKG_DIR);
    // ZIP it up, ready for staging.
    shelljs.exec(`zip -rq ${ZIP_FILE} .`);
    shelljs.mv(`${ZIP_FILE}`, '..');
}

function doStage() {
    let stageDir = path.resolve(DIST_DIR, DEPLOY_DIR);
    stageDir = `${stageDir}/dist`;

    log(`Staging ${DIST_DIR} to ${stageDir}/${ZIP_FILE}:`);
    fs.ensureDirSync(stageDir);
    shelljs.cd(DIST_DIR);
    const _ret = shelljs.mv(`${ZIP_FILE}`, `${stageDir}/${ZIP_FILE}`);
    if (_ret.code !== 0) {
        err(_ret.stderr);
    }
}

function doDeploy() {
    log(`Deploying service ${SVC_NAME}`);
    upLevel(1);
    doBuild();
    doPackage();
    doStage();
    doBuildClean();

    upLevel(-1);
}

function ensureProjectDir() {
    process.chdir(WORKSPACE);
}

// -------------------------------------------------------------------------------------------------
// Start of "main".
// -------------------------------------------------------------------------------------------------
ensureProjectDir();
if (deploy) {
    doDeploy();
   //log(`Deploy option currently not supported`);
} else if (clean) {
    doClean();
} else if (build) {
    doBuild();
}

